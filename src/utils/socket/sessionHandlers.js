import chalk from 'chalk';
import { logger } from '../logger.js';
import { safeFetchUserSockets } from './query.js';
import { requireMatchingAuthenticatedUser } from './authGuard.js';
import {
  validateSessionPayload,
  withSocketEventGuard,
} from './eventGuards.js';
import {
  listUsersNeedingSessionCleanup,
  registerSocketPresence,
  unregisterSocketPresence,
} from './presenceStore.js';
import {
  createCleanupSnapshot,
  createSessionSnapshot,
  hasDifferentDeviceSessions,
  logDifferentDeviceTermination,
  logSameBrowserAllowed,
  logSessionBreakdown,
} from './sessionPolicy.js';
import {
  clearSocketIdentity,
  getSocketSessionId,
  getSocketUserId,
  setSocketIdentity,
} from './socketMetadata.js';
import { socketRuntime } from './state.js';
import { terminateSocketSession } from './sessionUtils.js';

const validateLoginPayload = (payload) => {
  if (typeof payload === 'string') {
    return payload.length > 0;
  }

  return validateSessionPayload(payload);
};

const getPayloadUserId = (payload) => {
  if (typeof payload === 'string') {
    return payload;
  }

  return payload?.userId || null;
};

const getPayloadSessionId = (payload) => {
  if (typeof payload === 'string') {
    return null;
  }

  return payload?.sessionId || null;
};

const authorizeSessionPayload = (socket, payload) => {
  return requireMatchingAuthenticatedUser(
    socket,
    getPayloadUserId(payload),
    getPayloadSessionId(payload),
  );
};

const validateClientMessagePayload = (payload) => {
  if (payload === null || payload === undefined) {
    return true;
  }

  if (typeof payload === 'string') {
    return payload.length <= 2000;
  }

  if (typeof payload === 'object') {
    return JSON.stringify(payload).length <= 4000;
  }

  return false;
};

const bindSocketToUser = (socket, userId, sessionId, color = 'green') => {
  const loginTime = Date.now();

  const palette = {
    blue: chalk.bgBlue.white,
    cyan: chalk.bgCyan.white,
    green: chalk.bgGreen.white,
    magenta: chalk.bgMagenta.white,
  };
  console.log(palette, "palettee", color, palette[color] || chalk.bgGreen.white);   

  logger.info(
    // (palette[color] || palette.green)(
      `[SOCKET] Socket ${socket.id} bound to user ${userId}, session ${sessionId}`,
    // ),
  );

  void setSocketIdentity(socket, userId, sessionId, loginTime)
    .then(() =>
      registerSocketPresence({
        socketId: socket.id,
        userId,
        sessionId,
      }),
    )
    .catch((error) => {
      logger.error(
        `[SOCKET] Failed to bind socket ${socket.id} to rooms: ${error.message}`,
      );
    });
};

const getUserPeerSockets = async (userId, socketId, context) => {
  const allSockets = await safeFetchUserSockets(userId, context);
  return allSockets.filter((socket) => {
    return getSocketUserId(socket) === userId && socket.id !== socketId;
  });
};

const terminateDifferentDeviceSockets = async ({
  sockets,
  userId,
  currentSessionId,
  reason,
  message,
  context,
  emitSessionTerminated = false,
  emitLegacyEvents = false,
  logPrefix = null,
  successLogger = null,
  extraPayload = {},
}) => {
  const socketsToTerminate = sockets.filter(
    (socket) => getSocketSessionId(socket) !== currentSessionId,
  );

  if (socketsToTerminate.length === 0) {
    return 0;
  }

  const tasks = socketsToTerminate.map(async (targetSocket) => {
    if (logPrefix) {
      logger.info(chalk.red(`${logPrefix} ${targetSocket.id}`));
    }

    terminateSocketSession(
      targetSocket,
      {
        reason,
        userId,
        sessionId: getSocketSessionId(targetSocket) || 'unknown',
        message,
        timestamp: new Date().toISOString(),
        immediate: true,
        priority: 'CRITICAL',
        instant: true,
        ...extraPayload,
      },
      context,
      {
        emitSessionTerminated,
        emitLegacyEvents,
      },
    );

    if (successLogger) {
      successLogger(targetSocket);
    }
  });

  await Promise.allSettled(tasks);
  return socketsToTerminate.length;
};

