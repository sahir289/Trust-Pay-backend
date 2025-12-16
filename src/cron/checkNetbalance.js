import cron from 'node-cron';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { getallBankHistoryDao } from '../apis/bankHistory/bankHistoryDao.js';
import collectBankData from './bankCron.js';
// import {
//   getUsersForCronDao,
// } from '../apis/users/userDao.js';

import {
  getCalculationByDateAndUserDao,
  createCalculationDao,
  updateTodayNetBalanceDao,
} from '../apis/calculation/calculationDao.js';

import { logger } from '../utils/logger.js';
import config from '../config/config.js';

dayjs.extend(utc);
dayjs.extend(timezone);
const IST = 'Asia/Kolkata';

let checkNetbalanceCronJob = null;

if (config?.env === 'production') {
  checkNetbalanceCronJob = cron.schedule(
    '1 0 * * *', 
    async () => {
      await runDailyCalculation();
    },
    { timezone: IST }
  );
} else {
  logger.warn('Daily calculation cron is disabled in non-production environment.');
}

const runDailyCalculation = async () => {
  const startTime = dayjs().tz(IST).format('YYYY-MM-DD HH:mm:ss');
  logger.info(`Starting daily calculation update at ${startTime} IST`);
  const today = dayjs().tz(IST).format('YYYY-MM-DD');
  const yesterday = dayjs().tz(IST).subtract(1, 'day').format('YYYY-MM-DD');
  try {
    await processUserCalculation(today, yesterday);
    markSuccess(today);
    logger.info(`Daily calculation update completed successfully for ${today}`);
  } catch (error) {
    logger.error(`Daily calculation failed for ${today}:`, error?.message || error);
  }
};

const processUserCalculation = async (today, yesterday) => {
  try {
    const todayCalc = await getCalculationByDateAndUserDao(today);
    const yesterdayCalc = await getCalculationByDateAndUserDao(yesterday);
    const todayMap = new Map(todayCalc.map((rec) => [rec.user_id, rec]));
    for (const yCalc of yesterdayCalc) {
      const existingToday = todayMap.get(yCalc.user_id);
      const prevNetBalance = yCalc.net_balance || 0;
      if (existingToday) {
        await updateTodayNetBalanceDao(existingToday.id, prevNetBalance);
      } else {
        await createCalculationDao({
          user_id: yCalc.user_id,
          role_id: yCalc.role_id,
          company_id: yCalc.company_id,
          net_balance: prevNetBalance,
        });
        logger.info(
          `Created calculation for user ${yCalc.user_id} on ${today}`,
        );
      }
    }
    const bankhistory = await getallBankHistoryDao({ date: today });
    if (bankhistory.length === 0) {
      await collectBankData('Asia/Kolkata');
     }
    logger.info(
      `Finished processing calculations for ${yesterdayCalc.length} users on ${today}`,
    );
  } catch (error) {
    logger.error(
      `Failed to process user calculations for ${today}: ${error?.message || error}`,
    );
  }
};

const markSuccess = (date) => {
  logger.info(`Daily calculation cron completed successfully for date: ${date}`);
};

export const stopCheckNetbalanceCron = () => {
  if (checkNetbalanceCronJob) {
    checkNetbalanceCronJob.stop();
    logger.info('Check netbalance cron job stopped');
  }
};

export default runDailyCalculation;