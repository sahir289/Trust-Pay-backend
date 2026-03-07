/**
 * Bank Response Queue Publisher - Production Grade
 * 
 * Handles publishing bank response messages to RabbitMQ with:
 * - Automatic retries with exponential backoff
 * - Database fallback on failures
 * - Connection recovery
 * - Proper error handling and logging
 */

import { Buffer } from 'buffer';
import config from '../config/config.js';
import { logger } from './logger.js';
import { publisherConnection } from './rabbitmq-connection.js';
import { createBankResponseService } from '../apis/bankResponse/bankResponseServices.js';

const BANK_RESPONSE_QUEUE = config.rabbitmq.bankResponseQueue;
const DLX_NAME = 'bank_responses.dlx';
const DLQ_NAME = 'bank_responses.dlq';
const MAX_PUBLISH_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

const parseBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};

const ENABLE_DB_FALLBACK = parseBoolean(
  process.env.BANK_RESPONSE_PUBLISH_DB_FALLBACK,
  config.env !== 'production',
);

let cachedChannel = null;
let topologyReadyPromise = null;

async function ensurePublisherTopology(channel) {
  if (cachedChannel !== channel) {
    cachedChannel = channel;
    topologyReadyPromise = null;
  }

  if (!topologyReadyPromise) {
    topologyReadyPromise = (async () => {
      await channel.assertExchange(DLX_NAME, 'direct', { durable: true });
      await channel.assertQueue(DLQ_NAME, { durable: true });
      await channel.bindQueue(DLQ_NAME, DLX_NAME, 'failed');

      await channel.assertQueue(BANK_RESPONSE_QUEUE, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': DLX_NAME,
          'x-dead-letter-routing-key': 'failed',
        },
      });
    })().catch((error) => {
      topologyReadyPromise = null;
      throw error;
    });
  }

  return topologyReadyPromise;
}

/**
 * Publish message with retry logic
 */
async function publishWithRetry(channel, queue, message, attempts = MAX_PUBLISH_RETRIES) {
  for (let i = 0; i < attempts; i++) {
    try {
      const ok = channel.sendToQueue(queue, message, {
        persistent: true,
        contentType: 'application/json',
      });

      if (ok) return true;

      // Buffer full, wait before retry
      logger.warn(`Publisher - Buffer full, retrying in ${RETRY_DELAY_MS}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    } catch (error) {
      logger.error(`Publisher - Attempt ${i + 1}/${attempts} failed:`, error.message);
      
      if (i < attempts - 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (i + 1)));
      }
    }
  }
  return false;
}

/**
 * Fallback to database when RabbitMQ fails
 */
async function fallbackToDatabase(responseData) {
  if (!ENABLE_DB_FALLBACK) {
    logger.error('Publisher - DB fallback disabled, preserving queue-first behavior');
    return false;
  }

  logger.warn('Publisher - Using database fallback');
  
  try {
    await createBankResponseService(
      responseData.payload,
      responseData.x_auth_token,
      responseData.role,
      responseData.name
    );
    logger.info('Publisher - Saved to database');
    return true;
  } catch (error) {
    logger.error('Publisher - Database fallback failed:', error.message);
    throw error;
  }
}

/**
 * Publish bank response to queue
 */
export async function publishBankResponse(responseData) {
  const message = Buffer.from(JSON.stringify(responseData));

  try {
    const channel = await publisherConnection.getChannel();

    await ensurePublisherTopology(channel);

    const published = await publishWithRetry(channel, BANK_RESPONSE_QUEUE, message);

    if (!published) {
      logger.error('[Publisher] - Failed after retries, using database fallback');
      return await fallbackToDatabase(responseData);
    }

    logger.info('[Publisher] - Published to queue');
    return true;

  } catch (error) {
    logger.error('[Publisher] Publishing error:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return await fallbackToDatabase(responseData);
  }
}

/**
 * Publish bank response (bulk) - same as single publish
 * Kept for backward compatibility
 */
export async function publishBankResponseBulk(responseData) {
  return publishBankResponse(responseData);
}

/**
 * Close publisher connection
 */
export async function closePublisher() {
  await publisherConnection.close();
}
