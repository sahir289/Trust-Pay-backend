/* global describe, it, expect, afterEach, beforeAll, beforeEach */
import { jest } from '@jest/globals';

// ─────────────────────────────────────────────
// DAO MOCKS (must be before imports)
// ─────────────────────────────────────────────
jest.unstable_mockModule('../../src/apis/auth/authDao.js', () => ({
  addLoginDao: jest.fn(),
  getRefreshTokenDao: jest.fn(),
  getLoginDao: jest.fn(),
  getSessionByIdDao: jest.fn(),
  updateSessionDao: jest.fn(),
  deleteUserSessionsDao: jest.fn(),
  changePasswordDao: jest.fn(),
  getUserAuthPasswordDao: jest.fn(),
  getAllActiveSessionsDao: jest.fn(),
  getRoleByUserNameDao: jest.fn(),
  getUserForVerificationDao: jest.fn(),
  getSessionByUserIdDao: jest.fn(),
}));

// ─────────────────────────────────────────────
// MAILER MOCK
// ─────────────────────────────────────────────
jest.unstable_mockModule('../../src/utils/sendMailer.js', () => ({
  sendOTP: jest.fn(),
}));

// ─────────────────────────────────────────────
// OTP DAO MOCK
// ─────────────────────────────────────────────
jest.unstable_mockModule('../../src/apis/userOtp/userOtpDao.js', () => ({
  createUserOtpDao: jest.fn(),
}));

// ─────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────
let authService;
let authDao;
let sendMailer;
let userOtpDao;

beforeAll(async () => {
  authService = await import('../../src/apis/auth/authService.js');
  authDao = await import('../../src/apis/auth/authDao.js');
  sendMailer = await import('../../src/utils/sendMailer.js');
  userOtpDao = await import('../../src/apis/userOtp/userOtpDao.js');
});

// ─────────────────────────────────────────────
// RESET
// ─────────────────────────────────────────────
beforeEach(() => {
  authDao.getUserForVerificationDao = jest.fn();
  sendMailer.sendOTP = jest.fn();
  userOtpDao.createUserOtpDao = jest.fn();
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────
// TEST SUITE
// ─────────────────────────────────────────────
describe('authService', () => {

  const serviceNames = [
    'loginService',
    'refreshTokenService',
    'changePasswordService',
    'verificationService',
    'logoutService',
    'verfyUserService',
    'verfyOtpService',
    'forgetPasswordService',
    'getUserRoleService',
    'verifyLoginOtpService',
    'setup2FAService',
    'confirm2FAService',
    'disable2FAService',
  ];

  serviceNames.forEach((name) => {
    it(`${name} should be defined`, () => {
      expect(authService[name]).toBeDefined();
      expect(typeof authService[name]).toBe('function');
    });
  });

  // ─────────────────────────────────────────────
  // verfyUserService
  // ─────────────────────────────────────────────
  describe('verfyUserService', () => {

    it('should throw if user not found', async () => {
      authDao.getUserForVerificationDao.mockResolvedValue(null);

      await expect(
        authService.verfyUserService('nouser'),
      ).rejects.toThrow();
    });

    it('should send OTP and create user OTP', async () => {
      authDao.getUserForVerificationDao.mockResolvedValue({
        id: 1,
        email: 'a@b.com',
        user_name: 'test',
        designation: 'admin',
      });

      sendMailer.sendOTP.mockResolvedValue();
      userOtpDao.createUserOtpDao.mockResolvedValue();

      await expect(
        authService.verfyUserService('test'),
      ).resolves.toBe(true);

      expect(sendMailer.sendOTP).toHaveBeenCalled();
      expect(userOtpDao.createUserOtpDao).toHaveBeenCalled();
    });
  });
});