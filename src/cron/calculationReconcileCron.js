import cron from 'node-cron';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import {
  getCalculationByIdForCronDao,
  updateCalculationNetBalanceByIdDao,
} from '../apis/calculation/calculationDao.js';
import { logger } from '../utils/logger.js';
import {
  addToRedisQueue,
  deleteRedisKey,
  getRedisHash,
  getRedisQueueItems,
  removeFromRedisQueue,
  setRedisHash,
} from '../utils/redishashkey.js';
import { beginTransaction, commit, getConnection, rollback } from '../utils/db.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const IST = 'Asia/Kolkata';
const RECONCILE_QUEUE_KEY = 'calculation:reconcile:queue';
const RECONCILE_JOB_KEY_PREFIX = 'calculation:reconcile:job';

let calculationReconcileCronJob = null;

const buildJobKey = (calculationId) =>
  `${RECONCILE_JOB_KEY_PREFIX}:${calculationId}`;

export const enqueueCalculationReconcileJob = async ({
  calculation_id,
  calculation_new_id,
  user_id,
  queued_net_balance = null,
  queued_current_balance = null,
  company_id = null,
} = {}) => {
  if (!calculation_id || !calculation_new_id) {
    return null;
  }

  const job = {
    calculation_id,
    calculation_new_id,
    user_id,
    queued_net_balance,
    queued_current_balance,
    company_id,
  };

  await setRedisHash(buildJobKey(calculation_id), job, 'Calculation reconcile job');
  await addToRedisQueue(RECONCILE_QUEUE_KEY, calculation_id);

  return job;
};

const processQueuedCalculationJob = async (calculationId) => {
  let conn;
  let committed = false;

  try {
    const queuedJob = await getRedisHash(buildJobKey(calculationId), 'Calculation reconcile job');
    if (!queuedJob?.calculation_id) return;

    conn = await getConnection();
    await beginTransaction(conn);

    const latestCalculationData = await getCalculationByIdForCronDao(queuedJob.calculation_id, conn);
    if (!latestCalculationData?.[0]) {
      await commit(conn);
      committed = true;
      return;
    }

    const queuedNetBalance = Number.parseFloat(queuedJob.queued_net_balance) || 0;
    const latestNetBalance = Number.parseFloat(latestCalculationData?.[0]?.net_balance) || 0;

    const netBalanceMismatch = queuedNetBalance !== latestNetBalance;

    if (netBalanceMismatch) {
      await updateCalculationNetBalanceByIdDao(
        queuedJob.calculation_new_id,
        latestNetBalance,
        conn,
      );
    }

    await commit(conn);
    committed = true;
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn);
    }
    logger.error('[CalculationReconcileCron] job failed', error?.message);
    throw error;
  } finally {
    if (conn) {
      conn.release();
    }

    await removeFromRedisQueue(RECONCILE_QUEUE_KEY, calculationId, 'Calculation reconcile queue');
    await deleteRedisKey(buildJobKey(calculationId), 'Calculation reconcile job');
  }
};

export const runCalculationReconcileCron = async () => {
  const dueCalculationIds = await getRedisQueueItems(
    RECONCILE_QUEUE_KEY,
    'Calculation reconcile queue',
  );

  if (!dueCalculationIds.length) return;

  for (const calculationId of dueCalculationIds) {
    try {
      await processQueuedCalculationJob(calculationId);
    } catch (error) {
      logger.error('[CalculationReconcileCron] processing failed', {
        calculationId,
        error: error?.message,
      });
    }
  }

};

export const stopCalculationReconcileCron = () => {
  if (calculationReconcileCronJob) {
    calculationReconcileCronJob.stop();
    calculationReconcileCronJob = null;
  }
};

export const startCalculationReconcileCron = () => {
  if (calculationReconcileCronJob) {
    return calculationReconcileCronJob;
  }

  calculationReconcileCronJob = cron.schedule(
    '0 25 0 * * *',
    async () => {
      try {
        await runCalculationReconcileCron();
      } catch (error) {
        logger.error('[CalculationReconcileCron] scheduled run failed', error?.message);
      }
    },
    { timezone: IST },
  );
  return calculationReconcileCronJob;
};

if (process.env.CRON_WORKER === 'true' && process.env.NODE_ENV === 'production') {
  startCalculationReconcileCron();
}

export default runCalculationReconcileCron;