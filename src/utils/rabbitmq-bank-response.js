import { getRabbitChannel } from './rabbitmq.js';
import config from '../config/config.js';
import { Buffer } from 'buffer';
import { logger } from './logger.js';

// Publish a bank response to the dedicated queue
export const publishBankResponse = async (responseData) => {
  const channel = getRabbitChannel();
  if (!channel) throw new Error('RabbitMQ channel not initialized');
  const queue = config.rabbitmq.bankResponseQueue;
  await channel.assertQueue(queue, { durable: true });
  const message = Buffer.from(JSON.stringify(responseData));
  const result = channel.sendToQueue(queue, message, { persistent: true });
  logger.info(`[RabbitMQ] Published to bankResponseQueue:`, responseData);
  if (!result) {
    logger.error('Failed to publish bank response to RabbitMQ', responseData);
  }
  return result;
};

// Consume bank responses from the queue
export const consumeBankResponses = async (callback) => {
  const channel = getRabbitChannel();
  if (!channel) throw new Error('RabbitMQ channel not initialized');
  const queue = config.rabbitmq.bankResponseQueue;
  await channel.assertQueue(queue, { durable: true });
  return channel.consume(queue, async (msg) => {
    if (msg) {
      try {
        const data = JSON.parse(msg.content.toString());
        logger.info(`[RabbitMQ] Consumed from bankResponseQueue:`, data);
        await callback(data, msg);
        channel.ack(msg);
      } catch (error) {
        logger.error('Error processing bank response:', error);
        channel.nack(msg, false, false);
      }
    }
  }, { noAck: false });
};

// Start a background worker to process all messages from the queue
export const startBankResponseWorker = async (processFn) => {
  const channel = getRabbitChannel();
  if (!channel) throw new Error('RabbitMQ channel not initialized');
  const queue = config.rabbitmq.bankResponseQueue;
  await channel.assertQueue(queue, { durable: true });
  await channel.consume(queue, async (msg) => {
    if (msg) {
      try {
        const data = JSON.parse(msg.content.toString());
        await processFn(data);
        channel.ack(msg);
        logger.info('[RabbitMQ Worker] Processed bank response:', data);
      } catch (error) {
        logger.error('[RabbitMQ Worker] Error processing bank response:', error);
        channel.nack(msg, false, false);
      }
    }
  }, { noAck: false });
};
