// src/apis/payOut/__tests__/payoutIndex.common.test.js
'use strict';
import { expect, describe, beforeEach, test } from '@jest/globals';

const express = require('express');
const request = require('supertest');

// --- Mock dependencies ---
// tryCatchHandler: by default return the handler unchanged
jest.mock('../../utils/tryCatchHandler.js', () => ({
  __esModule: true,
  default: (handler) => handler,
}));

// Controllers (mock each)
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
}));

// auth middleware: default pass-through behavior
jest.mock('../../middlewares/auth.js', () => ({
  __esModule: true,
  authorized: (role) => (req, res, next) => next(),
  isAuthenticated: (req, res, next) => next(),
}));

// AccessRoles constant used by router
jest.mock('../../constants/index.js', () => ({
  __esModule: true,
  AccessRoles: { PAYOUT: 'PAYOUT' },
}));

// pay assist callback
const mockPayAssistCallback = jest.fn((req, res) => res.status(200).json({ ok: true, route: 'payAssistCallback' }));
jest.mock('../../callBacksAndWebHook/callBacks/payAsistWebHook.js', () => ({
  __esModule: true,
  payAssistTransactionStatusCallback: (...args) => mockPayAssistCallback(...args),
}));

// Now require the router module under test.
// Note: this require can still throw if your index.js uses ESM-only syntax and Jest/Babel isn't configured.
// If require fails with a syntax error, follow instructions below to enable ESM support in Jest.
let routerModule;
try {
  routerModule = require('./index.js'); // path: src/apis/payOut/index.js
} catch (err) {
  // Re-throw with helpful message
  throw new Error(
    'Failed to require src/apis/payOut/index.js. If your project uses ESM, either configure Jest to transform ESM (babel-jest) or set "type":"module" in package.json. Original error: ' +
      err.message,
  );
}

const router = routerModule && routerModule.default ? routerModule.default : routerModule;

// helper to mount router in an express app for testing
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/payout', router);
  // error handler to convert thrown errors into JSON for assertions
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err && err.status ? err.status : 500;
    res.status(status).json({ ok: false, message: err?.message || 'internal error' });
  });
  return app;
}

describe('payout index router - CommonJS tests', () => {
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

  test('GET /payout/:id calls getPayoutsById', async () => {
    const res = await request(app).get('/payout/abc123');
    expect(res.status).toBe(200);
    expect(res.body.route).toBe('getPayoutsById');
    expect(res.body.id).toBe('abc123');
    expect(mockGetPayoutsById).toHaveBeenCalled();
  });

  test('POST /payout/create-payout calls createPayout (unprotected in file)', async () => {
    const res = await request(app).post('/payout/create-payout').send({ a: 1 });
    expect(res.status).toBe(201);
    expect(res.body.route).toBe('createPayout');
    expect(mockCreatePayout).toHaveBeenCalled();
  });

  test('POST /payout/generate-payout calls createPayout (protected)', async () => {
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

  test('POST /payout/payassist-callback calls payAssistTransactionStatusCallback', async () => {
    const res = await request(app).post('/payout/payassist-callback').send({ cb: true });
    expect(res.status).toBe(200);
    expect(res.body.route).toBe('payAssistCallback');
    expect(mockPayAssistCallback).toHaveBeenCalled();
  });

  // Negative middleware tests:
  test('isAuthenticated failing will produce 401 response', async () => {
    // re-mock auth to simulate failing isAuthenticated
    jest.doMock('../../middlewares/auth.js', () => ({
      __esModule: true,
      isAuthenticated: () => (req, res, next) => next(Object.assign(new Error('not auth'), { status: 401 })),
      authorized: () => (req, res, next) => next(),
    }), { virtual: false });

    // reload router to pick up new mock
    jest.resetModules();
    // re-initialize mocks + router
    const routerMod = require('./index.js');
    const routerReloaded = routerMod.default || routerMod;
    const app2 = express();
    app2.use(express.json());
    app2.use('/payout', routerReloaded);
    app2.use((err, req, res, next) => {
      const st = err && err.status ? err.status : 500;
      res.status(st).json({ ok: false, message: err?.message || 'internal' });
    });

    const resp = await request(app2).get('/payout/reports');
    expect(resp.status).toBe(401);
    expect(resp.body.ok).toBe(false);
    expect(resp.body.message).toBe('not auth');
  });

  test('authorized middleware denying access returns 403', async () => {
    jest.doMock('../../middlewares/auth.js', () => ({
      __esModule: true,
      isAuthenticated: () => (req, res, next) => next(),
      authorized: () => (req, res, next) => res.status(403).json({ ok: false, message: 'forbidden' }),
    }), { virtual: false });

    jest.resetModules();
    const routerMod = require('./index.js');
    const routerReloaded = routerMod.default || routerMod;
    const app3 = express();
    app3.use(express.json());
    app3.use('/payout', routerReloaded);

    const resp = await request(app3).get('/payout/');
    expect(resp.status).toBe(403);
    expect(resp.body.message).toBe('forbidden');
  },30000);
});
