



// ESM mocking with jest.unstable_mockModule

import request from 'supertest';
import express from 'express';
import { createBankResponseRouter } from './index.js';

// removed duplicate let app;
let createBankResponse, getBankResponse, getBankMessage, updateBankResponse, getBankResponseBySearch, createBankBotResponse, getClaimResponse, importBankResponse, resetBankResponseController, createBankBotResponseBulk;
let isAuthenticated, authorized, rateLimitMiddleware, rateLimitMiddlewareBot, multerUpload;

let app;

function setupApp() {
  const router = createBankResponseRouter({
    createBankResponse,
    getBankResponse,
    getBankMessage,
    updateBankResponse,
    // setupApp(); // Removed from beforeEach
    createBankBotResponse,
    getClaimResponse,
    importBankResponse,
    resetBankResponseController,
    createBankBotResponseBulk,
    isAuthenticated,
    authorized,
    rateLimitMiddleware,
    rateLimitMiddlewareBot,
    multerUpload,
  });
  app = express();
  app.use(express.json());
  app.use(router);
}

beforeEach(() => {
  jest.resetModules();
  // Create fresh mocks for each controller function
  createBankResponse = jest.fn();
  getBankResponse = jest.fn();
  getBankMessage = jest.fn();
  updateBankResponse = jest.fn();
  getBankResponseBySearch = jest.fn();
  createBankBotResponse = jest.fn();
  getClaimResponse = jest.fn();
  importBankResponse = jest.fn();
  resetBankResponseController = jest.fn();
  createBankBotResponseBulk = jest.fn();

  // Mock middleware behaviors
  isAuthenticated = jest.fn((req, res, next) => next());
  authorized = jest.fn(() => (req, res, next) => next());
  rateLimitMiddleware = jest.fn((req, res, next) => next());
  rateLimitMiddlewareBot = jest.fn((req, res, next) => next());
  multerUpload = { single: jest.fn(() => (req, res, next) => next()) };

  setupApp();
});
  multerUpload = { single: jest.fn((req, res, next) => next()) };
  multerUpload.single.mockClear();
  describe('POST /create-bot-message', () => {
    it('should call createBankBotResponse with rate limiting', async () => {
      createBankBotResponse.mockImplementation((req, res) => res.status(201).json({ success: true }));

      const response = await request(app).post('/create-bot-message').send({ data: 'test' });

      expect(response.status).toBe(201);
      expect(createBankBotResponse).toHaveBeenCalled();
      expect(rateLimitMiddlewareBot).toHaveBeenCalled();
    });

    it('should handle rate limit exceeded', async () => {
      rateLimitMiddlewareBot.mockImplementation((req, res) => res.status(429).json({ error: 'Rate limit exceeded' }));
      setupApp();
      const response = await request(app).post('/create-bot-message').send({ data: 'test' });
      expect(response.status).toBe(429);
    });

    it('should handle errors from createBankBotResponse', async () => {
      createBankBotResponse.mockImplementation(() => { throw new Error('Error'); });

      const response = await request(app).post('/create-bot-message').send({ data: 'test' });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /create-bot-message-bulk', () => {
    it('should call createBankBotResponseBulk', async () => {
      createBankBotResponseBulk.mockImplementation((req, res) => res.status(201).json({ success: true }));

      const response = await request(app).post('/create-bot-message-bulk').send([{ data: 'test' }]);

      expect(response.status).toBe(201);
      expect(createBankBotResponseBulk).toHaveBeenCalled();
    });

    it('should handle errors from createBankBotResponseBulk', async () => {
      createBankBotResponseBulk.mockImplementation(() => { throw new Error('Error'); });

      const response = await request(app).post('/create-bot-message-bulk').send([{ data: 'test' }]);
  setupApp();

      expect(response.status).toBe(500);
    });
  });

  describe('POST /create-message', () => {
    it('should call createBankResponse when authenticated and authorized', async () => {
      createBankResponse.mockImplementation((req, res) => res.status(201).json({ success: true }));

      const response = await request(app).post('/create-message').send({ data: 'test' });

      expect(response.status).toBe(201);
      expect(createBankResponse).toHaveBeenCalled();
      expect(rateLimitMiddleware).toHaveBeenCalled();
    });

    it('should return 401 if not authenticated', async () => {
      isAuthenticated.mockImplementation((req, res) => res.status(401).json({ error: 'Not authenticated' }));
      setupApp();
      const response = await request(app).post('/create-message').send({ data: 'test' });
      expect(response.status).toBe(401);
    });

    it('should handle rate limit exceeded', async () => {
      rateLimitMiddleware.mockImplementation((req, res) => res.status(429).json({ error: 'Rate limit exceeded' }));
      setupApp();
      const response = await request(app).post('/create-message').send({ data: 'test' });
      expect(response.status).toBe(429);
    });

    it('should handle errors from createBankResponse', async () => {
      createBankResponse.mockImplementation(() => { throw new Error('Error'); });

      const response = await request(app).post('/create-message').send({ data: 'test' });

      expect(response.status).toBe(500);
    });
  });

  describe('GET /', () => {

    it('should return 403 if not authorized', async () => {
      isAuthenticated = jest.fn((req, res, next) => next());
      authorized = jest.fn(() => (req, res) => {
        console.log('AUTHORIZED MOCK CALLED');
        res.status(403).json({ error: 'Unauthorized' });
        return;
      });
      setupApp();
      const response = await request(app).get('/');
      expect(response.status).toBe(403);
    });

    it('should handle errors from getBankResponseBySearch', async () => {
      getBankResponseBySearch.mockImplementation(() => { throw new Error('Error'); });

      const response = await request(app).get('/');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /BankResponseReports', () => {
    it('should call getBankResponse when authenticated and authorized', async () => {
      getBankResponse.mockImplementation((req, res) => res.status(200).json([{ id: 1 }]));

      const response = await request(app).get('/BankResponseReports');

      expect(response.status).toBe(200);
      expect(getBankResponse).toHaveBeenCalled();
    });

    it('should return 403 if not authorized', async () => {
      isAuthenticated = jest.fn((req, res, next) => next());
      authorized = jest.fn(() => (req, res) => {
        res.status(403).json({ error: 'Unauthorized' });
        return;
      });
      setupApp();
      const response = await request(app).get('/BankResponseReports');
      expect(response.status).toBe(403);
    });

    it('should handle errors from getBankResponse', async () => {
      getBankResponse.mockImplementation(() => { throw new Error('Error'); });

      const response = await request(app).get('/BankResponseReports');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /get-bank-message', () => {
    it('should call getBankMessage when authenticated and authorized', async () => {
      getBankMessage.mockImplementation((req, res) => res.status(200).json({ message: 'test' }));

      const response = await request(app).get('/get-bank-message');

      expect(response.status).toBe(200);
      expect(getBankMessage).toHaveBeenCalled();
    });

    it('should return 403 if not authorized', async () => {
      isAuthenticated = jest.fn((req, res, next) => next());
      authorized = jest.fn(() => (req, res) => {
        res.status(403).json({ error: 'Unauthorized' });
        return;
      });
      setupApp();
      const response = await request(app).get('/get-bank-message');
      expect(response.status).toBe(403);
    });

    it('should handle errors from getBankMessage', async () => {
      getBankMessage.mockImplementation(() => { throw new Error('Error'); });

      const response = await request(app).get('/get-bank-message');

      expect(response.status).toBe(500);
    });
  });

  describe('PUT /update-message/:id', () => {
    it('should call updateBankResponse when authenticated and authorized', async () => {
      updateBankResponse.mockImplementation((req, res) => res.status(200).json({ success: true }));

      const response = await request(app).put('/update-message/1').send({ data: 'updated' });

      expect(response.status).toBe(200);
      expect(updateBankResponse).toHaveBeenCalled();
    });

    it('should return 404 if id not found (assuming controller handles it)', async () => {
      updateBankResponse.mockImplementation((req, res) => res.status(404).json({ error: 'Not found' }));

      const response = await request(app).put('/update-message/999').send({ data: 'updated' });

      expect(response.status).toBe(404);
    });

    it('should return 403 if not authorized', async () => {
      isAuthenticated = jest.fn((req, res, next) => next());
      authorized = jest.fn(() => (req, res) => {
        res.status(403).json({ error: 'Unauthorized' });
        return;
      });
      setupApp();
      const response = await request(app).put('/update-message/1').send({ data: 'updated' });
      expect(response.status).toBe(403);
    });

    it('should handle errors from updateBankResponse', async () => {
      updateBankResponse.mockImplementation(() => { throw new Error('Error'); });

      const response = await request(app).put('/update-message/1').send({ data: 'updated' });

      expect(response.status).toBe(500);
    });

  
  });

  describe('PUT /reset-message/:id', () => {
    it('should call resetBankResponseController when authenticated and authorized', async () => {
      resetBankResponseController.mockImplementation((req, res) => res.status(200).json({ success: true }));

      const response = await request(app).put('/reset-message/1');

      expect(response.status).toBe(200);
      expect(resetBankResponseController).toHaveBeenCalled();
    });

    it('should return 404 if id not found (assuming controller handles it)', async () => {
      resetBankResponseController.mockImplementation((req, res) => res.status(404).json({ error: 'Not found' }));

      const response = await request(app).put('/reset-message/999');

      expect(response.status).toBe(404);
    });

    it('should return 403 if not authorized', async () => {
      isAuthenticated = jest.fn((req, res, next) => next());
      authorized = jest.fn(() => (req, res) => {
        res.status(403).json({ error: 'Unauthorized' });
        return;
      });
      setupApp();
      const response = await request(app).put('/reset-message/1');
      expect(response.status).toBe(403);
    });

    it('should handle errors from resetBankResponseController', async () => {
      resetBankResponseController.mockImplementation(() => { throw new Error('Error'); });

      const response = await request(app).put('/reset-message/1');

      expect(response.status).toBe(500);
    });


  });

  describe('POST /import-bank-response', () => {
    it('should call importBankResponse with file upload when authenticated and authorized', async () => {
      importBankResponse.mockImplementation((req, res) => res.status(201).json({ success: true }));
      multerUpload.single = jest.fn(() => (req, res, next) => next());
      setupApp();
      const response = await request(app)
        .post('/import-bank-response')
        .attach('file', Buffer.from('test content'), 'test.csv');
      expect(response.status).toBe(201);
      expect(importBankResponse).toHaveBeenCalled();
      expect(multerUpload.single).toHaveBeenCalledWith('file');
    });


    it('should return 403 if not authorized', async () => {
      isAuthenticated = jest.fn((req, res, next) => next());
      authorized = jest.fn(() => (req, res) => {
        res.status(403).json({ error: 'Unauthorized' });
        return;
      });
      setupApp();
      const response = await request(app)
        .post('/import-bank-response')
        .attach('file', Buffer.from('test content'), 'test.csv');
      expect(response.status).toBe(403);
    });

    it('should handle errors from importBankResponse', async () => {
      importBankResponse.mockImplementation(() => { throw new Error('Error'); });

      const response = await request(app)
        .post('/import-bank-response')
        .attach('file', Buffer.from('test content'), 'test.csv');

      expect(response.status).toBe(500);
    });
  });