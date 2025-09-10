import amqp from 'amqplib';
import * as rabbitUtils from './rabbitmq.js';
import { logger } from './logger.js';

jest.mock('amqplib');
jest.mock('./logger.js', () => ({
  logger: { info: jest.fn(), log: jest.fn(), error: jest.fn() },
}));

describe('RabbitMQ Utilities', () => {
  let mockConnection, mockChannel;

  beforeEach(() => {
    jest.clearAllMocks();
    rabbitUtils.channel = null;
    rabbitUtils.connection = null;
  
    mockChannel = {
      prefetch: jest.fn(),
      assertExchange: jest.fn(),
      assertQueue: jest.fn(),
      bindQueue: jest.fn(),
      publish: jest.fn(),
      sendToQueue: jest.fn(),
      consume: jest.fn(),
      ack: jest.fn(),
      nack: jest.fn(),
      close: jest.fn(),
    };
  
    mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
      on: jest.fn(),
      close: jest.fn(),
    };
  
    amqp.connect.mockResolvedValue(mockConnection);
  });
  

  describe('connectRabbitMQ', () => {
    it('should connect and setup channel successfully', async () => {
      await rabbitUtils.connectRabbitMQ({ 
        url: 'amqp://test', heartbeat: 10, connectionTimeout: 1000, 
        prefetchCount: 1, exchangeName: 'ex', queueName: 'q', routingKey: 'rk', 
        retryAttempts: 1, retryDelay: 10 
      });

      expect(amqp.connect).toHaveBeenCalled();
      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(mockChannel.assertExchange).toHaveBeenCalledWith('ex', 'direct', { durable: true });
      expect(mockChannel.assertQueue).toHaveBeenCalledWith('q', { durable: true });
      expect(mockChannel.bindQueue).toHaveBeenCalledWith('q', 'ex', 'rk');
      expect(logger.info).toHaveBeenCalled();
    });

    it('should retry connection on failure', async () => {
      amqp.connect.mockRejectedValueOnce(new Error('fail')).mockResolvedValue(mockConnection);
      await rabbitUtils.connectRabbitMQ({
        url: 'amqp://test', heartbeat: 10, connectionTimeout: 1000,
        prefetchCount: 1, exchangeName: 'ex', queueName: 'q', routingKey: 'rk',
        retryAttempts: 2, retryDelay: 1
      });
      expect(amqp.connect).toHaveBeenCalledTimes(2);
    });
  });

  describe('getRabbitChannel', () => {
    it('should throw if channel not initialized', () => {
      // reset channel
      rabbitUtils.channel = null;
      expect(() => rabbitUtils.getRabbitChannel()).toThrow('RabbitMQ channel not initialized');
    });
  });

  describe('publishToQueue', () => {
    it('should call channel.publish', async () => {
      rabbitUtils.channel = mockChannel;  // removed 'as any'
      const data = { a: 1 };
      await rabbitUtils.publishToQueue(data);
      expect(mockChannel.publish).toHaveBeenCalled();
    });
  });  

  describe('publishToDirectQueue', () => {
    it('should call sendToQueue', async () => {
      rabbitUtils.channel = mockChannel;
      const data = { a: 2 };
      await rabbitUtils.publishToDirectQueue('myQueue', data);
      expect(mockChannel.assertQueue).toHaveBeenCalledWith('myQueue', { durable: true });
      expect(mockChannel.sendToQueue).toHaveBeenCalled();
    });
  });

  describe('consumeFromQueue', () => {
    it('should call consume and ack message', async () => {
      rabbitUtils.channel = mockChannel;
      const callback = jest.fn();
      const msg = { content: Buffer.from(JSON.stringify({ test: 1 })) };
      mockChannel.consume.mockImplementation(async (queue, fn) => {
        await fn(msg);
      });

      await rabbitUtils.consumeFromQueue('q', callback);
      expect(callback).toHaveBeenCalledWith({ test: 1 }, msg);
      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
    });
  });

  describe('closeRabbitMQ', () => {
    it('should close channel and connection gracefully', async () => {
      rabbitUtils.channel = mockChannel;
      rabbitUtils.connection = mockConnection; // <-- fixed here
  
      await rabbitUtils.closeRabbitMQ();
      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalled();
    });
  });
  
});
