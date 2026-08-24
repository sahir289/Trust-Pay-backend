// middlewares/rateLimiter.js
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import { createHash } from 'node:crypto';
import redisClient from '../utils/redisClient.js';
import config from '../config/config.js';
import { logger } from '../utils/logger.js';
import { publishBankResponse } from '../rabbitmq/producer.js';
import { Role } from '../constants/index.js';
import { AUTH_HEADER_KEY } from '../utils/constants.js';

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
      // Once a key exhausts its points, block it in-process so floods stop
      // generating a Redis round trip per request.
      inMemoryBlockOnConsumed: limiterConfig.points,
      inMemoryBlockDuration: limiterConfig.blockDuration,
      // A Redis outage degrades to per-process limiting instead of throwing
      // (a thrown Redis error is otherwise indistinguishable from a 429).
      insuranceLimiter: new RateLimiterMemory(limiterConfig),
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

const resolveClientIp = (req) => {
  // Prefer Express's computed req.ip. With `trust proxy` configured, this is the real client address and cannot be spoofed by a client-supplied X-Forwarded-For header (the load balancer rewrites/appends it). Only fall back to raw headers if req.ip is somehow unavailable.
  if (req?.ip) return req.ip;

  const xForwardedFor = req?.headers?.['x-forwarded-for'];
  if (xForwardedFor) {
    const forwarded = String(xForwardedFor).split(',')[0]?.trim();
    if (forwarded) return forwarded;
  }

  return req?.connection?.remoteAddress || 'unknown';
};

const hashToken = (token) =>
  createHash('sha256').update(String(token)).digest('hex').slice(0, 24);

const getRateLimitKey = (req) => {
  if (req.user?.user_id) {
    return `user:${String(req.user.user_id)}`;
  }

  const xAuthToken = req.header(AUTH_HEADER_KEY);
  if (xAuthToken) {
    return `token:${hashToken(xAuthToken)}`;
  }

  const authHeader = req.header('authorization');
  const bearerToken = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearerToken) {
    return `token:${hashToken(bearerToken)}`;
  }

  return `ip:${resolveClientIp(req)}`;
};

// Per-MERCHANT bucket key for the merchant-facing endpoints. Derives the key
// from the auth material every merchant request already carries so one merchant
// cannot exhaust capacity for the others (the generic getRateLimitKey falls back
// to IP for merchant traffic, which buckets all merchants behind one NAT/proxy
// together). Supports both v2 auth styles: `x-auth-code` (checkAuthCode) and
// `code` + `x-api-key` (checkMerchantApiKeyV2). Falls back to IP when no
// merchant identity is present.
const getMerchantRateLimitKey = (req) => {
  const authCode = req.headers?.['x-auth-code'];
  if (authCode) {
    return `merchant:${hashToken(authCode)}`;
  }

  const code = req.headers?.['code'] || req.body?.code || req.query?.code;
  if (code) {
    const apiKey = req.headers?.['x-api-key'] || '';
    const identity = `${code}:${apiKey}`;
    return `merchant:${hashToken(identity)}`;
  }

  return `ip:${resolveClientIp(req)}`;
};

// Per-merchant rate limiter for the v2 merchant endpoints (payIn / payOut /
// walletBalance). Reuses the shared `merchantIntegration` limiter + profile and
// the same helpers as the other limiters; it only differs in the bucket key
// (per-merchant instead of per-IP/user/token) and runs at the route level in
// addition to the global limiter mounted on the v2 router (layered defense).
export const merchantApiRateLimiter = async (req, res, next) => {
  const key = getMerchantRateLimitKey(req);
  const limiter = globalRateLimiters.merchantIntegration;
  const appliedProfile = limiterProfiles.merchantIntegration || config.rateLimiter;
  const limit = appliedProfile?.points || fallbackProfile.points;

  try {
    const rlRes = await limiter.consume(key);
    const remaining = Math.max(0, rlRes?.remainingPoints ?? 0);
    const resetSeconds = Math.max(0, Math.ceil((rlRes?.msBeforeNext || 0) / 1000));

    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(resetSeconds));
    res.setHeader('X-RateLimit-Scope', 'merchant');

    return next();
  } catch (error_) {
    const retryAfter = Math.max(1, Math.ceil((error_?.msBeforeNext || 0) / 1000));

    logger.warn(`Merchant rate limit exceeded for key: ${key}`, {
      key,
      retryAfter,
      path: req.path,
      method: req.method,
    });

    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('X-RateLimit-Reset', String(retryAfter));
    res.setHeader('X-RateLimit-Scope', 'merchant');
    res.setHeader('Retry-After', String(retryAfter));

    return res.status(429).json({
      statusCode: 429,
      success: false,
      message: 'Too many requests. Please try again later.',
    });
  }
};

export const rateLimitMiddleware = async (req, res, next) => {
  const key = getRateLimitKey(req);

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
      statusCode: 429,
      success: false,
      message: 'Too many requests. Please try again later.',
    });
  }
};

export const rateLimitMiddlewareBot = async (req, res, next) => {
  const key = getRateLimitKey(req);
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
      statusCode: 429,
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

  const key = getRateLimitKey(req);
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
      statusCode: 429,
      success: false,
      message: 'Too many requests. Please try again later.',
    });
  }
};