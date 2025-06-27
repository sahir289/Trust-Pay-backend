import app from './src/app.js';
import { createServer } from 'http';
import chalk from 'chalk';
import config from './src/config/config.js';
import { initializeSocket } from './src/utils/sockets.js';
import { logger } from './src/utils/logger.js';

const server = createServer(app);

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
  if (error.syscall !== 'listen') {
    throw error;
  }
  switch (error.code) {
    case 'EACCES':
      logger.error(`${port} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logger.error(`${port} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
};

const onListening = () => {
  const addr = server.address();
  const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`;
  const styledServerMessage = chalk.blue(
    `the server started listening on ${bind}`,
  );
  logger.log(styledServerMessage);
  const docsUrl = `http://localhost:${PORT}/v1/api-docs`;
  const styledMessage = chalk.bold.yellow(`API docs available at ${docsUrl}`);
  logger.log(styledMessage);
};

process.on('SIGINT', () => {
  const message = chalk.bold.red('stopping the server');
  logger.error(message);
  process.exit();
});

process.on('uncaughtException', (err) => {
  logger.error('There was an uncaught error', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // maybe we will add cleanup or restart logic in future here
});

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);
