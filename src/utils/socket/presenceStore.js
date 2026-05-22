import redisClient from '../redisClient.js';
import { logger } from '../logger.js';

const SOCKET_META_KEY = (socketId) => `socket:presence:meta:${socketId}`;
const USER_SET_KEY = (userId) => `socket:presence:user:${userId}`;
const SESSION_SET_KEY = (sessionId) => `socket:presence:session:${sessionId}`;
const ACTIVE_USERS_KEY = 'socket:presence:users';
const PRESENCE_TTL_SECONDS = 60 * 60 * 24;

const registerSocketPresence = async ({ socketId, userId, sessionId }) => {
  if (!socketId || !userId) {
    return;
  }

  try {
    const pipeline = redisClient.pipeline();
    pipeline.hmset(SOCKET_META_KEY(socketId), {
      socketId,
      userId,
      sessionId: sessionId || '',
      updatedAt: String(Date.now()),
    });
    pipeline.expire(SOCKET_META_KEY(socketId), PRESENCE_TTL_SECONDS);
    pipeline.sadd(USER_SET_KEY(userId), socketId);
    pipeline.expire(USER_SET_KEY(userId), PRESENCE_TTL_SECONDS);
    pipeline.sadd(ACTIVE_USERS_KEY, userId);

    if (sessionId) {
      pipeline.sadd(SESSION_SET_KEY(sessionId), socketId);
      pipeline.expire(SESSION_SET_KEY(sessionId), PRESENCE_TTL_SECONDS);
    }

    await pipeline.exec();
  } catch (error) {
    logger.warn('[SOCKET] Failed to register socket presence:', error?.message);
  }
};

const unregisterSocketPresence = async ({ socketId, userId, sessionId }) => {
  if (!socketId || !userId) {
    return;
  }

  try {
    const pipeline = redisClient.pipeline();
    pipeline.del(SOCKET_META_KEY(socketId));
    pipeline.srem(USER_SET_KEY(userId), socketId);
    pipeline.scard(USER_SET_KEY(userId));

    if (sessionId) {
      pipeline.srem(SESSION_SET_KEY(sessionId), socketId);
    }

    const results = await pipeline.exec();
    const userSocketCount = Number(results?.[2]?.[1] || 0);

    if (userSocketCount <= 0) {
      await redisClient.srem(ACTIVE_USERS_KEY, userId);
    }
  } catch (error) {
    logger.warn('[SOCKET] Failed to unregister socket presence:', error?.message);
  }
};

const listUsersNeedingSessionCleanup = async ({ minimumSockets = 2 } = {}) => {
  try {
    const activeUserIds = await redisClient.smembers(ACTIVE_USERS_KEY);
    if (activeUserIds.length === 0) {
      return [];
    }

    const pipeline = redisClient.pipeline();
    activeUserIds.forEach((userId) => {
      pipeline.scard(USER_SET_KEY(userId));
    });

    const results = await pipeline.exec();
    const candidateUserIds = [];
    const staleUserIds = [];

    activeUserIds.forEach((userId, index) => {
      const socketCount = Number(results?.[index]?.[1] || 0);

      if (socketCount >= minimumSockets) {
        candidateUserIds.push(userId);
        return;
      }

      if (socketCount <= 0) {
        staleUserIds.push(userId);
      }
    });

    if (staleUserIds.length > 0) {
      await redisClient.srem(ACTIVE_USERS_KEY, ...staleUserIds);
    }

    return candidateUserIds;
  } catch (error) {
    logger.warn(
      '[SOCKET] Failed to list users needing cleanup:',
      error?.message,
    );
    return [];
  }
};

export {
  listUsersNeedingSessionCleanup,
  registerSocketPresence,
  unregisterSocketPresence,
};
