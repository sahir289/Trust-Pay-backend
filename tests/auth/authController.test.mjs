/* global describe, it, expect, beforeEach, afterEach, beforeAll */
import { jest } from '@jest/globals';

// ─────────────────────────────────────────────
// AUTH SERVICE MOCKS (must stay at top)
// ─────────────────────────────────────────────
jest.unstable_mockModule('../../src/apis/auth/authService.js', () => ({
  loginService: jest.fn(),
  refreshTokenService: jest.fn(),
  changePasswordService: jest.fn(),
  verificationService: jest.fn(),
  logoutService: jest.fn(),
  verfyUserService: jest.fn(),
  verfyOtpService: jest.fn(),
  forgetPasswordService: jest.fn(),
  getUserRoleService: jest.fn(),
  verifyLoginOtpService: jest.fn(),
  setup2FAService: jest.fn(),
  confirm2FAService: jest.fn(),
  disable2FAService: jest.fn(),
}));

// ─────────────────────────────────────────────
// RESPONSE HANDLERS MOCK
// ─────────────────────────────────────────────
jest.unstable_mockModule('../../src/utils/responseHandlers.js', () => ({
  sendSuccess: jest.fn(),
}));

// ─────────────────────────────────────────────
// APP ERRORS MOCK
// ─────────────────────────────────────────────
jest.unstable_mockModule('../../src/utils/appErrors.js', () => ({
  ValidationError: class ValidationError extends Error {},
  BadRequestError: class BadRequestError extends Error {},
}));

// ─────────────────────────────────────────────
// AUTH SCHEMA MOCK
// ─────────────────────────────────────────────
jest.unstable_mockModule('../../src/schemas/authSchema.js', () => ({
  INSERT_AUTH_SCHEMA: { validate: jest.fn() },
}));

// ─────────────────────────────────────────────
// AUTH UTILS MOCK
// ─────────────────────────────────────────────
jest.unstable_mockModule('../../src/utils/auth.js', () => ({
  verifyToken: jest.fn(),
  generateUserToken: jest.fn(),
}));

// ─────────────────────────────────────────────
// AUTH DAO MOCK
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
// IMPORTS (after mocks)
// ─────────────────────────────────────────────
let controllers, authService, responseHandlers, appErrors, authSchema, authUtil;

beforeAll(async () => {
  controllers = await import('../../src/apis/auth/authController.js');
  authService = await import('../../src/apis/auth/authService.js');
  responseHandlers = await import('../../src/utils/responseHandlers.js');
  appErrors = await import('../../src/utils/appErrors.js');
  authSchema = await import('../../src/schemas/authSchema.js');
  authUtil = await import('../../src/utils/auth.js');
});

