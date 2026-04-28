import { logger } from '../../utils/logger.js';
import crypto from 'node:crypto';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createBankResponseWebHookService } from '../bankResponse/bankResponseServices.js';
import { getPayInIntentDao } from '../payIn/payInDao.js';
import { processPayInWebHookService } from '../payIn/payInService.js';
import { getBankResponseByUTR } from '../bankResponse/bankResponseDao.js';
import { acquireLock, releaseLock } from '../../utils/distributedLock.js';
import { getConnection, beginTransaction, commit, rollback } from '../../utils/db.js';

/**
 * Generic PayIn Webhook Handler Factory
 * @param {string} providerKey - Provider identifier (e.g., 'razorpay', 'nmplPay')
 * @param {object} config - Config object with extraction/validation logic
 */
export const createGenericPayInWebhookHandler = (providerKey, config) => async (req, res) => {
    let utr = null;
    let conn;
    let committed = false;
    try {
      sendSuccess(res, 200, 'Webhook received successfully');
      let body;
      // Special handling for PayEasy variants
      if (/^payeasy\d*$/.test(providerKey)) {
        const { iv, encryptedData } = req.body;
        if (!iv || !encryptedData) {
          logger.error(`Missing iv or encryptedData in ${providerKey} webhook`);
          return;
        }
        const encryptionKey = config.encryptionKey;
        if (!encryptionKey) {
          logger.error(`Missing encryption key for ${providerKey}`);
          return;
        }
        const keyBuffer = Buffer.from(encryptionKey, 'hex');
        const ivBuffer = Buffer.from(iv, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, ivBuffer);
        let decrypted = decipher.update(encryptedData, 'hex', 'utf-8');
        decrypted += decipher.final('utf-8');
        body = JSON.parse(decrypted);
      } else {
        body = config.getBody(req);
      }
      const merchantOrderId = /^payeasy\d*$/.test(providerKey)
        ? body?.orderId
        : config.getMerchantOrderId(body);
      utr = /^payeasy\d*$/.test(providerKey)
        ? body?.utr
        : config.getUtr(body);
      const lockKey = /^payeasy\d*$/.test(providerKey) ? `payEasy${providerKey.replace('payeasy', '')}` : providerKey;
      const lockAcquired = await acquireLock(utr, lockKey);
      if (!lockAcquired) {
        logger.warn(`Duplicate concurrent webhook skipped for ${utr} and merchantOrderId ${merchantOrderId}`);
        return;
      }
      if (config.verify && !/^payeasy\d*$/.test(providerKey) && !config.verify(body, req)) {
        logger.error(`Verification failed for ${providerKey} webhook`);
        return;
      }
      const isSuccess = /^payeasy\d*$/.test(providerKey)
        ? body?.status === 'approved'
        : config.getStatus(body) === 'success';
      const payload = {
        merchantOrderId,
        userSubmittedUtr: utr,
        amount: /^payeasy\d*$/.test(providerKey) ? Number(body?.amount) : config.getAmount(body),
        status: isSuccess ? 'success' : 'failed',
      };
      try {
        conn = await getConnection();
        await beginTransaction(conn);
        const payIn = await getPayInIntentDao(merchantOrderId, conn);
        if (!payIn) {
          logger.error(`[${providerKey}] PayIn not found for merchantOrderId: ${merchantOrderId}`);
          await commit(conn); committed = true;
          return;
        }
        const bankResponsePayload = `${payload.amount} nil ${payload.userSubmittedUtr} ${payIn.bank_acc_id}`;
        const utrAlreadyExist = await getBankResponseByUTR(payload.userSubmittedUtr, conn);
        if (utrAlreadyExist) {
          logger.warn(`Duplicate UTR received in ${providerKey} webhook:`, payload.userSubmittedUtr);
          await commit(conn); committed = true;
          return;
        }
        if (payload.status === 'success') {
          await createBankResponseWebHookService(
            bankResponsePayload,
            payIn.company_id,
            'BOT',
            providerKey,
            conn
          );
        }
        await processPayInWebHookService(payload, '', conn);
        logger.info('PayIn processed:', payload);
        await commit(conn); committed = true;
      } catch (error) {
        if (conn && !committed) await rollback(conn);
        throw error;
      } finally {
        if (conn) conn.release();
      }
    } catch (error) {
      logger.error(`${providerKey} webhook error:`, error);
    } finally {
      if (utr) await releaseLock(utr, providerKey);
    }
  };
