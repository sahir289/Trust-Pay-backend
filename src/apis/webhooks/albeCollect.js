import { logger } from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createBankResponseWebHookService } from '../bankResponse/bankResponseServices.js';
import { getPayInByClientRefNoDao } from '../payIn/payInDao.js';
import { processPayInWebHookService } from '../payIn/payInService.js';
import { getBankResponseByUTR } from '../bankResponse/bankResponseDao.js';
import { acquireLock, releaseLock } from '../../utils/distributedLock.js';
import { getConnection, beginTransaction, commit, rollback } from '../../utils/db.js';

export const albeCollectWebhook = async (req, res) => {
  let lockKey;
  let conn;
  let committed = false;
  try {
    sendSuccess(res, {}, 'Webhook received successfully');

    const body = req.body || {};
    const clientRefNo = body?.clientRefNo;
    const utr = body?.utr;
    const amount = body?.amount ? Number(body.amount) : undefined;
    const status = body?.updatedStatus;
    lockKey = utr || clientRefNo;

    if (!clientRefNo || !utr) {
      logger.warn('Invalid albeCollect webhook payload:', body);
      return;
    }

    const lockAcquired = await acquireLock(lockKey, 'albeCollect');
    if (!lockAcquired) {
      logger.warn(
        `Duplicate concurrent webhook skipped for ${lockKey} and clientRefNo ${clientRefNo}`,
      );
      return;
    }

    conn = await getConnection();
    await beginTransaction(conn);
    const payIn = await getPayInByClientRefNoDao(clientRefNo, conn);
    if (!payIn) {
      logger.warn(
        `PayIn not found for albeCollect webhook clientRefNo: ${clientRefNo}`,
      );
      await commit(conn);
      committed = true;
      return;
    }
    const merchantOrderId = payIn.merchant_order_id;

    const payload = {
      merchantOrderId,
      userSubmittedUtr: utr,
      amount: amount || payIn.amount || 0,
      status,
    };

    const utrAlreadyExist = await getBankResponseByUTR(payload.userSubmittedUtr, conn);
    if (utrAlreadyExist) {
      logger.warn(
        'Duplicate UTR received in albeCollect webhook:',
        payload.userSubmittedUtr,
      );
      await commit(conn);
      committed = true;
      return;
    }

    if (String(status || '').toUpperCase() === 'SUCCESS') {
      const bankResponsePayload = `${payload.amount} nil ${payload.userSubmittedUtr} ${payIn.bank_acc_id}`;
      const bankResponse = await createBankResponseWebHookService(
        bankResponsePayload,
        payIn.company_id,
        'BOT',
        'albeCollect',
        conn,
      );
      logger.info('Bank response created for albeCollect:', bankResponse);
    }
    logger.info('Calling processPayInWebHookService for albeCollect payload', payload);
    const payin = await processPayInWebHookService(payload, '', conn);
    logger.info('PayIn processed from albeCollect webhook:', payin?.id);
    await commit(conn);
    committed = true;
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn);
    }
    logger.error('albeCollect webhook error:', error);
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseErr) {
        logger.error('Error releasing DB connection:', releaseErr);
      }
    }
    if (lockKey) {
      await releaseLock(lockKey, 'albeCollect');
    }
  }
};
