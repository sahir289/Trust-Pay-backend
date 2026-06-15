import crypto from 'crypto';
import { logger } from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createBankResponseWebHookService } from '../bankResponse/bankResponseServices.js';
import { getPayInByClientRefNoDao } from '../payIn/payInDao.js';
import { processPayInWebHookService } from '../payIn/payInService.js';
import { getBankResponseByUTR } from '../bankResponse/bankResponseDao.js';
import { acquireLock, releaseLock } from '../../utils/distributedLock.js';
import { getConnection, beginTransaction, commit, rollback } from '../../utils/db.js';

// Freechips se mile credentials yahan set karein (Environment variables use karna best rahega)
const SECRET_KEY = process.env.FREECHIPS_SECRET_KEY || 'your_secret_key_16bytes'; // Must be 16 bytes/chars for AES-256 key derivation padding or direct key
const SECRET_IV = process.env.FREECHIPS_SECRET_IV || 'your_secret_iv_16bytes';   // Must be 16 bytes

/**
 * Freechips AES-256-CBC Decryption Helper
 */
const decryptFreechipsData = (encryptedDataBase64) => {
  try {
    // 1. Key aur IV ko buffers me convert karein
    // Note: Agar Freechips ne 32-byte key di hai toh direct use karein, agar 16-byte hai toh md5/sha256 hashing lag sakti hai.
    // Standard AES-256-CBC 32-byte key aur 16-byte IV expect karta hai.
    const key = Buffer.from(SECRET_KEY, 'utf-8');
    const iv = Buffer.from(SECRET_IV, 'utf-8');

    // 2. Decipher initialize karein
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    // 3. Base64 encrypted string ko decrypt karein[cite: 1]
    let decrypted = decipher.update(encryptedDataBase64, 'base64', 'utf-8');
    decrypted += decipher.final('utf-8');

    // 4. Decrypted string JSON hoti hai, use parse karke return karein[cite: 1]
    return JSON.parse(decrypted);
  } catch (error) {
    logger.error('Error decrypting Freechips data:', error);
    return null;
  }
};

export const freechipsWebhook = async (req, res) => {
  let lockKey;
  let conn;
  let committed = false;
  try {
    // 1. Pehle response send kar dein taaki unka webhook timeout na ho
    sendSuccess(res, {}, 'Webhook received successfully');

    const body = req.body || {};
    
    // Freechips documentation ke mutabik data 'data' key me encrypted hota hai[cite: 1]
    if (!body.data) {
      logger.warn('Invalid Freechips webhook payload structure:', body);
      return;
    }

    // Decrypt the data block using crypto
    const decryptedData = decryptFreechipsData(body.data);
    
    if (!decryptedData) {
      logger.error('Failed to decrypt Freechips webhook payload');
      return;
    }

    // Freechips response keys mapping[cite: 1]
    const clientRefNo = decryptedData?.orderId; 
    const utr = decryptedData?.utr;
    const amount = decryptedData?.amount ? Number(decryptedData.amount) : undefined;
    const status = decryptedData?.status; 
    
    lockKey = utr || clientRefNo;

    if (!clientRefNo || !utr) {
      logger.warn('Invalid Freechips webhook decrypted payload missing orderId or utr:', decryptedData);
      return;
    }

    // 2. Lock check for concurrency
    const lockAcquired = await acquireLock(lockKey, 'freechips');
    if (!lockAcquired) {
      logger.warn(
        `Duplicate concurrent webhook skipped for ${lockKey} and clientRefNo ${clientRefNo}`,
      );
      return;
    }

    // 3. Database connection & transaction start
    conn = await getConnection();
    await beginTransaction(conn);
    
    const payIn = await getPayInByClientRefNoDao(clientRefNo, conn);
    if (!payIn) {
      logger.warn(
        `PayIn not found for Freechips webhook clientRefNo (orderId): ${clientRefNo}`,
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

    // 4. Duplicate UTR check
    const utrAlreadyExist = await getBankResponseByUTR(payload.userSubmittedUtr, conn);
    if (utrAlreadyExist) {
      logger.warn(
        'Duplicate UTR received in Freechips webhook:',
        payload.userSubmittedUtr,
      );
      await commit(conn);
      committed = true;
      return;
    }

    // 5. If status is SUCCESS, create Bank Response[cite: 1]
    if (String(status || '').toUpperCase() === 'SUCCESS') {
      const bankResponsePayload = `${payload.amount} nil ${payload.userSubmittedUtr} ${payIn.bank_acc_id}`;
      const bankResponse = await createBankResponseWebHookService(
        bankResponsePayload,
        payIn.company_id,
        'BOT',
        'freechips',
        conn,
      );
      logger.info('Bank response created for Freechips:', bankResponse);
    }
    
    // 6. Process the PayIn Service
    logger.info('Calling processPayInWebHookService for Freechips payload', payload);
    const payin = await processPayInWebHookService(payload, '', conn);
    logger.info('PayIn processed from Freechips webhook:', payin?.id);
    
    await commit(conn);
    committed = true;
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn);
    }
    logger.error('Freechips webhook error:', error);
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseErr) {
        logger.error('Error releasing DB connection:', releaseErr);
      }
    }
    if (lockKey) {
      await releaseLock(lockKey, 'freechips');
    }
  }
};