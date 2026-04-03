import { AUTH_HEADER_KEY } from '../constants.js';
import { AuthenticationError } from '../appErrors.js';
import { getSessionByIdDao } from '../../apis/auth/authDao.js';
import { verifyToken } from '../auth.js';
import {
  AUTH_SESSION_CACHE_TTL_SEC,
  buildAuthSessionCacheKey,
  getCachedData,
  setCachedData,
} from '../redishashkey.js';
import { logger } from '../logger.js';
import { consumeSocketRateLimit, getSocketClientAddress, socketLimiterProfiles } from './rateLimit.js';

const getSocketToken = (socket) => {
  const authToken = socket.handshake?.auth?.token;
  if (authToken) {
    return authToken;
  }

  const headerToken = socket.handshake?.headers?.[AUTH_HEADER_KEY];
  if (headerToken) {
    return headerToken;
  }

  const authorizationHeader = socket.handshake?.headers?.authorization;
  if (typeof authorizationHeader === 'string' && authorizationHeader.startsWith('Bearer ')) {
    return authorizationHeader.slice(7).trim();
  }

  return null;
};

const validateSocketSession = async (decoded) => {
  const sessionCacheKey = buildAuthSessionCacheKey(decoded);
  const cachedSession = await getCachedData(sessionCacheKey, 'Socket auth session cache');

  if (cachedSession?.session_id === decoded.session_id) {
    return cachedSession.session_id;
  }

  const activeSession = await getSessionByIdDao({
    user_id: decoded.user_id,
    company_id: decoded.company_id,
    session_id: decoded.session_id,
  });

  if (!activeSession) {
    throw new AuthenticationError('Socket session expired or invalid. Please login again.');
  }

  await setCachedData(
    sessionCacheKey,
    { session_id: activeSession.session_id },
    AUTH_SESSION_CACHE_TTL_SEC,
    'Socket auth session cache',
  );

  return activeSession.session_id;
};

const authenticateSocketHandshake = async (socket, next) => {
  try {
    const address = getSocketClientAddress(socket);
    const allowed = await consumeSocketRateLimit(
      socketLimiterProfiles.connect,
      `connect:${address}`,
      'socket connect',
    );

    if (!allowed) {
      return next(new AuthenticationError('Too many socket connection attempts. Please try again later.'));
    }

    const token = getSocketToken(socket);
    if (!token) {
      const existingData = socket.data ?? undefined;
      socket.data = {
        ...existingData,
        isAuthenticated: false,
      };
      return next();
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return next(new AuthenticationError('Invalid socket token'));
    }

    const sessionId = await validateSocketSession(decoded);
    const existingData = socket.data ?? undefined;
    socket.data = {
      ...existingData,
      authenticatedUser: decoded,
      authenticatedSessionId: sessionId,
      isAuthenticated: true,
      authTokenUserId: decoded.user_id,
    };

    return next();
  } catch (error) {
    logger.warn('[SOCKET] Handshake authentication failed:', error?.message);
    return next(error instanceof AuthenticationError ? error : new AuthenticationError('Socket authentication failed'));
  }
};

const requireMatchingAuthenticatedUser = (socket, payloadUserId, payloadSessionId = null) => {
  if (!socket.data?.isAuthenticated) {
    return true;
  }

  const authenticatedUser = socket.data.authenticatedUser;
  const authenticatedSessionId = socket.data.authenticatedSessionId;

  if (payloadUserId && String(authenticatedUser.user_id) !== String(payloadUserId)) {
    return false;
  }

  if (payloadSessionId && authenticatedSessionId && String(authenticatedSessionId) !== String(payloadSessionId)) {
    return false;
  }

  return true;
};

export {
  authenticateSocketHandshake,
  getSocketToken,
  requireMatchingAuthenticatedUser,
  validateSocketSession,
};
