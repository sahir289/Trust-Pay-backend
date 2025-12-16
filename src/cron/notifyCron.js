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
import config from '../config/config.js';

let notifyCronJob = null;

if (config?.env == 'production') {
  notifyCronJob = cron.schedule('*/10 * * * * *', () => {
    collectPayinData('Asia/Kolkata');
  });
  logger.info('Running cron job in production environment');
} else {
  logger.warn('Cron jobs are disabled in non-production environments.');
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
    
    // Process expired payins (batch update not possible due to different durations per record)
    const expiredUpdates = payinsInitiatedExpired.map(async (payin) => {
      const duration = calculateDuration(payin.created_at);
      return updatePayInUrlDao(payin.id, {
        status: 'FAILED',
        is_url_expires: true,
        duration,
      });
    });
    
    // Process page_reload payins
    const reloadUpdates = payinsInitiatedAll
      .filter(payin => payin.config?.page_reload && !payinsInitiatedExpired.find(p => p.id === payin.id))
      .map(async (payin) => {
        const duration = calculateDuration(payin.created_at);
        return updatePayInUrlDao(payin.id, {
          status: 'FAILED',
          is_url_expires: true,
          duration,
        });
      });
    
    // Execute all updates in parallel
    await Promise.all([...expiredUpdates, ...reloadUpdates]);
    
    // Log summary
    if (expiredUpdates.length > 0) {
      logger.info(`${expiredUpdates.length} INITIATED PayIn(s) FAILED due to timeout`);
    }
    if (reloadUpdates.length > 0) {
      logger.info(`${reloadUpdates.length} INITIATED PayIn(s) FAILED due to page_reload`);
    }
    
    // Update ASSIGNED payins older than 10 minutes - fetch only expired ones
    const payinsAssignedExpired = await getExpiredPayInsDao(expireTime, 'ASSIGNED', 'updated_at');
    const payinsAssignedAll = await getPayInsForCronDao({ status: 'ASSIGNED' });
    
    // Process expired payins
    const assignedExpiredUpdates = payinsAssignedExpired.map(async (payin) => {
      const duration = calculateDuration(payin.created_at);
      return updatePayInUrlDao(payin.id, {
        status: 'DROPPED',
        is_url_expires: true,
        duration,
      });
    });
    
    // Process page_reload payins
    const assignedReloadUpdates = payinsAssignedAll
      .filter(payin => payin.config?.page_reload && !payinsAssignedExpired.find(p => p.id === payin.id))
      .map(async (payin) => {
        const duration = calculateDuration(payin.created_at);
        return updatePayInUrlDao(payin.id, {
          status: 'DROPPED',
          is_url_expires: true,
          duration,
        });
      });
    
    // Execute all updates in parallel
    await Promise.all([...assignedExpiredUpdates, ...assignedReloadUpdates]);
    
    // Log summary
    if (assignedExpiredUpdates.length > 0) {
      logger.info(`${assignedExpiredUpdates.length} ASSIGNED PayIn(s) DROPPED due to timeout`);
    }
    if (assignedReloadUpdates.length > 0) {
      logger.info(`${assignedReloadUpdates.length} ASSIGNED PayIn(s) DROPPED due to page_reload`);
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
