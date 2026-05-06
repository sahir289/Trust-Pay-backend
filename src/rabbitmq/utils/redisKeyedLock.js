import crypto from 'node:crypto';
import { BadRequestError } from '../../utils/appErrors.js';
import { logger } from '../../utils/logger.js';
import redisClient from '../../utils/redisClient.js';

const DEFAULT_LOCK_TTL_SEC = Number(process.env.PAYIN_PROCESS_LOCK_TTL_SEC || 30);
const DEFAULT_LOCK_WAIT_MS = Number(process.env.PAYIN_PROCESS_LOCK_WAIT_MS || 1500);
const DEFAULT_POLL_INTERVAL_MS = Number(process.env.PAYIN_PROCESS_LOCK_POLL_MS || 75);

const RELEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildLockKey(scope, key) {
  return `lock:${scope}:${String(key)}`;
}

async function acquireLockWithWait(lockKey, token, ttlSec, waitMs, pollMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= waitMs) {
    const acquired = await redisClient.set(lockKey, token, 'EX', ttlSec, 'NX');
    if (acquired === 'OK') {
      return true;
    }

    await sleep(pollMs);
  }

  return false;
}

async function releaseLock(lockKey, token) {
  try {
    await redisClient.eval(RELEASE_SCRIPT, 1, lockKey, token);
  } catch (error) {
    logger.warn('[RabbitMQ][RedisLock] Failed to release lock', {
      lockKey,
      error: error?.message,
    });
  }
}

export async function withRedisKeyLock(scope, key, work, options = {}) {
  if (!key) {
    return work();
  }

  const ttlSec = Number(options.ttlSec || DEFAULT_LOCK_TTL_SEC);
  const waitMs = Number(options.waitMs || DEFAULT_LOCK_WAIT_MS);
  const pollMs = Number(options.pollMs || DEFAULT_POLL_INTERVAL_MS);

  const lockKey = buildLockKey(scope, key);
  const token = crypto.randomUUID();

  const acquired = await acquireLockWithWait(lockKey, token, ttlSec, waitMs, pollMs);

  if (!acquired) {
    throw new BadRequestError(
      'This record is currently being updated by another user. Please try again later.',
    );
  }

  try {
    return await work();
  } finally {
    await releaseLock(lockKey, token);
  }
}
