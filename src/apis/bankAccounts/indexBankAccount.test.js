import request from 'supertest';
import express from 'express';
import bankAccountRouter from './index.js';

// Mock the controller functions
jest.mock('./bankaccountController.js', () => ({
  createBankaccount: jest.fn((req, res) =>
    res.status(201).json({ message: 'Bank account created' })
  ),
  deleteBankaccount: jest.fn((req, res) =>
    res.status(200).json({ message: 'Bank account deleted' })
  ),
  getBankaccountById: jest.fn((req, res) =>
    res.status(200).json({ id: req.params.id, name: 'Account Name' })
  ),
  getBankaccount: jest.fn((req, res) =>
    res.status(200).json([{ id: 1, name: 'Account 1' }])
  ),
  updateBankaccount: jest.fn((req, res) =>
    res.status(200).json({ id: req.params.id, name: 'Updated Account' })
  ),
  getBankaccountNickName: jest.fn((req, res) =>
    res.status(200).json(['Nickname 1', 'Nickname 2'])
  ),
  getBankAccountBySearch: jest.fn((req, res) =>
    res.status(200).json([{ id: 2, name: 'Searched Account' }])
  ),
}));

// Mock the auth middlewares
jest.mock('../../middlewares/auth.js', () => ({
  isAuthenticated: (req, res, next) => next(),
  authorized: () => (req, res, next) => next(),
}));

describe('Bank Account Routes', () => {
  let app;
  const controller = require('./bankaccountController.js');

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/bankAccounts', bankAccountRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /bankAccounts/get should return all bank accounts', async () => {
    const res = await request(app).get('/bankAccounts/get');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1, name: 'Account 1' }]);
    expect(controller.getBankaccount).toHaveBeenCalled();
  });

  test('GET /bankAccounts should return search results', async () => {
    const res = await request(app).get('/bankAccounts');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 2, name: 'Searched Account' }]);
    expect(controller.getBankAccountBySearch).toHaveBeenCalled();
  });

  test('GET /bankAccounts/banknames should return bank account nicknames', async () => {
    const res = await request(app).get('/bankAccounts/banknames');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(['Nickname 1', 'Nickname 2']);
    expect(controller.getBankaccountNickName).toHaveBeenCalled();
  });

  test('GET /bankAccounts/:id should return a bank account by ID', async () => {
    const res = await request(app).get('/bankAccounts/123');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: '123', name: 'Account Name' });
    expect(controller.getBankaccountById).toHaveBeenCalledWith(
      expect.any(Object), // req
      expect.any(Object)  // res
    );
  });

  test('POST /bankAccounts/create-bank should create a new bank account', async () => {
    const res = await request(app)
      .post('/bankAccounts/create-bank')
      .send({ name: 'New Account' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: 'Bank account created' });
    expect(controller.createBankaccount).toHaveBeenCalled();
  });

  test('PUT /bankAccounts/update-bank/:id should update a bank account', async () => {
    const res = await request(app)
      .put('/bankAccounts/update-bank/456')
      .send({ name: 'Updated Account' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: '456', name: 'Updated Account' });
    expect(controller.updateBankaccount).toHaveBeenCalled();
  });

  test('DELETE /bankAccounts/delete-bank/:id should delete a bank account', async () => {
    const res = await request(app).delete('/bankAccounts/delete-bank/789');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Bank account deleted' });
    expect(controller.deleteBankaccount).toHaveBeenCalled();
  });
});
