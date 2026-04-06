import { Server } from 'socket.io';
import chalk from 'chalk';
import config from '../../config/config.js';
import { logger } from '../logger.js';
import { authenticateSocketHandshake } from './authGuard.js';
import {
  closeSocketInfrastructure,
  configureSocketInfrastructure,
} from './bridge.js';
import { safeFetchSockets } from './query.js';
import {
  registerSocketConnectionHandlers,
  startSessionCleanupMonitor,
} from './sessionHandlers.js';
import { resetSocketRuntime, socketRuntime } from './state.js';
import { disconnectSocketSafely } from './sessionUtils.js';

const initializeSocket = async (server) => {
  socketRuntime.ioInstance = new Server(server, {
    transports: ['websocket', 'polling'],
    connectTimeout: 10000,
    cors: {
      origin: [config?.reactFrontOrigin, config?.reactPaymentOrigin],
      methods: ['GET', 'POST'],
    },
    maxHttpBufferSize: 1024 * 100,
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  socketRuntime.hasLoggedMissingSocketInstance = false;

  await configureSocketInfrastructure();
  socketRuntime.ioInstance.use(authenticateSocketHandshake);
  registerSocketConnectionHandlers();
  startSessionCleanupMonitor();

  logger.info(chalk.magentaBright('WebSocket server initialized'));
};

const shutdownSocket = async () => {
  try {
    if (socketRuntime.cleanupInterval) {
      clearInterval(socketRuntime.cleanupInterval);
      socketRuntime.cleanupInterval = null;
    }

    if (socketRuntime.ioInstance) {
      const allSockets = await safeFetchSockets('socket shutdown');
      allSockets.forEach((socket) => {
        disconnectSocketSafely(socket, 'socket shutdown');
      });

      await new Promise((resolve) => {
        socketRuntime.ioInstance.close(() => {
          logger.info('[SOCKET] Socket.IO server closed');
          resolve();
        });
      });
    }

    await closeSocketInfrastructure();
  } finally {
    resetSocketRuntime();
  }
};

export { initializeSocket, shutdownSocket };
