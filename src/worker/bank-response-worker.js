/**
 * Bank Response Queue Consumer - Production Grade
 * 
 * Resilient consumer worker with:
 * - Dead Letter Queue (DLQ) for failed messages
 * - Retry logic with exponential backoff
 * - Graceful shutdown handling
 * - Concurrent message processing with prefetch
 * - Comprehensive error handling and monitoring
 */

import { Buffer } from 'buffer';
import config from '../config/config.js';
import { logger } from '../utils/logger.js';
import { RabbitMQConnection } from '../utils/rabbitmq-connection.js';
import { createBankResponseService } from '../apis/bankResponse/bankResponseServices.js';

// Queue configuration
const QUEUE_NAME = config.rabbitmq.bankResponseQueue;
const DLX_NAME = 'bank_responses.dlx';
const DLQ_NAME = 'bank_responses.dlq';
const PREFETCH_COUNT = config.rabbitmq.prefetchCount || 10;
const MAX_RETRIES = 3;

// Dedicated connection for this worker (isolated from other workers)
const bankResponseConnection = new RabbitMQConnection('bank-response-worker');

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
    
    logger.info('[Consumer] Metrics:', {
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
];

function isRetryableError(error) {
  const message = error?.message || '';
  return RETRYABLE_ERROR_PATTERNS.some(pattern => pattern.test(message));
}

/**
 * Setup queue topology with DLX/DLQ
 */
async function setupQueueTopology(ch) {
  try {
    // Try to check if queue exists first
    const queueInfo = await ch.checkQueue(QUEUE_NAME);
    logger.info(`Consumer - Queue exists (${queueInfo.messageCount} messages, ${queueInfo.consumerCount} consumers)`);
    
    // Queue exists, just set prefetch
    await ch.prefetch(PREFETCH_COUNT);
    logger.info(`Consumer - Using existing queue configuration, Prefetch=${PREFETCH_COUNT}`);
    
  } catch (checkError) {
    // Queue doesn't exist, create it with DLX
    if (checkError.message.includes('NOT_FOUND')) {
      logger.info('Consumer - Queue not found, creating with DLX configuration...');
      
      // Setup Dead Letter Exchange
      await ch.assertExchange(DLX_NAME, 'direct', { durable: true });

      // Setup Dead Letter Queue
      await ch.assertQueue(DLQ_NAME, { durable: true });
      await ch.bindQueue(DLQ_NAME, DLX_NAME, 'failed');

      // Setup main queue with DLX configuration
      await ch.assertQueue(QUEUE_NAME, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': DLX_NAME,
          'x-dead-letter-routing-key': 'failed',
        },
      });

      // Set prefetch for concurrent processing
      await ch.prefetch(PREFETCH_COUNT);

      logger.info(`Consumer - Topology initialized: Queue=${QUEUE_NAME}, Prefetch=${PREFETCH_COUNT}`);
    } else {
      throw checkError;
    }
  }
}

/**
 * Get retry count from message headers
 */
function getRetryCount(msg) {
  return msg?.properties?.headers?.['x-retry-count'] || 0;
}

/**
 * Process individual message
 */
async function processMessage(msg) {
  const retryCount = getRetryCount(msg);
  const startTime = Date.now();
  
  metrics.messagesProcessed++;

  try {
    const data = JSON.parse(msg.content.toString());

    // Validate message structure
    if (!data?.payload || !data?.x_auth_token) {
      throw new Error('Invalid message structure: missing required fields');
    }

    logger.info(`Consumer - Processing message (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);

    await createBankResponseService(
      data.payload,
      data.x_auth_token,
      data.role,
      data.name
    );

    const duration = Date.now() - startTime;
    metrics.totalProcessingTime += duration;
    metrics.messagesSucceeded++;
    
    channel.ack(msg);
    logger.info(`Consumer - Message processed successfully (${duration}ms)`);

  } catch (error) {
    const shouldRetry = isRetryableError(error) && retryCount < MAX_RETRIES;
    
    metrics.messagesFailed++;
    const duration = Date.now() - startTime;
    metrics.totalProcessingTime += duration;

    logger.error('Consumer - Processing failed:', {
      error: error.message,
      retryCount,
      willRetry: shouldRetry,
    });

    if (shouldRetry) {
      // Re-queue with incremented retry count
      channel.sendToQueue(QUEUE_NAME, Buffer.from(msg.content), {
        persistent: true,
        headers: {
          ...msg.properties.headers,
          'x-retry-count': retryCount + 1,
        },
      });
      channel.ack(msg);
      logger.warn(`Consumer - Message requeued (retry ${retryCount + 1}/${MAX_RETRIES})`);
    } else {
      // Send to DLQ or reject permanently
      metrics.messagesToDLQ++;
      channel.nack(msg, false, false);
      logger.error('Consumer - Message sent to DLQ after max retries');
    }
  }
}

/**
 * Start consuming messages from queue
 */
export async function startBankResponseWorker() {
  if (isShuttingDown) {
    throw new Error('Worker is shutting down');
  }

  logger.info('Consumer - Starting Bank Response Worker...');

  try {
    // Get dedicated connection and create channel
    const connection = await bankResponseConnection.connect();
    channel = await connection.createChannel();

    // Setup queue topology
    await setupQueueTopology(channel);

    // Setup channel error handler
    channel.on('error', (err) => {
      logger.error('[Consumer] Channel error:', {
        message: err.message,
        code: err.code
      });
    });

    channel.on('close', () => {
      logger.warn('[Consumer] Channel closed unexpectedly');
      if (!isShuttingDown) {
        logger.info('[Consumer] Will attempt reconnection...');
        setTimeout(() => {
          startBankResponseWorker().catch(err =>
            logger.error('[Consumer] Reconnection failed:', {
              message: err.message,
              stack: err.stack
            })
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
          logger.error('[Consumer] Unhandled error in message handler:', {
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
    
    logger.info(`Consumer - Worker started (tag: ${consumerTag})`);
    logger.info(`Consumer - Waiting for messages in queue: ${QUEUE_NAME}`);

  } catch (error) {
    logger.error('Consumer - Worker startup failed:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    
    // Retry after delay if initial connection fails
    if (!isShuttingDown) {
      logger.info('Consumer - Retrying in 10 seconds...');
      setTimeout(() => {
        startBankResponseWorker().catch(err => 
          logger.error('Consumer - Retry failed:', {
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
export async function shutdownWorker(signal) {
  if (isShuttingDown) return;

  isShuttingDown = true;
  logger.warn(`[Consumer] ${signal} - Shutting down gracefully...`);

  try {
    // Cancel consumer first
    if (channel && consumerTag) {
      await channel.cancel(consumerTag);
      logger.info('[Consumer] Consumer cancelled');
    }

    // Wait for in-flight messages
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Close channel
    if (channel) {
      await channel.close().catch(err => 
        logger.warn('[Consumer] Channel close error:', err.message)
      );
      channel = null;
    }

    // Close dedicated connection
    await bankResponseConnection.close();
    logger.info('[Consumer] Shutdown complete');

  } catch (error) {
    logger.error('[Consumer] Shutdown error:', error.message);
  }
}

/**
 * Handler wrapper with error catching
 */
export async function startBankResponseHandler() {
  try {
    await startBankResponseWorker();
  } catch (error) {
    logger.error('[Consumer] Failed to start worker:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    // Don't throw - allow server to continue
  }
}
