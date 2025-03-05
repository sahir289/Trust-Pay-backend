import { Server } from 'socket.io';
import config from '../config/config.js';
import chalk from 'chalk';

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
    console.log(message);

    socket.on('user-login', (userId) => {
      userSockets.set(userId, socket.id);
      console.log(`User ${userId} associated with socket ${socket.id}`);
    });

    // Send test message on connection
    socket.emit('new-entry', { message: 'Hello from server!!!', data: {} });

    // Broadcast message to all clients
    ioInstance.emit('broadcast-message', {
      message: 'A new client has connected!',
    });

    socket.on('client-message', (data) => {
      console.log(`Received from client:`, data);
    });

    socket.on('disconnect', () => {
      for (const [userId, socketId] of userSockets.entries()) {
        if (socketId === socket.id) {
          userSockets.delete(userId);
          console.log(`User ${userId} disconnected`);
          break;
        }
      }
      const message = chalk.bold.red('Client disconnected');
      console.error(message);
    });
  });
  const message = chalk.magentaBright('WebSocket server initialized');
  console.log(message);
};

const forceLogoutUser = (userId) => {
  if (!ioInstance) {
    console.error('Socket.IO not initialized');
    return;
  }

  const socketId = userSockets.get(userId);
  if (socketId) {
    ioInstance.to(socketId).emit('forceLogout');
    console.log(`User ${userId} forced to logout.`);
  } else {
    console.error(`No active socket found for user ${userId}`);
  }
};

export { initializeSocket, forceLogoutUser };
