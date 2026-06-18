import crypto from 'node:crypto';
import { logger } from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createBankResponseWebHookService } from '../bankResponse/bankResponseServices.js';
import { getPayInIntentDao } from '../payIn/payInDao.js';
import { processPayInWebHookService } from '../payIn/payInService.js';
import { getBankResponseByUTR } from '../bankResponse/bankResponseDao.js';
import { Status } from '../../constants/index.js';
import config from '../../config/config.js';
import { acquireLock, releaseLock } from '../../utils/distributedLock.js';

/**
 * Decrypt AES-256-CBC encrypted data from PayEasy webhook
 * @param {string} encryptionKey - Hex encoded encryption key
 * @param {Object} encryptedObj - Object containing iv and encryptedData
 * @returns {Object} Decrypted JSON payload
 */
function decryptPayEasy03Data(encryptionKey, encryptedObj) {
  const keyBuffer = Buffer.from(encryptionKey, 'hex');
  const ivBuffer = Buffer.from(encryptedObj.iv, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, ivBuffer);

  let decrypted = decipher.update(encryptedObj.encryptedData, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');

  return JSON.parse(decrypted);
}

export const payEasy03Webhook = async (req, res) => {
  logger.info('payEasy03Webhook called', req.body);
  let utr = null;

  try {
    sendSuccess(res, 200, 'Webhook received successfully');

    const { iv, encryptedData } = req.body;

    if (!iv || !encryptedData) {
      logger.error('Missing iv or encryptedData in payEasy03 webhook');
      return;
    }

    const encryptionKey = config.payeasy03?.encryptionKey;
    const body = decryptPayEasy03Data(encryptionKey, { iv, encryptedData });

    logger.info('Decrypted payEasy03 webhook body:', body);

    const merchantOrderId = body?.orderId;
    utr = body?.utr;
    
    const lockAcquired = await acquireLock(utr, 'payEasy03');
    if (!lockAcquired) {
      logger.warn(`Duplicate concurrent webhook skipped for ${utr} and merchantOrderId ${merchantOrderId}`);
      return;
    }

    // status: 'approved' = payment successful, 'rejected' = payment failed
    const isSuccess = body?.status === 'approved';

    const payload = {
      merchantOrderId: merchantOrderId,
      userSubmittedUtr: body?.utr,
      amount: Number(body?.amount),
      status: isSuccess ? 'success' : 'failed',
    };

    logger.info(
      `[PayEasy03] Fetching PayIn for merchantOrderId: ${merchantOrderId}`,
    );
    const payIn = await getPayInIntentDao(merchantOrderId);

    if (!payIn) {
      logger.error(
        `[PayEasy03] PayIn not found for merchantOrderId: ${merchantOrderId}`,
      );
      return;
    }

    logger.info(`[PayEasy03] PayIn fetched:`, {
      merchantOrderId,
      status: payIn.status,
      bank_acc_id: payIn.bank_acc_id,
      company_id: payIn.company_id,
    });

    if (payIn.status === Status.SUCCESS) {
      logger.warn(
        `PayIn already marked as SUCCESS for merchantOrderId ${merchantOrderId} - skipping processing`,
      );
      return;
    }

    const bankResponsePayload = `${body?.amount} nil ${payload.userSubmittedUtr} ${payIn.bank_acc_id}`;

    logger.info(
      `[PayEasy03] Checking for existing UTR: ${payload.userSubmittedUtr}`,
    );
    const utrAlreadyExist = await getBankResponseByUTR(
      payload.userSubmittedUtr,
    );

    if (utrAlreadyExist) {
      logger.warn(
        'Duplicate UTR received in payEasy03 webhook:',
        payload.userSubmittedUtr,
      );
      return;
    }

    logger.info(`[PayEasy03] UTR check passed, proceeding with processing`);

    if (isSuccess) {
      logger.info(
        `[PayEasy03] Creating bank response for approved transaction`,
      );
      const bankResponse = await createBankResponseWebHookService(
        bankResponsePayload,
        payIn.company_id,
        'BOT',
        'payEasy03',
      );
      logger.info('Bank response created:', bankResponse);
    }

    logger.info('Calling transactionWrapper for payload', payload);
    const payin = await processPayInWebHookService(payload, '');

    logger.info('PayIn processed:', payin);
  } catch (error) {
    logger.error('[PayEasy03] Webhook processing error:', {
      message: error.message,
      stack: error.stack,
      utr: utr,
    });
  } finally {
    if (utr) {
      await releaseLock(utr, 'payEasy03');
    }
  }
};
