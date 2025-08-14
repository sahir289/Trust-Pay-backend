import request from 'supertest';
import express from 'express';
import beneficiaryRoute from './index.js';

jest.mock('./beneficiaryAccountController.js', () => ({
  createBeneficiaryAccount: jest.fn((req, res) => res.status(201).json({ id: 1, bankName: 'test_account' })),
  deleteBeneficiaryAccount: jest.fn((req, res) => res.status(200).json({ message: 'Deleted successfully' })),
  getBeneficiaryAccountById: jest.fn((req, res) => res.status(200).json({ id: 1, bankAccountsname: 'test_account' })),
  getBeneficiaryAccount: jest.fn((req, res) => res.status(200).json([{ id: 1, bankAccountsname: 'test_account' }])),
  updateBeneficiaryAccount: jest.fn((req, res) => res.status(200).json({ id: 1, bankAccountsname: 'updated_account' })),
  getBeneficiaryAccountByBankName: jest.fn((req, res) => res.status(200).json([{ id: 1, bankAccountsname: 'test_account' }])),
  getBeneficiaryAccountBySearch: jest.fn((req, res) => res.status(200).json([{ id: 1, bankAccountsname: 'test_account' }])),
}));

jest.mock('../../middlewares/auth.js', () => ({
  isAuthenticated: (req, res, next) => next(),
  authorized: () => (req, res, next) => next(),
}));

jest.mock('../../utils/tryCatchHandler.js', () => (fn) => (req, res, next) => fn(req, res, next));

const app = express();
app.use(express.json());
app.use('/beneficiaryAccounts', beneficiaryRoute);

describe('Beneficiary Routes', () => {
  test('GET /beneficiaryAccounts/get calls getBeneficiaryAccount', async () => {
    const res = await request(app).get('/beneficiaryAccounts/get');
    expect(res.status).toBe(200);
    expect(require('./beneficiaryAccountController.js').getBeneficiaryAccount).toHaveBeenCalled();
  });

  test('GET /beneficiaryAccounts/ calls getBeneficiaryAccountBySearch', async () => {
    const res = await request(app).get('/beneficiaryAccounts/');
    expect(res.status).toBe(200);
    expect(require('./beneficiaryAccountController.js').getBeneficiaryAccountBySearch).toHaveBeenCalled();
  });

  test('GET /beneficiaryAccounts/beneficiarybanknames calls getBeneficiaryAccountByBankName', async () => {
    const res = await request(app).get('/beneficiaryAccounts/beneficiarybanknames');
    expect(res.status).toBe(200);
    expect(require('./beneficiaryAccountController.js').getBeneficiaryAccountByBankName).toHaveBeenCalled();
  });

  test('GET /beneficiaryAccounts/:id calls getBeneficiaryAccountById', async () => {
    const res = await request(app).get('/beneficiaryAccounts/1');
    expect(res.status).toBe(200);
    expect(require('./beneficiaryAccountController.js').getBeneficiaryAccountById).toHaveBeenCalled();
  });

  test('POST /beneficiaryAccounts/create-beneficiary calls createBeneficiaryAccount', async () => {
    const newAccount = { bankName: 'test_account', created_by: 1 };
    const res = await request(app)
      .post('/beneficiaryAccounts/create-beneficiary')
      .send(newAccount);
    expect(res.status).toBe(201);
    expect(require('./beneficiaryAccountController.js').createBeneficiaryAccount).toHaveBeenCalled();
  });

  test('PUT /beneficiaryAccounts/update-beneficiary/:id calls updateBeneficiaryAccount', async () => {
    const updatedAccount = { bankAccountsname: 'updated_account', updated_by: 1 };
    const res = await request(app)
      .put('/beneficiaryAccounts/update-beneficiary/1')
      .send(updatedAccount);
    expect(res.status).toBe(200);
    expect(require('./beneficiaryAccountController.js').updateBeneficiaryAccount).toHaveBeenCalled();
  });

  test('DELETE /beneficiaryAccounts/delete-beneficiary/:id calls deleteBeneficiaryAccount', async () => {
    const res = await request(app).delete('/beneficiaryAccounts/delete-beneficiary/1');
    expect(res.status).toBe(200);
    expect(require('./beneficiaryAccountController.js').deleteBeneficiaryAccount).toHaveBeenCalled();
  });
});