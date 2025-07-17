import { Server } from 'socket.io';
import config from '../config/config.js';
import chalk from 'chalk';
import { logger } from './logger.js';
// import {
//   getBankaccountDao,
//   updateBankaccountDao,
// } from '../apis/bankAccounts/bankaccountDao.js';
// import { getUserByIdDao } from '../apis/users/userDao.js';

const userSockets = new Map();
let ioInstance = null;

const initializeSocket = (server) => {
  ioInstance = new Server(server, {
    transports: ['websocket', 'polling'],
    cors: {
      origin: [`${config?.reactFrontOrigin}`, `${config?.reactPaymentOrigin}`],
      methods: ['GET', 'POST'],
    },
  });

  ioInstance.on('connection', (socket) => {
    socket.on('pingCheck', () => {
      socket.emit('pongCheck');
    });
    const message = chalk.bold.cyan(`Client connected: ${socket.id}`);
    logger.log(message);

    socket.on('user-login', async (data) => {
      // Handle both string and object data formats for backward compatibility
      const userId = typeof data === 'object' ? data.userId : data;
      const sessionId = typeof data === 'object' ? data.sessionId : null;

      if (!userId) {
        logger.error('[SOCKET] Missing userId in user-login event');
        return;
      }

      logger.log(
        chalk.bgBlue.white(
          `[SOCKET] User login event received for userId: ${userId}, sessionId: ${sessionId}, socketId: ${socket.id}`,
        ),
      );

      // Critical section - handle the session management with care
      try {
        // Store socket metadata for better tracking
        socket.userId = userId;
        socket.sessionId = sessionId;
        socket.loginTime = Date.now();

        // Get all connected sockets across all namespaces
        const allSockets = await ioInstance.fetchSockets();

        // Find all existing sockets for this user by checking socket.userId property
        const userActiveSockets = allSockets.filter(
          (s) => s.userId === userId && s.id !== socket.id,
        );

        // Log what we found
        logger.log(
          chalk.bgBlue.white(
            `[SOCKET] Found ${userActiveSockets.length} existing sockets for user ${userId}`,
          ),
        );

        // IMMEDIATELY force logout all other sessions - enforce single device login
        if (userActiveSockets.length > 0) {
          logger.log(
            chalk.bgRed.white(
              `[SOCKET] IMMEDIATE logout of ${userActiveSockets.length} existing sockets for user ${userId} - enforcing single device login`,
            ),
          );

          // Force logout ALL existing sockets immediately - no exceptions for same session
          for (const existingSocket of userActiveSockets) {
            const existingSessionId = existingSocket.sessionId;

            logger.log(
              chalk.red(
                `[SOCKET] Force logging out socket ${existingSocket.id} with session ${existingSessionId} - new device login detected`,
              ),
            );

            // Send immediate logout notifications
            existingSocket.emit('forceLogout', {
              reason: 'new_login',
              userId: userId,
              sessionId: existingSessionId || 'unknown',
              message:
                'Your session has been terminated due to a new login from another device.',
              timestamp: new Date().toISOString(),
              targeted: true,
            });

            existingSocket.emit('session-terminated', {
              reason: 'new_login',
              userId: userId,
              sessionId: existingSessionId || 'unknown',
              message: 'Please login again',
            });

            // Disconnect immediately
            try {
              if (existingSocket.connected) {
                existingSocket.disconnect(true);
                logger.log(
                  chalk.red(
                    `[SOCKET] Disconnected socket ${existingSocket.id}`,
                  ),
                );
              }
            } catch (err) {
              logger.error(
                `[SOCKET] Error disconnecting socket ${existingSocket.id}: ${err.message}`,
              );
            }
          }
        }

        // Add only this new socket to our tracking map since we disconnected all others
        userSockets.set(userId, [socket.id]);

        logger.log(
          chalk.green(
            `[SOCKET] User ${userId} logged in successfully with socket ${socket.id} - single device enforced`,
          ),
        );

        // Emit new login event
        const eventName = `newLogin`;
        logger.log(
          chalk.bold.cyan(`[SOCKET] Emitting ${eventName} for ${userId}`),
        );
        ioInstance.emit(eventName, userId);
      } catch (error) {
        logger.error(`[SOCKET] Error in user-login handler: ${error.message}`);
        logger.error(error.stack);
      }
    });

    socket.emit('new-entry', { message: 'Hello from server!!!', data: {} });
    ioInstance.emit('broadcast-message', {
      message: 'A new client has connected!',
    });

    socket.on('client-message', (data) => {
      logger.log(`Received from client:`, data);
    });

    socket.on('disconnect', (reason) => {
      // Don't emit logout events for server-side disconnects (server restart/stop)
      const isServerSideDisconnect =
        reason === 'server disconnect' ||
        reason === 'transport close' ||
        reason === 'server shutting down' ||
        reason === 'ping timeout';

      for (const [userId, socketIds] of userSockets.entries()) {
        const updatedSockets = socketIds.filter((id) => id !== socket.id);
        if (updatedSockets.length > 0) {
          userSockets.set(userId, updatedSockets);
          logger.log(
            chalk.blue(
              `User ${userId} disconnected, remaining sockets: ${updatedSockets}`,
            ),
          );
        } else {
          userSockets.delete(userId);
          logger.log(
            chalk.blue(`User ${userId} disconnected, no remaining sockets`),
          );

          // Only emit logout events for client-side disconnects, not server restarts
          if (!isServerSideDisconnect) {
            logger.log(
              chalk.yellow(
                `[SOCKET] Emitting logout event for user ${userId} due to client disconnect`,
              ),
            );
            // You can add specific logout events here if needed
            // ioInstance.emit('userLoggedOut', { userId, reason: 'client_disconnect' });
          } else {
            logger.log(
              chalk.gray(
                `[SOCKET] Skipping logout event for user ${userId} due to server-side disconnect: ${reason}`,
              ),
            );
          }
        }
      }
      const disconnectMessage = chalk.bold.red(
        `Client disconnected: ${socket.id}, reason: ${reason}`,
      );
      logger.log(disconnectMessage);
    });
  });
  const initMessage = chalk.magentaBright('WebSocket server initialized');
  logger.log(initMessage);
};

