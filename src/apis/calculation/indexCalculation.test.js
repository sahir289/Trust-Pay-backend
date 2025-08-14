const express = require('express');
const request = require('supertest');
const router = require('./calculationRouter'); // Adjust path to your router file
const calculationController = require('./calculationController');
const authMiddleware = require('../../middlewares/auth');

jest.mock('./calculationController', () => ({
  getCalculation: jest.fn(),
  getCalculationById: jest.fn(),
  createCalculation: jest.fn(),
  updateCalculation: jest.fn(),
  deleteCalculation: jest.fn(),
  calculateSuccessRatios: jest.fn(),
}));

jest.mock('../../middlewares/auth', () => ({
  isAuthenticated: jest.fn((req, res, next) => next()),
  authorized: jest.fn(() => (req, res, next) => next()),
}));

describe('Calculation Router', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(router);
    jest.clearAllMocks();
  });

  describe('POST /success_ratio', () => {
    test('should call calculateSuccessRatios controller', async () => {
      const mockResponse = { success: true, data: { ratio: 0.75 } };
      calculationController.calculateSuccessRatios.mockImplementation((req, res) => {
        res.status(200).json(mockResponse);
      });

      const response = await request(app)
        .post('/success_ratio')
        .send({ data: 'test' });

      expect(calculationController.calculateSuccessRatios).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
    });
  });

  describe('GET /', () => {
    test('should call getCalculation controller with auth middleware', async () => {
      const mockCalculations = [
        { id: 1, formula: 'a + b', parameters: [1, 2], created_by: 1 },
      ];
      calculationController.getCalculation.mockImplementation((req, res) => {
        res.status(200).json(mockCalculations);
      });

      const response = await request(app).get('/');

      expect(authMiddleware.isAuthenticated).toHaveBeenCalled();
      expect(authMiddleware.authorized).toHaveBeenCalledWith('CALCULATION');
      expect(calculationController.getCalculation).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockCalculations);
    });
  });

  describe('GET /:user_id', () => {
    test('should call getCalculationById controller with auth middleware', async () => {
      const mockCalculation = { id: 1, formula: 'a + b', parameters: [1, 2], created_by: 1 };
      calculationController.getCalculationById.mockImplementation((req, res) => {
        res.status(200).json(mockCalculation);
      });

      const response = await request(app).get('/1');

      expect(authMiddleware.isAuthenticated).toHaveBeenCalled();
      expect(authMiddleware.authorized).toHaveBeenCalledWith('CALCULATION');
      expect(calculationController.getCalculationById).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockCalculation);
    });

    test('should return 404 if calculation not found', async () => {
      calculationController.getCalculationById.mockImplementation((req, res) => {
        res.status(404).json({ error: 'Calculation not found' });
      });

      const response = await request(app).get('/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Calculation not found' });
    });
  });

  describe('POST /create-calculation', () => {
    test('should call createCalculation controller with auth middleware', async () => {
      const mockCalculation = {
        id: 1,
        formula: 'a + b',
        parameters: [1, 2],
        created_by: 1,
      };
      calculationController.createCalculation.mockImplementation((req, res) => {
        res.status(201).json(mockCalculation);
      });

      const response = await request(app)
        .post('/create-calculation')
        .send({ formula: 'a + b', parameters: [1, 2], created_by: 1 });

      expect(authMiddleware.isAuthenticated).toHaveBeenCalled();
      expect(authMiddleware.authorized).toHaveBeenCalledWith('CALCULATION');
      expect(calculationController.createCalculation).toHaveBeenCalled();
      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockCalculation);
    });

    test('should return 400 for invalid request body', async () => {
      calculationController.createCalculation.mockImplementation((req, res) => {
        res.status(400).json({ error: 'Validation error' });
      });

      const response = await request(app)
        .post('/create-calculation')
        .send({ formula: '' }); // Invalid data

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Validation error' });
    });
  });

  describe('PUT /update-calculation/:id', () => {
    test('should call updateCalculation controller with auth middleware', async () => {
      const mockCalculation = {
        id: 1,
        formula: 'a + b',
        parameters: [1, 2],
        created_by: 1,
      };
      calculationController.updateCalculation.mockImplementation((req, res) => {
        res.status(200).json(mockCalculation);
      });

      const response = await request(app)
        .put('/update-calculation/1')
        .send({ formula: 'a + b', parameters: [1, 2] });

      expect(authMiddleware.isAuthenticated).toHaveBeenCalled();
      expect(authMiddleware.authorized).toHaveBeenCalledWith('CALCULATION');
      expect(calculationController.updateCalculation).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockCalculation);
    });

    test('should return 404 if calculation not found', async () => {
      calculationController.updateCalculation.mockImplementation((req, res) => {
        res.status(404).json({ error: 'Calculation not found' });
      });

      const response = await request(app)
        .put('/update-calculation/999')
        .send({ formula: 'a + b', parameters: [1, 2] });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Calculation not found' });
    });
  });

  describe('DELETE /delete-calculation/:id', () => {
    test('should call deleteCalculation controller with auth middleware', async () => {
      calculationController.deleteCalculation.mockImplementation((req, res) => {
        res.status(200).json({ message: 'Calculation deleted successfully' });
      });

      const response = await request(app).delete('/delete-calculation/1');

      expect(authMiddleware.isAuthenticated).toHaveBeenCalled();
      expect(authMiddleware.authorized).toHaveBeenCalledWith('CALCULATION');
      expect(calculationController.deleteCalculation).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Calculation deleted successfully' });
    });

    test('should return 404 if calculation not found', async () => {
      calculationController.deleteCalculation.mockImplementation((req, res) => {
        res.status(404).json({ error: 'Calculation not found' });
      });

      const response = await request(app).delete('/delete-calculation/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Calculation not found' });
    });
  });
});