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

        // ULTRA-NUCLEAR APPROACH: Disconnect ALL existing sessions and MONITOR continuously
        if (userActiveSockets.length > 0) {
          logger.log(
            chalk.bgRed.white(
              `[SOCKET] ULTRA-NUCLEAR APPROACH - User ${userId} has ${userActiveSockets.length} existing sessions. TERMINATING ALL OLD SESSIONS AGGRESSIVELY, PRESERVING NEW LOGIN.`,
            ),
          );

          // IMMEDIATELY disconnect ALL existing sessions (but NOT the current new socket)
          for (const existingSocket of userActiveSockets) {
            logger.log(
              chalk.red(
                `[SOCKET] ULTRA-NUCLEAR - Immediately terminating old session ${existingSocket.id}`,
              ),
            );

            try {
              // Send MULTIPLE force logout events with different event names for maximum coverage
              existingSocket.emit('forceLogout', {
                reason: 'ultra_nuclear_new_login_detected',
                userId: userId,
                sessionId: existingSocket.sessionId || 'unknown',
                message: 'Your session has been terminated due to a new login from another device.',
                timestamp: new Date().toISOString(),
                immediate: true,
                nuclear: true,
                ultraNuclear: true,
              });

              existingSocket.emit('session-terminated', {
                reason: 'ultra_nuclear_new_login_detected',
                userId: userId,
                sessionId: existingSocket.sessionId || 'unknown',
                message: 'Please login again',
                immediate: true,
                nuclear: true,
                ultraNuclear: true,
              });

              existingSocket.emit('newLogin', userId);

              // ALSO emit disconnect event to force immediate logout
              existingSocket.emit('newlogout', userId);

              // IMMEDIATE disconnection of old session
              existingSocket.disconnect(true);
              
              logger.log(
                chalk.red(
                  `[SOCKET] ULTRA-NUCLEAR - Terminated old session ${existingSocket.id}`,
                ),
              );
            } catch (error) {
              logger.error(`[SOCKET] Error terminating old socket ${existingSocket.id}: ${error.message}`);
              try {
                existingSocket.disconnect(true);
              } catch (disconnectError) {
                logger.error(`[SOCKET] Error force disconnecting old socket ${existingSocket.id}: ${disconnectError.message}`);
              }
            }
          }
          
          // Log successful preservation of new login
          logger.log(
            chalk.bgGreen.white(
              `[SOCKET] ULTRA-NUCLEAR - Successfully preserved new login for user ${userId} on socket ${socket.id}`,
            ),
          );
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

    // Handle session heartbeat to validate active sessions - ULTRA-NUCLEAR APPROACH
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
        
        // ULTRA-NUCLEAR: If multiple sessions detected, ALWAYS keep only the newest one
        if (userSockets.length > 1) {
          logger.log(
            chalk.bgRed.white(
              `[SOCKET] ULTRA-NUCLEAR HEARTBEAT - Multiple sessions detected for user ${userId}. Keeping only the newest session, disconnecting ${userSockets.length - 1} old sessions.`,
            ),
          );
          
          // Get the newest session (highest loginTime)
          const newestSession = userSockets.reduce((newest, current) => {
            return (current.loginTime || 0) > (newest.loginTime || 0) ? current : newest;
          });
          
          // Force logout all sessions EXCEPT the newest one
          for (const userSocket of userSockets) {
            if (userSocket.id !== newestSession.id) {
              logger.log(
                chalk.red(
                  `[SOCKET] ULTRA-NUCLEAR HEARTBEAT - Disconnecting old session ${userSocket.id}`,
                ),
              );
              
              try {
                userSocket.emit('forceLogout', {
                  reason: 'ultra_nuclear_heartbeat_multiple_sessions',
                  userId: userId,
                  sessionId: userSocket.sessionId || 'unknown',
                  message: 'Multiple sessions detected - keeping only the newest session',
                  timestamp: new Date().toISOString(),
                  immediate: true,
                  ultraNuclear: true,
                });
                
                userSocket.emit('session-terminated', {
                  reason: 'ultra_nuclear_heartbeat_multiple_sessions',
                  userId: userId,
                  sessionId: userSocket.sessionId || 'unknown',
                  message: 'Multiple sessions detected - please login again',
                  timestamp: new Date().toISOString(),
                  immediate: true,
                  ultraNuclear: true,
                });
                
                userSocket.emit('newLogin', userId);
                userSocket.emit('newlogout', userId);
                userSocket.disconnect(true);
                
                logger.log(
                  chalk.red(
                    `[SOCKET] ULTRA-NUCLEAR HEARTBEAT - Disconnected old session ${userSocket.id}`,
                  ),
                );
              } catch (error) {
                logger.error(`[SOCKET] ULTRA-NUCLEAR HEARTBEAT - Error forcing logout of socket ${userSocket.id}: ${error.message}`);
                try {
                  userSocket.disconnect(true);
                } catch (disconnectError) {
                  logger.error(`[SOCKET] ULTRA-NUCLEAR HEARTBEAT - Error disconnecting socket ${userSocket.id}: ${disconnectError.message}`);
                }
              }
            }
          }
          
          logger.log(
            chalk.bgGreen.white(
              `[SOCKET] ULTRA-NUCLEAR HEARTBEAT - Preserved newest session ${newestSession.id} for user ${userId}`,
            ),
          );
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

  // ULTRA-NUCLEAR APPROACH: Extremely aggressive monitoring to prevent ANY multiple sessions
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
      
      // ULTRA-NUCLEAR: If ANY user has multiple sessions, IMMEDIATELY disconnect all old ones
      for (const [userId, userSockets] of userSessionMap) {
        if (userSockets.length > 1) {
          logger.log(
            chalk.bgRed.white(
              `[SOCKET] ULTRA-NUCLEAR CLEANUP - User ${userId} has ${userSockets.length} active sessions. KEEPING ONLY THE NEWEST SESSION.`,
            ),
          );
          
          // Find the newest session (highest loginTime)
          const newestSocket = userSockets.reduce((newest, current) => {
            return (current.loginTime || 0) > (newest.loginTime || 0) ? current : newest;
          });
          
          // Disconnect ALL sessions EXCEPT the newest one
          for (const userSocket of userSockets) {
            if (userSocket.id !== newestSocket.id) {
              logger.log(
                chalk.red(
                  `[SOCKET] ULTRA-NUCLEAR CLEANUP - Disconnecting old session ${userSocket.id} for user ${userId}`,
                ),
              );
              
              try {
                // Send multiple events for maximum logout coverage
                userSocket.emit('forceLogout', {
                  reason: 'ultra_nuclear_cleanup_multiple_sessions',
                  userId: userId,
                  sessionId: userSocket.sessionId || 'unknown',
                  message: 'Multiple sessions detected - only the newest session is allowed',
                  timestamp: new Date().toISOString(),
                  immediate: true,
                  ultraNuclear: true,
                });
                
                userSocket.emit('session-terminated', {
                  reason: 'ultra_nuclear_cleanup_multiple_sessions',
                  userId: userId,
                  sessionId: userSocket.sessionId || 'unknown',
                  message: 'Multiple sessions detected - please login again',
                  timestamp: new Date().toISOString(),
                  immediate: true,
                  ultraNuclear: true,
                });
                
                userSocket.emit('newLogin', userId);
                userSocket.emit('newlogout', userId);
                
                userSocket.disconnect(true);
                
                logger.log(
                  chalk.red(
                    `[SOCKET] ULTRA-NUCLEAR CLEANUP - Disconnected old session ${userSocket.id}`,
                  ),
                );
              } catch (error) {
                logger.error(`[SOCKET] ULTRA-NUCLEAR CLEANUP - Error cleaning up socket ${userSocket.id}: ${error.message}`);
                try {
                  userSocket.disconnect(true);
                } catch (disconnectError) {
                  logger.error(`[SOCKET] ULTRA-NUCLEAR CLEANUP - Error force disconnecting socket ${userSocket.id}: ${disconnectError.message}`);
                }
              }
            }
          }
          
          logger.log(
            chalk.bgGreen.white(
              `[SOCKET] ULTRA-NUCLEAR CLEANUP - Preserved newest session ${newestSocket.id} for user ${userId}`,
            ),
          );
        }
      }
    } catch (error) {
      logger.error(`[SOCKET] Error in ultra-nuclear cleanup: ${error.message}`);
    }
  }, 5000); // Run every 5 seconds for ultra-aggressive monitoring
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
        `[SOCKET] NUCLEAR forceLogoutUser - userId: ${userId}, target: ${targetSessionId}, exclude: ${excludeSessionId}`,
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
        `[SOCKET] NUCLEAR - Found ${userActiveSocketsList.length} active sockets for user ${userId}`,
      ),
    );

    // NUCLEAR APPROACH: If we have excludeSessionId, preserve it; otherwise disconnect oldest sessions
    let socketsToDisconnect = userActiveSocketsList;
    
    if (excludeSessionId) {
      // Preserve the excluded session
      socketsToDisconnect = userActiveSocketsList.filter(
        socket => socket.sessionId !== excludeSessionId
      );
      logger.log(
        chalk.green(
          `[SOCKET] NUCLEAR - Preserving session ${excludeSessionId}, disconnecting ${socketsToDisconnect.length} other sessions`,
        ),
      );
    } else if (userActiveSocketsList.length > 1) {
      // If no exclude specified but multiple sessions, keep the newest one
      const newestSocket = userActiveSocketsList.reduce((newest, current) => {
        return (current.loginTime || 0) > (newest.loginTime || 0) ? current : newest;
      });
      
      socketsToDisconnect = userActiveSocketsList.filter(
        socket => socket.id !== newestSocket.id
      );
      
      logger.log(
        chalk.green(
          `[SOCKET] NUCLEAR - Preserving newest session ${newestSocket.id}, disconnecting ${socketsToDisconnect.length} older sessions`,
        ),
      );
    }

    // Disconnect the selected sockets
    for (const socket of socketsToDisconnect) {
      logger.log(
        chalk.red(
          `[SOCKET] NUCLEAR - Force disconnecting socket ${socket.id} for user ${userId}`,
        ),
      );

      try {
        // Send force logout events
        socket.emit('forceLogout', {
          reason: 'nuclear_force_logout',
          userId: userId,
          sessionId: socket.sessionId || 'unknown',
          message: 'Session terminated by server.',
          timestamp: new Date().toISOString(),
          immediate: true,
          nuclear: true,
        });

        socket.emit('session-terminated', {
          reason: 'nuclear_force_logout',
          userId: userId,
          sessionId: socket.sessionId || 'unknown',
          message: 'Please login again',
          immediate: true,
          nuclear: true,
        });

        // IMMEDIATE disconnection
        socket.disconnect(true);
        
        logger.log(
          chalk.red(
            `[SOCKET] NUCLEAR - Disconnected socket ${socket.id}`,
          ),
        );
      } catch (error) {
        logger.error(`[SOCKET] Error disconnecting socket ${socket.id}: ${error.message}`);
      }
    }

    // Update tracking - only remove if we disconnected all sessions
    if (socketsToDisconnect.length === userActiveSocketsList.length) {
      userSockets.delete(userId);
    }
    
    logger.log(
      chalk.green(
        `[SOCKET] NUCLEAR - Completed force logout for user ${userId} (${socketsToDisconnect.length} sessions disconnected, ${userActiveSocketsList.length - socketsToDisconnect.length} preserved)`,
      ),
    );

  } catch (error) {
    logger.error(`[SOCKET] Error in forceLogoutUser: ${error.message}`);
    logger.error(error.stack);
  }

  // Emit global logout event if we found any sockets for this user
  ioInstance.emit('userLoggedOut', {
    userId,
    sessionId: targetSessionId,
    reason: 'nuclear_forced_logout',
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