const handleConnectionVerify = async (socket, data) => {
  const { userId, sessionId } = data || {};
  if (!userId || !sessionId) {
    return;
  }

  bindSocketToUser(socket, userId, sessionId, 'cyan');

  try {
    const userPeerSockets = await getUserPeerSockets(
      userId,
      socket.id,
      'connection verification',
    );

    if (userPeerSockets.length === 0) {
      return;
    }

    const sessionSnapshot = createSessionSnapshot(userPeerSockets, sessionId);

    logSessionBreakdown({
      userId,
      snapshot: sessionSnapshot,
      headline: '[SOCKET] CONNECTION VERIFY -',
    });

    if (!hasDifferentDeviceSessions(sessionSnapshot)) {
      logSameBrowserAllowed({
        userId,
        count: sessionSnapshot.sameBrowserSockets.length,
        message: (currentUserId, count) =>
          `[SOCKET] CONNECTION VERIFY - Allowing ${count} tabs from same browser for user ${currentUserId}`,
      });
      return;
    }

    logDifferentDeviceTermination({
      userId,
      count: sessionSnapshot.differentDeviceSockets.length,
      message: (currentUserId, count) =>
        `[SOCKET] Terminating ${count} different device sessions for user ${currentUserId}`,
    });

    await terminateDifferentDeviceSockets({
      sockets: sessionSnapshot.differentDeviceSockets,
      userId,
      currentSessionId: sessionId,
      reason: 'connection_verify_different_device',
      message: 'New login from different device detected - session terminated',
      context: 'connection verify cleanup',
      extraPayload: {
        nuclear: true,
        ultraNuclear: true,
      },
    });
  } catch (error) {
    logger.error(
      `[SOCKET] Error in connection verify handler: ${error.message}`,
    );
  }
};

const handlePhantomSessionCheck = async (socket, data) => {
  const { userId, sessionId } = data || {};

  if (!userId) {
    return;
  }

  if (!getSocketUserId(socket)) {
    bindSocketToUser(socket, userId, sessionId, 'magenta');
  }

  try {
    logger.info(
      chalk.bgMagenta.white(
        `[SOCKET] Verifying session ${sessionId} for user ${userId}`,
      ),
    );

    const userSockets = await safeFetchUserSockets(
      userId,
      'phantom session check',
    );

    if (userSockets.length <= 1) {
      return;
    }

    const sessionSnapshot = createSessionSnapshot(userSockets, sessionId);

    logger.info(
      chalk.bgYellow.white(
        `[SOCKET] User ${userId} has ${sessionSnapshot.totalSessions} different browser sessions with total ${sessionSnapshot.totalSockets} tabs`,
      ),
    );

    if (!hasDifferentDeviceSessions(sessionSnapshot)) {
      logSameBrowserAllowed({
        userId,
        count: sessionSnapshot.totalSockets,
        message: (currentUserId, count) =>
          `[SOCKET] All ${count} sessions are from same browser for user ${currentUserId}, allowing multiple tabs`,
      });
      return;
    }

    logDifferentDeviceTermination({
      userId,
      count: sessionSnapshot.differentDeviceSockets.length,
      message: (currentUserId) =>
        `[SOCKET] Multiple devices detected for user ${currentUserId}, terminating other devices`,
    });

    await terminateDifferentDeviceSockets({
      sockets: sessionSnapshot.differentDeviceSockets,
      userId,
      currentSessionId: sessionId,
      reason: 'phantom_different_device',
      message: 'Login from different device detected - session terminated',
      context: 'phantom session cleanup',
      extraPayload: {
        nuclear: true,
        ultraNuclear: true,
      },
    });

    logger.info(
      chalk.bgGreen.white(
        `[SOCKET] Preserved ${sessionSnapshot.currentSessionSockets.length} tabs from current browser for user ${userId}`,
      ),
    );
  } catch (error) {
    logger.error(`[SOCKET] Error in phantom session check: ${error.message}`);
  }
};

