import request from 'supertest';
import express from 'express';
import resetHistory from './index.js';

jest.mock('./resetController.js', () => ({
  createResetHistory: jest.fn((req, res) =>
    res.status(201).json({ message: 'resetHistory created', data: { id: 1 } })
  ),
  getResetHistoryBySearch: jest.fn((req, res) =>
    res.status(200).json({ message: 'Get resetHistory successfully', data: [] })
  ),
  updateResetHistory: jest.fn((req, res) =>
    res.status(200).json({ message: 'resetHistory updated successfully', data: { id: req.params.id } })
  ),
  deleteResetHistory: jest.fn((req, res) =>
    res.status(200).json({ message: 'resetHistory deleted successfully', data: { id: req.params.id } })
  ),
}));

jest.mock('../../middlewares/auth.js', () => ({
  isAuthenticated: (req, res, next) => next(),
  authorized: () => (req, res, next) => next(),
}));

describe('resetHistory Routes', () => {
  let app;
  const controller = require('./resetController.js');

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/resetHistory', resetHistory);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });


  test('GET /resetHistory should return all resetHistory', async () => {
    const res = await request(app).get('/resetHistory');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Get resetHistory successfully', data: [] });
    expect(controller.getResetHistoryBySearch).toHaveBeenCalled();
  });


  test('POST /resetHistory/create-ResetHistory should create a new resetHistory', async () => {
    const payload = { ResetHistoryName: 'Tech Solutions Ltd.' };
    const res = await request(app).post('/resetHistory/create-ResetHistory').send(payload);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: 'resetHistory created', data: { id: 1 } });
    expect(controller.createResetHistory).toHaveBeenCalled();
  });

  test('POST /resetHistory/update-ResetHistory/:id should update resetHistory', async () => {
    const payload = { ResetHistoryName: 'Updated Name' };
    const id = '123';
    const res = await request(app).post(`/resetHistory/update-ResetHistory/${id}`).send(payload);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'resetHistory updated successfully', data: { id } });
    expect(controller.updateResetHistory).toHaveBeenCalled();
  });

  test('DELETE /resetHistory/delete-ResetHistory/:id should delete resetHistory', async () => {
    const id = '456';
    const res = await request(app).delete(`/resetHistory/delete-ResetHistory/${id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'resetHistory deleted successfully', data: { id } });
    expect(controller.deleteResetHistory).toHaveBeenCalled();
  });
});
