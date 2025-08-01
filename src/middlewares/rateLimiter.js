// middlewares/rateLimiter.js
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import redisClient from '../utils/redisClient.js';
import config from '../config/config.js';
import { logger } from '../utils/logger.js';
import { publishBankResponse } from '../utils/rabbitmq-bank-response.js';
import { Role } from '../constants/index.js';

console.log('RateLimiter config:', config.rateLimiter);

let rateLimiter;

// Try to use Redis-backed limiter
try {
  rateLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rl_bank_response',
    points: config.rateLimiter.points,
    duration: config.rateLimiter.duration,
    blockDuration: config.rateLimiter.blockDuration,
  });
} catch (err) {
  logger.error('Redis unavailable, falling back to in-memory rate limiter', err);
  rateLimiter = new RateLimiterMemory({
    keyPrefix: 'rl_bank_response',
    points: config.rateLimiter.points,
    duration: config.rateLimiter.duration,
    blockDuration: config.rateLimiter.blockDuration,
  });
}

export const rateLimitMiddleware = async (req, res, next) => {
  const key = req.user?.user_id ? String(req.user.user_id) : req.ip;

  try {
    await rateLimiter.consume(key);
    return next();
  } catch (rejRes) {
    logger.warn(`Rate limit exceeded for key: ${key}`, {
      key,
      points: rejRes.msBeforeNext / 1000,
      duration: config.rateLimiter.duration,
    });
    const payload = req.body?.body;
    const { role, user_name, company_id, user_id } = req.user || {};

    const bankResponseObject = {
      payload,
      role,
      user_name,
      company_id,
      user_id,
    };

    await publishBankResponse(bankResponseObject);

    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
    });
  }
};

export const rateLimitMiddlewareBot = async (req, res, next) => {
  const key = req.user?.user_id ? String(req.user.user_id) : req.ip;
  const x_auth_token = req.headers['x-auth-token'];

  try {
    await rateLimiter.consume(key);
    return next();
  } catch (rejRes) {
    logger.warn(`Rate limit exceeded for key: ${key}`, {
      key,
      points: rejRes.msBeforeNext / 1000,
      duration: config.rateLimiter.duration,
    });
    const payload = req.body?.body;

    const bankResponseObject = {
      payload,
      x_auth_token,
      role: Role.BOT,
    };

    await publishBankResponse(bankResponseObject);

    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
    });
  }
};