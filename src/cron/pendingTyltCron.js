import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { getPendingTyltPayInsDao, updatePayInUrlDao } from '../apis/payIn/payInDao.js';
import { checkTyltPaymentStatus } from '../tylt/tylt.js';
import { Status } from '../constants/index.js';

let pendingTyltCronJob = null;
const isCronWorker = process.env.CRON_WORKER === 'true';

const checkPendingTyltStatus = async () => {
  try {
    const pendingPayIns = await getPendingTyltPayInsDao();
    
    if (!pendingPayIns || pendingPayIns.length === 0) {
      return;
    }

    logger.info(`Found ${pendingPayIns.length} pending Tylt payins older than 5 minutes to check.`);

    for (const payIn of pendingPayIns) {
      try {
        const { merchant_order_id, config } = payIn;
        const transaction = await checkTyltPaymentStatus(merchant_order_id);
        
        if (!transaction) {
            continue;
        }

        const isFinal = Number(transaction.isFinal);
        const isCredited = Number(transaction.isCredited);

        let internalStatus = Status.PENDING;
        if (isFinal === 1 && isCredited === 1) {
          internalStatus = Status.SUCCESS;
        } else if (isFinal === 1 && isCredited === 0) {
          internalStatus = Status.FAILED;
        }

        if (internalStatus !== Status.PENDING) {
          logger.info(`Tylt Pending Cron: Status updated for ${merchant_order_id} -> ${internalStatus}`);
          
          await updatePayInUrlDao(payIn.id, {
            status: internalStatus,
            is_url_expires: true,
            one_time_used: true,
            updated_by: 'tylt_cron',
            ...(internalStatus === Status.SUCCESS && {
              approved_at: new Date().toISOString(),
              is_notified: true,
            }),
            config: {
              ...config,
              tyltIsFinal: isFinal,
              tyltIsCredited: isCredited,
            },
          });
        }
      } catch (err) {
        logger.error(`Error checking Tylt status for payIn ${payIn.id}:`, err.message);
      }
    }
  } catch (error) {
    logger.error('Error in checkPendingTyltStatus (pendingTyltCron):', error.message);
  }
};

if (isCronWorker && process.env.NODE_ENV === 'production') {
  // Run every 5 minutes
  pendingTyltCronJob = cron.schedule('*/5 * * * *', checkPendingTyltStatus);
  logger.info('Pending Tylt status cron job initialized in cron worker');
}

export const stopPendingTyltCron = () => {
  if (pendingTyltCronJob) {
    pendingTyltCronJob.stop();
    logger.info('Pending Tylt status cron job stopped');
  }
};

export default checkPendingTyltStatus;
