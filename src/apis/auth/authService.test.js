import { jest } from '@jest/globals';
// import os from 'os';
import { Role } from '../../constants/index.js';
import * as authServiceModule from './authService.js';
import {
  loginService,
  refreshTokenService,
  logoutService,
  changePasswordService,
  // verificationService,
  // verfyUserService,
  verfyOtpService,
  forgetPasswordService,
  getUserRoleService,
} from './authService.js';

import * as userDao from '../users/userDao.js';
import * as authDao from './authDao.js';
import * as bcryptUtils from '../../utils/bcryptPassword.js';
import * as authUtils from '../../utils/auth.js';
import * as socketUtils from '../../utils/sockets.js';
// import * as mailerUtils from '../../utils/sendMailer.js';
import * as otpDao from '../userOtp/userOtpDao.js';
// import { generateOTP } from '../../utils/generateOtp.js';
import { generateUUID } from '../../utils/generateUUID.js';
import { NotFoundError, BadRequestError } from '../../utils/appErrors.js';
import { getConnection } from '../../utils/db.js';
// import { logger } from '../../utils/logger.js';

jest.mock('../users/userDao.js');
jest.mock('./authDao.js');
jest.mock('../../utils/bcryptPassword.js');
jest.mock('../../utils/auth.js');
jest.mock('../../utils/sockets.js');
jest.mock('../../utils/sendMailer.js');
jest.mock('../userOtp/userOtpDao.js');
jest.mock('../../utils/generateOtp.js');
jest.mock('../../utils/generateUUID.js');
jest.mock('../../utils/logger.js');
jest.mock('../../utils/db.js');

