import amqp from 'amqplib';
import { logger } from '../utils/logger.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class RabbitMQConnectionManager {   
  connection = null;

  channels = new Set();

  connectPromise = null;

  reconnectListeners = new Set();

  isShuttingDown = false;

  lastConnectionUrl = null;

  constructor() {
    this.config = {
      url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
      heartbeat: Number(process.env.RABBITMQ_HEARTBEAT || 30),
      connectionTimeout: Number(process.env.RABBITMQ_CONNECTION_TIMEOUT || 10000),
      maxReconnectDelayMs: Number(process.env.RABBITMQ_MAX_RECONNECT_DELAY_MS || 30000),
      reconnectBaseDelayMs: Number(process.env.RABBITMQ_RECONNECT_BASE_DELAY_MS || 1000),
    };
  }

  onReconnect(listener) {
    this.reconnectListeners.add(listener);
    return () => this.reconnectListeners.delete(listener);
  }

  async connect() {
    if (this.connection) {
      return this.connection;
    }

    if (this.connectPromise !== null) {
      return this.connectPromise;
    }

    this.connectPromise = this._connectWithRetry();

    try {
      this.connection = await this.connectPromise;
      return this.connection;
    } finally {
      this.connectPromise = null;
    }
  }

  async _connectWithRetry() {
    let attempt = 0;

    while (!this.isShuttingDown) {
      try {
        const connection = await amqp.connect(this.config.url, {
          heartbeat: this.config.heartbeat,
          connection_timeout: this.config.connectionTimeout,
        });

        this.lastConnectionUrl = this.config.url;
        this._bindConnectionEvents(connection);

        logger.info('[RabbitMQ] Connected', {
          url: this.lastConnectionUrl,
        });

        return connection;
      } catch (error) {
        attempt += 1;
        const delay = Math.min(
          this.config.reconnectBaseDelayMs * Math.pow(2, Math.max(0, attempt - 1)),
          this.config.maxReconnectDelayMs,
        );

        logger.error('[RabbitMQ] Connection failed, retrying', {
          attempt,
          delayMs: delay,
          error: error.message,
        });

        await sleep(delay);
      }
    }

    throw new Error('RabbitMQ manager is shutting down');
  }

  _bindConnectionEvents(connection) {
    connection.on('error', (error) => {
      logger.error('[RabbitMQ] Connection error', { error: error.message });
    });

    connection.on('close', async () => {
      if (this.isShuttingDown) {
        return;
      }

      logger.warn('[RabbitMQ] Connection closed, reconnecting');
      this.connection = null;
      this.channels.clear();

      try {
        await this.connect();

        await Promise.allSettled(
          Array.from(this.reconnectListeners).map((listener) => listener()),
        );
      } catch (error) {
        logger.error('[RabbitMQ] Reconnect cycle failed', {
          error: error.message,
        });
      }
    });
  }

  async createChannel() {
    const connection = await this.connect();
    const channel = await connection.createChannel();
    this.channels.add(channel);

    channel.on('close', () => {
      this.channels.delete(channel);
    });

    channel.on('error', (error) => {
      logger.error('[RabbitMQ] Channel error', {
        error: error.message,
      });
    });

    return channel;
  }

  async createConfirmChannel() {
    const connection = await this.connect();
    const channel = await connection.createConfirmChannel();
    this.channels.add(channel);

    channel.on('close', () => {
      this.channels.delete(channel);
    });

    channel.on('error', (error) => {
      logger.error('[RabbitMQ] Confirm channel error', {
        error: error.message,
      });
    });

    return channel;
  }

  async close() {
    this.isShuttingDown = true;

    const channels = Array.from(this.channels);
    await Promise.allSettled(
      channels.map(async (channel) => {
        try {
          await channel.close();
        } catch {
          // no-op
        }
      }),
    );

    this.channels.clear();

    if (this.connection) {
      try {
        await this.connection.close();
      } catch {
        // no-op
      }
      this.connection = null;
    }

    logger.info('[RabbitMQ] Connection manager closed');
  }
}

export const rabbitMQConnectionManager = new RabbitMQConnectionManager();
