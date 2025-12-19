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
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.rabbitmq.retryAttempts || 5;
    this.baseRetryDelay = config.rabbitmq.retryDelay || 5000;
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
    if (this.connection && !this.connection.connection.closed) {
      return this.connection;
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

      logger.info(`[${this.connectionName}] Connecting to RabbitMQ...`);
      
      this.connection = await amqp.connect(config.rabbitmq.url, connectionOptions);
      this.channel = await this.connection.createChannel();

      this._setupConnectionHandlers();
      
      this.reconnectAttempts = 0;
      this.isConnecting = false;
      
      logger.info(`[${this.connectionName}] Connected to RabbitMQ`);
      
      return this.connection;
    } catch (error) {
      this.isConnecting = false;
      this.reconnectAttempts++;

      logger.error(
        `[${this.connectionName}] Connection failed (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}):`,
        error.message
      );

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = this._getRetryDelay();
        logger.warn(`[${this.connectionName}] Retrying in ${delay}ms...`);
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
        logger.error(`[${this.connectionName}] Connection error:`, err.message);
      }
    });

    this.connection.on('close', () => {
      logger.warn(`[${this.connectionName}] Connection closed`);
      this.channel = null;
      this._handleReconnection();
    });

    this.channel.on('error', (err) => {
      logger.error(`[${this.connectionName}] Channel error:`, err.message);
    });

    this.channel.on('close', () => {
      logger.warn(`[${this.connectionName}] Channel closed`);
    });
  }

  /**
   * Handle automatic reconnection with exponential backoff
   */
  async _handleReconnection() {
    if (this.isConnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    const delay = this._getRetryDelay();
    logger.info(`[${this.connectionName}] Reconnecting in ${delay}ms...`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      await this.connect();
    } catch (error) {
      logger.error(`[${this.connectionName}] Reconnection failed:`, error.message);
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
    if (!this.channel || this.channel.connection.closed) {
      await this.connect();
    }
    return this.channel;
  }

  /**
   * Close connection gracefully
   */
  async close() {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      logger.info(`[${this.connectionName}] Connection closed gracefully`);
    } catch (error) {
      logger.error(`[${this.connectionName}] Error closing connection:`, error.message);
    }
  }
}

// Singleton instances for different purposes
const publisherConnection = new RabbitMQConnection('publisher');
const consumerConnection = new RabbitMQConnection('consumer');

export { RabbitMQConnection, publisherConnection, consumerConnection };
