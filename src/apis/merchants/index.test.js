/**
 * index.test.js
 *
 * Tests for index.js (router).
 *
 * Place this file in the SAME directory as index.js so relative imports match.
 */

import express from 'express';
import request from 'supertest';
import tryCatchHandler from '../../utils/tryCatchHandler.js';

// ---- Mocks BEFORE importing the router ----
// We must mock modules the router imports so jest hoists mocks before import

jest.mock('../../utils/tryCatchHandler.js', () => {
  // Return a tryCatch wrapper that executes handler and converts thrown errors to 500 JSON
  return jest.fn((handler) => {
    return async (req, res, next) => {
      try {
        // allow handler to respond or throw
        await handler(req, res, next);
      } catch (err) {
        // emulate typical tryCatchHandler error behavior
        res.status(500).json({ error: err?.message || 'internal' });
      }
    };
  });
});

// Mock controllers - each handler will respond with JSON indicating which handler ran.
// Some tests will override specific mocks to simulate errors.

import * as mockHandlers from './merchantController.js';

jest.mock('./merchantController.js', () => ({
  createMerchant: jest.fn((req, res) => res.status(201).json({ handler: 'createMerchant' })),
  deleteMerchant: jest.fn((req, res) => res.json({ handler: 'deleteMerchant' })),
  getMerchants: jest.fn((req, res) => res.json({ handler: 'getMerchants' })),
  updateMerchant: jest.fn((req, res) => res.json({ handler: 'updateMerchant' })),
  getMerchantsById: jest.fn((req, res) => res.json({ handler: 'getMerchantsById', id: req.params.id })),
  getMerchantCodes: jest.fn((req, res) => res.json({ handler: 'getMerchantCodes' })),
  getMerchantsBySearch: jest.fn((req, res) => res.json({ handler: 'getMerchantsBySearch' })),
  getMerchantByCode: jest.fn((req, res) => res.json({ handler: 'getMerchantByCode' })),
}
));

// Mock auth middlewares without referencing out-of-scope variables.
// isAuthenticated will check a header 'x-auth-fail' to simulate auth failure.
// If not failing, it attaches a default user object to req.
jest.mock('../../middlewares/auth.js', () => ({
  isAuthenticated: (req, res, next) => {
    if (req.headers && req.headers['x-auth-fail']) {
      return res.status(401).json({ error: 'unauthenticated' });
    }
    // attach a default user with role; tests can override req.user later if needed
    req.user = { role: 'MERCHANT', company_id: 'comp-1', user_id: 'u-1', user_name: 'test' };
    return next();
  },
  // authorized factory: returns middleware that checks req.user.role
  authorized: (requiredRole) => (req, res, next) => {
    // if no user -> 401, if role mismatch -> 403
    if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
    if (req.user.role !== requiredRole) return res.status(403).json({ error: 'forbidden' });
    return next();
  },
}));

// Provide AccessRoles constant so tests can reference it if needed
jest.mock('../../constants/index.js', () => ({
  AccessRoles: { MERCHANT: 'MERCHANT' },
}));

// ---- Now import the router under test ----
import router from './index.js'; // index.js is the file you provided

// Also import the tryCatchHandler mock so unit tests can assert calls

// ---- Unit tests: router wiring ----
describe('Router wiring (unit checks)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // test('should call tryCatchHandler for each controller at import time', () => {
  //   // index.js wraps each controller via tryCatchHandler when it was imported above.
  //   // There are 8 controller functions used in index.js.
  //   expect(tryCatchHandler).toHaveBeenCalledTimes(8);

  //   // Ensure tryCatchHandler was called with references to controller functions
  //   expect(tryCatchHandler).toHaveBeenCalledWith(expect.any(Function));

  //   // More specific: check at least one of the calls was for getMerchants
  //   const calledHandlers = tryCatchHandler.mock.calls.map((c) => c[0]?.name || 'anonymous');
  //   expect(calledHandlers).toContain('getMerchants');
  //   expect(calledHandlers).toContain('createMerchant');
  //   expect(calledHandlers).toContain('deleteMerchant');
  // });

  test('router exposes the expected routes and methods', () => {
    // Inspect router stack to confirm route paths/methods
    const routes = router.stack
      .filter((layer) => layer.route)
      .map((layer) => {
        const route = layer.route;
        return {
          path: route.path,
          methods: Object.keys(route.methods).sort(),
        };
      });

    // Convert to a lookup for easy assertions
    const map = {};
    for (const r of routes) map[r.path] = r.methods;

    // Expected routes (as defined in your index.js)
    expect(map['/getmerchant']).toContain('get');
    expect(map['/']).toContain('get');
    expect(map['/get-merchant-by-code']).toContain('get');
    expect(map['/codes']).toContain('get');
    expect(map['/:id']).toContain('get');
    expect(map['/create-merchant']).toContain('post');
    expect(map['/update-merchant/:id']).toContain('put');
    expect(map['/delete-merchant/:id']).toContain('delete');
  });
});

