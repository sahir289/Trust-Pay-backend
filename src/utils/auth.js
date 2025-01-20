import jwt from "jsonwebtoken"
import config from "../config/config.js";
import bcrypt from 'bcryptjs';
import { BadRequestError } from './appErrors.js';
import Logger from "./logger.js";

const logger = new Logger();

const createNewToken = (data) => {
  const accessToken = jwt.sign(data, config.accessTokenSecretKey, {
    expiresIn: config.auth.jwt_expiresin,
  });
  const refreshToken = jwt.sign(data, config.auth.refresh_token_secret, {
    expiresIn: config.auth.refresh_token_expiresin,
  });
  return {
    accessToken,
    refreshToken,
  };
};

const verifyToken = async (token) => {
  try {
    const decoded = jwt.verify(token, config.auth.jwt_secret);
    return decoded;
  } catch (err) {
    logger.log('Getting error while verifying token', 'error', err);
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

export { createNewToken, verifyToken, hashValue, createTemporaryToken };