const forceLogoutUser = async (
  userId,
  targetSessionId = null,
  excludeSessionId = null,
) => {
  if (!ioInstance) {
    logger.error('Socket.IO not initialized');
    return;
  }

  // This approach is more reliable than using our internal tracking map
  try {
    // Log with high visibility for debugging
    logger.log(
      chalk.bgRed.white(
        `[SOCKET] forceLogoutUser called for userId: ${userId}, targetSessionId: ${targetSessionId}, excludeSessionId: ${excludeSessionId}`,
      ),
    );

    // Get all connected sockets directly from Socket.IO - more reliable
    const allSockets = await ioInstance.fetchSockets();
    logger.log(
      chalk.yellow(`[SOCKET] Total connected sockets: ${allSockets.length}`),
    );

    // Find sockets belonging to this user based on the userId property
    const userActiveSocketsList = allSockets.filter((socket) => {
      const hasUserId = socket.userId === userId;
      if (hasUserId) {
        logger.log(
          chalk.cyan(
            `[SOCKET] Found user socket: ${socket.id} with sessionId: ${socket.sessionId}`,
          ),
        );
      }
      return hasUserId;
    });

    const logMessage = targetSessionId
      ? `Force logout for user ${userId}, target session ${targetSessionId}, found ${userActiveSocketsList.length} active sockets`
      : `Force logout for user ${userId}, found ${userActiveSocketsList.length} active sockets`;
    logger.log(chalk.bgRed.white(logMessage));

    // If we have a targetSessionId, only logout that specific session
    if (targetSessionId && !excludeSessionId) {
      logger.log(
        chalk.red(
          `[SOCKET] Targeted force logout for user ${userId}, targeting session ${targetSessionId}`,
        ),
      );

      let disconnectedCount = 0;

      // Process each socket for this user
      for (const socket of userActiveSocketsList) {
        const socketSessionId = socket.sessionId;

        // Log every socket we find for debugging
        logger.log(
          chalk.red(
            `[SOCKET] Checking socket ${socket.id} with sessionId ${socketSessionId} (targeting ${targetSessionId})`,
          ),
        );

        // Only logout the socket with the matching session ID
        if (socketSessionId !== targetSessionId) {
          logger.log(
            chalk.green(
              `[SOCKET] Skipping socket ${socket.id} with non-matching session ID ${socketSessionId}`,
            ),
          );
          continue;
        }

        // Send targeted messages to the specific socket
        logger.log(
          chalk.red(
            `[SOCKET] Sending forceLogout to socket ${socket.id} for user ${userId}`,
          ),
        );

        socket.emit('forceLogout', {
          reason: 'session_terminated',
          userId: userId,
          sessionId: socketSessionId || 'unknown',
          message: 'Your session has been terminated.',
          timestamp: new Date().toISOString(),
          targeted: true,
        });

        socket.emit('session-terminated', {
          reason: 'session_terminated',
          userId: userId,
          sessionId: socketSessionId || 'unknown',
          message: 'Please login again',
        });

        // IMMEDIATE DISCONNECT
        try {
          if (socket.connected) {
            socket.disconnect(true);
            logger.log(
              chalk.red(
                `[SOCKET] Disconnected socket ${socket.id} for user ${userId}`,
              ),
            );
          }
        } catch (err) {
          logger.error(
            `[SOCKET] Error disconnecting socket ${socket.id}: ${err.message}`,
          );
        }

        disconnectedCount++;
      }

      logger.log(
        chalk.green(
          `[SOCKET] Successfully disconnected ${disconnectedCount} sockets for user ${userId}`,
        ),
      );
    }
    // If we have an excludeSessionId, handle targeted logout (exclude specific session)
    else if (excludeSessionId) {
      logger.log(
        chalk.red(
          `[SOCKET] Targeted force logout for user ${userId}, excluding session ${excludeSessionId}`,
        ),
      );

      // Process directly found sockets - more reliable approach
      let disconnectedCount = 0;

      // Process each socket for this user
      for (const socket of userActiveSocketsList) {
        // Skip the socket with the session we want to exclude
        const socketSessionId = socket.sessionId;

        // Log every socket we find for debugging
        logger.log(
          chalk.red(
            `[SOCKET] Checking socket ${socket.id} with sessionId ${socketSessionId} (excluding ${excludeSessionId})`,
          ),
        );

        if (socketSessionId && socketSessionId === excludeSessionId) {
          logger.log(
            chalk.green(
              `[SOCKET] Skipping socket ${socket.id} with matching session ID ${excludeSessionId}`,
            ),
          );
          continue;
        }

        // Send targeted messages to old socket - send multiple for redundancy
        logger.log(
          chalk.red(
            `[SOCKET] Sending forceLogout to socket ${socket.id} for user ${userId}`,
          ),
        );

        // Try both event types for maximum compatibility
        socket.emit('forceLogout', {
          reason: 'new_login',
          userId: userId,
          sessionId: socketSessionId || 'unknown', // Include the session ID if we have it
          message:
            'Your session has been terminated due to a new login from another device.',
          timestamp: new Date().toISOString(),
          targeted: true, // Mark this as a targeted message
        });

        socket.emit('session-terminated', {
          reason: 'new_login',
          userId: userId,
          sessionId: socketSessionId || 'unknown',
          message: 'Please login again',
        });

        // IMMEDIATE DISCONNECT - don't wait
        try {
          if (socket.connected) {
            // Check if still connected before disconnecting
            socket.disconnect(true);
            logger.log(
              chalk.red(
                `[SOCKET] Disconnected socket ${socket.id} for user ${userId}`,
              ),
            );
          }
        } catch (err) {
          logger.error(
            `[SOCKET] Error disconnecting socket ${socket.id}: ${err.message}`,
          );
        }

        disconnectedCount++;
      }

      logger.log(
        chalk.green(
          `[SOCKET] Successfully disconnected ${disconnectedCount} sockets for user ${userId}`,
        ),
      );
    } else {
      // Global force logout (no excluded session)
      logger.log(
        chalk.red(
          `[SOCKET] Global force logout for user ${userId}, all sessions`,
        ),
      );

      // Process each socket for this user
      let disconnectedCount = 0;
      for (const socket of userActiveSocketsList) {
        const socketSessionId = socket.sessionId || 'unknown';

        // Send targeted messages for reliability
        socket.emit('forceLogout', {
          reason: 'global_logout',
          userId: userId,
          sessionId: socketSessionId,
          message: 'Your session has been terminated by the server.',
          timestamp: new Date().toISOString(),
        });

        socket.emit('session-terminated', {
          reason: 'global_logout',
          userId: userId,
          sessionId: socketSessionId,
          message: 'Please login again',
        });

        // Force disconnect IMMEDIATELY
        try {
          if (socket.connected) {
            socket.disconnect(true);
            logger.log(
              chalk.red(
                `[SOCKET] Disconnected socket ${socket.id} for user ${userId}`,
              ),
            );
            disconnectedCount++;
          }
        } catch (err) {
          logger.error(
            `[SOCKET] Error disconnecting socket ${socket.id}: ${err.message}`,
          );
        }
      }

      logger.log(
        chalk.green(
          `[SOCKET] Successfully disconnected ${disconnectedCount} sockets for user ${userId}`,
        ),
      );
    }

    // Cleanup the userSockets map
    // If we're doing a complete logout (not excluding any session) or targeting a specific session
    if (!excludeSessionId) {
      if (targetSessionId) {
        // Remove only the targeted session from tracking
        const currentTrackedSockets = userSockets.get(userId) || [];
        const updatedSockets = currentTrackedSockets.filter((socketId) => {
          const socket = ioInstance.sockets.sockets.get(socketId);
          return socket && socket.sessionId !== targetSessionId;
        });

        if (updatedSockets.length > 0) {
          userSockets.set(userId, updatedSockets);
          logger.log(
            chalk.yellow(
              `[SOCKET] Updated socket map to exclude targeted session ${targetSessionId}`,
            ),
          );
        } else {
          userSockets.delete(userId);
          logger.log(
            chalk.yellow(
              `[SOCKET] Removed user ${userId} from socket tracking map - no remaining sessions`,
            ),
          );
        }
      } else {
        // Global logout - remove all
        userSockets.delete(userId);
        logger.log(
          chalk.yellow(
            `[SOCKET] Removed user ${userId} from socket tracking map`,
          ),
        );
      }
    } else {
      // If we're preserving a specific session, make sure the map only contains that one
      const preservedSockets = allSockets.filter(
        (socket) =>
          socket.userId === userId && socket.sessionId === excludeSessionId,
      );

      if (preservedSockets.length > 0) {
        userSockets.set(
          userId,
          preservedSockets.map((s) => s.id),
        );
        logger.log(
          chalk.yellow(
            `[SOCKET] Updated socket map to only include preserved session ${excludeSessionId}`,
          ),
        );
      } else {
        // No sockets to preserve, remove the user from tracking
        userSockets.delete(userId);
        logger.log(
          chalk.yellow(
            `[SOCKET] No sockets to preserve, removed user ${userId} from socket tracking map`,
          ),
        );
      }
    }
  } catch (error) {
    logger.error(`[SOCKET] Error in forceLogoutUser: ${error.message}`);
    logger.error(error.stack);
  }

  // Always emit a global logout event for tracking purposes
  if (!excludeSessionId && !targetSessionId) {
    ioInstance.emit('userLoggedOut', {
      userId,
      sessionId: targetSessionId,
      reason: 'forced_logout',
    });
  }
};

