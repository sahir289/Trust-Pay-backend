import { Server } from 'socket.io';
import config from '../config/config.js';
import chalk from 'chalk';
import { logger } from './logger.js';

const userSockets = new Map();
let ioInstance = null;

const initializeSocket = (server) => {
  ioInstance = new Server(server, {
    cors: {
      origin: [`${config?.reactFrontOrigin}`, `${config?.reactPaymentOrigin}`],
      methods: ['GET', 'POST'],
    },
  });

  ioInstance.on('connection', (socket) => {
    const message = chalk.bold.cyan(`Client connected: ${socket.id}`);
    logger.log(message);

    socket.on('user-login', (userId) => {
      // Get existing sockets for this user
      const existingSockets = userSockets.get(userId) || [];

      // Force logout all other sessions except the current one
      existingSockets.forEach((existingSocketId) => {
        if (existingSocketId !== socket.id) {
          ioInstance.to(existingSocketId).emit('forceLogout');
          logger.log(chalk.yellow(`Forced logout for user ${userId} on socket ${existingSocketId}`));
        }
      });

      // Update userSockets: keep only the current socket
      userSockets.set(userId, [socket.id]);
      const loginMessage = chalk.bold.green(`User ${userId} associated with socket ${socket.id}`);
      logger.log(loginMessage);

      // Send confirmation to the current client
      socket.emit('login-success', { userId, socketId: socket.id });
    });

    // Send test message on connection
    socket.emit('new-entry', { message: 'Hello from server!!!', data: {} });

    // Broadcast message to all clients
    ioInstance.emit('broadcast-message', {
      message: 'A new client has connected!',
    });

    socket.on('client-message', (data) => {
      logger.log(`Received from client:`, data);
    });

    socket.on('disconnect', () => {
      for (const [userId, socketIds] of userSockets.entries()) {
        const updatedSockets = socketIds.filter((id) => id !== socket.id);
        if (updatedSockets.length > 0) {
          userSockets.set(userId, updatedSockets);
          logger.log(chalk.blue(`User ${userId} disconnected, remaining sockets: ${updatedSockets}`));
        } else {
          userSockets.delete(userId);
          logger.log(chalk.blue(`User ${userId} disconnected, no remaining sockets`));
        }
      }
      const disconnectMessage = chalk.bold.red(`Client disconnected: ${socket.id}`);
      logger.log(disconnectMessage);
    });
  });
  const initMessage = chalk.magentaBright('WebSocket server initialized');
  logger.log(initMessage);
};

const forceLogoutUser = (userId) => {
  if (!ioInstance) {
    logger.error('Socket.IO not initialized');
    return;
  }

  const socketIds = userSockets.get(userId) || [];
  logger.log(`Force logout for user ${userId}, sockets: ${socketIds}`);

  if (socketIds.length > 0) {
    socketIds.forEach((socketId) => {
      ioInstance.to(socketId).emit('forceLogout');
      logger.log(chalk.yellow(`User ${userId} forced to logout on socket ${socketId}`));
    });
    userSockets.delete(userId); // Clear all sockets for this user
  } else {
    logger.error(`No active sockets found for user ${userId}`);
  }
};

export { initializeSocket, forceLogoutUser };
