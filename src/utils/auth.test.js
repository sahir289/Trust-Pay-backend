import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import {
  createNewToken,
  refreshAccessToken,
  generateUserToken,
  verifyToken,
  hashValue,
  createTemporaryToken,
} from './auth.js';
import { BadRequestError } from './appErrors.js';
import { verifyHash } from './bcryptPassword.js';
import { getLoginDao } from '../apis/auth/authDao.js';
import { generateUUID } from './generateUUID.js';
import config from '../config/config.js';
import { logger } from './logger.js';

jest.mock('jsonwebtoken');
jest.mock('bcryptjs');
jest.mock('./bcryptPassword.js');
jest.mock('../apis/auth/authDao.js');
jest.mock('./generateUUID.js');
jest.mock('./logger.js', () => ({
  logger: { error: jest.fn() },
}));
jest.mock('./db.js', () => ({
  createPool: jest.fn(() => ({
    query: jest.fn(),
    connect: jest.fn(() => ({
      query: jest.fn(),
      release: jest.fn(),
    })),
  })),
}));
jest.mock('pg', () => {
  const mockClient = { query: jest.fn(), release: jest.fn() };
  const mockPool = {
    connect: jest.fn().mockResolvedValue(mockClient),
    query: jest.fn(),
    on: jest.fn(),
  };
  return { Pool: jest.fn(() => mockPool) };
});

describe('Auth Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.auth = {
        temp_token: 'mockTempSecret',
        temp_token_expires: '1h',
      };
  });

  describe('createNewToken', () => {
    it('should return accessToken and refreshToken', () => {
      jwt.sign.mockReturnValueOnce('access').mockReturnValueOnce('refresh');
      const tokens = createNewToken({ user: 'test' });
      expect(tokens).toEqual({ accessToken: 'access', refreshToken: 'refresh' });
      expect(jwt.sign).toHaveBeenCalledTimes(2);
    });
  });

  describe('refreshAccessToken', () => {
    it('should return new accessToken if user exists and hash is valid', async () => {
      getLoginDao.mockResolvedValue({ refresh_token: 'hashed' });
      verifyHash.mockReturnValue(true);
      jwt.sign.mockReturnValue('newAccess');

      const data = { user_id: 1, company_id: 2, token: 'token' };
      const result = await refreshAccessToken(data);
      expect(result).toEqual({ accessToken: 'newAccess' });
      expect(getLoginDao).toHaveBeenCalledWith(1, 2);
    });

    it('should throw BadRequestError if user does not exist', async () => {
      getLoginDao.mockResolvedValue(null);
      const data = { user_id: 1, company_id: 2, token: 'token' };
      await expect(refreshAccessToken(data)).rejects.toThrow(BadRequestError);
    });

    it('should throw BadRequestError if hash is invalid', async () => {
      getLoginDao.mockResolvedValue({ refresh_token: 'hashed' });
      verifyHash.mockReturnValue(false);
      const data = { user_id: 1, company_id: 2, token: 'token' };
      await expect(refreshAccessToken(data)).rejects.toThrow(BadRequestError);
    });
  });

  describe('generateUserToken', () => {
    it('should call createNewToken with correct payload', () => {
      generateUUID.mockReturnValue('session-uuid');
      jwt.sign.mockReturnValueOnce('access').mockReturnValueOnce('refresh');

      const user = {
        id: 1,
        user_name: 'user',
        designation_id: 10,
        designation: 'Manager',
        role_id: 5,
        role: 'Admin',
        company_id: 2,
      };
      const tokens = generateUserToken(user);

      expect(tokens).toEqual({ accessToken: 'access', refreshToken: 'refresh' });
      expect(generateUUID).toHaveBeenCalled();
    });
  });

  describe('verifyToken', () => {
    it('should return decoded token if valid', () => {
      jwt.verify.mockReturnValue({ user: 'decoded' });
      const decoded = verifyToken('token');
      expect(decoded).toEqual({ user: 'decoded' });
    });

    it('should throw BadRequestError if token expired', () => {
      jwt.verify.mockImplementation(() => { throw { name: 'TokenExpiredError' }; });
      expect(() => verifyToken('token')).toThrow(BadRequestError);
    });

    it('should log and return false if token invalid', () => {
      jwt.verify.mockImplementation(() => { throw new Error('invalid'); });
      const result = verifyToken('token');
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('hashValue', () => {
    it('should return hashed value', () => {
      bcrypt.genSaltSync.mockReturnValue('salt');
      bcrypt.hashSync.mockReturnValue('hashedValue');

      const result = hashValue('mypassword');
      expect(result).toBe('hashedValue');
      expect(bcrypt.genSaltSync).toHaveBeenCalledWith(15);
      expect(bcrypt.hashSync).toHaveBeenCalledWith('mypassword', 'salt');
    });

    it('should throw BadRequestError if bcrypt fails', () => {
      bcrypt.genSaltSync.mockImplementation(() => { throw new Error('fail'); });
      expect(() => hashValue('x')).toThrow(BadRequestError);
    });
  });

  describe('createTemporaryToken', () => {
    it('should return tempToken', () => {
        jwt.sign.mockReturnValue('tempToken');
    
        const token = createTemporaryToken({ user: 1 });
        
        expect(token).toEqual({ tempToken: 'tempToken' });
        expect(jwt.sign).toHaveBeenCalledWith(
          { user: 1 },
          'mockTempSecret',
          { expiresIn: '1h' }
        );
      });
  });
});
