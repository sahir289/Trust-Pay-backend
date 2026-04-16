import { logger } from '../../utils/logger.js';
import { ValidationError } from '../../utils/appErrors.js';
import { processPayInService } from '../../apis/payIn/payInService.js';
import { VALIDATE_PROCESS_PAYIN } from '../../schemas/payInSchema.js';
import { rabbitMQConnectionManager } from '../connection.js';
import { assertQueueTopology, TOPOLOGY } from '../topology.js';
import { updatePayInUrlDao, getPayinsForServiccDao } from '../../apis/payIn/payInDao.js';
import { Status } from '../../constants/index.js';
import redisClient from '../../utils/redisClient.js';

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

/**
 * Map Tylt eventId to internal Status values.
 * 4 → SUCCESS
 * 5, 9 → FAILED
 * others → PENDING
 */
export function mapTyltStatus(eventId) {
  switch (Number(eventId)) {
    case 4:
      return Status.SUCCESS;
    case 5:
    case 9:
      return Status.FAILED;
    default:
      return Status.PENDING;
  }
}

async function processTyltPayInJob(messagePayload) {
  const body = messagePayload?.payload;

  // Tylt webhook payload shape:
  // { data: { trade: { event: { id } }, transaction: { merchantOrderId }, accounts: { amountPaidInCryptoCurrency, conversionRate } } }
  const data = body?.data || {};
  const transaction = data.transaction || {};
  const accounts = data.accounts || {};
  const trade = data.trade || {};
  const event = trade.event || {};

  const merchantOrderId = transaction.merchantOrderId;
  if (!merchantOrderId) {
    logger.warn('[Tylt] Dropping payload with no merchantOrderId in data.transaction', { data });
    return;
  }

  const eventId = event.id;
  const internalStatus = mapTyltStatus(eventId);
  const tyltStatus = mapTyltStatus(eventId);

  logger.info('[Tylt][Consumer] Status mapped', {
    merchantOrderId,
    eventId,
    internalStatus,
  });

  const cryptoAmount = accounts.amountPaidInCryptoCurrency
    ? Number(accounts.amountPaidInCryptoCurrency)
    : undefined;
  const conversionRate = accounts.conversionRate
    ? Number(accounts.conversionRate)
    : undefined;

  const payIn = await getPayinsForServiccDao({ merchant_order_id: merchantOrderId });
  if (!payIn) {
    throw new Error(`[Tylt] PayIn not found for merchantOrderId: ${merchantOrderId}`);
  }

  // --- STEP 1: Idempotency guard ---
  if (payIn.status === Status.SUCCESS) {
    logger.warn('[Tylt][Consumer] TYLT_DUPLICATE_BLOCKED — already SUCCESS, skipping', {
      merchantOrderId,
    });
    return;
  }

  const updateData = {
    status: internalStatus,
    is_url_expires: true,
    one_time_used: true,
    updated_by: 'tylt_webhook',
    ...(internalStatus === Status.SUCCESS && {
      approved_at: new Date().toISOString(),
      is_notified: true,
    }),
    config: {
      ...payIn.config,
      ...(cryptoAmount !== undefined && { cryptoAmount }),
      ...(conversionRate !== undefined && { conversionRate }),
      tyltStatus,
      // --- STEP 7: Store raw payload for audit ---
      tyltRawPayload: body,
    },
  };

  await updatePayInUrlDao(payIn.id, updateData);

  // --- STEP 5: Provider metrics ---
  try {
    await redisClient.hincrby('metrics:TYLT', internalStatus, 1);
  } catch (metricsErr) {
    // Non-fatal — never let metrics failures break payment processing
    logger.warn('[Tylt][Consumer] Metrics update failed', { error: metricsErr.message });
  }

  logger.info('[Tylt][Consumer] PayIn updated successfully', {
    merchantOrderId,
    internalStatus,
    cryptoAmount,
    conversionRate,
  });
}

async function handleMessage(msg) {
  if (!msg || stopping) {
    return;
  }

  const retryCount = getRetryCount(msg);

  try {
    const payload = JSON.parse(msg.content.toString());

    // Route Tylt messages separately — they carry crypto metadata
    // and do not follow the standard UTR/bank-response payin flow.
    if (payload?.provider === 'tylt') {
      const tyltMerchantOrderId = payload?.payload?.data?.transaction?.merchantOrderId;
      try {
        await processTyltPayInJob(payload);
        channel.ack(msg);
        logger.info('[Tylt][Consumer] TYLT_PROCESS_SUCCESS', {
          retryCount,
          merchantOrderId: tyltMerchantOrderId,
        });
      } catch (err) {
        // --- STEP 3: Labelled error — re-throw so outer catch retries / DLQs ---
        logger.error('[Tylt][Consumer] TYLT_PROCESS_FAILED', {
          retryCount,
          merchantOrderId: tyltMerchantOrderId,
          error: err.message,
        });
        throw err;
      }
      return;
    }

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
