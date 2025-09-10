import { generateCacheKey, getCachedData, setCachedData } from './redishashkey.js';
import redisClient from './redisClient.js';
import { logger } from './logger.js';
import crypto from 'crypto';

jest.mock('./redisClient.js', () => ({
  get: jest.fn(),
  set: jest.fn(),
}));

jest.mock('./logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

describe('Cache Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateCacheKey', () => {
    it('should generate a consistent MD5-based cache key', () => {
      const params = { user: 1, type: 'admin' };
      const key = generateCacheKey(params, 'testPrefix');
      const expectedHash = crypto.createHash('md5').update(JSON.stringify(params)).digest('hex');
      expect(key).toBe(`testPrefix:${expectedHash}`);
    });
  });

  describe('getCachedData', () => {
    it('should return parsed cached data on cache hit', async () => {
      const cacheKey = 'cache:123';
      const data = { value: 42 };
      redisClient.get.mockResolvedValueOnce(JSON.stringify(data));

      const result = await getCachedData(cacheKey);
      expect(result).toEqual(data);
      expect(logger.info).toHaveBeenCalledWith(`Cache hit for key: ${cacheKey}`);
    });

    it('should return null on cache miss', async () => {
      const cacheKey = 'cache:456';
      redisClient.get.mockResolvedValueOnce(null);

      const result = await getCachedData(cacheKey);
      expect(result).toBeNull();
      expect(logger.info).toHaveBeenCalledWith(`Cache miss for key: ${cacheKey}`);
    });

    it('should handle Redis errors gracefully', async () => {
      const cacheKey = 'cache:error';
      const error = new Error('fail');
      redisClient.get.mockRejectedValueOnce(error);

      const result = await getCachedData(cacheKey);
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith('Redis get error:', error);
    });
  });

  describe('setCachedData', () => {
    it('should set data in Redis with TTL', async () => {
      const cacheKey = 'cache:123';
      const data = { value: 42 };
      await setCachedData(cacheKey, data, 600);

      expect(redisClient.set).toHaveBeenCalledWith(cacheKey, JSON.stringify(data), 'EX', 600);
      expect(logger.info).toHaveBeenCalledWith(`Cached result for key: ${cacheKey}`);
    });

    it('should handle Redis set errors gracefully', async () => {
      const cacheKey = 'cache:error';
      const data = { value: 42 };
      const error = new Error('fail');
      redisClient.set.mockRejectedValueOnce(error);

      await setCachedData(cacheKey, data);
      expect(logger.error).toHaveBeenCalledWith('Redis set error:', error);
    });
  });
});