const createHandleUserLogin = (socket) => {
  return async (data) => {
    const userId = typeof data === 'object' ? data.userId : data;
    const sessionId = typeof data === 'object' ? data.sessionId : null;

    if (!userId) {
      logger.error('[SOCKET] Missing userId in login event');
      return;
    }

    try {
      const existingUserSockets = await getUserPeerSockets(
        userId,
        socket.id,
        'user login pre-termination',
      );

      if (existingUserSockets.length > 0) {
        const sessionSnapshot = createSessionSnapshot(
          existingUserSockets,
          sessionId,
        );

        logger.info(
          chalk.bgYellow.white(
            `[SOCKET] USER LOGIN - User ${userId} has ${sessionSnapshot.totalSessions} different browser sessions`,
          ),
        );

        const terminatedCount = await terminateDifferentDeviceSockets({
          sockets: sessionSnapshot.differentDeviceSockets,
          userId,
          currentSessionId: sessionId,
          reason: 'pre_termination_different_device',
          message:
            'New login from different device detected - session terminated instantly',
          context: 'user login pre-termination',
          extraPayload: {
            nuclear: true,
            ultraNuclear: true,
          },
        });

        if (terminatedCount > 0) {
          logger.info(
            chalk.bgGreen.white(
              `[SOCKET] PRE-TERMINATION - Successfully terminated ${terminatedCount} different device sessions instantly`,
            ),
          );
        } else {
          logger.info(
            chalk.bgGreen.white(
              `[SOCKET] USER LOGIN - All ${existingUserSockets.length} existing sessions are from same browser, allowing multiple tabs`,
            ),
          );
        }
      }
    } catch (error) {
      logger.error(
        `[SOCKET] Error in instant pre-termination: ${error.message}`,
      );
    }

    logger.info(
      chalk.bgBlue.white(
        `[SOCKET] User login event received for userId: ${userId}, sessionId: ${sessionId}, socketId: ${socket.id}`,
      ),
    );

    if (getSocketUserId(socket)) {
      bindSocketToUser(socket, userId, sessionId, 'blue');
      logger.info(
        // chalk.bgBlue.white(
          `[SOCKET] Socket ${socket.id} already bound to user ${userId}, updated login time`,
        // ),
      );
    } else {
      bindSocketToUser(socket, userId, sessionId, 'green');
    }

    try {
      const userActiveSockets = await getUserPeerSockets(
        userId,
        socket.id,
        'user login enforcement',
      );

      logger.info(
        // chalk.bgBlue.white(
          `[SOCKET] Found ${userActiveSockets.length} existing sockets for user ${userId}`,
        // ),
      );

      if (userActiveSockets.length > 0) {
        const sessionSnapshot = createSessionSnapshot(
          userActiveSockets,
          sessionId,
        );

        const terminatedCount = await terminateDifferentDeviceSockets({
          sockets: sessionSnapshot.differentDeviceSockets,
          userId,
          currentSessionId: sessionId,
          reason: 'new_login_different_device',
          message:
            'Your session has been terminated due to a new login from another device.',
          context: 'user login enforcement',
          emitSessionTerminated: true,
          emitLegacyEvents: true,
          logPrefix:
            '[SOCKET] ENFORCEMENT - Terminating different device session',
          successLogger: (targetSocket) => {
            logger.info(
              chalk.red(
                `[SOCKET] ENFORCEMENT - Terminated different device session ${targetSocket.id}`,
              ),
            );
          },
          extraPayload: {
            nuclear: true,
          },
        });

        if (terminatedCount > 0) {
          logger.info(
            chalk.bgGreen.white(
              `[SOCKET] ENFORCEMENT - Successfully terminated ${terminatedCount} different device sessions for user ${userId}`,
            ),
          );
        } else {
          logger.info(
            chalk.bgGreen.white(
              `[SOCKET] USER LOGIN - All ${userActiveSockets.length} existing sessions are from same browser, allowing multiple tabs for user ${userId}`,
            ),
          );
        }
      }

      socketRuntime.userSockets.set(userId, [socket.id]);

      logger.info(
        chalk.bold.green(
          `[SOCKET] User ${userId} logged in with socket ${socket.id}, ${userActiveSockets.length} old sessions terminated`,
        ),
      );
    } catch (error) {
      logger.error(`[SOCKET] Error in login handler: ${error.message}`);
      logger.error(error.stack);
    }
  };
};

