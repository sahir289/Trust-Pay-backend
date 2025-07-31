import Redis from 'ioredis';
import { logger } from './logger.js'; // Adjust the import path as needed

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisPassword = process.env.REDIS_PASSWORD;

const redisOptions = redisPassword
  ? { password: redisPassword }
  : {};

const redisClient = new Redis(redisUrl, redisOptions);

redisClient.on('connect', () => {
  console.log('[Redis] Connected');
  logger.info('[Redis] Connected');
});

redisClient.on('error', (err) => {
  console.error('[Redis] Error:', err);
  logger.error('[Redis] Error:', err);
});

export default redisClient;
