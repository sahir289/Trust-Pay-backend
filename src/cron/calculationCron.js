import cron from 'node-cron';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
// import { transactionWrapper } from '../utils/db.js';
import {
  createCalculationDao,
  getCalculationByDateAndUserDao,
  getLatestCalculationsForAllUsersDao,
  updateTodayNetBalanceDao,
} from '../apis/calculation/calculationDao.js';
import { logger } from '../utils/logger.js';
import config from '../config/config.js'; 
import { beginTransaction, commit, getConnection, rollback } from '../utils/db.js';
// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

const IST = 'Asia/Kolkata';

// Track retry attempts
let retryCount = 0;
const MAX_RETRIES = 3; // Total attempts: 1 initial + 2 retries

let calculationCronJob = null;
// let retryCronJob = null;

// Only run cron jobs in production environment
if (config?.env === 'production') {
  // Main cron job at midnight
  calculationCronJob = cron.schedule(
    '0 0 * * *',
    async () => {
      retryCount = 0; // Reset retry count for new day
      await executeWithRetry('12:00 AM IST (Attempt 1)');
    },
    {
      timezone: IST,
    },
  );
} else {
  logger.warn('Cron jobs are disabled in non-production environments.');
}

// Function to execute cron with retry mechanism
const executeWithRetry = async (attemptDescription) => {
  retryCount++;
  logger.info(`Running calculation cron job in production mode at ${attemptDescription}`);
  
  try {
    await collectCalculationData();
    markExecution(); // Only mark as executed if successful
    logger.info(`Cron job executed successfully on ${attemptDescription}`);
  } catch (error) {
    logger.error(`Cron job failed on ${attemptDescription}:`, error?.message);
    
    // If we haven't reached max retries, schedule next attempt after 10 seconds
    if (retryCount < MAX_RETRIES) {
      const nextAttempt = retryCount + 1;
      logger.info(`Scheduling retry attempt ${nextAttempt} in 10 seconds...`);
      
      setTimeout(async () => {
        await executeWithRetry(`12:00:${(retryCount * 10).toString().padStart(2, '0')} AM IST (Attempt ${nextAttempt})`);
      }, 10000); // 10 seconds delay
    } else {
      logger.error(`All ${MAX_RETRIES} attempts failed. Cron job execution unsuccessful.`);
    }
  }
};

// Function to mark successful execution
const markExecution = () => {
  const currentDate = dayjs().tz(IST).format('YYYY-MM-DD');
  logger.info(`Cron execution marked successfully for date: ${currentDate}`);
};

export const stopCalculationCron = () => {
  if (calculationCronJob) {
    calculationCronJob.stop();
    logger.info('Calculation cron job stopped');
  }
};

const collectCalculationData = async () => {
  const executionStartTime = dayjs().tz(IST).format('YYYY-MM-DDTHH:mm:ssZ');
  logger.info(`Starting calculation cron job at: ${executionStartTime}`);
  let conn; let committed = false;

  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const currentDate = dayjs().tz(IST).format('YYYY-MM-DD');

    // Create IST time in the exact format we want
    const currentTime = dayjs().tz(IST).format('YYYY-MM-DDTHH:mm:ssZ');
    logger.info(`Calculation Cron Running Current time in IST: ${currentTime}`);

    // Batch fetch: Get existing entries for today and latest calculations for all users
    const [existingEntries, latestCalculations] = await Promise.all([
      getCalculationByDateAndUserDao(currentDate, conn),
      getLatestCalculationsForAllUsersDao(conn),
    ]);

    // Create map of existing entries by user_id (for updates)
    const existingEntriesMap = new Map(
      (existingEntries || []).map(entry => [entry.user_id, entry])
    );
    logger.info(`Found ${existingEntriesMap.size} existing calculation entries for ${currentDate}`);

    let createdCount = 0;
    let updatedCount = 0;

    // Process each user's calculation
    for (const calc of latestCalculations) {
      try {
        const existingEntry = existingEntriesMap.get(calc.user_id);
        const prevNetBalance = parseFloat(calc.net_balance) || 0;

        if (existingEntry) {
          // Entry exists - update net_balance = prev_net_balance + current_balance
          await updateTodayNetBalanceDao(existingEntry.id, prevNetBalance, conn);
          updatedCount++;
        } else {
          // No entry - create one
          await processUpdate({
            user_id: calc.user_id,
            role_id: calc.role_id,
            company_id: calc.company_id,
            net_balance: prevNetBalance,
            created_at: currentTime,
          }, conn);
          createdCount++;
        }
      } catch (userError) {
        logger.error(`Error processing entry for user ${calc.user_id}:`, userError?.message);
      }
    }
    
    logger.info(`Calculation cron: Created ${createdCount}, Updated ${updatedCount} entries`);

    const executionEndTime = dayjs().tz(IST).format('YYYY-MM-DDTHH:mm:ssZ');
    logger.info(
      `Cron job executed successfully for all users. Started: ${executionStartTime}, Completed: ${executionEndTime}`,
    );
    await commit(conn); committed = true;
  } catch (error) {
    if (conn && !committed) await rollback(conn);
    logger.error('Error while collecting user data:', error?.message);
    throw error; // Re-throw to ensure fallback mechanisms can detect failures
  } finally {
    if (conn) conn.release();
  }
};
// Function to update the calculation data
async function processUpdate(data, conn = null) {
  try {
    await createCalculationDao(data, conn);
  } catch (error) {
    logger.error('Error while updating calculation data:', error?.message);
    throw error; // Re-throw to trigger transaction rollback
  }
}

export default collectCalculationData;


