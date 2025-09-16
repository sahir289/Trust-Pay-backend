import request from 'supertest';
import express from 'express';
import chargebackRouter from './index.js';

import { expect, describe, test ,beforeAll } from '@jest/globals';

jest.mock('./userController.js', () => ({
    getUsers: jest.fn((req, res) => res.status(201).json({ message: 'created' })),
    getUsersBySearch: jest.fn((req, res) => res.status(200).json({ message: 'deleted' })),
    getUsersByUserName: jest.fn((req, res) => res.status(200).json({ message: 'reports' })),
    getUserById: jest.fn((req, res) => res.status(200).json({ message: 'updated' })),
    createUser: jest.fn((req, res) => res.status(200).json({ message: 'byId' })),
    updateUser: jest.fn((req, res) => res.status(200).json({ message: 'search' })),
    sendMail: jest.fn((req, res) => res.status(200).json({ message: 'blocked' })),
}));
jest.mock('../../utils/sockets.js', () => ({
  newTableEntry: jest.fn().mockResolvedValue(),
}));
import * as mockControllers from './userController.js';

jest.mock('../../middlewares/auth.js', () => ({
  isAuthenticated: (req, res, next) => next(),
  authorized: () => (req, res, next) => next(),
}));

jest.mock('../../utils/index.js', () => ({
  multerUpload: {
    single: () => (req, res, next) => next(),
  },
}));

jest.mock('../../utils/tryCatchHandler.js', () => (fn) => (req, res, next) => fn(req, res, next));

describe('Chargeback Routes', () => {
    let app;
    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/User', chargebackRouter);
    });

    test('GET /User calls getUsersBySearch', async () => {
        const res = await request(app).get('/User');
        expect(res.status).toBe(200);
        expect(mockControllers.getUsersBySearch).toHaveBeenCalled();
    });


    test('GET /User/:id calls getUserById', async () => {
        const res = await request(app).get('/User/123');
        expect(res.status).toBe(200);
        expect(mockControllers.getUserById).toHaveBeenCalledWith(
        expect.objectContaining({ params: { id: '123' } }),
        expect.any(Object),
        expect.any(Function)
        );
    });

    test('POST /User/create-User calls createUser', async () => {
        const res = await request(app)
        .post('/User/create-User')
        .send({ amount: 100, reason: 'test' });
        expect(res.status).toBe(200);
        expect(mockControllers.createUser).toHaveBeenCalled();
    });

    test('PUT /User/update-User/:id calls updateUser', async () => {
        const res = await request(app)
        .put('/User/update-User/1')
        .send({ amount: 150, reason: 'updated' });
        expect(res.status).toBe(200);
        expect(mockControllers.updateUser).toHaveBeenCalled();
    });
    test('POST /User/send-mail calls sendMail', async () => {
        const res = await request(app)
        .post('/User/send-mail')
        .send({ email: 'ABCD@gmail.com', subject: 'test', body: 'body' });
        expect(res.status).toBe(200);  
        expect(mockControllers.sendMail).toHaveBeenCalled();
    });
});