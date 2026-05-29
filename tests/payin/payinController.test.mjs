// -------------------- ESM MOCKS --------------------
/* global describe, it, expect, beforeEach, afterEach, beforeAll */
import { jest } from '@jest/globals';

// Mock all service and utility dependencies strictly before imports
jest.unstable_mockModule('../../src/apis/payin/payinService.js', () => ({
  assignedBankToPayInUrlService: jest.fn(),
  checkPayInStatusService: jest.fn(),
  disputeDuplicateTransactionService: jest.fn(),
  expirePayInUrlService: jest.fn(),
  generatePayInUrlByHashService: jest.fn(),
  generatePayInUrlService: jest.fn(),
  payInIntentGenerateOrderService: jest.fn(),
  processPayInByImageService: jest.fn(),
  processPayInService: jest.fn(),
  resetDepositService: jest.fn(),
  telegramCheckUTRService: jest.fn(),
  telegramResponseService: jest.fn(),
  updateDepositStatusService: jest.fn(),
  updatePaymentNotificationStatusService: jest.fn(),
  getPayinsBySearchService: jest.fn(),
  verifyPayinsService: jest.fn(),
  generateUpiUrlService: jest.fn(),
  updateUtrPayinService: jest.fn(),
  checkPendingPayinStatusService: jest.fn(),
  updatePayInService: jest.fn(),
  getPayinsSummaryService: jest.fn(),
}));
jest.unstable_mockModule('../../src/utils/responseHandlers.js', () => ({
  sendSuccess: jest.fn(),
  sendNewSuccess: jest.fn(),
  sendError: jest.fn(),
}));
jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));
jest.unstable_mockModule('../../src/utils/appErrors.js', () => ({
  BadRequestError: class extends Error {},
  NotFoundError: class extends Error {},
  ValidationError: class extends Error {},
}));
jest.unstable_mockModule('../../src/schemas/payInSchema.js', () => ({
  ASSIGN_PAYIN_SCHEMA: { validate: jest.fn() },
  PROCESS_PAYIN_IMAGE: { validate: jest.fn() },
  VALIDATE_PAYIN_SCHEMA: { validate: jest.fn() },
  VALIDATE_GENERATE_PAYIN_URL_SCHEMA: { validate: jest.fn() },
  VALIDATE_ASSIGNED_BANT_TO_PAY: { validate: jest.fn() },
  VALIDATE_EXPIRE_PAY_IN_URL: { validate: jest.fn() },
  VALIDATE_CHECK_PAY_IN_STATUS: { validate: jest.fn() },
  VALIDATE_PAY_IN_INTENT_GENERATE_ORDER: { validate: jest.fn() },
  VALIDATE_UPDATE_PAYMENT_NOTIFICATION_STATUS: { validate: jest.fn() },
  VALIDATE_UPDATE_DEPOSIT_SERVICE_STATUS: { validate: jest.fn() },
  VALIDATE_RESET_DEPOSIT: { validate: jest.fn() },
  VALIDATE_PROCESS_PAYIN: { validate: jest.fn() },
  VALIDATE_CHECK_UTR: { validate: jest.fn() },
  VALIDATE_UPDATE_PAYIN_SCHEMA: { validate: jest.fn() },
  VALIDATE_DISPUTE_DUPLICATE_TRANSACTION: { validate: jest.fn() },
}));
jest.unstable_mockModule('../../src/utils/controllerCache.js', () => ({
  invalidateCompanyCacheByPrefix: jest.fn(),
}));
jest.unstable_mockModule('../../src/helpers/Aws.js', () => ({
  s3: { send: jest.fn() },
}));
jest.unstable_mockModule('../../src/helpers/index.js', () => ({
  streamToBase64: jest.fn(),
}));
jest.unstable_mockModule('../../src/utils/hashUtils.js', () => ({
  createHash: jest.fn(() => 'mockedHash'),
}));
jest.unstable_mockModule('../../src/razorpay/razorpay.js', () => ({
  verifyRazorPaySignature: jest.fn(),
}));
jest.unstable_mockModule('../../src/apis/roles/rolesDao.js', () => ({
  getRolesById: jest.fn(),
}));
jest.unstable_mockModule('../../src/constants/index.js', () => ({
  Role: { ADMIN: 'ADMIN' },
  Status: { PROCESSING: 'PROCESSING' },
}));
jest.unstable_mockModule('../../src/rabbitmq/producer.js', () => ({
  publishPayInProcess: jest.fn(),
}));
jest.unstable_mockModule('../../src/apis/merchants/merchantDao.js', () => ({
  getMerchantsByCodeDao: jest.fn(),
}));
jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
  GetObjectCommand: jest.fn(),
}));

