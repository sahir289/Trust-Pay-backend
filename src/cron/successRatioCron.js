import { sendTelegramDashboardSuccessRatioMessage } from '../utils/sendTelegramMessages.js';
import { getPayInUrlsDao } from '../apis/payIn/payInDao.js';
import cron from 'node-cron';
import { getMerchantsDao } from '../apis/merchants/merchantDao.js';
import { getCompanyDao } from '../apis/company/companyDao.js';
import config from '../config/config.js';
import { logger } from '../utils/logger.js';

// Function to process success ratios for all companies
const formattedSuccessRatiosForAllCompanies = async () => {
  try {
    logger.info('Starting success ratio processing for all companies');
    
    // Get all companies
    const companies = await getCompanyDao({});
    
    if (!companies || companies.length === 0) {
      logger.info('No companies found');
      return;
    }

    // Process each company (sequential processing for safety)
    // for (const company of companies) {
    //   try {
    //     logger.info(`Processing success ratios for company: ${company.id}`);
    //     await formattedSuccessRatiosByMerchant(company.id);
    //   } catch (error) {
    //     logger.error(`Error processing success ratios for company ${company.id}: ${error}`);
    //   }
    // }
    
    // Alternative: Parallel processing (uncomment if you want faster processing)
    await Promise.allSettled(
      companies.map(async (company) => {
        try {
          logger.info(`Processing success ratios for company: ${company.id}`);
          await formattedSuccessRatiosByMerchant(company.id);
        } catch (error) {
          logger.error(`Error processing success ratios for company ${company.id}: ${error}`);
        }
      })
    );
    
    logger.info('Completed success ratio processing for all companies');
  } catch (error) {
    logger.error(`Error in formattedSuccessRatiosForAllCompanies: ${error}`);
  }
};

const formattedSuccessRatiosByMerchant = async (company_id) => {
  try {
    logger.info(`Success Ratio CRON Started for company: ${company_id}`);
    
    // Get company details with config
    const companies = await getCompanyDao({ id: company_id });
    const company = companies && companies.length > 0 ? companies[0] : null;
    
    if (!company) {
      logger.error(`Company not found: ${company_id}`);
      return;
    }

    // Get company-specific configurations or fallback to global config
    const telegramRatioAlertsChatId = company.config?.telegramRatioAlertsChatId || config?.telegramRatioAlertsChatId;
    const telegramBotToken = company.config?.telegramBotToken || config?.telegramBotToken;

    if (!telegramRatioAlertsChatId || !telegramBotToken) {
      logger.warn(`Missing Telegram config for company ${company_id}, skipping success ratio report`);
      return;
    }

    const now = new Date();
    const intervals = [
      { label: 'Last 5m', duration: 5 * 60 * 1000 },
      { label: 'Last 15m', duration: 15 * 60 * 1000 },
      { label: 'Last 30m', duration: 30 * 60 * 1000 },
      { label: 'Last 1h', duration: 60 * 60 * 1000 },
      { label: 'Last 3h', duration: 3 * 60 * 60 * 1000 },
      { label: 'Last 24h', duration: 24 * 60 * 60 * 1000 },
    ];

    // fetch all transactions for the company
    const allPayIns = await getPayInUrlsDao({ company_id: company_id });
    const merchants = await getMerchantsDao({ company_id: company_id }, null, null);
    // group transactions by merchant_id
    const transactionsByMerchant = allPayIns.reduce((map, payin) => {
      if (!map[payin.merchant_id]) map[payin.merchant_id] = [];
      map[payin.merchant_id].push({
        updated_at: new Date(payin.updated_at),
        created_at: new Date(payin.created_at),
        status: payin.status,
        user_submitted_utr: payin.user_submitted_utr,
      });
      return map;
    }, {});

    const merchantsWithTransactions = merchants.filter(
      (merchant) =>
        Array.isArray(transactionsByMerchant[merchant.id]) &&
        transactionsByMerchant[merchant.id].length > 0,
    );

    const fullMessages = [];
    for (const merchant of merchantsWithTransactions) {
      const merchantTransactions = transactionsByMerchant[merchant.id];

      const intervalDetails = intervals
        .map(({ label, duration }) => {
          const startTime = new Date(now - duration);

          const filteredTransactions = merchantTransactions.filter(
            (tx) => tx.created_at >= startTime,
          );

          const total = filteredTransactions.length;
          const success = filteredTransactions.filter(
            (tx) => tx.status === 'SUCCESS',
          ).length;

          // Ensure success ratio is between 0 and 100
          const successRatio = total === 0 
            ? '0.00%'
            : Math.min(Math.max(((success / total) * 100), 0), 100).toFixed(2) + '%';

          const statusIcon = success === 0 ? '⚠️' : '✅';

          return `${statusIcon} ${label}: ${success}/${total} = ${successRatio}`;
        })
        .join('\n');

      const intervalDetailsUtr = intervals
        .map(({ label, duration }) => {
          const startTime = new Date(now - duration);
          console.log(merchantTransactions);
          const filteredTransactions = merchantTransactions.filter(
            (tx) => tx.created_at >= startTime,
          );

          const total = filteredTransactions.length;

          const utrSubmission = filteredTransactions.filter(
            (tx) => tx.user_submitted_utr && tx.user_submitted_utr.length > 0,
          ).length;

          const statusIcon = utrSubmission === 0 ? '⚠️' : '✅';

          // Ensure UTR submission ratio is between 0 and 100
          const utrSubmissionRatio = total === 0
            ? '0.00%'  
            : Math.min(Math.max(((utrSubmission / total) * 100), 0), 100).toFixed(2) + '%';

          return `${statusIcon} ${label}: ${utrSubmission}/${total} = ${utrSubmissionRatio}`;
        })
        .join('\n');

      const fullMessage = {
        merchantCode: merchant.code,
        intervalDetails,
        intervalDetailsUtr,
      };
      fullMessages.push(fullMessage);
    }
    await sendTelegramDashboardSuccessRatioMessage(
      telegramRatioAlertsChatId,
      fullMessages,
      telegramBotToken,
    );
    logger.info(`Success Ratio CRON Ended for company: ${company_id}`);
  } catch (error) {
    logger.error(`Error in success ratio processing for company ${company_id}: ${error.message}`);
  }
};
export default formattedSuccessRatiosForAllCompanies;

//run only on server - side /production level
if (process.env.NODE_ENV === 'production') {
  cron.schedule('*/10 * * * *', () => {
    formattedSuccessRatiosForAllCompanies();
  });
} else {
  logger.error('Cron jobs are disabled in non-production environments.');
}
