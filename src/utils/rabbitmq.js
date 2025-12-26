import amqp from 'amqplib';
import { Buffer } from 'buffer';
import config from '../config/config.js';
import { logger } from './logger.js';
import chalk from 'chalk';

// Module-level state
let connection = null;
let channel = null;

// Validate configuration
const validateConfig = (rabbitConfig) => {
  console.log('Validating config:', rabbitConfig); // Debug
  const requiredFields = ['url', 'heartbeat', 'connectionTimeout', 'prefetchCount', 'exchangeName', 'queueName', 'routingKey', 'retryAttempts', 'retryDelay'];
  for (const field of requiredFields) {
    if (!rabbitConfig[field]) {
      throw new Error(`Missing required RabbitMQ config field: ${field}`);
    }
  }
  return rabbitConfig;
};

export const connectRabbitMQ = async (rabbitConfig = config.rabbitmq) => {
  console.log('connectRabbitMQ called with config:', rabbitConfig); // Debug
  if (channel) {
    console.log('Returning existing channel:', channel); // Debug
    return channel;
  }

  const validatedConfig = validateConfig(rabbitConfig);
  const connectionOptions = {
    heartbeat: validatedConfig.heartbeat,
    connection_timeout: validatedConfig.connectionTimeout,
  };

  let retryCount = 0;
  const maxRetries = validatedConfig.retryAttempts;

  console.log('Starting connection attempts, maxRetries:', maxRetries); // Debug
  while (retryCount < maxRetries) {
    try {
      console.log('Calling amqp.connect with URL:', validatedConfig.url, 'options:', connectionOptions); // Debug
      connection = await amqp.connect(validatedConfig.url, connectionOptions);
      console.log('Connection established:', !!connection); // Debug
      channel = await connection.createChannel();

      // Set prefetch count for better load balancing
      await channel.prefetch(rabbitConfig.prefetchCount);

      // Assert exchange and queue
      await channel.assertExchange(rabbitConfig.exchangeName, 'direct', {
        durable: true,
      });
      await channel.assertQueue(rabbitConfig.queueName, { durable: true });
      await channel.bindQueue(
        rabbitConfig.queueName,
        rabbitConfig.exchangeName,
        rabbitConfig.routingKey,
      );

      // Handle connection errors
      connection.on('error', (err) => {
        logger.error('RabbitMQ connection error:', err);
      });

      connection.on('close', () => {
        reconnectRabbitMQ(); // attempt to reconnect
        const styledMessageError = chalk.underline.red(
          'RabbitMQ connection closed',
        );
        logger.log(styledMessageError);
        channel = null;
        connection = null;
      });
      const styledMessage = chalk.green(
        `RabbitMQ connected to ${rabbitConfig.url} successfully`,
      );
      logger.info(styledMessage);
      return;
    } catch (error) {
      retryCount++;
      logger.error(
        `RabbitMQ connection attempt ${retryCount} failed:`,
        error.message,
      );

      if (retryCount >= maxRetries) {
        throw new Error(
          `Failed to connect to RabbitMQ after ${maxRetries} attempts`,
        );
      }

      logger.log(`Retrying in ${rabbitConfig.retryDelay}ms...`);
      await new Promise((resolve) =>
        setTimeout(resolve, rabbitConfig.retryDelay),
      );
    }
  }
};

const reconnectRabbitMQ = async () => {
  try {
    channel = null;
    connection = null;
    await connectRabbitMQ();
  } catch (err) {
    logger.error('RabbitMQ reconnection failed, retrying...', err.message);
    setTimeout(reconnectRabbitMQ, config.rabbitmq.retryDelay);
  }
};

export const getRabbitChannel = async () => {
  try {
    if (!channel || channel.connection.closed) {
      logger.warn('RabbitMQ channel closed, reconnecting...');
      await connectRabbitMQ(); // reconnects connection + channel
    }
    return channel;
  } catch (err) {
    logger.error('Error getting RabbitMQ channel:', err);
    throw err;
  }
};

export const publishWithRetry = async (
  channel,
  queue,
  message,
  attempts = 3,
) => {
  for (let i = 0; i < attempts; i++) {
    try {
      const ok = channel.sendToQueue(queue, message, { persistent: true });
      if (ok) return true;
      // If false, buffer is full, wait and retry
      await new Promise((r) => setTimeout(r, 1000));
    } catch (err) {
      logger.error(`[RabbitMQ] Publish attempt ${i + 1} failed`, err.message);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return false;
};

export const getRabbitConnection = () => connection;

export const publishToQueue = async (
  data,
  routingKey = config.rabbitmq.routingKey,
) => {
  if (!channel) throw new Error('RabbitMQ channel not initialized');

  const message = Buffer.from(JSON.stringify(data));
  return channel.publish(config.rabbitmq.exchangeName, routingKey, message, {
    persistent: true,
  });
};

export const publishToDirectQueue = async (queue, data) => {
  console.log('publishToDirectQueue called, queue:', queue); // Debug
  if (!channel) throw new Error('RabbitMQ channel not initialized');
  await channel.assertQueue(queue, { durable: true });
  const message = Buffer.from(JSON.stringify(data));
  const result = channel.sendToQueue(queue, message, { persistent: true });
  console.log('publishToDirectQueue result:', result); // Debug
  return result;
};

export const consumeFromQueue = async (queueName, callback, options = {}) => {
  console.log('consumeFromQueue called, queueName:', queueName); // Debug
  if (!channel) throw new Error('RabbitMQ channel not initialized');

  await channel.assertQueue(queueName, { durable: true });

  return channel.consume(
    queueName,
    async (msg) => {
      if (msg) {
        try {
          const data = JSON.parse(msg.content.toString());
          await callback(data, msg);
          channel.ack(msg);
        } catch (error) {
          logger.error('Error processing message:', error);
          if (options.rejectOnError !== false) {
            channel.nack(msg, false, false); // Don't requeue by default
          }
        }
      }
    },
    { noAck: false, ...options },
  );
};

export const closeRabbitMQ = async () => {
  console.log('closeRabbitMQ called'); // Debug
  try {
    if (channel) {
      await channel.close();
      console.log('Channel closed'); // Debug
      channel = null;
    }
    if (connection) {
      await connection.close();
      console.log('Connection closed'); // Debug
      connection = null;
    }
    const styledMessageError = chalk.redBright(
      'RabbitMQ connection closed gracefully',
    );
    logger.log(styledMessageError);
  } catch (error) {
    const styledMessageError = chalk.underline.red(
      'Error closing RabbitMQ connection:',
    );
    logger.error(styledMessageError, error);
  }
};
