// __tests__/parentRouter.test.js
import request from 'supertest';
import express from 'express';
import parentRouter from '/v1'; 

jest.mock('../v1/auth/index.js', () => {
  const router = require('express').Router();
  router.post('/login', (req, res) => res.json({ message: 'auth ok' }));
  return router;
});
jest.mock('../v1/users/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'users ok' }));
  return router;
});
jest.mock('../v1/merchants/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'merchants ok' }));
  return router;
});
jest.mock('../v1/vendors/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'vendors ok' }));
  return router;
});
jest.mock('../v1/chargeBacks/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'chargeBacks ok' }));
  return router;
});
jest.mock('../v1/roles/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'roles ok' }));
  return router;
});
jest.mock('../v1/calculation/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'calculation ok' }));
  return router;
});
jest.mock('../v1/payIn/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'payIn ok' }));
  return router;
});
jest.mock('../v1/designation/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'designation ok' }));
  return router;
});
jest.mock('../v1/bankAccounts/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'bankDetails ok' }));
  return router;
});
jest.mock('../v1/bankResponse/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'bankResponse ok' }));
  return router;
});
jest.mock('../v1/company/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'company ok' }));
  return router;
});
jest.mock('../v1/settlement/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'settlement ok' }));
  return router;
});
jest.mock('../v1/userHierarchy/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'userHierarchy ok' }));
  return router;
});
jest.mock('../v1/payOut/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'payOut ok' }));
  return router;
});
jest.mock('../v1/reports/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'reports ok' }));
  return router;
});
jest.mock('../v1/checkutr/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'checkUtr ok' }));
  return router;
});
jest.mock('../v1/resetHistory/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'resetHistory ok' }));
  return router;
});
jest.mock('../v1/beneficiaryAccounts/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'beneficiaryAccounts ok' }));
  return router;
});
jest.mock('../v1/consume-bank-response.js', () => {
  const router = require('express').Router();
  router.post('/', (req, res) => res.json({ message: 'consume-bank-response ok' }));
  return router;
});
jest.mock('../v1/complaints/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'complaints ok' }));
  return router;
});
jest.mock('../v1/cron/index.js', () => {
  const router = require('express').Router();
  router.get('/', (req, res) => res.json({ message: 'cron ok' }));
  return router;
});
jest.mock('../v1/common/index.js', () => {
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
