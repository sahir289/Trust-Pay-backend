import Redis from 'ioredis';
import { logger } from './logger.js';
import chalk from 'chalk';
import config from '../config/config.js';

const redisUrl = config.redis?.url || 'redis://localhost:6379';

const redisClient = new Redis(redisUrl);

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
