// import request from 'supertest';
// import express from 'express';
// import bankResponseRouter from './index.js';
// import {
//   createBankResponse,
//   getBankResponse,
//   getBankMessage,
//   updateBankResponse,
//   getBankResponseBySearch,
//   createBankBotResponse,
//   getClaimResponse,
//   importBankResponse,
//   resetBankResponseController,
//   createBankBotResponseBulk,
// } from './bankResponseController.js';

// jest.mock('./bankResponseController.js', () => ({
//   createBankResponse: jest.fn(),
//   getBankResponse: jest.fn(),
//   getBankMessage: jest.fn(),
//   updateBankResponse: jest.fn(),
//   getBankResponseBySearch: jest.fn(),
//   createBankBotResponse: jest.fn(),
//   getClaimResponse: jest.fn(),
//   importBankResponse: jest.fn(),
//   resetBankResponseController: jest.fn(),
//   createBankBotResponseBulk: jest.fn(),
// }));

// jest.mock('../../middlewares/auth.js', () => ({
//   isAuthenticated: jest.fn((req, res, next) => {
//     req.user = { user_id: 'test_user', role: 'admin', user_name: 'test', company_id: 'test_company' };
//     return next();
//   }),
//   authorized: jest.fn(() => (req, res, next) => next()),
// }));

// jest.mock('../../utils/index.js', () => ({
//   multerUpload: {
//     single: jest.fn(() => (req, res, next) => {
//       req.file = { buffer: Buffer.from('test'), originalname: 'test.csv' };
//       next();
//     }),
//   },
// }));

// jest.mock('../../middlewares/rateLimiter.js', () => ({
//   rateLimitMiddleware: jest.fn((req, res, next) => next()),
//   rateLimitMiddlewareBot: jest.fn((req, res, next) => next()),
// }));

// jest.mock('../../utils/redisClient.js', () => ({
//   get: jest.fn().mockResolvedValue(null),
//   set: jest.fn().mockResolvedValue('OK'),
//   del: jest.fn().mockResolvedValue(1),
//   quit: jest.fn().mockResolvedValue('OK'),
// }));

// jest.mock('../../utils/rabbitmq-bank-response.js', () => ({
//   publishBankResponse: jest.fn().mockResolvedValue(undefined),
// }));

// jest.mock('../../utils/logger.js', () => ({
//   logger: {
//     error: jest.fn(),
//     info: jest.fn(),
//     warn: jest.fn(),
//   },
// }));

// jest.mock('../../utils/db.js', () => {
//   const mockClient = {
//     query: jest.fn().mockResolvedValue({ rows: [] }),
//     release: jest.fn(),
//   };
//   return {
//     query: jest.fn().mockResolvedValue({ rows: [] }),
//     getClient: jest.fn().mockResolvedValue(mockClient),
//     pool: {
//       query: jest.fn().mockResolvedValue({ rows: [] }),
//       connect: jest.fn().mockResolvedValue(mockClient),
//       end: jest.fn().mockResolvedValue(undefined),
//     },
//   };
// });

// jest.mock('../../config/config.js', () => ({
//   rateLimiter: {
//     points: 100,
//     duration: 60,
//     blockDuration: 60,
//   },
// }));

// jest.mock('../../constants/index.js', () => ({
//   AccessRoles: {
//     ADMIN: 'admin',
//     BANK_RESPONSE: 'admin', 
//   },
// }));

// describe('BankResponse Routes', () => {
//   let app;

//   beforeAll(() => {
//     app = express();
//     app.use(express.json());
//     app.use('/bankResponse', bankResponseRouter);
//   });

//   beforeEach(() => {
//     jest.clearAllMocks();
//   });

//   afterAll(async () => {
//     const db = require('../../utils/db.js');
//     if (db.pool && db.pool.end) {
//       await db.pool.end();
//     }
//   });

//   describe('GET /bankResponse/claim', () => {
//     test('should call getClaimResponse and return 200', async () => {
//       getClaimResponse.mockResolvedValue({ status: 200, data: [{ id: 1, claim: 'test' }] });
//       const res = await request(app).get('/bankResponse/claim');
//       expect(res.status).toBe(200);
//       expect(getClaimResponse).toHaveBeenCalledWith(expect.any(Object), expect.any(Object));
//       expect(res.body).toEqual([{ id: 1, claim: 'test' }]);
//     }, 30000);
//   });

//   describe('POST /bankResponse/create-bot-message', () => {
//     test('should call createBankBotResponse and return 200', async () => {
//       createBankBotResponse.mockResolvedValue({ status: 200, data: { message: 'Bot message created' } });
//       const res = await request(app)
//         .post('/bankResponse/create-bot-message')
//         .send({ message: 'Test bot message' });
//       expect(res.status).toBe(200);
//       expect(createBankBotResponse).toHaveBeenCalledWith(
//         expect.any(Object),
//         { message: 'Test bot message', user: expect.any(Object) }
//       );
//       expect(res.body).toEqual({ message: 'Bot message created' });
//     }, 30000);
//   });

