import crypto from 'node:crypto';
import config from '../config/config.js';
import { logger } from './logger.js';
import redisClient from './redisClient.js';

export const AUTH_SESSION_CACHE_TTL_SEC =
  config.controllerCacheTtls?.auth?.session || 30;

export const buildScopedCacheKey = (...segments) =>
  segments.filter(Boolean).join(':');

export const buildAuthSessionCacheKey = ({ user_id, company_id, session_id }) => {
  if (!user_id || !company_id || !session_id) {
    return null;
  }

  return buildScopedCacheKey('auth', 'session', company_id, user_id, session_id);
};

export const generateCacheKey = (params, prefix = 'cache') => {
  const paramString = JSON.stringify(params);
  return `${prefix}:${crypto.createHash('md5').update(paramString).digest('hex')}`;
};

export const getCachedData = async (cacheKey, label = 'cache') => {
  try {
    if (!cacheKey) {
      return null;
    }
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      logger.info(`${label} hit`);
      return JSON.parse(cachedData);
    }
    logger.info(`${label} miss`);
    return null;
  } catch (redisError) {
    logger.error('Redis get error:', redisError);
    return null;
  }
};

export const setCachedData = async (
  cacheKey,
  data,
  ttl = 300,
  label = 'cache',
) => {
  try {
    if (!cacheKey) {
      return;
    }
    await redisClient.set(cacheKey, JSON.stringify(data), 'EX', ttl);
    logger.info(`${label} cached`);
  } catch (redisError) {
    logger.error('Redis set error:', redisError);
  }
};

export const setCachedDataIfNotExists = async (
  cacheKey,
  data,
  ttl = 300,
  label = 'cache',
) => {
  try {
    if (!cacheKey) {
      return false;
    }

    const result = await redisClient.set(
      cacheKey,
      JSON.stringify(data),
      'EX',
      ttl,
      'NX',
    );

    const created = result === 'OK';
    logger.info(
      `${label} ${created ? 'created' : 'already exists'}`,
    );

    return created;
  } catch (redisError) {
    logger.error('Redis set NX error:', redisError);
    return false;
  }
};

export const deleteCachedData = async (cacheKey, label = 'cache') => {
  try {
    if (!cacheKey) {
      return;
    }
    await redisClient.del(cacheKey);
    logger.info(`${label} deleted`);
  } catch (redisError) {
    logger.error('Redis delete error:', redisError);
  }
};
export const setRedisHash = async (hashKey, data, label = 'redis hash') => {
  try {
    if (!hashKey) {
      return;
    }

    await redisClient.hset(hashKey, 'payload', JSON.stringify(data));
    logger.info(`${label} stored`);
  } catch (redisError) {
    logger.error('Redis hash set error:', redisError);
  }
};

export const getRedisHash = async (hashKey, label = 'redis hash') => {
  try {
    if (!hashKey) {
      return null;
    }
    const payload = await redisClient.hget(hashKey, 'payload');
    if (!payload) {
      logger.info(`${label} miss`);
      return null;
    }
    logger.info(`${label} hit`);
    return JSON.parse(payload);
  } catch (redisError) {
    logger.error('Redis hash get error:', redisError);
    return null;
  }
};
export const addToRedisQueue = async (
  queueKey,
  member,
  label = 'redis queue',
) => {
  try {
    if (!queueKey || !member) {
      return;
    }
    await redisClient.sadd(queueKey, String(member));
    logger.info(`${label} queued`);
  } catch (redisError) {
    logger.error('Redis queue add error:', redisError);
  }
};
export const getRedisQueueItems = async (
  queueKey,
  label = 'redis queue',
) => {
  try {
    if (!queueKey) {
      return [];
    }
    const items = await redisClient.smembers(queueKey);
    logger.info(`${label} items fetched`, { count: items.length });
    return items;
  } catch (redisError) {
    logger.error('Redis queue get error:', redisError);
    return [];
  }
};
export const removeFromRedisQueue = async (
  queueKey,
  member,
  label = 'redis queue',
) => {
  try {
    if (!queueKey || !member) {
      return;
    }

    await redisClient.srem(queueKey, String(member));
    logger.info(`${label} removed`);
  } catch (redisError) {
    logger.error('Redis queue remove error:', redisError);
  }
};
export const deleteRedisKey = async (redisKey, label = 'redis key') => {
  try {
    if (!redisKey) {
      return;
    }
    await redisClient.del(redisKey);
    logger.info(`${label} deleted`);
  } catch (redisError) {
    logger.error('Redis key delete error:', redisError);
  }
};