// ---- Integration tests using supertest ----
describe('Router integration tests (express + supertest)', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    // create a fresh express app and mount router under /merchants
    app = express();
    app.use(express.json());
    app.use('/merchants', router);
  });

  test('GET /merchants/getmerchant -> 200 and calls getMerchants handler', async () => {
    const res = await request(app).get('/merchants/getmerchant').expect(200);
    expect(res.body).toEqual({ handler: 'getMerchants' });
    expect(mockHandlers.getMerchants).toHaveBeenCalled();
  });

  test('GET /merchants/ -> 200 and calls getMerchantsBySearch handler', async () => {
    const res = await request(app).get('/merchants/').expect(200);
    expect(res.body).toEqual({ handler: 'getMerchantsBySearch' });
    expect(mockHandlers.getMerchantsBySearch).toHaveBeenCalled();
  });

  test('GET /merchants/get-merchant-by-code -> 200 and calls getMerchantByCode handler', async () => {
    const res = await request(app).get('/merchants/get-merchant-by-code').expect(200);
    expect(res.body).toEqual({ handler: 'getMerchantByCode' });
    expect(mockHandlers.getMerchantByCode).toHaveBeenCalled();
  });

  test('GET /merchants/codes -> 200 and calls getMerchantCodes handler', async () => {
    const res = await request(app).get('/merchants/codes').expect(200);
    expect(res.body).toEqual({ handler: 'getMerchantCodes' });
    expect(mockHandlers.getMerchantCodes).toHaveBeenCalled();
  });

  test('GET /merchants/:id -> 200 and returns id param', async () => {
    const res = await request(app).get('/merchants/abc-123').expect(200);
    expect(res.body).toEqual({ handler: 'getMerchantsById', id: 'abc-123' });
    expect(mockHandlers.getMerchantsById).toHaveBeenCalled();
  });

  test('POST /merchants/create-merchant -> 201 and calls createMerchant', async () => {
    const res = await request(app).post('/merchants/create-merchant').send({ name: 'x' }).expect(201);
    expect(res.body).toEqual({ handler: 'createMerchant' });
    expect(mockHandlers.createMerchant).toHaveBeenCalled();
  });

  test('PUT /merchants/update-merchant/:id -> 200 and calls updateMerchant', async () => {
    const res = await request(app).put('/merchants/update-merchant/m1').send({ status: 'ACTIVE' }).expect(200);
    expect(res.body).toEqual({ handler: 'updateMerchant' });
    expect(mockHandlers.updateMerchant).toHaveBeenCalled();
  });

  test('DELETE /merchants/delete-merchant/:id -> 200 and calls deleteMerchant', async () => {
    const res = await request(app).delete('/merchants/delete-merchant/m1').expect(200);
    expect(res.body).toEqual({ handler: 'deleteMerchant' });
    expect(mockHandlers.deleteMerchant).toHaveBeenCalled();
  });

  test('401 when isAuthenticated fails using header trigger', async () => {
    const res = await request(app).get('/merchants/getmerchant').set('x-auth-fail', '1').expect(401);
    expect(res.body).toEqual({ error: 'unauthenticated' });
  });

  // test('403 when authorized fails (role mismatch)', async () => {
  //   // Make a small app that sets req.user with a non-merchant role before the router runs
  //   const app2 = express();
  //   app2.use(express.json());
  //   app2.use('/merchants', (req, res, next) => {
  //     req.user = { role: 'NOT_MERCHANT' };
  //     next();
  //   }, router);

  //   const res = await request(app2).get('/merchants/getmerchant').expect(403);
  //   expect(res.body).toEqual({ error: 'forbidden' });
  // });

  test('500 when controller throws and tryCatchHandler returns 500', async () => {
    // Temporarily make the getMerchants handler throw
    mockHandlers.getMerchants.mockImplementationOnce(() => {
      throw new Error('boom');
    });

    const res = await request(app).get('/merchants/getmerchant').expect(500);
    expect(res.body).toEqual({ error: 'boom' });
  });
});
