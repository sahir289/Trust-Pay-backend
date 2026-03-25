import { logger } from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createBankResponseWebHookService } from '../bankResponse/bankResponseServices.js';
import { getPayInIntentDao } from '../payIn/payInDao.js';
import { processPayInWebHookService } from '../payIn/payInService.js';
import { generateHash } from '../../intent/createIntentTransaction.js';
import { getBankResponseByUTR } from '../bankResponse/bankResponseDao.js';

export const zenTechIndWebhook = async (req, res) => {
  try {
    sendSuccess(res, {}, 'Webhook received successfully');
    const body = req.body?.transaction;
    const hash = generateHash(body, 'zentechind');
    if (hash !== body.hash) {
      logger.error('Invalid hash in ZenTechInd webhook');
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

    const utrAlreadyExist = await getBankResponseByUTR(payload.userSubmittedUtr);

    if (utrAlreadyExist) {
      logger.warn('Duplicate UTR received in ZenTechInd webhook:', payload);
      return;
    }

    if (body?.status === 'success') {
      const bankresponse = await createBankResponseWebHookService(
        bankResponsePayload,
        payIn.company_id,
        'BOT',
        'zenTechInd',
      );
      logger.info('Bank response created:', bankresponse);
    }
    logger.info('Calling processPayInWebHookService for payload', payload);
    const payin = await processPayInWebHookService(
      payload,
      '',
    );
    logger.info('PayIn processed:', payin);
  } catch (error) {
    logger.error('zenTechInd webhook error:', error);
  }
};