const handleDisconnect = (socket, reason) => {
  const isServerSideDisconnect =
    reason === 'server disconnect' ||
    reason === 'transport close' ||
    reason === 'server shutting down' ||
    reason === 'ping timeout' ||
    reason === 'transport error' ||
    reason === 'connection timeout' ||
    reason.includes('timeout') ||
    reason.includes('error');

  for (const [userId, socketIds] of socketRuntime.userSockets.entries()) {
    const updatedSockets = socketIds.filter((socketId) => socketId !== socket.id);

    if (updatedSockets.length > 0) {
      socketRuntime.userSockets.set(userId, updatedSockets);
      logger.info(
        chalk.blue(
          `User ${userId} disconnected, remaining sockets: ${updatedSockets}`,
        ),
      );
      continue;
    }

    socketRuntime.userSockets.delete(userId);
    logger.info(
      chalk.blue(`User ${userId} disconnected, no remaining sockets`),
    );

    if (isServerSideDisconnect) {
      logger.info(
        chalk.gray(
          `[SOCKET] Skipping logout event for user ${userId} due to server-side/timeout disconnect: ${reason}`,
        ),
      );
      continue;
    }

    logger.info(
      chalk.yellow(
        `[SOCKET] Emitting logout event for user ${userId} due to client disconnect`,
      ),
    );
  }

  logger.info(
    chalk.bold.red(`Client disconnected: ${socket.id}, reason: ${reason}`),
  );
};

const cleanupUserSessionState = (
  userId,
  userSockets,
  lastCleanupState,
  lastCleanupAction,
) => {
  return createCleanupSnapshot(
    userSockets,
    lastCleanupState,
    lastCleanupAction,
    userId,
  );
};

const recordSingleBrowserState = (
  userId,
  userSockets,
  cleanupState,
  lastCleanupState,
) => {
  if (!cleanupState.stateChanged || lastCleanupState.get(userId)) {
    return;
  }

  logger.info(
    chalk.bgGreen.white(
      `[SOCKET] CLEANUP - User ${userId} has single browser session with ${userSockets.length} tabs - no cleanup needed`,
    ),
  );

  lastCleanupState.set(userId, {
    stateKey: cleanupState.stateKey,
    timestamp: cleanupState.now,
  });
};

const createCleanupTasksForUser = (
  userId,
  userSockets,
  cleanupState,
  lastCleanupState,
  lastCleanupAction,
) => {
  if (!cleanupState.hasMultipleDevices) {
    recordSingleBrowserState(
      userId,
      userSockets,
      cleanupState,
      lastCleanupState,
    );
    return [];
  }

  if (cleanupState.shouldLog) {
    logger.info(
      chalk.bgYellow.white(
        `[SOCKET] CLEANUP - User ${userId} has ${cleanupState.sessionGroups.size} different browser sessions with ${userSockets.length} total tabs`,
      ),
    );
    logger.info(
      chalk.bgRed.white(
        `[SOCKET] CLEANUP - User ${userId} has multiple devices. TERMINATING OTHER DEVICES.`,
      ),
    );

    lastCleanupState.set(userId, {
      stateKey: cleanupState.stateKey,
      timestamp: cleanupState.now,
    });
    lastCleanupAction.set(userId, {
      timestamp: cleanupState.now,
    });
  }

  const mostRecentSessionId = cleanupState.activeSessionId;
  const currentBrowserSockets =
    cleanupState.sessionGroups.get(mostRecentSessionId) || [];

  const cleanupTasks = userSockets
    .filter(
      (userSocket) => getSocketSessionId(userSocket) !== mostRecentSessionId,
    )
    .map(async (userSocket) => {
      if (cleanupState.shouldLog) {
        logger.info(
          chalk.red(
            `[SOCKET] CLEANUP - Terminating different device session ${userSocket.id}`,
          ),
        );
      }

      terminateSocketSession(
        userSocket,
        {
          reason: 'cleanup_different_device',
          userId,
          sessionId: getSocketSessionId(userSocket) || 'unknown',
          message: 'Different device detected - only one device allowed',
          sessionTerminatedMessage:
            'Different device detected - please login again',
          timestamp: new Date().toISOString(),
          immediate: true,
          priority: 'CRITICAL',
          instant: true,
        },
        'cleanup interval',
        {
          emitSessionTerminated: true,
          emitLegacyEvents: true,
        },
      );

      if (cleanupState.shouldLog) {
        logger.info(
          chalk.red(
            `[SOCKET] CLEANUP - Terminated different device session ${userSocket.id}`,
          ),
        );
      }
    });

  if (cleanupState.shouldLog) {
    logger.info(
      chalk.bgGreen.white(
        `[SOCKET] CLEANUP - Will preserve ${currentBrowserSockets.length} tabs from most recent browser for user ${userId}`,
      ),
    );
  }

  return cleanupTasks;
};

const pruneCleanupHistory = (lastCleanupState, lastCleanupAction) => {
  const cutoffTime = Date.now() - 3600000;

  for (const [userId, state] of lastCleanupState.entries()) {
    if (state.timestamp < cutoffTime) {
      lastCleanupState.delete(userId);
    }
  }

  for (const [userId, action] of lastCleanupAction.entries()) {
    if (action.timestamp < cutoffTime) {
      lastCleanupAction.delete(userId);
    }
  }
};

