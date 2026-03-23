import cron from 'node-cron';
import { getMerchantsForDashboardReportDao } from '../apis/merchants/merchantDao.js';
import { getCalculationDashBoardReportDao } from '../apis/calculation/calculationDao.js';
import { getBankaccountDashBoardReportDao } from '../apis/bankAccounts/bankaccountDao.js';
import { sendTelegramDashboardReportMessage } from '../utils/sendTelegramMessages.js';
import config from '../config/config.js';
import { getVendorsDashBoardReportDao } from '../apis/vendors/vendorDao.js';
import { logger } from '../utils/logger.js';
import { getUserHierarchysDashBoardReportDao } from '../apis/userHierarchy/userHierarchyDao.js';
import { getCompanyDao } from '../apis/company/companyDao.js';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import collectBankData from './bankCron.js';
import gatherAllNetbalanceForAllCompanies from './gatherAllNetBalance.js';
// import { getConnection } from '../utils/db.js';

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

// Track retry attempts for both cron jobs
let dailyRetryCount = 0;
let hourlyRetryCount = 0;
const MAX_RETRIES = 3; // Total attempts: 1 initial + 2 retries

let dailyCronJob = null;
let hourlyCronJob = null;

// Only run cron jobs in the dedicated cron worker process (works in both prod and local)
const isCronWorker = process.env.CRON_WORKER === 'true';
if (isCronWorker && process.env.NODE_ENV === 'production') {
  dailyCronJob = cron.schedule('0 0 * * *', async () => {
    dailyRetryCount = 0; // Reset retry count for new day
    await executeWithRetry(
      'daily',
      'Daily gather all cron job at 12:00 AM IST (Attempt 1)',
    );
  });

  hourlyCronJob = cron.schedule('0,30 * * * *', async () => {
    hourlyRetryCount = 0; // Reset retry count for new hour
    const currentHour = dayjs().tz('Asia/Kolkata').hour();
    const now = dayjs().tz('Asia/Kolkata');
    const hour = now.hour();
    const minute = now.minute();
    if (hour === 0 && minute === 0) {
      logger.info('Skipped 00:00 30-min job - Daily job runs at this time');
      return;
    }
    await executeWithRetry(
      'hourly',
      `Hourly gather all cron job at ${currentHour}:00 IST (Attempt 1)`,
    );
  });
  logger.info('Gather all data cron jobs initialized in cron worker');
}

// Function to execute cron with retry mechanism
const executeWithRetry = async (cronType, attemptDescription) => {
  const isDaily = cronType === 'daily';
  const retryCount = isDaily ? ++dailyRetryCount : ++hourlyRetryCount;

  logger.info(`Running ${attemptDescription}`);

  try {
    if (isDaily) {
      await gatherAllDataForAllCompanies('N', 'Asia/Kolkata');
    } else {
      await gatherAllDataForAllCompanies('H', 'Asia/Kolkata');
    }
    logger.info(
      `${cronType} cron job executed successfully on ${attemptDescription}`,
    );
  } catch (error) {
    logger.error(
      `${cronType} cron job failed on ${attemptDescription}:`,
      error?.message,
    );

    // If we haven't reached max retries, schedule next attempt after 10 seconds
    if (retryCount < MAX_RETRIES) {
      const nextAttempt = retryCount + 1;
      logger.info(
        `Scheduling ${cronType} retry attempt ${nextAttempt} in 10 seconds...`,
      );

      setTimeout(async () => {
        const currentTime = dayjs().tz('Asia/Kolkata');
        let nextAttemptDesc;

        if (isDaily) {
          const seconds = retryCount * 10;
          nextAttemptDesc = `Daily gather all cron job at 12:00:${seconds.toString().padStart(2, '0')} AM IST (Attempt ${nextAttempt})`;
        } else {
          const currentHour = currentTime.hour();
          const seconds = retryCount * 10;
          nextAttemptDesc = `Hourly gather all cron job at ${currentHour}:00:${seconds.toString().padStart(2, '0')} IST (Attempt ${nextAttempt})`;
        }

        await executeWithRetry(cronType, nextAttemptDesc);
      }, 10000); // 10 seconds delay
    } else {
      logger.error(
        `All ${MAX_RETRIES} attempts failed for ${cronType} cron job. Execution unsuccessful.`,
      );
    }
  }
};