// ─────────────────────────────────────────────
// RESET BETWEEN TESTS
// ─────────────────────────────────────────────
beforeEach(() => {
  if (authService) authService.loginService = jest.fn();
  if (authService) authService.refreshTokenService = jest.fn();
  if (authSchema?.INSERT_AUTH_SCHEMA) authSchema.INSERT_AUTH_SCHEMA.validate = jest.fn();
  if (responseHandlers) responseHandlers.sendSuccess = jest.fn();
  if (authUtil) authUtil.verifyToken = jest.fn();
  if (authUtil) authUtil.generateUserToken = jest.fn();
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────
// TEST SUITE
// ─────────────────────────────────────────────
describe('authController', () => {

  const controllerNames = [
    'loginController',
    'refreshTokenController',
    'changePasswordController',
    'logoutController',
    'verificationController',
    'verfyUserController',
    'verfyOtpController',
    'forgetPasswordController',
    'getUserRoleController',
    'verifyLoginOtpController',
    'setup2FAController',
    'confirm2FAController',
    'disable2FAController',
  ];

  controllerNames.forEach((name) => {
    it(`${name} should be defined`, () => {
      expect(controllers[name]).toBeDefined();
      expect(typeof controllers[name]).toBe('function');
    });
  });

  // ─────────────────────────────────────────────
  // LOGIN CONTROLLER
  // ─────────────────────────────────────────────
  describe('loginController', () => {

    let req, res;

    beforeEach(() => {
      req = {
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
        body: { username: 'test', password: 'pass' },
        user_location: { city: 'TestCity' },
      };

      res = {
        cookie: jest.fn(),
      };
    });

    it('should handle successful login', async () => {
      authService.loginService.mockResolvedValue({
        tokenInfo: { accessToken: 'token' },
        sessionId: 'session',
        // Add these to make the mock more realistic (optional but recommended)
        user: { id: 123, username: 'test' },
        two_factor_enforcement: false,
        must_setup_2fa: false,
      });

      responseHandlers.sendSuccess.mockImplementation((res, token, msg) => {
        res._sent = { token, msg };
        return res;
      });

      authSchema.INSERT_AUTH_SCHEMA.validate.mockReturnValue({});

      await controllers.loginController(req, res);

      expect(res.cookie).toHaveBeenCalled();

      expect(res._sent.token).toEqual({
        accessToken: 'token',
        sessionId: 'session',
        user: expect.any(Object),           // or provide exact shape if you want
        two_factor_enforcement: false,      // or expect.anything() / undefined
        must_setup_2fa: false,
      });

      expect(res._sent.msg).toBe('login successfully');
    });

    it('should handle validation error', async () => {
      authSchema.INSERT_AUTH_SCHEMA.validate.mockReturnValue({
        error: { details: [{ message: 'validation error' }] },
      });

      // Call the controller and expect it to throw a ValidationError
      await expect(
        controllers.loginController(req, res),
      ).rejects.toThrow(appErrors.ValidationError);
    });

    it('should handle first login', async () => {
      authService.loginService.mockResolvedValue({
        isLoginFirst: true,
      });

      responseHandlers.sendSuccess.mockImplementation((res, data, msg) => {
        res._sent = { data, msg };
        return res;
      });

      authSchema.INSERT_AUTH_SCHEMA.validate.mockReturnValue({});

      await controllers.loginController(req, res);

      // Check the response sent by sendSuccess
      expect(res._sent.data).toEqual({ isLoginFirst: true });
      expect(res._sent.msg).toBe("user's first login");
    });

    it('should handle 2FA required', async () => {
      authService.loginService.mockResolvedValue({
        twoFactorRequired: true,
        preAuthToken: 'preAuth',
      });

      responseHandlers.sendSuccess.mockImplementation((res, data, msg) => {
        res._sent = { data, msg };
        return res;
      });

      authSchema.INSERT_AUTH_SCHEMA.validate.mockReturnValue({});

      await controllers.loginController(req, res);

      // Check the response sent by sendSuccess
      expect(res._sent.data).toEqual({
        twoFactorRequired: true,
        preAuthToken: 'preAuth',
      });

      expect(res._sent.msg).toBe('2FA verification required');
    });
  });

  // ─────────────────────────────────────────────
  // REFRESH TOKEN CONTROLLER
  // ─────────────────────────────────────────────
  describe('refreshTokenController', () => {

    let req, res;

    beforeEach(() => {
      req = {
        cookies: { refreshToken: 'refresh' },
      };

      res = {};
    });

    it('should throw error if no refreshToken', async () => {
      req.cookies = {};

      // Call the controller and expect it to throw a BadRequestError
      await expect(
        controllers.refreshTokenController(req, res),
      ).rejects.toThrow(appErrors.BadRequestError);
    });

    // it('should handle successful refresh', async () => {
    //   authUtil.verifyToken.mockReturnValue({
    //     user_id: 1,
    //     company_id: 2,
    //   });

    //   authService.refreshTokenService.mockResolvedValue({
    //     config: '{"token":{}}',
    //     session_id: 'sid',
    //   });

    //   authUtil.generateUserToken.mockReturnValue('newAccessToken');

    //   responseHandlers.sendSuccess.mockImplementation((res, token, msg) => {
    //     res._sent = { token, msg };
    //     return res;
    //   });

    //   await controllers.refreshTokenController(req, res);

    //   // Check if response was sent correctly
    //   expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    //   expect(res._sent.token).toEqual({
    //     accessToken: 'newAccessToken',
    //   });

    //   expect(res._sent.msg).toBe(
    //     'Refresh token generated successfully',
    //   );
    // });
  });
});