/**
 * RabbitMQ Connection Manager - Production Grade
 * 
 * Handles connection pooling, automatic reconnection with exponential backoff,
 * and proper resource cleanup for RabbitMQ messaging.
 */

import amqp from 'amqplib';
import config from '../config/config.js';
import { logger } from './logger.js';

class RabbitMQConnection {
  constructor(connectionName = 'default') {
    this.connectionName = connectionName;
    this.connection = null;
    this.channel = null;
    this.isConnecting = false;
    this.isShuttingDown = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.rabbitmq.retryAttempts || 5;
    this.baseRetryDelay = config.rabbitmq.retryDelay || 5000;
  }

  /**
   * Check if current AMQP connection is still usable.
   * Required after laptop sleep/wake where heartbeat may close underlying socket.
   */
  _isConnectionUsable() {
    if (!this.connection) return false;

    const rawConn = this.connection.connection;
    const stream = rawConn?.stream;

    const isStreamUsable = !!stream && !stream.destroyed && stream.readable && stream.writable;
    const isClosing =
      this.connection?._closeCalled ||
      this.connection?._closing ||
      rawConn?.closing;

    return isStreamUsable && !isClosing;
  }

  _invalidateState() {
    this.channel = null;
    this.connection = null;
  }

  /**
   * Calculate exponential backoff delay
   */
  _getRetryDelay() {
    const delay = Math.min(
      this.baseRetryDelay * Math.pow(2, this.reconnectAttempts),
      60000 // Max 60 seconds
    );
    return delay;
  }

  /**
   * Establish connection to RabbitMQ
   */
  async connect() {
    if (this._isConnectionUsable()) {
      return this.connection;
    }

    // clear stale/closed connection references before reconnecting
    this._invalidateState();

    if (this.isShuttingDown) {
      throw new Error(`[${this.connectionName}] Connection manager is shutting down`);
    }

    if (this.isConnecting) {
      await this._waitForConnection();
      return this.connection;
    }

    this.isConnecting = true;

    try {
      const connectionOptions = {
        heartbeat: config.rabbitmq.heartbeat || 60,
        connection_timeout: config.rabbitmq.connectionTimeout || 30000,
      };

      logger.info(`[${this.connectionName}] Connecting to RabbitMQ...`, {
        connectionName: this.connectionName,
      });
      
      this.connection = await amqp.connect(config.rabbitmq.url, connectionOptions);
      this.channel = await this.connection.createChannel();

      this._setupConnectionHandlers();
      
      this.reconnectAttempts = 0;
      this.isConnecting = false;
      
      logger.info(`[${this.connectionName}] Connected to RabbitMQ`, {
        connectionName: this.connectionName,
      });
      
      return this.connection;
    } catch (error) {
      this.isConnecting = false;
      this.reconnectAttempts++;

      logger.errorEvent(
        'rabbitmq.connection.connect.failed',
        `[${this.connectionName}] Connection failed (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
        {
          connectionName: this.connectionName,
          attempt: this.reconnectAttempts,
          maxAttempts: this.maxReconnectAttempts,
          error: error.message,
        },
        `rabbitmq:${this.connectionName}:connect-failed:${this.reconnectAttempts}:${error.code || error.message}`,
      );

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = this._getRetryDelay();
        logger.warnEvent(
          'rabbitmq.connection.retry.scheduled',
          `[${this.connectionName}] Retrying in ${delay}ms...`,
          { connectionName: this.connectionName, delay, attempt: this.reconnectAttempts },
          `rabbitmq:${this.connectionName}:retry-scheduled:${this.reconnectAttempts}`,
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.connect();
      }

      throw new Error(
        `Failed to connect to RabbitMQ after ${this.maxReconnectAttempts} attempts`
      );
    }
  }

  /**
   * Setup connection event handlers
   */
  _setupConnectionHandlers() {
    this.connection.on('error', (err) => {
      if (err.message !== 'Connection closing') {
        logger.errorEvent(
          'rabbitmq.connection.error',
          `[${this.connectionName}] Connection error`,
          { connectionName: this.connectionName, error: err.message, code: err.code },
          `rabbitmq:${this.connectionName}:connection-error:${err.code || err.message}`,
        );
      }
    });

    this.connection.on('close', () => {
      logger.warn(`[${this.connectionName}] Connection closed`, {
        connectionName: this.connectionName,
      });
      this._invalidateState();
      if (!this.isShuttingDown) {
        this._handleReconnection();
      }
    });

    this.channel.on('error', (err) => {
      logger.errorEvent(
        'rabbitmq.channel.error',
        `[${this.connectionName}] Channel error`,
        { connectionName: this.connectionName, error: err.message, code: err.code },
        `rabbitmq:${this.connectionName}:channel-error:${err.code || err.message}`,
      );
    });

    this.channel.on('close', () => {
      logger.warn(`[${this.connectionName}] Channel closed`, {
        connectionName: this.connectionName,
      });
    });
  }

  /**
   * Handle automatic reconnection with exponential backoff
   */
  async _handleReconnection() {
    if (this.isShuttingDown || this.isConnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    const delay = this._getRetryDelay();
    logger.infoEvent(
      'rabbitmq.connection.reconnect.scheduled',
      `[${this.connectionName}] Reconnecting in ${delay}ms...`,
      { connectionName: this.connectionName, delay, attempt: this.reconnectAttempts },
      `rabbitmq:${this.connectionName}:reconnect-scheduled:${this.reconnectAttempts}`,
    );
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      await this.connect();
    } catch (error) {
      logger.errorEvent(
        'rabbitmq.connection.reconnect.failed',
        `[${this.connectionName}] Reconnection failed`,
        { connectionName: this.connectionName, error: error.message, code: error.code },
        `rabbitmq:${this.connectionName}:reconnect-failed:${error.code || error.message}`,
      );
    }
  }

  /**
   * Wait for ongoing connection attempt
   */
  async _waitForConnection(timeout = 30000) {
    const startTime = Date.now();
    while (this.isConnecting && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!this.connection) {
      throw new Error('Connection timeout');
    }
  }

  /**
   * Get or create channel
   */
  async getChannel() {
    if (!this.channel || !this._isConnectionUsable()) {
      await this.connect();
      // Create fresh channel after reconnect if needed
      if (!this.channel && this.connection) {
        this.channel = await this.connection.createChannel();
      }
    }
    return this.channel;
  }

  /**
   * Close connection gracefully
   */
  async close() {
    try {
      this.isShuttingDown = true;
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      logger.info(`[${this.connectionName}] Connection closed gracefully`, {
        connectionName: this.connectionName,
      });
    } catch (error) {
      logger.errorEvent(
        'rabbitmq.connection.close.error',
        `[${this.connectionName}] Error closing connection`,
        { connectionName: this.connectionName, error: error.message, code: error.code },
        `rabbitmq:${this.connectionName}:close-error:${error.code || error.message}`,
      );
    } finally {
      this._invalidateState();
      this.isConnecting = false;
      this.isShuttingDown = false;
    }
  }
}

// Singleton instances for different purposes
const publisherConnection = new RabbitMQConnection('publisher');
const consumerConnection = new RabbitMQConnection('consumer');

export { RabbitMQConnection, publisherConnection, consumerConnection };
