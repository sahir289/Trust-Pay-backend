import { logger } from '../logger.js';
import { getSessionRoom, getUserRoom } from './roomUtils.js';
import { getSocketSessionId, getSocketUserId } from './socketMetadata.js';
import { socketRuntime } from './state.js';

const getLocalSockets = () => {
  if (!socketRuntime.ioInstance) {
    return [];
  }

  return Array.from(socketRuntime.ioInstance.of('/').sockets.values());
};

const safeFetchSockets = async (context, { fallbackToLocal = true } = {}) => {
  if (!socketRuntime.ioInstance) {
    return [];
  }

  try {
    return await socketRuntime.ioInstance.fetchSockets();
  } catch (error) {
    logger.error(
      `[SOCKET] fetchSockets failed during ${context}: ${error.message}`,
    );

    if (!fallbackToLocal) {
      return [];
    }

    const localSockets = getLocalSockets();
    logger.warn(
      `[SOCKET] Falling back to ${localSockets.length} local socket(s) during ${context}`,
    );
    return localSockets;
  }
};

const safeFetchSocketsByRoom = async (
  roomName,
  context,
  { fallbackToLocal = true } = {},
) => {
  if (!socketRuntime.ioInstance) {
    return [];
  }

  try {
    return await socketRuntime.ioInstance.in(roomName).fetchSockets();
  } catch (error) {
    logger.error(
      `[SOCKET] fetchSockets failed for room ${roomName} during ${context}: ${error.message}`,
    );

    if (!fallbackToLocal) {
      return [];
    }

    const localSockets = getLocalSockets().filter((socket) => {
      return socket.rooms?.has(roomName);
    });
    logger.warn(
      `[SOCKET] Falling back to ${localSockets.length} local room socket(s) for ${roomName} during ${context}`,
    );
    return localSockets;
  }
};

const safeFetchUserSockets = async (userId, context, options = {}) => {
  const sockets = await safeFetchSocketsByRoom(
    getUserRoom(userId),
    context,
    options,
  );

  return sockets.filter((socket) => getSocketUserId(socket) === userId);
};

const safeFetchSessionSockets = async (sessionId, context, options = {}) => {
  const sockets = await safeFetchSocketsByRoom(
    getSessionRoom(sessionId),
    context,
    options,
  );

  return sockets.filter((socket) => getSocketSessionId(socket) === sessionId);
};

export {
  getLocalSockets,
  safeFetchSessionSockets,
  safeFetchSockets,
  safeFetchSocketsByRoom,
  safeFetchUserSockets,
};
