import cron from 'node-cron';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { getallBankHistoryDao } from '../apis/bankHistory/bankHistoryDao.js';
import collectBankData from './bankCron.js';
import collectCalculationData from './calculationCron.js';
import { logger } from '../utils/logger.js';

dayjs.extend(utc);
dayjs.extend(timezone);
const IST = 'Asia/Kolkata';

let checkNetbalanceCronJob = null;

// Only run cron jobs in the dedicated cron worker process (works in both prod and local)
const isCronWorker = process.env.CRON_WORKER === 'true';
if (isCronWorker && process.env.NODE_ENV === 'production') {
  checkNetbalanceCronJob = cron.schedule(
    '2 0 * * *',  // Run at 00:02 IST as backup for calculationCron (00:00)
    async () => {
      await runDailyCalculation();
    },
    { timezone: IST }
  );
  logger.info('Check netbalance cron job initialized in cron worker');
}

const runDailyCalculation = async () => {
  const startTime = dayjs().tz(IST).format('YYYY-MM-DD HH:mm:ss');
  logger.info(`Starting daily calculation backup at ${startTime} IST`);
  const today = dayjs().tz(IST).format('YYYY-MM-DD');
  
  try {
    // Reuse the main calculation cron logic (handles deduplication internally)
    await collectCalculationData();
    
    // Check and populate bank history if missing
    const bankhistory = await getallBankHistoryDao({ date: today });
    if (bankhistory.length === 0) {
      logger.info('No bank history found for today, running bank cron...');
      await collectBankData('Asia/Kolkata');
    }
    
    logger.info(`Daily calculation backup completed successfully for ${today}`);
  } catch (error) {
    logger.error(`Daily calculation backup failed for ${today}:`, error?.message || error);
  }
};

export const stopCheckNetbalanceCron = () => {
  if (checkNetbalanceCronJob) {
    checkNetbalanceCronJob.stop();
    logger.info('Check netbalance cron job stopped');
  }
};

export default runDailyCalculation;
