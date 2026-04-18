import { logger } from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createBankResponseWebHookService } from '../bankResponse/bankResponseServices.js';
import { getPayInIntentDao } from '../payIn/payInDao.js';
import { processPayInWebHookService } from '../payIn/payInService.js';
import { getBankResponseByUTR } from '../bankResponse/bankResponseDao.js';
import { beginTransaction, commit, getConnection, rollback } from '../../utils/db.js';
import { checkLockEdit } from '../../utils/advisoryLock.js';
import { Status } from '../../constants/index.js';
import { acquireLock, releaseLock } from '../../utils/distributedLock.js';

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const RUNSAFE_DB_LOCK_TIMEOUT_MS = parsePositiveInt(
  process.env.RUNSAFE_DB_LOCK_TIMEOUT_MS,
  20000,
);
const RUNSAFE_DB_STATEMENT_TIMEOUT_MS = parsePositiveInt(
  process.env.RUNSAFE_DB_STATEMENT_TIMEOUT_MS,
  120000,
);
const RUNSAFE_LOCK_RETRIES = parsePositiveInt(
  process.env.RUNSAFE_LOCK_RETRIES,
  3,
);

const isRetryableTxError = (error) =>
  ['55P03', '40P01', '40001'].includes(error?.code)
  || error?.message?.includes('currently being updated');


export const runsafeWebhook = async (req, res) => {
  const data = req.body;
  logger.info('Webhook received ++++', data);
  const body = typeof data === 'string' ? JSON.parse(data) : data;
  try {
    sendSuccess(res, 200, 'runsafe webhook received successfully');
    const merchantOrderId = body?.mchOrderNo;
    const utr = body?.utr;
    const lockAcquired = await acquireLock(utr, 'runsafe');
    if (!lockAcquired) {
      logger.warn(`Duplicate concurrent webhook skipped for ${utr} and merchantOrderId ${merchantOrderId}`);
      return;
    }

    const payload = {
      merchantOrderId: body?.mchOrderNo,
      userSubmittedUtr: body?.utr || body?.mchOrderNo,
      amount: Number(body?.amount),
      status: body?.orderStatus,
    };

    for (let attempt = 1; attempt <= RUNSAFE_LOCK_RETRIES; attempt++) {
      let conn;
      let committed = false;
      try {
        conn = await getConnection();
        await beginTransaction(conn);
        await conn.query(
          `SET LOCAL lock_timeout = '${RUNSAFE_DB_LOCK_TIMEOUT_MS}ms'`,
        );
        await conn.query(
          `SET LOCAL statement_timeout = '${RUNSAFE_DB_STATEMENT_TIMEOUT_MS}ms'`,
        );

        await checkLockEdit(
          `runsafe:${merchantOrderId}:${payload.userSubmittedUtr}`,
          true,
          conn,
        );

        const payIn = await getPayInIntentDao(body?.mchOrderNo, conn);

        if (!payIn?.id) {
          logger.warn(
            `PayIn not found for merchantOrderId ${merchantOrderId}, skipping runsafe webhook processing`,
          );
          await commit(conn);
          committed = true;
          return;
        }

        const bankResponsePayload = `${body?.amount} nil ${payload.userSubmittedUtr} ${payIn.bank_acc_id}`;

        const utrAlreadyExist = await getBankResponseByUTR(
          payload.userSubmittedUtr,
          conn,
        );

        if (utrAlreadyExist) {
          logger.warn(
            'Duplicate UTR received in runsafe webhook:',
            payload.userSubmittedUtr,
          );
          await commit(conn);
          committed = true;
          return;
        }

        if (body?.orderStatus === 'SUCCESS' || body?.orderStatus === "PART_SUC") {
          const bankResponse = await createBankResponseWebHookService(
            bankResponsePayload,
            payIn.company_id,
            'BOT',
            'runsafe',
            conn,
          );
          logger.info('Bank response created:', bankResponse);
        }
        logger.info('Calling processPayInWebHookService for payload', payload);
        if (body?.orderStatus === "PART_SUC" || payIn.amount !== body?.amount) {
          payload.status = Status.DISPUTE
        }
        const payin = await processPayInWebHookService(
          payload,
          '',
          conn,
        );

        await commit(conn);
        committed = true;
        logger.info('PayIn processed:', payin);
        return;
      } catch (error) {
        if (conn && !committed) {
          await rollback(conn);
        }

        const retryable = isRetryableTxError(error);
        const isLastAttempt = attempt === RUNSAFE_LOCK_RETRIES;

        logger.error('runsafe webhook error:', error);

        if (!retryable || isLastAttempt) {
          return;
        }

        const retryDelayMs = attempt * 500;
        logger.warn(
          `Retrying runsafe webhook transaction after transient DB lock error (attempt ${attempt}/${RUNSAFE_LOCK_RETRIES}) in ${retryDelayMs}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      } finally {
        if (conn) {
          try {
            conn.release();
          } catch (releaseErr) {
            logger.error('Error releasing DB connection:', releaseErr);
          }
        }
      }
    }
  } finally {
    await releaseLock(body?.utr, 'runsafe');
  }
};
