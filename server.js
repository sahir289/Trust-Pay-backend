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
    `the server started listening on ${bind} +++`,
  );
  logger.log(styledServerMessage);
  const docsUrl = `http://localhost:${PORT}/api-docs`;
  const styledMessage = chalk.bold.yellow(`API docs available at ${docsUrl}`);
  logger.log(styledMessage);
};

process.on('SIGINT', () => {
  const message = chalk.bold.red('stopping the server');
  console.error(message);
  process.exit();
});

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

// io.on('connection', (socket) => {
//   console.log(`Client connected with socket ID:${socket.id}`);

//   // Emit a test message to the client
//   socket.emit('new-entry', { message: 'Hello from server!!!', data: {} });

//   socket.on("user-login", (userId) => {
//     userSockets.set(userId, socket.id);
//     console.log(`User ${userId} is associated with socket ${socket.id}`);
//   });

//   // Optional: Broadcast to all clients
//   io.emit('broadcast-message', { message: 'A new client has connected!' });

//   // Listen for client events
//   socket.on('client-message', (data) => {
//     console.log(`Received from client:`, data);
//   });

//   // Handle disconnection
//   socket.on('disconnect', () => {
//     for (const [userId, socketId] of userSockets.entries()) {
//       if (socketId === socket.id) {
//         userSockets.delete(userId);
//         console.log(`User ${userId} disconnected`);
//         break;
//       }
//     }
//     console.error('Client disconnected');
//   });
// });

// export { io, userSockets };
