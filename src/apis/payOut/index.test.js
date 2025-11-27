import { expect, describe, beforeEach, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// ---- Mocks (Your Provided Mocks, Do Not Modify) ----
jest.mock('../../utils/tryCatchHandler.js', () => ({
  __esModule: true,
  default: (handler) => handler,
}));

const mockCreatePayout = jest.fn((req, res) =>
  res.status(201).json({ ok: true, route: 'createPayout' })
);
const mockDeletePayout = jest.fn((req, res) =>
  res.status(200).json({ ok: true, route: 'deletePayout' })
);
const mockGetPayouts = jest.fn((req, res) =>
  res.status(200).json({ ok: true, route: 'getPayouts' })
);
const mockUpdatePayout = jest.fn((req, res) =>
  res.status(200).json({ ok: true, route: 'updatePayout' })
);
const mockGetPayoutsById = jest.fn((req, res) =>
  res.status(200).json({ ok: true, route: 'getPayoutsById', id: req.params.id })
);
const mockGetPayoutsBySearch = jest.fn((req, res) =>
  res.status(200).json({ ok: true, route: 'getPayoutsBySearch' })
);
const mockCheckPayOutStatus = jest.fn((req, res) =>
  res.status(200).json({ ok: true, route: 'checkPayOutStatus' })
);
const mockWalletsPayouts = jest.fn((req, res) =>
  res.status(201).json({ ok: true, route: 'walletsPayouts' })
);
const mockAssignedPayout = jest.fn((req, res) =>
  res.status(200).json({ ok: true, route: 'assignedPayout' })
);
const mockGetWalletsBalance = jest.fn((req, res) =>
  res.status(200).json({ ok: true, route: 'getWalletsBalance' })
);
const mockTataPayPayouts = jest.fn((req, res) =>
  res.status(201).json({ ok: true, route: 'tataPayPayouts' })
);
const mockGetTataPayBalance = jest.fn((req, res) =>
  res.status(200).json({ ok: true, route: 'getTataPayBalance' })
);
const mockCreateTataPayBulkPayoutController = jest.fn((req, res) =>
  res.status(200).json({ ok: true, route: 'createTataPayBulkPayoutController' })
);

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
  createTataPayBulkPayoutController: (...args) => mockCreateTataPayBulkPayoutController(...args),
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
    MERCHANT: 'MERCHANT',
  },
}));

const mockPayAssistCallback = jest.fn((req, res) =>
  res.status(200).json({ ok: true, route: 'payAssistCallback' })
);
const mockTataPayCallback = jest.fn((req, res) =>
  res.status(200).json({ ok: true, route: 'tataPayCallback' })
);

jest.mock('../../callBacksAndWebHook/callBacks/payAsistWebHook.js', () => ({
  __esModule: true,
  payAssistTransactionStatusCallback: (...args) =>
    mockPayAssistCallback(...args),
}));

jest.mock('../../callBacksAndWebHook/callBacks/tataPayWebHook.js', () => ({
  __esModule: true,
  tataPayTransactionStatusCallback: (...args) =>
    mockTataPayCallback(...args),
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
  return app;
}

// ------------------ TESTS ------------------

describe('Payout Router', () => {
  let app;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  test('GET /payout → getPayoutsBySearch', async () => {
    const res = await request(app).get('/payout');
    expect(res.status).toBe(200);
    expect(mockGetPayoutsBySearch).toHaveBeenCalled();
  });

  test('GET /payout/reports → getPayouts', async () => {
    const res = await request(app).get('/payout/reports');
    expect(res.status).toBe(200);
    expect(mockGetPayouts).toHaveBeenCalled();
  });

  test('GET /payout/:id → getPayoutsById', async () => {
    const res = await request(app).get('/payout/123');
    expect(res.status).toBe(200);
    expect(mockGetPayoutsById).toHaveBeenCalled();
  });

  test('POST /payout/create-payout → createPayout', async () => {
    const res = await request(app)
      .post('/payout/create-payout')
      .send({ name: 'Test' });

    expect(res.status).toBe(201);
    expect(mockCreatePayout).toHaveBeenCalled();
  });

  test('POST /payout/check-payout-status → checkPayOutStatus', async () => {
    const res = await request(app)
      .post('/payout/check-payout-status')
      .send({ payInId: '123' });

    expect(res.status).toBe(200);
    expect(mockCheckPayOutStatus).toHaveBeenCalled();
  });

  test('PUT /payout/update-payout/:id → updatePayout', async () => {
    const res = await request(app)
      .put('/payout/update-payout/100')
      .send({ name: 'Updated' });

    expect(res.status).toBe(200);
    expect(mockUpdatePayout).toHaveBeenCalled();
  });

  test('PUT /payout/assign-vendor-payout/:id → assignedPayout', async () => {
    const res = await request(app)
      .put('/payout/assign-vendor-payout/55')
      .send({ vendor: 'XYZ' });

    expect(res.status).toBe(200);
    expect(mockAssignedPayout).toHaveBeenCalled();
  });

  test('DELETE /payout/delete-payout/:id → deletePayout', async () => {
    const res = await request(app).delete('/payout/delete-payout/55');
    expect(res.status).toBe(200);
    expect(mockDeletePayout).toHaveBeenCalled();
  });

  // test('GET /payout/payassist/wallets-balance → getPayAssistWalletBalance', async () => {
  //   const res = await request(app).get('/payout/payassist/wallets-balance');
  //   expect(res.status).toBe(200);
  // });

  // test('GET /payout/tatapay/tatapay-balance → getTataPayBalance', async () => {
  //   const res = await request(app).get('/payout/tatapay/tatapay-balance');
  //   expect(res.status).toBe(200);
  //   expect(mockGetTataPayBalance).toHaveBeenCalled();
  // });

  // test('POST /payout/clickrr → clickrr payout', async () => {
  //   const res = await request(app)
  //     .post('/payout/clickrr')
  //     .send({ amount: 250 });

  //   expect(res.status).toBe(201);
  // });

  // test('GET /payout/clickrr/wallet-balance → clickrr balance', async () => {
  //   const res = await request(app).get('/payout/clickrr/wallet-balance');
  //   expect(res.status).toBe(200);
  // });

  test('POST /payout/payassist-callback → callback', async () => {
    const res = await request(app).post('/payout/payassist-callback');
    expect(res.status).toBe(200);
    expect(mockPayAssistCallback).toHaveBeenCalled();
  });

  test('POST /payout/tatapay-callback → callback', async () => {
    const res = await request(app).post('/payout/tatapay-callback');
    expect(res.status).toBe(200);
    expect(mockTataPayCallback).toHaveBeenCalled();
  });

  test('POST /payout/tatapay/bulk-payout → createTataPayBulkPayoutController', async () => {
    const res = await request(app)
      .post('/payout/tatapay/bulk-payout')
      .send({ payoutIds: ['1', '2'] });

    expect(res.status).toBe(200);
  });
});