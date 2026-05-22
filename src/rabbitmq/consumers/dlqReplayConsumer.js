import { logger } from '../../utils/logger.js';
import { rabbitMQConnectionManager } from '../connection.js';
import { assertQueueTopology, TOPOLOGY } from '../topology.js';

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const DLQ_REPLAYER_ENABLED = parseBoolean(
  process.env.DLQ_REPLAYER_ENABLED,
  true,
);
const DLQ_REPLAYER_PREFETCH = parsePositiveInt(
  process.env.DLQ_REPLAYER_PREFETCH,
  1,
);
const DLQ_REPLAYER_MAX_ATTEMPTS = parsePositiveInt(
  process.env.DLQ_REPLAYER_MAX_ATTEMPTS,
  3,
);
const DLQ_REPLAYER_INTERVAL_MS = parsePositiveInt(
  process.env.DLQ_REPLAYER_INTERVAL_MS,
  500,
);
const DLQ_REPLAYER_ERROR_BACKOFF_MS = parsePositiveInt(
  process.env.DLQ_REPLAYER_ERROR_BACKOFF_MS,
  2000,
);

let channel = null;
let unsubscribeReconnect = null;
let stopping = false;

const consumerTags = new Map();

const allTopologies = Object.values(TOPOLOGY);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getHeaderNumber = (headers, key, fallback = 0) => {
  const value = Number(headers?.[key]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

const toParkingQueueName = (topology) => `${topology.dlq}_parking`;

async function publishWithConfirm(queue, content, options) {
  channel.sendToQueue(queue, content, options);
  await channel.waitForConfirms();
}

async function parkMessage(msg, topology, replayCount) {
  const parkingQueue = toParkingQueueName(topology);
  const now = new Date().toISOString();
  const headers = msg.properties.headers ? { ...msg.properties.headers } : {};

  await publishWithConfirm(parkingQueue, msg.content, {
    persistent: true,
    contentType: msg.properties.contentType || 'application/json',
    contentEncoding: msg.properties.contentEncoding,
    correlationId: msg.properties.correlationId,
    messageId: msg.properties.messageId,
    timestamp: Date.now(),
    headers: {
      ...headers,
      'x-dlq-replay-count': replayCount,
      'x-dlq-parked-at': now,
      'x-dlq-park-reason': 'max-replay-attempts-exceeded',
      'x-original-dlq': topology.dlq,
      'x-original-queue': topology.queue,
    },
  });

  channel.ack(msg);

  logger.error('[RabbitMQ][DLQ-Replayer] Message parked after max replays', {
    dlq: topology.dlq,
    parkingQueue,
    sourceQueue: topology.queue,
    replayCount,
  });
}

async function replayMessage(msg, topology, replayCount) {
  const headers = msg.properties.headers ? { ...msg.properties.headers } : {};
  const nextReplayCount = replayCount + 1;

  await publishWithConfirm(topology.retryQueue, msg.content, {
    persistent: true,
    contentType: msg.properties.contentType || 'application/json',
    contentEncoding: msg.properties.contentEncoding,
    correlationId: msg.properties.correlationId,
    messageId: msg.properties.messageId,
    timestamp: Date.now(),
    headers: {
      ...headers,
      'x-retry-count': 0,
      'x-dlq-replay-count': nextReplayCount,
      'x-dlq-replayed-at': new Date().toISOString(),
      'x-original-dlq': topology.dlq,
      'x-original-queue': topology.queue,
    },
  });

  channel.ack(msg);

  logger.warn('[RabbitMQ][DLQ-Replayer] Message replayed to retry queue', {
    dlq: topology.dlq,
    retryQueue: topology.retryQueue,
    sourceQueue: topology.queue,
    replayCount: nextReplayCount,
    replayDelayMs: topology.retryDelayMs,
  });

  await sleep(DLQ_REPLAYER_INTERVAL_MS);
}

async function handleDlqMessage(msg, topology) {
  if (!msg || stopping || !channel) {
    return;
  }

  const headers = msg.properties.headers || {};
  const replayCount = getHeaderNumber(headers, 'x-dlq-replay-count', 0);

  try {
    if (replayCount >= DLQ_REPLAYER_MAX_ATTEMPTS) {
      await parkMessage(msg, topology, replayCount);
      return;
    }

    await replayMessage(msg, topology, replayCount);
  } catch (error) {
    logger.error('[RabbitMQ][DLQ-Replayer] Replay failed', {
      dlq: topology.dlq,
      sourceQueue: topology.queue,
      retryQueue: topology.retryQueue,
      replayCount,
      error: error.message,
    });

    if (channel) {
      channel.nack(msg, false, true);
    }

    await sleep(DLQ_REPLAYER_ERROR_BACKOFF_MS);
  }
}

async function subscribeOne(topology) {
  const result = await channel.consume(
    topology.dlq,
    async (msg) => handleDlqMessage(msg, topology),
    {
      noAck: false,
    },
  );

  consumerTags.set(topology.dlq, result.consumerTag);

  logger.info('[RabbitMQ][DLQ-Replayer] Consumer started', {
    dlq: topology.dlq,
    retryQueue: topology.retryQueue,
    parkingQueue: toParkingQueueName(topology),
    prefetch: DLQ_REPLAYER_PREFETCH,
    maxReplayAttempts: DLQ_REPLAYER_MAX_ATTEMPTS,
    replayIntervalMs: DLQ_REPLAYER_INTERVAL_MS,
  });
}

async function subscribeAll() {
  channel = await rabbitMQConnectionManager.createConfirmChannel();

  await channel.prefetch(DLQ_REPLAYER_PREFETCH);

  for (const topology of allTopologies) {
    await assertQueueTopology(channel, topology);
    await channel.assertQueue(toParkingQueueName(topology), { durable: true });
  }

  for (const topology of allTopologies) {
    await subscribeOne(topology);
  }
}

export async function startDlqReplayConsumer() {
  if (!DLQ_REPLAYER_ENABLED) {
    logger.info('[RabbitMQ][DLQ-Replayer] Disabled by configuration');
    return;
  }

  stopping = false;
  await subscribeAll();

  if (!unsubscribeReconnect) {
    unsubscribeReconnect = rabbitMQConnectionManager.onReconnect(async () => {
      if (stopping || !DLQ_REPLAYER_ENABLED) {
        return;
      }

      await subscribeAll();
    });
  }
}

export async function stopDlqReplayConsumer() {
  stopping = true;

  if (unsubscribeReconnect) {
    unsubscribeReconnect();
    unsubscribeReconnect = null;
  }

  if (channel) {
    for (const [dlq, tag] of consumerTags.entries()) {
      try {
        await channel.cancel(tag);
      } catch {
        logger.warn('[RabbitMQ][DLQ-Replayer] Failed to cancel consumer tag', {
          dlq,
          tag,
        });
      }
    }

    consumerTags.clear();

    try {
      await channel.close();
    } catch {
      // no-op
    }

    channel = null;
  }

  logger.info('[RabbitMQ][DLQ-Replayer] Consumer stopped');
}
