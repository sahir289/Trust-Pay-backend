// import jwt from 'jsonwebtoken';
// import config from '../config/config.js';
import { AUTH_HEADER_KEY } from '../utils/constants.js';
import { AccessDeniedError, AuthenticationError } from '../utils/appErrors.js';
import { verifyToken } from '../utils/auth.js';
// import { getLoginDao } from '../apis/auth/authDao.js';

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
    const decoded = verifyToken(token);
    // in future need to keep check with session_id if user is logged out or not
    // console.log(decoded, "decoddeeed")
    // const user = await getLoginDao(decoded.user_id, decoded.company_id);
    // if(!user){
    //   throw new NotFoundError('User Not Found');
    // }
    // console.log(user, "user here")
    // const sessionId = user?.config.session_id;
    // // console.log(sessionId, decoded.session_id, "decoded.session_id")
    // if(sessionId !== decoded.session_id){
    //   throw new AuthenticationError('Token expired or User logged in somewhere else.');
    // } else {
    // }
    req.user = decoded;
    next();
  } catch (error) {
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
