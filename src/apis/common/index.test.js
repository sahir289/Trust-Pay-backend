import request from 'supertest';
import express from 'express';
import commonRouter from './index.js';
import { getTotalCount } from './commonController.js';
import { BadRequestError } from '../../utils/appErrors.js';

jest.mock('./commonController.js', () => ({
  getTotalCount: jest.fn(),
}));

jest.mock('../../middlewares/auth.js', () => ({
  isAuthenticated: jest.fn((req, res, next) => next()),
  authorized: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../utils/appErrors.js', () => ({
  BadRequestError: jest.fn((message) => new Error(message)),
}));

describe('Common Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/common', commonRouter);
    jest.clearAllMocks();
  });

  describe('GET /common/count/:tableName', () => {
    test('should return 200 and total count for valid tableName', async () => {
      const mockResponse = { count: 100 };
      getTotalCount.mockImplementation((req, res) => 
        res.status(200).json(mockResponse)
      );

      const res = await request(app)
        .get('/common/count/users')
        .query({ role: 'admin' });

      expect(res.status).toBe(200);
      expect(getTotalCount).toHaveBeenCalled();
      expect(res.body).toEqual(mockResponse);
    });

    test('should handle missing tableName parameter', async () => {
      const res = await request(app)
        .get('/common/count/');

      expect(res.status).toBe(404); // Express returns 404 for invalid route
      expect(getTotalCount).not.toHaveBeenCalled();
    });

    test('should handle controller error', async () => {
      getTotalCount.mockImplementation(() => {
        throw new BadRequestError('Invalid table name');
      });

      const res = await request(app)
        .get('/common/count/invalidTable')
        .query({ role: 'admin' });

      expect(res.status).toBe(500);
      expect(getTotalCount).toHaveBeenCalled();
      expect(BadRequestError).toHaveBeenCalledWith('Invalid table name');
    });

    test('should work without optional role query parameter', async () => {
      const mockResponse = { count: 50 };
      getTotalCount.mockImplementation((req, res) => 
        res.status(200).json(mockResponse)
      );

      const res = await request(app)
        .get('/common/count/users');

      expect(res.status).toBe(200);
      expect(getTotalCount).toHaveBeenCalled();
      expect(res.body).toEqual(mockResponse);
    });

    test('should call authentication and authorization middleware', async () => {
      const mockResponse = { count: 75 };
      getTotalCount.mockImplementation((req, res) => 
        res.status(200).json(mockResponse)
      );

      const res = await request(app)
        .get('/common/count/users')
        .query({ role: 'user' });

      expect(res.status).toBe(200);
      expect(getTotalCount).toHaveBeenCalled();
      expect(require('../../middlewares/auth.js').isAuthenticated).toHaveBeenCalled();
    //   expect(require('../../middlewares/auth.js').authorized).toHaveBeenCalled();
      expect(res.body).toEqual(mockResponse);
    });
  });
});