import { expect, describe, beforeEach, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';

jest.mock('../../utils/tryCatchHandler.js', () => ({
  __esModule: true,
  default: (handler) => handler,
}));

const mockCreatePayout = jest.fn((req, res) => res.status(201).json({ ok: true, route: 'createPayout' }));
const mockDeletePayout = jest.fn((req, res) => res.status(200).json({ ok: true, route: 'deletePayout' }));
const mockGetPayouts = jest.fn((req, res) => res.status(200).json({ ok: true, route: 'getPayouts' }));
const mockUpdatePayout = jest.fn((req, res) => res.status(200).json({ ok: true, route: 'updatePayout' }));
const mockGetPayoutsById = jest.fn((req, res) => res.status(200).json({ ok: true, route: 'getPayoutsById', id: req.params.id }));
const mockGetPayoutsBySearch = jest.fn((req, res) => res.status(200).json({ ok: true, route: 'getPayoutsBySearch' }));
const mockCheckPayOutStatus = jest.fn((req, res) => res.status(200).json({ ok: true, route: 'checkPayOutStatus' }));
const mockWalletsPayouts = jest.fn((req, res) => res.status(201).json({ ok: true, route: 'walletsPayouts' }));
const mockAssignedPayout = jest.fn((req, res) => res.status(200).json({ ok: true, route: 'assignedPayout' }));
const mockGetWalletsBalance = jest.fn((req, res) => res.status(200).json({ ok: true, route: 'getWalletsBalance' }));
const mockTataPayPayouts = jest.fn((req, res) => res.status(201).json({ ok: true, route: 'tataPayPayouts' }));
const mockGetTataPayBalance = jest.fn((req, res) => res.status(200).json({ ok: true, route: 'getTataPayBalance' }));

jest.mock('./payOutController.js', () => ({
  __esModule: true,
  createPayout: (...args) => mockCreatePayout(...args),
  deletePayout: (...args) => mockDeletePayout(...args),
  getPayouts: (...args) => mockGetPayouts(...args),
  updatePayout: (...args) => mockUpdatePayout(...args),
  getPayoutsById: (...args) => mockGetPayoutsById(...args),
  getPayoutsBySearch: (...args) => mockGetPayoutsBySearch(...args),
  checkPayOutStatus: (...args) => mockCheckPayOutStatus(...args),
  walletsPayouts: (...args) => mockWalletsPayouts(...args),
  assignedPayout: (...args) => mockAssignedPayout(...args),
  getWalletsBalance: (...args) => mockGetWalletsBalance(...args),
  tataPayPayouts: (...args) => mockTataPayPayouts(...args),
  getTataPayBalance: (...args) => mockGetTataPayBalance(...args),
}));

jest.mock('../../middlewares/auth.js', () => ({
  __esModule: true,
  authorized: () => (req, res, next) => next(),
  isAuthenticated: (req, res, next) => next(),
}));

jest.mock('../../constants/index.js', () => ({
  __esModule: true,
  AccessRoles: {
    PAYOUT: 'PAYOUT',
    MERCHANT: 'MERCHANT', // Added to fix undefined error
  },
}));

const mockPayAssistCallback = jest.fn((req, res) => res.status(200).json({ ok: true, route: 'payAssistCallback' }));
const mockTataPayCallback = jest.fn((req, res) => res.status(200).json({ ok: true, route: 'tataPayCallback' }));
jest.mock('../../callBacksAndWebHook/callBacks/payAsistWebHook.js', () => ({
  __esModule: true,
  payAssistTransactionStatusCallback: (...args) => mockPayAssistCallback(...args),
}));
jest.mock('../../callBacksAndWebHook/callBacks/tataPayWebHook.js', () => ({
  __esModule: true,
  tataPayTransactionStatusCallback: (...args) => mockTataPayCallback(...args),
}));

jest.mock('../../utils/db.js', () => ({
  createPool: jest.fn(() => ({
    connect: jest.fn(),
    on: jest.fn(),
    end: jest.fn(),
    query: jest.fn(),
  })),
}));

import routerModule from './index.js';
const router = routerModule.default || routerModule;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/payout', router);
  app.use((err, req, res) => {
    const status = err?.status || 500;
    res.status(status).json({ ok: false, message: err?.message || 'internal error' });
  });
  return app;
}

