import Redis from 'ioredis';
import { logger } from './logger.js'; // Adjust the import path as needed

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redisClient = new Redis(redisUrl);

redisClient.on('connect', () => {
  logger.info('[Redis] Connected');
});

redisClient.on('error', (err) => {
  logger.error('[Redis] Error:', err);
});

export async function closeRedis() {
  try {
    await redisClient.quit();
    logger.info('[Redis] Connection closed');
  } catch (err) {
    logger.error('[Redis] Close error:', err);
  }
}

export default redisClient;
