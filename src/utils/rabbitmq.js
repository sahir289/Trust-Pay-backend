import amqp from 'amqplib';
import { Buffer } from 'buffer';
import config from '../config/config.js';

let connection;
let channel;

export const connectRabbitMQ = async (rabbitConfig = config.rabbitmq) => {
  const connectionOptions = {
    heartbeat: rabbitConfig.heartbeat,
    connection_timeout: rabbitConfig.connectionTimeout,
  };

  let retryCount = 0;
  const maxRetries = rabbitConfig.retryAttempts;

  while (retryCount < maxRetries) {
    try {
      connection = await amqp.connect(rabbitConfig.url, connectionOptions);
      channel = await connection.createChannel();
      
      // Set prefetch count for better load balancing
      await channel.prefetch(rabbitConfig.prefetchCount);
      
      // Assert exchange and queue
      await channel.assertExchange(rabbitConfig.exchangeName, 'direct', { durable: true });
      await channel.assertQueue(rabbitConfig.queueName, { durable: true });
      await channel.bindQueue(rabbitConfig.queueName, rabbitConfig.exchangeName, rabbitConfig.routingKey);
      
      // Handle connection errors
      connection.on('error', (err) => {
        console.error('RabbitMQ connection error:', err);
      });
      
      connection.on('close', () => {
        console.log('RabbitMQ connection closed');
      });
      
      console.log(`RabbitMQ connected to ${rabbitConfig.url}`);
      return;
    } catch (error) {
      retryCount++;
      console.error(`RabbitMQ connection attempt ${retryCount} failed:`, error.message);
      
      if (retryCount >= maxRetries) {
        throw new Error(`Failed to connect to RabbitMQ after ${maxRetries} attempts`);
      }
      
      console.log(`Retrying in ${rabbitConfig.retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, rabbitConfig.retryDelay));
    }
  }
};

export const getRabbitChannel = () => channel;

export const getRabbitConnection = () => connection;

export const publishToQueue = async (data, routingKey = config.rabbitmq.routingKey) => {
  if (!channel) throw new Error('RabbitMQ channel not initialized');
  
  const message = Buffer.from(JSON.stringify(data));
  return channel.publish(
    config.rabbitmq.exchangeName,
    routingKey,
    message,
    { persistent: true }
  );
};

export const publishToDirectQueue = async (queue, data) => {
  if (!channel) throw new Error('RabbitMQ channel not initialized');
  await channel.assertQueue(queue, { durable: true });
  const message = Buffer.from(JSON.stringify(data));
  return channel.sendToQueue(queue, message, { persistent: true });
};

export const consumeFromQueue = async (queueName, callback, options = {}) => {
  if (!channel) throw new Error('RabbitMQ channel not initialized');
  
  await channel.assertQueue(queueName, { durable: true });
  
  return channel.consume(queueName, async (msg) => {
    if (msg) {
      try {
        const data = JSON.parse(msg.content.toString());
        await callback(data, msg);
        channel.ack(msg);
      } catch (error) {
        console.error('Error processing message:', error);
        if (options.rejectOnError !== false) {
          channel.nack(msg, false, false); // Don't requeue by default
        }
      }
    }
  }, { noAck: false, ...options });
};

export const closeRabbitMQ = async () => {
  try {
    if (channel) {
      await channel.close();
    }
    if (connection) {
      await connection.close();
    }
    console.log('RabbitMQ connection closed gracefully');
  } catch (error) {
    console.error('Error closing RabbitMQ connection:', error);
  }
};