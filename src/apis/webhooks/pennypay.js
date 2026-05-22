import { logger } from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createBankResponseWebHookService } from '../bankResponse/bankResponseServices.js';
import { getPayInIntentDao } from '../payIn/payInDao.js';
import { processPayInWebHookService } from '../payIn/payInService.js';
import { getBankResponseByUTR } from '../bankResponse/bankResponseDao.js';
import { Status } from '../../constants/index.js';
import { acquireLock, releaseLock } from '../../utils/distributedLock.js';

export const pennyPayWebhook = async (req, res) => {
  logger.info('pennyPayWebhook called', req.body);
  let utr = null;

  try {
    sendSuccess(res, 200, 'Webhook received successfully');

    const body = req.body;
    const responseData = body?.data; 
    
    if (!responseData) {
      logger.error('[PennyPay] Missing data object in webhook body');
      return;
    }

    const statusFromGateway = responseData?.status;
    const merchantOrderId = responseData?.merchantOrderId;
    utr = responseData?.utr_id?.trim(); 

    if (statusFromGateway !== 'SUCCESS') {
      logger.info(`[PennyPay] Skipping webhook processing. Status is ${statusFromGateway} for merchantOrderId ${merchantOrderId}`);
      return;
    }

    if (!utr) {
      logger.error(`[PennyPay] UTR missing or empty for successful transaction. merchantOrderId: ${merchantOrderId}`);
      return;
    }

    const lockAcquired = await acquireLock(utr, 'pennyPay');
    if (!lockAcquired) {
      logger.warn(`Duplicate concurrent webhook skipped for UTR: ${utr} and merchantOrderId: ${merchantOrderId}`);
      return;
    }

    const payload = {
      merchantOrderId: merchantOrderId,
      userSubmittedUtr: utr,
      amount: Number(responseData?.amount || responseData?.req_amount), // Fallback to req_amount if amount is missing
      status: statusFromGateway, 
    };

    logger.info(`[PennyPay] Fetching PayIn for merchantOrderId: ${merchantOrderId}`);
    const payIn = await getPayInIntentDao(merchantOrderId);

    if (!payIn) {
      logger.error(`[PennyPay] PayIn not found for merchantOrderId: ${merchantOrderId}`);
      return;
    }

    logger.info(`[PennyPay] PayIn fetched:`, {
      merchantOrderId,
      status: payIn.status,
      bank_acc_id: payIn.bank_acc_id,
      company_id: payIn.company_id,
    });

    // Agar humare DB mein pehle se hi SUCCESS hai toh processing skip karein
    if (payIn.status === Status.SUCCESS) {
      logger.warn(`PayIn already marked as SUCCESS for merchantOrderId ${merchantOrderId} - skipping processing`);
      return;
    }

    // Check duplicate UTR in bank responses
    logger.info(`[PennyPay] Checking for existing UTR in DB: ${payload.userSubmittedUtr}`);
    const utrAlreadyExist = await getBankResponseByUTR(payload.userSubmittedUtr);

    if (utrAlreadyExist) {
      logger.warn(`Duplicate UTR received in PennyPay webhook: ${payload.userSubmittedUtr}`);
      return;
    }

    logger.info(`[PennyPay] UTR check passed, proceeding with processing`);

    // Bank Response entries create karna (Kyunki status pakka SUCCESS hai)
    const bankResponsePayload = `${payload.amount} nil ${payload.userSubmittedUtr} ${payIn.bank_acc_id}`;
    logger.info(`[PennyPay] Creating bank response for approved transaction`);
    
    const bankResponse = await createBankResponseWebHookService(
      bankResponsePayload,
      payIn.company_id,
      'BOT',
      'pennyPay',
    );
    logger.info('Bank response created:', bankResponse);

    // Final entry process karna system mein
    logger.info('Calling transactionWrapper for payload', payload);
    const payinProcessed = await processPayInWebHookService(payload, '');

    logger.info('PayIn processed successfully:', payinProcessed);
  } catch (error) {
    logger.error('[PennyPay] Webhook processing error:', {
      message: error.message,
      stack: error.stack,
      utr: utr,
    });
  } finally {
    // Finallly block mein lock release karna zaroori hai
    if (utr) {
      await releaseLock(utr, 'pennyPay');
    }
  }
};