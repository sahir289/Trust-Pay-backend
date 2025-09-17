import amqp from 'amqplib';
import * as rabbitUtils from './rabbitmq.js';
import { logger } from './logger.js';

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

jest.mock('../config/config.js', () => ({
  rabbitmq: {
    exchangeName: 'ex',
    routingKey: 'rk',
    url: 'amqp://test',
    heartbeat: 10,
    connectionTimeout: 1000,
    prefetchCount: 1,
    queueName: 'q',
    retryAttempts: 1,
    retryDelay: 10,
  },
}));

describe('RabbitMQ Utilities', () => {
  let mockConnection, mockChannel;

  beforeEach(() => {
    jest.clearAllMocks();

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

    amqp.connect.mockReset();
    amqp.connect.mockImplementation(() => Promise.resolve(mockConnection));
  });

  afterEach(async () => {
    await rabbitUtils.closeRabbitMQ();
    jest.clearAllMocks();
  });

  describe('connectRabbitMQ', () => {
    it('should connect and setup channel successfully', async () => {
      const result = await rabbitUtils.connectRabbitMQ();

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
      expect(rabbitUtils.getRabbitChannel()).toBe(mockChannel);
      expect(result).toBe(mockChannel);
    });
  });

  describe('getRabbitChannel', () => {
    it('should return channel if initialized', async () => {
      await rabbitUtils.connectRabbitMQ();

      const channel = rabbitUtils.getRabbitChannel();

      expect(channel).toMatchObject({
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

    it('should throw error if channel not initialized', () => {
      expect(() => rabbitUtils.getRabbitChannel()).toThrow(
        'RabbitMQ channel not initialized. Did you call connectRabbitMQ()?'
      );
    });
  });

  describe('publishToQueue', () => {
    it('should publish a message to the exchange', async () => {
      await rabbitUtils.connectRabbitMQ();

      const data = { hello: 'world' };
      const result = await rabbitUtils.publishToQueue(data);

      expect(mockChannel.publish).toHaveBeenCalledWith(
        'ex',
        'rk',
        expect.any(Buffer),
        { persistent: true }
      );
      expect(result).toBe(true);
    });
  });

  describe('publishToDirectQueue', () => {
    it('should send a message to a queue', async () => {
      await rabbitUtils.connectRabbitMQ();

      const data = { msg: 'test' };
      const result = await rabbitUtils.publishToDirectQueue('q', data);

      expect(mockChannel.assertQueue).toHaveBeenCalledWith('q', { durable: true });
      expect(mockChannel.sendToQueue).toHaveBeenCalledWith('q', expect.any(Buffer), { persistent: true });
      expect(result).toBe(true);
    });
  });

  describe('closeRabbitMQ', () => {
    it('should close channel and connection', async () => {
      await rabbitUtils.connectRabbitMQ();
      await rabbitUtils.closeRabbitMQ();

      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();
      expect(() => rabbitUtils.getRabbitChannel()).toThrow();
    });
  });
});
