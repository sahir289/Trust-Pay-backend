import request from 'supertest';
import express from 'express';
import chargebackRouter from './index.js';

jest.mock('./chargeBackController.js', () => ({
  createChargeBack: jest.fn((req, res) => res.status(201).json({ message: 'created' })),
  deleteChargeBack: jest.fn((req, res) => res.status(200).json({ message: 'deleted' })),
  getChargeBacks: jest.fn((req, res) => res.status(200).json({ message: 'reports' })),
  updateChargeBack: jest.fn((req, res) => res.status(200).json({ message: 'updated' })),
  getChargeBacksById: jest.fn((req, res) => res.status(200).json({ message: 'byId' })),
  getChargeBacksBySearch: jest.fn((req, res) => res.status(200).json({ message: 'search' })),
  blockChargebackUser: jest.fn((req, res) => res.status(200).json({ message: 'blocked' })),
}));

import * as mockControllers from './chargeBackController.js';

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
    app.use('/chargeBacks', chargebackRouter);
  });

  test('GET /chargeBacks calls getChargeBacksBySearch', async () => {
    const res = await request(app).get('/chargeBacks');
    expect(res.status).toBe(200);
    expect(mockControllers.getChargeBacksBySearch).toHaveBeenCalled();
  });

  test('GET /chargeBacks/reports calls getChargeBacks', async () => {
    const res = await request(app).get('/chargeBacks/reports');
    expect(res.status).toBe(200);
    expect(mockControllers.getChargeBacks).toHaveBeenCalled();
  });

  test('GET /chargeBacks/:id calls getChargeBacksById', async () => {
    const res = await request(app).get('/chargeBacks/123');
    expect(res.status).toBe(200);
    expect(mockControllers.getChargeBacksById).toHaveBeenCalledWith(
      expect.objectContaining({ params: { id: '123' } }),
      expect.any(Object),
      expect.any(Function)
    );
  });

  test('POST /chargeBacks/create-chargeback calls createChargeBack', async () => {
    const res = await request(app)
      .post('/chargeBacks/create-chargeback')
      .send({ amount: 100, reason: 'test' });
    expect(res.status).toBe(201);
    expect(mockControllers.createChargeBack).toHaveBeenCalled();
  });

  test('PUT /chargeBacks/update-chargeback/:id calls updateChargeBack', async () => {
    const res = await request(app)
      .put('/chargeBacks/update-chargeback/1')
      .send({ amount: 150, reason: 'updated' });
    expect(res.status).toBe(200);
    expect(mockControllers.updateChargeBack).toHaveBeenCalled();
  });

  test('PUT /chargeBacks/blockuser-chargeback/:id calls blockChargebackUser', async () => {
    const res = await request(app).put('/chargeBacks/blockuser-chargeback/1');
    expect(res.status).toBe(200);
    expect(mockControllers.blockChargebackUser).toHaveBeenCalled();
  });

  test('DELETE /chargeBacks/delete-chargeback/:id calls deleteChargeBack', async () => {
    const res = await request(app).delete('/chargeBacks/delete-chargeback/1');
    expect(res.status).toBe(200);
    expect(mockControllers.deleteChargeBack).toHaveBeenCalled();
  });
});
