import amqp from 'amqplib';
import config from '../config/config.js';

let connection;
let channel;

const LOG_QUEUE_NAME = process.env.LOG_INGESTOR_QUEUE || 'trust-pay-central-logs';

const getConnectionOptions = () => ({
  heartbeat: config.rabbitmq?.heartbeat || 60,
  connection_timeout: config.rabbitmq?.connectionTimeout || 10000,
});

export const connectLogPublisher = async () => {
  if (channel) return channel;

  connection = await amqp.connect(config.rabbitmq.url, getConnectionOptions());
  channel = await connection.createChannel();
  await channel.assertQueue(LOG_QUEUE_NAME, { durable: true });

  connection.on('close', () => {
    channel = null;
    connection = null;
  });

  connection.on('error', () => {
    // best-effort publisher, reconnect is handled lazily on next publish
    channel = null;
    connection = null;
  });

  return channel;
};

export const publishLogEvent = async (payload) => {
  try {
    const ch = await connectLogPublisher();
    const body = Buffer.from(JSON.stringify(payload));
    return ch.sendToQueue(LOG_QUEUE_NAME, body, { persistent: true });
  } catch {
    return false;
  }
};

export const closeLogPublisher = async () => {
  try {
    if (channel) await channel.close();
  } catch {
    // ignore
  }

  try {
    if (connection) await connection.close();
  } catch {
    // ignore
  }

  channel = null;
  connection = null;
};
