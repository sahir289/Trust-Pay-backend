// import config from '../config/config.js';
import { AUTH_HEADER_KEY } from '../utils/constants.js';
import {
  // AccessDeniedError,
  AuthenticationError,
  InternalServerError,
} from '../utils/appErrors.js';
import { verifyToken } from '../utils/auth.js';
import { logger } from '../utils/logger.js';

const logoutSet = new Set();

const isAuthenticated = async (req, res, next) => {
  const token = req.header(AUTH_HEADER_KEY);

  try {
    if (!token) {
      throw new AuthenticationError('No token provided');
    }

    if (logoutSet.has(token)) {
      throw new AuthenticationError('Token expired or User logged out.');
    }

    logger.error(`Validating token for session: ${token.slice(0, 10)}...`);
    const decoded = verifyToken(token);

    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Error in authentication middleware:', error);
    next(new AuthenticationError(error.message));
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
