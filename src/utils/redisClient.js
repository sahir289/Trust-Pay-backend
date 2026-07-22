import Redis from 'ioredis';
import { logger } from './logger.js';
import chalk from 'chalk';
import config from '../config/config.js';

const redisUrl = config.redis?.url || 'redis://localhost:6379';

const parseIntEnv = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// Redis client configuration with sensible defaults and environment variable overrides. The client is configured to avoid unbounded memory growth and to log warnings if the Redis server is misconfigured for caching use cases.
const redisClient = new Redis(redisUrl, {
  connectTimeout: parseIntEnv(process.env.REDIS_CONNECT_TIMEOUT_MS, 5000),
  commandTimeout: parseIntEnv(process.env.REDIS_COMMAND_TIMEOUT_MS, 2000),
  maxRetriesPerRequest: parseIntEnv(process.env.REDIS_MAX_RETRIES_PER_REQ, 2),
  enableOfflineQueue: false,
  retryStrategy: (times) => Math.min(times * 500, 10000),
});

const logRedisMemorySafety = async () => {
  try {
    const [maxMemoryConfig, evictionPolicyConfig] = await Promise.all([
      redisClient.config('GET', 'maxmemory'),
      redisClient.config('GET', 'maxmemory-policy'),
    ]);

    const maxMemoryRaw = maxMemoryConfig?.[1] || '0';
    const evictionPolicy = evictionPolicyConfig?.[1] || 'unknown';
    const maxMemoryBytes = Number.parseInt(maxMemoryRaw, 10) || 0;

    // Warn if maxmemory is not set or is set to 0 (unlimited)
    if (maxMemoryBytes <= 0) {
      logger.warn(
        '[REDIS] maxmemory is not set (0). Configure maxmemory to avoid unbounded memory growth.',
      );
    }

    // Warn if eviction policy is noeviction, which can lead to OOM errors
    if (evictionPolicy === 'noeviction') {
      logger.warn(
        '[REDIS] maxmemory-policy is noeviction. Prefer allkeys-lru or volatile-lru for safer cache behavior.',
      );
    }

    logger.info(
      `[REDIS] Memory policy check: maxmemory=${maxMemoryRaw}, policy=${evictionPolicy}`,
    );
  } catch (error) {
    logger.warn('[REDIS] Unable to verify memory policy:', error?.message);
  }
};

redisClient.on('connect', () => {
  const styledMessageError = chalk.bold.green(`Redis Connected Successfully`);
  logger.info(styledMessageError);
});

// Log Redis memory safety on ready event to ensure the server is configured correctly for caching use cases. This check is non-blocking and will log warnings if the configuration is not optimal.
redisClient.on('ready', () => {
  // Non-blocking safety check for Redis memory configuration.
  logRedisMemorySafety();
});

redisClient.on('error', (err) => {
  logger.error('Redis Error:', err);
});

export async function closeRedis() {
  try {
    await redisClient.quit();
    const styledMessageError = chalk.bold.red(`Redis Connection closed`);
    logger.info(styledMessageError);
  } catch (err) {
    logger.error('Redis Close error:', err);
  }
}

export default redisClient;
