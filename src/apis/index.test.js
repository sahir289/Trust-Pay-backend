// __tests__/parentRouter.test.js
import request from 'supertest';
import express from 'express';
import parentRouter from '../routes/index.js'; // adjust path

// Mock all child routers with simple Express routers
jest.mock('../routes/ping/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'ping ok' }));
  return router;
});
jest.mock('../routes/auth/index.js', () => {
  const router = require('express').Router();
  router.post('/login', (req, res) => res.json({ message: 'auth ok' }));
  return router;
});
jest.mock('../routes/users/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'users ok' }));
  return router;
});
jest.mock('../routes/merchants/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'merchants ok' }));
  return router;
});
jest.mock('../routes/vendors/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'vendors ok' }));
  return router;
});
jest.mock('../routes/chargeBacks/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'chargeBacks ok' }));
  return router;
});
jest.mock('../routes/roles/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'roles ok' }));
  return router;
});
jest.mock('../routes/calculation/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'calculation ok' }));
  return router;
});
jest.mock('../routes/payIn/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'payIn ok' }));
  return router;
});
jest.mock('../routes/designation/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'designation ok' }));
  return router;
});
jest.mock('../routes/bankAccounts/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'bankDetails ok' }));
  return router;
});
jest.mock('../routes/bankResponse/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'bankResponse ok' }));
  return router;
});
jest.mock('../routes/company/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'company ok' }));
  return router;
});
jest.mock('../routes/settlement/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'settlement ok' }));
  return router;
});
jest.mock('../routes/userHierarchy/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'userHierarchy ok' }));
  return router;
});
jest.mock('../routes/payOut/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'payOut ok' }));
  return router;
});
jest.mock('../routes/reports/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'reports ok' }));
  return router;
});
jest.mock('../routes/checkutr/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'checkUtr ok' }));
  return router;
});
jest.mock('../routes/resetHistory/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'resetHistory ok' }));
  return router;
});
jest.mock('../routes/beneficiaryAccounts/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'beneficiaryAccounts ok' }));
  return router;
});
jest.mock('../routes/consume-bank-response.js', () => {
  const router = require('express').Router();
  router.post('/', (req, res) => res.json({ message: 'consume-bank-response ok' }));
  return router;
});
jest.mock('../routes/complaints/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'complaints ok' }));
  return router;
});
jest.mock('../routes/cron/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'cron ok' }));
  return router;
});
jest.mock('../routes/common/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'common ok' }));
  return router;
});

// Setup app with parent router
const app = express();
app.use(parentRouter);

describe('Parent Router /v1', () => {
  it('should respond from /ping', async () => {
    const res = await request(app).get('/v1/ping');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('ping ok');
  });

  it('should respond from /auth', async () => {
    const res = await request(app).post('/v1/auth/login');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('auth ok');
  });

  it('should respond from /users', async () => {
    const res = await request(app).get('/v1/users');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('users ok');
  });

  it('should respond from /vendors', async () => {
    const res = await request(app).get('/v1/vendors');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('vendors ok');
  });

  it('should respond from /consume-bank-response', async () => {
    const res = await request(app).post('/v1/consume-bank-response');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('consume-bank-response ok');
  });

  it('should respond from /complaints', async () => {
    const res = await request(app).get('/v1/complaints');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('complaints ok');
  });
});
