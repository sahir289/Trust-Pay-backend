import amqp from 'amqplib';
import * as rabbitUtils from './rabbitmq.js';
import { logger } from './logger.js';
import { Buffer } from 'buffer';

// Mock amqplib and logger
jest.mock('amqplib', () => ({
  connect: jest.fn(),
}));
jest.mock('./logger.js', () => ({
  logger: {
    info: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
  },
}));

describe('RabbitMQ Utilities', () => {
  let mockConnection, mockChannel;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset module state
    rabbitUtils.channel = null;
    rabbitUtils.connection = null;

    mockChannel = {
      prefetch: jest.fn().mockResolvedValue(undefined),
      assertExchange: jest.fn().mockResolvedValue(undefined),
      assertQueue: jest.fn().mockResolvedValue(undefined),
      bindQueue: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn().mockReturnValue(true),
      sendToQueue: jest.fn().mockReturnValue(true),
      consume: jest.fn(),
      ack: jest.fn(),
      nack: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };

    mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
      on: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };

    // Reset amqp.connect mock
    amqp.connect.mockReset();
    amqp.connect.mockImplementation(() => Promise.resolve(mockConnection));
  });

  afterEach(() => {
    // Clear module cache to prevent state leakage
    jest.resetModules();
  });

  describe('connectRabbitMQ', () => {
    it('should connect and setup channel successfully', async () => {
      await rabbitUtils.connectRabbitMQ({
        url: 'amqp://test',
        heartbeat: 10,
        connectionTimeout: 1000,
        prefetchCount: 1,
        exchangeName: 'ex',
        queueName: 'q',
        routingKey: 'rk',
        retryAttempts: 1,
        retryDelay: 10,
      });

      expect(amqp.connect).toHaveBeenCalledWith('amqp://test', {
        heartbeat: 10,
        connection_timeout: 1000,
      });
      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(mockChannel.prefetch).toHaveBeenCalledWith(1);
      expect(mockChannel.assertExchange).toHaveBeenCalledWith('ex', 'direct', { durable: true });
      expect(mockChannel.assertQueue).toHaveBeenCalledWith('q', { durable: true });
      expect(mockChannel.bindQueue).toHaveBeenCalledWith('q', 'ex', 'rk');
      expect(logger.info).toHaveBeenCalled();
      expect(rabbitUtils.channel).toBe(mockChannel);
      expect(rabbitUtils.connection).toBe(mockConnection);
    });

    it('should retry connection on failure', async () => {
      amqp.connect
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(mockConnection);

      await rabbitUtils.connectRabbitMQ({
        url: 'amqp://test',
        heartbeat: 10,
        connectionTimeout: 1000,
        prefetchCount: 1,
        exchangeName: 'ex',
        queueName: 'q',
        routingKey: 'rk',
        retryAttempts: 2,
        retryDelay: 100, // Increased to avoid timing issues
      });

      expect(amqp.connect).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalledWith('RabbitMQ connection attempt 1 failed:', 'fail');
      expect(rabbitUtils.channel).toBe(mockChannel);
      expect(rabbitUtils.connection).toBe(mockConnection);
    });
  });

  describe('getRabbitChannel', () => {
    it('should throw if channel not initialized', () => {
      rabbitUtils.channel = null;
      expect(() => rabbitUtils.getRabbitChannel()).toThrow('RabbitMQ channel not initialized');
    });

    it('should return channel if initialized', async () => {
      await rabbitUtils.connectRabbitMQ({
        url: 'amqp://test',
        heartbeat: 10,
        connectionTimeout: 1000,
        prefetchCount: 1,
        exchangeName: 'ex',
        queueName: 'q',
        routingKey: 'rk',
        retryAttempts: 1,
        retryDelay: 10,
      });
      expect(rabbitUtils.getRabbitChannel()).toBe(mockChannel);
    });
  });

  describe('publishToQueue', () => {
    it('should call channel.publish', async () => {
      await rabbitUtils.connectRabbitMQ({
        url: 'amqp://test',
        heartbeat: 10,
        connectionTimeout: 1000,
        prefetchCount: 1,
        exchangeName: 'ex',
        queueName: 'q',
        routingKey: 'rk',
        retryAttempts: 1,
        retryDelay: 10,
      });
      const data = { a: 1 };
      await rabbitUtils.publishToQueue(data, 'rk');
      expect(mockChannel.publish).toHaveBeenCalledWith(
        'ex',
        'rk',
        expect.any(Buffer),
        { persistent: true }
      );
    });
  });

  describe('publishToDirectQueue', () => {
    it('should call sendToQueue', async () => {
      await rabbitUtils.connectRabbitMQ({
        url: 'amqp://test',
        heartbeat: 10,
        connectionTimeout: 1000,
        prefetchCount: 1,
        exchangeName: 'ex',
        queueName: 'q',
        routingKey: 'rk',
        retryAttempts: 1,
        retryDelay: 10,
      });
      const data = { a: 2 };
      await rabbitUtils.publishToDirectQueue('myQueue', data);
      expect(mockChannel.assertQueue).toHaveBeenCalledWith('myQueue', { durable: true });
      expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
        'myQueue',
        expect.any(Buffer),
        { persistent: true }
      );
    });
  });

  describe('consumeFromQueue', () => {
    it('should call consume and ack message', async () => {
      await rabbitUtils.connectRabbitMQ({
        url: 'amqp://test',
        heartbeat: 10,
        connectionTimeout: 1000,
        prefetchCount: 1,
        exchangeName: 'ex',
        queueName: 'q',
        routingKey: 'rk',
        retryAttempts: 1,
        retryDelay: 10,
      });
      const callback = jest.fn();
      const msg = { content: Buffer.from(JSON.stringify({ test: 1 })) };

      mockChannel.consume.mockImplementation((queue, fn) => {
        fn(msg); // Immediately invoke callback
        return Promise.resolve({ consumerTag: 'test' });
      });

      await rabbitUtils.consumeFromQueue('q', callback);
      expect(mockChannel.assertQueue).toHaveBeenCalledWith('q', { durable: true });
      expect(mockChannel.consume).toHaveBeenCalledWith(
        'q',
        expect.any(Function),
        { noAck: false }
      );
      expect(callback).toHaveBeenCalledWith({ test: 1 }, msg);
      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
    });
  });

  describe('closeRabbitMQ', () => {
    it('should close channel and connection gracefully', async () => {
      await rabbitUtils.connectRabbitMQ({
        url: 'amqp://test',
        heartbeat: 10,
        connectionTimeout: 1000,
        prefetchCount: 1,
        exchangeName: 'ex',
        queueName: 'q',
        routingKey: 'rk',
        retryAttempts: 1,
        retryDelay: 10,
      });
      await rabbitUtils.closeRabbitMQ();
      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalled();
    });
  });
});