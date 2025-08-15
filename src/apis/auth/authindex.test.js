import request from 'supertest';
import express from 'express';
import authRouter from './index.js';

jest.mock('./authController.js', () => ({
  loginController: jest.fn((req, res) =>
    res.status(201).json({ message: 'loginController' })
  ),
  refreshTokenController: jest.fn((req, res) =>
    res.status(201).json({ message: 'refreshTokenController' })
  ),
  logoutController: jest.fn((req, res) =>
    res.status(201).json({ message: 'logoutController' })
  ),
  verfyOtpController: jest.fn((req, res) => res.status(201).json({ message: 'verfyOtpController' })),
  forgetPasswordController: jest.fn((req, res) => res.status(201).json({ message: 'forgetPasswordController' })),
  verfyUserController: jest.fn((req, res) => res.status(201).json({ message: 'verfyUserController' })),
  changePasswordController: jest.fn((req, res) => res.status(201).json({ message: 'changePasswordController' })),
  verificationController: jest.fn((req, res) => res.status(201).json({ message: 'verificationController' })),
  getUserRoleController: jest.fn((req, res) => res.status(201).json({ message: 'getUserRoleController' })),
}));

jest.mock('../../middlewares/auth.js', () => ({
  isAuthenticated: jest.fn((req, res, next) => next()),
  authorized: () => (req, res, next) => next(),
}));

describe('Auth Router', () => {
    let app;
    const controller = require('./authController.js');
    const { isAuthenticated } = require('../../middlewares/auth.js'); 
  
    beforeAll(() => {
      app = express();
      app.use(express.json());
      app.use('/auth', authRouter); 
    });
  
    afterEach(() => {
      jest.clearAllMocks();
    });
  
    describe('POST /login', () => {
      it('should call loginController', async () => {
        const res = await request(app).post('/auth/login').send({ username: 'test', password: '1234' });
  
        expect(res.status).toBe(201);
        expect(res.body.message).toBe('loginController');
        expect(controller.loginController).toHaveBeenCalled();
      });
    });
  
    describe('POST /refresh-token', () => {
      it('should call refreshTokenController', async () => {
        const res = await request(app).post('/auth/refresh-token').send({ token: 'old-token' });
  
        expect(res.status).toBe(201);
        expect(res.body.message).toBe('refreshTokenController');
        expect(controller.refreshTokenController).toHaveBeenCalled();
      });
    });
  
    describe('GET /get-user-role', () => {
      it('should call getUserRoleController', async () => {
        const res = await request(app).get('/auth/get-user-role');
  
        expect(res.status).toBe(201);
        expect(res.body.message).toBe('getUserRoleController');
        expect(controller.getUserRoleController).toHaveBeenCalled();
      });
    });
  
    describe('POST /logout', () => {
      it('should call isAuthenticated and logoutController', async () => {
        const res = await request(app).post('/auth/logout');
  
        expect(isAuthenticated).toHaveBeenCalled();
        expect(res.status).toBe(201);
        expect(res.body.message).toBe('logoutController');
        expect(controller.logoutController).toHaveBeenCalled();
      });
    });
  
    describe('Other auth routes', () => {
      const routes = [
        { path: '/otp_verification', controllerName: 'verfyOtpController' },
        { path: '/reset_password', controllerName: 'forgetPasswordController' },
        { path: '/user_verification', controllerName: 'verfyUserController' },
        { path: '/change-password', controllerName: 'changePasswordController', auth: true },
        { path: '/password-verification', controllerName: 'verificationController', auth: true },
      ];
  
      routes.forEach(({ path, controllerName, auth }) => {
        it(`should call ${controllerName} ${auth ? 'with isAuthenticated' : ''}`, async () => {
          const res = await request(app).post(`/auth${path}`).send({});
  
          if (auth) expect(isAuthenticated).toHaveBeenCalled();
          expect(res.status).toBe(201);
          expect(res.body.message).toBe(controllerName);
          expect(controller[controllerName]).toHaveBeenCalled();
        });
      });
    });
  });
  
