import { logger } from '../../utils/logger.js';
import { ValidationError } from '../../utils/appErrors.js';
import { processPayInService } from '../../apis/payIn/payInService.js';
import { VALIDATE_PROCESS_PAYIN } from '../../schemas/payInSchema.js';
import { rabbitMQConnectionManager } from '../connection.js';
import { assertQueueTopology, TOPOLOGY } from '../topology.js';

const PREFETCH_COUNT = Number(process.env.PAYIN_PROCESS_PREFETCH || 20);
const MAX_RETRIES = Number(process.env.PAYIN_PROCESS_MAX_RETRIES || 3);

let channel = null;
let consumerTag = null;
let unsubscribeReconnect = null;
let stopping = false;

function getRetryCount(msg) {
  return Number(msg?.properties?.headers?.['x-retry-count'] || 0);
}

async function processPayInJob(messagePayload) {
  const payload = messagePayload?.payload;
  const isH2H = Boolean(messagePayload?.isH2H);

  const joiValidation = VALIDATE_PROCESS_PAYIN.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }

  await processPayInService(
    payload,
    payload.code,
    true,
    true,
    null,
    isH2H,
  );
}

async function handleMessage(msg) {
  if (!msg || stopping) {
    return;
  }

  const retryCount = getRetryCount(msg);

  try {
    const payload = JSON.parse(msg.content.toString());

    if (!payload?.payload?.merchantOrderId) {
      throw new Error('Invalid payin process message');
    }

    await processPayInJob(payload);
    channel.ack(msg);

    logger.info('[RabbitMQ][PayInProcess] Message processed', {
      retryCount,
      merchantOrderId: payload.payload.merchantOrderId,
      mode: payload.isH2H ? 'h2h' : 'standard',
    });
  } catch (error) {
    logger.error('[RabbitMQ][PayInProcess] Processing failed', {
      retryCount,
      error: error.message,
    });

    if (retryCount < MAX_RETRIES && channel) {
      const headers = msg.properties.headers
        ? { ...msg.properties.headers }
        : undefined;

      channel.sendToQueue(TOPOLOGY.payinProcess.retryQueue, msg.content, {
        persistent: true,
        contentType: 'application/json',
        headers: {
          ...headers,
          'x-retry-count': retryCount + 1,
        },
      });
      channel.ack(msg);
      logger.warn('[RabbitMQ][PayInProcess] Message scheduled for retry', {
        retryCount: retryCount + 1,
        retryQueue: TOPOLOGY.payinProcess.retryQueue,
        retryDelayMs: TOPOLOGY.payinProcess.retryDelayMs,
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
  await assertQueueTopology(channel, TOPOLOGY.payinProcess);
  await channel.prefetch(PREFETCH_COUNT);

  const result = await channel.consume(TOPOLOGY.payinProcess.queue, handleMessage, {
    noAck: false,
  });

  consumerTag = result.consumerTag;

  logger.info('[RabbitMQ][PayInProcess] Consumer started', {
    queue: TOPOLOGY.payinProcess.queue,
    prefetch: PREFETCH_COUNT,
  });
}

export async function startPayInProcessConsumer() {
  stopping = false;
  await subscribe();

  if (!unsubscribeReconnect) {
    unsubscribeReconnect = rabbitMQConnectionManager.onReconnect(async () => {
      if (stopping) return;
      await subscribe();
    });
  }
}

export async function stopPayInProcessConsumer() {
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

  logger.info('[RabbitMQ][PayInProcess] Consumer stopped');
}
