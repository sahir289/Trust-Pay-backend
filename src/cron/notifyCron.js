import cron from 'node-cron';
import moment from 'moment-timezone';
import {
  getPayInsForCronByDateRangeDao,
  updatePayInUrlDao,
} from '../apis/payIn/payInDao.js';
import { merchantPayinCallback } from '../callBacksAndWebHook/merchantCallBacks.js';
import { logger } from '../utils/logger.js';
import { calculateDuration } from '../helpers/index.js';
import { getMerchantKeysFromCacheOrDb } from '../utils/cachedData/getmerchantkeycache.js';

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const DEFAULT_NOTIFY_LOOKBACK_MINUTES = parsePositiveInt(
  process.env.NOTIFY_CRON_LOOKBACK_MINUTES,
  10,
);
const MAX_NOTIFY_LOOKBACK_MINUTES = parsePositiveInt(
  process.env.NOTIFY_CRON_MAX_LOOKBACK_MINUTES,
  240,
);
const NOTIFY_CRON_QUERY_MAX_ROWS = parsePositiveInt(
  process.env.NOTIFY_CRON_QUERY_MAX_ROWS,
  500,
);

const normalizeCollectOptions = (input) => {
  if (typeof input === 'string') {
    return {
      timezone: input,
      lookbackMinutes: DEFAULT_NOTIFY_LOOKBACK_MINUTES,
      mode: 'scheduled',
    };
  }

  const timezone = input?.timezone || 'Asia/Kolkata';
  const rawLookback = parsePositiveInt(
    input?.lookbackMinutes,
    DEFAULT_NOTIFY_LOOKBACK_MINUTES,
  );
  const lookbackMinutes = Math.min(rawLookback, MAX_NOTIFY_LOOKBACK_MINUTES);

  return {
    timezone,
    lookbackMinutes,
    mode: input?.mode || 'manual',
  };
};

let notifyCronJob = null;
let isNotifyCronRunning = false; // Prevent overlapping executions

