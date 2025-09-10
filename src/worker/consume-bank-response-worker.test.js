import { startBankResponseWorker } from './consume-bank-response-worker.js';
import * as rabbitmq from '../utils/rabbitmq.js';
import * as bankResponseService from '../apis/bankResponse/bankResponseServices.js';
import { logger } from '../utils/logger.js';

jest.mock('../utils/rabbitmq.js');
jest.mock('../apis/bankResponse/bankResponseServices.js');
jest.mock('../utils/logger.js');

describe('startBankResponseWorker', () => {
  let mockChannel;

  beforeEach(() => {
    jest.clearAllMocks();

    mockChannel = {
      assertQueue: jest.fn(),
      consume: jest.fn(),
      ack: jest.fn(),
      nack: jest.fn(),
    };

    rabbitmq.connectRabbitMQ.mockResolvedValue();
    rabbitmq.getRabbitChannel.mockReturnValue(mockChannel);
  });

  it('should start worker and consume messages successfully', async () => {
    const message = {
      content: Buffer.from(JSON.stringify({
        payload: { id: 1 },
        x_auth_token: 'token',
        role: 'admin'
      })),
    };

    // Mock consume to immediately call the callback with a message
    mockChannel.consume.mockImplementation((queue, callback) => {
      callback(message);
    });

    bankResponseService.createBankResponseService.mockResolvedValue();

    await startBankResponseWorker();

    expect(rabbitmq.connectRabbitMQ).toHaveBeenCalled();
    expect(mockChannel.assertQueue).toHaveBeenCalledWith(
      expect.any(String),
      { durable: true }
    );
    expect(bankResponseService.createBankResponseService).toHaveBeenCalledWith(
      { id: 1 },
      'token',
      'admin',
      null
    );
    expect(mockChannel.ack).toHaveBeenCalledWith(message);
    expect(logger.info).toHaveBeenCalledWith(
      '[Worker] Bank response processed successfully:',
      expect.any(Object)
    );
  });

  it('should nack message on service error', async () => {
    const message = {
      content: Buffer.from(JSON.stringify({
        payload: { id: 2 },
        x_auth_token: 'token2',
        role: 'user'
      })),
    };

    mockChannel.consume.mockImplementation((queue, callback) => {
      callback(message);
    });

    const error = new Error('Service failed');
    bankResponseService.createBankResponseService.mockRejectedValue(error);

    await startBankResponseWorker();

    expect(mockChannel.nack).toHaveBeenCalledWith(message, false, false);
    expect(logger.error).toHaveBeenCalledWith(
      '[Worker] Error processing bank response:',
      error
    );
  });

  it('should log error if RabbitMQ connection fails', async () => {
    const error = new Error('Connection failed');
    rabbitmq.connectRabbitMQ.mockRejectedValue(error);

    await startBankResponseWorker();

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to connect to RabbitMQ:',
      error
    );
  });
});
