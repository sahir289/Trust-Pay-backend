// __tests__/rateLimiter.test.js
import { rateLimitMiddleware, rateLimitMiddlewareBot } from '../middlewares/rateLimiter.js';
import { publishBankResponse } from '../utils/rabbitmq-bank-response.js';
import { logger } from '../utils/logger.js';
import { Role } from '../constants/index.js';

let rateLimiterInstance;

// Mock rate-limiter-flexible before importing middleware
jest.mock('rate-limiter-flexible', () => {
  const consumeMock = jest.fn();
  const RateLimiterRedisMock = jest.fn(() => ({ consume: consumeMock }));
  return { 
    RateLimiterRedis: RateLimiterRedisMock,
    RateLimiterMemory: jest.fn(() => ({ consume: jest.fn() })),
  };
});

jest.mock('../utils/rabbitmq-bank-response.js', () => ({
  publishBankResponse: jest.fn(),
}));

jest.mock('../utils/logger.js', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), log: jest.fn() },
}));

describe('RateLimiter Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    const { RateLimiterRedis } = require('rate-limiter-flexible');
    rateLimiterInstance = new RateLimiterRedis(); // track instance used by middleware

    mockReq = {
      ip: '127.0.0.1',
      user: { user_id: '123', user_name: 'TestUser', company_id: 'c1', role: 'USER' },
      body: { body: { foo: 'bar' } },
      headers: { 'x-auth-token': 'token123' },
    };

    mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    mockNext = jest.fn();
  });

  describe('rateLimitMiddleware', () => {
    it('calls next when rate limit not exceeded', async () => {
      rateLimiterInstance.consume.mockResolvedValueOnce({ remainingPoints: 5 });

      await rateLimitMiddleware(mockReq, mockRes, mockNext);

      expect(rateLimiterInstance.consume).toHaveBeenCalledWith('123');
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('returns 429 and publishes bank response when rate limit exceeded', async () => {
      rateLimiterInstance.consume.mockRejectedValueOnce({ msBeforeNext: 5000 });

      await rateLimitMiddleware(mockReq, mockRes, mockNext);

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Rate limit exceeded for key: 123'), expect.any(Object));
      expect(publishBankResponse).toHaveBeenCalledWith({
        payload: { foo: 'bar' },
        role: 'USER',
        user_name: 'TestUser',
        company_id: 'c1',
        user_id: '123',
      });
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({ success: false, message: 'Too many requests. Please try again later.' });
    });
  });

  describe('rateLimitMiddlewareBot', () => {
    it('calls next when rate limit not exceeded', async () => {
      rateLimiterInstance.consume.mockResolvedValueOnce({ remainingPoints: 5 });

      await rateLimitMiddlewareBot(mockReq, mockRes, mockNext);

      expect(rateLimiterInstance.consume).toHaveBeenCalledWith('123');
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('returns 429 and publishes bank response for bot when rate limit exceeded', async () => {
      rateLimiterInstance.consume.mockRejectedValueOnce({ msBeforeNext: 3000 });

      await rateLimitMiddlewareBot(mockReq, mockRes, mockNext);

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Rate limit exceeded for key: 123'), expect.any(Object));
      expect(publishBankResponse).toHaveBeenCalledWith({
        payload: { foo: 'bar' },
        x_auth_token: 'token123',
        role: Role.BOT,
      });
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({ success: false, message: 'Too many requests. Please try again later.' });
    });
  });
});
