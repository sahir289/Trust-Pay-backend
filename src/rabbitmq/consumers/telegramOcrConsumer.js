import { logger } from '../../utils/logger.js';
import { telegramResponseService } from '../../apis/payIn/payInService.js';
import { rabbitMQConnectionManager } from '../connection.js';
import { assertQueueTopology, TOPOLOGY } from '../topology.js';
import {
  recordDeliveryAttempt,
  DeliveryChannel,
  DeliveryOutcome,
} from '../../utils/deliveryAttemptLog.js';

// OCR is CPU/IO-heavy (external OCR call + DB transaction). Keep concurrency
// modest and retries low: telegramResponseService is idempotent against
// double-crediting (status / is_used / is_notified guards roll back), but each
// reprocess re-sends Telegram chat messages, so we avoid excessive retries.
const PREFETCH_COUNT = Number(process.env.TELEGRAM_OCR_PREFETCH || 4);
const MAX_RETRIES = Number(process.env.TELEGRAM_OCR_MAX_RETRIES || 3);

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

async function processOcrJob(messagePayload) {
  const { message } = messagePayload || {};

  if (!message || typeof message !== 'object') {
    throw new Error('Invalid telegram OCR job: missing message');
  }

  // telegramResponseService THROWS on a genuine error (OCR/DB), driving
  // retry/DLQ. Expected "not found / already confirmed" cases return normally.
  await telegramResponseService(message);
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

    await processOcrJob(payload);
    channel.ack(msg);

    await recordDeliveryAttempt({
      channel: DeliveryChannel.TELEGRAM_OCR,
      reference: payload?.message?.caption || null,
      attempt: retryCount,
      outcome: DeliveryOutcome.SUCCESS,
      durationMs: elapsedMs(startedAt),
    });

    logger.info('[RabbitMQ][TelegramOcr] Message processed', {
      retryCount,
      caption: payload?.message?.caption,
    });
  } catch (error) {
    await recordDeliveryAttempt({
      channel: DeliveryChannel.TELEGRAM_OCR,
      reference: payload?.message?.caption || null,
      attempt: retryCount,
      outcome: DeliveryOutcome.FAILURE,
      statusCode: error?.response?.status ?? null,
      error: error.message,
      durationMs: elapsedMs(startedAt),
    });

    logger.error('[RabbitMQ][TelegramOcr] Processing failed', {
      retryCount,
      error: error.message,
    });

    if (retryCount < MAX_RETRIES && channel) {
      const headers = msg.properties.headers
        ? { ...msg.properties.headers }
        : undefined;

      channel.sendToQueue(TOPOLOGY.telegramOcr.retryQueue, msg.content, {
        persistent: true,
        contentType: 'application/json',
        headers: {
          ...headers,
          'x-retry-count': retryCount + 1,
        },
      });
      channel.ack(msg);
      logger.warn('[RabbitMQ][TelegramOcr] Message scheduled for retry', {
        retryCount: retryCount + 1,
        retryQueue: TOPOLOGY.telegramOcr.retryQueue,
        retryDelayMs: TOPOLOGY.telegramOcr.retryDelayMs,
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
  await assertQueueTopology(channel, TOPOLOGY.telegramOcr);
  await channel.prefetch(PREFETCH_COUNT);

  const result = await channel.consume(
    TOPOLOGY.telegramOcr.queue,
    handleMessage,
    {
      noAck: false,
    },
  );

  consumerTag = result.consumerTag;

  logger.info('[RabbitMQ][TelegramOcr] Consumer started', {
    queue: TOPOLOGY.telegramOcr.queue,
    prefetch: PREFETCH_COUNT,
  });
}

export async function startTelegramOcrConsumer() {
  stopping = false;
  await subscribe();

  if (!unsubscribeReconnect) {
    unsubscribeReconnect = rabbitMQConnectionManager.onReconnect(async () => {
      if (stopping) return;
      await subscribe();
    });
  }
}

export async function stopTelegramOcrConsumer() {
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

  logger.info('[RabbitMQ][TelegramOcr] Consumer stopped');
}
