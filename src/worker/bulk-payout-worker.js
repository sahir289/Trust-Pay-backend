/**
 * Bulk Payout Status Update Consumer - Production Grade
 * 
 * Resilient consumer worker with:
 * - Dead Letter Queue (DLQ) for failed messages
 * - Retry logic with exponential backoff
 * - Graceful shutdown handling
 * - Concurrent message processing with prefetch
 * - Comprehensive error handling and monitoring
 */

import { Buffer } from 'buffer';
// import config from '../config/config.js';
import { logger } from '../utils/logger.js';
import { RabbitMQConnection } from '../utils/rabbitmq-connection.js';
import { updatePayoutDao } from '../apis/payOut/payOutDao.js';

// Queue configuration
const QUEUE_NAME = 'bulk_payout_status_update';
const DLX_NAME = 'bulk_payout.dlx';
const DLQ_NAME = 'bulk_payout.dlq';
const PREFETCH_COUNT = 20; // Higher prefetch for bulk updates (they're fast)
const MAX_RETRIES = 3;

// Dedicated connection for this worker (isolated from other workers)
const bulkPayoutConnection = new RabbitMQConnection('bulk-payout-worker');

// Worker state
let channel = null;
let consumerTag = null;
let isShuttingDown = false;

/**
 * Retry-able error patterns
 */
const RETRYABLE_ERROR_PATTERNS = [
  /timeout/i,
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /deadlock/i,
  /could not obtain lock/i,
  /connection/i,
  /ECONNRESET/i,
];

function isRetryableError(error) {
  const message = error?.message || '';
  return RETRYABLE_ERROR_PATTERNS.some(pattern => pattern.test(message));
}

/**
 * Setup queue topology with DLX/DLQ
 * Uses assertQueue which creates queue if missing (safer than checkQueue)
 */
async function setupQueueTopology(ch) {
  // Setup Dead Letter Exchange
  await ch.assertExchange(DLX_NAME, 'direct', { durable: true });

  // Setup Dead Letter Queue
  await ch.assertQueue(DLQ_NAME, { durable: true });
  await ch.bindQueue(DLQ_NAME, DLX_NAME, 'failed');

  // Setup main queue with DLX configuration
  // assertQueue is idempotent - creates if missing, uses existing if present
  const queueInfo = await ch.assertQueue(QUEUE_NAME, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': DLX_NAME,
      'x-dead-letter-routing-key': 'failed',
    },
  });

  // Set prefetch for concurrent processing
  await ch.prefetch(PREFETCH_COUNT);

  logger.info(`[BulkPayout] Queue ready: ${queueInfo.messageCount} messages, ${queueInfo.consumerCount} consumers, Prefetch=${PREFETCH_COUNT}`);
}

/**
 * Get retry count from message headers
 */
function getRetryCount(msg) {
  return msg?.properties?.headers?.['x-retry-count'] || 0;
}

/**
 * Process individual payout update
 */
