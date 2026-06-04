import cron from 'node-cron';
import moment from 'moment-timezone';
import { Parser } from 'json2csv';
import config from '../config/config.js';
import { logger } from '../utils/logger.js';
import { notifyStatementUpload } from '../utils/sockets.js';
import { sendTelegramStatementUploadCSV } from '../utils/sendTelegramMessages.js';
import {
  getPendingStatementUploadBanksDao,
  updateStatementUploadNotificationDao,
} from '../apis/bankAccounts/bankaccountDao.js';
import { getCompanyByIDDao } from '../apis/company/companyDao.js';
import { getAdminUserIdsDao } from '../apis/users/userDao.js';

let statementUploadCronJob = null;
let isStatementUploadCronRunning = false;

const isCronWorker = process.env.CRON_WORKER === 'true';

if (isCronWorker && process.env.NODE_ENV === 'production') {
  // Run at :05, :10, :15 of 12 AM and 12 PM IST
  // 12:05 → Reset + Level 1 | 12:10 → Level 2 | 12:15 → Level 3 (sticky + admin)
  statementUploadCronJob = cron.schedule(
    '5,10,15 0,12 * * *',
    async () => {
      if (isStatementUploadCronRunning) {
        logger.warn(
          'Statement upload cron is already running, skipping this execution',
        );
        return;
      }
      isStatementUploadCronRunning = true;
      try {
        await checkStatementUploads('Asia/Kolkata');
      } finally {
        isStatementUploadCronRunning = false;
      }
    },
    { timezone: 'Asia/Kolkata' },
  );
  logger.info(
    'Statement upload cron job initialized — runs at 12:05, 12:10, 12:15 AM & PM IST',
  );
}

export const stopStatementUploadCron = () => {
  if (statementUploadCronJob) {
    statementUploadCronJob.stop();
    logger.info('Statement upload cron job stopped');
  }
};

/**
 * Main cron logic — runs at 12:05, 12:10, 12:15 AM & PM IST:
 * - 12:05: Send Level 1 notification to vendors
 * - 12:10: Escalate Level 1 → 2 (second reminder)
 * - 12:15: Escalate Level 2 → 3 (sticky popup to Vendor + Admin)
 */
