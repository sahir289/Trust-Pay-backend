import request from 'supertest';
import express from 'express';
import reports from './index.js';

// Mock the controllers
jest.mock('./reportsController.js', () => ({
  getPayOutReportController: jest.fn((req, res) =>
    res.status(201).json({ message: 'reports created' })
  ),
  getPayInReportController: jest.fn((req, res) =>
    res.status(200).json({ message: 'Get reports successfully' })
  ),
  getClientsAccountReportController: jest.fn((req, res) =>
    res.status(200).json({ message: 'Get reports successfully' })
  ),
}));

// Mock the auth middleware
jest.mock('../../middlewares/auth.js', () => ({
  isAuthenticated: jest.fn((req, res, next) => next()),
  authorized: () => (req, res, next) => next(),
}));

describe('Reports Routes', () => {
  let app;
  const authMiddleware = require('../../middlewares/auth.js');
  const controller = require('./reportsController.js');

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/reports', reports);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authMiddleware.isAuthenticated.mockImplementation((req, res, next) => next());
  });

  describe('GET /reports/get-payouts-report', () => {
    test('should return payout reports successfully', async () => {
      const res = await request(app).get('/reports/get-payouts-report');
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ message: 'reports created' });
      expect(controller.getPayOutReportController).toHaveBeenCalled();
    });

    test('should handle errors from getPayOutReportController', async () => {
      controller.getPayOutReportController.mockImplementation(() => {
        throw new Error('Internal server error');
      });
      const res = await request(app).get('/reports/get-payouts-report');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({}); // Align with other tests
    });

    test('should block unauthenticated requests', async () => {
      authMiddleware.isAuthenticated.mockImplementation((req, res) =>
        res.status(401).json({ error: 'Unauthorized' })
      );
      const res = await request(app).get('/reports/get-payouts-report');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Unauthorized' });
      expect(controller.getPayOutReportController).not.toHaveBeenCalled();
    });
  });

  describe('GET /reports/get-payins-reports', () => {
    test('should return pay-in reports successfully', async () => {
      const res = await request(app).get('/reports/get-payins-reports');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Get reports successfully' });
      expect(controller.getPayInReportController).toHaveBeenCalled();
    });

    test('should handle errors from getPayInReportController', async () => {
      controller.getPayInReportController.mockImplementation(() => {
        throw new Error('Internal server error');
      });
      const res = await request(app).get('/reports/get-payins-reports');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({});
    });

    test('should block unauthenticated requests', async () => {
      authMiddleware.isAuthenticated.mockImplementation((req, res) =>
        res.status(401).json({ error: 'Unauthorized' })
      );
      const res = await request(app).get('/reports/get-payins-reports');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Unauthorized' });
      expect(controller.getPayInReportController).not.toHaveBeenCalled();
    });
  });

  describe('GET /reports/get-accounts-reports', () => {
    test('should return merchant reports successfully', async () => {
      const res = await request(app).get('/reports/get-accounts-reports');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Get reports successfully' });
      expect(controller.getClientsAccountReportController).toHaveBeenCalled();
    });

    test('should handle errors from getClientsAccountReportController', async () => {
      controller.getClientsAccountReportController.mockImplementation(() => {
        throw new Error('Internal server error');
      });
      const res = await request(app).get('/reports/get-accounts-reports'); 
      expect(res.status).toBe(500);
      expect(res.body).toEqual({});
    });

    test('should block unauthenticated requests', async () => {
      authMiddleware.isAuthenticated.mockImplementation((req, res) =>
        res.status(401).json({ error: 'Unauthorized' })
      );
      const res = await request(app).get('/reports/get-accounts-reports');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Unauthorized' });
      expect(controller.getClientsAccountReportController).not.toHaveBeenCalled();
    });
  });

  describe('Invalid Routes', () => {
    test('should return 404 for undefined routes', async () => {
      const res = await request(app).get('/reports/invalid-route');
      expect(res.status).toBe(404);
    });
  });
});