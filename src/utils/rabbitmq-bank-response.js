import { connectRabbitMQ, getRabbitChannel, publishWithRetry } from './rabbitmq.js';
import config from '../config/config.js';
import { Buffer } from 'buffer';
import { logger } from './logger.js';
import { createBankResponseService } from '../apis/bankResponse/bankResponseServices.js';
// Publish a bank response to the dedicated queue
export const publishBankResponse = async (responseData) => {
  const queue = config.rabbitmq.bankResponseQueue;
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
      logger.error('[RabbitMQ] Failed to publish after retries, saving to DB fallback');
      await createBankResponseService(
        responseData.payload,
        responseData.x_auth_token,
        responseData.role,
        responseData.name,
      );
    } else {
      logger.info('[RabbitMQ] Published to bankResponseQueue:', responseData);
    }

    return published;

  } catch (err) {
    await createBankResponseService(
      responseData.payload,
      responseData.x_auth_token,
      responseData.role,
      responseData.name,
    );
    logger.error('[RabbitMQ] Publish failed:', err.message);
    throw err;
  }
};


// Consume bank responses from the queue
export const consumeBankResponses = async (callback) => {
  try {
    const channel = await getRabbitChannel();
    if (!channel) throw new Error('RabbitMQ channel not initialized');
    const queue = config.rabbitmq.bankResponseQueue;
    await channel.assertQueue(queue, { durable: true });
    return channel.consume(
      queue,
      async (msg) => {
        if (!msg) return;
        try {
          const data = JSON.parse(msg.content.toString());
          logger.info(`[RabbitMQ] Consumed from bankResponseQueue:`, data);
          await callback(data, msg);
          channel.ack(msg);
        } catch (err) {
          logger.error('Error processing bank response:', err);
          channel.nack(msg, false, false);
        }
      },
      { noAck: false },
    );
  } catch (err) {
    logger.error('[RabbitMQ] Failed to start consumer:', err);
    setTimeout(() => consumeBankResponses(callback), 5000);
  }
};

// Start a background worker to process all messages from the queue
export const startBankResponseWorker = async (processFn) => {
  try {
    const channel = await getRabbitChannel();
    if (!channel) throw new Error('RabbitMQ channel not initialized');
    const queue = config.rabbitmq.bankResponseQueue;
    await channel.assertQueue(queue, { durable: true });
    await channel.consume(
      queue,
      async (msg) => {
        if (!msg) return;
        try {
          const data = JSON.parse(msg.content.toString());
          await processFn(data);
          channel.ack(msg);
          logger.info('[RabbitMQ Worker] Processed bank response:', data);
        } catch (error) {
          logger.error(
            '[RabbitMQ Worker] Error processing bank response:',
            error,
          );
          channel.nack(msg, false, false);
        }
      },
      { noAck: false },
    );
  } catch (err) {
    logger.error('[RabbitMQ Worker] Failed to start:', err);
    setTimeout(() => startBankResponseWorker(processFn), 5000);
  }
};
