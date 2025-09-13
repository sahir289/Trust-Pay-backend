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
      console.log('Channel created:', !!channel); // Debug

      await channel.prefetch(validatedConfig.prefetchCount);
      console.log('Prefetch set:', validatedConfig.prefetchCount); // Debug
      await channel.assertExchange(validatedConfig.exchangeName, 'direct', { durable: true });
      console.log('Exchange asserted:', validatedConfig.exchangeName); // Debug
      await channel.assertQueue(validatedConfig.queueName, { durable: true });
      console.log('Queue asserted:', validatedConfig.queueName); // Debug
      await channel.bindQueue(validatedConfig.queueName, validatedConfig.exchangeName, validatedConfig.routingKey);
      console.log('Queue bound:', validatedConfig.queueName, validatedConfig.exchangeName, validatedConfig.routingKey); // Debug

      connection.on('error', (err) => {
        logger.error('RabbitMQ connection error:', err);
      });

      connection.on('close', () => {
        const styledMessageError = chalk.underline.red('RabbitMQ connection closed');
        logger.log(styledMessageError);
        channel = null;
        connection = null;
      });

      const styledMessage = chalk.green(`RabbitMQ connected to ${validatedConfig.url} successfully`);
      logger.info(styledMessage);
      console.log('Returning channel:', !!channel); // Debug
      return channel;
    } catch (error) {
      retryCount++;
      logger.error(`RabbitMQ connection attempt ${retryCount} failed:`, error.message);
      console.log('Connection failed, retryCount:', retryCount, 'error:', error.message); // Debug

      if (retryCount >= maxRetries) {
        console.log('Max retries reached, throwing error'); // Debug
        throw new Error(`Failed to connect to RabbitMQ after ${maxRetries} attempts: ${error.message}`);
      }

      logger.log(`Retrying in ${validatedConfig.retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, validatedConfig.retryDelay));
    }
  }
};

export const getRabbitChannel = () => {
  console.log('getRabbitChannel called, channel:', !!channel); // Debug
  if (!channel) {
    throw new Error('RabbitMQ channel not initialized. Did you call connectRabbitMQ()?');
  }
  return channel;
};

export const getRabbitConnection = () => {
  console.log('getRabbitConnection called, connection:', !!connection); // Debug
  return connection;
};

export const publishToQueue = async (data, routingKey = config.rabbitmq.routingKey) => {
  console.log('publishToQueue called, routingKey:', routingKey); // Debug
  if (!channel) throw new Error('RabbitMQ channel not initialized');

  const message = Buffer.from(JSON.stringify(data));
  const result = channel.publish(
    config.rabbitmq.exchangeName,
    routingKey,
    message,
    { persistent: true }
  );
  console.log('publishToQueue result:', result); // Debug
  return result;
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

  const consumer = await channel.consume(queueName, async (msg) => {
    if (msg) {
      try {
        const data = JSON.parse(msg.content.toString());
        await callback(data, msg);
        channel.ack(msg);
        console.log('Message acknowledged:', queueName); // Debug
      } catch (error) {
        logger.error('Error processing message:', error);
        if (options.rejectOnError !== false) {
          channel.nack(msg, false, false);
          console.log('Message rejected:', queueName); // Debug
        }
      }
    }
  }, { noAck: false, ...options });
  console.log('Consumer started:', consumer.consumerTag); // Debug
  return consumer;
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
    const styledMessageError = chalk.redBright('RabbitMQ connection closed gracefully');
    logger.log(styledMessageError);
  } catch (error) {
    const styledMessageError = chalk.underline.red('Error closing RabbitMQ connection:');
    logger.error(styledMessageError, error);
  }
};

// Export for testing purposes
export { channel, connection };