const runCleanupCycle = async (lastCleanupState, lastCleanupAction) => {
  if (!socketRuntime.ioInstance) {
    return;
  }

  const candidateUserIds = await listUsersNeedingSessionCleanup();
  const cleanupTasks = [];

  for (const userId of candidateUserIds) {
    const userSockets = await safeFetchUserSockets(
      userId,
      'cleanup interval user room',
    );

    if (userSockets.length <= 1) {
      continue;
    }

    const cleanupState = cleanupUserSessionState(
      userId,
      userSockets,
      lastCleanupState,
      lastCleanupAction,
    );

    cleanupTasks.push(
      ...createCleanupTasksForUser(
        userId,
        userSockets,
        cleanupState,
        lastCleanupState,
        lastCleanupAction,
      ),
    );
  }

  pruneCleanupHistory(lastCleanupState, lastCleanupAction);
  await Promise.allSettled(cleanupTasks);
};

const startSessionCleanupMonitor = () => {
  const lastCleanupState = new Map();
  const lastCleanupAction = new Map();

  socketRuntime.cleanupInterval = setInterval(async () => {
    try {
      await runCleanupCycle(lastCleanupState, lastCleanupAction);
    } catch (error) {
      logger.error(`[SOCKET] Error in cleanup: ${error.message}`);
    }
  }, 5000);
};

const registerSocketConnectionHandlers = () => {
  if (!socketRuntime.ioInstance) {
    return;
  }

  socketRuntime.ioInstance.on('connection', (socket) => {
    logger.info(
      chalk.bgRed.white(`[SOCKET] New connection detected: ${socket.id}`),
    );

    const handleUserLogin = createHandleUserLogin(socket);
    const guardedPingCheck = withSocketEventGuard(
      'pingCheck',
      async () => {
        socket.emit('pongCheck');
      },
    );
    const guardedConnectionVerify = withSocketEventGuard(
      'connectionVerify',
      async (data) => {
        await handleConnectionVerify(socket, data);
      },
      {
        limiterScope: 'auth',
        validator: validateSessionPayload,
        authorization: authorizeSessionPayload,
      },
    );
    const guardedPhantomSessionCheck = withSocketEventGuard(
      'phantomSessionCheck',
      async (data) => {
        await handlePhantomSessionCheck(socket, data);
      },
      {
        limiterScope: 'auth',
        validator: validateSessionPayload,
        authorization: authorizeSessionPayload,
      },
    );
    const guardedLogin = withSocketEventGuard(
      'login',
      async (data) => {
        await handleUserLogin(data);
      },
      {
        limiterScope: 'auth',
        validator: validateLoginPayload,
        authorization: authorizeSessionPayload,
      },
    );
    const guardedClientMessage = withSocketEventGuard(
      'client-message',
      async (data) => {
        logger.info('Received from client:', data);
      },
      {
        validator: validateClientMessagePayload,
      },
    );

    socket.on('pingCheck', (payload) => {
      void guardedPingCheck(socket, payload);
    });
    socket.on('connectionVerify', (data) => {
      void guardedConnectionVerify(socket, data);
    });
    socket.on('phantomSessionCheck', (data) => {
      void guardedPhantomSessionCheck(socket, data);
    });
    socket.on('login', (data) => {
      void guardedLogin(socket, data);
    });
    socket.on('user-login', (data) => {
      void guardedLogin(socket, data);
    });

    logger.info(chalk.bold.cyan(`Client connected: ${socket.id}`));

    socket.emit('new-entry', { message: 'Hello from server!!!', data: {} });
    socketRuntime.ioInstance.emit('broadcast-message', {
      message: 'A new client has connected!',
    });

    socket.on('client-message', (data) => {
      void guardedClientMessage(socket, data);
    });

    socket.on('disconnect', (reason) => {
      void unregisterSocketPresence({
        socketId: socket.id,
        userId: getSocketUserId(socket),
        sessionId: getSocketSessionId(socket),
      })
        .then(() => clearSocketIdentity(socket))
        .catch((error) => {
          logger.warn(
            `[SOCKET] Failed to cleanup socket identity for ${socket.id}: ${error.message}`,
          );
        });

      handleDisconnect(socket, reason);
    });
  });
};

export { registerSocketConnectionHandlers, startSessionCleanupMonitor };
