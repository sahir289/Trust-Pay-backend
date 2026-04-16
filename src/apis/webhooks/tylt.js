import crypto from 'crypto';
import { logger } from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { publishPayInProcess } from '../../rabbitmq/producer.js';
import redisClient from '../../utils/redisClient.js';

const DEDUP_TTL_SECONDS = 3600; // 1 hour

/**
 * Verify Tylt webhook signature.
 * Tylt signs the raw JSON body with HMAC-SHA256 using the API secret.
 */
const verifyTyltSignature = (rawBody, receivedSignature) => {
  const expected = crypto
    .createHmac('sha256', process.env.TYLT_API_SECRET)
    .update(rawBody)
    .digest('hex');
  return expected === receivedSignature;
};

export const tyltWebhook = async (req, res) => {
  const rawBodyStringified = JSON.stringify(req.body);
  const merchantOrderId = req.body?.data?.merchantOrderId || req.body?.transaction?.merchantOrderId;

  logger.info('[Tylt][Webhook] Received', { merchantOrderId });

  // Respond immediately so Tylt does not time out waiting for us
  res.status(200).send('ok');

  try {
    // --- STEP 2: Replay protection via Redis dedup ---
    const bodyHash = crypto.createHash('sha256').update(rawBodyStringified).digest('hex');
    const dedupKey = `tylt:webhook:dedup:${bodyHash}`;

    const alreadySeen = await redisClient.set(dedupKey, '1', 'EX', DEDUP_TTL_SECONDS, 'NX');
    if (alreadySeen === null) {
      // NX returns null when the key already exists
      logger.warn('[Tylt][Webhook] TYLT_DUPLICATE_BLOCKED — replay detected, dropping', {
        merchantOrderId,
        bodyHash,
      });
      return;
    }

    // --- Signature verification ---
    const signature = req.headers['x-tlp-signature'];
    if (signature) {
      const isValid = verifyTyltSignature(rawBodyStringified, signature);
      if (!isValid) {
        logger.error('[Tylt][Webhook] Invalid signature — proceeding for audit', {
          merchantOrderId,
        });
      }
    } else {
      logger.warn('[Tylt][Webhook] No X-TLP-SIGNATURE header received', { merchantOrderId });
    }

    // --- Enqueue for processing ---
    await publishPayInProcess({
      provider: 'tylt',
      payload: req.body,
    });

    logger.info('[Tylt][Webhook] Payload queued successfully', { merchantOrderId });
  } catch (error) {
    logger.error('[Tylt][Webhook] Error after response sent', {
      merchantOrderId,
      error: error.message,
    });
  }
};
