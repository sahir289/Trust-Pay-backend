// import config from '../config/config.js';
import { AUTH_HEADER_KEY } from '../utils/constants.js';
import {
  // AccessDeniedError,
  AuthenticationError,
  DbError,
  InternalServerError,
} from '../utils/appErrors.js';
import { verifyToken } from '../utils/auth.js';
import { logger } from '../utils/logger.js';
import { getSessionByIdDao } from '../apis/auth/authDao.js';
import {
  AUTH_SESSION_CACHE_TTL_SEC,
  buildAuthSessionCacheKey,
  deleteCachedData,
  getCachedData,
  setCachedData,
} from '../utils/redishashkey.js';
import { enforce2FAMiddleware } from './enforce2FA.js';

const logoutSet = new Set();

const applyAuthenticatedSession = (req, decoded, sessionId, isTwoFactorEnabled) => {
  req.user = { ...decoded, is_two_factor_enabled: isTwoFactorEnabled };
  req.sessionId = sessionId;
};

const isAuthenticated = async (req, res, next) => {
  const token = req.header(AUTH_HEADER_KEY);

  try {
    if (!token) {
      throw new AuthenticationError('No token provided');
    }

    if (logoutSet.has(token)) {
      throw new AuthenticationError('Token expired or User logged out.');
    }

    logger.info(`Validating token for session: ${token.slice(0, 10)}...`);
    const decoded = verifyToken(token);

    if (!decoded) {
      throw new AuthenticationError('Invalid token');
    }

    const sessionCacheKey = buildAuthSessionCacheKey(decoded);
    const cachedSession = await getCachedData(
      sessionCacheKey,
      'Auth session cache',
    );
    if (cachedSession?.session_id === decoded.session_id) {
      applyAuthenticatedSession(req, decoded, cachedSession.session_id, cachedSession.is_two_factor_enabled);
      return next();
    }

    // Additional check: Verify session exists and is active in database
    try {
      const activeSession = await getSessionByIdDao({
        user_id: decoded.user_id,
        company_id: decoded.company_id,
        session_id: decoded.session_id,
      });

      if (!activeSession) {
        // Session doesn't exist in database, add token to logout set
        logoutSet.add(token);
        await deleteCachedData(sessionCacheKey, 'Auth session cache');
        throw new AuthenticationError('Session expired or invalid. Please login again.');
      }

      // Session exists, proceed
      await setCachedData(
        sessionCacheKey,
        { 
          session_id: activeSession.session_id,
          is_two_factor_enabled: activeSession.is_two_factor_enabled
        },
        AUTH_SESSION_CACHE_TTL_SEC,
        'Auth session cache',
      );
      applyAuthenticatedSession(req, decoded, activeSession.session_id, activeSession.is_two_factor_enabled);
      
      // APPLY 2FA ENFORCEMENT HERE
      await enforce2FAMiddleware(req, res, (err) => {
        if (err) return next(err);
        next();
      });

    } catch (dbError) {
      logger.error('Database session validation error:', dbError);

      if (dbError instanceof AuthenticationError) {
        throw dbError;
      }

      if (
        dbError instanceof DbError ||
        dbError instanceof InternalServerError ||
        dbError?.statusCode >= 500
      ) {
        return next(
          new InternalServerError(
            'Session validation temporarily unavailable. Please try again.',
          ),
        );
      }

      return next(
        new InternalServerError(
          'Session validation temporarily unavailable. Please try again.',
        ),
      );
    }
    
  } catch (error) {
    logger.error('Error in authentication middleware:', error);
    // Ensure all errors are passed to next() to prevent unhandled rejections
    return next(error instanceof AuthenticationError || error instanceof InternalServerError 
      ? error 
      : new AuthenticationError(error.message));
  }
};

const authorized =
  (allowedRoles = []) =>
  (req, res, next) => {
    try {
      const { designation } = req.user;

      // Ensure allowedRoles is an array
      if (!Array.isArray(allowedRoles)) {
        throw new TypeError('allowedRoles must be an array');
      }

      // Check if the user's designation is included in the allowed roles
      if (!designation || !allowedRoles.includes(designation)) {
        throw new AuthenticationError('Access denied');
      }
      next();
    } catch (error) {
      logger.error('Error in authorization middleware:', error);
      next(new InternalServerError(error.message));
    }
  };

export { isAuthenticated, logoutSet, authorized };
