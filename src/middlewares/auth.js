// import jwt from 'jsonwebtoken';
// import config from '../config/config.js';
import { AUTH_HEADER_KEY } from '../utils/constants.js';
import { AccessDeniedError, AuthenticationError } from '../utils/appErrors.js';
import { verifyToken } from '../utils/auth.js';
import { getSessionByIdDao } from '../apis/auth/authDao.js';
import { logger } from '../utils/logger.js';

const logoutSet = new Set();

const isAuthenticated = async (req, res, next) => {
  const token = req.header(AUTH_HEADER_KEY);

  if (!token) {
    throw new AuthenticationError('No token provided');
  }

  try {
    logger.error(`Validating token for session: ${token.slice(0, 10)}...`);
    const decoded = verifyToken(token);
    const session = await getSessionByIdDao(decoded);
    if (!session) {
      throw new AuthenticationError('No active session found');
    }

    const config = JSON.parse(session.config);

    if (config.token?.access_token !== token) {
      throw new AuthenticationError('Invalid or expired session');
    }
    req.user = decoded;
    req.session_id = session.session_id;
    next();
  } catch (error) {
    logger.error('Error in authentication middleware:', error);
    if (error.message === 'Token expired') {
      throw new AccessDeniedError('Session expired. Please log in again.');
    }
    throw new AuthenticationError('Invalid token', error);
  }
};

const authorized = (allowedRoles = []) => (req, res, next) => {
  try {
    const { designation } = req.user;

    // Ensure allowedRoles is an array
    if (!Array.isArray(allowedRoles)) {
      throw new TypeError('allowedRoles must be an array');
    }

    // Check if the user's designation is included in the allowed roles
    if (!designation || !allowedRoles.includes(designation)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  } catch (error) {
    console.error('Error in authorization middleware:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

export { isAuthenticated, logoutSet, authorized };
