import crypto from 'crypto';
import { logger } from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createBankResponseWebHookService } from '../bankResponse/bankResponseServices.js';
import { getPayInIntentDao } from '../payIn/payInDao.js';
import { processPayInWebHookService } from '../payIn/payInService.js';
import { getBankResponseByUTR } from '../bankResponse/bankResponseDao.js';
import { acquireLock, releaseLock } from '../../utils/distributedLock.js';
import {
  getConnection,
  beginTransaction,
  commit,
  rollback,
} from '../../utils/db.js';
import config from '../../config/config.js';
const decryptFreechipsData = (encryptedData) => {
  const SECRET_KEY = config.freechips.secretKey;
  const SECRET_IV = config.freechips.secretIv;
  if (!encryptedData || !SECRET_KEY || !SECRET_IV) {
    logger.error('Freechips decrypt failed: missing key, iv or data');
    return null;
  }
  try {
    const key = Buffer.from(SECRET_KEY, 'utf8');
    const iv = Buffer.from(SECRET_IV, 'utf8');

    logger.info('Freechips decrypt config', {
      keyLength: key.length,
      ivLength: iv.length,
      encryptedLength: encryptedData.length
    });
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    decipher.setAutoPadding(true);
    let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    logger.info('Freechips decrypted raw:', decrypted);
    return JSON.parse(decrypted);
  } catch (error) {
    logger.error('Freechips decryption error', {
      message: error.message,
      stack: error.stack,
      encryptedSample: encryptedData?.substring(0, 50)
    });
    return null;
  }
};

export const freechipsWebhook = async (req, res) => {
  let lockKey = null;
  let conn = null;
  let committed = false;
  try {
    sendSuccess(res, {}, 'FreeChips Webhook received successfully');

    const body = req.body || {};
    logger.info('Raw Freechips webhook payload', body);
    if (!body.data) {
      logger.warn('Invalid Freechips webhook payload structure:', body);
      return;
    }

    const decryptedData = decryptFreechipsData(body.data);
    if (!decryptedData) {
      logger.error('Failed to decrypt Freechips webhook payload');
      return;
    }
    logger.info('Decrypted Freechips webhook data', decryptedData);
    console.log('Decrypted Freechips webhook data', decryptedData);
    const rawOrderId = decryptedData?.data?.systemId;
    const utr = decryptedData?.data?.transactionUtr;
    const amount = decryptedData?.data?.amount ? Number(decryptedData?.data?.amount) : undefined;
    const status = String(decryptedData?.data?.status || '').trim().toUpperCase();
    logger.info(`Freechips webhook received - Order: ${rawOrderId}, Status: ${status}, UTR: ${utr}, Amount: ${amount}`);
    if (status !== 'SUCCESS') {
      logger.info(`Skipping processing for non-success status: ${status} in Freechips webhook for Order: ${rawOrderId}`);
      return;
    }
    if (!rawOrderId || !utr) {
      logger.warn('Invalid Freechips webhook payload. Missing orderId or utr', decryptedData);
      return;
    }

    lockKey = utr || rawOrderId;

    const lockAcquired = await acquireLock(lockKey, 'freechips');
    if (!lockAcquired) {
      logger.warn(`Duplicate concurrent webhook skipped for ${lockKey}`);
      return;
    }

    conn = await getConnection();
    await beginTransaction(conn);
    const payIn = await getPayInIntentDao(rawOrderId);
    if (!payIn) {
      logger.warn(`PayIn not found for Freechips webhook orderId: ${rawOrderId}`);
      await commit(conn);
      committed = true;
      return;
    }
    const merchantOrderId = payIn.merchant_order_id;

    const utrAlreadyExist = await getBankResponseByUTR(utr, conn);
    if (utrAlreadyExist) {
      logger.warn(`Duplicate UTR received in Freechips webhook: ${utr}`);
      await commit(conn);
      committed = true;
      return;
    }
    console.log(payIn, 'payIn details for Freechips webhook');

    const bankResponsePayload = `${amount || payIn.amount} nil ${utr} ${payIn.bank_acc_id}`;
    const bankResponse = await createBankResponseWebHookService(
      bankResponsePayload,
      payIn.company_id,
      'BOT',
      'freechips',
      conn
    );
    logger.info('Bank response created for Freechips', bankResponse);
    const payload = {
      merchantOrderId,
      userSubmittedUtr: utr,
      amount: amount || payIn.amount,
      status: 'SUCCESS'
    };
    logger.info('Calling processPayInWebHookService for Freechips', payload);
    const processedPayIn = await processPayInWebHookService(payload, '', conn);
    logger.info('PayIn processed successfully from Freechips webhook', processedPayIn?.id);
    await commit(conn);
    committed = true;
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn);
    }
    logger.error('Freechips webhook error', error);
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseErr) {
        logger.error('Error releasing DB connection', releaseErr);
      }
    }
    if (lockKey) {
      await releaseLock(lockKey, 'freechips');
    }
  }
};