import { connectRabbitMQ, getRabbitChannel, publishWithRetry } from './rabbitmq.js';
import config from '../config/config.js';
import { Buffer } from 'buffer';
import { logger } from './logger.js';
import { createBankResponseService } from '../apis/bankResponse/bankResponseServices.js';

// Publish a single bank response to the dedicated queue (bot bank response)
export const publishBankResponse = async (responseData) => {
  const queue = config.rabbitmq.bankResponseQueue; // Regular bot bank response queue
  const message = Buffer.from(JSON.stringify(responseData));

  try {
    let channel = await getRabbitChannel();

    if (!channel || channel.connection.closed) {
      logger.warn('RabbitMQ channel closed, reconnecting...');
      channel = await connectRabbitMQ();
    }

    await channel.assertQueue(queue, { durable: true });
    const published = await publishWithRetry(channel, queue, message, config.rabbitmq.retryAttempts);

    if (!published) {
      logger.error('[RabbitMQ] Failed to publish to bankResponseQueue after retries, saving to DB fallback');
      await createBankResponseService(
        responseData.payload,
        responseData.x_auth_token,
        responseData.role,
        responseData.name,
      );
    } else {
      logger.info('[RabbitMQ] Published to bankResponseQueue:', { utr: responseData.payload?.utr });
    }

    return published;

  } catch (err) {
    await createBankResponseService(
      responseData.payload,
      responseData.x_auth_token,
      responseData.role,
      responseData.name,
    );
    logger.error('[RabbitMQ] Publish to bankResponseQueue failed:', err.message);
    throw err;
  }
};

// Publish bulk bank response to the bulk queue (bot bulk bank response)
export const publishBulkBankResponse = async (responseData) => {
  const queue = config.rabbitmq.bulkBankResponseQueue; // Bulk bot bank response queue
  const message = Buffer.from(JSON.stringify(responseData));

  try {
    let channel = await getRabbitChannel();

    if (!channel || channel.connection.closed) {
      logger.warn('RabbitMQ channel closed, reconnecting...');
      channel = await connectRabbitMQ();
    }

    await channel.assertQueue(queue, { durable: true });
    const published = await publishWithRetry(channel, queue, message, config.rabbitmq.retryAttempts);

    if (!published) {
      logger.error('[RabbitMQ] Failed to publish to bulkBankResponseQueue after retries, saving to DB fallback');
      await createBankResponseService(
        responseData.payload,
        responseData.x_auth_token,
        responseData.role,
        responseData.name,
      );
    } else {
      logger.info('[RabbitMQ] Published to bulkBankResponseQueue:', { utr: responseData.payload?.utr });
    }

    return published;

  } catch (err) {
    await createBankResponseService(
      responseData.payload,
      responseData.x_auth_token,
      responseData.role,
      responseData.name,
    );
    logger.error('[RabbitMQ] Publish to bulkBankResponseQueue failed:', err.message);
    throw err;
  }
};


