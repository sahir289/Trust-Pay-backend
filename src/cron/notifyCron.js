import cron from 'node-cron';
import moment from 'moment-timezone';
import {
  getPayInsForCronDao,
  getExpiredPayInsDao,
  updatePayInUrlDao,
} from '../apis/payIn/payInDao.js';
import { merchantPayinCallback } from '../callBacksAndWebHook/merchantCallBacks.js';
import { logger } from '../utils/logger.js';
import { calculateDuration } from '../helpers/index.js';
// import config from '../config/config.js';

let notifyCronJob = null;
let isNotifyCronRunning = false; // Prevent overlapping executions

// Only run cron jobs in the dedicated cron worker process (works in both prod and local)
const isCronWorker = process.env.CRON_WORKER === 'true';
if (isCronWorker) {
  notifyCronJob = cron.schedule('*/10 * * * * *', async () => {
    if (isNotifyCronRunning) {
      logger.warn('Notify cron is already running, skipping this execution');
      return;
    }
    isNotifyCronRunning = true;
    try {
      await collectPayinData('Asia/Kolkata');
    } finally {
      isNotifyCronRunning = false;
    }
  });
  logger.info('Notify cron job initialized in cron worker');
}

export const stopNotifyCron = () => {
  if (notifyCronJob) {
    notifyCronJob.stop();
    logger.info('Notify cron job stopped');
  }
};

const collectPayinData = async (timezone = 'Asia/Kolkata') => {
  const currentTime = moment().tz(timezone, true);
  const expireTime = currentTime.clone().subtract(10, 'minutes').toISOString();
  try {
    // Get payins already DROPPED but not notified
    const payinsDropped = await getPayInsForCronDao({
      status: ['FAILED', 'DROPPED'],
      is_notified: 'false',
    });
    
    // Update INITIATED payins older than 10 minutes - fetch only expired ones
    const payinsInitiatedExpired = await getExpiredPayInsDao(expireTime, 'INITIATED', 'created_at');
    const payinsInitiatedAll = await getPayInsForCronDao({ status: 'INITIATED' });
    
    // FIXED: Process updates in small batches to prevent pool exhaustion
    const BATCH_SIZE = 5; // Process 5 at a time instead of all at once
    
    // Process expired payins in batches
    const expiredToUpdate = payinsInitiatedExpired;
    for (let i = 0; i < expiredToUpdate.length; i += BATCH_SIZE) {
      const batch = expiredToUpdate.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (payin) => {
        const duration = calculateDuration(payin.created_at);
        return updatePayInUrlDao(payin.id, {
          status: 'FAILED',
          is_url_expires: true,
          duration,
        });
      }));
    }
    
    // Process page_reload payins in batches
    const reloadToUpdate = payinsInitiatedAll
      .filter(payin => payin.config?.page_reload && !payinsInitiatedExpired.find(p => p.id === payin.id));
    
    for (let i = 0; i < reloadToUpdate.length; i += BATCH_SIZE) {
      const batch = reloadToUpdate.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (payin) => {
        const duration = calculateDuration(payin.created_at);
        return updatePayInUrlDao(payin.id, {
          status: 'FAILED',
          is_url_expires: true,
          duration,
        });
      }));
    }
    
    // Log summary
    if (expiredToUpdate.length > 0) {
      logger.info(`${expiredToUpdate.length} INITIATED PayIn(s) FAILED due to timeout`);
    }
    if (reloadToUpdate.length > 0) {
      logger.info(`${reloadToUpdate.length} INITIATED PayIn(s) FAILED due to page_reload`);
    }
    
    // Update ASSIGNED payins older than 10 minutes - fetch only expired ones
    const payinsAssignedExpired = await getExpiredPayInsDao(expireTime, 'ASSIGNED', 'updated_at');
    const payinsAssignedAll = await getPayInsForCronDao({ status: 'ASSIGNED' });
    
    // Process expired payins in batches
    const assignedExpiredToUpdate = payinsAssignedExpired;
    for (let i = 0; i < assignedExpiredToUpdate.length; i += BATCH_SIZE) {
      const batch = assignedExpiredToUpdate.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (payin) => {
        const duration = calculateDuration(payin.created_at);
        return updatePayInUrlDao(payin.id, {
          status: 'DROPPED',
          is_url_expires: true,
          duration,
        });
      }));
    }
    
    // Process page_reload payins in batches
    const assignedReloadToUpdate = payinsAssignedAll
      .filter(payin => payin.config?.page_reload && !payinsAssignedExpired.find(p => p.id === payin.id));
    
    for (let i = 0; i < assignedReloadToUpdate.length; i += BATCH_SIZE) {
      const batch = assignedReloadToUpdate.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (payin) => {
        const duration = calculateDuration(payin.created_at);
        return updatePayInUrlDao(payin.id, {
          status: 'DROPPED',
          is_url_expires: true,
          duration,
        });
      }));
    }
    
    // Log summary
    if (assignedExpiredToUpdate.length > 0) {
      logger.info(`${assignedExpiredToUpdate.length} ASSIGNED PayIn(s) DROPPED due to timeout`);
    }
    if (assignedReloadToUpdate.length > 0) {
      logger.info(`${assignedReloadToUpdate.length} ASSIGNED PayIn(s) DROPPED due to page_reload`);
    }
    
    // Process notifications for dropped but unnotified payins
    if (payinsDropped?.length) {
      await processPayinNotifications(payinsDropped);
    }
  } catch (error) {
    logger.error('Error while collecting payin data:', error);
  }
};

async function processPayinNotifications(payins) {
  for (const payin of payins) {
    const notificationData = {
      status: payin.status,
      merchantOrderId: payin?.merchant_order_id || null,
      payinId: payin?.id || null,
      amount: null,
      req_amount: payin?.amount || null,
      utrId: payin?.user_submitted_utr || null,
      utr_id: payin?.user_submitted_utr || null,
    };
    try {
      if (payin?.config?.urls?.notify) {
        // This is async function but it's just the callback sending function there fore we are not using await
        merchantPayinCallback(payin?.config?.urls?.notify, notificationData);
        await updatePayInUrlDao(payin.id, { is_notified: 'true' });
      } else {
        logger.warn('Notify URL is missing for payin', { payinId: payin?.id });
      }
    } catch (error) {
      logger.error('Error processing payin:', {
        error: error.message,
        payinId: payin?.id,
        notify_url: payin?.config?.urls?.notify,
      });
    }
  }
}

export default collectPayinData;
