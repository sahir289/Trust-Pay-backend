import app from './src/app.js';
// Explicitly imports the built-in Node.js http module
import { createServer } from 'node:http';
import chalk from 'chalk';
import config from './src/config/config.js';
import { initializeSocket, shutdownSocket } from './src/utils/sockets.js';
import { logger } from './src/utils/logger.js';
import { closePool, checkDatabaseHealth, dbPoolMonitor } from './src/utils/db.js';
import { stopRabbitMQ } from './src/rabbitmq/index.js';
import { closeRedis } from './src/utils/redisClient.js';
// import { migrateUsersToES } from './src/elasticSearch/user/migrate.js';

const server = createServer(app);

// set the keep-alive and headers timeout values to avoid premature connection termination, 65 seconds is a common value for keep-alive timeout, and headers timeout should be slightly longer to allow for slow clients.
server.keepAliveTimeout = Number.parseInt(
  process.env.HTTP_KEEP_ALIVE_TIMEOUT_MS ?? '65000',
  10,
);
server.headersTimeout = Number.parseInt(
  process.env.HTTP_HEADERS_TIMEOUT_MS ?? '66000',
  10,
);

// Initialize Socket.IO with Redis adapter (async)
initializeSocket(server);

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
    // Important: stop accepting new requests and wait for in-flight HTTP work
    // BEFORE tearing down shared dependencies like DB pool.
    await new Promise((res) => server.close(res));

    await Promise.allSettled([
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

// A transient DB / network connection error (e.g. a cross-region RDS connect
// timeout) only affects the in-flight request; the pg pool auto-recovers. These
// must NOT tear down the whole process — doing so drops all in-flight work and
// triggers a cold-restart storm that causes even more cold-connect timeouts.
// Recognize them by error code OR by pg's connection-timeout messages, which
// carry no error code.
const isRecoverableConnectionError = (err) => {
  const code = err?.code;
  if (code === 'ECONNRESET' || code === 'EPIPE' || code === 'ETIMEDOUT') {
    return true;
  }
  const message = err?.message || '';
  return (
    message.includes('Connection terminated due to connection timeout') ||
    message.includes('timeout exceeded when trying to connect') ||
    message.includes('Connection terminated unexpectedly')
  );
};

process.on('uncaughtException', (err) => {
  // Don't shutdown on recoverable connection errors - they auto-retry
  if (isRecoverableConnectionError(err)) {
    logger.error('Connection error (will auto-retry):', err);
    return;
  }
  gracefulShutdown('Uncaught Exception', err);
});

process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));

   // Don't shutdown on recoverable connection errors - they auto-retry
  // if (isRecoverableConnectionError(err)) {
  //   logger.error(
  //     'Unhandled Rejection (connection error, will auto-retry):',
  //     err,
  //   );
  //   return;
  // }

  // gracefulShutdown('Unhandled Rejection', err);
  // Instead of shutting down the process on unhandled rejections, log the error and keep the process alive. This is important for recoverable errors that may occur in asynchronous code, such as database connection issues or network timeouts. By logging the error, we can monitor and investigate it without disrupting the service.
  logger.error('Unhandled Rejection (process kept alive):', {
    message: err.message,
    stack: err.stack,
  });
});

// Optional interface binding. When BIND_HOST is set (e.g. 127.0.0.1 for an
// on-host nginx), the app port is unreachable from other machines; when empty
// it binds all interfaces as before, so existing deployments are unaffected.
const BIND_HOST = config?.bindHost || '';
if (BIND_HOST) {
  server.listen(PORT, BIND_HOST, onListening);
} else {
  server.listen(PORT, onListening);
}

server.on('error', onError);

// Database Pool Monitoring - Only in production
if (config?.env === 'production') {
  // Database Pool Monitoring - Check every 60 seconds
  setInterval(() => {
    dbPoolMonitor();
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
