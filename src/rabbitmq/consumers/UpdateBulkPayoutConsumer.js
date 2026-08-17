import { logger } from '../../utils/logger.js';
import { rabbitMQConnectionManager } from '../connection.js';
import { assertQueueTopology, TOPOLOGY } from '../topology.js';
import { initiateExistingPayoutWithMethodService } from '../../apis/payOut/payOutService.js';
import { Method } from '../../constants/index.js';

const PREFETCH_COUNT = Number(
  process.env.BULK_PAYOUT_UPDATE_PREFETCH || 1,
);

const MAX_RETRIES = Number(
  process.env.BULK_PAYOUT_UPDATE_MAX_RETRIES || 3,
);

const BULK_PAYOUT_ALLOWED_METHODS = new Set([
  Method.PENNYPAY,
  Method.TRUSTPAY,
  Method.PAYBITRA,
  Method.PAYCRIC,
]);

let channel = null;
let consumerTag = null;
let unsubscribeReconnect = null;
let stopping = false;

function getRetryCount(msg) {
  return Number(msg?.properties?.headers?.['x-retry-count'] || 0);
}

async function processBulkPayoutUpdateEntry(payload) {
  const {
    payoutEntry,
    companyId,
    userId,
    role,
    method,
  } = payload;

  if (!companyId || !userId || !role) {
    throw new Error('companyId, userId, and role are required');
  }

  if (!payoutEntry || typeof payoutEntry !== 'object') {
    throw new Error('payoutEntry is required');
  }

  if (payoutEntry?.method) {
    throw new Error('method must be provided at top-level payload only');
  }

  const normalizedMethod = method
    ? String(method).trim().toUpperCase()
    : null;

  if (!BULK_PAYOUT_ALLOWED_METHODS.has(normalizedMethod)) {
    throw new Error(
      'Invalid bulk payout method. Allowed methods: PENNYPAY, TRUSTPAY, PAYBITRA, PAYCRIC',
    );
  }

  const payoutId = payoutEntry?.payoutId || payoutEntry?.id;
  if (!payoutId) {
    throw new Error('payoutId is required for payoutEntry');
  }

  logger.info('[BulkPayoutUpdate] Processing body payload', {
    payoutId,
    method: normalizedMethod,
  });

  const value = await initiateExistingPayoutWithMethodService({
    payoutId,
    companyId,
    method: normalizedMethod,
    updatedBy: userId,
    role,
  });

  logger.info('[BulkPayoutUpdate] Body processing completed', {
    payoutId,
    method: normalizedMethod,
  });

  return value;
}

async function handleMessage(msg) {
  if (!msg || stopping) {
    return;
  }

  const retryCount = getRetryCount(msg);

  try {
    const payload = JSON.parse(msg.content.toString());
    logger.info('[RabbitMQ][BulkPayoutUpdate] Message received', {
      retryCount,
    });

    await processBulkPayoutUpdateEntry(payload);

    channel.ack(msg);

    logger.info('[RabbitMQ][BulkPayoutUpdate] Message processed', {
      retryCount,
    });
  } catch (error) {
    logger.error('[RabbitMQ][BulkPayoutUpdate] Processing failed', {
      retryCount,
      error: error.message,
    });

    if (retryCount < MAX_RETRIES && channel) {
      const headers = msg.properties.headers
        ? { ...msg.properties.headers }
        : undefined;

      channel.sendToQueue(
        TOPOLOGY.bulkPayoutUpdate.retryQueue,
        msg.content,
        {
          persistent: true,
          contentType: 'application/json',
          headers: {
            ...headers,
            'x-retry-count': retryCount + 1,
          },
        },
      );

      channel.ack(msg);

      logger.warn('[RabbitMQ][BulkPayoutUpdate] Message scheduled for retry', {
        retryCount: retryCount + 1,
        retryQueue: TOPOLOGY.bulkPayoutUpdate.retryQueue,
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

  await assertQueueTopology(
    channel,
    TOPOLOGY.bulkPayoutUpdate,
  );

  await channel.prefetch(PREFETCH_COUNT);

  const result = await channel.consume(
    TOPOLOGY.bulkPayoutUpdate.queue,
    handleMessage,
    {
      noAck: false,
    },
  );

  consumerTag = result.consumerTag;

  logger.info('[RabbitMQ][BulkPayoutUpdate] Consumer started', {
    queue: TOPOLOGY.bulkPayoutUpdate.queue,
    prefetch: PREFETCH_COUNT,
  });
}

export async function startBulkPayoutUpdateConsumer() {
  stopping = false;

  await subscribe();

  if (!unsubscribeReconnect) {
    unsubscribeReconnect =
      rabbitMQConnectionManager.onReconnect(
        async () => {
          if (stopping) return;

          await subscribe();
        },
      );
  }
}

export async function stopBulkPayoutUpdateConsumer() {
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

  logger.info('[RabbitMQ][BulkPayoutUpdate] Consumer stopped');
}