const deactivateBank = (nickName, bankId, userId, isWarning = false) => {
  if (!ioInstance) {
    logger.error('Socket.IO not initialized');
    return;
  }

  ioInstance.emit(isWarning ? 'bankStatusWarning' : 'bankStatusUpdate', {
    message: isWarning
      ? `The Bank ${nickName} will be Deactivate soon as the Balance will soon reach the Daily Limit`
      : `The Bank ${nickName} is Deactivated`,
    bankId,
    nickname: nickName,
    userId: userId, //send userid to show notification only to vendor whose bank status is updated
    isEnabled: !isWarning ? false : undefined,
  });
};

// New function to emit event when a specific entry is added to a table
const notifyNewTableEntry = async (tableName, entryType, entryData) => {
  if (!ioInstance) {
    logger.error('Socket.IO not initialized');
    return;
  }

  const eventName = `newTableEntry${tableName}`;
  logger.info(eventName, 'eventName');
  const payload = {
    tableName,
    entryType,
    entryData,
    timestamp: new Date().toISOString(),
  };

  logger.log(
    chalk.bold.cyan(
      `Emitting ${eventName} for table ${tableName}, type ${entryType}`,
    ),
  );
  ioInstance.emit(eventName, payload); // Broadcast to all connected clients
};
// New function to emit event when a specific entry is updated/added in a table
const newTableEntry = async (tableName, data) => {
  if (!ioInstance) {
    logger.error('Socket.IO not initialized');
    return;
  }
  const eventName = `newTableEntry${tableName}`;
  logger.log(chalk.bold.cyan(`Emitting ${eventName} for table ${tableName}`));
  ioInstance.emit(eventName, data);
};

