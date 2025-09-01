import {
  methodNotFound,
  addLogIdInRequest,
} from './requestExtension.js';
import { logger } from '../utils/logger.js';

jest.mock('../utils/logger.js', () => ({
  logger: {
    error: jest.fn(),
    log: jest.fn(),
  },
}));

jest.mock('../utils/generateUUID.js', () => ({
  generateUUID: jest.fn(() => 'mock-uuid-123'),
}));

describe('Middleware Tests', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      originalUrl: '/test/url',
      headers: { 'user-agent': 'jest-agent' },
      method: 'GET',
      hostname: 'localhost',
      ip: '127.0.0.1',
      body: { test: 'data' },
      query: { q: 'test' },
      params: { id: 1 },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('methodNotFound', () => {
    it('should return 404 with error message and log error', () => {
      methodNotFound(req, res);

      expect(logger.error).toHaveBeenCalledWith(
        'the url you are trying to reach is not hosted on our server'
      );
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        type: 'error',
        message: 'the url you are trying to reach is not hosted on our server',
      });
    });
  });

  describe('addLogIdInRequest', () => {
    it('should add identifier and log request data', () => {
      addLogIdInRequest(req, res, next);

      expect(req.identifier).toBe('mock-uuid-123');
      expect(logger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          Request_uuid: 'mock-uuid-123',
          url: '/test/url',
          userAgent: 'jest-agent',
          method: 'GET',
          hostname: 'localhost',
          ip: '127.0.0.1',
          body: { test: 'data' },
          query: { q: 'test' },
          params: { id: 1 },
          timestamp: expect.any(String),
        })
      );
      expect(next).toHaveBeenCalled();
    });

    it('should not log body for /auth/ routes', () => {
      req.originalUrl = '/auth/login';
      addLogIdInRequest(req, res, next);

      expect(logger.log).toHaveBeenCalledWith(
        expect.not.objectContaining({
          body: expect.any(Object),
        })
      );
      expect(next).toHaveBeenCalled();
    });
  });
});
