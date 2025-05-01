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
      const existingSockets = userSockets.get(userId) || [];
      existingSockets.forEach((existingSocketId) => {
        if (existingSocketId !== socket.id) {
          ioInstance.to(existingSocketId).emit('forceLogout');
          logger.log(chalk.yellow(`Forced logout for user ${userId} on socket ${existingSocketId}`));
        }
      });
      userSockets.set(userId, [socket.id]);
      const loginMessage = chalk.bold.green(`User ${userId} associated with socket ${socket.id}`);
      logger.log(loginMessage);
      socket.emit('login-success', { userId, socketId: socket.id });
    });

    socket.emit('new-entry', { message: 'Hello from server!!!', data: {} });
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
    userSockets.delete(userId);
  } else {
    logger.error(`No active sockets found for user ${userId}`);
  }
};

const deactivateBank = (nickName, bankId, isWarning = false) => {
  if (!ioInstance) {
    logger.error('Socket.IO not initialized');
    return;
  }
  
  ioInstance.emit(isWarning ? 'bankStatusWarning' : 'bankStatusUpdate', {
    message: isWarning 
      ? `The Bank with the ${nickName} will be Deactivate soon as the Balance will soon reach the Daily Limit`
      : `The Bank with the ${nickName} id Deactivate`,
    bankId,
    nickname: nickName,
    isEnabled: !isWarning ? false : undefined
  });
};

// New function to emit event when a specific entry is added to a table
const notifyNewTableEntry = async(tableName, entryType, entryData) => {
  if (!ioInstance) {
    logger.error('Socket.IO not initialized');
    return;
  }

  const eventName = 'newTableEntry';
  console.log(eventName, 'eventName');
  const payload = {
    tableName,
    entryType,
    entryData,
    timestamp: new Date().toISOString(),
  };

  logger.log(chalk.bold.cyan(`Emitting ${eventName} for table ${tableName}, type ${entryType}`));
  ioInstance.emit(eventName, payload); // Broadcast to all connected clients
};

export { initializeSocket, forceLogoutUser, deactivateBank, notifyNewTableEntry };