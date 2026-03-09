import { logger } from '../../utils/logger.js';
import { createBankResponseService } from '../../apis/bankResponse/bankResponseServices.js';
import { rabbitMQConnectionManager } from '../connection.js';
import { assertQueueTopology, TOPOLOGY } from '../topology.js';

const PREFETCH_COUNT = Number(
  process.env.BANK_RESPONSE_BOT_BULK_PREFETCH || 4,
);
const MAX_RETRIES = Number(
  process.env.BANK_RESPONSE_BOT_BULK_MAX_RETRIES || 3,
);

let channel = null;
let consumerTag = null;
let unsubscribeReconnect = null;
let stopping = false;

function getRetryCount(msg) {
  return Number(msg?.properties?.headers?.['x-retry-count'] || 0);
}

async function processBankResponse(payload) {
  await createBankResponseService(
    payload.payload,
    payload.x_auth_token,
    payload.role,
    payload.name,
  );
}

async function handleMessage(msg) {
  if (!msg || stopping) {
    return;
  }

  const retryCount = getRetryCount(msg);

  try {
    const payload = JSON.parse(msg.content.toString());

    if (!payload?.payload || !payload?.x_auth_token) {
      throw new Error('Invalid bank response bulk message');
    }

    await processBankResponse(payload);
    channel.ack(msg);

    logger.info('[RabbitMQ][BankResponseBulk] Message processed', {
      retryCount,
    });
  } catch (error) {
    logger.error('[RabbitMQ][BankResponseBulk] Processing failed', {
      retryCount,
      error: error.message,
    });

    if (retryCount < MAX_RETRIES && channel) {
      const headers = msg.properties.headers
        ? { ...msg.properties.headers }
        : undefined;

      channel.sendToQueue(TOPOLOGY.bankResponseBotBulk.retryQueue, msg.content, {
        persistent: true,
        contentType: 'application/json',
        headers: {
          ...headers,
          'x-retry-count': retryCount + 1,
        },
      });
      channel.ack(msg);
      logger.warn('[RabbitMQ][BankResponseBulk] Message scheduled for retry', {
        retryCount: retryCount + 1,
        retryQueue: TOPOLOGY.bankResponseBotBulk.retryQueue,
        retryDelayMs: TOPOLOGY.bankResponseBotBulk.retryDelayMs,
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
  await assertQueueTopology(channel, TOPOLOGY.bankResponseBotBulk);
  await channel.prefetch(PREFETCH_COUNT);

  const result = await channel.consume(TOPOLOGY.bankResponseBotBulk.queue, handleMessage, {
    noAck: false,
  });

  consumerTag = result.consumerTag;

  logger.info('[RabbitMQ][BankResponseBulk] Consumer started', {
    queue: TOPOLOGY.bankResponseBotBulk.queue,
    prefetch: PREFETCH_COUNT,
  });
}

export async function startBankResponseBulkConsumer() {
  stopping = false;
  await subscribe();

  if (!unsubscribeReconnect) {
    unsubscribeReconnect = rabbitMQConnectionManager.onReconnect(async () => {
      if (stopping) return;
      await subscribe();
    });
  }
}

export async function stopBankResponseBulkConsumer() {
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

  logger.info('[RabbitMQ][BankResponseBulk] Consumer stopped');
}
