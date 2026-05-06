import { logger } from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createBankResponseWebHookService } from '../bankResponse/bankResponseServices.js';
import { getPayInIntentDao } from '../payIn/payInDao.js';
import { processPayInWebHookService } from '../payIn/payInService.js';
import { getBankResponseByUTR } from '../bankResponse/bankResponseDao.js';
import { acquireLock, releaseLock } from '../../utils/distributedLock.js';

export const albeCollectWebhook = async (req, res) => {
  let lockKey;
  try {
    sendSuccess(res, {}, 'Webhook received successfully');

    const body = req.body || {};
    const merchantOrderId = body?.paymentReferenceNo;
    const utr = body?.utrId || body?.transactionId;
    lockKey = utr || merchantOrderId;

    if (!merchantOrderId || !utr) {
      logger.warn('Invalid albeCollect webhook payload:', body);
      return;
    }

    const lockAcquired = await acquireLock(lockKey, 'albeCollect');
    if (!lockAcquired) {
      logger.warn(
        `Duplicate concurrent webhook skipped for ${lockKey} and merchantOrderId ${merchantOrderId}`,
      );
      return;
    }

    const payIn = await getPayInIntentDao(merchantOrderId);
    if (!payIn) {
      logger.warn(
        `PayIn not found for albeCollect webhook merchantOrderId: ${merchantOrderId}`,
      );
      return;
    }

    const payload = {
      merchantOrderId,
      userSubmittedUtr: utr,
      amount: Number(body?.amount || payIn.amount || 0),
      status: body?.updatedStatus ,
    };

    const utrAlreadyExist = await getBankResponseByUTR(payload.userSubmittedUtr);
    if (utrAlreadyExist) {
      logger.warn(
        'Duplicate UTR received in albeCollect webhook:',
        payload.userSubmittedUtr,
      );
      return;
    }

    if (String(body?.updatedStatus || '').toUpperCase() === 'SUCCESS') {
      const bankResponsePayload = `${payload.amount} nil ${payload.userSubmittedUtr} ${payIn.bank_acc_id}`;
      const bankResponse = await createBankResponseWebHookService(
        bankResponsePayload,
        payIn.company_id,
        'BOT',
        'albeCollect',
      );
      logger.info('Bank response created for albeCollect:', bankResponse);
    }
    logger.info('Calling processPayInWebHookService for albeCollect payload', payload);
    const payin = await processPayInWebHookService(payload, '');
    logger.info('PayIn processed from albeCollect webhook:', payin.id);
  } catch (error) {
    logger.error('albeCollect webhook error:', error);
  } finally {
    if (lockKey) {
      await releaseLock(lockKey, 'albeCollect');
    }
  }
};
