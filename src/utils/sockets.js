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

    // Listen for both 'login' and 'user-login' events for compatibility
    const handleUserLogin = async (data) => {
      // Handle both string and object data formats for backward compatibility
      const userId = typeof data === 'object' ? data.userId : data;
      const sessionId = typeof data === 'object' ? data.sessionId : null;

      if (!userId) {
        logger.error('[SOCKET] Missing userId in login event');
        return;
      }

      // Enhanced logging for all environments
      logger.log(
        chalk.bgBlue.white(
          `[SOCKET] User login event received for userId: ${userId}, sessionId: ${sessionId}, socketId: ${socket.id}`,
        ),
      );

      // Store socket metadata for better tracking - ensure binding happens only once
      if (!socket.userId) {
        socket.userId = userId;
        socket.sessionId = sessionId;
        socket.loginTime = Date.now();
        
        logger.log(
          chalk.bgGreen.white(
            `[SOCKET] Socket ${socket.id} bound to user ${userId}, session ${sessionId}`,
          ),
        );
      } else {
        // Socket already bound, just update the login time to mark as newest
        socket.loginTime = Date.now();
        
        logger.log(
          chalk.bgBlue.white(
            `[SOCKET] Socket ${socket.id} already bound to user ${userId}, updated login time`,
          ),
        );
      }

      // Handle the session management
      try {
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

        // Group sockets by sessionId to handle same browser vs different devices
        if (userActiveSockets.length > 0) {
          // Only terminate sessions from different browsers/devices
          const differentBrowserSockets = userActiveSockets.filter(s => s.sessionId !== sessionId);
          
          if (differentBrowserSockets.length > 0) {
            logger.log(
              chalk.bgRed.white(
                `[SOCKET] User ${userId} has ${differentBrowserSockets.length} sessions from different devices. Terminating different device sessions.`,
              ),
            );

            // Send termination commands to different device sessions only
            const terminationPromises = differentBrowserSockets.map(async (existingSocket) => {
              logger.log(
                chalk.red(
                  `[SOCKET] Terminating different device session ${existingSocket.id}`,
                ),
              );

              try {
                existingSocket.emit('forceLogout', {
                  reason: 'new_login_different_device',
                  userId: userId,
                  sessionId: existingSocket.sessionId || 'unknown',
                  message: 'Your session has been terminated due to a new login from another device.',
                  timestamp: new Date().toISOString()
                });

                existingSocket.emit('session-terminated', {
                  reason: 'new_login_different_device',
                  userId: userId,
                  sessionId: existingSocket.sessionId || 'unknown',
                  message: 'Please login again'
                });

                existingSocket.emit('newLogin', userId);
                existingSocket.emit('newlogout', userId);
                existingSocket.disconnect(true);
                
                logger.log(
                  chalk.red(
                    `[SOCKET] Terminated different device session ${existingSocket.id}`,
                  ),
                );
              } catch (error) {
                logger.error(`[SOCKET] Error terminating socket ${existingSocket.id}: ${error.message}`);
                try {
                  existingSocket.disconnect(true);
                } catch (disconnectError) {
                  logger.error(`[SOCKET] Error force disconnecting socket ${existingSocket.id}: ${disconnectError.message}`);
                }
              }
            });

            // Wait for all termination commands to complete
            try {
              await Promise.allSettled(terminationPromises);
            } catch (error) {
              logger.error(`[SOCKET] Error in parallel termination: ${error.message}`);
            }
            
            logger.log(
              chalk.bgGreen.white(
                `[SOCKET] Successfully terminated ${differentBrowserSockets.length} different device sessions for user ${userId}`,
              ),
            );
          } else {
            logger.log(
              chalk.bgGreen.white(
                `[SOCKET] All ${userActiveSockets.length} existing sessions are from same browser, allowing multiple tabs for user ${userId}`,
              ),
            );
          }
        }

        // Add this socket to our tracking map
        userSockets.set(userId, [socket.id]);

        const loginMessage = chalk.bold.green(
          `[SOCKET] User ${userId} logged in with socket ${socket.id}, ${userActiveSockets.length} old sessions processed`,
        );
        logger.log(loginMessage);

      } catch (error) {
        logger.error(`[SOCKET] Error in login handler: ${error.message}`);
        logger.error(error.stack);
      }
    };

    // Listen for both event names for compatibility
    socket.on('login', handleUserLogin);
    socket.on('user-login', handleUserLogin);

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

  try {
    logger.log(
      chalk.bgRed.white(
        `[SOCKET] forceLogoutUser - userId: ${userId}, target: ${targetSessionId}, exclude: ${excludeSessionId}`,
      ),
    );

    // Get all connected sockets directly from Socket.IO
    const allSockets = await ioInstance.fetchSockets();

    // Find sockets belonging to this user
    const userActiveSocketsList = allSockets.filter(
      (socket) => socket.userId === userId,
    );

    logger.log(
      chalk.bgRed.white(
        `[SOCKET] Found ${userActiveSocketsList.length} active sockets for user ${userId}`,
      ),
    );

    // Parallel disconnection for efficiency
    const disconnectionPromises = userActiveSocketsList
      .filter(socket => {
        // Skip if this is the session we want to exclude
        if (excludeSessionId && socket.sessionId === excludeSessionId) {
          logger.log(
            chalk.green(
              `[SOCKET] Preserving session ${socket.id} with sessionId ${excludeSessionId}`,
            ),
          );
          return false;
        }

        // Skip if this is not the target session (when targeting specific session)
        if (targetSessionId && socket.sessionId !== targetSessionId) {
          logger.log(
            chalk.green(
              `[SOCKET] Skipping non-target session ${socket.id}`,
            ),
          );
          return false;
        }

        return true;
      })
      .map(async (socket) => {
        logger.log(
          chalk.red(
            `[SOCKET] Force disconnecting socket ${socket.id}`,
          ),
        );

        try {
          // Send logout events
          socket.emit('forceLogout', {
            reason: 'force_logout',
            userId: userId,
            sessionId: socket.sessionId || 'unknown',
            message: 'Session terminated by server.',
            timestamp: new Date().toISOString()
          });

          socket.emit('session-terminated', {
            reason: 'force_logout',
            userId: userId,
            sessionId: socket.sessionId || 'unknown',
            message: 'Please login again'
          });

          socket.emit('newLogin', userId);
          socket.emit('newlogout', userId);
          socket.disconnect(true);
          
          logger.log(
            chalk.red(
              `[SOCKET] Disconnected socket ${socket.id}`,
            ),
          );
        } catch (error) {
          logger.error(`[SOCKET] Error disconnecting socket ${socket.id}: ${error.message}`);
          try {
            socket.disconnect(true);
          } catch (disconnectError) {
            logger.error(`[SOCKET] Error force disconnecting socket ${socket.id}: ${disconnectError.message}`);
          }
        }
      });

    // Execute all disconnections in parallel
    if (disconnectionPromises.length > 0) {
      try {
        await Promise.allSettled(disconnectionPromises);
      } catch (error) {
        logger.error(`[SOCKET] Error in parallel disconnection: ${error.message}`);
      }
    }

    // Update tracking map
    if (excludeSessionId) {
      // Keep only the excluded session
      const preservedSockets = userActiveSocketsList.filter(
        socket => socket.sessionId === excludeSessionId
      );
      if (preservedSockets.length > 0) {
        userSockets.set(userId, preservedSockets.map(s => s.id));
      } else {
        userSockets.delete(userId);
      }
    } else {
      // Remove all tracking for this user
      userSockets.delete(userId);
    }
    
    logger.log(
      chalk.green(
        `[SOCKET] Completed force logout for user ${userId}`,
      ),
    );

  } catch (error) {
    logger.error(`[SOCKET] Error in forceLogoutUser: ${error.message}`);
    logger.error(error.stack);
  }

  // Emit global logout event
  ioInstance.emit('userLoggedOut', {
    userId,
    sessionId: targetSessionId,
    reason: 'forced_logout',
  });
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