const logOutUser = async (user_id) => {
  if (!ioInstance) {
    logger.error('Socket.IO not initialized');
    return;
  }
  const eventName = `newlogout`;
  logger.log(chalk.bold.cyan(`Emitting ${eventName} for ${user_id}`));
  ioInstance.emit(eventName, user_id);
};
//update payour socket notification
// const updatePayout = (id, code, merchant_order_id) => {
//   if (!ioInstance) {
//     logger.error('Socket.IO not initialized');
//     return;
//   }
//   ioInstance.emit('updatedPayout', {
//     message: `Payout for merchant ${code} with order id ${merchant_order_id} has been updated!`,
//     payoutId: id,
//     merchant_order_id: merchant_order_id,
//     code: code,
//   });
// };

// New function to emit event when a specific entry is added to a Calculation table
// const notifyNewCalculationTableEntry = async (tableName, entryData) => {
//   if (!ioInstance) {
//     logger.error('Socket.IO not initialized');
//     return;
//   }

//   if (entryData && entryData.net_balance <= 0) {
//     const banks = await getBankaccountDao({ user_id: entryData.user_id });
//     const bankIds = banks.map((bank) => bank.id);
//     const bankNickNames = banks.map((bank) => bank.nick_name);
//     const user = await getUserByIdDao(entryData.user_id);
//     bankIds.forEach(async (bankId) => {
//       try {
//         await updateBankaccountDao(
//           { id: bankId, company_id: entryData.company_id },
//           { is_enabled: false },
//         );
//         logger.info(`Successfully disabled bank account with ID ${bankId}`);
//       } catch (error) {
//         logger.error(`Failed to update bank account with ID ${bankId}:`, error);
//       }
//     });

