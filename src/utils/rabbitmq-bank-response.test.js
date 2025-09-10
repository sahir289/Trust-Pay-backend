import { publishBankResponse, consumeBankResponses, startBankResponseWorker } from './rabbitmq-bank-response.js';
import { getRabbitChannel } from './rabbitmq.js';
import { logger } from './logger.js';
import config from '../config/config.js';

jest.mock('./rabbitmq.js');
jest.mock('./logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('RabbitMQ Helpers', () => {
  let mockChannel;

  beforeEach(() => {
    jest.clearAllMocks();
    mockChannel = {
      assertQueue: jest.fn().mockResolvedValue(true),
      sendToQueue: jest.fn().mockReturnValue(true),
      consume: jest.fn(),
      ack: jest.fn(),
      nack: jest.fn(),
    };
    getRabbitChannel.mockReturnValue(mockChannel);
  });

  describe('publishBankResponse', () => {
    it('should publish a message successfully', async () => {
      const responseData = { id: 1, status: 'success' };
      const result = await publishBankResponse(responseData);

      expect(mockChannel.assertQueue).toHaveBeenCalledWith(config.rabbitmq.bankResponseQueue, { durable: true });
      expect(mockChannel.sendToQueue).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        '[RabbitMQ] Published to bankResponseQueue:',
        responseData
      );
      expect(result).toBe(true);
    });

    it('should log error if sendToQueue fails', async () => {
      mockChannel.sendToQueue.mockReturnValue(false);
      const responseData = { id: 2 };
      await publishBankResponse(responseData);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to publish bank response to RabbitMQ',
        responseData
      );
    });

    it('should throw if channel not initialized', async () => {
      getRabbitChannel.mockReturnValue(null);
      await expect(publishBankResponse({})).rejects.toThrow('RabbitMQ channel not initialized');
    });
  });

  describe('consumeBankResponses', () => {
    it('should consume messages and call callback', async () => {
      const msg = { content: Buffer.from(JSON.stringify({ id: 1 })) };
      const callback = jest.fn().mockResolvedValue(true);

      mockChannel.consume.mockImplementation(async (queue, fn) => {
        await fn(msg);
      });

      await consumeBankResponses(callback);

      expect(callback).toHaveBeenCalledWith({ id: 1 }, msg);
      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
      expect(logger.info).toHaveBeenCalledWith('[RabbitMQ] Consumed from bankResponseQueue:', { id: 1 });
    });

    it('should nack and log error on invalid JSON', async () => {
      const msg = { content: Buffer.from('invalid') };
      const callback = jest.fn();

      mockChannel.consume.mockImplementation(async (queue, fn) => {
        await fn(msg);
      });

      await consumeBankResponses(callback);

      expect(mockChannel.nack).toHaveBeenCalledWith(msg, false, false);
      expect(logger.error).toHaveBeenCalledWith('Error processing bank response:', expect.any(SyntaxError));
    });
  });

  describe('startBankResponseWorker', () => {
    it('should process messages with processFn and ack', async () => {
      const msg = { content: Buffer.from(JSON.stringify({ id: 10 })) };
      const processFn = jest.fn().mockResolvedValue(true);

      mockChannel.consume.mockImplementation(async (queue, fn) => {
        await fn(msg);
      });

      await startBankResponseWorker(processFn);

      expect(processFn).toHaveBeenCalledWith({ id: 10 });
      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
      expect(logger.info).toHaveBeenCalledWith('[RabbitMQ Worker] Processed bank response:', { id: 10 });
    });

    it('should nack and log error if processFn fails', async () => {
      const msg = { content: Buffer.from(JSON.stringify({ id: 11 })) };
      const processFn = jest.fn().mockRejectedValue(new Error('fail'));

      mockChannel.consume.mockImplementation(async (queue, fn) => {
        await fn(msg);
      });

      await startBankResponseWorker(processFn);

      expect(mockChannel.nack).toHaveBeenCalledWith(msg, false, false);
      expect(logger.error).toHaveBeenCalledWith('[RabbitMQ Worker] Error processing bank response:', expect.any(Error));
    });
  });
});
