import request from 'supertest';
import express from 'express';
import calculationRouter from './index.js';

jest.mock('./calculationController.js', () => ({
  getCalculation: jest.fn((req, res) => res.status(200).json({ message: 'get' })),
  getCalculationById: jest.fn((req, res) => res.status(200).json({ message: 'getbyID' })),
  createCalculation: jest.fn((req, res) => res.status(201).json({ message: 'created' })),
  updateCalculation: jest.fn((req, res) => res.status(200).json({ message: 'updated' })),
  deleteCalculation: jest.fn((req, res) => res.status(200).json({ message: 'deleted' })),
  calculateSuccessRatios: jest.fn((req, res) => res.status(200).json({ message: 'ratios' })),
}));

import * as mockControllers from './calculationController.js';

jest.mock('../../middlewares/auth.js', () => ({
  isAuthenticated: jest.fn((req, res, next) => next()),
  authorized: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../utils/tryCatchHandler.js', () => (fn) => (req, res, next) => fn(req, res, next));

describe('Calculation Routes', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/calculations', calculationRouter);
  });

  // beforeEach(() => {
  //   jest.clearAllMocks();
  // });

  test('POST /calculations/success_ratio calls calculateSuccessRatios', async () => {
    const res = await request(app)
      .post('/calculations/success_ratio')
      .send({ data: 'test' });
    expect(res.status).toBe(200);
    expect(mockControllers.calculateSuccessRatios).toHaveBeenCalled();
    expect(res.body).toEqual({ message: 'ratios' });
  });

  test('GET /calculations calls getCalculation', async () => {
    const res = await request(app).get('/calculations');
    expect(res.status).toBe(200);
    expect(mockControllers.getCalculation).toHaveBeenCalled();
    expect(mockControllers.getCalculation).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.any(Function)
    );
    expect(res.body).toEqual({ message: 'get' });
  });

  test('GET /calculations/:user_id calls getCalculationById', async () => {
    const res = await request(app).get('/calculations/1');
    expect(res.status).toBe(200);
    expect(mockControllers.getCalculationById).toHaveBeenCalledWith(
      expect.objectContaining({ params: { user_id: '1' } }),
      expect.any(Object),
      expect.any(Function)
    );
    expect(res.body).toEqual({ message: 'getbyID' });
  });

  test('POST /calculations/create-calculation calls createCalculation', async () => {
    const res = await request(app)
      .post('/calculations/create-calculation')
      .send({ formula: 'a + b', parameters: [1, 2], created_by: 1 });
    expect(res.status).toBe(201);
    expect(mockControllers.createCalculation).toHaveBeenCalled();
    expect(res.body).toEqual({ message: 'created' });
  });

  test('PUT /calculations/update-calculation/:id calls updateCalculation', async () => {
    const res = await request(app)
      .put('/calculations/update-calculation/1')
      .send({ formula: 'a + b', parameters: [1, 2] });
    expect(res.status).toBe(200);
    expect(mockControllers.updateCalculation).toHaveBeenCalled();
    expect(res.body).toEqual({ message: 'updated' });
  });

  test('DELETE /calculations/delete-calculation/:id calls deleteCalculation', async () => {
    const res = await request(app).delete('/calculations/delete-calculation/1');
    expect(res.status).toBe(200);
    expect(mockControllers.deleteCalculation).toHaveBeenCalled();
    expect(res.body).toEqual({ message: 'deleted' });
  });
});