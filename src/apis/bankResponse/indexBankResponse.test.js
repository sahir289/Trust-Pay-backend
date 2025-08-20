// src/apis/bankResponse/indexBankResponse.test.js
import request from 'supertest';
import express from 'express';
import bankResponseRouter from './index.js';
import {
  createBankResponse,
  getBankResponse,
  getBankMessage,
  updateBankResponse,
  getBankResponseBySearch,
  createBankBotResponse,
  getClaimResponse,
  importBankResponse,
  resetBankResponseController,
  createBankBotResponseBulk,
} from './bankResponseController.js';

// Mock auth dependencies
jest.mock('../../utils/auth.js', () => ({
  verifyToken: jest.fn((token) => ({ user_id: 'test-user', company_id: 'test-company', designation: 'admin' })),
}));

jest.mock('../../apis/auth/authDao.js', () => ({
  getSessionByIdDao: jest.fn(() => Promise.resolve({ session_id: 'test-session' })),
}));

jest.mock('../../helpers/Aws.js', () => ({
  s3: {
    upload: jest.fn().mockImplementation((params, callback) => callback(null, { Location: 'mock-s3-url' })),
  },
}));

// Mock controller functions with logging
jest.mock('./bankResponseController.js', () => ({
  createBankResponse: jest.fn((req, body, res) => {
    console.log('Mock createBankResponse called with body:', body);
    return res.status(201).json({ id: 1, message: 'Bank response created' });
  }),
  getBankResponse: jest.fn((req, res) => {
    console.log('Mock getBankResponse called');
    return res.status(200).json({ message: 'Bank response fetched' });
  }),
  getBankMessage: jest.fn((req, res) => {
    console.log('Mock getBankMessage called');
    return res.status(200).json({ message: 'Bank response fetched' });
  }),
  updateBankResponse: jest.fn((req, id, body, res) => {
    console.log('Mock updateBankResponse called with id:', id, 'body:', body);
    return res.status(200).json({ id: parseInt(id), message: 'Bank response updated' });
  }),
  getBankResponseBySearch: jest.fn((req, res) => {
    console.log('Mock getBankResponseBySearch called');
    return res.status(200).json({ message: 'Bank responses searched' });
  }),
  createBankBotResponse: jest.fn((req, body, res) => {
    console.log('Mock createBankBotResponse called with body:', body);
    return res.status(201).json({ message: 'Bank bot response created' });
  }),
  getClaimResponse: jest.fn((req, res) => {
    console.log('Mock getClaimResponse called');
    return res.status(200).json({ message: 'Claim response fetched' });
  }),
  importBankResponse: jest.fn((req, body, res) => {
    console.log('Mock importBankResponse called with body:', body);
    return res.status(201).json({ message: 'Bank response imported' });
  }),
  resetBankResponseController: jest.fn((req, id, res) => {
    console.log('Mock resetBankResponseController called with id:', id);
    return res.status(200).json({ message: 'Bank response reset' });
  }),
  createBankBotResponseBulk: jest.fn((req, body, res) => {
    console.log('Mock createBankBotResponseBulk called with body:', body);
    return res.status(201).json({ message: 'Bank bot responses created in bulk' });
  }),
}));

jest.mock('../../middlewares/auth.js', () => ({
  isAuthenticated: (req, res, next) => {
    console.log('Mock isAuthenticated called');
    req.user = { user_id: 'test-user', designation: 'admin' };
    next();
  },
  authorized: () => (req, res, next) => {
    console.log('Mock authorized called');
    next();
  },
}));

jest.mock('../../utils/index.js', () => ({
  multerUpload: {
    single: jest.fn(() => (req, res, next) => {
      console.log('Mock multerUpload called');
      req.file = { buffer: Buffer.from('test'), originalname: 'test.csv', mimetype: 'text/csv' };
      next();
    }),
  },
}));

