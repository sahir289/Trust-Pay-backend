import { logger } from '../../utils/logger.js';
import { deliverTelegramMessage } from '../../helpers/telegramApi.js';
import { rabbitMQConnectionManager } from '../connection.js';
import { assertQueueTopology, TOPOLOGY } from '../topology.js';
import {
  recordDeliveryAttempt,
  DeliveryChannel,
  DeliveryOutcome,
} from '../../utils/deliveryAttemptLog.js';

// Telegram enforces strict rate limits (~30 msg/s global, ~1 msg/s per chat).
// Keep prefetch at 1 and add a small spacing delay after each send so the
// consumer never bursts faster than the original in-process sender did.
const PREFETCH_COUNT = Number(process.env.TELEGRAM_MESSAGE_PREFETCH || 1);
const MAX_RETRIES = Number(process.env.TELEGRAM_MESSAGE_MAX_RETRIES || 5);
const RATE_LIMIT_MS = Number(process.env.TELEGRAM_MESSAGE_RATE_LIMIT_MS || 500);

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

async function processTelegramJob(messagePayload) {
  const { chatId, message, replyToMessageId, token } = messagePayload || {};

  if (!chatId || !message) {
    throw new Error('Invalid telegram message: missing chatId or message');
  }

  // deliverTelegramMessage THROWS on failure (incl. 429), driving retry/DLQ.
  await deliverTelegramMessage(chatId, message, replyToMessageId, token);
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

    await processTelegramJob(payload);
    channel.ack(msg);

    await recordDeliveryAttempt({
      channel: DeliveryChannel.TELEGRAM_MESSAGE,
      reference: payload?.chatId ? String(payload.chatId) : null,
      attempt: retryCount,
      outcome: DeliveryOutcome.SUCCESS,
      durationMs: elapsedMs(startedAt),
    });

    logger.info('[RabbitMQ][TelegramMessage] Message processed', {
      retryCount,
      chatId: payload?.chatId,
    });

    // Space out sends to respect Telegram rate limits.
    if (RATE_LIMIT_MS > 0) {
      await new Promise((res) => setTimeout(res, RATE_LIMIT_MS));
    }
  } catch (error) {
    await recordDeliveryAttempt({
      channel: DeliveryChannel.TELEGRAM_MESSAGE,
      reference: payload?.chatId ? String(payload.chatId) : null,
      attempt: retryCount,
      outcome: DeliveryOutcome.FAILURE,
      statusCode: error?.response?.status ?? null,
      error: error.message,
      durationMs: elapsedMs(startedAt),
    });

    logger.error('[RabbitMQ][TelegramMessage] Delivery failed', {
      retryCount,
      error: error.message,
    });

    if (retryCount < MAX_RETRIES && channel) {
      const headers = msg.properties.headers
        ? { ...msg.properties.headers }
        : undefined;

      channel.sendToQueue(TOPOLOGY.telegramMessage.retryQueue, msg.content, {
        persistent: true,
        contentType: 'application/json',
        headers: {
          ...headers,
          'x-retry-count': retryCount + 1,
        },
      });
      channel.ack(msg);
      logger.warn('[RabbitMQ][TelegramMessage] Message scheduled for retry', {
        retryCount: retryCount + 1,
        retryQueue: TOPOLOGY.telegramMessage.retryQueue,
        retryDelayMs: TOPOLOGY.telegramMessage.retryDelayMs,
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
  await assertQueueTopology(channel, TOPOLOGY.telegramMessage);
  await channel.prefetch(PREFETCH_COUNT);

  const result = await channel.consume(
    TOPOLOGY.telegramMessage.queue,
    handleMessage,
    {
      noAck: false,
    },
  );

  consumerTag = result.consumerTag;

  logger.info('[RabbitMQ][TelegramMessage] Consumer started', {
    queue: TOPOLOGY.telegramMessage.queue,
    prefetch: PREFETCH_COUNT,
  });
}

export async function startTelegramMessageConsumer() {
  stopping = false;
  await subscribe();

  if (!unsubscribeReconnect) {
    unsubscribeReconnect = rabbitMQConnectionManager.onReconnect(async () => {
      if (stopping) return;
      await subscribe();
    });
  }
}

export async function stopTelegramMessageConsumer() {
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

  logger.info('[RabbitMQ][TelegramMessage] Consumer stopped');
}
