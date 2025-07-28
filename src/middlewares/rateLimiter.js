import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import { sendSuccess } from '../utils/responseHandlers.js';
import { logger } from '../utils/logger.js';
import chalk from 'chalk';

let redisAvailable = true;

export const redisClient = new Redis({
  host: '127.0.0.1',
  port: 6379,
  // password: 'test_Vikram', // only if needed
  maxRetriesPerRequest: 5,
  connectTimeout: 10000,
  retryStrategy: (times) => {
    const delay = Math.min(times * 100, 2000);
    const message = chalk.yellow(`Redis connection retry attempt ${times} – retrying in ${delay}ms`);
    logger.warn(message);
    return delay;
  },
});

// Handle Redis connection events
redisClient.on('error', (err) => {
  redisAvailable = false;
  const message = chalk.red(`Redis connection error: ${err.message}`);
  logger.error(message);
});

redisClient.on('connect', () => {
  redisAvailable = true;
    const message = chalk.green('Redis connection established successfully');
  logger.info(message);
});

// In-Memory Rate Limiter (when Redis is down) 
const fallbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  keyGenerator: (req) => req.headers['x-api-key'] || req.ip,
  handler: (req, res) => {
    const message = chalk.yellow(`[FallbackLimiter] Limit exceeded for ${req.ip}`);
    logger.warn(message);
    return sendSuccess(res, {}, 'Too many requests (fallback limiter)', 429);
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const redisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  }),
  keyGenerator: (req) => req.headers['x-api-key'] || req.ip,
  handler: (req, res) => {
    const message = chalk.yellow(`[RateLimit] Redis-backed limit exceeded for ${req.ip}`);
    logger.warn(message);
    return sendSuccess(
      res,
      {},
      'Too many requests, please try again later.',
      429,
    );
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiRateLimiter = (req, res, next) => {
  if (redisAvailable) {
    return redisLimiter(req, res, next);
  } else {
    return fallbackLimiter(req, res, next);
  }
};
