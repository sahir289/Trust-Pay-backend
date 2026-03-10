import redisClient from './redisClient.js';
import { logger } from './logger.js';

export const normalizeQueryForCache = (query = {}) =>
  Object.fromEntries(
    Object.entries(query)
      .filter(([, value]) => value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)),
  );

export const readJsonCache = async (cacheKey, label = 'cache') => {
  const cached = await redisClient.get(cacheKey);
  if (cached) {
    logger.info(`${label} HIT key=${cacheKey}`);
    return JSON.parse(cached);
  }
  logger.info(`${label} MISS key=${cacheKey}`);
  return null;
};

export const writeJsonCache = async (cacheKey, data, ttlSeconds) => {
  await redisClient.set(cacheKey, JSON.stringify(data), 'EX', ttlSeconds);
};

export const invalidateCompanyCacheByPrefix = async (
  companyId,
  prefix,
  label = 'cache',
) => {
  if (!companyId) return;

  const keyPrefix = `${prefix}${companyId}:`;
  let cursor = '0';
  let removed = 0;

  do {
    const [nextCursor, keys] = await redisClient.scan(
      cursor,
      'MATCH',
      `${keyPrefix}*`,
      'COUNT',
      200,
    );
    cursor = nextCursor;

    if (keys.length) {
      await redisClient.del(...keys);
      removed += keys.length;
    }
  } while (cursor !== '0');

  logger.info(`${label} invalidated for company ${companyId}. keysRemoved=${removed}`);
};