// Function to gather data for all companies
let isGatherAllDataRunning = false; // Prevent overlapping executions

const gatherAllDataForAllCompanies = async (
  type = 'N',
  timezone = 'Asia/Kolkata',
) => {
  if (isGatherAllDataRunning) {
    logger.warn('Gather all data cron is already running, skipping this execution');
    return;
  }
  isGatherAllDataRunning = true;
  try {
    logger.info('Starting gather data for all companies');

    // Get all companies
    const companies = await getCompanyDao({});

    if (!companies || companies.length === 0) {
      logger.info('No companies found');
      return;
    }

    // Process each company (sequential processing for safety)
    // for (const company of companies) {
    //   try {
    //     logger.info(`Processing company: ${company.id}`);
    //     await gatherAllData(company.id, type, timezone);
    //   } catch (error) {
    //     logger.error(`Error processing company ${company.id}: ${error}`);
    //   }
    // }

    // Process companies in batches with shared connections (safe now)
    // Each company uses only 1 connection instead of 200+ due to connection sharing
    const batchSize = 5;
    for (let i = 0; i < companies.length; i += batchSize) {
      const batch = companies.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map(async (company) => {
          try {
            logger.info(`Processing company: ${company.id}`);
            await gatherAllData(company.id, type, timezone);
          } catch (error) {
            logger.error(`Error processing company ${company.id}: ${error}`);
          }
        }),
      );
      // Add a 1-second delay between batches
      if (i + batchSize < companies.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    logger.info('Completed gather data for all companies');

    // Run bank CRON after all companies have been processed (only for daily reports)
    if (type === 'N') {
      logger.info('Bank CRON Started for all companies');
      await collectBankData(timezone);
      logger.info('Bank CRON Ended for all companies');
    }
    await gatherAllNetbalanceForAllCompanies(type, timezone);
  } catch (error) {
    logger.error(`Error in gatherAllDataForAllCompanies: ${error}`);
  } finally {
    isGatherAllDataRunning = false;
  }
};

const gatherAllData = async (
  company_id,
  type = 'N',
  timezone = 'Asia/Kolkata',
) => {
  try {

    let sDate;
    let eDate;
    if (typeof timezone !== 'string') {
      timezone = 'Asia/Kolkata';
    }

    const currentDate = dayjs().tz(timezone);
    if (type === 'H') {
      sDate = currentDate.clone().startOf('day').toDate();
      eDate = currentDate.clone().toDate();
    } else if (type === 'N') {
      sDate = currentDate.clone().subtract(1, 'day').startOf('day').toDate();
      eDate = currentDate.clone().subtract(1, 'day').endOf('day').toDate();
    } else {
      sDate = currentDate.clone().subtract(1, 'day').toDate();
      eDate = currentDate.clone().toDate();
    }

    logger.info(`Dashboard Report CRON Started for company: ${company_id}`);

    // Get company details with config
    const companies = await getCompanyDao({ id: company_id });
    const company = companies && companies.length > 0 ? companies[0] : null;

    if (!company) {
      logger.error(`Company not found: ${company_id}`);
      return;
    }

    // Get company-specific configurations or fallback to global config
    const telegramDashboardChatId =
      company.config?.telegramDashboardChatId ||
      config?.telegramDashboardChatId;
    const telegramVendorboardChatId =
      company.config?.telegramVendorboardChatId ||
      config?.telegramVendorboardChatId;
    const telegramBotToken =
      company.config?.telegramBotToken || config?.telegramBotToken;

    if (!telegramDashboardChatId || !telegramBotToken) {
      logger.warn(
        `Missing Telegram config for company ${company_id}, skipping report`,
      );
      return;
    }

    const merchants = await getMerchantsForDashboardReportDao({
      company_id: company_id,
    });
    let merchant = [];
    let totalpayinsMerchant = 0;
    let totalpayoutsMerchant = 0;
    const allHierarchies = await getUserHierarchysDashBoardReportDao({
      company_id: company_id,
    });
    const subMerchantIds = new Set();
    allHierarchies.forEach((hierarchy) => {
      const subMerchants = hierarchy?.config?.siblings?.sub_merchants || [];
      subMerchants.forEach((subMerchantId) =>
        subMerchantIds.add(subMerchantId),
      );
    });
    for (const merch of merchants) {
      let totalPayinAmount = 0;
      let totalPayinCount = 0;
      let totalPayoutAmount = 0;
      let totalPayoutCount = 0;
      // Fetch calculation data for the merchant
      const calculationData = await getCalculationDashBoardReportDao({
        user_id: merch.user_id,
        company_id: company_id,
        sDate,
        eDate,
      });

      for (const data of calculationData) {
        totalPayinAmount += data.total_payin_amount || 0;
        totalPayinCount += data.total_payin_count || 0;
        totalPayoutAmount += data.total_payout_amount || 0;
        totalPayoutCount += data.total_payout_count || 0;
      }
      const merchantHier = await getUserHierarchysDashBoardReportDao({
        user_id: merch.user_id,
        company_id,
      });
      const subMerchants =
        merchantHier.length > 0
          ? merchantHier[0]?.config?.siblings?.sub_merchants || []
          : [];
      if (subMerchants.length > 0) {
        for (const subMerchantId of subMerchants) {
          const subMerchantCalculationData =
            await getCalculationDashBoardReportDao({
              user_id: subMerchantId,
              company_id,
              sDate,
              eDate,
            });
          for (const data of subMerchantCalculationData) {
            totalPayinAmount += data.total_payin_amount || 0;
            totalPayinCount += data.total_payin_count || 0;
            totalPayoutAmount += data.total_payout_amount || 0;
            totalPayoutCount += data.total_payout_count || 0;
          }
        }
      }
      if (!subMerchantIds.has(merch.user_id)) {
        merchant.push({
          merchantId: merch.code,
          totalPayin: totalPayinAmount,
          totalPayinCount: totalPayinCount,
          totalPayout: totalPayoutAmount,
          totalPayoutCount: totalPayoutCount,
        });
        totalpayinsMerchant += totalPayinAmount;
        totalpayoutsMerchant += totalPayoutAmount;
      }
      merchant.sort((a, b) => a.merchantId.localeCompare(b.merchantId));
    }
    let vendorObjpayIn = {};
    let vendorObjpayOut = {};
    let totalBankDepositAllVendors = 0;
    let totalBankWithdrawalAllVendors = 0;

    // Get all vendor hierarchies to identify sub-vendor relationships
    const allVendorHierarchies = await getUserHierarchysDashBoardReportDao({
      company_id: company_id,
    });
    const subVendorIds = new Set();
    allVendorHierarchies.forEach((hierarchy) => {
      const subVendors = hierarchy?.config?.siblings?.sub_vendors || [];
      subVendors.forEach((subVendorId) => subVendorIds.add(subVendorId));
    });

    const banksData = await getBankaccountDashBoardReportDao({
      bank_used_for: 'PayIn',
      company_id: company_id,
    });
    const banks = banksData
      .filter(({ today_balance }) => today_balance !== 0)
      .map(({ user_id, nick_name, today_balance, payin_count }) => {
        totalBankDepositAllVendors += today_balance;
        return {
          user_id,
          bankName: nick_name,
          TotalDeposit: today_balance,
          TotalCount: payin_count,
        };
      });

    let vendorData;

    for (const bank of banks) {
      vendorData = await getVendorsDashBoardReportDao({
        user_id: bank.user_id,
        company_id: company_id,
      });
      if (vendorData.length > 0) {
        const vendor = vendorData[0];
        const vendorCode = vendor.code;

        // Only include parent vendors (not sub-vendors) in the main structure
        if (!subVendorIds.has(bank.user_id)) {
          if (!vendorObjpayIn[vendorCode]) {
            vendorObjpayIn[vendorCode] = { banks: [] };
          }

          vendorObjpayIn[vendorCode].banks.push({
            bankName: bank.bankName,
            TotalDeposit: bank.TotalDeposit,
            TotalCount: bank.TotalCount,
          });

          // Get vendor hierarchy and aggregate sub-vendor data
          const vendorHier = await getUserHierarchysDashBoardReportDao({
            user_id: bank.user_id,
            company_id: company_id,
          });
          const subVendors =
            vendorHier.length > 0
              ? vendorHier[0]?.config?.siblings?.sub_vendors || []
              : [];

          // Add sub-vendor bank data to parent vendor
          if (subVendors.length > 0) {
            for (const subVendorId of subVendors) {
              const subVendorBanks = banksData.filter(
                (bankData) =>
                  bankData.user_id === subVendorId &&
                  bankData.today_balance !== 0,
              );

              for (const subVendorBank of subVendorBanks) {
                vendorObjpayIn[vendorCode].banks.push({
                  bankName: `${subVendorBank.nick_name} (Sub)`,
                  TotalDeposit: subVendorBank.today_balance,
                  TotalCount: subVendorBank.payin_count,
                });
              }
            }
          }
        }
      }
    }

    const banksDataOut = await getBankaccountDashBoardReportDao({
      bank_used_for: 'PayOut',
      company_id: company_id,
    });
    const banksOut = banksDataOut
      .filter(({ today_balance }) => today_balance !== 0)
      .map(({ user_id, nick_name, today_balance, payin_count }) => {
        totalBankWithdrawalAllVendors += today_balance;
        return {
          user_id,
          bankName: nick_name,
          TotalDeposit: today_balance,
          TotalCount: payin_count,
        };
      });

    let vendorDataOut;
    for (const banksO of banksOut) {
      vendorDataOut = await getVendorsDashBoardReportDao({
        user_id: banksO.user_id,
        company_id: company_id,
      });
      if (vendorDataOut.length > 0) {
        const vendor = vendorDataOut[0];
        const vendorCode = vendor.code;

        // Only include parent vendors (not sub-vendors) in the main structure
        if (!subVendorIds.has(banksO.user_id)) {
          if (!vendorObjpayOut[vendorCode]) {
            vendorObjpayOut[vendorCode] = { banks: [] };
          }

          vendorObjpayOut[vendorCode].banks.push({
            bankName: banksO.bankName,
            TotalDeposit: banksO.TotalDeposit,
            TotalCount: banksO.TotalCount,
          });

          // Get vendor hierarchy and aggregate sub-vendor data
          const vendorHierOut = await getUserHierarchysDashBoardReportDao({
            user_id: banksO.user_id,
            company_id: company_id,
          });
          const subVendorsOut =
            vendorHierOut.length > 0
              ? vendorHierOut[0]?.config?.siblings?.sub_vendors || []
              : [];

          // Add sub-vendor bank data to parent vendor
          if (subVendorsOut.length > 0) {
            for (const subVendorId of subVendorsOut) {
              const subVendorBanks = banksDataOut.filter(
                (bankData) =>
                  bankData.user_id === subVendorId &&
                  bankData.today_balance !== 0,
              );

              for (const subVendorBank of subVendorBanks) {
                vendorObjpayOut[vendorCode].banks.push({
                  bankName: `${subVendorBank.nick_name} (Sub)`,
                  TotalDeposit: subVendorBank.today_balance,
                  TotalCount: subVendorBank.payin_count,
                });
              }
            }
          }
        }
      }
    }

    await sendTelegramDashboardReportMessage(
      telegramDashboardChatId,
      merchant,
      totalpayinsMerchant,
      totalpayoutsMerchant,
      vendorObjpayIn,
      vendorObjpayOut,
      totalBankDepositAllVendors,
      totalBankWithdrawalAllVendors,
      telegramBotToken,
      type === 'H' ? 'Hourly Report' : 'Daily Report',
      null,
      telegramVendorboardChatId,
    );
    logger.info(`Dashboard Report CRON Ended for company: ${company_id}`);
  } catch (error) {
    logger.error(`Error in gatherAllData for company ${company_id}: ${error}`);
  }
};

export const stopGatherAllDataCron = () => {
  if (dailyCronJob) {
    dailyCronJob.stop();
    logger.info('Daily gather all data cron job stopped');
  }
  if (hourlyCronJob) {
    hourlyCronJob.stop();
    logger.info('Hourly gather all data cron job stopped');
  }
};

export default gatherAllDataForAllCompanies;
