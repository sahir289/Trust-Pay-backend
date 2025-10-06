import { publishBankResponse, consumeBankResponses, startBankResponseWorker } from './rabbitmq-bank-response.js';
import { getRabbitChannel, connectRabbitMQ, publishWithRetry } from './rabbitmq.js';
import { logger } from './logger.js';
import config from '../config/config.js';
import { createBankResponseService } from '../apis/bankResponse/bankResponseServices.js';

jest.mock('./rabbitmq.js');
jest.mock('./logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));
jest.mock('../apis/bankResponse/bankResponseServices.js', () => ({
  createBankResponseService: jest.fn().mockResolvedValue(true),
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
      connection: { closed: false },
    };
    getRabbitChannel.mockResolvedValue(mockChannel);
    publishWithRetry.mockResolvedValue(true);
  });

  describe('publishBankResponse', () => {
    it('should publish a message successfully', async () => {
      const responseData = { id: 1, status: 'success' };
      const result = await publishBankResponse(responseData);

      expect(mockChannel.assertQueue).toHaveBeenCalledWith(
        config.rabbitmq.bankResponseQueue,
        { durable: true }
      );
      expect(publishWithRetry).toHaveBeenCalled(); // ✅ correct method
      expect(logger.info).toHaveBeenCalledWith(
        '[RabbitMQ] Published to bankResponseQueue:',
        responseData
      );
      expect(result).toBe(true);
    });

    it('should fallback to DB if publishWithRetry fails', async () => {
      publishWithRetry.mockResolvedValue(false);
      const responseData = { id: 2, payload: {}, x_auth_token: 'x', role: 'r' };

      await publishBankResponse(responseData);

      expect(createBankResponseService).toHaveBeenCalledWith(
        responseData.payload,
        responseData.x_auth_token,
        responseData.role,
        null
      );
      expect(logger.error).toHaveBeenCalledWith(
        '[RabbitMQ] Failed to publish after retries, saving to DB fallback'
      );
    });

    it('should reconnect if channel is closed', async () => {
      mockChannel.connection.closed = true;
      connectRabbitMQ.mockResolvedValue(mockChannel);
      const responseData = { id: 3 };

      await publishBankResponse(responseData);

      expect(logger.warn).toHaveBeenCalledWith(
        'RabbitMQ channel closed, reconnecting...'
      );
      expect(connectRabbitMQ).toHaveBeenCalled();
    });

    it('should handle thrown errors and save to DB', async () => {
      getRabbitChannel.mockRejectedValue(new Error('fail'));
      const responseData = { payload: {}, x_auth_token: 'x', role: 'r' };

      await expect(publishBankResponse(responseData)).rejects.toThrow('fail');
      expect(logger.error).toHaveBeenCalledWith(
        '[RabbitMQ] Publish failed:',
        'fail'
      );
      expect(createBankResponseService).toHaveBeenCalled();
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
