import request from 'supertest';
import express from 'express';
import payInRouter from './index.js';

jest.mock('./payInController.js', () => ({
  generateHashForPayIn: jest.fn((req, res) => res.status(200).json({ message: 'hash generated' })),
  generatePayInUrl: jest.fn((req, res) => res.status(200).json({ url: 'some url' })),
  validatePayInUrl: jest.fn((req, res) => res.status(200).json({ valid: true })),
  generateUpiUrl: jest.fn((req, res) => res.status(200).json({ upiUrl: 'upi://pay' })),
  assignedBankToPayInUrl: jest.fn((req, res) => res.status(200).json({ message: 'bank assigned' })),
  checkPayInStatus: jest.fn((req, res) => res.status(200).json({ status: 'success' })),
  payInIntentGenerateOrder: jest.fn((req, res) => res.status(200).json({ order: 'order123' })),
  processPayIn: jest.fn((req, res) => res.status(200).json({ processed: true })),
  processPayInByImage: jest.fn((req, res) => res.status(200).json({ processedByImage: true })),
  telegramOCR: jest.fn((req, res) => res.status(200).json({ ocr: 'done' })),
  telegramCheckUTR: jest.fn((req, res) => res.status(200).json({ utrChecked: true })),
  updatePaymentNotificationStatus: jest.fn((req, res) => res.status(200).json({ updated: true })),
  updateDepositStatus: jest.fn((req, res) => res.status(200).json({ depositUpdated: true })),
  resetDeposit: jest.fn((req, res) => res.status(200).json({ reset: true })),
  disputeDuplicateTransaction: jest.fn((req, res) => res.status(200).json({ disputed: true })),
  getPayinsBySearch: jest.fn((req, res) => res.status(200).json({ data: [] })),
  processPayInIMGUTR: jest.fn((req, res) => res.status(200).json({ processedImgUtr: true })),
  updateUtrPayins: jest.fn((req, res) => res.status(200).json({ updatedUtr: true })),
  checkPendingPayinStatus: jest.fn((req, res) => res.status(200).json({ pending: false })),
  updatePayIn: jest.fn((req, res) => res.status(200).json({ updatedPayIn: true })),
}));

// jest.mock('../../webhooks/index.js', () => ({
//   payInUpdateCashfreeWebhook: jest.fn((req, res) => res.status(200).json({ webhookUpdated: true })),
// }));

jest.mock('../../utils/index.js', () => ({
  multerUpload: {
    single: () => (req, res, next) => next(),
  },
}));

jest.mock('../../middlewares/auth.js', () => ({
  isAuthenticated: (req, res, next) => next(), 
  authorized: () => (req, res, next) => next(), 
}));

jest.mock('../../middlewares/locationRestrict.js', () => (req, res, next) => next());

jest.mock('../../utils/tryCatchHandler.js', () => (fn) => (req, res, next) => fn(req, res, next));