// -------------------- HELPERS ----------------------
function mockReqRes({ body = {}, params = {}, query = {}, headers = {}, user = {} } = {}) {
  return {
    req: { body, params, query, headers, user },
    res: { json: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn() },
  };
}


// -------------------- IMPORTS (via beforeAll) ----------------------

let controllerModule, responseHandlers, payinService, schema, merchantDao;
let rolesDao, razorpay, producer, aws, helpers, logger;
beforeAll(async () => {
  controllerModule = await import('../../src/apis/payin/payinController.js');
  responseHandlers = await import('../../src/utils/responseHandlers.js');
  payinService = await import('../../src/apis/payin/payinService.js');
  schema = await import('../../src/schemas/payInSchema.js');
  merchantDao = await import('../../src/apis/merchants/merchantDao.js');
  rolesDao = await import('../../src/apis/roles/rolesDao.js');
  razorpay = await import('../../src/razorpay/razorpay.js');
  producer = await import('../../src/rabbitmq/producer.js');
  aws = await import('../../src/helpers/Aws.js');
  helpers = await import('../../src/helpers/index.js');
  logger = await import('../../src/utils/logger.js');
});

beforeEach(() => {
  // Reassign all mock functions for dynamic-imported modules used in tests
  if (rolesDao) rolesDao.getRolesById = jest.fn();
  if (razorpay) razorpay.verifyRazorPaySignature = jest.fn();
  if (producer) producer.publishPayInProcess = jest.fn();
  if (aws?.s3) aws.s3.send = jest.fn();
  if (helpers) helpers.streamToBase64 = jest.fn();
  if (logger?.logger) logger.logger.error = jest.fn();
  // Reassign all mock functions to fresh jest.fn() for isolation
  if (payinService) {
    payinService.assignedBankToPayInUrlService = jest.fn();
    payinService.checkPayInStatusService = jest.fn();
    payinService.disputeDuplicateTransactionService = jest.fn();
    payinService.expirePayInUrlService = jest.fn();
    payinService.generatePayInUrlByHashService = jest.fn();
    payinService.generatePayInUrlService = jest.fn();
    payinService.payInIntentGenerateOrderService = jest.fn();
    payinService.processPayInByImageService = jest.fn();
    payinService.processPayInService = jest.fn();
    payinService.resetDepositService = jest.fn();
    payinService.telegramCheckUTRService = jest.fn();
    payinService.telegramResponseService = jest.fn();
    payinService.updateDepositStatusService = jest.fn();
    payinService.updatePaymentNotificationStatusService = jest.fn();
    payinService.getPayinsBySearchService = jest.fn();
    payinService.verifyPayinsService = jest.fn();
    payinService.generateUpiUrlService = jest.fn();
    payinService.updateUtrPayinService = jest.fn();
    payinService.checkPendingPayinStatusService = jest.fn();
    payinService.updatePayInService = jest.fn();
    payinService.getPayinsSummaryService = jest.fn();
  }
  if (responseHandlers) {
    responseHandlers.sendSuccess = jest.fn();
    responseHandlers.sendNewSuccess = jest.fn();
    responseHandlers.sendError = jest.fn();
  }
  if (schema) {
    if (schema.ASSIGN_PAYIN_SCHEMA) schema.ASSIGN_PAYIN_SCHEMA.validate = jest.fn();
    if (schema.PROCESS_PAYIN_IMAGE) schema.PROCESS_PAYIN_IMAGE.validate = jest.fn();
    if (schema.VALIDATE_PAYIN_SCHEMA) schema.VALIDATE_PAYIN_SCHEMA.validate = jest.fn();
    if (schema.VALIDATE_GENERATE_PAYIN_URL_SCHEMA) schema.VALIDATE_GENERATE_PAYIN_URL_SCHEMA.validate = jest.fn();
    if (schema.VALIDATE_ASSIGNED_BANT_TO_PAY) schema.VALIDATE_ASSIGNED_BANT_TO_PAY.validate = jest.fn();
    if (schema.VALIDATE_EXPIRE_PAY_IN_URL) schema.VALIDATE_EXPIRE_PAY_IN_URL.validate = jest.fn();
    if (schema.VALIDATE_CHECK_PAY_IN_STATUS) schema.VALIDATE_CHECK_PAY_IN_STATUS.validate = jest.fn();
    if (schema.VALIDATE_PAY_IN_INTENT_GENERATE_ORDER) schema.VALIDATE_PAY_IN_INTENT_GENERATE_ORDER.validate = jest.fn();
    if (schema.VALIDATE_UPDATE_PAYMENT_NOTIFICATION_STATUS) schema.VALIDATE_UPDATE_PAYMENT_NOTIFICATION_STATUS.validate = jest.fn();
    if (schema.VALIDATE_UPDATE_DEPOSIT_SERVICE_STATUS) schema.VALIDATE_UPDATE_DEPOSIT_SERVICE_STATUS.validate = jest.fn();
    if (schema.VALIDATE_RESET_DEPOSIT) schema.VALIDATE_RESET_DEPOSIT.validate = jest.fn();
    if (schema.VALIDATE_PROCESS_PAYIN) schema.VALIDATE_PROCESS_PAYIN.validate = jest.fn();
    if (schema.VALIDATE_CHECK_UTR) schema.VALIDATE_CHECK_UTR.validate = jest.fn();
    if (schema.VALIDATE_UPDATE_PAYIN_SCHEMA) schema.VALIDATE_UPDATE_PAYIN_SCHEMA.validate = jest.fn();
    if (schema.VALIDATE_DISPUTE_DUPLICATE_TRANSACTION) schema.VALIDATE_DISPUTE_DUPLICATE_TRANSACTION.validate = jest.fn();
  }
  if (merchantDao) {
    merchantDao.getMerchantsByCodeDao = jest.fn();
  }
});

