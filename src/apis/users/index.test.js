/**
 * userindex.test.js
 *
 * Unit & integration tests for userindex.js (Express router)
 */

import request from 'supertest';
import express from 'express';
import userRouter from './index.js'; // your router
import { expect, describe, test, beforeAll, beforeEach } from '@jest/globals';

jest.mock('./userController.js', () => ({
  getUsers: jest.fn((req, res) => res.status(200).json({ message: 'getUsers called' })),
  getUsersBySearch: jest.fn((req, res) => res.status(200).json({ message: 'getUsersBySearch called' })),
  getUsersByUserName: jest.fn((req, res) => res.status(200).json({ message: 'getUsersByUserName called' })),
  getUserById: jest.fn((req, res) => res.status(200).json({ message: 'getUserById called' })),
  createUser: jest.fn((req, res) => res.status(200).json({ message: 'createUser called' })),
  updateUser: jest.fn((req, res) => res.status(200).json({ message: 'updateUser called' })),
  sendMail: jest.fn((req, res) => res.status(200).json({ message: 'sendMail called' })),
}));

import * as mockControllers from './userController.js';

jest.mock('../../middlewares/auth.js', () => ({
  isAuthenticated: (req, res, next) => next(),
  authorized: () => (req, res, next) => next(),
}));

jest.mock('../../utils/tryCatchHandler.js', () => (fn) => (req, res, next) => fn(req, res, next));

describe('User Router Integration', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/users', userRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /users/get calls getUsers', async () => {
    const res = await request(app).get('/users/get');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('getUsers called');
    expect(mockControllers.getUsers).toHaveBeenCalled();
  });

  test('GET /users calls getUsersBySearch', async () => {
    const res = await request(app).get('/users');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('getUsersBySearch called');
    expect(mockControllers.getUsersBySearch).toHaveBeenCalled();
  });

  test('GET /users/get-users-by-name calls getUsersByUserName', async () => {
    const res = await request(app).get('/users/get-users-by-name?username=john');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('getUsersByUserName called');
    expect(mockControllers.getUsersByUserName).toHaveBeenCalled();
  });

  test('GET /users/:id calls getUserById', async () => {
    const res = await request(app).get('/users/123');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('getUserById called');
    expect(mockControllers.getUserById).toHaveBeenCalledWith(
      expect.objectContaining({ params: { id: '123' } }),
      expect.any(Object),
      expect.any(Function)
    );
  });

  test('POST /users/create-user calls createUser', async () => {
    const res = await request(app)
      .post('/users/create-user')
      .send({ username: 'newuser' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('createUser called');
    expect(mockControllers.createUser).toHaveBeenCalled();
  });

  test('PUT /users/update-user/:id calls updateUser', async () => {
    const res = await request(app)
      .put('/users/update-user/1')
      .send({ username: 'updateduser' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('updateUser called');
    expect(mockControllers.updateUser).toHaveBeenCalled();
  });

  test('POST /users/send-mail calls sendMail', async () => {
    const res = await request(app)
      .post('/users/send-mail')
      .send({ email: 'abc@test.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('sendMail called');
    expect(mockControllers.sendMail).toHaveBeenCalled();
  });

  test('handles query parameters correctly on /users/get-users-by-name', async () => {
    await request(app).get('/users/get-users-by-name?username=testuser');
    expect(mockControllers.getUsersByUserName).toHaveBeenCalled();
  });

  // test('handles missing routes with 404', async () => {
  //   const res = await request(app).get('/users/nonexistent-route');
  //   expect(res.status).toBe(404);
  // });
});
