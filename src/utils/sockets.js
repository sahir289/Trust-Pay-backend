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
      logger.log(
        chalk.cyan(
          `[SOCKET] Config origins: Front=${config?.reactFrontOrigin}, Payment=${config?.reactPaymentOrigin}`,
        ),
      );
      logger.log(
        chalk.yellow(
          `[SOCKET] Socket origin: ${socket.handshake.headers.origin || 'N/A'}, Referer: ${socket.handshake.headers.referer || 'N/A'}`,
        ),
      );

      // Store socket metadata for better tracking
      socket.userId = userId;
      socket.sessionId = sessionId;
      socket.loginTime = Date.now();

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

        // ZERO-TOLERANCE POLICY: ANY duplicate session results in IMMEDIATE disconnection of ALL sessions
        if (userActiveSockets.length > 0) {
          logger.log(
            chalk.bgRed.white(
              `[SOCKET] ZERO-TOLERANCE POLICY - User ${userId} attempting login with ${userActiveSockets.length} existing sessions. DISCONNECTING ALL SESSIONS INCLUDING THE NEW ONE.`,
            ),
          );

          // IMMEDIATELY disconnect ALL existing sessions
          for (const existingSocket of userActiveSockets) {
            logger.log(
              chalk.red(
                `[SOCKET] ZERO-TOLERANCE - Disconnecting existing socket ${existingSocket.id}`,
              ),
            );

            try {
              // Send force logout events
              existingSocket.emit('forceLogout', {
                reason: 'zero_tolerance_multiple_sessions',
                userId: userId,
                sessionId: existingSocket.sessionId || 'unknown',
                message: 'Multiple sessions detected - all sessions terminated.',
                timestamp: new Date().toISOString(),
                immediate: true,
                zeroTolerance: true,
              });

              // IMMEDIATE disconnection
              existingSocket.disconnect(true);
              
              logger.log(
                chalk.red(
                  `[SOCKET] ZERO-TOLERANCE - Disconnected existing socket ${existingSocket.id}`,
                ),
              );
            } catch (error) {
              logger.error(`[SOCKET] Error disconnecting existing socket ${existingSocket.id}: ${error.message}`);
              try {
                existingSocket.disconnect(true);
              } catch (disconnectError) {
                logger.error(`[SOCKET] Error force disconnecting socket ${existingSocket.id}: ${disconnectError.message}`);
              }
            }
          }

          // ALSO disconnect the new socket attempting to connect
          logger.log(
            chalk.red(
              `[SOCKET] ZERO-TOLERANCE - Also disconnecting NEW socket ${socket.id} to enforce single session policy`,
            ),
          );

          try {
            socket.emit('forceLogout', {
              reason: 'zero_tolerance_policy',
              userId: userId,
              sessionId: sessionId || 'unknown',
              message: 'Multiple sessions detected - please try logging in again.',
              timestamp: new Date().toISOString(),
              immediate: true,
              zeroTolerance: true,
            });

            // Disconnect the new socket as well
            socket.disconnect(true);
            
            logger.log(
              chalk.red(
                `[SOCKET] ZERO-TOLERANCE - Disconnected new socket ${socket.id}`,
              ),
            );
            
            // Exit early - don't proceed with normal login flow
            return;
          } catch (error) {
            logger.error(`[SOCKET] Error disconnecting new socket ${socket.id}: ${error.message}`);
          }
        }

        // Add this socket to our tracking map
        userSockets.set(userId, [socket.id]); // Only track the new socket

        const loginMessage = chalk.bold.green(
          `[SOCKET] User ${userId} logged in with socket ${socket.id}, ${userActiveSockets.length} old sessions terminated`,
        );
        logger.log(loginMessage);

        // Emit new login event
        const eventName = `newLogin`;
        logger.log(
          chalk.bold.cyan(`[SOCKET] Emitting ${eventName} for ${userId}`),
        );
        ioInstance.emit(eventName, userId);
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

    // Handle session heartbeat to validate active sessions - ULTRA AGGRESSIVE
    socket.on('sessionHeartbeat', async (data) => {
      const { userId } = data;
      
      if (!userId) {
        return;
      }

      try {
        // Check if there are multiple sessions for this user
        const allSockets = await ioInstance.fetchSockets();
        const userSockets = allSockets.filter(s => s.userId === userId);
        
        logger.log(
          chalk.magenta(
            `[SOCKET] Heartbeat check for user ${userId}: found ${userSockets.length} sessions`,
          ),
        );
        
        if (userSockets.length > 1) {
          // Multiple sessions detected - IMMEDIATELY force logout all except the current one
          logger.log(
            chalk.bgRed.white(
              `[SOCKET] HEARTBEAT - Multiple sessions detected for user ${userId}. Forcing logout of ${userSockets.length - 1} old sessions.`,
            ),
          );
          
          // Force logout all other sessions EXCEPT the one sending the heartbeat
          for (const userSocket of userSockets) {
            if (userSocket.id !== socket.id) {
              logger.log(
                chalk.red(
                  `[SOCKET] HEARTBEAT - Immediately disconnecting old session ${userSocket.id}`,
                ),
              );
              
              try {
                // Send multiple events for maximum coverage
                userSocket.emit('forceLogout', {
                  reason: 'multiple_sessions_detected_heartbeat',
                  userId: userId,
                  sessionId: userSocket.sessionId || 'unknown',
                  message: 'Multiple sessions detected - keeping only the newest session',
                  timestamp: new Date().toISOString(),
                  immediate: true,
                });
                
                userSocket.emit('session-terminated', {
                  reason: 'multiple_sessions_detected_heartbeat',
                  userId: userId,
                  sessionId: userSocket.sessionId || 'unknown',
                  message: 'Multiple sessions detected - please login again',
                  timestamp: new Date().toISOString(),
                  immediate: true,
                });
                
                userSocket.emit('newLogin', userId);
                
                // IMMEDIATE disconnection
                userSocket.disconnect(true);
                
                logger.log(
                  chalk.red(
                    `[SOCKET] HEARTBEAT - Immediately disconnected old session ${userSocket.id}`,
                  ),
                );
              } catch (error) {
                logger.error(`[SOCKET] HEARTBEAT - Error forcing logout of socket ${userSocket.id}: ${error.message}`);
                // Still try to disconnect
                try {
                  userSocket.disconnect(true);
                } catch (disconnectError) {
                  logger.error(`[SOCKET] HEARTBEAT - Error disconnecting socket ${userSocket.id}: ${disconnectError.message}`);
                }
              }
            }
          }
        }
      } catch (error) {
        logger.error(`[SOCKET] Error in sessionHeartbeat handler: ${error.message}`);
      }
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

  // ZERO-TOLERANCE: Very frequent cleanup to ensure no duplicate sessions persist
  setInterval(async () => {
    try {
      if (!ioInstance) return;
      
      const allSockets = await ioInstance.fetchSockets();
      const userSessionMap = new Map();
      
      // Group sockets by userId
      for (const socket of allSockets) {
        if (socket.userId) {
          if (!userSessionMap.has(socket.userId)) {
            userSessionMap.set(socket.userId, []);
          }
          userSessionMap.get(socket.userId).push(socket);
        }
      }
      
      // ZERO-TOLERANCE: If ANY user has multiple sessions, disconnect ALL their sessions
      for (const [userId, userSockets] of userSessionMap) {
        if (userSockets.length > 1) {
          logger.log(
            chalk.bgRed.white(
              `[SOCKET] ZERO-TOLERANCE CLEANUP - User ${userId} has ${userSockets.length} active sessions. DISCONNECTING ALL SESSIONS.`,
            ),
          );
          
          // Disconnect ALL sessions for this user
          for (const userSocket of userSockets) {
            logger.log(
              chalk.red(
                `[SOCKET] ZERO-TOLERANCE CLEANUP - Disconnecting session ${userSocket.id} for user ${userId}`,
              ),
            );
            
            try {
              userSocket.emit('forceLogout', {
                reason: 'zero_tolerance_cleanup_multiple_sessions',
                userId: userId,
                sessionId: userSocket.sessionId || 'unknown',
                message: 'Multiple sessions detected - all sessions terminated',
                timestamp: new Date().toISOString(),
                immediate: true,
                zeroTolerance: true,
              });
              
              userSocket.disconnect(true);
            } catch (error) {
              logger.error(`[SOCKET] ZERO-TOLERANCE CLEANUP - Error cleaning up socket ${userSocket.id}: ${error.message}`);
            }
          }
        }
      }
    } catch (error) {
      logger.error(`[SOCKET] Error in zero-tolerance cleanup: ${error.message}`);
    }
  }, 10000); // Run every 10 seconds for ultra-aggressive monitoring
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
        `[SOCKET] ZERO-TOLERANCE forceLogoutUser - userId: ${userId}, target: ${targetSessionId}, exclude: ${excludeSessionId}`,
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
        `[SOCKET] ZERO-TOLERANCE - Found ${userActiveSocketsList.length} active sockets for user ${userId}`,
      ),
    );

    // ZERO-TOLERANCE: Disconnect ALL sockets for this user regardless of session IDs
    for (const socket of userActiveSocketsList) {
      logger.log(
        chalk.red(
          `[SOCKET] ZERO-TOLERANCE - Force disconnecting socket ${socket.id} for user ${userId}`,
        ),
      );

      try {
        // Send force logout events
        socket.emit('forceLogout', {
          reason: 'zero_tolerance_force_logout',
          userId: userId,
          sessionId: socket.sessionId || 'unknown',
          message: 'Session terminated by server.',
          timestamp: new Date().toISOString(),
          immediate: true,
          zeroTolerance: true,
        });

        socket.emit('session-terminated', {
          reason: 'zero_tolerance_force_logout',
          userId: userId,
          sessionId: socket.sessionId || 'unknown',
          message: 'Please login again',
          immediate: true,
          zeroTolerance: true,
        });

        // IMMEDIATE disconnection
        socket.disconnect(true);
        
        logger.log(
          chalk.red(
            `[SOCKET] ZERO-TOLERANCE - Disconnected socket ${socket.id}`,
          ),
        );
      } catch (error) {
        logger.error(`[SOCKET] Error disconnecting socket ${socket.id}: ${error.message}`);
      }
    }

    // Clear tracking
    userSockets.delete(userId);
    
    logger.log(
      chalk.green(
        `[SOCKET] ZERO-TOLERANCE - Completed force logout for user ${userId}`,
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
    reason: 'zero_tolerance_forced_logout',
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
