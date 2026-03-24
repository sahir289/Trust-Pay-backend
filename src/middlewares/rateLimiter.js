// middlewares/rateLimiter.js
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import redisClient from '../utils/redisClient.js';
import config from '../config/config.js';
import { logger } from '../utils/logger.js';
import { publishBankResponse } from '../rabbitmq/producer.js';
import { Role } from '../constants/index.js';

const fallbackProfile = {
  points: 300,
  duration: 60,
  blockDuration: 30,
};

const createLimiter = (keyPrefix, profile) => {
  const limiterConfig = {
    keyPrefix,
    points: profile?.points || fallbackProfile.points,
    duration: profile?.duration || fallbackProfile.duration,
    blockDuration: profile?.blockDuration || fallbackProfile.blockDuration,
  };

  try {
    return new RateLimiterRedis({
      storeClient: redisClient,
      ...limiterConfig,
    });
  } catch (err) {
    logger.error('Redis unavailable, falling back to in-memory rate limiter', err);
    return new RateLimiterMemory(limiterConfig);
  }
};

const limiterProfiles = config.rateLimiter?.profiles || {};
const rateLimiter = createLimiter(
  'rl_bank_response',
  limiterProfiles.bankResponse || config.rateLimiter,
);
const globalRateLimiters = {
  auth: createLimiter('rl_global_auth', limiterProfiles.auth || config.rateLimiter),
  read: createLimiter('rl_global_read', limiterProfiles.read || config.rateLimiter),
  write: createLimiter('rl_global_write', limiterProfiles.write || config.rateLimiter),
  merchantIntegration: createLimiter(
    'rl_global_merchant_integration',
    limiterProfiles.merchantIntegration || config.rateLimiter,
  ),
  default: createLimiter('rl_global_default', config.rateLimiter),
};

export const rateLimitMiddleware = async (req, res, next) => {
  const key = req.user?.user_id ? String(req.user.user_id) : req.ip;

  try {
    await rateLimiter.consume(key);
    return next();
  } catch (error_) {
    const rejRes = error_;
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
  } catch (error_) {
    const rejRes = error_;
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

const GLOBAL_RATE_LIMIT_EXCLUDED_PATHS = new Set([
  // Excluded by requirement
  '/bankResponse/create-bot-message-bulk',
  '/bankResponse/import-bank-response',

  // Already handled by dedicated bank-response limiters
  '/bankResponse/create-bot-message',
  '/bankResponse/create-message',
]);

const isMerchantIntegrationPath = (path = '', method = 'GET') => {
  const normalizedPath = String(path).toLowerCase();
  const normalizedMethod = String(method).toUpperCase();

  if (normalizedMethod === 'GET' && normalizedPath === '/payin/generate-payin') {
    return true;
  }

  if (normalizedMethod === 'POST') {
    if (normalizedPath === '/payout/generate-payout') return true;
    if (normalizedPath === '/payin/check-payin-status') return true;
    if (normalizedPath === '/payout/check-payout-status') return true;
    if (normalizedPath.startsWith('/payin/assign-bank/')) return true;
  }

  return false;
};

const pickGlobalLimiterProfile = (req) => {
  const path = req.path || '';
  const method = (req.method || 'GET').toUpperCase();

  if (isMerchantIntegrationPath(path, method)) {
    return 'merchantIntegration';
  }

  if (path.startsWith('/auth/')) {
    return 'auth';
  }

  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return 'read';
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return 'write';
  }

  return 'default';
};

export const globalRateLimitMiddleware = async (req, res, next) => {
  if (GLOBAL_RATE_LIMIT_EXCLUDED_PATHS.has(req.path)) {
    return next();
  }

  const key = req.user?.user_id ? String(req.user.user_id) : req.ip;
  const profile = pickGlobalLimiterProfile(req);
  const limiter = globalRateLimiters[profile] || globalRateLimiters.default;
  const appliedProfile = limiterProfiles[profile] || config.rateLimiter;

  try {
    const rlRes = await limiter.consume(key);
    const remaining = Math.max(0, rlRes?.remainingPoints ?? 0);
    const limit = appliedProfile?.points || fallbackProfile.points;
    const resetSeconds = Math.max(0, Math.ceil((rlRes?.msBeforeNext || 0) / 1000));

    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(resetSeconds));
    res.setHeader('X-RateLimit-Profile', String(profile));

    return next();
  } catch (error_) {
    const rejRes = error_;
    const limit = appliedProfile?.points || fallbackProfile.points;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((rejRes?.msBeforeNext || 0) / 1000),
    );

    logger.warn(`Global rate limit exceeded for key: ${key}`, {
      key,
      points: rejRes.msBeforeNext / 1000,
      duration:
        limiterProfiles[profile]?.duration || config.rateLimiter.duration,
      path: req.path,
      method: req.method,
      profile,
    });

    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('X-RateLimit-Reset', String(retryAfterSeconds));
    res.setHeader('X-RateLimit-Profile', String(profile));
    res.setHeader('Retry-After', String(retryAfterSeconds));

    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
    });
  }
};