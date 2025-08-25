import request from 'supertest';
import express from 'express';
import settlement from './index.js';

jest.mock('./settlementController.js', () => ({
  getSettlementControllerById: jest.fn((req, res) =>
    res.status(201).json({ message: 'Bank account created' })
  ),
  getSettlementController: jest.fn((req, res) =>
    res.status(200).json({ message: 'Get settlements successfully' })
  ),
  getSettlementsBySearch: jest.fn((req, res) =>
    res.status(200).json({ message: 'Get settlements successfully' })
  ),
  createSettlementController: jest.fn((req, res) =>
    res.status(201).json({ message: 'Settlement created successfully' })
  ),
  updateSettlementController: jest.fn((req, res) =>
    res.status(200).json({ message: 'Settlement updated successfully' })
  ),
  deleteSettlementController: jest.fn((req, res) =>
    res.status(200).json({ message: 'Settlement deleted successfully' })
  ),
}));

jest.mock('../../middlewares/auth.js', () => ({
  isAuthenticated: (req, res, next) => next(),
  authorized: () => (req, res, next) => next(),
}));

describe('Settlement Routes', () => {
  let app;
  const controller = require('./settlementController.js');

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/settlement', settlement);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /settlement should return all settlements', async () => {
    const res = await request(app).get('/settlement');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Get settlements successfully' });
    expect(controller.getSettlementsBySearch).toHaveBeenCalled();
  });

  test('GET /settlement/settlementReports should return settlement reports', async () => {
    const res = await request(app).get('/settlement/settlementReports');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Get settlements successfully' });
    expect(controller.getSettlementController).toHaveBeenCalled();
  });

  test('GET /settlement/:id should return a specific settlement', async () => {
    const res = await request(app).get('/settlement/1');
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: 'Bank account created' });
    expect(controller.getSettlementControllerById).toHaveBeenCalled();
  });

  test('POST /settlement/create-settlement should create a new settlement', async () => {
    const newSettlement = {
      utr: 'UTR123',
      amount: 100,
      method: 'INTERNAL_QR_TRANSFER',
      user_id: 1,
      company_id: 1,
      config: {
        debit_credit: 'RECEIVED',
        reference_id: 'UTR123',
      },
      updated_by: 1,
    };
    const res = await request(app)
      .post('/settlement/create-settlement')
      .send(newSettlement);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: 'Settlement created successfully' });
    expect(controller.createSettlementController).toHaveBeenCalled();
  });

  test('PUT /settlement/update-settlement/:id should update an existing settlement', async () => {
    const updatedSettlement = { settlementName: 'john_doe_updated' };
    const res = await request(app)
      .put('/settlement/update-settlement/1')
      .query(updatedSettlement);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Settlement updated successfully' });
    expect(controller.updateSettlementController).toHaveBeenCalled();
  });

  test('DELETE /settlement/delete-settlement/:id should delete a settlement', async () => {
    const res = await request(app).delete('/settlement/delete-settlement/1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Settlement deleted successfully' });
    expect(controller.deleteSettlementController).toHaveBeenCalled();
  });
});