// Only run cron jobs in the dedicated cron worker process (works in both prod and local)
const isCronWorker = process.env.CRON_WORKER === 'true';
if (isCronWorker && process.env.NODE_ENV === 'production') {
  notifyCronJob = cron.schedule('*/10 * * * * *', async () => {
    if (isNotifyCronRunning) {
      logger.warn('Notify cron is already running, skipping this execution');
      return;
    }
    isNotifyCronRunning = true;
    try {
      await collectPayinData({
        timezone: 'Asia/Kolkata',
        lookbackMinutes: DEFAULT_NOTIFY_LOOKBACK_MINUTES,
        mode: 'scheduled',
      });
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

const collectPayinData = async (options = 'Asia/Kolkata') => {
  const { timezone, lookbackMinutes, mode } = normalizeCollectOptions(options);
  const currentTime = moment().tz(timezone, true);
  const EXPIRY_MINUTES = 10;
  const LOOKBACK_MINUTES = lookbackMinutes;

  // Timeout window (records that crossed 10-minute expiry within last 10 minutes)
  const expiredWindowEnd = currentTime
    .clone()
    .subtract(EXPIRY_MINUTES, 'minutes');
  const expiredWindowStart = expiredWindowEnd
    .clone()
    .subtract(LOOKBACK_MINUTES, 'minutes');

  // Recent activity window (last 10 minutes from now)
  const recentWindowStart = currentTime
    .clone()
    .subtract(LOOKBACK_MINUTES, 'minutes');

  const BATCH_SIZE = 5;

  try {
    logger.info('Notify cron window execution started', {
      mode,
      timezone,
      lookbackMinutes: LOOKBACK_MINUTES,
      expiryMinutes: EXPIRY_MINUTES,
      maxLookbackMinutes: MAX_NOTIFY_LOOKBACK_MINUTES,
      queryMaxRows: NOTIFY_CRON_QUERY_MAX_ROWS,
    });

    // Get only recently updated FAILED/DROPPED items pending notification
    const payinsDropped = await getPayInsForCronByDateRangeDao({
      statuses: ['FAILED', 'DROPPED'],
      isNotified: 'false',
      dateField: 'updated_at',
      startTime: recentWindowStart.toISOString(),
      endTime: currentTime.toISOString(),
      maxRows: NOTIFY_CRON_QUERY_MAX_ROWS,
    });

    // Timeout candidates: only bounded expiry window (no full table scan)
    const payinsInitiatedExpired = await getPayInsForCronByDateRangeDao({
      statuses: ['INITIATED'],
      dateField: 'created_at',
      startTime: expiredWindowStart.toISOString(),
      endTime: expiredWindowEnd.toISOString(),
      maxRows: NOTIFY_CRON_QUERY_MAX_ROWS,
    });

    // page_reload candidates: only recently touched rows (last 10 minutes)
    const payinsInitiatedRecent = await getPayInsForCronByDateRangeDao({
      statuses: ['INITIATED'],
      dateField: 'updated_at',
      startTime: recentWindowStart.toISOString(),
      endTime: currentTime.toISOString(),
      maxRows: NOTIFY_CRON_QUERY_MAX_ROWS,
    });

    const initiatedExpiredIds = new Set(payinsInitiatedExpired.map((p) => p.id));
    const reloadToUpdate = payinsInitiatedRecent.filter(
      (payin) => payin.config?.page_reload && !initiatedExpiredIds.has(payin.id),
    );

    for (let i = 0; i < payinsInitiatedExpired.length; i += BATCH_SIZE) {
      const batch = payinsInitiatedExpired.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (payin) => {
        const duration = calculateDuration(payin.created_at);
        return updatePayInUrlDao(payin.id, {
          status: 'FAILED',
          is_url_expires: true,
          duration,
        });
      }));
    }

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
    if (payinsInitiatedExpired.length > 0) {
      logger.info(
        `${payinsInitiatedExpired.length} INITIATED PayIn(s) FAILED due to timeout (windowed scan)`,
      );
    }
    if (reloadToUpdate.length > 0) {
      logger.info(
        `${reloadToUpdate.length} INITIATED PayIn(s) FAILED due to page_reload (windowed scan)`,
      );
    }

    const payinsAssignedExpired = await getPayInsForCronByDateRangeDao({
      statuses: ['ASSIGNED'],
      dateField: 'updated_at',
      startTime: expiredWindowStart.toISOString(),
      endTime: expiredWindowEnd.toISOString(),
      maxRows: NOTIFY_CRON_QUERY_MAX_ROWS,
    });

    const payinsAssignedRecent = await getPayInsForCronByDateRangeDao({
      statuses: ['ASSIGNED'],
      dateField: 'updated_at',
      startTime: recentWindowStart.toISOString(),
      endTime: currentTime.toISOString(),
      maxRows: NOTIFY_CRON_QUERY_MAX_ROWS,
    });

    const assignedExpiredIds = new Set(payinsAssignedExpired.map((p) => p.id));
    const assignedReloadToUpdate = payinsAssignedRecent.filter(
      (payin) => payin.config?.page_reload && !assignedExpiredIds.has(payin.id),
    );

    for (let i = 0; i < payinsAssignedExpired.length; i += BATCH_SIZE) {
      const batch = payinsAssignedExpired.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (payin) => {
        const duration = calculateDuration(payin.created_at);
        return updatePayInUrlDao(payin.id, {
          status: 'DROPPED',
          is_url_expires: true,
          duration,
        });
      }));
    }

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
    if (payinsAssignedExpired.length > 0) {
      logger.info(
        `${payinsAssignedExpired.length} ASSIGNED PayIn(s) DROPPED due to timeout (windowed scan)`,
      );
    }
    if (assignedReloadToUpdate.length > 0) {
      logger.info(
        `${assignedReloadToUpdate.length} ASSIGNED PayIn(s) DROPPED due to page_reload (windowed scan)`,
      );
    }

    // Process notifications for dropped but unnotified payins
    if (payinsDropped?.length) {
      await processPayinNotifications(payinsDropped);
    }

    logger.info('Notify cron window execution completed', {
      mode,
      lookbackMinutes: LOOKBACK_MINUTES,
      droppedToNotify: payinsDropped.length,
      initiatedExpired: payinsInitiatedExpired.length,
      initiatedReload: reloadToUpdate.length,
      assignedExpired: payinsAssignedExpired.length,
      assignedReload: assignedReloadToUpdate.length,
    });
  } catch (error) {
    logger.error('Error while collecting payin data:', error);
  }
};

async function processPayinNotifications(payins) {
  for (const payin of payins) {
    let notificationData = {
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
          const Key = await getMerchantKeysFromCacheOrDb(payin?.merchant_id);
          const secretKey = Key?.private || null;
          const api_version = Key?.api_version || 'v1';

          if (api_version === "v2") {
            notificationData = {
              ...notificationData,
              reqAmount: notificationData.req_amount,
              utrId: notificationData.utr_id,
            };
        
            delete notificationData.req_amount;
            delete notificationData.utr_id;
          }

        // This is async function but it's just the callback sending function there fore we are not using await
        merchantPayinCallback(payin?.config?.urls?.notify, notificationData, secretKey, api_version);
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
