/**
 * @file authRoutes.test.js
 * Jest test cases for all routes in authRoutes.js
 */

import request from 'supertest';
import express from 'express';
import router from './index.js';

// ---- Mock Middlewares ----
jest.mock('../../middlewares/auth.js', () => ({
  isAuthenticated: (req, res, next) => {
    req.user = { id: 1 };
    next();
  }
}));

jest.mock('../../middlewares/loginLocationRestrict.js', () => ({
  geoLocationGuard: (req, res, next) => next()
}));

// ---- Mock Controllers ----
jest.mock('./authController.js', () => ({
  loginController: jest.fn((req, res) =>
    res.status(200).json({ message: 'login ok' })
  ),
  logoutController: jest.fn((req, res) =>
    res.status(200).json({ message: 'logout ok' })
  ),
  refreshTokenController: jest.fn((req, res) =>
    res.status(200).json({ message: 'refresh ok' })
  ),
  verificationController: jest.fn((req, res) =>
    res.status(200).json({ message: 'verification ok' })
  ),
  changePasswordController: jest.fn((req, res) =>
    res.status(200).json({ message: 'change ok' })
  ),
  verfyUserController: jest.fn((req, res) =>
    res.status(200).json({ message: 'verify user ok' })
  ),
  verfyOtpController: jest.fn((req, res) =>
    res.status(200).json({ message: 'verify otp ok' })
  ),
  forgetPasswordController: jest.fn((req, res) =>
    res.status(200).json({ message: 'forget ok' })
  ),
  getUserRoleController: jest.fn((req, res) =>
    res.status(200).json({ role: 'admin' })
  ),
}));

// create express app for testing
const app = express();
app.use(express.json());
app.use('/', router);

describe('Auth Routes Test Suite', () => {

  test('POST /login → should call loginController', async () => {
    const res = await request(app).post('/login').send({ email: 'a', password: 'b' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('login ok');
  });

  test('POST /refresh-token → should call refreshTokenController', async () => {
    const res = await request(app).post('/refresh-token').send({ token: '123' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('refresh ok');
  });

  test('GET /get-user-role → should return user role', async () => {
    const res = await request(app).get('/get-user-role');

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
  });

  test('POST /logout → should call logoutController', async () => {
    const res = await request(app).post('/logout');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('logout ok');
  });

  test('POST /otp_verification → should call verfyOtpController', async () => {
    const res = await request(app).post('/otp_verification').send({ otp: '9999' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('verify otp ok');
  });

  test('POST /reset_password → should call forgetPasswordController', async () => {
    const res = await request(app).post('/reset_password').send({ email: 'test@x.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('forget ok');
  });

  test('POST /user_verification → should call verfyUserController', async () => {
    const res = await request(app).post('/user_verification').send({ email: 'aa@bb.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('verify user ok');
  });

  test('POST /change-password → should call changePasswordController', async () => {
    const res = await request(app).post('/change-password').send({ old: '1', new: '2' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('change ok');
  });

  test('POST /password-verification → should call verificationController', async () => {
    const res = await request(app).post('/password-verification').send({ password: 'aaa' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('verification ok');
  });

});
