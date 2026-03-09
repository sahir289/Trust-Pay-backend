import { logger } from './src/utils/logger.js';
import stringify from 'fast-safe-stringify';
import { closePool } from './src/utils/db.js';
import { closeRedis } from './src/utils/redisClient.js';
import { startRabbitMQConsumers, stopRabbitMQ } from './src/rabbitmq/index.js';

let shuttingDown = false;

async function gracefulShutdown(signal, error = null) {
  if (shuttingDown) return;
  shuttingDown = true;

  if (error) {
    logger.error(`[RabbitMQ Worker] ${signal}`, {
      message: error.message,
      stack: error.stack,
    });
  } else {
    logger.warn(`[RabbitMQ Worker] ${signal}`);
  }

  try {
    await Promise.allSettled([
      stopRabbitMQ(),
      closePool(),
      closeRedis(),
    ]);
    await logger.close();
  } finally {
    process.exit(error ? 1 : 0);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT received'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM received'));
process.on('uncaughtException', (err) => gracefulShutdown('Uncaught Exception', err));
process.on('unhandledRejection', (reason) => {
  if (reason instanceof Error) {
    gracefulShutdown('Unhandled Rejection', reason);
    return;
  }

  const reasonMessage =
    typeof reason === 'string' ? reason : stringify(reason);
  const err = new Error(reasonMessage);
  gracefulShutdown('Unhandled Rejection', err);
});

try {
  await startRabbitMQConsumers();
  logger.info('[RabbitMQ Worker] Consumers started in fork mode');

  if (process.send) {
    process.send('ready');
  }
} catch (error) {
  await gracefulShutdown('Failed to start consumers', error);
}
