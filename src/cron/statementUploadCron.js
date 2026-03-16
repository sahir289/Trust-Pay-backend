import cron from 'node-cron';
import moment from 'moment-timezone';
import { getConnection } from '../utils/db.js';
import { logger } from '../utils/logger.js';
import { notifyStatementUpload } from '../utils/sockets.js';
import {
  getPendingStatementUploadBanksDao,
  updateStatementUploadNotificationDao,
} from '../apis/bankAccounts/bankaccountDao.js';
import { getAdminUserIdsDao } from '../apis/users/userDao.js';

let statementUploadCronJob = null;
let isStatementUploadCronRunning = false;

const isCronWorker = process.env.CRON_WORKER === 'true';

if (isCronWorker && process.env.NODE_ENV === 'production') {
  // Run at :05, :10, :15 of 12 AM and 12 PM IST
  // 12:05 → Reset + Level 1 | 12:10 → Level 2 | 12:15 → Level 3 (sticky + admin)
  statementUploadCronJob = cron.schedule('5,10,15 0,12 * * *', async () => {
    if (isStatementUploadCronRunning) {
      logger.warn('Statement upload cron is already running, skipping this execution');
      return;
    }
    isStatementUploadCronRunning = true;
    try {
      await checkStatementUploads('Asia/Kolkata');
    } finally {
      isStatementUploadCronRunning = false;
    }
  }, { timezone: 'Asia/Kolkata' });
  logger.info('Statement upload cron job initialized — runs at 12:05, 12:10, 12:15 AM & PM IST');
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
  let conn;
  try {
    conn = await getConnection();
    const now = moment().tz(timezone);
    const nowISO = now.toISOString();

    // Get all banks pending statement upload
    const pendingBanks = await getPendingStatementUploadBanksDao(conn);

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

    for (let i = 0; i < vendorEntries.length; i += BATCH_SIZE) {
      const batch = vendorEntries.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(([userId, banks]) => processVendorNotification(userId, banks, nowISO, conn)),
      );

      // Gather Level 3 banks from each vendor result
      for (const result of results) {
        if (result && result.adminBanks.length > 0) {
          adminBanksToNotify.push(...result.adminBanks);
          if (result.vendorCode) adminVendorCodes.add(result.vendorCode);
          if (!adminCompanyId) adminCompanyId = result.companyId;
        }
      }

      if (i + BATCH_SIZE < vendorEntries.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Send ONE consolidated admin notification for all Level 3 banks
    if (adminBanksToNotify.length > 0 && adminCompanyId) {
      const adminUsers = await getAdminUserIdsDao(adminCompanyId, conn);
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
    }
  } catch (error) {
    logger.error('[STATEMENT CRON] Error in checkStatementUploads:', error.message);
  } finally {
    if (conn) conn.release();
  }
};

/**
 * Process notifications for all banks belonging to a single vendor.
 * Determines which banks need escalation, updates them in DB,
 * and sends ONE combined socket event to the vendor.
 */
const processVendorNotification = async (userId, banks, nowISO, conn) => {
  try {
    const banksToNotify = [];
    let highestLevel = 0;
    let notifyAdmin = false;
    let isSticky = false;

    for (const bank of banks) {
      const rawConfig = typeof bank.config === 'string' ? JSON.parse(bank.config) : bank.config;
      const stmtUpload = rawConfig?.statement_upload || {};
      const level = parseInt(stmtUpload.notification_level, 10) || 0;

      // Already at max level, skip
      if (level >= 3) continue;

      // Escalate by one level (max 3)
      const newLevel = Math.min(level + 1, 3);

      // Update this bank's notification level in DB
      await updateStatementUploadNotificationDao(bank.id, newLevel, nowISO, conn);

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

    if (banksToNotify.length === 0) return { adminBanks: [], companyId: null };

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
    return { adminBanks, companyId, vendorCode };
  } catch (error) {
    logger.error(
      `[STATEMENT CRON] Error processing vendor ${userId} notification:`,
      error.message,
    );
    return { adminBanks: [], companyId: null };
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

export default checkStatementUploads;
