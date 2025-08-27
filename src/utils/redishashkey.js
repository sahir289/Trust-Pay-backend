import crypto from 'crypto';
import { logger } from './logger.js';
import redisClient from './redisClient.js';


export const generateCacheKey = (params, prefix = 'cache') => {
  const paramString = JSON.stringify(params);
  return `${prefix}:${crypto.createHash('md5').update(paramString).digest('hex')}`;
};

export const getCachedData = async (cacheKey) => {
  try {
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      logger.info(`Cache hit for key: ${cacheKey}`);
      return JSON.parse(cachedData);
    }
    logger.info(`Cache miss for key: ${cacheKey}`);
    return null;
  } catch (redisError) {
    logger.error('Redis get error:', redisError);
    return null;
  }
};

export const setCachedData = async (cacheKey, data, ttl = 300) => {
  try {
    await redisClient.set(cacheKey, JSON.stringify(data), 'EX', ttl);
    logger.info(`Cached result for key: ${cacheKey}`);
  } catch (redisError) {
    logger.error('Redis set error:', redisError);
  }
};
