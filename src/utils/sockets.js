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
      
      logger.log(chalk.bgBlue.white(`[SOCKET] User login event received for userId: ${userId}, sessionId: ${sessionId}, socketId: ${socket.id}`));
      
      // Store socket metadata for better tracking
      socket.userId = userId;
      socket.sessionId = sessionId;
      socket.loginTime = Date.now();
      
      // Critical section - handle the session management with care
      try {
        // First, get all connected sockets across all namespaces
        const allSockets = await ioInstance.fetchSockets();
        
        // Find all existing sockets for this user by checking socket.userId property
        // This is more reliable than using our tracking map which might be stale
        const userActiveSockets = allSockets.filter(s => 
          s.userId === userId && s.id !== socket.id
        );
        
        // Log the active sockets we found directly (more reliable than our map)
        logger.log(chalk.bgRed.white(`[SOCKET] Found ${userActiveSockets.length} active sockets for user ${userId} by direct search, WILL DISCONNECT ALL OF THEM`));
        
        // Create a deterministic set of socket IDs to force logout - EXCLUDING our current socket
        const allSocketsToLogout = new Set(
          userActiveSockets.map(s => s.id)
        );
        
        // IMPORTANT: Add this socket to our tracking map AFTER identifying old sockets
        // This prevents race conditions where multiple sockets login simultaneously
        // Set ONLY the new socket for this user
        userSockets.set(userId, [socket.id]);
        
        // Force logout all existing sessions for this user EXCEPT the current socket
        logger.log(chalk.bgYellow.black(`[SOCKET] Will force logout ${allSocketsToLogout.size} sockets for user ${userId}`));
        let forcedLogoutCount = 0;
        
        // FIRST: Immediately broadcast a targeted message to all clients for this user
        logger.log(chalk.yellow(`[SOCKET] Broadcasting global forceLogout for userId: ${userId}`));
        
        // Loop through old sockets first
        for (const existingSocketId of allSocketsToLogout) {
          if (existingSocketId === socket.id) continue; // Skip the current socket (redundant check)
          
          logger.log(chalk.red(`[SOCKET] Forcing logout on socket ${existingSocketId} for user ${userId}`));
          
          // Get the socket directly from the server
          const oldSocket = ioInstance.sockets.sockets.get(existingSocketId);
          if (oldSocket) {
            // Emit targeted force logout events with complete metadata - send multiple event types for redundancy
            logger.log(chalk.red(`[SOCKET] Sending forceLogout to socket ${existingSocketId}`));
            
            // Emit multiple event types with complete data for redundant notification
            oldSocket.emit('forceLogout', {
              reason: 'new_login',
              userId: userId,
              socketId: existingSocketId,
              sessionId: oldSocket.sessionId, // Use this socket's session ID for accurate targeting
              message: 'Your session has been terminated due to a new login from another device.',
              timestamp: new Date().toISOString(),
              targeted: true // Mark this as a targeted message
            });
            
            oldSocket.emit('session-terminated', {
              reason: 'new_login',
              userId: userId,
              message: 'Please login again',
              sessionId: oldSocket.sessionId
            });
            
            // IMMEDIATE DISCONNECT - don't wait
            try {
              if (oldSocket.connected) { // Check if still connected before disconnecting
                oldSocket.disconnect(true);
                logger.log(chalk.red(`[SOCKET] Immediately disconnected old socket ${existingSocketId}`));
              }
            } catch (err) {
              logger.error(`[SOCKET] Error disconnecting socket ${existingSocketId}: ${err.message}`);
            }
            
            forcedLogoutCount++;
          } else {
            logger.warn(`[SOCKET] Could not find socket ${existingSocketId} to disconnect`);
          }
        }
        
        // Now, broadcast a system-wide message as a backup for any sockets we might have missed
        ioInstance.emit('forceLogout', {
          reason: 'new_login',
          userId: userId,
          message: 'Your session has been terminated due to a new login from another device.',
          timestamp: new Date().toISOString(),
          global: true
        });
        
        // Send a broadcast specifically for this user to all connected sockets
        // This is more aggressive than the targeted approach and will catch any sockets we missed
        ioInstance.emit('forceLogout', { 
          reason: 'follow_up',
          userId: userId,
          message: 'Your session has been terminated due to a new login from another device.',
          timestamp: new Date().toISOString()
        });
        
        // Clean up our socket map for other users to avoid stale entries
        for (const [mapUserId, socketsList] of userSockets.entries()) {
          if (mapUserId === userId) continue; // Skip our current user
          
          // Check each socket in our map to see if it actually belongs to our current user
          const updatedSockets = [];
          for (const sid of socketsList) {
            const s = ioInstance.sockets.sockets.get(sid);
            if (s && s.userId === userId) {
              // This socket belongs to our current user but is in the wrong map entry
              logger.warn(`[SOCKET] Found misplaced socket ${sid} for user ${userId} in user ${mapUserId}'s entry`);
              
              // Force logout this misplaced socket
              s.emit('forceLogout', {
                reason: 'session_cleanup',
                userId: userId,
                message: 'Session cleanup due to inconsistent tracking',
                targeted: true
              });
              
              // Disconnect immediately
              if (s.connected) {
                s.disconnect(true);
              }
              forcedLogoutCount++;
            } else if (s) {
              // Valid socket that belongs to the right user
              updatedSockets.push(sid);
            }
          }
          
          // Update the map with cleaned up entries
          if (updatedSockets.length === 0) {
            userSockets.delete(mapUserId);
          } else if (updatedSockets.length !== socketsList.length) {
            userSockets.set(mapUserId, updatedSockets);
          }
        }
        
        const loginMessage = chalk.bold.green(
          `[SOCKET] User ${userId} associated with socket ${socket.id}, forced logout of ${forcedLogoutCount} previous connections`
        );
        logger.log(loginMessage);
        
        // Emit new login event
        const eventName = `newLogin`;
        logger.log(chalk.bold.cyan(`[SOCKET] Emitting ${eventName} for ${userId}`));
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

const forceLogoutUser = async (userId, sessionId = null, excludeSessionId = null) => {
  if (!ioInstance) {
    logger.error('Socket.IO not initialized');
    return;
  }

  // This approach is more reliable than using our internal tracking map
  try {
    // Log with high visibility for debugging
    logger.log(chalk.bgRed.white(`[SOCKET] forceLogoutUser called for userId: ${userId}, sessionId: ${sessionId}, excludeSessionId: ${excludeSessionId}`));
    
    // First do an immediate broadcast to all sockets for this user
    // This is the most reliable way to ensure all clients get the message
    logger.log(chalk.red(`[SOCKET] Broadcasting GLOBAL forceLogout to ALL clients for user ${userId}`));
    
    // Broadcast with high signal-to-noise value using different event types
    ioInstance.emit('forceLogout', { 
      reason: 'global_force_logout',
      userId: userId,
      sessionId: sessionId,
      message: 'Your session has been terminated due to a new login.',
      timestamp: new Date().toISOString(),
      global: true
    });
    
    // Send additional event type for redundancy
    ioInstance.emit('session-terminated', { 
      reason: 'global_force_logout',
      userId: userId,
      sessionId: sessionId,
      message: 'Your session has been terminated due to a new login.',
      timestamp: new Date().toISOString(),
      global: true
    });
    
    // Get all connected sockets directly from Socket.IO
    const allSockets = await ioInstance.fetchSockets();
    
    // Find sockets belonging to this user based on the userId property
    const userSockets = allSockets.filter(socket => socket.userId === userId);
    
    const logMessage = sessionId 
      ? `Force logout for user ${userId}, session ${sessionId}, found ${userSockets.length} active sockets`
      : `Force logout for user ${userId}, found ${userSockets.length} active sockets`;
    logger.log(chalk.bgRed.white(logMessage));
    
    // If we have an excludeSessionId, handle targeted logout
    if (excludeSessionId) {
      logger.log(chalk.red(`[SOCKET] Targeted force logout for user ${userId}, excluding session ${excludeSessionId}`));
      
      // Process directly found sockets - more reliable approach
      let disconnectedCount = 0;
      
      // Process each socket for this user
      for (const socket of userSockets) {
        // Skip the socket with the session we want to exclude
        const socketSessionId = socket.sessionId;
        
        // Log every socket we find for debugging
        logger.log(chalk.red(`[SOCKET] Checking socket ${socket.id} with sessionId ${socketSessionId} (excluding ${excludeSessionId})`));
        
        if (socketSessionId && socketSessionId === excludeSessionId) {
          logger.log(chalk.green(`[SOCKET] Skipping socket ${socket.id} with matching session ID ${excludeSessionId}`));
          continue;
        }
        
        // Send targeted messages to old socket - send multiple for redundancy
        logger.log(chalk.red(`[SOCKET] Sending forceLogout to socket ${socket.id} for user ${userId}`));
        
        // Try both event types for maximum compatibility
        socket.emit('forceLogout', { 
          reason: 'new_login',
          userId: userId,
          sessionId: socketSessionId || 'unknown', // Include the session ID if we have it
          message: 'Your session has been terminated due to a new login from another device.',
          timestamp: new Date().toISOString(),
          targeted: true // Mark this as a targeted message
        });
        
        socket.emit('session-terminated', {
          reason: 'new_login',
          userId: userId,
          sessionId: socketSessionId || 'unknown',
          message: 'Please login again'
        });
        
        // IMMEDIATE DISCONNECT - don't wait
        try {
          if (socket.connected) { // Check if still connected before disconnecting
            socket.disconnect(true);
            logger.log(chalk.red(`[SOCKET] Disconnected socket ${socket.id} for user ${userId}`));
          }
        } catch (err) {
          logger.error(`[SOCKET] Error disconnecting socket ${socket.id}: ${err.message}`);
        }
        
        disconnectedCount++;
      }
      
      logger.log(chalk.green(`[SOCKET] Successfully disconnected ${disconnectedCount} sockets for user ${userId}`));
    } else {
      // Global force logout (no excluded session)
      logger.log(chalk.red(`[SOCKET] Global force logout for user ${userId}, all sessions`));
      
      // Process each socket for this user
      let disconnectedCount = 0;
      for (const socket of userSockets) {
        const socketSessionId = socket.sessionId || 'unknown';
        
        // Send targeted messages for reliability
        socket.emit('forceLogout', { 
          reason: 'global_logout',
          userId: userId,
          sessionId: socketSessionId,
          message: 'Your session has been terminated by the server.',
          timestamp: new Date().toISOString()
        });
        
        socket.emit('session-terminated', {
          reason: 'global_logout',
          userId: userId,
          sessionId: socketSessionId,
          message: 'Please login again'
        });
        
        // Force disconnect IMMEDIATELY
        try {
          if (socket.connected) {
            socket.disconnect(true);
            logger.log(chalk.red(`[SOCKET] Disconnected socket ${socket.id} for user ${userId}`));
            disconnectedCount++;
          }
        } catch (err) {
          logger.error(`[SOCKET] Error disconnecting socket ${socket.id}: ${err.message}`);
        }
      }
      
      logger.log(chalk.green(`[SOCKET] Successfully disconnected ${disconnectedCount} sockets for user ${userId}`));
    }
    
    // Cleanup the userSockets map
    // If we're doing a complete logout (not excluding any session)
    if (!excludeSessionId) {
      userSockets.delete(userId);
      logger.log(chalk.yellow(`[SOCKET] Removed user ${userId} from socket tracking map`));
    } else {
      // If we're preserving a specific session, make sure the map only contains that one
      const preservedSockets = allSockets.filter(socket => 
        socket.userId === userId && socket.sessionId === excludeSessionId
      );
      
      if (preservedSockets.length > 0) {
        userSockets.set(userId, preservedSockets.map(s => s.id));
        logger.log(chalk.yellow(`[SOCKET] Updated socket map to only include preserved session ${excludeSessionId}`));
      }
    }
    
    // Final broadcast to catch any sockets we might have missed
    setTimeout(() => {
      logger.log(chalk.yellow(`[SOCKET] Sending follow-up broadcast for user ${userId}`));
      ioInstance.emit('forceLogout', { 
        reason: 'follow_up',
        userId: userId,
        sessionId: sessionId,
        message: 'Your session has been terminated.',
        timestamp: new Date().toISOString()
      });
    }, 1000);
    
  } catch (error) {
    logger.error(`[SOCKET] Error in forceLogoutUser: ${error.message}`);
    logger.error(error.stack);
    
    // Fallback to simpler broadcast method
    logger.info(`[SOCKET] Falling back to simple broadcast for user ${userId}`);
    ioInstance.emit('forceLogout', { 
      reason: 'error_fallback',
      userId: userId,
      sessionId: sessionId,
      message: 'Your session has been terminated due to a new login from another device.',
      timestamp: new Date().toISOString()
    });
  }

  // Always emit a global logout event for tracking purposes
  if (!excludeSessionId) {
    ioInstance.emit('userLoggedOut', { userId, sessionId, reason: 'forced_logout' });
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