describe('Auth Service', () => {
  const mockUser = {
    id: 1,
    username: 'testuser',
    password: 'hashedpwd',
    is_enabled: true,
    designation: Role.USER,
    company_id: 1,
    company_config: { unique_admin_id: 'ADMIN123' },
    config: { isLoginFirst: true },
    email: 'test@example.com',
  };

  const clientIP = '127.0.0.1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ------------------------- loginService -------------------------
  describe('loginService', () => {
    it('should throw NotFoundError if user not found', async () => {
      userDao.getUsersByUserNameDao.mockResolvedValue(null);
      await expect(loginService({ username: 'x', password: 'x' }, clientIP))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError if user not enabled', async () => {
      userDao.getUsersByUserNameDao.mockResolvedValue({ ...mockUser, is_enabled: false });
      await expect(loginService({ username: 'x', password: 'x' }, clientIP))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw BadRequestError if admin login with wrong unique ID', async () => {
      const adminUser = { ...mockUser, designation: Role.ADMIN };
      userDao.getUsersByUserNameDao.mockResolvedValue(adminUser);
      await expect(loginService({ username: 'admin', password: 'x', unique_admin_id: 'WRONG' }, clientIP))
        .rejects.toThrow(BadRequestError);
    });

    it('should handle first login and return loginFirstObj', async () => {
      userDao.getUsersByUserNameDao.mockResolvedValue({ ...mockUser, config: { isLoginFirst: true } });
      bcryptUtils.verifyHash.mockResolvedValue(true);

      const res = await loginService({ username: 'x', password: 'x' }, clientIP);
      expect(res).toEqual({ id: mockUser.id, isLoginFirst: true });
    });

    it('should create session and return tokenInfo and sessionId', async () => {
      userDao.getUsersByUserNameDao.mockResolvedValue({ ...mockUser, config: { isLoginFirst: false } });
      bcryptUtils.verifyHash.mockResolvedValue(true);
      authUtils.generateUserToken.mockReturnValue({ accessToken: 'at', refreshToken: 'rt' });
      bcryptUtils.createHash.mockResolvedValue('hashed_refresh');
      generateUUID.mockReturnValue('uuid');
      authDao.deleteUserSessionsDao.mockResolvedValue(true);
      authDao.addLoginDao.mockResolvedValue(true);

      getConnection.mockResolvedValue({
        query: jest.fn().mockResolvedValue({}),
        release: jest.fn(),
      });

      const res = await loginService({ username: 'x', password: 'x' }, clientIP);

      expect(res).toHaveProperty('tokenInfo');
      expect(res).toHaveProperty('sessionId', 'uuid');
      expect(socketUtils.forceLogoutUser).toHaveBeenCalled();
    });

    it('should retry login on serialization failure', async () => {
      const connMock = {
        query: jest.fn()
          .mockRejectedValueOnce({ code: '40001', message: 'serialization failure' })
          .mockResolvedValueOnce({})
          .mockResolvedValue({}),
        release: jest.fn(),
      };
      userDao.getUsersByUserNameDao.mockResolvedValue({ ...mockUser, config: { isLoginFirst: false } });
      bcryptUtils.verifyHash.mockResolvedValue(true);
      authDao.deleteUserSessionsDao.mockResolvedValue(true);
      authDao.addLoginDao.mockResolvedValue(true);
      authUtils.generateUserToken.mockReturnValue({ accessToken: 'at', refreshToken: 'rt' });
      bcryptUtils.createHash.mockResolvedValue('hashed_refresh');
      generateUUID.mockReturnValue('uuid');

      getConnection.mockResolvedValue(connMock);

      const res = await loginService({ username: 'x', password: 'x' }, clientIP);
      expect(res).toHaveProperty('sessionId', 'uuid');
    });
  });

  // ------------------------- refreshTokenService -------------------------
  describe('refreshTokenService', () => {
    it('should throw error if session not found', async () => {
      authDao.getSessionByIdDao.mockResolvedValue(null);
      await expect(refreshTokenService(1, 1, 'rt')).rejects.toThrow('No active session found');
    });
  });

  // ------------------------- logoutService -------------------------
  describe('logoutService', () => {
    it('should delete session and call logOutUser', async () => {
      authDao.deleteUserSessionsDao.mockResolvedValue(true);
      await logoutService({ user_id: 1, company_id: 1 }, 'session123');
      expect(socketUtils.logOutUser).toHaveBeenCalledWith(1, 'session123');
    });
  });

  // ------------------------- changePasswordService -------------------------
  describe('changePasswordService', () => {

    it('should change password successfully', async () => {
      jest.spyOn(authServiceModule, 'verificationService').mockResolvedValue(true);
      bcryptUtils.createHash.mockResolvedValue('newHash');
      authDao.changePasswordDao.mockResolvedValue({ id: 1 });
      const res = await changePasswordService({ user_id: 1, user_name: 'x', oldPassword: 'x', password: 'y' });
      expect(res).toEqual({ id: 1 });
    });
  });

  // ------------------------- forgetPasswordService -------------------------
  describe('forgetPasswordService', () => {
    it('should update user password', async () => {
      bcryptUtils.createHash.mockResolvedValue('newHash');
      userDao.updateUserDao.mockResolvedValue({ id: 1 });
      const res = await forgetPasswordService({ user_id: 1, password: 'x' });
      expect(res).toEqual({ id: 1 });
    });
  });

  // ------------------------- verfyOtpService -------------------------
  describe('verfyOtpService', () => {
    it('should throw AuthenticationError if OTP invalid', async () => {
      otpDao.getUserOtpDao.mockResolvedValue(null);
      await expect(verfyOtpService('otp')).rejects.toThrow('Please Enter Vaild OTP');
    });

    it('should throw AuthenticationError if OTP expired', async () => {
      otpDao.getUserOtpDao.mockResolvedValue({ expiration_time: new Date(Date.now() - 1000), is_used: false, user_id:1 });
      await expect(verfyOtpService('otp')).rejects.toThrow('Expired Otp');
    });

    it('should throw AuthenticationError if OTP already used', async () => {
      otpDao.getUserOtpDao.mockResolvedValue({ expiration_time: new Date(Date.now() + 10000), is_used: true, user_id:1 });
      await expect(verfyOtpService('otp')).rejects.toThrow('Please Enter New Otp');
    });

    it('should verify OTP successfully', async () => {
      otpDao.getUserOtpDao.mockResolvedValue({ expiration_time: new Date(Date.now() + 10000), is_used: false, user_id:1 });
      otpDao.updateUserOtpDao.mockResolvedValue(true);
      const res = await verfyOtpService('otp');
      expect(res).toEqual({ id:1 });
    });
  });

  // ------------------------- getUserRoleService -------------------------
  describe('getUserRoleService', () => {
    it('should throw NotFoundError if user not found', async () => {
      authDao.getRoleByUserNameDao.mockResolvedValue(null);
      await expect(getUserRoleService('x')).rejects.toThrow(NotFoundError);
    });

    it('should return isAdmin false for normal user', async () => {
      authDao.getRoleByUserNameDao.mockResolvedValue({ designation: Role.USER });
      const res = await getUserRoleService('x');
      expect(res).toEqual({ isAdmin: false });
    });

    it('should return isAdmin true for admin', async () => {
      authDao.getRoleByUserNameDao.mockResolvedValue({ designation: Role.ADMIN });
      const res = await getUserRoleService('x');
      expect(res).toEqual({ isAdmin: true });
    });
  });

});