describe('payout index router - ESM tests', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  test('GET /payout/ calls getPayoutsBySearch', async () => {
    const res = await request(app).get('/payout/');
    expect(res.status).toBe(200);
    expect(res.body.route).toBe('getPayoutsBySearch');
    expect(mockGetPayoutsBySearch).toHaveBeenCalled();
  });

  test('GET /payout/reports calls getPayouts', async () => {
    const res = await request(app).get('/payout/reports');
    expect(res.status).toBe(200);
    expect(res.body.route).toBe('getPayouts');
    expect(mockGetPayouts).toHaveBeenCalled();
  });

  test('GET /payout/wallets-balance calls getWalletsBalance', async () => {
    const res = await request(app).get('/payout/wallets-balance');
    expect(res.status).toBe(200);
    expect(res.body.route).toBe('getWalletsBalance');
    expect(mockGetWalletsBalance).toHaveBeenCalled();
  });

  test('GET /payout/tatapay-balance calls getTataPayBalance', async () => {
    const res = await request(app).get('/payout/tatapay-balance');
    expect(res.status).toBe(200);
    expect(res.body.route).toBe('getTataPayBalance');
    expect(mockGetTataPayBalance).toHaveBeenCalled();
  });

  test('GET /payout/:id calls getPayoutsById', async () => {
    const res = await request(app).get('/payout/abc123');
    expect(res.status).toBe(200);
    expect(res.body.route).toBe('getPayoutsById');
    expect(res.body.id).toBe('abc123');
    expect(mockGetPayoutsById).toHaveBeenCalled();
  });

  test('POST /payout/create-payout calls createPayout', async () => {
    const res = await request(app).post('/payout/create-payout').send({ a: 1 });
    expect(res.status).toBe(201);
    expect(res.body.route).toBe('createPayout');
    expect(mockCreatePayout).toHaveBeenCalled();
  });

  test('POST /payout/generate-payout calls createPayout', async () => {
    const res = await request(app).post('/payout/generate-payout').send({ a: 1 });
    expect(res.status).toBe(201);
    expect(res.body.route).toBe('createPayout');
    expect(mockCreatePayout).toHaveBeenCalled();
  });

  test('POST /payout/check-payout-status calls checkPayOutStatus', async () => {
    const res = await request(app).post('/payout/check-payout-status').send({ payoutId: 'p1' });
    expect(res.status).toBe(200);
    expect(res.body.route).toBe('checkPayOutStatus');
    expect(mockCheckPayOutStatus).toHaveBeenCalled();
  });

  test('PUT /payout/update-payout/:id calls updatePayout', async () => {
    const res = await request(app).put('/payout/update-payout/55').send({ amount: 5 });
    expect(res.status).toBe(200);
    expect(res.body.route).toBe('updatePayout');
    expect(mockUpdatePayout).toHaveBeenCalled();
  });

  test('PUT /payout/assign-vendor-payout/:id calls assignedPayout', async () => {
    const res = await request(app).put('/payout/assign-vendor-payout/2').send({ payouts_ids: [1] });
    expect(res.status).toBe(200);
    expect(res.body.route).toBe('assignedPayout');
    expect(mockAssignedPayout).toHaveBeenCalled();
  });

  test('DELETE /payout/delete-payout/:id calls deletePayout', async () => {
    const res = await request(app).delete('/payout/delete-payout/77');
    expect(res.status).toBe(200);
    expect(res.body.route).toBe('deletePayout');
    expect(mockDeletePayout).toHaveBeenCalled();
  });

  test('POST /payout/wallets calls walletsPayouts', async () => {
    const res = await request(app).post('/payout/wallets').send({ payOutids: [1], mode: 'IMPS' });
    expect(res.status).toBe(201);
    expect(res.body.route).toBe('walletsPayouts');
    expect(mockWalletsPayouts).toHaveBeenCalled();
  });

  test('POST /payout/tatapay-payouts calls tataPayPayouts', async () => {
    const res = await request(app).post('/payout/tatapay-payouts').send({ payOutids: [1] });
    expect(res.status).toBe(201);
    expect(res.body.route).toBe('tataPayPayouts');
    expect(mockTataPayPayouts).toHaveBeenCalled();
  });

  test('POST /payout/payassist-callback calls payAssistTransactionStatusCallback', async () => {
    const res = await request(app).post('/payout/payassist-callback').send({ cb: true });
    expect(res.status).toBe(200);
    expect(res.body.route).toBe('payAssistCallback');
    expect(mockPayAssistCallback).toHaveBeenCalled();
  });

  test('POST /payout/tatapay-callback calls tataPayTransactionStatusCallback', async () => {
    const res = await request(app).post('/payout/tatapay-callback').send({ cb: true });
    expect(res.status).toBe(200);
    expect(res.body.route).toBe('tataPayCallback');
    expect(mockTataPayCallback).toHaveBeenCalled();
  });
});