jest.mock('../../middlewares/rateLimiter.js', () => ({
  rateLimitMiddleware: jest.fn((req, res, next) => {
    console.log('Mock rateLimitMiddleware called');
    next();
  }),
  rateLimitMiddlewareBot: jest.fn((req, res, next) => {
    console.log('Mock rateLimitMiddlewareBot called');
    next();
  }),
}));

jest.mock('../../utils/redisClient.js', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  quit: jest.fn().mockResolvedValue('OK'),
}));

jest.mock('../../utils/rabbitmq-bank-response.js', () => ({
  publishBankResponse: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/logger.js', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('../../utils/db.js', () => {
  const mockClient = {
    query: jest.fn().mockResolvedValue({ rows: [{ id: 1, name: 'Test' }] }),
    release: jest.fn(),
  };
  return {
    query: jest.fn().mockResolvedValue({ rows: [{ id: 1, name: 'Test' }] }),
    getClient: jest.fn().mockResolvedValue(mockClient),
    pool: {
      query: jest.fn().mockResolvedValue({ rows: [{ id: 1, name: 'Test' }] }),
      connect: jest.fn().mockResolvedValue(mockClient),
      end: jest.fn().mockResolvedValue(undefined),
    },
  };
});

jest.mock('../../config/config.js', () => ({
  rateLimiter: {
    points: 100,
    duration: 60,
    blockDuration: 60,
  },
  bucketName: 'test-bucket',
}));

jest.mock('../../constants/index.js', () => ({
  AccessRoles: {
    ADMIN: 'admin',
    BANK_RESPONSE: 'admin',
  },
}));

describe('BankResponse Routes', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/bankResponse', bankResponseRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    const db = require('../../utils/db.js');
    if (db.pool && db.pool.end) {
      await db.pool.end();
    }
  });

  test('should call getClaimResponse and return 200', async () => {
    getClaimResponse.mockImplementation((req, res) => res.status(200).json([{ id: 1, claim: 'test' }]));
    const res = await request(app).get('/bankResponse/claim');
    console.log('getClaimResponse response:', { status: res.status, body: res.body });
    expect(res.status).toBe(200);
    expect(getClaimResponse).toHaveBeenCalledWith(expect.any(Object), expect.any(Object));
    expect(res.body).toEqual([{ id: 1, claim: 'test' }]);
  }, 30000);

  test('should call createBankBotResponse and return 201', async () => {
    createBankBotResponse.mockImplementation((req, body, res) => res.status(201).json({ message: 'Bot message created' }));
    const res = await request(app)
      .post('/bankResponse/create-bot-message')
      .send({ message: 'Test bot message' });
    console.log('createBankBotResponse response:', { status: res.status, body: res.body });
    expect(res.status).toBe(201);
    expect(createBankBotResponse).toHaveBeenCalledWith(
      expect.any(Object),
      { message: 'Test bot message' },
      expect.any(Object)
    );
    expect(res.body).toEqual({ message: 'Bot message created' });
  }, 30000);

  test('should call createBankBotResponseBulk and return 201', async () => {
    createBankBotResponseBulk.mockImplementation((req, body, res) => res.status(201).json({ message: 'Bulk messages created' }));
    const res = await request(app)
      .post('/bankResponse/create-bot-message-bulk')
      .send({ messages: ['message1', 'message2'] });
    console.log('createBankBotResponseBulk response:', { status: res.status, body: res.body });
    expect(res.status).toBe(201);
    expect(createBankBotResponseBulk).toHaveBeenCalledWith(
      expect.any(Object),
      { messages: ['message1', 'message2'] },
      expect.any(Object)
    );
    expect(res.body).toEqual({ message: 'Bulk messages created' });
  }, 30000);

  test('should call createBankResponse and return 201', async () => {
    createBankResponse.mockImplementation((req, body, res) => res.status(201).json({ id: 1, message: 'Test message' }));
    const res = await request(app)
      .post('/bankResponse/create-message')
      .send({ complaint_type: 'test', description: 'Test description', user_id: 1 });
    console.log('createBankResponse response:', { status: res.status, body: res.body });
    expect(res.status).toBe(201);
    expect(createBankResponse).toHaveBeenCalledWith(
      expect.any(Object),
      { complaint_type: 'test', description: 'Test description', user_id: 1 },
      expect.any(Object)
    );
    expect(res.body).toEqual({ id: 1, message: 'Test message' });
  }, 30000);

  test('should call getBankResponseBySearch and return 200', async () => {
    getBankResponseBySearch.mockImplementation((req, res) => res.status(200).json([{ id: 1, name: 'Response 1' }]));
    const res = await request(app).get('/bankResponse/');
    console.log('getBankResponseBySearch response:', { status: res.status, body: res.body });
    expect(res.status).toBe(200);
    expect(getBankResponseBySearch).toHaveBeenCalledWith(expect.any(Object), expect.any(Object));
    expect(res.body).toEqual([{ id: 1, name: 'Response 1' }]);
  }, 30000);

  test('should call getBankResponse and return 200', async () => {
    getBankResponse.mockImplementation((req, res) => res.status(200).json([{ id: 1, name: 'Report 1' }]));
    const res = await request(app).get('/bankResponse/BankResponseReports');
    console.log('getBankResponse response:', { status: res.status, body: res.body });
    expect(res.status).toBe(200);
    expect(getBankResponse).toHaveBeenCalledWith(expect.any(Object), expect.any(Object));
    expect(res.body).toEqual([{ id: 1, name: 'Report 1' }]);
  }, 30000);

  test('should call getBankMessage and return 200', async () => {
    getBankMessage.mockImplementation((req, res) => res.status(200).json([{ id: 1, message: 'Test message' }]));
    const res = await request(app).get('/bankResponse/get-bank-message');
    console.log('getBankMessage response:', { status: res.status, body: res.body });
    expect(res.status).toBe(200);
    expect(getBankMessage).toHaveBeenCalledWith(expect.any(Object), expect.any(Object));
    expect(res.body).toEqual([{ id: 1, message: 'Test message' }]);
  }, 30000);

  test('should call updateBankResponse and return 200', async () => {
    updateBankResponse.mockImplementation((req, id, body, res) => res.status(200).json({ id: parseInt(id), message: 'Updated message' }));
    const res = await request(app)
      .put('/bankResponse/update-message/1')
      .send({ complaint_type: 'updated', description: 'Updated description' });
    console.log('updateBankResponse response:', { status: res.status, body: res.body });
    expect(res.status).toBe(200);
    expect(updateBankResponse).toHaveBeenCalledWith(
      expect.any(Object),
      '1',
      { complaint_type: 'updated', description: 'Updated description' },
      expect.any(Object)
    );
    expect(res.body).toEqual({ id: 1, message: 'Updated message' });
  }, 30000);

  test('should call resetBankResponseController and return 200', async () => {
    resetBankResponseController.mockImplementation((req, id, res) => res.status(200).json({ message: 'Message reset' }));
    const res = await request(app).put('/bankResponse/reset-message/1');
    console.log('resetBankResponseController response:', { status: res.status, body: res.body });
    expect(res.status).toBe(200);
    expect(resetBankResponseController).toHaveBeenCalledWith(
      expect.any(Object),
      '1',
      expect.any(Object)
    );
    expect(res.body).toEqual({ message: 'Message reset' });
  }, 30000);

  test('should call importBankResponse and return 201', async () => {
    importBankResponse.mockImplementation((req, body, res) => res.status(201).json({ message: 'Import successful' }));
    const res = await request(app)
      .post('/bankResponse/import-bank-response')
      .attach('file', Buffer.from('test'), 'test.csv');
    console.log('importBankResponse response:', { status: res.status, body: res.body });
    expect(res.status).toBe(201);
    expect(importBankResponse).toHaveBeenCalledWith(
      expect.any(Object),
      { file: expect.any(Object) },
      expect.any(Object)
    );
    expect(res.body).toEqual({ message: 'Import successful' });
  }, 30000);
});