async function processMessage(msg) {
  const retryCount = getRetryCount(msg);
  const startTime = Date.now();

  try {
    const content = JSON.parse(msg.content.toString());

    // Validate message structure
    if (!content?.individualUpdates || !Array.isArray(content.individualUpdates)) {
      throw new Error('Invalid message structure: missing individualUpdates array');
    }

    const updateCount = content.individualUpdates.length;
    logger.info(`[BulkPayout] Processing ${updateCount} updates (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);

    // Process individual updates sequentially to avoid DB deadlocks
    let successCount = 0;
    let failureCount = 0;

    for (const update of content.individualUpdates) {
      try {
        // Validate update structure
        if (!update.payoutId) {
          logger.warn('[BulkPayout] Skipping update - missing payoutId:', update);
          failureCount++;
          continue;
        }

        await updatePayoutDao([update.payoutId], {
          status: update.status,
          bank_acc_id: update.bank_acc_id,
          config: update.config,
          approved_at: update.approved_at,
          updated_at: new Date().toISOString(),
        });

        successCount++;
      } catch (updateError) {
        logger.error('[BulkPayout] Failed to update payout:', {
          payoutId: update.payoutId,
          error: updateError.message,
        });
        failureCount++;
        
        // If it's a critical error, propagate it to trigger retry
        if (isRetryableError(updateError)) {
          throw updateError;
        }
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`[BulkPayout] Batch completed: ${successCount} success, ${failureCount} failed, ${duration}ms`);

    // If any failures but not retryable, log warning but ack
    if (failureCount > 0) {
      logger.warn(`[BulkPayout] Partial failure: ${failureCount}/${updateCount} updates failed`);
    }

    channel.ack(msg);

  } catch (error) {
    const shouldRetry = isRetryableError(error) && retryCount < MAX_RETRIES;

    logger.error('[BulkPayout] Processing failed:', {
      error: error.message,
      stack: error.stack,
      retryCount,
      willRetry: shouldRetry,
    });

    if (shouldRetry) {
      // Re-queue with incremented retry count and exponential backoff delay
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Max 30s delay
      
      setTimeout(() => {
        channel.sendToQueue(QUEUE_NAME, Buffer.from(msg.content), {
          persistent: true,
          headers: {
            ...msg.properties.headers,
            'x-retry-count': retryCount + 1,
          },
        });
        channel.ack(msg);
      }, delay);
      
      logger.warn(`[BulkPayout] Message requeued (retry ${retryCount + 1}/${MAX_RETRIES}, delay ${delay}ms)`);
    } else {
      // Send to DLQ after max retries
      channel.nack(msg, false, false);
      logger.error('[BulkPayout] Message sent to DLQ after max retries');
    }
  }
}

/**
 * Start consuming messages from queue
 */
export async function startBulkPayoutWorker() {
  if (isShuttingDown) {
    throw new Error('[BulkPayout] Worker is shutting down');
  }

  logger.info('[BulkPayout] Starting Bulk Payout Worker...');

  try {
    // Get dedicated connection and create channel
    const connection = await bulkPayoutConnection.connect();
    channel = await connection.createChannel();

    // Setup queue topology
    await setupQueueTopology(channel);

    // Start consuming
    const result = await channel.consume(
      QUEUE_NAME,
      async (msg) => {
        if (!msg || isShuttingDown) return;
        await processMessage(msg);
      },
      { noAck: false }
    );

    consumerTag = result.consumerTag;
    
    logger.info(`[BulkPayout] Worker started (tag: ${consumerTag})`);
    logger.info(`[BulkPayout] Waiting for messages in queue: ${QUEUE_NAME}`);

  } catch (error) {
    logger.error('[BulkPayout] Worker startup failed:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    
    // Retry after delay if initial connection fails
    if (!isShuttingDown) {
      logger.info('[BulkPayout] Retrying in 10 seconds...');
      setTimeout(() => {
        startBulkPayoutWorker().catch(err => 
          logger.error('[BulkPayout] Retry failed:', {
            message: err.message,
            stack: err.stack
          })
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
  logger.warn(`[BulkPayout] ${signal} - Shutting down gracefully...`);

  try {
    // Cancel consumer first
    if (channel && consumerTag) {
      await channel.cancel(consumerTag);
      logger.info('[BulkPayout] Consumer cancelled');
    }

    // Wait for in-flight messages to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Close channel
    if (channel) {
      await channel.close().catch(err => 
        logger.warn('[BulkPayout] Channel close error:', err.message)
      );
      channel = null;
    }

    // Close dedicated connection
    await bulkPayoutConnection.close();
    logger.info('[BulkPayout] Shutdown complete');

  } catch (error) {
    logger.error('[BulkPayout] Shutdown error:', error.message);
  }
}

/**
 * Handler wrapper with error catching
 */
export async function startBulkPayoutHandler() {
  try {
    await startBulkPayoutWorker();
  } catch (error) {
    logger.error('[BulkPayout] Failed to start worker:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    // Don't throw - allow server to continue
  }
}