describe('PayIn Routes', () => {
  let app;
  const payInController = require('./payInController.js');
  // const webhooks = require('../../webhooks/index.js');

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/payin', payInRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /payin/generate-hash - success', async () => {
    const res = await request(app).get('/payin/generate-hash');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'hash generated' });
    expect(payInController.generateHashForPayIn).toHaveBeenCalled();
  });

  test('GET /payin/generate-payin - success', async () => {
    const res = await request(app).get('/payin/generate-payin');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ url: 'some url' });
    expect(payInController.generatePayInUrl).toHaveBeenCalled();
  });

  test('GET /payin/validate-payIn-url/:merchantOrderId - success', async () => {
    const res = await request(app).get('/payin/validate-payIn-url/12345');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ valid: true });
    expect(payInController.validatePayInUrl).toHaveBeenCalled();
  });

  test('POST /payin/generate-upi-url - success', async () => {
    const payload = { amount: 100, userId: 'user1', merchantCode: 'code1' };
    const res = await request(app)
      .post('/payin/generate-upi-url')
      .send(payload);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ upiUrl: 'upi://pay' });
    expect(payInController.generateUpiUrl).toHaveBeenCalledWith(
      expect.objectContaining({ body: payload }),
      expect.anything(),
      expect.anything()
    );
  });

  test('POST /payin/assign-bank/:merchantOrderId - success', async () => {
    const res = await request(app).post('/payin/assign-bank/12345');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'bank assigned' });
    expect(payInController.assignedBankToPayInUrl).toHaveBeenCalled();
  });

  test('POST /payin/check-payin-status - success', async () => {
    const payload = { payInId: '12345' };
    const res = await request(app)
      .post('/payin/check-payin-status')
      .send(payload);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'success' });
    expect(payInController.checkPayInStatus).toHaveBeenCalledWith(
      expect.objectContaining({ body: payload }),
      expect.anything(),
      expect.anything()
    );
  });

  test('POST /payin/generate-intent-order/:payInId - success', async () => {
    const res = await request(app).post('/payin/generate-intent-order/12345');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ order: 'order123' });
    expect(payInController.payInIntentGenerateOrder).toHaveBeenCalled();
  });

  test('POST /payin/process/:merchantOrderId - success', async () => {
    const res = await request(app).post('/payin/process/12345');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ processed: true });
    expect(payInController.processPayIn).toHaveBeenCalled();
  });

  test('POST /payin/process-by-image/:merchantOrderId - success', async () => {
    const res = await request(app).post('/payin/process-by-image/12345');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ processedByImage: true });
    expect(payInController.processPayInByImage).toHaveBeenCalled();
  });

  test('POST /payin/telegram-ocr - success', async () => {
    const res = await request(app).post('/payin/telegram-ocr');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ocr: 'done' });
    expect(payInController.telegramOCR).toHaveBeenCalled();
  });

  test('POST /payin/update-payment-cashfree-webhook - success', async () => {
    const res = await request(app).post('/payin/update-payment-cashfree-webhook');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ webhookUpdated: true });
    // expect(webhooks.payInUpdateCashfreeWebhook).toHaveBeenCalled();
  });

  test('POST /payin/telegram-check-utr - success', async () => {
    const res = await request(app).post('/payin/telegram-check-utr');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ utrChecked: true });
    expect(payInController.telegramCheckUTR).toHaveBeenCalled();
  });

  test('PUT /payin/update-payment-notified-status/:payInId - success', async () => {
    const res = await request(app).put('/payin/update-payment-notified-status/12345');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ updated: true });
    expect(payInController.updatePaymentNotificationStatus).toHaveBeenCalled();
  });

  test('PUT /payin/update-deposit-status/:merchantOrderId - success', async () => {
    const res = await request(app).put('/payin/update-deposit-status/12345');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ depositUpdated: true });
    expect(payInController.updateDepositStatus).toHaveBeenCalled();
  });

  test('POST /payin/reset-payment - success', async () => {
    const res = await request(app).post('/payin/reset-payment');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reset: true });
    expect(payInController.resetDeposit).toHaveBeenCalled();
  });

  test('PUT /payin/dispute-duplicate/:payInId - success', async () => {
    const res = await request(app).put('/payin/dispute-duplicate/12345');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ disputed: true });
    expect(payInController.disputeDuplicateTransaction).toHaveBeenCalled();
  });

  test('GET /payin/ - success', async () => {
    const res = await request(app).get('/payin/');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [] });
    expect(payInController.getPayinsBySearch).toHaveBeenCalled();
  });

  test('POST /payin/processIMGUTR/:merchantOrderId - success', async () => {
    const res = await request(app).post('/payin/processIMGUTR/12345');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ processedImgUtr: true });
    expect(payInController.processPayInIMGUTR).toHaveBeenCalled();
  });

  test('PUT /payin/updateFailedPayinUtr/:id - success', async () => {
    const res = await request(app).put('/payin/updateFailedPayinUtr/12345');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ updatedUtr: true });
    expect(payInController.updateUtrPayins).toHaveBeenCalled();
  });

  test('GET /payin/checkPendingPayinStatus - success', async () => {
    const res = await request(app).get('/payin/checkPendingPayinStatus');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ pending: false });
    expect(payInController.checkPendingPayinStatus).toHaveBeenCalled();
  });

  test('PUT /payin/updatePayin/:merchant_order_id - success', async () => {
    const res = await request(app).put('/payin/updatePayin/12345');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ updatedPayIn: true });
    expect(payInController.updatePayIn).toHaveBeenCalled();
  });

  test('GET /payin/generate-hash - error handling', async () => {
    payInController.generateHashForPayIn.mockImplementationOnce(() => {
      throw new Error('Test error');
    });
    const res = await request(app).get('/payin/generate-hash');
    expect(res.status).toBe(500);
  });
});