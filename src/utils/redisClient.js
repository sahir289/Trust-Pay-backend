import Redis from 'ioredis';
import { logger } from './logger.js';
import chalk from 'chalk';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redisClient = new Redis(redisUrl);

redisClient.on('connect', () => {
  const styledMessageError = chalk.bold.green(`Redis Connected Successfully`);
  logger.info(styledMessageError);
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
