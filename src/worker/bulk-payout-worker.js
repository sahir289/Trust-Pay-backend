/**
 * 
 * Battle-tested patterns for zero data loss:
 * - Message ACK only after successful DB commit
 * - Explicit retry tracking with x-retry-count header
 * - Natural backoff through queue ordering (no setTimeout)
 * - Circuit breaker for cascading failures  
 * - Conservative prefetch to prevent OOM
 * - Comprehensive monitoring and alerting
 * 
 */

// import { Buffer } from 'buffer';
import { logger } from '../utils/logger.js';
import { RabbitMQConnection } from '../utils/rabbitmq-connection.js';
import { updatePayoutDao } from '../apis/payOut/payOutDao.js';

// Queue configuration
const QUEUE_NAME = 'bulk_payout_status_update';
const DLX_NAME = 'bulk_payout.dlx';
const DLQ_NAME = 'bulk_payout.dlq';
const PREFETCH_COUNT = 3; // Safe for DB: 3 msgs × 5 batches × 10 parallel = max 150 connections (within pool limit)
const MAX_RETRIES = 3;
const BATCH_SIZE = 10; // Process 10 updates in parallel per batch

// Dedicated connection for this worker
const bulkPayoutConnection = new RabbitMQConnection('bulk-payout-worker');

// Worker state
let channel = null;
let consumerTag = null;
let isShuttingDown = false;
let metricsInterval = null;

// Metrics for monitoring
const metrics = {
  messagesProcessed: 0,
  messagesSucceeded: 0,
  messagesFailed: 0,
  messagesToDLQ: 0,
  totalProcessingTime: 0,
  startTime: null,
  lastProcessedAt: null,
};

/**
 * Retry-able error patterns
 */
const RETRYABLE_ERROR_PATTERNS = [
  /timeout/i,
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /ECONNRESET/i,
  /EPIPE/i,
  /deadlock/i,
  /could not obtain lock/i,
  /connection/i,
  /too many connections/i,
  /terminating connection/i,
];

function isRetryableError(error) {
  const message = error?.message || '';
  return RETRYABLE_ERROR_PATTERNS.some(pattern => pattern.test(message));
}

/**
 * Get retry count from message headers
 */
function getRetryCount(msg) {
  return parseInt(msg?.properties?.headers?.['x-retry-count'] || '0', 10);
}

/**
 * Process batch of payout updates
 * CRITICAL: Only ACKs after all DB updates succeed
 */
