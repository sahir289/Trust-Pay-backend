// __tests__/bankResponseRoute.test.js
import request from 'supertest';
import express from 'express';
import router from './index.js'; 
import { getRabbitChannel } from '../utils/rabbitmq.js';
import config from '../config/config.js';
import { createBankResponseService } from '../bankResponse/bankResponseServices.js';

jest.mock('../utils/rabbitmq.js');
jest.mock('../routes/bankResponse/bankResponseServices.js');
jest.mock('../config/config.js', () => ({
  rabbitmq: {
    bankResponseQueue: 'test-bank-response-queue',
  },
}));

const app = express();
app.use(express.json());
app.use('/', router);

describe('POST /consume-bank-response', () => {
  let mockChannel;

  beforeEach(() => {
    mockChannel = {
      assertQueue: jest.fn(),
      get: jest.fn(),
      ack: jest.fn(),
      nack: jest.fn(),
    };
    jest.clearAllMocks();
  });

  it('should process messages successfully', async () => {
    const fakeMessage = {
      content: Buffer.from(
        JSON.stringify({
          payload: { id: 1 },
          x_auth_token: 'token',
          role: 'admin',
        })
      ),
    };

    getRabbitChannel.mockReturnValue(mockChannel);
    mockChannel.get
      .mockResolvedValueOnce(fakeMessage) // first message
      .mockResolvedValueOnce(null); // no more messages
    createBankResponseService.mockResolvedValue({ id: 1, status: 'processed' });

    const res = await request(app).post('/consume-bank-response');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.results).toEqual([
      { success: true, result: { id: 1, status: 'processed' } },
    ]);
    expect(mockChannel.ack).toHaveBeenCalledWith(fakeMessage);
  });

  it('should return "No messages in queue" when queue is empty', async () => {
    getRabbitChannel.mockReturnValue(mockChannel);
    mockChannel.get.mockResolvedValue(null);

    const res = await request(app).post('/consume-bank-response');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: false,
      message: 'No messages in queue',
    });
  });

  it('should handle error when processing a message', async () => {
    const fakeMessage = {
      content: Buffer.from(
        JSON.stringify({
          payload: { id: 2 },
          x_auth_token: 'bad-token',
          role: 'user',
        })
      ),
    };

    getRabbitChannel.mockReturnValue(mockChannel);
    mockChannel.get
      .mockResolvedValueOnce(fakeMessage)
      .mockResolvedValueOnce(null);
    createBankResponseService.mockRejectedValue(new Error('Invalid token'));

    const res = await request(app).post('/consume-bank-response');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.results).toEqual([
      { success: false, error: 'Invalid token' },
    ]);
    expect(mockChannel.nack).toHaveBeenCalledWith(fakeMessage, false, false);
  });

  it('should return 500 if RabbitMQ channel is not initialized', async () => {
    getRabbitChannel.mockReturnValue(null);

    const res = await request(app).post('/consume-bank-response');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('RabbitMQ channel not initialized');
  });

  it('should return 500 on unexpected error', async () => {
    getRabbitChannel.mockImplementation(() => {
      throw new Error('Unexpected RabbitMQ failure');
    });

    const res = await request(app).post('/consume-bank-response');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Unexpected RabbitMQ failure');
  });
});
