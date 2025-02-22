import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import bcrypt from 'bcryptjs';
import { BadRequestError } from './appErrors.js';
import { verifyHash } from './bcryptPassword.js';
import { getLoginDao } from '../apis/auth/authDao.js';
import { generateUUID } from './generateUUID.js';

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
  const isValid = verifyHash(data.token, user.refresh_token);
  if (!isValid) {
    throw new BadRequestError('Unauthorized access, Try to login again');
  }
  const accessToken = jwt.sign(data, config.jwt.jwt_secret, {
    expiresIn: config.jwt.jwt_expires_in,
  });
  return { accessToken };
};

const generateUserToken = (user) => {
  const sessionId = generateUUID();
  return createNewToken({
    user_name: user.user_name,
    user_id: user.id,
    designation_id: user.designation_id,
    designation_name: user.designation_name,
    role_id: user.role_id,
    role_name: user.role_name,
    company_id: user.company_id,
    session_id: sessionId,
  });
};

const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, config.jwt.jwt_secret);
    return decoded;
  } catch (err) {
    console.error('Getting error while verifying token', err);
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

export {
  createNewToken,
  refreshAccessToken,
  generateUserToken,
  verifyToken,
  hashValue,
  createTemporaryToken,
};
