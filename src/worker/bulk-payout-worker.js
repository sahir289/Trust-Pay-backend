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

// Metrics for monitoring
const metrics = {
  messagesProcessed: 0,
  messagesSucceeded: 0,
  messagesFailed: 0,
  messagesToDLQ: 0,
  totalProcessingTime: 0,
  startTime: null,
};

// Log metrics every 5 minutes in production
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    const uptime = metrics.startTime ? Math.floor((Date.now() - metrics.startTime) / 1000) : 0;
    const avgProcessingTime = metrics.messagesProcessed > 0 
      ? Math.floor(metrics.totalProcessingTime / metrics.messagesProcessed) 
      : 0;
    
    logger.info('[BulkPayout] Metrics:', {
      uptime: `${uptime}s`,
      processed: metrics.messagesProcessed,
      succeeded: metrics.messagesSucceeded,
      failed: metrics.messagesFailed,
      dlq: metrics.messagesToDLQ,
      avgTime: `${avgProcessingTime}ms`,
      successRate: metrics.messagesProcessed > 0 
        ? `${((metrics.messagesSucceeded / metrics.messagesProcessed) * 100).toFixed(2)}%` 
        : '0%'
    });
  }, 300000); // 5 minutes
}

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
  
  metrics.messagesProcessed++;

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
    metrics.totalProcessingTime += duration;
    metrics.messagesSucceeded++;
    
    logger.info(`[BulkPayout] Batch completed: ${successCount} success, ${failureCount} failed, ${duration}ms`);

    // If any failures but not retryable, log warning but ack
    if (failureCount > 0) {
      logger.warn(`[BulkPayout] Partial failure: ${failureCount}/${updateCount} updates failed`);
    }

    channel.ack(msg);

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
      metrics.messagesToDLQ++;
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
    // Get dedicated connection
    const connection = await bulkPayoutConnection.connect();
    
    // Try to check if queue exists first
    let queueExists = false;
    try {
      const checkChannel = await connection.createChannel();
      const queueInfo = await checkChannel.checkQueue(QUEUE_NAME);
      await checkChannel.close();
      
      logger.info(`[BulkPayout] Using existing queue: ${queueInfo.messageCount} messages, ${queueInfo.consumerCount} consumers`);
      queueExists = true;
    } catch (checkError) {
      // Queue doesn't exist or check failed - we'll create it
      if (checkError.message?.includes('NOT_FOUND') || checkError.message?.includes('404')) {
        logger.info('[BulkPayout] Queue not found, will create with DLX configuration');
      } else {
        logger.warn('[BulkPayout] Queue check failed:', checkError.message);
      }
    }
    
    // Create channel for consuming
    channel = await connection.createChannel();
    
    // Setup topology (create if needed)
    if (!queueExists) {
      logger.info('[BulkPayout] Creating queue topology...');
      
      // Setup Dead Letter Exchange
      await channel.assertExchange(DLX_NAME, 'direct', { durable: true });

      // Setup Dead Letter Queue
      await channel.assertQueue(DLQ_NAME, { durable: true });
      await channel.bindQueue(DLQ_NAME, DLX_NAME, 'failed');

      // Setup main queue with DLX configuration
      await channel.assertQueue(QUEUE_NAME, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': DLX_NAME,
          'x-dead-letter-routing-key': 'failed',
        },
      });
      
      logger.info('[BulkPayout] Queue topology created');
    }
    
    // Set prefetch for concurrent processing
    await channel.prefetch(PREFETCH_COUNT);

    // Setup channel error handler
    channel.on('error', (err) => {
      logger.error('[BulkPayout] Channel error:', {
        message: err.message,
        code: err.code
      });
    });

    channel.on('close', () => {
      logger.warn('[BulkPayout] Channel closed unexpectedly');
      if (!isShuttingDown) {
        logger.info('[BulkPayout] Will attempt reconnection...');
        setTimeout(() => {
          startBulkPayoutWorker().catch(err =>
            logger.error('[BulkPayout] Reconnection failed:', err.message)
          );
        }, 5000);
      }
    });

    // Start consuming with error handling
    const result = await channel.consume(
      QUEUE_NAME,
      async (msg) => {
        if (!msg || isShuttingDown) return;
        try {
          await processMessage(msg);
        } catch (err) {
          logger.error('[BulkPayout] Unhandled error in message handler:', {
            message: err.message,
            stack: err.stack
          });
          // Nack the message so it's not lost
          if (channel) {
            channel.nack(msg, false, true); // Requeue
          }
        }
      },
      { noAck: false }
    );

    consumerTag = result.consumerTag;
    
    // Start metrics tracking
    metrics.startTime = Date.now();
    
    logger.info(`[BulkPayout] Worker started (tag: ${consumerTag}), Prefetch=${PREFETCH_COUNT}`);
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