//     const eventName = 'newCalculationTableEntry';
//     logger.info(eventName, 'eventName');
//     logger.log(chalk.bold.cyan(`Emitting ${eventName} for table ${tableName}`));
//     ioInstance.emit(eventName, {
//       message: `Due to Insufficient Balance in ${user} account ${bankNickNames} has been Deactivated`,
//     }); // Broadcast to all connected clients
//   }
// };

//update payour socket notification
// const updatePayout = (id, code, merchant_order_id) => {
//   if (!ioInstance) {
//     logger.error('Socket.IO not initialized');
//     return;
//   }
//   ioInstance.emit('updatedPayout', {
//     message: `Payout for merchant ${code} with order id ${merchant_order_id} has been updated!`,
//     payoutId: id,
//     merchant_order_id: merchant_order_id,
//     code: code,
//   });
// };

// New function to emit event when a specific entry is added to a Calculation table
// const notifyNewCalculationTableEntry = async (tableName, entryData) => {
//   if (!ioInstance) {
//     logger.error('Socket.IO not initialized');
//     return;
//   }

//   if (entryData && entryData.net_balance <= 0) {
//     const banks = await getBankaccountDao({ user_id: entryData.user_id });
//     const bankIds = banks.map((bank) => bank.id);
//     const bankNickNames = banks.map((bank) => bank.nick_name);
//     const user = await getUserByIdDao(entryData.user_id);
//     bankIds.forEach(async (bankId) => {
//       try {
//         await updateBankaccountDao(
//           { id: bankId, company_id: entryData.company_id },
//           { is_enabled: false },
//         );
//         logger.info(`Successfully disabled bank account with ID ${bankId}`);
//       } catch (error) {
//         logger.error(`Failed to update bank account with ID ${bankId}:`, error);
//       }
//     });

//     const eventName = 'newCalculationTableEntry';
//     logger.info(eventName, 'eventName');
//     logger.log(chalk.bold.cyan(`Emitting ${eventName} for table ${tableName}`));
//     ioInstance.emit(eventName, {
//       message: `Due to Insufficient Balance in ${user} account ${bankNickNames} has been Deactivated`,
//     }); // Broadcast to all connected clients
//   }
// };

export {
  initializeSocket,
  forceLogoutUser,
  deactivateBank,
  notifyNewTableEntry,
  // updatePayout,
  newTableEntry,
  logOutUser,
  // notifyNewCalculationTableEntry,
};
