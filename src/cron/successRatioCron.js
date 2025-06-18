import { sendTelegramDashboardSuccessRatioMessage } from '../utils/sendTelegramMessages';
import { getPayInUrlsDao } from '../apis/payIn/payInDao.js';
import cron from 'node-cron';
import { getMerchantsDao } from '../apis/merchants/merchantDao.js';
import config from '../config/config.js';
import { logger } from '../utils/logger.js';

//run only on server - side /production level
if (process.env.NODE_ENV === 'production') {
  cron.schedule('*/10 * * * *', () => {
    formattedSuccessRatiosByMerchant();
  });
} else {
  logger.error('Cron jobs are disabled in non-production environments.');
}

const formattedSuccessRatiosByMerchant = async () => {
  try {
    const now = new Date();
    const intervals = [
      { label: 'Last 5m', duration: 5 * 60 * 1000 },
      { label: 'Last 15m', duration: 15 * 60 * 1000 },
      { label: 'Last 30m', duration: 30 * 60 * 1000 },
      { label: 'Last 1h', duration: 60 * 60 * 1000 },
      { label: 'Last 3h', duration: 3 * 60 * 60 * 1000 },
      { label: 'Last 24h', duration: 24 * 60 * 60 * 1000 },
    ];

    // fetch all transactions
    const allPayins = await getPayInUrlsDao({});
    const merchants = await getMerchantsDao({}, null, null);
    // group transactions by merchant_id
    const transactionsByMerchant = allPayins.reduce((map, payin) => {
      if (!map[payin.merchant_id]) map[payin.merchant_id] = [];
      map[payin.merchant_id].push({
        updated_at: new Date(payin.updated_at),
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
            (tx) => tx.updated_at >= startTime,
          );

          const total = filteredTransactions.length;
          const success = filteredTransactions.filter(
            (tx) => tx.status === 'SUCCESS',
          ).length;

          const successRatio =
            total === 0
              ? '0.00%'
              : Math.min(((success / total) * 100).toFixed(2), 100) + '%';
          const statusIcon = success === 0 ? '⚠️' : '✅';

          return `${statusIcon} ${label}: ${success}/${total} = ${successRatio}`;
        })
        .join('\n');

      const intervalDetailsUtr = intervals
        .map(({ label, duration }) => {
          const startTime = new Date(now - duration);

          const filteredTransactions = merchantTransactions.filter(
            (tx) => tx.updated_at >= startTime,
          );

          const total = filteredTransactions.length;

          const utrSubmission = filteredTransactions.filter(
            (tx) => tx.user_submitted_utr && tx.user_submitted_utr.length > 0,
          ).length;

          const statusIcon = utrSubmission === 0 ? '⚠️' : '✅';

          const utrSubmissionRatio =
            total === 0
              ? '0.00%'
              : Math.min(((utrSubmission / total) * 100).toFixed(2), 100) + '%';

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
      config?.telegramRatioAlertsChatId,
      fullMessages,
      config?.telegramBotToken,
    );
  } catch (error) {
    logger.error('Error ', error.message);
  }
};
