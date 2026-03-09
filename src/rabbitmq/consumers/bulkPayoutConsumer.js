import { logger } from '../../utils/logger.js';
import { updatePayoutDao } from '../../apis/payOut/payOutDao.js';
import { rabbitMQConnectionManager } from '../connection.js';
import { assertQueueTopology, TOPOLOGY } from '../topology.js';

const PREFETCH_COUNT = Number(process.env.BULK_PAYOUT_PREFETCH || 10);
const MAX_RETRIES = Number(process.env.BULK_PAYOUT_MAX_RETRIES || 3);

let channel = null;
let consumerTag = null;
let unsubscribeReconnect = null;
let stopping = false;

function getRetryCount(msg) {
  return Number(msg?.properties?.headers?.['x-retry-count'] || 0);
}

async function processBulkPayout(payload) {
  if (!Array.isArray(payload?.individualUpdates)) {
    throw new TypeError('Invalid bulk payout message');
  }

  for (const update of payload.individualUpdates) {
    if (!update?.payoutId) {
      throw new Error('Missing payoutId in update item');
    }

    await updatePayoutDao(
      { id: update.payoutId },
      {
        status: update.status,
        bank_acc_id: update.bank_acc_id,
        config: update.config,
        approved_at: update.approved_at,
        rejected_reason: update.rejected_reason,
        rejected_at: update.rejected_at,
        updated_at: new Date().toISOString(),
      },
    );
  }
}

async function handleMessage(msg) {
  if (!msg || stopping) {
    return;
  }

  const retryCount = getRetryCount(msg);

  try {
    const payload = JSON.parse(msg.content.toString());
    await processBulkPayout(payload);

    channel.ack(msg);

    logger.info('[RabbitMQ][BulkPayout] Message processed', {
      retryCount,
      updates: payload.individualUpdates.length,
    });
  } catch (error) {
    logger.error('[RabbitMQ][BulkPayout] Processing failed', {
      retryCount,
      error: error.message,
    });

    if (retryCount < MAX_RETRIES && channel) {
      const headers = msg.properties.headers
        ? { ...msg.properties.headers }
        : undefined;

      channel.sendToQueue(TOPOLOGY.bulkPayout.retryQueue, msg.content, {
        persistent: true,
        contentType: 'application/json',
        headers: {
          ...headers,
          'x-retry-count': retryCount + 1,
        },
      });
      channel.ack(msg);
      logger.warn('[RabbitMQ][BulkPayout] Message scheduled for retry', {
        retryCount: retryCount + 1,
        retryQueue: TOPOLOGY.bulkPayout.retryQueue,
        retryDelayMs: TOPOLOGY.bulkPayout.retryDelayMs,
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
  await assertQueueTopology(channel, TOPOLOGY.bulkPayout);
  await channel.prefetch(PREFETCH_COUNT);

  const result = await channel.consume(TOPOLOGY.bulkPayout.queue, handleMessage, {
    noAck: false,
  });

  consumerTag = result.consumerTag;

  logger.info('[RabbitMQ][BulkPayout] Consumer started', {
    queue: TOPOLOGY.bulkPayout.queue,
    prefetch: PREFETCH_COUNT,
  });
}

export async function startBulkPayoutConsumer() {
  stopping = false;
  await subscribe();

  if (!unsubscribeReconnect) {
    unsubscribeReconnect = rabbitMQConnectionManager.onReconnect(async () => {
      if (stopping) return;
      await subscribe();
    });
  }
}

export async function stopBulkPayoutConsumer() {
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

  logger.info('[RabbitMQ][BulkPayout] Consumer stopped');
}
