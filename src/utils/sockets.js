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
    // ULTIMATE NUCLEAR: Immediate enforcement on ANY new connection
    socket.on('connect', () => {
      logger.log(
        chalk.bgRed.white(
          `[SOCKET] ULTIMATE NUCLEAR - New connection detected: ${socket.id}`,
        ),
      );
    });

    socket.on('pingCheck', () => {
      socket.emit('pongCheck');
    });
    
    // NUCLEAR: Immediate connection verification to prevent phantom sessions
    socket.on('connectionVerify', (data) => {
      const { userId, sessionId } = data;
      if (userId && sessionId) {
        // Verify this socket is the only one for this user
        ioInstance.fetchSockets().then(allSockets => {
          const userSockets = allSockets.filter(s => s.userId === userId && s.id !== socket.id);
          if (userSockets.length > 0) {
            logger.log(
              chalk.bgRed.white(
                `[SOCKET] NUCLEAR CONNECTION VERIFY - Found ${userSockets.length} other sessions for user ${userId}, terminating them`,
              ),
            );
            
            // Immediately disconnect other sessions
            userSockets.forEach(otherSocket => {
              try {
                otherSocket.emit('forceLogout', {
                  reason: 'nuclear_connection_verify',
                  userId: userId,
                  message: 'Connection verification failed - multiple sessions detected',
                  nuclear: true,
                  priority: 'CRITICAL'
                });
                otherSocket.disconnect(true);
              } catch (error) {
                logger.error(`[SOCKET] Error in connection verify cleanup: ${error.message}`);
              }
            });
          }
        });
      }
    });

    // NUCLEAR: Handle phantom session check for immediate cleanup
    socket.on('phantomSessionCheck', async (data) => {
      const { userId, sessionId } = data;
      
      if (!userId) {
        return;
      }

      try {
        logger.log(
          chalk.bgMagenta.white(
            `[SOCKET] NUCLEAR PHANTOM CHECK - Verifying session ${sessionId} for user ${userId}`,
          ),
        );
        
        // Get all sockets for this user
        const allSockets = await ioInstance.fetchSockets();
        const userSockets = allSockets.filter(s => s.userId === userId);
        
        // If multiple sessions exist, terminate all except the newest
        if (userSockets.length > 1) {
          logger.log(
            chalk.bgRed.white(
              `[SOCKET] NUCLEAR PHANTOM CHECK - Found ${userSockets.length} sessions for user ${userId}, terminating phantom sessions`,
            ),
          );
          
          // Find the newest session (this one)
          const newestSession = userSockets.find(s => s.sessionId === sessionId) || userSockets[userSockets.length - 1];
          
          // Terminate all other sessions immediately
          const terminationPromises = userSockets
            .filter(s => s.id !== newestSession.id)
            .map(async (phantomSocket) => {
              try {
                phantomSocket.emit('forceLogout', {
                  reason: 'nuclear_phantom_session_detected',
                  userId: userId,
                  message: 'Phantom session terminated',
                  nuclear: true,
                  priority: 'CRITICAL'
                });
                phantomSocket.disconnect(true);
              } catch (error) {
                logger.error(`[SOCKET] Error terminating phantom session: ${error.message}`);
              }
            });
            
          await Promise.allSettled(terminationPromises);
        }
      } catch (error) {
        logger.error(`[SOCKET] Error in phantom session check: ${error.message}`);
      }
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

      // ULTIMATE NUCLEAR: INSTANT PRE-TERMINATION - Kill ALL existing sessions for this user IMMEDIATELY
      try {
        const allSockets = await ioInstance.fetchSockets();
        const existingUserSockets = allSockets.filter(s => s.userId === userId && s.id !== socket.id);
        
        if (existingUserSockets.length > 0) {
          logger.log(
            chalk.bgRed.white(
              `[SOCKET] ULTIMATE NUCLEAR PRE-TERMINATION - Found ${existingUserSockets.length} existing sessions for user ${userId}. TERMINATING INSTANTLY.`,
            ),
          );
          
          // INSTANT parallel termination - no delays whatsoever
          const instantTerminationPromises = existingUserSockets.map(async (existingSocket) => {
            try {
              existingSocket.emit('forceLogout', {
                reason: 'ultimate_nuclear_pre_termination',
                userId: userId,
                message: 'New login detected - session terminated instantly',
                nuclear: true,
                ultraNuclear: true,
                priority: 'CRITICAL',
                instant: true
              });
              existingSocket.disconnect(true);
            } catch (error) {
              logger.error(`[SOCKET] Error in instant termination: ${error.message}`);
            }
          });
          
          // Wait for instant termination to complete
          await Promise.allSettled(instantTerminationPromises);
          
          logger.log(
            chalk.bgGreen.white(
              `[SOCKET] ULTIMATE NUCLEAR PRE-TERMINATION - Successfully terminated ${existingUserSockets.length} sessions instantly`,
            ),
          );
        }
      } catch (error) {
        logger.error(`[SOCKET] Error in instant pre-termination: ${error.message}`);
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

        // NUCLEAR ENFORCEMENT: IMMEDIATE termination of ALL existing sessions
        if (userActiveSockets.length > 0) {
          logger.log(
            chalk.bgRed.white(
              `[SOCKET] NUCLEAR ENFORCEMENT - User ${userId} has ${userActiveSockets.length} existing sessions. TERMINATING ALL OLD SESSIONS IMMEDIATELY.`,
            ),
          );

          // NUCLEAR STEP 1: Send immediate termination commands to ALL old sessions
          const terminationPromises = userActiveSockets.map(async (existingSocket) => {
            logger.log(
              chalk.red(
                `[SOCKET] NUCLEAR ENFORCEMENT - Immediately terminating session ${existingSocket.id}`,
              ),
            );

            try {
              // Send EVERY possible logout event for maximum coverage
              existingSocket.emit('forceLogout', {
                reason: 'nuclear_new_login_detected',
                userId: userId,
                sessionId: existingSocket.sessionId || 'unknown',
                message: 'Your session has been terminated due to a new login from another device.',
                timestamp: new Date().toISOString(),
                immediate: true,
                nuclear: true,
                priority: 'CRITICAL'
              });

              existingSocket.emit('session-terminated', {
                reason: 'nuclear_new_login_detected',
                userId: userId,
                sessionId: existingSocket.sessionId || 'unknown',
                message: 'Please login again',
                immediate: true,
                nuclear: true,
                priority: 'CRITICAL'
              });

              // FIXED: Only send newLogin to OLD sessions being terminated, not the new session
              existingSocket.emit('newLogin', userId);
              existingSocket.emit('newlogout', userId);

              // FORCE disconnect without any delay
              existingSocket.disconnect(true);
              
              logger.log(
                chalk.red(
                  `[SOCKET] NUCLEAR ENFORCEMENT - Terminated session ${existingSocket.id}`,
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

          // Wait for all termination commands to complete (max 500ms)
          try {
            await Promise.allSettled(terminationPromises);
          } catch (error) {
            logger.error(`[SOCKET] Error in parallel termination: ${error.message}`);
          }
          
          logger.log(
            chalk.bgGreen.white(
              `[SOCKET] NUCLEAR ENFORCEMENT - Successfully preserved new login for user ${userId} on socket ${socket.id}`,
            ),
          );
        }

        // Add this socket to our tracking map - only track the new socket
        userSockets.set(userId, [socket.id]);

          // NUCLEAR: Ultra-aggressive cleanup - INSTANT socket operations
          setTimeout(async () => {
            try {
              // Force logout other sessions immediately for maximum aggressiveness
              await forceLogoutUser(userId, null, sessionId);
              
              logger.log(
                chalk.bgMagenta.white(
                  `[SOCKET] ULTIMATE NUCLEAR - Instant socket cleanup completed for user ${userId}`,
                ),
              );
            } catch (cleanupError) {
              logger.error(`[SOCKET] Error in ultimate nuclear socket cleanup: ${cleanupError.message}`);
            }
          }, 10); // ULTIMATE NUCLEAR: 10ms ultra-fast cleanup

        const loginMessage = chalk.bold.green(
          `[SOCKET] User ${userId} logged in with socket ${socket.id}, ${userActiveSockets.length} old sessions terminated`,
        );
        logger.log(loginMessage);

        // FIXED: No longer emit global newLogin - we send it specifically to old sessions being terminated
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

    // Handle session heartbeat to validate active sessions - NUCLEAR ENFORCEMENT
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
        
        // NUCLEAR: If multiple sessions detected, ALWAYS keep only the newest one
        if (userSockets.length > 1) {
          logger.log(
            chalk.bgRed.white(
              `[SOCKET] NUCLEAR HEARTBEAT - Multiple sessions detected for user ${userId}. Keeping only the newest session, disconnecting ${userSockets.length - 1} old sessions.`,
            ),
          );
          
          // Get the newest session (highest loginTime)
          const newestSession = userSockets.reduce((newest, current) => {
            return (current.loginTime || 0) > (newest.loginTime || 0) ? current : newest;
          });
          
          // NUCLEAR: Parallel logout of all sessions EXCEPT the newest one
          const logoutPromises = userSockets
            .filter(userSocket => userSocket.id !== newestSession.id)
            .map(async (userSocket) => {
              logger.log(
                chalk.red(
                  `[SOCKET] NUCLEAR HEARTBEAT - Disconnecting old session ${userSocket.id}`,
                ),
              );
              
              try {
                // NUCLEAR EVENTS - Multiple critical events with high priority
                userSocket.emit('forceLogout', {
                  reason: 'nuclear_heartbeat_multiple_sessions',
                  userId: userId,
                  sessionId: userSocket.sessionId || 'unknown',
                  message: 'Multiple sessions detected - keeping only the newest session',
                  timestamp: new Date().toISOString(),
                  immediate: true,
                  nuclear: true,
                  priority: 'CRITICAL'
                });
                
                userSocket.emit('session-terminated', {
                  reason: 'nuclear_heartbeat_multiple_sessions',
                  userId: userId,
                  sessionId: userSocket.sessionId || 'unknown',
                  message: 'Multiple sessions detected - please login again',
                  timestamp: new Date().toISOString(),
                  immediate: true,
                  nuclear: true,
                  priority: 'CRITICAL'
                });
                
                userSocket.emit('newLogin', userId);
                userSocket.emit('newlogout', userId);
                
                // IMMEDIATE FORCE DISCONNECT
                userSocket.disconnect(true);
                
                logger.log(
                  chalk.red(
                    `[SOCKET] NUCLEAR HEARTBEAT - Disconnected old session ${userSocket.id}`,
                  ),
                );
              } catch (error) {
                logger.error(`[SOCKET] NUCLEAR HEARTBEAT - Error forcing logout of socket ${userSocket.id}: ${error.message}`);
                try {
                  userSocket.disconnect(true);
                } catch (disconnectError) {
                  logger.error(`[SOCKET] NUCLEAR HEARTBEAT - Error disconnecting socket ${userSocket.id}: ${disconnectError.message}`);
                }
              }
            });

          // Execute all logouts in parallel and wait
          try {
            await Promise.allSettled(logoutPromises);
          } catch (error) {
            logger.error(`[SOCKET] NUCLEAR HEARTBEAT - Error in parallel logout: ${error.message}`);
          }
          
          logger.log(
            chalk.bgGreen.white(
              `[SOCKET] NUCLEAR HEARTBEAT - Preserved newest session ${newestSession.id} for user ${userId}`,
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

  // NUCLEAR ENFORCEMENT: Ultra-aggressive continuous monitoring with DB session validation
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
      
      // NUCLEAR ENFORCEMENT: If ANY user has multiple sessions, keep only the newest
      const cleanupPromises = [];
      
      for (const [userId, userSockets] of userSessionMap) {
        if (userSockets.length > 1) {
          logger.log(
            chalk.bgRed.white(
              `[SOCKET] NUCLEAR CLEANUP - User ${userId} has ${userSockets.length} sessions. KEEPING ONLY THE NEWEST.`,
            ),
          );
          
          // Find the newest session (highest loginTime)
          const newestSocket = userSockets.reduce((newest, current) => {
            return (current.loginTime || 0) > (newest.loginTime || 0) ? current : newest;
          });
          
          // NUCLEAR: Parallel cleanup of all sessions EXCEPT the newest one
          const sessionCleanupPromises = userSockets
            .filter(userSocket => userSocket.id !== newestSocket.id)
            .map(async (userSocket) => {
              logger.log(
                chalk.red(
                  `[SOCKET] NUCLEAR CLEANUP - Terminating old session ${userSocket.id}`,
                ),
              );
              
              try {
                // NUCLEAR EVENTS - Critical priority termination
                userSocket.emit('forceLogout', {
                  reason: 'nuclear_cleanup_multiple_sessions',
                  userId: userId,
                  sessionId: userSocket.sessionId || 'unknown',
                  message: 'Multiple sessions detected - only newest session allowed',
                  timestamp: new Date().toISOString(),
                  immediate: true,
                  nuclear: true,
                  priority: 'CRITICAL'
                });
                
                userSocket.emit('session-terminated', {
                  reason: 'nuclear_cleanup_multiple_sessions',
                  userId: userId,
                  sessionId: userSocket.sessionId || 'unknown',
                  message: 'Multiple sessions detected - please login again',
                  timestamp: new Date().toISOString(),
                  immediate: true,
                  nuclear: true,
                  priority: 'CRITICAL'
                });
                
                userSocket.emit('newLogin', userId);
                userSocket.emit('newlogout', userId);
                userSocket.disconnect(true);
                
                logger.log(
                  chalk.red(
                    `[SOCKET] NUCLEAR CLEANUP - Terminated session ${userSocket.id}`,
                  ),
                );
              } catch (error) {
                logger.error(`[SOCKET] NUCLEAR CLEANUP - Error: ${error.message}`);
                try {
                  userSocket.disconnect(true);
                } catch (disconnectError) {
                  logger.error(`[SOCKET] NUCLEAR CLEANUP - Disconnect error: ${disconnectError.message}`);
                }
              }
            });

          cleanupPromises.push(...sessionCleanupPromises);
        }
      }

      // Execute all cleanup operations in parallel
      if (cleanupPromises.length > 0) {
        try {
          await Promise.allSettled(cleanupPromises);
        } catch (error) {
          logger.error(`[SOCKET] NUCLEAR CLEANUP - Error in parallel cleanup: ${error.message}`);
        }
      }
    } catch (error) {
      logger.error(`[SOCKET] Error in nuclear cleanup: ${error.message}`);
    }
  }, 100); // ULTIMATE NUCLEAR: Check every 100ms for ZERO timing windows
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

    // NUCLEAR APPROACH: Parallel disconnection for maximum speed
    const disconnectionPromises = userActiveSocketsList
      .filter(socket => {
        // Skip if this is the session we want to exclude
        if (excludeSessionId && socket.sessionId === excludeSessionId) {
          logger.log(
            chalk.green(
              `[SOCKET] NUCLEAR - Preserving session ${socket.id} with sessionId ${excludeSessionId}`,
            ),
          );
          return false;
        }

        // Skip if this is not the target session (when targeting specific session)
        if (targetSessionId && socket.sessionId !== targetSessionId) {
          logger.log(
            chalk.green(
              `[SOCKET] NUCLEAR - Skipping non-target session ${socket.id}`,
            ),
          );
          return false;
        }

        return true;
      })
      .map(async (socket) => {
        logger.log(
          chalk.red(
            `[SOCKET] NUCLEAR - Force disconnecting socket ${socket.id}`,
          ),
        );

        try {
          // Send all logout events with NUCLEAR priority
          socket.emit('forceLogout', {
            reason: 'nuclear_force_logout',
            userId: userId,
            sessionId: socket.sessionId || 'unknown',
            message: 'Session terminated by server.',
            timestamp: new Date().toISOString(),
            immediate: true,
            nuclear: true,
            priority: 'CRITICAL'
          });

          socket.emit('session-terminated', {
            reason: 'nuclear_force_logout',
            userId: userId,
            sessionId: socket.sessionId || 'unknown',
            message: 'Please login again',
            immediate: true,
            nuclear: true,
            priority: 'CRITICAL'
          });

          socket.emit('newLogin', userId);
          socket.emit('newlogout', userId);

          // IMMEDIATE disconnection
          socket.disconnect(true);
          
          logger.log(
            chalk.red(
              `[SOCKET] NUCLEAR - Disconnected socket ${socket.id}`,
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
        logger.error(`[SOCKET] NUCLEAR - Error in parallel disconnection: ${error.message}`);
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
        `[SOCKET] NUCLEAR - Completed force logout for user ${userId}`,
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
