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
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
// import { migrateUsersToES } from './src/elasticSearch/user/migrate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));

const server = createServer(app);

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
  
  // Log version information
  const versionMessage = chalk.bold.green(
    `Version: v${packageJson.version}`
  );
  logger.log(versionMessage);
  
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
