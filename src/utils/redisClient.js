import Redis from 'ioredis';
import { logger } from './logger.js'; // Adjust the import path as needed

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisClient = new Redis(redisUrl);

redisClient.on('connect', () => {
  console.log('[Redis] Connected');
  logger.info('[Redis] Connected');
});

redisClient.on('error', (err) => {
  console.error('[Redis] Error:', err);
logger.error('[Redis] Error:', err);
});

export default redisClient;
