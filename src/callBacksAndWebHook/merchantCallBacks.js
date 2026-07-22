import axios from 'axios';
import { randomUUID } from 'node:crypto';
import { logger } from '../utils/logger.js';
import { BadRequestError } from '../utils/appErrors.js';
import { assertSafeOutboundUrl } from '../utils/ssrfGuard.js';
import { publishMerchantCallback } from '../rabbitmq/producer.js';
import { generateSignature } from '../utils/signaturegenrate.js';

// When enabled, merchant callbacks are published to a durable RabbitMQ queue
// (retry + DLQ) and delivered by a dedicated consumer, so a slow/failing
// merchant endpoint never ties up the request/cron/worker event loop. When
// disabled (default), or if publishing fails, delivery falls back to the
// original in-process direct send — so behavior is unchanged until the flag is
// flipped and no callback is ever lost.
const CALLBACK_QUEUE_ENABLED =
  String(process.env.CALLBACK_QUEUE_ENABLED || '').toLowerCase() === 'true';

const CALLBACK_TIMEOUT_MS = Number(process.env.CALLBACK_TIMEOUT_MS || 5000);
const CALLBACK_MAX_CONTENT_LENGTH = Number(
  process.env.CALLBACK_MAX_CONTENT_LENGTH || 1 * 1024 * 1024,
);

// HMAC signing of outgoing callbacks. When enabled (and a secret is set), each
// callback carries a timestamped SHA-256 signature so merchants can verify the
// payload originated from us and was not tampered with or replayed. Default off
// => no headers added => behavior is identical to today. The signature is
// computed at actual send time (here), so it is correct for both the direct and
// queued delivery paths and stays fresh across retries; the secret is read from
// the environment and never travels through the queue.
// const CALLBACK_SIGNING_ENABLED =
//   String(process.env.CALLBACK_SIGNING_ENABLED || '').toLowerCase() === 'true';
// const CALLBACK_SIGNING_SECRET = process.env.CALLBACK_SIGNING_SECRET || '';
// const CALLBACK_SIGNATURE_VERSION = 'v1';

/**
 * Builds the request body + headers for a callback. When signing is enabled and
 * a secret is configured, the body is serialized once to the exact bytes that
 * are signed and sent (so the merchant can recompute the HMAC over the received
 * raw body), and signature headers are attached. Otherwise the original object
 * body is returned unchanged with no extra headers.
 *
 * Signature scheme: HMAC-SHA256(secret, `${timestamp}.${rawBody}`), hex.
 * Headers: X-TrustPay-Timestamp, X-TrustPay-Signature (t=<ts>,v1=<sig>).
 */
const buildSignedRequest = (data, secretKey) => {
  // if (!CALLBACK_SIGNING_ENABLED || !CALLBACK_SIGNING_SECRET) {
  //   return { body: data, headers: {} };
  // }

  if (!secretKey) {
    return { body: data, headers: {} };
  }

  const rawBody = typeof data === 'string' ? data : JSON.stringify(data);
  const timestamp = Date.now().toString();

  const signature = generateSignature(secretKey, timestamp, rawBody);

  return {
    body: rawBody,
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Timestamp': timestamp,
      'X-Webhook-Signature': signature,
    },
  };
};

/**
 *
 * v2 merchants receive the standardized envelope used by the API responses
 * (sendSuccess):
 *   { success, statusCode, apiVersion, requestId, timestamp, message, data, meta }
 *
 * v1 merchants receive the original flat payload UNCHANGED,
 */
const buildCallbackEnvelope = (response, type, apiVersion) => {
  const version =
    apiVersion ||
    (response &&
    typeof response === 'object' &&
    ('utrId' in response || 'reqAmount' in response)
      ? 'v2'
      : 'v1');

  // (v1) response: send the raw payload exactly as before.
  if (version !== 'v2') {
    return { ...response, version };
  }

  // v2 response: send the standardized envelope used by the API responses (sendSuccess)
  if (
    response &&
    typeof response === 'object' &&
    response.success === true &&
    'data' in response &&
    'apiVersion' in response
  ) {
    return response;
  }

  const message = `${type} status notification sent successfully`;
  const data = {
    success: true,
    statusCode: 200,
    apiVersion: 'v2',
    requestId: randomUUID(),
    // timestamp: new Date().toISOString(),
    message,
    data: response ?? {},
    meta: { message },
  };

  return data;
};