const checkStatementUploads = async (timezone = 'Asia/Kolkata') => {
  try {
    const now = moment().tz(timezone);
    const nowISO = now.toISOString();

    // Get all banks pending statement upload
    const pendingBanks = await getPendingStatementUploadBanksDao();

    if (pendingBanks.length === 0) {
      logger.info('[STATEMENT CRON] No pending banks found');
      return;
    }

    // Group banks by vendor (user_id) so we send one popup per vendor
    const vendorBanksMap = new Map();
    for (const bank of pendingBanks) {
      const uid = bank.user_id;
      if (!vendorBanksMap.has(uid)) {
        vendorBanksMap.set(uid, []);
      }
      vendorBanksMap.get(uid).push(bank);
    }

    // Notify each vendor
    const vendorEntries = [...vendorBanksMap.entries()];
    const BATCH_SIZE = 5;
    const adminBanksToNotify = []; // Collect Level 3 banks for a single admin notification
    const adminVendorCodes = new Set(); // Collect unique vendor codes for admin message
    let adminCompanyId = null;
    let notifiedVendorCount = 0;
    let notifiedBankCount = 0;
    let skippedVendorCount = 0;

    logger.info(
      `[STATEMENT CRON] Processing ${pendingBanks.length} pending bank(s) across ${vendorEntries.length} vendor(s)`,
    );

    for (let i = 0; i < vendorEntries.length; i += BATCH_SIZE) {
      const batch = vendorEntries.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(([userId, banks]) =>
          processVendorNotification(userId, banks, nowISO),
        ),
      );

      // Gather Level 3 banks from each vendor result
      for (const result of results) {
        if (!result) continue;

        if (result.notifiedBankCount > 0) {
          notifiedVendorCount += 1;
          notifiedBankCount += result.notifiedBankCount;
        } else {
          skippedVendorCount += 1;
        }

        if (result && result.adminBanks.length > 0) {
          adminBanksToNotify.push(...result.adminBanks);
          if (result.vendorCode) adminVendorCodes.add(result.vendorCode);
          if (!adminCompanyId) adminCompanyId = result.companyId;
        }
      }

      logger.info(
        `[STATEMENT CRON] Completed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(vendorEntries.length / BATCH_SIZE)} - notified vendors: ${notifiedVendorCount}, notified banks: ${notifiedBankCount}, skipped vendors: ${skippedVendorCount}`,
      );

      if (i + BATCH_SIZE < vendorEntries.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Send ONE consolidated admin notification for all Level 3 banks
    if (adminBanksToNotify.length > 0 && adminCompanyId) {
      const adminUsers = await getAdminUserIdsDao(adminCompanyId);
      const vendorCodesList = [...adminVendorCodes].join(', ');
      const message = `URGENT: Bank statement for Vendors:[${vendorCodesList}] has not been uploaded. Immediate action required.`;

      for (const admin of adminUsers) {
        await notifyStatementUpload({
          userId: admin.id,
          vendorCode: null,
          banks: adminBanksToNotify,
          notificationLevel: 3,
          isSticky: true,
          notifyAdmin: true,
          message,
          timestamp: nowISO,
        });
      }
      logger.info(
        `[STATEMENT CRON] Consolidated admin notification sent to ${adminUsers.length} admin(s) for ${adminBanksToNotify.length} bank(s): ${vendorCodesList}`,
      );

      // Generate and send CSV to Telegram admins
      try {
        const csvBuffer = await generateAndSendPendingStatementCSV(
          pendingBanks,
          adminCompanyId,
        );
        if (csvBuffer) {
          logger.info(
            '[STATEMENT CRON] CSV report generated and prepared for Telegram',
          );
        }
      } catch (csvError) {
        logger.error(
          '[STATEMENT CRON] Error generating/sending CSV report:',
          csvError.message,
        );
      }
    }

    logger.info(
      `[STATEMENT CRON] Completed statement upload check - pending banks: ${pendingBanks.length}, vendors processed: ${vendorEntries.length}, vendors notified: ${notifiedVendorCount}, banks notified: ${notifiedBankCount}, vendors skipped: ${skippedVendorCount}, admin banks escalated: ${adminBanksToNotify.length}`,
    );
  } catch (error) {
    logger.error(
      '[STATEMENT CRON] Error in checkStatementUploads:',
      error.message,
    );
  }
};

/**
 * Process notifications for all banks belonging to a single vendor.
 * Determines which banks need escalation, updates them in DB,
 * and sends ONE combined socket event to the vendor.
 */
const processVendorNotification = async (userId, banks, nowISO) => {
  try {
    const banksToNotify = [];
    let highestLevel = 0;
    let notifyAdmin = false;
    let isSticky = false;

    for (const bank of banks) {
      const rawConfig =
        typeof bank.config === 'string' ? JSON.parse(bank.config) : bank.config;
      const stmtUpload = rawConfig?.statement_upload || {};
      const level = parseInt(stmtUpload.notification_level, 10) || 0;

      // Already at max level, skip
      if (level >= 3) continue;

      // Escalate by one level (max 3)
      const newLevel = Math.min(level + 1, 3);

      // Update this bank's notification level in DB
      await updateStatementUploadNotificationDao(bank.id, newLevel, nowISO);

      banksToNotify.push({
        bankId: bank.id,
        nickName: bank.nick_name,
        notificationLevel: newLevel,
      });

      if (newLevel > highestLevel) highestLevel = newLevel;
      if (newLevel >= 3) {
        notifyAdmin = true;
        isSticky = true;
      }
    }

    if (banksToNotify.length === 0) {
      return {
        adminBanks: [],
        companyId: null,
        notifiedBankCount: 0,
        vendorCode: banks[0]?.vendor_code || null,
      };
    }

    // Build a single combined message for all banks
    const bankNames = banksToNotify.map((b) => `"${b.nickName}"`).join(', ');
    const message = getNotificationMessage(bankNames, highestLevel);
    const vendorCode = banks[0]?.vendor_code || null;

    // Send ONE socket event for this vendor (admin gets separate consolidated message)
    await notifyStatementUpload({
      userId,
      vendorCode,
      banks: banksToNotify,
      notificationLevel: highestLevel,
      isSticky,
      notifyAdmin: false,
      message,
      timestamp: nowISO,
    });

    logger.info(
      `[STATEMENT CRON] Level ${highestLevel} notification sent to vendor (userId: ${userId}) for ${banksToNotify.length} bank(s): ${bankNames}`,
    );

    // Return Level 3 banks so they can be consolidated for admin notification
    const adminBanks = notifyAdmin ? banksToNotify : [];
    const companyId = notifyAdmin ? banks[0]?.company_id : null;
    return {
      adminBanks,
      companyId,
      notifiedBankCount: banksToNotify.length,
      vendorCode,
    };
  } catch (error) {
    logger.error(
      `[STATEMENT CRON] Error processing vendor ${userId} notification:`,
      error.message,
    );
    return {
      adminBanks: [],
      companyId: null,
      notifiedBankCount: 0,
      vendorCode: banks[0]?.vendor_code || null,
    };
  }
};

const getNotificationMessage = (bankNames, level) => {
  switch (level) {
    case 1:
      return `Please upload the bank statement for Banks:[${bankNames}].`;
    case 2:
      return `Reminder: Bank statement for Banks:[${bankNames}] is still pending. Please upload it now.`;
    case 3:
      return `URGENT: Bank statement for Banks:[${bankNames}] has not been uploaded. Immediate action required.`;
    default:
      return `Bank statement upload required for Banks:[${bankNames}].`;
  }
};

/**
 * Generate CSV with pending statement upload information and send to Telegram admins
 * CSV contains: Vendor Code, Vendor ID, Bank Name, Bank ID, Notification Level
 */
const generateAndSendPendingStatementCSV = async (pendingBanks, companyId) => {
  try {
    const alphabeticalSort = (left = '', right = '') =>
      String(left).localeCompare(String(right), undefined, {
        sensitivity: 'base',
        numeric: true,
      });

    // Group banks by vendor for better organization
    const vendorBanksMap = new Map();

    for (const bank of pendingBanks) {
      const vendorCode = bank.vendor_code || 'UNKNOWN';
      if (!vendorBanksMap.has(vendorCode)) {
        vendorBanksMap.set(vendorCode, {
          vendor_id: bank.user_id,
          vendor_code: vendorCode,
          company_id: bank.company_id,
          banks: [],
        });
      }

      const rawConfig =
        typeof bank.config === 'string' ? JSON.parse(bank.config) : bank.config;
      const stmtUpload = rawConfig?.statement_upload || {};
      const level = parseInt(stmtUpload.notification_level, 10) || 0;

      vendorBanksMap.get(vendorCode).banks.push({
        bank_name: bank.nick_name,
        bank_id: bank.id,
        notification_level: level,
      });
    }

    // Build CSV data: show vendor columns once, then bank rows under it.
    const csvData = [];
    const sortedVendorEntries = [...vendorBanksMap.entries()].sort(
      ([leftVendorCode], [rightVendorCode]) =>
        alphabeticalSort(leftVendorCode, rightVendorCode),
    );

    for (const [vendorCode, vendorInfo] of sortedVendorEntries) {
      vendorInfo.banks.sort((leftBank, rightBank) =>
        alphabeticalSort(leftBank.bank_name, rightBank.bank_name),
      );

      for (let index = 0; index < vendorInfo.banks.length; index += 1) {
        const bank = vendorInfo.banks[index];
        csvData.push({
          'Vendor Code': index === 0 ? vendorCode : '',
          'Vendor ID': index === 0 ? vendorInfo.vendor_id : '',
          'Bank Name': bank.bank_name,
          'Bank ID': bank.bank_id,
          // 'Notification Level': bank.notification_level,
        });
      }
    }

    // Convert to CSV
    const fields = ['Vendor Code', 'Vendor ID', 'Bank Name', 'Bank ID'];
    const parser = new Parser({ fields });
    const csv = parser.parse(csvData);
    const csvBuffer = Buffer.from(csv, 'utf-8');

    const [company] = await getCompanyByIDDao({ id: companyId });
    const companyConfig = company?.config || {};

    // Send CSV once to configured company telegram group
    const timestamp = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
    const caption = `<b>Pending Statement Upload Report</b>\n<i>${timestamp} IST</i>\n\nTotal Pending: ${pendingBanks.length} banks`;

    const telegramChatId =
      companyConfig?.telegramStatementNotUploadNotificationChatId ||
      config?.telegramStatementNotUploadNotificationChatId;
    const telegramBotToken =
      companyConfig?.telegramBotToken || config?.telegramBotToken;

    if (!telegramChatId) {
      logger.warn(
        `[STATEMENT CRON] No Telegram group chat ID configured for company ${companyId}`,
      );
      return csvBuffer;
    }

    const fileName = `pending_statements_${moment().tz('Asia/Kolkata').format('YYYY-MM-DD_HH-mm-ss')}.csv`;
    const sent = await sendTelegramStatementUploadCSV(
      telegramChatId,
      csvBuffer,
      fileName,
      caption,
      telegramBotToken,
    );

    if (sent) {
      logger.info(
        `[STATEMENT CRON] CSV report sent to configured telegram group (Chat ID: ${telegramChatId}) for company ${companyId}`,
      );
    } else {
      logger.warn(
        `[STATEMENT CRON] Failed to send CSV report to configured telegram group for company ${companyId}`,
      );
    }

    return csvBuffer;
  } catch (error) {
    logger.error(
      '[STATEMENT CRON] Error in generateAndSendPendingStatementCSV:',
      error.message,
    );
    throw error;
  }
};

export default checkStatementUploads;
