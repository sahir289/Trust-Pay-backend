import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { getInitiatedAndPendingSummaryByMerchant } from '../apis/payOut/payOutDao.js';
import { getCompanyDao } from '../apis/company/companyDao.js';
import { createTelegramSender } from '../helpers/telegramApi.js';
// import config from '../config/config.js';
// Helper: format number with commas and 2 decimals (Indian format)
const formatINR = (num) => {
  if (!num && num !== 0) return '0.00';
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};
const telegramSender = createTelegramSender();
let pendingPayoutCronJob = null;

// Only run cron jobs in production environment AND in the dedicated cron worker process
const isCronWorker = process.env.CRON_WORKER === 'true';

const collectPayoutData = async () => {
  try {
    const companies = await getCompanyDao({});
    for (const company of companies) {
      const { id: companyId, first_name, last_name, config = {} } = company;
      const { telegramPendingPayoutsChatId, telegramBotToken } = config || {};
      if (!(telegramPendingPayoutsChatId && telegramBotToken)) {
        logger.warn(
          `Skipping company ${first_name} ${last_name} — missing Telegram credentials.`,
        );
        continue;
      }
      const payoutData =
        await getInitiatedAndPendingSummaryByMerchant(companyId);
      if (!payoutData || payoutData.length === 0) {
        logger.info(`No pending payout data for ${first_name} ${last_name}.`);
        continue;
      }
      const totalAmount = payoutData.reduce(
        (sum, m) => sum + Number(m.amount || 0),
        0,
      );
      const totalCount = payoutData.reduce(
        (sum, m) => sum + Number(m.count || 0),
        0,
      );
      let message = `💸 Pending Withdrawals 💸\n\n`;
      payoutData.forEach((merchant, index) => {
        message += `${index + 1}. ${merchant.merchant}: ₹ ${formatINR(merchant.amount)} (${merchant.count}),\n`;
      });
      message += `\nTotal Pending Amount : ₹ ${formatINR(totalAmount)} (${totalCount})`;
      await sendPayoutTelegramMessage(
        telegramBotToken,
        telegramPendingPayoutsChatId,
        message,
      );
    }
  } catch (error) {
    logger.error('Error while collecting payout data:', error.message);
  }
};

const sendPayoutTelegramMessage = async (botToken, chatId, message) => {
  try {
    await telegramSender(chatId, message, null, botToken);
    logger.info('Payout Telegram message sent successfully.');
  } catch (error) {
    logger.error('Error sending payout Telegram message:', error.message);
  }
};

if (isCronWorker && process.env.NODE_ENV === 'production') {
  pendingPayoutCronJob = cron.schedule('0,30 * * * *', collectPayoutData);
  logger.info('Pending payout cron job initialized in cron worker');
}

export const stopPendingPayoutCron = () => {
  if (pendingPayoutCronJob) {
    pendingPayoutCronJob.stop();
    logger.info('Pending payout cron job stopped');
  }
};

export default collectPayoutData;
