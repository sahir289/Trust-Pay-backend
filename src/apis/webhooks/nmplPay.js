// This file has been removed as it is now handled by the generic handler.
import { logger } from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createBankResponseWebHookService } from '../bankResponse/bankResponseServices.js';
import { getPayInIntentDao } from '../payIn/payInDao.js';
import { processPayInWebHookService } from '../payIn/payInService.js';
import { generateHash } from '../../intent/createIntentTransaction.js';
import { getBankResponseByUTR } from '../bankResponse/bankResponseDao.js';
import { acquireLock, releaseLock } from '../../utils/distributedLock.js';

export const nmplPayWebhook = async (req, res) => {
  try {
    sendSuccess(res, 200, 'Webhook received successfully');
    const body = req.body?.transaction;
    const merchantOrderId = body?.order_id
    const utr = body?.utr;
    const lockAcquired = await acquireLock(utr, 'nmplPay');
    if (!lockAcquired) {
      logger.warn(`Duplicate concurrent webhook skipped for ${utr} and merchantOrderId ${merchantOrderId}`);
      return;
    }

    const hash = generateHash(body, 'nmplPay');
    if (hash !== body.hash) {
      logger.error('Invalid hash in nmplPay webhook');
      // return;
    }

    const payload = {
      merchantOrderId: body?.order_id,
      userSubmittedUtr: body?.utr,
      amount: Number(body?.amount),
      status: body?.status,
    };
    const payIn = await getPayInIntentDao(body?.order_id);

    const bankResponsePayload = `${body?.amount} nil ${payload.userSubmittedUtr} ${payIn.bank_acc_id}`;

    const utrAlreadyExist = await getBankResponseByUTR(
      payload.userSubmittedUtr,
    );

    if (utrAlreadyExist) {
      logger.warn(
        'Duplicate UTR received in nmplPay webhook:',
        payload.userSubmittedUtr,
      );
      return;
    }

    if (body?.status === 'success') {
      const bankResponse = await createBankResponseWebHookService(
        bankResponsePayload,
        payIn.company_id,
        'BOT',
        'nmplPay',
      );
      logger.info('Bank response created:', bankResponse);
    }
    logger.info('Calling processPayInWebHookService for payload', payload);
    const payin = await processPayInWebHookService(
      payload,
      '',
    );

    logger.info('PayIn processed:', payin);
  } catch (error) {
    logger.error('nmplPay webhook error:', error);
  } finally {
    await releaseLock(req.body?.transaction?.utr, 'nmplPay');
  }
};