/**
 * Core HTTP delivery of a merchant notification. THROWS on any failure so the
 * queue consumer can drive retry/DLQ. SSRF-guarded: merchant-supplied notify
 * URLs must not target internal / loopback / link-local / metadata ranges.
 */
export const deliverMerchantNotification = async (
  url,
  data,
  type,
  secretKey,
  apiVersion,
) => {
  try {
    if (!url) {
      logger.error(`No URL provided for ${type} Notification`);
      throw new BadRequestError('Notify Url not found!');
    }

    await assertSafeOutboundUrl(url);

    logger.info(`Sending ${type} Notification to Merchant`, {
      notify_url: url,
      data: data,
    });
    const envelope = buildCallbackEnvelope(data, type, apiVersion);
    const { body, headers } = buildSignedRequest(envelope, secretKey);
    const response = await axios.post(url, body, {
      timeout: CALLBACK_TIMEOUT_MS,
      maxRedirects: 0,
      maxContentLength: CALLBACK_MAX_CONTENT_LENGTH,
      headers,
    });
    logger.info(`${type} Notification Sent Successfully`, {
      //send dat in logs
      status: response?.status,
      url: url,
      data: envelope,
    });
    return response.data;
  } catch (error) {
    logger.error(`Error Notifying Merchant at ${type} URL: ${error.message}`, {
      status: error?.response?.status || 'N/A',
      response: error?.response?.data || {},
      url: url,
      data: data,
    });
    throw error;
  }
};

/**
 * Direct (in-process) delivery wrapper. Never throws — logs and returns an
 * error object — preserving the original fire-and-forget semantics for the
 * non-queued path.
 */
const sendMerchantNotificationDirect = async (
  url,
  data,
  type,
  secretKey,
  apiVersion,
) => {
  try {
    return await deliverMerchantNotification(
      url,
      data,
      type,
      secretKey,
      apiVersion,
    );
  } catch (error) {
    const errorMessage = error?.message || 'Unknown error';
    const statusCode = error?.response?.status || 'N/A';
    const responseData = error?.response?.data || {};

    logger.error(`Error Notifying Merchant at ${type} URL: ${errorMessage}`, {
      status: statusCode,
      response: responseData,
      url: url,
      data: data,
    });
    return {
      message: `Error Notifying Merchant at ${type} URL: ${error.message}`,
    };
  }
};

/**
 * Routes a callback through the durable queue when enabled; otherwise (or if
 * the publish fails) delivers directly so a callback is never lost.
 */
const dispatchMerchantNotification = async (
  url,
  data,
  type,
  secretKey,
  apiVersion,
) => {
  if (CALLBACK_QUEUE_ENABLED) {
    try {
      await publishMerchantCallback({ url, data, type, secretKey, apiVersion });
      logger.info(`[Callback] ${type} notification queued{}`, { url });
      return { queued: true };
    } catch (error) {
      logger.error(
        `[Callback] Enqueue failed for ${type}; falling back to direct send`,
        { error: error.message, url },
      );
      // fall through to direct delivery below
    }
  }

  return sendMerchantNotificationDirect(url, data, type, secretKey, apiVersion);
};

export const merchantPayinCallback = async (url, data, secretKey, apiVersion) =>
  dispatchMerchantNotification(url, data, 'Payin', secretKey, apiVersion);
export const merchantPayoutCallback = async (
  url,
  data,
  secretKey,
  apiVersion,
) => dispatchMerchantNotification(url, data, 'Payout', secretKey, apiVersion);
