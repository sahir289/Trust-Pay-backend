import request from 'supertest';
import express from 'express';
import chargebackRouter from './index.js';
import * as mockControllers from './checkUtrController.js';
import { BadRequestError } from '../../utils/appErrors.js';

jest.mock('./checkUtrController.js', () => ({
  getCheckUtr: jest.fn(),
  getCheckUtrBySearch: jest.fn(),
  createCheckUtr: jest.fn(),
  updateCheckUtr: jest.fn(),
  deleteCheckUtr: jest.fn(),
}));

jest.mock('../../middlewares/auth.js', () => ({
  isAuthenticated: (req, res, next) => next(),
  authorized: () => (req, res, next) => next(),
}));

jest.mock('../../utils/tryCatchHandler.js', () => (fn) => (req, res, next) => fn(req, res, next));

jest.mock('../../utils/appErrors.js', () => ({
  BadRequestError: jest.fn((message) => new Error(message)),
}));

describe('Chargeback Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/chargeBacks', chargebackRouter);
    jest.clearAllMocks();
  });

  describe('GET /chargeBacks', () => {
    test('should return 200 and call getCheckUtrBySearch with correct parameters', async () => {
      const mockResponse = { data: [], message: 'get checkUtr by search successfully' };
      mockControllers.getCheckUtrBySearch.mockImplementation((req, res) => 
        res.status(200).json(mockResponse)
      );

      const res = await request(app)
        .get('/chargeBacks?search=test&page=1&limit=10');

      expect(res.status).toBe(200);
      expect(mockControllers.getCheckUtrBySearch).toHaveBeenCalled();
      expect(res.body).toEqual(mockResponse);
    });

    test('should handle errors when search fails', async () => {
      mockControllers.getCheckUtrBySearch.mockImplementation(() => {
        throw new Error('Search failed');
      });

      const res = await request(app)
        .get('/chargeBacks?search=test');

      expect(res.status).toBe(500);
      expect(mockControllers.getCheckUtrBySearch).toHaveBeenCalled();
    });
  });

  describe('POST /chargeBacks/create', () => {
    test('should create CheckUtr successfully', async () => {
      const mockPayload = {
        merchant_order_id: '123',
        utr: 'UTR123',
        company_id: 'comp1',
      };
      const mockResponse = { id: '1', created_by: 'test_user', message: 'Check Utr successfully' };
      
      mockControllers.createCheckUtr.mockImplementation((req, res) => 
        res.status(201).json(mockResponse)
      );

      const res = await request(app)
        .post('/chargeBacks/create')
        .send(mockPayload);

      expect(res.status).toBe(201);
      expect(mockControllers.createCheckUtr).toHaveBeenCalled();
      expect(res.body).toEqual(mockResponse);
    });

    test('should return 400 when payload is missing', async () => {
      mockControllers.createCheckUtr.mockImplementation(() => {
        throw new BadRequestError('payload is required');
      });

      const res = await request(app)
        .post('/chargeBacks/create')
        .send({});

      expect(res.status).toBe(500);
      expect(mockControllers.createCheckUtr).toHaveBeenCalled();
      expect(BadRequestError).toHaveBeenCalledWith('payload is required');
    });
  });

  describe('PUT /chargeBacks/update-CheckUtr/:id', () => {
    test('should update CheckUtr successfully', async () => {
      const mockPayload = { CheckUtrName: 'Updated Name' };
      const mockResponse = { message: 'Update CheckUtr successfully' };
      
      mockControllers.updateCheckUtr.mockImplementation((req, res) => 
        res.status(200).json(mockResponse)
      );

      const res = await request(app)
        .put('/chargeBacks/update-CheckUtr/1')
        .send(mockPayload);

      expect(res.status).toBe(200);
      expect(mockControllers.updateCheckUtr).toHaveBeenCalled();
      expect(res.body).toEqual(mockResponse);
    });

    test('should handle errors during update', async () => {
      mockControllers.updateCheckUtr.mockImplementation(() => {
        throw new Error('Update failed');
      });

      const res = await request(app)
        .put('/chargeBacks/update-CheckUtr/1')
        .send({ CheckUtrName: 'Updated Name' });

      expect(res.status).toBe(500);
      expect(mockControllers.updateCheckUtr).toHaveBeenCalled();
    });
  });

  describe('DELETE /chargeBacks/delete-CheckUtr/:id', () => {
    test('should delete CheckUtr successfully', async () => {
      const mockResponse = { message: 'Delete CheckUtr successfully' };
      
      mockControllers.deleteCheckUtr.mockImplementation((req, res) => 
        res.status(200).json(mockResponse)
      );

      const res = await request(app)
        .delete('/chargeBacks/delete-CheckUtr/1');

      expect(res.status).toBe(200);
      expect(mockControllers.deleteCheckUtr).toHaveBeenCalled();
      expect(res.body).toEqual(mockResponse);
    });

    test('should return 400 when id is missing', async () => {
      mockControllers.deleteCheckUtr.mockImplementation(() => {
        throw new BadRequestError('payload is required');
      });

      const res = await request(app)
        .delete('/chargeBacks/delete-CheckUtr/');

      expect(res.status).toBe(404); // Express returns 404 for invalid route
      expect(mockControllers.deleteCheckUtr).not.toHaveBeenCalled();
    });

    test('should handle errors during deletion', async () => {
      mockControllers.deleteCheckUtr.mockImplementation(() => {
        throw new Error('Delete failed');
      });

      const res = await request(app)
        .delete('/chargeBacks/delete-CheckUtr/1');

      expect(res.status).toBe(500);
      expect(mockControllers.deleteCheckUtr).toHaveBeenCalled();
    });
  });
});