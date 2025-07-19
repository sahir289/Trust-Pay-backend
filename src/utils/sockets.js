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

      // Enhanced staging environment detection and logging
      const environment = process.env.NODE_ENV || 'development';
      const isStaging =
        environment === 'production' ||
        environment === 'staging' ||
        process.env.VERCEL ||
        process.env.NETLIFY ||
        (typeof window !== 'undefined' &&
          window.location.hostname !== 'localhost');

      logger.log(
        chalk.bgBlue.white(
          `[SOCKET] User login event received for userId: ${userId}, sessionId: ${sessionId}, socketId: ${socket.id}`,
        ),
      );
      logger.log(
        chalk.magenta(
          `[SOCKET] Environment: ${environment}, Is Staging: ${isStaging}`,
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

      if (isStaging) {
        logger.log(
          chalk.bgRed.white(
            '[SOCKET] STAGING Environment detected - Enhanced logging enabled',
          ),
        );
        logger.log(
          chalk.red(
            `[SOCKET] Socket headers: ${JSON.stringify(socket.handshake.headers, null, 2)}`,
          ),
        );
      }

      // Store socket metadata for better tracking
      socket.userId = userId;
      socket.sessionId = sessionId;
      socket.loginTime = Date.now();
      socket.environment = environment;
      socket.isStaging = isStaging;

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

        // Add this socket to our tracking map
        const sameSessionSockets = sessionId
          ? userActiveSockets
              .filter((s) => s.sessionId === sessionId)
              .map((s) => s.id)
          : [];
        userSockets.set(userId, [socket.id, ...sameSessionSockets]);

        // Use our centralized forceLogoutUser function to handle session cleanup
        // This will logout all other sessions except the current one (sessionId)
        if (sessionId) {
          // CRITICAL DEBUG: Log all existing sessions for this user before force logout
          logger.log(
            chalk.bgMagenta.white(
              `[SOCKET] CRITICAL DEBUG - Before force logout for user ${userId}:`
            ),
          );
          userActiveSockets.forEach((existingSocket, index) => {
            logger.log(
              chalk.magenta(
                `[SOCKET] Existing Socket ${index + 1}: ID=${existingSocket.id}, SessionID="${existingSocket.sessionId}", LoginTime=${existingSocket.loginTime}`,
              ),
            );
          });
          logger.log(
            chalk.bgMagenta.white(
              `[SOCKET] NEW Socket: ID=${socket.id}, SessionID="${sessionId}", LoginTime=${Date.now()}`,
            ),
          );

          // Count sessions that should be logged out
          const socketsToLogout = userActiveSockets.filter(
            (s) => s.sessionId !== sessionId
          );
          logger.log(
            chalk.bgRed.white(
              `[SOCKET] Will logout ${socketsToLogout.length} existing sessions (excluding session "${sessionId}")`,
            ),
          );

          // Logout all sessions from different devices/browsers, keep same session sockets
          logger.log(
            chalk.yellow(
              `[SOCKET] Using forceLogoutUser to cleanup other sessions for user ${userId}, excluding session ${sessionId}`,
            ),
          );
          await forceLogoutUser(userId, null, sessionId);
        } else {
          // Backward compatibility - logout all other sessions if no sessionId provided
          logger.log(
            chalk.yellow(
              `[SOCKET] Using forceLogoutUser to cleanup all other sessions for user ${userId} (no sessionId provided)`,
            ),
          );
          const socketsToLogout = userActiveSockets.filter(
            (s) => s.id !== socket.id,
          );

          // Force logout each old socket individually to be more precise
          for (const oldSocket of socketsToLogout) {
            if (oldSocket.sessionId) {
              await forceLogoutUser(userId, oldSocket.sessionId);
            }
          }
        }

        const loginMessage = chalk.bold.green(
          `[SOCKET] User ${userId} logged in with socket ${socket.id}, session management completed`,
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
    // Enhanced staging environment detection
    const environment = process.env.NODE_ENV || 'development';
    const isStaging =
      environment === 'production' ||
      environment === 'staging' ||
      process.env.VERCEL ||
      process.env.NETLIFY;

    // Log with high visibility for debugging
    logger.log(
      chalk.bgRed.white(
        `[SOCKET] forceLogoutUser called for userId: ${userId}, targetSessionId: ${targetSessionId}, excludeSessionId: ${excludeSessionId}`,
      ),
    );

    if (isStaging) {
      logger.log(
        chalk.bgYellow.black(
          `[SOCKET] STAGING forceLogoutUser - Enhanced debugging enabled`,
        ),
      );
      logger.log(
        chalk.yellow(
          `[SOCKET] Environment: ${environment}, Process env: ${JSON.stringify(process.env.NODE_ENV)}`,
        ),
      );
    }

    // Get all connected sockets directly from Socket.IO
    const allSockets = await ioInstance.fetchSockets();

    // Find sockets belonging to this user based on the userId property
    const userActiveSocketsList = allSockets.filter(
      (socket) => socket.userId === userId,
    );

    const logMessage = targetSessionId
      ? `Force logout for user ${userId}, target session ${targetSessionId}, found ${userActiveSocketsList.length} active sockets`
      : `Force logout for user ${userId}, found ${userActiveSocketsList.length} active sockets`;
    logger.log(chalk.bgRed.white(logMessage));

    if (isStaging && userActiveSocketsList.length > 0) {
      logger.log(
        chalk.bgYellow.black(`[SOCKET] STAGING - User sockets analysis:`),
      );
      userActiveSocketsList.forEach((socket, index) => {
        logger.log(
          chalk.yellow(
            `[SOCKET] Socket ${index + 1}: ID=${socket.id}, SessionID=${socket.sessionId}, Environment=${socket.environment || 'unknown'}`,
          ),
        );
      });
    }

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

        if (isStaging) {
          logger.log(
            chalk.bgYellow.black(
              `[SOCKET] STAGING - Emitting forceLogout event to socket ${socket.id}`,
            ),
          );
          logger.log(
            chalk.yellow(
              `[SOCKET] Event data: ${JSON.stringify({
                reason: 'session_terminated',
                userId: userId,
                sessionId: socketSessionId || 'unknown',
                targeted: true,
              })}`,
            ),
          );
        }

        socket.emit('forceLogout', {
          reason: 'session_terminated',
          userId: userId,
          sessionId: socketSessionId || 'unknown',
          message: 'Your session has been terminated.',
          timestamp: new Date().toISOString(),
          targeted: true,
          environment: isStaging ? 'staging' : 'local',
        });

        socket.emit('session-terminated', {
          reason: 'session_terminated',
          userId: userId,
          sessionId: socketSessionId || 'unknown',
          message: 'Please login again',
          environment: isStaging ? 'staging' : 'local',
        });

        if (isStaging) {
          logger.log(
            chalk.bgYellow.black(
              `[SOCKET] STAGING - Both forceLogout and session-terminated events sent to socket ${socket.id}`,
            ),
          );
        }

        // IMMEDIATE DISCONNECT
        try {
          if (socket.connected) {
            socket.disconnect(true);
            logger.log(
              chalk.red(
                `[SOCKET] Disconnected socket ${socket.id} for user ${userId}`,
              ),
            );

            if (isStaging) {
              logger.log(
                chalk.bgYellow.black(
                  `[SOCKET] STAGING - Socket ${socket.id} disconnection completed`,
                ),
              );
            }
          }
        } catch (err) {
          logger.error(
            `[SOCKET] Error disconnecting socket ${socket.id}: ${err.message}`,
          );

          if (isStaging) {
            logger.error(
              chalk.bgRed.white(
                `[SOCKET] STAGING - Socket disconnection error: ${err.stack}`,
              ),
            );
          }
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
        logger.log(
          chalk.blue(
            `[SOCKET] Type check - socketSessionId: "${socketSessionId}" (${typeof socketSessionId}), excludeSessionId: "${excludeSessionId}" (${typeof excludeSessionId})`,
          ),
        );

        // CRITICAL SESSION DEBUG
        logger.log(
          chalk.bgCyan.black(
            `[SOCKET] SESSION COMPARISON DEBUG: 
             Socket Session: "${socketSessionId}" (length: ${socketSessionId?.length || 0})
             Exclude Session: "${excludeSessionId}" (length: ${excludeSessionId?.length || 0})
             Are Equal: ${socketSessionId === excludeSessionId}
             Strict Equal: ${Object.is(socketSessionId, excludeSessionId)}`,
          ),
        );

        if (isStaging) {
          logger.log(
            chalk.bgYellow.black(
              `[SOCKET] STAGING - Session comparison: Socket[${socketSessionId}] vs Exclude[${excludeSessionId}]`,
            ),
          );
        }

        if (socketSessionId && socketSessionId === excludeSessionId) {
          logger.log(
            chalk.green(
              `[SOCKET] Skipping socket ${socket.id} with matching session ID ${excludeSessionId}`,
            ),
          );

          if (isStaging) {
            logger.log(
              chalk.bgGreen.black(
                `[SOCKET] STAGING - Socket preserved: ${socket.id} with session ${excludeSessionId}`,
              ),
            );
          }
          continue;
        }

        // CRITICAL ISSUE CHECK: Make sure we're not logging out the wrong socket
        logger.log(
          chalk.bgRed.white(
            `[SOCKET] CRITICAL: About to force logout socket ${socket.id} with session "${socketSessionId}" (excluding "${excludeSessionId}")`,
          ),
        );

        // If sessions are the same but we reached here, there's a bug
        if (socketSessionId === excludeSessionId) {
          logger.error(
            chalk.bgRed.white(
              `[SOCKET] ERROR: Session comparison failed! Socket session "${socketSessionId}" equals exclude session "${excludeSessionId}" but condition didn't catch it!`,
            ),
          );
          continue; // Skip this socket to prevent incorrect logout
        }

        // Send targeted messages to old socket - send multiple for redundancy
        logger.log(
          chalk.red(
            `[SOCKET] Sending forceLogout to socket ${socket.id} for user ${userId}`,
          ),
        );

        if (isStaging) {
          logger.log(
            chalk.bgRed.white(
              `[SOCKET] STAGING - Forcing logout of socket ${socket.id} with session ${socketSessionId}`,
            ),
          );
        }

        // Try both event types for maximum compatibility
        socket.emit('forceLogout', {
          reason: 'new_login',
          userId: userId,
          sessionId: socketSessionId || 'unknown', // Include the session ID if we have it
          message:
            'Your session has been terminated due to a new login from another device.',
          timestamp: new Date().toISOString(),
          targeted: true, // Mark this as a targeted message
          environment: isStaging ? 'staging' : 'local',
        });

        socket.emit('session-terminated', {
          reason: 'new_login',
          userId: userId,
          sessionId: socketSessionId || 'unknown',
          message: 'Please login again',
          environment: isStaging ? 'staging' : 'local',
        });

        if (isStaging) {
          logger.log(
            chalk.bgYellow.black(
              `[SOCKET] STAGING - Both forceLogout and session-terminated events sent to socket ${socket.id}`,
            ),
          );
        }

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

            if (isStaging) {
              logger.log(
                chalk.bgRed.white(
                  `[SOCKET] STAGING - Socket ${socket.id} disconnection completed successfully`,
                ),
              );
            }
          }
        } catch (err) {
          logger.error(
            `[SOCKET] Error disconnecting socket ${socket.id}: ${err.message}`,
          );

          if (isStaging) {
            logger.error(
              chalk.bgRed.white(
                `[SOCKET] STAGING - Socket disconnection error: ${err.stack}`,
              ),
            );
          }
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
