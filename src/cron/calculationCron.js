import cron from 'node-cron';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import {
  getCalculationByDateAndUserDao,
  getLatestCalculationsForAllUsersDao,
  batchUpdateTodayNetBalanceDao,
  batchCreateCalculationDao,
} from '../apis/calculation/calculationDao.js';
import { logger } from '../utils/logger.js';
import { beginTransaction, commit, getConnection, rollback } from '../utils/db.js';
// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

const IST = 'Asia/Kolkata';

// Track retry attempts
let retryCount = 0;
const MAX_RETRIES = 3; // Total attempts: 1 initial + 2 retries

let calculationCronJob = null;

// Only run cron jobs in the dedicated cron worker process (works in both prod and local)
const isCronWorker = process.env.CRON_WORKER === 'true';
if (isCronWorker && process.env.NODE_ENV === 'production') {
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
  logger.info('Calculation cron job initialized in cron worker');
}

// Function to execute cron with retry mechanism
const executeWithRetry = async (attemptDescription) => {
  retryCount++;
  logger.info(`Running calculation cron job at ${attemptDescription}`);
  
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
  let conn;
  let committed = false;

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

    // Separate entries into updates and creates
    const updates = [];
    const creates = [];

    for (const calc of latestCalculations) {
      const existingEntry = existingEntriesMap.get(calc.user_id);
      const prevNetBalance = Number.parseFloat(calc.net_balance) || 0;

      if (existingEntry) {
        // Entry exists - queue for batch update
        updates.push({ id: existingEntry.id, net_balance: prevNetBalance });
      } else {
        // No entry - queue for batch create
        creates.push({
          user_id: calc.user_id,
          role_id: calc.role_id,
          company_id: calc.company_id,
          net_balance: prevNetBalance,
          created_at: currentTime,
        });
      }
    }

     // Execute batch operations in parallel
     const [updatedCount, createdCount] = await Promise.all([
      updates.length > 0 ? batchUpdateTodayNetBalanceDao(updates, conn) : 0,
      creates.length > 0 ? batchCreateCalculationDao(creates, conn) : 0,
    ]);
    
    logger.info(`Calculation cron: Created ${createdCount}, Updated ${updatedCount} entries`);

    const executionEndTime = dayjs().tz(IST).format('YYYY-MM-DDTHH:mm:ssZ');
    logger.info(
      `Cron job executed successfully for all users. Started: ${executionStartTime}, Completed: ${executionEndTime}`,
    );
    await commit(conn);
    committed = true;
  } catch (error) {
    if (conn && !committed) await rollback(conn);
    logger.error('Error while collecting user data:', error?.message);
    throw error; // Re-throw to ensure fallback mechanisms can detect failures
  }
  finally {
    if (conn) conn.release();
  }
};

export default collectCalculationData;


