import {
    loginController,
    refreshTokenController,
    logoutController,
    verificationController,
    changePasswordController,
    verfyUserController,
    verfyOtpController,
    forgetPasswordController,
    getUserRoleController,
  } from './authController.js';
  
  import * as authService from './authService.js';
  import * as authUtils from '../../utils/auth.js';
  import * as responseHandlers from '../../utils/responseHandlers.js';
  import { updateSessionDao } from './authDao.js';
  import { logoutSet } from '../../middlewares/auth.js';
  import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
  import { INSERT_AUTH_SCHEMA } from '../../schemas/authSchema.js';
  
  jest.mock('./authService.js');
  jest.mock('../../utils/auth.js');
  jest.mock('../../utils/responseHandlers.js');
  jest.mock('./authDao.js');
  jest.mock('../../middlewares/auth.js');
  
  describe('Auth Controllers', () => {
    let req, res;
  
    beforeEach(() => {
      req = { body: {}, headers: {}, cookies: {}, query: {}, user: {} };
      res = { cookie: jest.fn() };
      // next = jest.fn();
      responseHandlers.sendSuccess.mockImplementation((res, data, message) => ({ res, data, message }));
      logoutSet.add = jest.fn();
    });
  
    afterEach(() => {
      jest.clearAllMocks();
    });
  
    describe('loginController', () => {
        it('should login successfully and set refresh token', async () => {
            req.body = { username: 'user', password: 'pass' };
            req.headers = {}; 
            req.socket = { remoteAddress: '127.0.0.1' }; 
          
            authService.loginService.mockResolvedValue({
              isLoginFirst: false,
              refreshToken: 'refresh-token',
              tokenInfo: { accessToken: 'access-token' },
              sessionId: 'session-id',
            });
          
            await loginController(req, res);
          
            expect(res.cookie).toHaveBeenCalledWith(
              'refreshToken',
              'refresh-token',
              expect.objectContaining({ httpOnly: true }),
            );
            expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(
              res,
              { accessToken: 'access-token', sessionId: 'session-id' },
              'login successfully',
            );
          });
          
  
          it('should send first login message', async () => {
            req.body = { username: 'user', password: 'pass' };
            
            req.socket = { remoteAddress: '127.0.0.1' };
            
            authService.loginService.mockResolvedValue({ isLoginFirst: true });
          
            await loginController(req, res);
          
            expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(
              res,
              { isLoginFirst: true },
              "user's first login"
            );
          });
          
  
          it('should throw ValidationError if input invalid', async () => {
            req.body = { username: '' }; 
            req.socket = { remoteAddress: '127.0.0.1' }; 
            req.headers = {}; 
          
            INSERT_AUTH_SCHEMA.validate = jest.fn().mockReturnValue({
              error: {
                details: [
                  { message: '"username" is not allowed to be empty' }
                ]
              }
            });
          
            await expect(loginController(req, res)).rejects.toThrow(ValidationError);
          });          
      
    });
  
    describe('refreshTokenController', () => {
      it('should throw BadRequestError if no refresh token', async () => {
        req.cookies = {};
        await expect(refreshTokenController(req, res)).rejects.toThrow(BadRequestError);
      });
  
      it('should generate new access token and update session', async () => {
        req.cookies = { refreshToken: 'token' };
        authUtils.verifyToken.mockReturnValue({ user_id: 'u1', company_id: 'c1' });
        authService.refreshTokenService.mockResolvedValue({ session_id: 's1', config: '{"token":{}}' });
        authUtils.generateUserToken.mockReturnValue('new-token');
  
        await refreshTokenController(req, res);
  
        expect(updateSessionDao).toHaveBeenCalled();
        expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(
          res,
          { accessToken: 'new-token' },
          'Refresh token generated successfully',
        );
      });
    });
  
    describe('logoutController', () => {
      it('should logout successfully', async () => {
        req.body = { session_id: 's1' };
        req.header = jest.fn().mockReturnValue('token');
        authUtils.verifyToken.mockReturnValue('decoded-token');
  
        await logoutController(req, res);
  
        expect(authService.logoutService).toHaveBeenCalledWith('decoded-token', 's1');
        expect(logoutSet.add).toHaveBeenCalledWith('token');
        expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, {}, 'logout successfully');
      });
    });
  
    describe('verificationController', () => {
      it('should verify password successfully', async () => {
        req.user = { user_name: 'u', user_id: 'id', company_id: 'c' };
        req.body = { password: 'pass' };
        authService.verificationService.mockResolvedValue(true);
  
        await verificationController(req, res);
  
        expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, {}, 'Verification successful');
      });
  
      it('should throw BadRequestError for invalid password', async () => {
        req.user = { user_name: 'u', user_id: 'id', company_id: 'c' };
        req.body = { password: 'pass' };
        authService.verificationService.mockResolvedValue(false);
  
        await expect(verificationController(req, res)).rejects.toThrow(BadRequestError);
      });
    });
  
    describe('changePasswordController', () => {
      it('should change password successfully', async () => {
        req.user = { user_id: 'u', user_name: 'name' };
        req.body = { oldPassword: 'old', password: 'new' };
        authService.changePasswordService.mockResolvedValue(true);
  
        await changePasswordController(req, res);
  
        expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, {}, 'Password Changed Successfully');
      });
  
      it('should throw BadRequestError if old password invalid', async () => {
        req.user = { user_id: 'u', user_name: 'name' };
        req.body = { oldPassword: 'old', password: 'new' };
        authService.changePasswordService.mockResolvedValue(false);
  
        await expect(changePasswordController(req, res)).rejects.toThrow(BadRequestError);
      });
    });
  
    describe('verfyUserController', () => {
      it('should verify user successfully', async () => {
        req.body = { user_name: 'user' };
        authService.verfyUserService.mockResolvedValue(true);
  
        await verfyUserController(req, res);
  
        expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, {}, 'Verified User Successfully');
      });
  
      it('should throw BadRequestError if user invalid', async () => {
        req.body = { user_name: 'user' };
        authService.verfyUserService.mockResolvedValue(false);
  
        await expect(verfyUserController(req, res)).rejects.toThrow(BadRequestError);
      });
    });
  
    describe('verfyOtpController', () => {
      it('should verify OTP successfully', async () => {
        req.body = { otp: '1234' };
        authService.verfyOtpService.mockResolvedValue({ otp: 'ok' });
  
        await verfyOtpController(req, res);
  
        expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, { otp: 'ok' }, 'Verified Otp Successfully');
      });
  
      it('should throw BadRequestError if OTP invalid', async () => {
        req.body = { otp: '1234' };
        authService.verfyOtpService.mockResolvedValue(false);
  
        await expect(verfyOtpController(req, res)).rejects.toThrow(BadRequestError);
      });
    });
  
    describe('forgetPasswordController', () => {
      it('should reset password successfully', async () => {
        req.body = { password: 'new', user_id: 'u' };
        authService.forgetPasswordService.mockResolvedValue(true);
  
        await forgetPasswordController(req, res);
  
        expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, {}, 'Password Reset Successfully');
      });
  
      it('should throw BadRequestError if user invalid', async () => {
        req.body = { password: 'new', user_id: 'u' };
        authService.forgetPasswordService.mockResolvedValue(false);
  
        await expect(forgetPasswordController(req, res)).rejects.toThrow(BadRequestError);
      });
    });
  
    describe('getUserRoleController', () => {
      it('should fetch user role successfully', async () => {
        req.query = { userName: 'user' };
        authService.getUserRoleService.mockResolvedValue('admin');
  
        await getUserRoleController(req, res);
  
        expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, 'admin', 'User role fetched successfully');
      });
    });
  });
  