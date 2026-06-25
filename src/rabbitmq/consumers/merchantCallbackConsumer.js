import { logger } from '../../utils/logger.js';
import { deliverMerchantNotification } from '../../callBacksAndWebHook/merchantCallBacks.js';
import { rabbitMQConnectionManager } from '../connection.js';
import { assertQueueTopology, TOPOLOGY } from '../topology.js';
import {
  recordDeliveryAttempt,
  DeliveryChannel,
  DeliveryOutcome,
} from '../../utils/deliveryAttemptLog.js';

const PREFETCH_COUNT = Number(process.env.MERCHANT_CALLBACK_PREFETCH || 20);
const MAX_RETRIES = Number(process.env.MERCHANT_CALLBACK_MAX_RETRIES || 5);

let channel = null;
let consumerTag = null;
let unsubscribeReconnect = null;
let stopping = false;

function getRetryCount(msg) {
  return Number(msg?.properties?.headers?.['x-retry-count'] || 0);
}

function elapsedMs(startedAt) {
  return Number((process.hrtime.bigint() - startedAt) / 1000000n);
}

async function processCallbackJob(messagePayload) {
  const { url, data, type } = messagePayload || {};

  if (!url) {
    throw new Error('Invalid merchant callback message: missing url');
  }

  // deliverMerchantNotification THROWS on failure, which drives retry/DLQ.
  await deliverMerchantNotification(url, data, type || 'Callback');
}

async function handleMessage(msg) {
  if (!msg || stopping) {
    return;
  }

  const retryCount = getRetryCount(msg);
  const startedAt = process.hrtime.bigint();
  let payload = null;

  try {
    payload = JSON.parse(msg.content.toString());

    await processCallbackJob(payload);
    channel.ack(msg);

    await recordDeliveryAttempt({
      channel: DeliveryChannel.MERCHANT_CALLBACK,
      reference: payload?.url || null,
      type: payload?.type || null,
      attempt: retryCount,
      outcome: DeliveryOutcome.SUCCESS,
      durationMs: elapsedMs(startedAt),
    });

    logger.info('[RabbitMQ][MerchantCallback] Message processed', {
      retryCount,
      type: payload?.type,
      url: payload?.url,
    });
  } catch (error) {
    await recordDeliveryAttempt({
      channel: DeliveryChannel.MERCHANT_CALLBACK,
      reference: payload?.url || null,
      type: payload?.type || null,
      attempt: retryCount,
      outcome: DeliveryOutcome.FAILURE,
      statusCode: error?.response?.status ?? null,
      error: error.message,
      durationMs: elapsedMs(startedAt),
    });

    logger.error('[RabbitMQ][MerchantCallback] Delivery failed', {
      retryCount,
      error: error.message,
    });

    if (retryCount < MAX_RETRIES && channel) {
      const headers = msg.properties.headers
        ? { ...msg.properties.headers }
        : undefined;

      channel.sendToQueue(TOPOLOGY.merchantCallback.retryQueue, msg.content, {
        persistent: true,
        contentType: 'application/json',
        headers: {
          ...headers,
          'x-retry-count': retryCount + 1,
        },
      });
      channel.ack(msg);
      logger.warn('[RabbitMQ][MerchantCallback] Message scheduled for retry', {
        retryCount: retryCount + 1,
        retryQueue: TOPOLOGY.merchantCallback.retryQueue,
        retryDelayMs: TOPOLOGY.merchantCallback.retryDelayMs,
      });
      return;
    }

    if (channel) {
      channel.nack(msg, false, false);
    }
  }
}

async function subscribe() {
  channel = await rabbitMQConnectionManager.createChannel();
  await assertQueueTopology(channel, TOPOLOGY.merchantCallback);
  await channel.prefetch(PREFETCH_COUNT);

  const result = await channel.consume(
    TOPOLOGY.merchantCallback.queue,
    handleMessage,
    {
      noAck: false,
    },
  );

  consumerTag = result.consumerTag;

  logger.info('[RabbitMQ][MerchantCallback] Consumer started', {
    queue: TOPOLOGY.merchantCallback.queue,
    prefetch: PREFETCH_COUNT,
  });
}

export async function startMerchantCallbackConsumer() {
  stopping = false;
  await subscribe();

  if (!unsubscribeReconnect) {
    unsubscribeReconnect = rabbitMQConnectionManager.onReconnect(async () => {
      if (stopping) return;
      await subscribe();
    });
  }
}

export async function stopMerchantCallbackConsumer() {
  stopping = true;

  if (unsubscribeReconnect) {
    unsubscribeReconnect();
    unsubscribeReconnect = null;
  }

  if (channel && consumerTag) {
    try {
      await channel.cancel(consumerTag);
    } catch {
      // no-op
    }
  }

  if (channel) {
    try {
      await channel.close();
    } catch {
      // no-op
    }
    channel = null;
    consumerTag = null;
  }

  logger.info('[RabbitMQ][MerchantCallback] Consumer stopped');
}
