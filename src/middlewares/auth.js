import jwt from 'jsonwebtoken';
import appConfig from '../config/config.js';
import { AUTH_HEADER_KEY } from '../utils/constants.js';
import { AuthenticationError } from '../utils/appErrors.js';

const logoutSet = new Set();

const isAuthenticated = (req, res, next) => {
  const token = req.header(AUTH_HEADER_KEY);

  if (!token) {
    throw new AuthenticationError('No token provided');
  }

  if (logoutSet.has(token)) {
    throw new AuthenticationError('Token expired or User logged out.');
  }

  try {
    const decoded = jwt.verify(token, appConfig.jwt.jwt_secret);
    // in future need to keep check with session_id if user is logged out or not
    req.user = decoded;
    next();
  } catch (error) {
    throw new AuthenticationError('Invalid token', error);
  }
};

const authorized = (req, res, next) => {
  const { designation_name } = req.user;
  if (!designation_name) {
    throw new AuthenticationError('User not authorized to perform this action');
  }
  next();
};

export { isAuthenticated, logoutSet, authorized };