import { logger } from '../logger.js';
import { newTableEntry } from './publicApi.js';
import {
  getSocketLoginTime,
  getSocketSessionId,
} from './socketMetadata.js';

const groupSocketsBySessionId = (sockets) => {
  const sessionGroups = new Map();

  sockets.forEach((socket) => {
    const sessionId = getSocketSessionId(socket) || 'unknown';
    const sessionSockets = sessionGroups.get(sessionId) || [];
    sessionSockets.push(socket);
    sessionGroups.set(sessionId, sessionSockets);
  });

  return sessionGroups;
};

const getMostRecentSessionId = (sessionGroups) => {
  let mostRecentSessionId = null;
  let mostRecentLoginTime = -Infinity;

  for (const [sessionId, sockets] of sessionGroups.entries()) {
    const latestLoginForSession = sockets.reduce((latest, socket) => {
      const loginTime = Number(getSocketLoginTime(socket) || 0);
      return Math.max(latest, loginTime);
    }, -Infinity);

    if (latestLoginForSession >= mostRecentLoginTime) {
      mostRecentLoginTime = latestLoginForSession;
      mostRecentSessionId = sessionId;
    }
  }

  return mostRecentSessionId;
};

const buildSessionTerminatedPayload = (payload) => ({
  reason: payload.reason,
  userId: payload.userId,
  sessionId: payload.sessionId || 'unknown',
  message: payload.sessionTerminatedMessage || payload.message || 'Please login again',
  immediate: payload.immediate ?? payload.instant ?? true,
  priority: payload.priority || 'CRITICAL',
  instant: payload.instant,
  timestamp: payload.timestamp,
});

const emitForcedLogoutEvents = (
  socket,
  payload,
  { emitSessionTerminated = false, emitLegacyEvents = false } = {},
) => {
  socket.emit('forceLogout', payload);

  if (emitSessionTerminated) {
    socket.emit('session-terminated', buildSessionTerminatedPayload(payload));
  }

  if (emitLegacyEvents) {
    socket.emit('newLogin', payload.userId);
    socket.emit('newlogout', {
      userId: payload.userId,
      sessionId: payload.sessionId,
    });
  }
};

const disconnectSocketSafely = (socket, context) => {
  try {
    socket.disconnect(true);
  } catch (error) {
    logger.error(
      `[SOCKET] Error force disconnecting socket ${socket.id} during ${context}: ${error.message}`,
    );
  }
};

const terminateSocketSession = (
  socket,
  payload,
  context,
  options = {},
) => {
  try {
    emitForcedLogoutEvents(socket, payload, options);
    disconnectSocketSafely(socket, context);
    return true;
  } catch (error) {
    logger.error(
      `[SOCKET] Error terminating socket ${socket.id} during ${context}: ${error.message}`,
    );
    disconnectSocketSafely(socket, context);
    return false;
  }
};

const emitTableEntryAsync = (table, payload) => {
  void newTableEntry(table, payload).catch((error) => {
    logger.error(`Failed to emit socket table entry for ${table}:`, error);
  });
};

export {
  disconnectSocketSafely,
  emitForcedLogoutEvents,
  getMostRecentSessionId,
  groupSocketsBySessionId,
  terminateSocketSession,
  emitTableEntryAsync
};