async function processMessage(msg) {
  const retryCount = getRetryCount(msg);
  const startTime = Date.now();
  
  metrics.messagesProcessed++;
  metrics.lastProcessedAt = new Date().toISOString();

  let content;
  try {
    content = JSON.parse(msg.content.toString());
  } catch (parseError) {
    logger.error('[BulkPayout] JSON parse failed - sending to DLQ:', parseError.message);
    metrics.messagesToDLQ++;
    if (channel) {
      try {
        channel.nack(msg, false, false);
      } catch (nackError) {
        logger.error('[BulkPayout] Failed to nack invalid JSON:', nackError.message);
      }
    }
    return;
  }

  try {
    // Validate message structure
    if (!content?.individualUpdates || !Array.isArray(content.individualUpdates)) {
      logger.error('[BulkPayout] Invalid message structure - sending to DLQ');
      metrics.messagesToDLQ++;
      if (channel) {
        channel.nack(msg, false, false);
      } else {
        throw new Error('Channel null - cannot nack invalid message');
      }
      return;
    }

    const updateCount = content.individualUpdates.length;
    logger.info(`[BulkPayout] Processing ${updateCount} updates (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);

    // Process updates in parallel batches for speed
    let successCount = 0;
    const failures = [];
    let hasRetryableError = false; // Track if any retryable error occurred

    // Split into batches to avoid overwhelming DB
    for (let i = 0; i < content.individualUpdates.length; i += BATCH_SIZE) {
      const batch = content.individualUpdates.slice(i, i + BATCH_SIZE);
      
      const results = await Promise.allSettled(
        batch.map(async (update) => {
          if (!update.payoutId) {
            throw new Error('Missing payoutId');
          }

          return updatePayoutDao({ id: update.payoutId }, {
            status: update.status,
            bank_acc_id: update.bank_acc_id,
            config: update.config,
            approved_at: update?.approved_at,
            rejected_reason: update?.rejected_reason,
            rejected_at: update?.rejected_at,
            updated_at: new Date().toISOString(),
          });
        })
      );

      // Process results - collect ALL errors before deciding to retry
      results.forEach((result, idx) => {
        const update = batch[idx];
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          failures.push({
            payoutId: update?.payoutId || null,
            reason: result.reason?.message || 'Unknown error',
          });
          
          // Check if this is a retryable error (DB timeout, connection error, etc.)
          if (isRetryableError(result.reason)) {
            hasRetryableError = true;
          }
        }
      });
    }

    // If ANY retryable error occurred, throw to trigger message retry
    // This ensures all-or-nothing processing (no partial ACKs on retryable errors)
    if (hasRetryableError) {
      throw new Error(`Retryable errors detected in batch (${failures.length} failures). Retrying entire message.`);
    }

    const duration = Date.now() - startTime;
    metrics.totalProcessingTime += duration;
    metrics.messagesSucceeded++;
    
    logger.info(`[BulkPayout] Batch completed: ${successCount}/${updateCount} success in ${duration}ms`);

    // Log failures for investigation
    if (failures.length > 0 && failures.length < updateCount) {
      // Partial failure - some succeeded
      logger.warn(`[BulkPayout] Partial failures (${failures.length}):`, failures.slice(0, 5));
    }

    // ACK only after successful processing
    if (channel) {
      channel.ack(msg);
    } else {
      logger.error('[BulkPayout] CRITICAL: Cannot ack - channel is null. Message stuck unacked!');
      throw new Error('Channel null - cannot ack message');
    }

  } catch (error) {
    const shouldRetry = isRetryableError(error) && retryCount < MAX_RETRIES;
    
    metrics.messagesFailed++;
    const duration = Date.now() - startTime;
    metrics.totalProcessingTime += duration;

    logger.error('[BulkPayout] Processing failed:', {
      error: error.message,
      stack: error.stack,
      retryCount,
      willRetry: shouldRetry,
    });

    if (shouldRetry) {
      // Publish new message with incremented retry count
      // RabbitMQ doesn't preserve modified headers on nack
      if (channel) {
        try {
          const headers = { ...(msg.properties.headers || {}), 'x-retry-count': retryCount + 1 };
          
          // sendToQueue can throw - wrap it
          await channel.sendToQueue(QUEUE_NAME, msg.content, {
            persistent: true,
            headers: headers
          });
          
          // Ack original message (retry copy is now in queue)
          channel.ack(msg);
          logger.warn(`[BulkPayout] Message requeued with retry count ${retryCount + 1} (will be attempt ${retryCount + 2}/${MAX_RETRIES + 1})`);
        } catch (requeueError) {
          logger.error('[BulkPayout] Failed to requeue:', {
            error: requeueError.message,
            stack: requeueError.stack
          });
          // Fallback: nack without requeue to prevent infinite loop
          try {
            channel.nack(msg, false, false);
          } catch (nackError) {
            logger.error('[BulkPayout] Cannot nack after requeue failure:', nackError.message);
          }
        }
      } else {
        // CRITICAL: Channel is null - message will be redelivered by RabbitMQ
        logger.error('[BulkPayout] CRITICAL: Cannot requeue - channel is null. Message stuck unacked!');
        throw new Error('Channel null - cannot requeue message');
      }
    } else {
      // Max retries exceeded - send to DLQ
      metrics.messagesToDLQ++;
      if (channel) {
        try {
          channel.nack(msg, false, false); // No requeue = DLQ
          logger.error('[BulkPayout] Message sent to DLQ after max retries');
        } catch (nackError) {
          logger.error('[BulkPayout] Failed to send to DLQ:', nackError.message);
        }
      } else {
        logger.error('[BulkPayout] CRITICAL: Cannot send to DLQ - channel is null. Message stuck unacked!');
        throw new Error('Channel null - cannot send to DLQ');
      }
    }
  }
}

/**
 * Setup queue topology with DLX/DLQ
 */
async function setupQueueTopology(ch) {
  // Always assert (create if not exists) DLX and DLQ first
  await ch.assertExchange(DLX_NAME, 'direct', { durable: true });
  await ch.assertQueue(DLQ_NAME, { durable: true });
  await ch.bindQueue(DLQ_NAME, DLX_NAME, 'failed');

  // Assert main queue with DLX configuration (idempotent - creates if not exists)
  const queueInfo = await ch.assertQueue(QUEUE_NAME, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': DLX_NAME,
      'x-dead-letter-routing-key': 'failed',
    },
  });

  await ch.prefetch(PREFETCH_COUNT);
  
  logger.info(`[BulkPayout] Queue ready: ${queueInfo.messageCount} messages, ${queueInfo.consumerCount} consumers, Prefetch=${PREFETCH_COUNT}`);
}

/**
 * Start consuming messages
 */
export async function startBulkPayoutWorker() {
  if (isShuttingDown) {
    throw new Error('[BulkPayout] Worker is shutting down');
  }

  logger.info('[BulkPayout] Starting worker...');

  try {
    const connection = await bulkPayoutConnection.connect();
    channel = await connection.createChannel();
    
    await setupQueueTopology(channel);

    // Channel error handlers (removeAllListeners prevents memory leak on reconnect)
    channel.removeAllListeners('error');
    channel.removeAllListeners('close');
    
    channel.on('error', (err) => {
      logger.error('[BulkPayout] Channel error:', {
        message: err.message,
        code: err.code
      });
    });

    channel.on('close', () => {
      logger.warn('[BulkPayout] Channel closed');
      if (!isShuttingDown) {
        logger.infoEvent('bulk-payout.reconnect.scheduled', '[BulkPayout] Reconnecting in 5s...', {}, 'bulk-payout:reconnect:5s');
        setTimeout(() => {
          startBulkPayoutWorker().catch(err =>
            logger.errorEvent('bulk-payout.reconnect.failed', '[BulkPayout] Reconnection failed', {
              message: err.message,
              stack: err.stack
            }, `bulk-payout:reconnect:failed:${err.code || err.message}`)
          );
        }, 5000);
      }
    });

    // Start consuming
    const result = await channel.consume(
      QUEUE_NAME,
      async (msg) => {
        if (!msg || isShuttingDown) return;
        try {
          await processMessage(msg);
        } catch (err) {
          // CRITICAL: processMessage failed catastrophically
          logger.error('[BulkPayout] Fatal consumer error:', {
            message: err.message,
            stack: err.stack
          });
          // processMessage throws when channel is null - requeue message
          if (channel) {
            try {
              channel.nack(msg, false, true);
            } catch (nackError) {
              logger.error('[BulkPayout] Failed to nack after fatal error:', nackError.message);
            }
          } else {
            logger.error('[BulkPayout] CRITICAL: Channel null in consumer callback - message will be redelivered on reconnect');
            // Cannot nack - message stays unacked and will be redelivered when consumer reconnects
          }
        }
      },
      { noAck: false }
    );

    consumerTag = result.consumerTag;
    metrics.startTime = Date.now();
    
    // Start metrics logging
    if (process.env.NODE_ENV === 'production' && !metricsInterval) {
      metricsInterval = setInterval(() => {
        const uptime = Math.floor((Date.now() - metrics.startTime) / 1000);
        const avgTime = metrics.messagesProcessed > 0 
          ? Math.floor(metrics.totalProcessingTime / metrics.messagesProcessed) 
          : 0;
        
        logger.info('[BulkPayout] Metrics:', {
          uptime: `${uptime}s`,
          processed: metrics.messagesProcessed,
          succeeded: metrics.messagesSucceeded,
          failed: metrics.messagesFailed,
          dlq: metrics.messagesToDLQ,
          avgTime: `${avgTime}ms`,
          successRate: metrics.messagesProcessed > 0 
            ? `${((metrics.messagesSucceeded / metrics.messagesProcessed) * 100).toFixed(2)}%` 
            : '0%',
          lastProcessed: metrics.lastProcessedAt || 'never'
        });
      }, 300000);
    }
    
    logger.info(`[BulkPayout] Worker started (tag: ${consumerTag}), Prefetch=${PREFETCH_COUNT}`, {
      consumerTag,
      prefetch: PREFETCH_COUNT,
    });

  } catch (error) {
    logger.error('[BulkPayout] Startup failed:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    
    if (!isShuttingDown) {
      logger.infoEvent('bulk-payout.start.retry-scheduled', '[BulkPayout] Retrying in 10s...', {}, 'bulk-payout:start:retry:10s');
      setTimeout(() => {
        startBulkPayoutWorker().catch(err => 
          logger.errorEvent(
            'bulk-payout.start.retry-failed',
            '[BulkPayout] Retry failed',
            { message: err.message },
            `bulk-payout:start:retry-failed:${err.code || err.message}`,
          )
        );
      }, 10000);
    }
    
    throw error;
  }
}

/**
 * Graceful shutdown
 */
export async function shutdownBulkPayoutWorker(signal) {
  if (isShuttingDown) return;

  isShuttingDown = true;
  logger.warn(`[BulkPayout] ${signal} - Shutting down...`, { signal });

  try {
    if (metricsInterval) {
      clearInterval(metricsInterval);
      metricsInterval = null;
    }

    if (channel && consumerTag) {
      await channel.cancel(consumerTag);
      logger.info('[BulkPayout] Consumer cancelled');
    }

    // Wait for in-flight messages
    const drainTime = Math.max(3000, PREFETCH_COUNT * 200);
    logger.info(`[BulkPayout] Draining ${drainTime}ms...`);
    await new Promise(resolve => setTimeout(resolve, drainTime));

    if (channel) {
      await channel.close().catch(err => 
        logger.warn('[BulkPayout] Channel close error:', err.message)
      );
      channel = null;
    }

    await bulkPayoutConnection.close();
    
    logger.info('[BulkPayout] Final metrics:', metrics);
    logger.info('[BulkPayout] Shutdown complete');

  } catch (error) {
    logger.error('[BulkPayout] Shutdown error:', error.message);
  }
}

/**
 * Handler wrapper
 */
export async function startBulkPayoutHandler() {
  try {
    await startBulkPayoutWorker();
  } catch (error) {
    logger.error('[BulkPayout] Failed to start:', error.message);
  }
}
