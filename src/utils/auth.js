import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import bcrypt from 'bcryptjs';
import { BadRequestError } from './appErrors.js';
import { verifyHash } from './bcryptPassword.js';
import { getLoginDao } from '../apis/auth/authDao.js';
import { logger } from './logger.js';

const createNewToken = (data) => {
  const accessToken = jwt.sign(data, config.jwt.jwt_secret, {
    expiresIn: config.jwt.jwt_expires_in,
  });
  const refreshToken = jwt.sign(data, config.jwt.refresh_token_secret, {
    expiresIn: config.jwt.refresh_token_expires_in,
  });
  return {
    accessToken,
    refreshToken,
  };
};

const refreshAccessToken = async (data) => {
  const user = await getLoginDao(data.user_id, data.company_id);
  if (!user) {
    throw new BadRequestError('Unauthorized"');
  }
  const isValid = await verifyHash(data.token, user.refresh_token);
  if (!isValid) {
    throw new BadRequestError('Unauthorized access, Try to login again');
  }
  const accessToken = jwt.sign(data, config.jwt.jwt_secret, {
    expiresIn: config.jwt.jwt_expires_in,
  });
  return { accessToken };
};

const generateUserToken = (user, sessionId) => {
  return createNewToken({
    user_name: user.user_name,
    user_id: user.id,
    designation_id: user.designation_id,
    designation: user.designation,
    role_id: user.role_id,
    role: user.role,
    company_id: user.company_id,
    session_id: sessionId,
    is_h2h: user.is_h2h || false,
  });
};

const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, config.jwt.jwt_secret, {
      algorithms: ['HS256'],
    });
    return decoded;
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new BadRequestError('Token expired');
    }
    logger.error('Token Expired:', err);
    return false;
  }
};

/**
 * Verifies a refresh token using the dedicated refresh-token secret.
 * Refresh tokens are signed with `refresh_token_secret`, so they must be
 * verified with the same key (not the access-token secret). Returns the
 * decoded payload on success or `false` on any failure.
 *
 * @param {string} token
 * @returns {object|false}
 */
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.refresh_token_secret, {
      algorithms: ['HS256'],
      ignoreExpiration: true,
    });
  } catch (err) {
    logger.error('Refresh token verification failed:', err);
    return false;
  }
};

const hashValue = (value) => {
  try {
    const salt = bcrypt.genSaltSync(15);
    const stringValue = String(value);
    return bcrypt.hashSync(stringValue, salt);
  } catch (error) {
    throw new BadRequestError('Error in hashValue:', error);
  }
};

const createTemporaryToken = (data) => {
  const tempToken = jwt.sign(data, config.auth.temp_token, {
    expiresIn: config.auth.temp_token_expires,
  });
  return {
    tempToken,
  };
};

/**
 * Generates a short-lived pre-auth token used exclusively during the 2FA
 * login handshake. It carries stage: 'PRE_2FA' so the verify endpoint
 * can assert the token was issued for this purpose.
 *
 * @param {{ user_id: string, user_name: string }} payload
 * @returns {string} signed JWT, expires in 5 minutes
 */
const generatePreAuthToken = (payload) => {
  return jwt.sign(
    { user_id: payload.user_id, user_name: payload.user_name, stage: 'PRE_2FA' },
    config.jwt.jwt_secret,
    { expiresIn: '5m' },
  );
};

/**
 * Verifies a pre-auth token and asserts it has the correct stage.
 * Throws BadRequestError on any failure so callers don't need extra guards.
 *
 * @param {string} token
 * @returns {{ user_id: string, user_name: string, stage: string }}
 */
const verifyPreAuthToken = (token) => {
  try {
    const decoded = jwt.verify(token, config.jwt.jwt_secret, {
      algorithms: ['HS256'],
    });
    if (decoded?.stage !== 'PRE_2FA') {
      throw new BadRequestError('Invalid pre-auth token stage');
    }
    return decoded;
  } catch (err) {
    if (err instanceof BadRequestError) throw err;
    if (err.name === 'TokenExpiredError') {
      throw new BadRequestError('Pre-auth token expired. Please login again.');
    }
    throw new BadRequestError('Invalid pre-auth token');
  }
};

export {
  createNewToken,
  refreshAccessToken,
  generateUserToken,
  verifyToken,
  verifyRefreshToken,
  hashValue,
  createTemporaryToken,
  generatePreAuthToken,
  verifyPreAuthToken,
};
