import redisClient from './redisClient.js';
import { logger } from './logger.js';

const CACHE_METADATA_KEYS = new Set([
  'page',
  'limit',
  'offset',
  'total',
  'totalCount',
  'count',
  'totalPages',
  'currentPage',
  'perPage',
  'hasNextPage',
  'hasPreviousPage',
  'nextPage',
  'previousPage',
]);

export const normalizeQueryForCache = (query = {}) =>
  Object.fromEntries(
    Object.entries(query)
      .filter(([, value]) => value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)),
  );

const isDefaultPaginationQuery = (query = {}) => {
  const normalizedQuery = normalizeQueryForCache(query);
  const keys = Object.keys(normalizedQuery);

  if (keys.length === 0) {
    return true;
  }

  if (keys.length !== 2 || !keys.includes('page') || !keys.includes('limit')) {
    return false;
  }

  return String(normalizedQuery.page) === '1' && String(normalizedQuery.limit) === '20';
};

const hasMeaningfulCachedData = (value, seen = new WeakSet()) => {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasMeaningfulCachedData(item, seen));
  }

  if (typeof value !== 'object') {
    return true;
  }

  if (seen.has(value)) {
    return false;
  }
  seen.add(value);

  const entries = Object.entries(value);
  if (!entries.length) {
    return false;
  }

  return entries.some(([key, nestedValue]) => {
    if (CACHE_METADATA_KEYS.has(key)) {
      return false;
    }
    return hasMeaningfulCachedData(nestedValue, seen);
  });
};

export const shouldServeCachedResponse = (cached, query = {}) => {
  if (cached === null || cached === undefined) {
    return false;
  }

  if (isDefaultPaginationQuery(query)) {
    return true;
  }

  return hasMeaningfulCachedData(cached);
};

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
