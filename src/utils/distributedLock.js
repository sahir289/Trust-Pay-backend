import redisClient from './redisClient.js';
import { logger } from './logger.js';

const DEFAULT_LOCK_TTL_SECONDS = 60; // Lock expires after 60 seconds
const LOCK_PREFIX = 'webhook:lock:';

/**
 * Acquire a distributed lock using Redis
 * Works across multiple PM2 instances
 * 
 * @param {string} key - Unique identifier for the lock (e.g., UTR)
 * @param {string} source - Source identifier for logging (e.g., 'payEasy', 'runsafe')
 * @param {number} ttlSeconds - Time to live for the lock in seconds (default: 60)
 * @returns {Promise<boolean>} - true if lock acquired, false if already locked
 */
export async function acquireLock(key, source = 'webhook', ttlSeconds = DEFAULT_LOCK_TTL_SECONDS) {
  if (!key) {
    logger.warn(`[DistributedLock] Attempted to acquire lock with empty key from ${source}`);
    return false;
  }

  const lockKey = `${LOCK_PREFIX}${source}:${key}`;
  
  try {
    // NX = Only set if key doesn't exist
    // EX = Set expiration in seconds
    const result = await redisClient.set(lockKey, Date.now().toString(), 'EX', ttlSeconds, 'NX');
    
    if (result === 'OK') {
      logger.info(`[DistributedLock] Lock acquired for ${lockKey}`);
      return true;
    } else {
      logger.warn(`[DistributedLock] Lock already held for ${lockKey} - skipping duplicate`);
      return false;
    }
  } catch (error) {
    logger.error(`[DistributedLock] Error acquiring lock for ${lockKey}:`, {
      message: error.message,
      stack: error.stack,
    });
    // On Redis error, return true to allow processing (fail-open)
    // This prevents blocking all webhooks if Redis is down
    logger.warn(`[DistributedLock] Redis error - allowing processing to continue for ${lockKey}`);
    return true;
  }
}

/**
 * Release a distributed lock
 * 
 * @param {string} key - Unique identifier for the lock (e.g., UTR)
 * @param {string} source - Source identifier (e.g., 'payEasy', 'runsafe')
 * @returns {Promise<void>}
 */
export async function releaseLock(key, source = 'webhook') {
  if (!key) {
    return;
  }

  const lockKey = `${LOCK_PREFIX}${source}:${key}`;
  
  try {
    await redisClient.del(lockKey);
    logger.info(`[DistributedLock] Lock released for ${lockKey}`);
  } catch (error) {
    logger.error(`[DistributedLock] Error releasing lock for ${lockKey}:`, {
      message: error.message,
    });
    // Don't throw - lock will expire via TTL anyway
  }
}

/**
 * Check if a lock is currently held
 * 
 * @param {string} key - Unique identifier for the lock
 * @param {string} source - Source identifier
 * @returns {Promise<boolean>} - true if locked, false otherwise
 */
export async function isLocked(key, source = 'webhook') {
  if (!key) {
    return false;
  }

  const lockKey = `${LOCK_PREFIX}${source}:${key}`;
  
  try {
    const exists = await redisClient.exists(lockKey);
    return exists === 1;
  } catch (error) {
    logger.error(`[DistributedLock] Error checking lock for ${lockKey}:`, {
      message: error.message,
    });
    return false;
  }
}

/**
 * Execute a function with distributed lock protection
 * Automatically acquires and releases the lock
 * 
 * @param {string} key - Unique identifier for the lock
 * @param {string} source - Source identifier
 * @param {Function} fn - Async function to execute
 * @param {number} ttlSeconds - Lock TTL in seconds
 * @returns {Promise<{executed: boolean, result?: any}>}
 */
export async function withLock(key, source, fn, ttlSeconds = DEFAULT_LOCK_TTL_SECONDS) {
  const acquired = await acquireLock(key, source, ttlSeconds);
  
  if (!acquired) {
    return { executed: false };
  }

  try {
    const result = await fn();
    return { executed: true, result };
  } finally {
    await releaseLock(key, source);
  }
}