//   describe('POST /bankResponse/create-bot-message-bulk', () => {
//     test('should call createBankBotResponseBulk and return 200', async () => {
//       createBankBotResponseBulk.mockResolvedValue({ status: 200, data: { message: 'Bulk messages created' } });
//       const res = await request(app)
//         .post('/bankResponse/create-bot-message-bulk')
//         .send({ messages: ['message1', 'message2'] });
//       expect(res.status).toBe(200);
//       expect(createBankBotResponseBulk).toHaveBeenCalledWith(
//         expect.any(Object),
//         { messages: ['message1', 'message2'], user: expect.any(Object) }
//       );
//       expect(res.body).toEqual({ message: 'Bulk messages created' });
//     }, 30000);
//   });

//   describe('POST /bankResponse/create-message', () => {
//     test('should call createBankResponse and return 201', async () => {
//       createBankResponse.mockResolvedValue({ status: 201, data: { id: 1, message: 'Test message' } });
//       const res = await request(app)
//         .post('/bankResponse/create-message')
//         .send({ complaint_type: 'test', description: 'Test description', user_id: 1 });
//       expect(res.status).toBe(201);
//       expect(createBankResponse).toHaveBeenCalledWith(
//         expect.any(Object),
//         { complaint_type: 'test', description: 'Test description', user_id: 1, user: expect.any(Object) }
//       );
//       expect(res.body).toEqual({ id: 1, message: 'Test message' });
//     }, 30000);
//   });

//   describe('GET /bankResponse/', () => {
//     test('should call getBankResponseBySearch and return 200', async () => {
//       getBankResponseBySearch.mockResolvedValue({ status: 200, data: [{ id: 1, name: 'Response 1' }] });
//       const res = await request(app).get('/bankResponse/');
//       expect(res.status).toBe(200);
//       expect(getBankResponseBySearch).toHaveBeenCalledWith(expect.any(Object), expect.any(Object));
//       expect(res.body).toEqual([{ id: 1, name: 'Response 1' }]);
//     }, 30000);
//   });

//   describe('GET /bankResponse/BankResponseReports', () => {
//     test('should call getBankResponse and return 200', async () => {
//       getBankResponse.mockResolvedValue({ status: 200, data: [{ id: 1, name: 'Report 1' }] });
//       const res = await request(app).get('/bankResponse/BankResponseReports');
//       expect(res.status).toBe(200);
//       expect(getBankResponse).toHaveBeenCalledWith(expect.any(Object), expect.any(Object));
//       expect(res.body).toEqual([{ id: 1, name: 'Report 1' }]);
//     }, 30000);
//   });

//   describe('GET /bankResponse/get-bank-message', () => {
//     test('should call getBankMessage and return 200', async () => {
//       getBankMessage.mockResolvedValue({ status: 200, data: [{ id: 1, message: 'Test message' }] });
//       const res = await request(app).get('/bankResponse/get-bank-message');
//       expect(res.status).toBe(200);
//       expect(getBankMessage).toHaveBeenCalledWith(expect.any(Object), expect.any(Object));
//       expect(res.body).toEqual([{ id: 1, message: 'Test message' }]);
//     }, 30000);
//   });

//   describe('PUT /bankResponse/update-message/:id', () => {
//     test('should call updateBankResponse and return 200', async () => {
//       updateBankResponse.mockResolvedValue({ status: 200, data: { id: 1, message: 'Updated message' } });
//       const res = await request(app)
//         .put('/bankResponse/update-message/1')
//         .send({ complaint_type: 'updated', description: 'Updated description' });
//       expect(res.status).toBe(200);
//       expect(updateBankResponse).toHaveBeenCalledWith(
//         expect.any(Object),
//         '1',
//         { complaint_type: 'updated', description: 'Updated description', user: expect.any(Object) }
//       );
//       expect(res.body).toEqual({ id: 1, message: 'Updated message' });
//     }, 30000);
//   });

//   describe('PUT /bankResponse/reset-message/:id', () => {
//     test('should call resetBankResponseController and return 200', async () => {
//       resetBankResponseController.mockResolvedValue({ status: 200, data: { message: 'Message reset' } });
//       const res = await request(app).put('/bankResponse/reset-message/1');
//       expect(res.status).toBe(200);
//       expect(resetBankResponseController).toHaveBeenCalledWith(expect.any(Object), '1', expect.any(Object));
//       expect(res.body).toEqual({ message: 'Message reset' });
//     }, 30000);
//   });

//   describe('POST /bankResponse/import-bank-response', () => {
//     test('should call importBankResponse and return 200', async () => {
//       importBankResponse.mockResolvedValue({ status: 200, data: { message: 'Import successful' } });
//       const res = await request(app)
//         .post('/bankResponse/import-bank-response')
//         .attach('file', Buffer.from('test'), 'test.csv');
//       expect(res.status).toBe(200);
//       expect(importBankResponse).toHaveBeenCalledWith(
//         expect.any(Object),
//         { file: expect.any(Object), user: expect.any(Object) }
//       );
//       expect(res.body).toEqual({ message: 'Import successful' });
//     }, 30000);
//   });
// });