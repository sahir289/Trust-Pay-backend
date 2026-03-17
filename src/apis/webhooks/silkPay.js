import { transactionWrapper } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createBankResponseWebHookService } from '../bankResponse/bankResponseServices.js';
import { getPayInIntentDao } from '../payIn/payInDao.js';
import { processPayInWebHookService } from '../payIn/payInService.js';
import { generateHash } from '../../intent/createIntentTransaction.js';
import { getBankResponseByUTR } from '../bankResponse/bankResponseDao.js';
import { Status } from '../../constants/index.js';

const processingSet = new Set();

export const silkPayWebhook = async (req, res) => {
  logger.info('silkPayWebhook called', req.body);
  try {
    sendSuccess(res, 200, 'Webhook received successfully');
    const body = req.body;
    const merchantOrderId = body?.mOrderId;
    const utr = body?.utr;
    
    if (processingSet.has(utr)) {
      logger.warn(`Duplicate concurrent webhook skipped for ${utr} and merchantOrderId ${merchantOrderId}`);
      return;
    }

    processingSet.add(utr);

    const hash = generateHash(body, 'silkPay');
    if (hash !== body.sign) {
      logger.error('Invalid hash in silkPay webhook');
      // return;
    }

    // status: 1 = payment successful, anything else = payment failed
    const isSuccess = body?.status === 1 || body?.status === '1';
    
    const payload = {
      merchantOrderId: merchantOrderId,
      userSubmittedUtr: body?.utr,
      amount: Number(body?.amount),
      status: isSuccess ? 'success' : 'failed',
    };
    const payIn = await getPayInIntentDao(merchantOrderId);

    if (payIn.status === Status.SUCCESS) {
      logger.warn(`PayIn already marked as SUCCESS for merchantOrderId ${merchantOrderId} - skipping processing`);
      return;
    }

    const bankResponsePayload = `${body?.amount} nil ${payload.userSubmittedUtr} ${payIn.bank_acc_id}`;

    const utrAlreadyExist = await getBankResponseByUTR(
      payload.userSubmittedUtr,
    );

    if (utrAlreadyExist) {
      logger.warn(
        'Duplicate UTR received in silkPay webhook:',
        payload.userSubmittedUtr,
      );
      return;
    }

    if (isSuccess) {
      const bankResponse = await createBankResponseWebHookService(
        bankResponsePayload,
        payIn.company_id,
        'BOT',
        'silkPay',
      );
      logger.info('Bank response created:', bankResponse);
    }
    logger.info('Calling transactionWrapper for payload', payload);
    const payin = await transactionWrapper(processPayInWebHookService)(
      payload,
      '',
    );

    logger.info('PayIn processed:', payin);
  } catch (error) {
    logger.error('silkPay webhook error:', error);
  } finally {
    processingSet.delete(req.body?.utr);
  }
};
