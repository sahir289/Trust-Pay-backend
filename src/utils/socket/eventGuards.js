import { logger } from '../logger.js';
import { AuthenticationError } from '../appErrors.js';
import { consumeSocketRateLimit, socketLimiterProfiles } from './rateLimit.js';
import { getSocketUserId } from './socketMetadata.js';

const buildSocketEventKey = (socket, eventName, scope = 'generic') => {
  const socketUserId = getSocketUserId(socket) || socket.data?.authTokenUserId;
  const address = socket.handshake?.address || 'unknown';
  return `${scope}:${eventName}:${socketUserId || address}`;
};

const emitSocketError = (socket, eventName, message) => {
  socket.emit('socket:error', {
    event: eventName,
    message,
    timestamp: new Date().toISOString(),
  });
};

const validateSessionPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  if (!payload.userId || typeof payload.userId !== 'string') {
    return false;
  }

  if ('sessionId' in payload && payload.sessionId !== null && typeof payload.sessionId !== 'string') {
    return false;
  }

  return true;
};

const resolveLimiterForScope = (limiter, limiterScope) => {
  if (limiter) {
    return limiter;
  }

  if (limiterScope === 'auth') {
    return socketLimiterProfiles.authEvent;
  }

  return socketLimiterProfiles.genericEvent;
};

const withSocketEventGuard = (
  eventName,
  handler,
  {
    limiter = null,
    limiterScope = 'generic',
    validator = null,
    authorization = null,
  } = {},
) => {
  return async (socket, payload) => {
    const activeLimiter = resolveLimiterForScope(limiter, limiterScope);
    const allowed = await consumeSocketRateLimit(
      activeLimiter,
      buildSocketEventKey(socket, eventName, limiterScope),
      `socket event:${eventName}`,
    );

    if (!allowed) {
      emitSocketError(socket, eventName, 'Too many socket events. Please slow down.');
      return;
    }

    if (validator && !validator(payload)) {
      logger.warn(`[SOCKET] Invalid payload for event ${eventName}`);
      emitSocketError(socket, eventName, 'Invalid socket payload');
      return;
    }

    if (authorization && !authorization(socket, payload)) {
      logger.warn(`[SOCKET] Unauthorized payload for event ${eventName}`);
      emitSocketError(socket, eventName, 'Unauthorized socket payload');
      return;
    }

    try {
      await handler(payload);
    } catch (error) {
      logger.error(`[SOCKET] Error handling event ${eventName}: ${error.message}`);
      emitSocketError(socket, eventName, error instanceof AuthenticationError ? error.message : 'Socket event failed');
    }
  };
};

export {
  emitSocketError,
  validateSessionPayload,
  withSocketEventGuard,
};