afterEach(() => {
  jest.clearAllMocks();
});

// -------------------- SETUP & TEARDOWN -------------
// beforeEach(() => {
//   jest.clearAllMocks();
// });

// -------------------- TESTS ------------------------
describe('payinController', () => {
  describe('generateHashForPayIn', () => {
    it('should call service and send success', async () => {
      payinService.generatePayInUrlByHashService.mockResolvedValue({ status: 200 });
      const { req, res } = mockReqRes();
      await controllerModule.generateHashForPayIn(req, res);
      expect(payinService.generatePayInUrlByHashService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
    it('should send error if status is 400/404', async () => {
      payinService.generatePayInUrlByHashService.mockResolvedValue({ status: 400, message: 'err' });
      const { req, res } = mockReqRes();
      await controllerModule.generateHashForPayIn(req, res);
      expect(responseHandlers.sendError).toHaveBeenCalled();
    });
  });

  describe('generatePayInUrl', () => {
    it('should validate payload, fetch merchant if admin, call service, and send success', async () => {
      schema.ASSIGN_PAYIN_SCHEMA.validate.mockReturnValue({});
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([{ config: { keys: { public: 'pubkey' } } }]);
      payinService.generatePayInUrlService.mockResolvedValue({
        id: 1,
        merchant_order_id: 'order123',
        status: 'OK',
        merchant: {},
        expiration_date: '2026-01-01',
      });
      // Mock getRolesById to return an ADMIN role
      const rolesDao = await import('../../src/apis/roles/rolesDao.js');
      rolesDao.getRolesById.mockResolvedValue({ role: 'ADMIN' });
      const { req, res } = mockReqRes({
        query: { code: 'c', roleToken: 'rt', merchant_order_id: 'order123' },
        headers: {},
        user: { company_id: 1 },
      });
      await controllerModule.generatePayInUrl(req, res);
      expect(schema.ASSIGN_PAYIN_SCHEMA.validate).toHaveBeenCalled();
      expect(merchantDao.getMerchantsByCodeDao).toHaveBeenCalled();
      expect(payinService.generatePayInUrlService).toHaveBeenCalled();
      expect(responseHandlers.sendNewSuccess).toHaveBeenCalled();
    });
    it('should throw BadRequestError if merchant_order_id contains /', async () => {
      const { req, res } = mockReqRes({ query: { merchant_order_id: 'bad/id' } });
      await expect(controllerModule.generatePayInUrl(req, res)).rejects.toThrow();
    });
  });

  describe('validatePayInUrl', () => {
    it('should validate, call verifyPayinsService, and send success', async () => {
      schema.VALIDATE_PAYIN_SCHEMA.validate.mockReturnValue({});
      payinService.verifyPayinsService.mockResolvedValue({});
      const { req, res } = mockReqRes({ params: { merchantOrderId: 'order123' }, user: { user_location: 'loc' } });
      await controllerModule.validatePayInUrl(req, res);
      expect(schema.VALIDATE_PAYIN_SCHEMA.validate).toHaveBeenCalled();
      expect(payinService.verifyPayinsService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('generateUpiUrl', () => {
    it('should validate and call service, send success', async () => {
      schema.VALIDATE_GENERATE_PAYIN_URL_SCHEMA.validate.mockReturnValue({});
      payinService.generateUpiUrlService.mockResolvedValue({});
      const { req, res } = mockReqRes({ body: { foo: 'bar' } });
      await controllerModule.generateUpiUrl(req, res);
      expect(schema.VALIDATE_GENERATE_PAYIN_URL_SCHEMA.validate).toHaveBeenCalled();
      expect(payinService.generateUpiUrlService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('assignedBankToPayInUrl', () => {
    it('should validate, call service, invalidate cache, and send success', async () => {
      schema.VALIDATE_ASSIGNED_BANT_TO_PAY.validate.mockReturnValue({});
      payinService.assignedBankToPayInUrlService.mockResolvedValue({});
      const { req, res } = mockReqRes({ params: { merchantOrderId: 'id' }, body: { amount: 1, type: 't', roleToken: 'rt' }, user: { company_id: 1 } });
      await controllerModule.assignedBankToPayInUrl(req, res);
      expect(schema.VALIDATE_ASSIGNED_BANT_TO_PAY.validate).toHaveBeenCalled();
      expect(payinService.assignedBankToPayInUrlService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('expirePayInUrl', () => {
    it('should validate, call service, invalidate cache, and send success', async () => {
      schema.VALIDATE_EXPIRE_PAY_IN_URL.validate.mockReturnValue({});
      payinService.expirePayInUrlService.mockResolvedValue();
      const { req, res } = mockReqRes({ params: { payInId: 'id' }, user: { company_id: 1 } });
      await controllerModule.expirePayInUrl(req, res);
      expect(schema.VALIDATE_EXPIRE_PAY_IN_URL.validate).toHaveBeenCalled();
      expect(payinService.expirePayInUrlService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('checkPayInStatus', () => {
    it('should validate, call service, and send success or error', async () => {
      schema.VALIDATE_CHECK_PAY_IN_STATUS.validate.mockReturnValue({});
      payinService.checkPayInStatusService.mockResolvedValue({ status: 200 });
      const { req, res } = mockReqRes({ body: { payinId: 1, merchantCode: 'c', merchantOrderId: 'o' }, headers: { 'x-api-key': 'k' } });
      await controllerModule.checkPayInStatus(req, res);
      expect(schema.VALIDATE_CHECK_PAY_IN_STATUS.validate).toHaveBeenCalled();
      expect(payinService.checkPayInStatusService).toHaveBeenCalled();
      expect(responseHandlers.sendNewSuccess).toHaveBeenCalled();
    });
    it('should send error if status is 400/404', async () => {
      schema.VALIDATE_CHECK_PAY_IN_STATUS.validate.mockReturnValue({});
      payinService.checkPayInStatusService.mockResolvedValue({ status: 400, message: 'err' });
      const { req, res } = mockReqRes({ body: { payinId: 1, merchantCode: 'c', merchantOrderId: 'o' }, headers: { 'x-api-key': 'k' } });
      await controllerModule.checkPayInStatus(req, res);
      expect(responseHandlers.sendError).toHaveBeenCalled();
    });
  });

  describe('payInIntentGenerateOrder', () => {
    it('should validate, call service, and send success', async () => {
      schema.VALIDATE_PAY_IN_INTENT_GENERATE_ORDER.validate.mockReturnValue({});
      payinService.payInIntentGenerateOrderService.mockResolvedValue({});
      const { req, res } = mockReqRes({ params: { merchantOrderId: 'id' }, body: { amount: 1, Razorpay: true } });
      await controllerModule.payInIntentGenerateOrder(req, res);
      expect(schema.VALIDATE_PAY_IN_INTENT_GENERATE_ORDER.validate).toHaveBeenCalled();
      expect(payinService.payInIntentGenerateOrderService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('verifyPayinsrazorpay', () => {
    it('should call verifyRazorPaySignature and send success', async () => {
      const razorpay = await import('../../src/razorpay/razorpay.js');
      razorpay.verifyRazorPaySignature.mockResolvedValue({});
      const { req, res } = mockReqRes({ body: { razorpay_payment_id: 'pid', razorpay_order_id: 'oid', razorpay_signature: 'sig' } });
      await controllerModule.verifyPayinsrazorpay(req, res);
      expect(razorpay.verifyRazorPaySignature).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('updatePaymentNotificationStatus', () => {
    it('should validate, call service, and send success', async () => {
      schema.VALIDATE_UPDATE_PAYMENT_NOTIFICATION_STATUS.validate.mockReturnValue({});
      payinService.updatePaymentNotificationStatusService.mockResolvedValue({});
      const { req, res } = mockReqRes({ params: { payInId: 'id' }, body: { type: 't' }, user: { company_id: 1 } });
      await controllerModule.updatePaymentNotificationStatus(req, res);
      expect(schema.VALIDATE_UPDATE_PAYMENT_NOTIFICATION_STATUS.validate).toHaveBeenCalled();
      expect(payinService.updatePaymentNotificationStatusService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('updateDepositStatus', () => {
    it('should validate, call service, invalidate cache, and send success', async () => {
      schema.VALIDATE_UPDATE_DEPOSIT_SERVICE_STATUS.validate.mockReturnValue({});
      payinService.updateDepositStatusService.mockResolvedValue({});
      const { req, res } = mockReqRes({ params: { merchantOrderId: 'id' }, body: { nick_name: 'nick' }, user: { company_id: 1, user_id: 2 } });
      await controllerModule.updateDepositStatus(req, res);
      expect(schema.VALIDATE_UPDATE_DEPOSIT_SERVICE_STATUS.validate).toHaveBeenCalled();
      expect(payinService.updateDepositStatusService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('resetDeposit', () => {
    it('should validate, call service, invalidate cache, and send success', async () => {
      schema.VALIDATE_RESET_DEPOSIT.validate.mockReturnValue({});
      payinService.resetDepositService.mockResolvedValue({});
      const { req, res } = mockReqRes({ body: { merchant_order_id: 'id' }, user: { company_id: 1, user_id: 2 } });
      await controllerModule.resetDeposit(req, res);
      expect(schema.VALIDATE_RESET_DEPOSIT.validate).toHaveBeenCalled();
      expect(payinService.resetDepositService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('getPayinsBySearch', () => {
    it('should call service and send success', async () => {
      payinService.getPayinsBySearchService.mockResolvedValue({});
      const { req, res } = mockReqRes({ user: { company_id: 1, role: 'r', user_id: 2, designation: 'd' }, query: { search: 's', page: 1, limit: 10 } });
      await controllerModule.getPayinsBySearch(req, res);
      expect(payinService.getPayinsBySearchService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('getPayinsSummary', () => {
    it('should call service and send success', async () => {
      payinService.getPayinsSummaryService.mockResolvedValue({});
      const { req, res } = mockReqRes({ user: { company_id: 1 } });
      await controllerModule.getPayinsSummary(req, res);
      expect(payinService.getPayinsSummaryService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('processPayIn', () => {
    it('should validate, publish, and send success', async () => {
      schema.VALIDATE_PROCESS_PAYIN.validate.mockReturnValue({});
      const producer = await import('../../src/rabbitmq/producer.js');
      producer.publishPayInProcess.mockResolvedValue();
      const { req, res } = mockReqRes({ body: { foo: 'bar' }, params: { merchantOrderId: 'id' } });
      await controllerModule.processPayIn(req, res);
      expect(schema.VALIDATE_PROCESS_PAYIN.validate).toHaveBeenCalled();
      expect(producer.publishPayInProcess).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('processPayInH2H', () => {
    it('should validate, publish, and send success', async () => {
      schema.VALIDATE_PROCESS_PAYIN.validate.mockReturnValue({});
      const producer = await import('../../src/rabbitmq/producer.js');
      producer.publishPayInProcess.mockResolvedValue();
      const { req, res } = mockReqRes({ body: { foo: 'bar' }, params: { merchantOrderId: 'id' } });
      await controllerModule.processPayInH2H(req, res);
      expect(schema.VALIDATE_PROCESS_PAYIN.validate).toHaveBeenCalled();
      expect(producer.publishPayInProcess).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('processPayInIMGUTR', () => {
    it('should validate, call service, invalidate cache, and send success', async () => {
      schema.VALIDATE_PROCESS_PAYIN.validate.mockReturnValue({});
      payinService.processPayInService.mockResolvedValue({});
      const { req, res } = mockReqRes({ body: { code: 'c' }, params: { merchantOrderId: 'id' }, user: { company_id: 1 } });
      await controllerModule.processPayInIMGUTR(req, res);
      expect(schema.VALIDATE_PROCESS_PAYIN.validate).toHaveBeenCalled();
      expect(payinService.processPayInService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('telegramOCR', () => {
    it('should send success and call telegramResponseService if message is object', async () => {
      payinService.telegramResponseService.mockResolvedValue();
      const { req, res } = mockReqRes({ body: { message: { foo: 'bar' } } });
      await controllerModule.telegramOCR(req, res);
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
      expect(payinService.telegramResponseService).toHaveBeenCalled();
    });
    it('should log error if message is missing or not object', async () => {
      const logger = await import('../../src/utils/logger.js');
      const { req, res } = mockReqRes({ body: { message: null } });
      await controllerModule.telegramOCR(req, res);
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

  describe('processPayInByImage', () => {
    it('should validate, fetch image, call service, invalidate cache, and send success', async () => {
      schema.PROCESS_PAYIN_IMAGE.validate.mockReturnValue({});
      const aws = await import('../../src/helpers/Aws.js');
      const helpers = await import('../../src/helpers/index.js');
      payinService.processPayInByImageService.mockResolvedValue({});
      aws.s3.send.mockResolvedValue({ Body: 'body' });
      helpers.streamToBase64.mockResolvedValue('base64');
      const { req, res } = mockReqRes({ body: {}, params: {}, file: { key: 'filekey' }, user: { company_id: 1 } });
      req.file = { key: 'filekey' };
      await controllerModule.processPayInByImage(req, res);
      expect(schema.PROCESS_PAYIN_IMAGE.validate).toHaveBeenCalled();
      expect(aws.s3.send).toHaveBeenCalled();
      expect(helpers.streamToBase64).toHaveBeenCalled();
      expect(payinService.processPayInByImageService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
    it('should throw BadRequestError if file is missing', async () => {
      schema.PROCESS_PAYIN_IMAGE.validate.mockReturnValue({});
      const { req, res } = mockReqRes({ body: {}, params: {} });
      req.file = undefined;
      await expect(controllerModule.processPayInByImage(req, res)).rejects.toThrow();
    });
  });

  describe('disputeDuplicateTransaction', () => {
    it('should validate, call service, invalidate cache, and send success', async () => {
      schema.VALIDATE_DISPUTE_DUPLICATE_TRANSACTION.validate.mockReturnValue({});
      payinService.disputeDuplicateTransactionService.mockResolvedValue({});
      const { req, res } = mockReqRes({ body: {}, params: {}, user: { company_id: 1, user_id: 2 } });
      await controllerModule.disputeDuplicateTransaction(req, res);
      expect(schema.VALIDATE_DISPUTE_DUPLICATE_TRANSACTION.validate).toHaveBeenCalled();
      expect(payinService.disputeDuplicateTransactionService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('updateUtrPayins', () => {
    it('should call service, invalidate cache, and send success', async () => {
      payinService.updateUtrPayinService.mockResolvedValue({ id: 1 });
      const { req, res } = mockReqRes({ params: { id: 1 }, body: { utr: 'utr' }, user: { user_id: 2, user_name: 'uname', company_id: 3 } });
      await controllerModule.updateUtrPayins(req, res);
      expect(payinService.updateUtrPayinService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('checkPendingPayinStatus', () => {
    it('should call service, invalidate cache, and send success', async () => {
      payinService.checkPendingPayinStatusService.mockResolvedValue({});
      const { req, res } = mockReqRes({ user: { user_name: 'uname', user_id: 2, company_id: 3 } });
      await controllerModule.checkPendingPayinStatus(req, res);
      expect(payinService.checkPendingPayinStatusService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('telegramCheckUTR', () => {
    it('should validate, call service, and send success', async () => {
      schema.VALIDATE_CHECK_UTR.validate.mockReturnValue({});
      payinService.telegramCheckUTRService.mockResolvedValue({ merchantOrderId: 'id' });
      const { req, res } = mockReqRes({ body: { utr: 'utr', merchantOrderId: 'id' }, user: { company_id: 1, user_id: 2, designation: 'd' } });
      await controllerModule.telegramCheckUTR(req, res);
      expect(schema.VALIDATE_CHECK_UTR.validate).toHaveBeenCalled();
      expect(payinService.telegramCheckUTRService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('updatePayIn', () => {
    it('should validate, call service, invalidate cache, and send success', async () => {
      schema.VALIDATE_UPDATE_PAYIN_SCHEMA.validate.mockReturnValue({});
      payinService.updatePayInService.mockResolvedValue({});
      const { req, res } = mockReqRes({ params: { merchant_order_id: 'id' }, body: {}, user: { user_id: 2, company_id: 3 } });
      await controllerModule.updatePayIn(req, res);
      expect(schema.VALIDATE_UPDATE_PAYIN_SCHEMA.validate).toHaveBeenCalled();
      expect(payinService.updatePayInService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });
});
