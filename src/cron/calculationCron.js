import cron from 'node-cron';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { transactionWrapper } from '../utils/db.js';
import { createCalculationDao, getCalculationforCronDao } from '../apis/calculation/calculationDao.js';
import { getUsersForCronDao } from '../apis/users/userDao.js';
import { logger } from '../utils/logger.js';

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

const IST = 'Asia/Kolkata';

// Only run cron jobs in development environment
if (process.env.NODE_ENV == 'production') {
cron.schedule(
  '0 0 * * *',
  () => {
    logger.info('Running cron job in production mode');
    collectCalculationData();
  },
  {
    timezone: IST,
  },
);
}else {
  logger.error('Cron jobs are disabled in non-production environments.');
}

const collectCalculationData = async () => {
  try {
    const users = (await transactionWrapper(getUsersForCronDao)()) || [];
    const usersArray = users || [];

    // Create IST time in the exact format we want
    const currentTime = dayjs()
      .tz(IST)
      .format('YYYY-MM-DDTHH:mm:ssZ'); // Will create: 2025-04-23T19:26:00+05:30
    logger.info(`Calculation Cron Running Current time in IST: ${currentTime}`);

    for (const user of usersArray) {
      try {
        const calculation = await getCalculationforCronDao(user.id);
        if (calculation.length > 0) {
          const resetData = {
            user_id: calculation[0].user_id,
            role_id: calculation[0].role_id,
            company_id: calculation[0].company_id,
            net_balance: parseFloat(calculation[0].net_balance),
            config: calculation[0].config,
            created_at: currentTime  // Store exact IST time
          };
          await processUpdate(resetData);
        }
      } catch (userError) {
        logger.error(
          `Error processing data for user ${user?.id}:`,
          userError?.message,
        );
      }
    }
    logger.info(`Cron job executed successfully for all users at ${currentTime}`);
  } catch (error) {
    logger.error('Error while collecting user data:', error?.message);
  }
};
// Function to update the calculation data
async function processUpdate(data) {
  try {
    await createCalculationDao(null, data);
  } catch (error) {
    logger.error('Error while updating calculation data:', error?.message);
  }
}

export default collectCalculationData;
