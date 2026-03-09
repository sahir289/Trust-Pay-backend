import app from './src/app.js';
import { createServer } from 'http';
import chalk from 'chalk';
import config from './src/config/config.js';
import { initializeSocket, shutdownSocket } from './src/utils/sockets.js';
import { logger } from './src/utils/logger.js';
import { closePool, getPoolStats, checkDatabaseHealth } from './src/utils/db.js';
import { startRabbitMQConsumers, stopRabbitMQ } from './src/rabbitmq/index.js';
import { closeRedis } from './src/utils/redisClient.js';
// import { migrateUsersToES } from './src/elasticSearch/user/migrate.js';

const server = createServer(app);

// Initialize Socket.IO with Redis adapter (async)
await initializeSocket(server);

const PORT = config?.port || 8090;

const normalizePort = (val) => {
  const port = parseInt(val, 10);
  if (Number.isNaN(port)) {
    // named pipe
    return val;
  }
  if (port >= 0) {
    // port number
    return port;
  }
  return false;
};

const port = normalizePort(PORT);
const onError = (error) => {
  if (error.syscall !== 'listen')
    return gracefulShutdown('Server error', error);
  switch (error.code) {
    case 'EACCES':
      error.message = `${port} requires elevated privileges`;
      break;
    case 'EADDRINUSE':
      error.message = `${port} is already in use`;
      break;
    default:
      throw error;
  }
  gracefulShutdown('Server listen error', error);
};

const onListening = () => {
  const addr = server.address();
  const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`;
  const styledServerMessage = chalk.blue(
    `The server started listening on ${bind}`,
  );
  logger.log(styledServerMessage);
  const docsUrl = `http://localhost:${PORT}/v1/api-docs`;
  const styledMessage = chalk.bold.yellow(`API docs available at ${docsUrl}`);
  logger.log(styledMessage);
  
  // Signal PM2 that the app is ready
  if (process.send) {
    process.send('ready');
    logger.info('PM2 ready signal sent');
  }
};

let shuttingDown = false;

async function gracefulShutdown(label, err) {
  if (shuttingDown) return;
  shuttingDown = true;
  const styledMessageError = chalk.bold.red(`${label}`);

  // console the error in stderr (synchronously) so PM2 always captures it
  if (err) console.error(`${label}:`, err);

  if (err) {
    logger.error(styledMessageError, {
      message: err.message,
      stack: err.stack,
    });
  } else {
    logger.warn(styledMessageError);
  }

  //  we need to close the resources (HTTP server, DB, etc.)
  try {
    await Promise.allSettled([
      new Promise((res) => server.close(res)),
      shutdownSocket(),
      closePool(),
      stopRabbitMQ(),
      closeRedis(),
    ]);
    // Close logger LAST so no component writes after transports are ended
    await logger.close();
  } finally {
    process.exit(err ? 1 : 0);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT received'));

// docker / kubernetes or PM2 stop
process.on('SIGTERM', () => gracefulShutdown('SIGTERM received'));

process.on('uncaughtException', (err) => {
  // Don't shutdown on recoverable connection errors - they auto-retry
  if (
    err.code === 'ECONNRESET' ||
    err.code === 'EPIPE' ||
    err.code === 'ETIMEDOUT'
  ) {
    logger.error('Connection error (will auto-retry):', err);
    return;
  }
  gracefulShutdown('Uncaught Exception', err);
});

process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));

  // Don't shutdown on recoverable connection errors - they auto-retry
  if (
    err.code === 'ECONNRESET' ||
    err.code === 'EPIPE' ||
    err.code === 'ETIMEDOUT'
  ) {
    logger.error(
      'Unhandled Rejection (connection error, will auto-retry):',
      err,
    );
    return;
  }

  gracefulShutdown('Unhandled Rejection', err);
});

server.listen(PORT, onListening);

// Start RabbitMQ consumers ONLY on primary worker (worker 0)
// to avoid duplicate message processing
// Note: Cron jobs run in separate 'trust-pay-crons' PM2 process
const instanceId = parseInt(process.env.INSTANCE_ID || '0', 10);
if (instanceId === 0) {
  // Start workers asynchronously but don't block server startup
  try {
    await startRabbitMQConsumers();
    logger.info('[Worker 0] RabbitMQ consumers started (bank_response_queue + bulk_payout_queue)');
  } catch (err) {
    logger.error('[Worker 0] RabbitMQ consumers failed:', err);
  }
} else {
  logger.info(`[Worker ${instanceId}] Skipping RabbitMQ consumers (run only on worker 0)`);
}

server.on('error', onError);

// Database Pool Monitoring - Only in production
if (config?.env === 'production') {
  // Database Pool Monitoring - Check every 60 seconds
  setInterval(() => {
    try {
      const stats = getPoolStats();
      
      // Validate stats exist
      if (!stats || !stats.writer || !stats.reader) {
        logger.warn('DATABASE_ALERT: Pool stats unavailable');
        return;
      }
      
      // Alert if connection wait queue is building up (> 5 waiting connections)
      if (stats.writer.waiting > 5 || stats.reader.waiting > 5) {
        logger.error('DATABASE_ALERT: High connection wait queue!', stats);
      }
      
      // Calculate pool utilization (prevent division by zero)
      const writerUtilization = stats.writer.total > 0 
        ? ((stats.writer.total - stats.writer.idle) / stats.writer.total) * 100 
        : 0;
      const readerUtilization = stats.reader.total > 0 
        ? ((stats.reader.total - stats.reader.idle) / stats.reader.total) * 100 
        : 0;
      
      // Alert if pool utilization is too high (> 80%)
      if (writerUtilization > 80) {
        logger.warn(`DATABASE_ALERT: High writer pool usage: ${writerUtilization.toFixed(1)}%`, {
          active: stats.writer.total - stats.writer.idle,
          total: stats.writer.total,
          waiting: stats.writer.waiting,
        });
      }
      
      if (readerUtilization > 80) {
        logger.warn(`DATABASE_ALERT: High reader pool usage: ${readerUtilization.toFixed(1)}%`, {
          active: stats.reader.total - stats.reader.idle,
          total: stats.reader.total,
          waiting: stats.reader.waiting,
        });
      }
    } catch (error) {
      logger.error('DATABASE_ALERT: Pool monitoring error:', error);
    }
  }, 60000); // Every 60 seconds

  // Database Health Check - Check every 5 minutes
  setInterval(async () => {
    try {
      const health = await checkDatabaseHealth();
      if (health.status === 'unhealthy') {
        logger.error('DATABASE_ALERT: Health check failed!', health);
      }
    } catch (error) {
      logger.error('DATABASE_ALERT: Health check threw error:', error);
    }
  }, 300000); // Every 5 minutes
}

// migrateUsersToES();
