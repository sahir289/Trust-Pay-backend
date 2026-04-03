import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
import config from '../../config/config.js';
import redisClient from '../redisClient.js';
import { logger } from '../logger.js';

const defaultSocketProfiles = {
  connect: { points: 30, duration: 60, blockDuration: 60 },
  authEvent: { points: 60, duration: 60, blockDuration: 30 },
  genericEvent: { points: 180, duration: 60, blockDuration: 20 },
};

const createSocketLimiter = (keyPrefix, profile) => {
  const limiterConfig = {
    keyPrefix,
    points: profile?.points || 60,
    duration: profile?.duration || 60,
    blockDuration: profile?.blockDuration || 30,
  };

  try {
    return new RateLimiterRedis({
      storeClient: redisClient,
      ...limiterConfig,
    });
  } catch (error) {
    logger.error('[SOCKET] Redis unavailable, using in-memory socket limiter', error);
    return new RateLimiterMemory(limiterConfig);
  }
};

const socketLimiterProfiles = {
  connect: createSocketLimiter(
    'rl_socket_connect',
    config.rateLimiter?.profiles?.auth || defaultSocketProfiles.connect,
  ),
  authEvent: createSocketLimiter(
    'rl_socket_auth_event',
    defaultSocketProfiles.authEvent,
  ),
  genericEvent: createSocketLimiter(
    'rl_socket_generic_event',
    config.rateLimiter?.profiles?.read || defaultSocketProfiles.genericEvent,
  ),
};

const consumeSocketRateLimit = async (limiter, key, context) => {
  try {
    await limiter.consume(key);
    return true;
  } catch (error) {
    logger.warn(`[SOCKET] Rate limit exceeded during ${context}`, {
      key,
      context,
      msBeforeNext: error?.msBeforeNext,
    });
    return false;
  }
};

const getSocketClientAddress = (socket) => {
  const forwardedFor = socket.handshake?.headers?.['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim();
  }

  return socket.handshake?.address || socket.conn?.remoteAddress || 'unknown';
};

export {
  consumeSocketRateLimit,
  getSocketClientAddress,
  socketLimiterProfiles,
};
