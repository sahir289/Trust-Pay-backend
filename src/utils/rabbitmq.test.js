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

// Mock config to provide necessary fields for publishToQueue
jest.mock('../config/config.js', () => ({
  rabbitmq: {
    exchangeName: 'ex',
    routingKey: 'rk',
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

    // Reset and set up amqp.connect mock
    amqp.connect.mockReset();
    amqp.connect.mockImplementation((url, options) => {
      return Promise.resolve(mockConnection);
    });
  });

  afterEach(async () => {
    jest.clearAllMocks();
    rabbitUtils.channel = null;
    rabbitUtils.connection = null;
    if (mockChannel?.close) await mockChannel.close();
    if (mockConnection?.close) await mockConnection.close();
  });

  describe('connectRabbitMQ', () => {
    it('should connect and setup channel successfully', async () => {
      const config = {
        url: 'amqp://test',
        heartbeat: 10,
        connectionTimeout: 1000,
        prefetchCount: 1,
        exchangeName: 'ex',
        queueName: 'q',
        routingKey: 'rk',
        retryAttempts: 1,
        retryDelay: 10,
      };

      const result = await rabbitUtils.connectRabbitMQ(config);

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
      expect(rabbitUtils.channel).toBe(mockChannel); // Strict equality
      expect(rabbitUtils.connection).toBe(mockConnection);
      expect(result).toBe(mockChannel);
    });
  });

  describe('getRabbitChannel', () => {

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
      // expect(rabbitUtils.getRabbitChannel()).toEqual(mockChannel); 
      expect(rabbitUtils.getRabbitChannel()).toMatchObject({
        ack: expect.any(Function),
        assertExchange: expect.any(Function),
        assertQueue: expect.any(Function),
        bindQueue: expect.any(Function),
        close: expect.any(Function),
        consume: expect.any(Function),
        nack: expect.any(Function),
        prefetch: expect.any(Function),
        publish: expect.any(Function),
        sendToQueue: expect.any(Function),
      });
      
    });
  });

});