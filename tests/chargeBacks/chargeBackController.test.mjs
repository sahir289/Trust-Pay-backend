// -------------------- ESM MOCKS --------------------
/* global describe, it, expect, beforeEach, afterEach, beforeAll */
import { jest } from '@jest/globals';

// Mock all service and utility dependencies strictly before imports
jest.unstable_mockModule('../../src/apis/chargeBacks/chargeBackService.js', () => ({
  createChargeBackService: jest.fn(),
  getChargeBacksService: jest.fn(),
  updateChargeBackService: jest.fn(),
  deleteChargeBackService: jest.fn(),
  getChargeBacksBySearchService: jest.fn(),
  blockChargebackUserService: jest.fn(),
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
jest.unstable_mockModule('../../src/schemas/chargeBackSchema.js', () => ({
  VALIDATE_CHARGEBACK_SCHEMA: { validate: jest.fn() },
  VALIDATE_CHARGEBACK_BY_ID: { validate: jest.fn() },
  VALIDATE_DELETE_CHARGEBACK: { validate: jest.fn() },
  VALIDATE_UPDATE_CHARGEBACK_SCHEMA: { validate: jest.fn() },
}));
jest.unstable_mockModule('../../src/apis/payIn/payInDao.js', () => ({
  getPayinDetailsByMerchantOrderId: jest.fn(),
}));
jest.unstable_mockModule('../../src/apis/chargeBacks/chargeBackDao.js', () => ({
  chargeBackExistsByPayinIdDao: jest.fn(),
}));
jest.unstable_mockModule('../../src/apis/bankResponse/bankResponseDao.js', () => ({
  getBankResponseDaoById: jest.fn(),
}));
jest.unstable_mockModule('../../src/constants/index.js', () => ({
  Status: {
    ASSIGNED: 'ASSIGNED',
    INITIATED: 'INITIATED',
    FAILED: 'FAILED',
    BANK_MISMATCH: 'BANK_MISMATCH',
    COMPLETED: 'COMPLETED',
  },
}));

// -------------------- HELPERS ----------------------
function mockReqRes({ body = {}, params = {}, query = {}, headers = {}, user = {} } = {}) {
  return {
    req: { body, params, query, headers, user },
    res: { json: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn() },
  };
}

// -------------------- IMPORTS (via beforeAll) ----------------------
let controllerModule, responseHandlers, chargeBackService, schema;
let payInDao, chargeBackDao, bankResponseDao, logger;

beforeAll(async () => {
  controllerModule = await import('../../src/apis/chargeBacks/chargeBackController.js');
  responseHandlers = await import('../../src/utils/responseHandlers.js');
  chargeBackService = await import('../../src/apis/chargeBacks/chargeBackService.js');
  schema = await import('../../src/schemas/chargeBackSchema.js');
  payInDao = await import('../../src/apis/payIn/payInDao.js');
  chargeBackDao = await import('../../src/apis/chargeBacks/chargeBackDao.js');
  bankResponseDao = await import('../../src/apis/bankResponse/bankResponseDao.js');
  logger = await import('../../src/utils/logger.js');
});

beforeEach(() => {
  // Reassign all mock functions for dynamic-imported modules used in tests
  if (logger?.logger) logger.logger.error = jest.fn();

  // Reassign all mock functions to fresh jest.fn() for isolation
  if (chargeBackService) {
    chargeBackService.createChargeBackService = jest.fn();
    chargeBackService.getChargeBacksService = jest.fn();
    chargeBackService.updateChargeBackService = jest.fn();
    chargeBackService.deleteChargeBackService = jest.fn();
    chargeBackService.getChargeBacksBySearchService = jest.fn();
    chargeBackService.blockChargebackUserService = jest.fn();
  }
  if (responseHandlers) {
    responseHandlers.sendSuccess = jest.fn();
    responseHandlers.sendNewSuccess = jest.fn();
    responseHandlers.sendError = jest.fn();
  }
  if (schema) {
    if (schema.VALIDATE_CHARGEBACK_SCHEMA) schema.VALIDATE_CHARGEBACK_SCHEMA.validate = jest.fn();
    if (schema.VALIDATE_CHARGEBACK_BY_ID) schema.VALIDATE_CHARGEBACK_BY_ID.validate = jest.fn();
    if (schema.VALIDATE_DELETE_CHARGEBACK) schema.VALIDATE_DELETE_CHARGEBACK.validate = jest.fn();
    if (schema.VALIDATE_UPDATE_CHARGEBACK_SCHEMA) schema.VALIDATE_UPDATE_CHARGEBACK_SCHEMA.validate = jest.fn();
  }
  if (payInDao) {
    payInDao.getPayinDetailsByMerchantOrderId = jest.fn();
  }
  if (chargeBackDao) {
    chargeBackDao.chargeBackExistsByPayinIdDao = jest.fn();
  }
  if (bankResponseDao) {
    bankResponseDao.getBankResponseDaoById = jest.fn();
  }
});

afterEach(() => {
  jest.clearAllMocks();
});

// -------------------- TESTS ------------------------
describe('chargeBackController', () => {
  describe('createChargeBack', () => {
    it('should validate payload, check payin details, create chargeback, and send success', async () => {
      schema.VALIDATE_CHARGEBACK_SCHEMA.validate.mockReturnValue({});
      const mockPayinDetails = [
        {
          payin_id: 1,
          merchant_order_id: 'order123',
          status: 'COMPLETED',
          bank_response_id: 1,
        },
      ];
      payInDao.getPayinDetailsByMerchantOrderId.mockResolvedValue(mockPayinDetails);
      chargeBackDao.chargeBackExistsByPayinIdDao.mockResolvedValue(false);
      bankResponseDao.getBankResponseDaoById.mockResolvedValue({
        user_id: 'vendor1',
        bank_id: 'bank1',
        utr: 'utr123',
      });
      chargeBackService.createChargeBackService.mockResolvedValue({ id: 1 });
      const { req, res } = mockReqRes({
        body: { merchant_order_id: 'order123', amount: 1000 },
        user: { company_id: 1, role: 'ADMIN', user_id: 2, user_name: 'John' },
      });
      await controllerModule.createChargeBack(req, res);
      expect(schema.VALIDATE_CHARGEBACK_SCHEMA.validate).toHaveBeenCalled();
      expect(payInDao.getPayinDetailsByMerchantOrderId).toHaveBeenCalled();
      expect(chargeBackDao.chargeBackExistsByPayinIdDao).toHaveBeenCalled();
      expect(chargeBackService.createChargeBackService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });

    it('should throw ValidationError if validation fails', async () => {
      schema.VALIDATE_CHARGEBACK_SCHEMA.validate.mockReturnValue({ error: 'Invalid payload' });
      const { req, res } = mockReqRes({
        body: { invalid: 'data' },
        user: { company_id: 1, role: 'ADMIN', user_id: 2, user_name: 'John' },
      });
      await expect(controllerModule.createChargeBack(req, res)).rejects.toThrow();
    });

    it('should throw NotFoundError if payin details are empty', async () => {
      schema.VALIDATE_CHARGEBACK_SCHEMA.validate.mockReturnValue({});
      payInDao.getPayinDetailsByMerchantOrderId.mockResolvedValue([]);
      const { req, res } = mockReqRes({
        body: { merchant_order_id: 'invalid_order' },
        user: { company_id: 1, role: 'ADMIN', user_id: 2, user_name: 'John' },
      });
      await expect(controllerModule.createChargeBack(req, res)).rejects.toThrow();
    });

    it('should throw NotFoundError if chargeback already exists', async () => {
      schema.VALIDATE_CHARGEBACK_SCHEMA.validate.mockReturnValue({});
      const mockPayinDetails = [
        { payin_id: 1, merchant_order_id: 'order123', status: 'COMPLETED' },
      ];
      payInDao.getPayinDetailsByMerchantOrderId.mockResolvedValue(mockPayinDetails);
      chargeBackDao.chargeBackExistsByPayinIdDao.mockResolvedValue(true);
      const { req, res } = mockReqRes({
        body: { merchant_order_id: 'order123' },
        user: { company_id: 1, role: 'ADMIN', user_id: 2, user_name: 'John' },
      });
      await expect(controllerModule.createChargeBack(req, res)).rejects.toThrow();
    });

    it('should throw NotFoundError if payin is in ASSIGNED status', async () => {
      schema.VALIDATE_CHARGEBACK_SCHEMA.validate.mockReturnValue({});
      const mockPayinDetails = [
        { payin_id: 1, merchant_order_id: 'order123', status: 'ASSIGNED' },
      ];
      payInDao.getPayinDetailsByMerchantOrderId.mockResolvedValue(mockPayinDetails);
      chargeBackDao.chargeBackExistsByPayinIdDao.mockResolvedValue(false);
      const { req, res } = mockReqRes({
        body: { merchant_order_id: 'order123' },
        user: { company_id: 1, role: 'ADMIN', user_id: 2, user_name: 'John' },
      });
      await expect(controllerModule.createChargeBack(req, res)).rejects.toThrow();
    });

    it('should throw NotFoundError if payin is in INITIATED status', async () => {
      schema.VALIDATE_CHARGEBACK_SCHEMA.validate.mockReturnValue({});
      const mockPayinDetails = [
        { payin_id: 1, merchant_order_id: 'order123', status: 'INITIATED' },
      ];
      payInDao.getPayinDetailsByMerchantOrderId.mockResolvedValue(mockPayinDetails);
      chargeBackDao.chargeBackExistsByPayinIdDao.mockResolvedValue(false);
      const { req, res } = mockReqRes({
        body: { merchant_order_id: 'order123' },
        user: { company_id: 1, role: 'ADMIN', user_id: 2, user_name: 'John' },
      });
      await expect(controllerModule.createChargeBack(req, res)).rejects.toThrow();
    });

    it('should throw NotFoundError if payin is FAILED with no bank_response_id', async () => {
      schema.VALIDATE_CHARGEBACK_SCHEMA.validate.mockReturnValue({});
      const mockPayinDetails = [
        {
          payin_id: 1,
          merchant_order_id: 'order123',
          status: 'FAILED',
          bank_response_id: null,
        },
      ];
      payInDao.getPayinDetailsByMerchantOrderId.mockResolvedValue(mockPayinDetails);
      chargeBackDao.chargeBackExistsByPayinIdDao.mockResolvedValue(false);
      const { req, res } = mockReqRes({
        body: { merchant_order_id: 'order123' },
        user: { company_id: 1, role: 'ADMIN', user_id: 2, user_name: 'John' },
      });
      await expect(controllerModule.createChargeBack(req, res)).rejects.toThrow();
    });
  });

  describe('getChargeBacksById', () => {
    it('should validate params, call service, and send success', async () => {
      schema.VALIDATE_CHARGEBACK_BY_ID.validate.mockReturnValue({});
      chargeBackService.getChargeBacksService.mockResolvedValue({ id: 1, status: 'COMPLETED' });
      const { req, res } = mockReqRes({
        params: { id: 1 },
        user: { company_id: 1, role: 'ADMIN' },
      });
      await controllerModule.getChargeBacksById(req, res);
      expect(schema.VALIDATE_CHARGEBACK_BY_ID.validate).toHaveBeenCalled();
      expect(chargeBackService.getChargeBacksService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });

    it('should throw ValidationError if params validation fails', async () => {
      schema.VALIDATE_CHARGEBACK_BY_ID.validate.mockReturnValue({ error: 'Invalid ID' });
      const { req, res } = mockReqRes({
        params: { id: 'invalid' },
        user: { company_id: 1, role: 'ADMIN' },
      });
      await expect(controllerModule.getChargeBacksById(req, res)).rejects.toThrow();
    });
  });

  describe('getChargeBacks', () => {
    it('should call service with user data and send success', async () => {
      chargeBackService.getChargeBacksService.mockResolvedValue({
        data: [{ id: 1, status: 'COMPLETED' }],
        total: 1,
      });
      const { req, res } = mockReqRes({
        query: { page: 1, limit: 10, sortOrder: 'ASC' },
        user: {
          company_id: 1,
          role: 'ADMIN',
          user_id: 2,
          designation: 'Manager',
        },
      });
      await controllerModule.getChargeBacks(req, res);
      expect(chargeBackService.getChargeBacksService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });

    it('should pass pagination params to service', async () => {
      chargeBackService.getChargeBacksService.mockResolvedValue({});
      const { req, res } = mockReqRes({
        query: { page: 2, limit: 20, sortOrder: 'DESC' },
        user: {
          company_id: 1,
          role: 'USER',
          user_id: 2,
          designation: 'Employee',
        },
      });
      await controllerModule.getChargeBacks(req, res);
      expect(chargeBackService.getChargeBacksService).toHaveBeenCalledWith(
        expect.objectContaining({
          company_id: 1,
        }),
        'USER',
        2,
        20,
        2,
        'DESC',
        'Employee',
      );
    });
  });

  describe('getChargeBacksBySearch', () => {
    it('should call search service with user data and search params', async () => {
      chargeBackService.getChargeBacksBySearchService.mockResolvedValue({
        data: [{ id: 1, status: 'COMPLETED' }],
        total: 1,
      });
      const { req, res } = mockReqRes({
        query: { page: 1, limit: 10, sortOrder: 'ASC', search: 'test' },
        user: {
          company_id: 1,
          role: 'ADMIN',
          user_id: 2,
          designation: 'Manager',
        },
      });
      await controllerModule.getChargeBacksBySearch(req, res);
      expect(chargeBackService.getChargeBacksBySearchService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });

    it('should handle empty search results', async () => {
      chargeBackService.getChargeBacksBySearchService.mockResolvedValue({
        data: [],
        total: 0,
      });
      const { req, res } = mockReqRes({
        query: { page: 1, limit: 10, search: 'nonexistent' },
        user: {
          company_id: 1,
          role: 'USER',
          user_id: 2,
          designation: 'Employee',
        },
      });
      await controllerModule.getChargeBacksBySearch(req, res);
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('updateChargeBack', () => {
    it('should validate params and body, call service, and send success', async () => {
      schema.VALIDATE_DELETE_CHARGEBACK.validate.mockReturnValue({});
      schema.VALIDATE_UPDATE_CHARGEBACK_SCHEMA.validate.mockReturnValue({});
      chargeBackService.updateChargeBackService.mockResolvedValue({ id: 1 });
      const { req, res } = mockReqRes({
        params: { id: 1 },
        body: { status: 'RESOLVED' },
        user: { company_id: 1, role: 'ADMIN', user_id: 2, user_name: 'John' },
      });
      await controllerModule.updateChargeBack(req, res);
      expect(schema.VALIDATE_DELETE_CHARGEBACK.validate).toHaveBeenCalled();
      expect(schema.VALIDATE_UPDATE_CHARGEBACK_SCHEMA.validate).toHaveBeenCalled();
      expect(chargeBackService.updateChargeBackService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });

    it('should throw ValidationError if params validation fails', async () => {
      schema.VALIDATE_DELETE_CHARGEBACK.validate.mockReturnValue({ error: 'Invalid ID' });
      const { req, res } = mockReqRes({
        params: { id: 'invalid' },
        body: { status: 'RESOLVED' },
        user: { company_id: 1, role: 'ADMIN', user_id: 2, user_name: 'John' },
      });
      await expect(controllerModule.updateChargeBack(req, res)).rejects.toThrow();
    });

    it('should throw ValidationError if body validation fails', async () => {
      schema.VALIDATE_DELETE_CHARGEBACK.validate.mockReturnValue({});
      schema.VALIDATE_UPDATE_CHARGEBACK_SCHEMA.validate.mockReturnValue({
        error: 'Invalid body',
      });
      const { req, res } = mockReqRes({
        params: { id: 1 },
        body: { invalid: 'data' },
        user: { company_id: 1, role: 'ADMIN', user_id: 2, user_name: 'John' },
      });
      await expect(controllerModule.updateChargeBack(req, res)).rejects.toThrow();
    });

    it('should pass updated_by from user_id', async () => {
      schema.VALIDATE_DELETE_CHARGEBACK.validate.mockReturnValue({});
      schema.VALIDATE_UPDATE_CHARGEBACK_SCHEMA.validate.mockReturnValue({});
      chargeBackService.updateChargeBackService.mockResolvedValue({ id: 1 });
      const { req, res } = mockReqRes({
        params: { id: 1 },
        body: { status: 'RESOLVED' },
        user: { company_id: 1, role: 'ADMIN', user_id: 99, user_name: 'John' },
      });
      await controllerModule.updateChargeBack(req, res);
      expect(chargeBackService.updateChargeBackService).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ updated_by: 99 }),
        'ADMIN',
      );
    });
  });

  describe('deleteChargeBack', () => {
    it('should validate params, call service, and send success', async () => {
      schema.VALIDATE_DELETE_CHARGEBACK.validate.mockReturnValue({});
      chargeBackService.deleteChargeBackService.mockResolvedValue({ id: 1 });
      const { req, res } = mockReqRes({
        params: { id: 1 },
        user: { company_id: 1, role: 'ADMIN', user_id: 2, user_name: 'John' },
      });
      await controllerModule.deleteChargeBack(req, res);
      expect(schema.VALIDATE_DELETE_CHARGEBACK.validate).toHaveBeenCalled();
      expect(chargeBackService.deleteChargeBackService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });

    it('should throw ValidationError if params validation fails', async () => {
      schema.VALIDATE_DELETE_CHARGEBACK.validate.mockReturnValue({ error: 'Invalid ID' });
      const { req, res } = mockReqRes({
        params: { id: 'invalid' },
        user: { company_id: 1, role: 'ADMIN', user_id: 2, user_name: 'John' },
      });
      await expect(controllerModule.deleteChargeBack(req, res)).rejects.toThrow();
    });

    it('should set is_obsolete to true when deleting', async () => {
      schema.VALIDATE_DELETE_CHARGEBACK.validate.mockReturnValue({});
      chargeBackService.deleteChargeBackService.mockResolvedValue({ id: 1 });
      const { req, res } = mockReqRes({
        params: { id: 1 },
        user: { company_id: 1, role: 'ADMIN', user_id: 2, user_name: 'John' },
      });
      await controllerModule.deleteChargeBack(req, res);
      expect(chargeBackService.deleteChargeBackService).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ updated_by: 2, is_obsolete: true }),
        'ADMIN',
      );
    });
  });

  describe('blockChargebackUser', () => {
    it('should validate body, call service, and send success with block message', async () => {
      schema.VALIDATE_UPDATE_CHARGEBACK_SCHEMA.validate.mockReturnValue({});
      chargeBackService.blockChargebackUserService.mockResolvedValue({
        id: 1,
        config: { blocked_users: ['user1', 'user2'] },
      });
      const { req, res } = mockReqRes({
        params: { id: 1 },
        body: { blocked_users: ['user1', 'user2'] },
        user: { company_id: 1, role: 'ADMIN', user_id: 2, user_name: 'John' },
      });
      await controllerModule.blockChargebackUser(req, res);
      expect(schema.VALIDATE_UPDATE_CHARGEBACK_SCHEMA.validate).toHaveBeenCalled();
      expect(chargeBackService.blockChargebackUserService).toHaveBeenCalled();
      const callArgs = responseHandlers.sendSuccess.mock.calls[0];
      expect(callArgs[2]).toEqual('User Blocked Successfully');
    });

    it('should send unblock message when blocked_users is empty', async () => {
      schema.VALIDATE_UPDATE_CHARGEBACK_SCHEMA.validate.mockReturnValue({});
      chargeBackService.blockChargebackUserService.mockResolvedValue({
        id: 1,
        config: { blocked_users: [] },
      });
      const { req, res } = mockReqRes({
        params: { id: 1 },
        body: { blocked_users: [] },
        user: { company_id: 1, role: 'ADMIN', user_id: 2, user_name: 'John' },
      });
      await controllerModule.blockChargebackUser(req, res);
      const callArgs = responseHandlers.sendSuccess.mock.calls[0];
      expect(callArgs[2]).toEqual('User Unblocked Successfully');
    });

    it('should throw ValidationError if body validation fails', async () => {
      schema.VALIDATE_UPDATE_CHARGEBACK_SCHEMA.validate.mockReturnValue({
        error: 'Invalid body',
      });
      const { req, res } = mockReqRes({
        params: { id: 1 },
        body: { invalid: 'data' },
        user: { company_id: 1, role: 'ADMIN', user_id: 2, user_name: 'John' },
      });
      await expect(controllerModule.blockChargebackUser(req, res)).rejects.toThrow();
    });

    it('should pass updated_by from user_id', async () => {
      schema.VALIDATE_UPDATE_CHARGEBACK_SCHEMA.validate.mockReturnValue({});
      chargeBackService.blockChargebackUserService.mockResolvedValue({
        id: 1,
        config: { blocked_users: ['user1'] },
      });
      const { req, res } = mockReqRes({
        params: { id: 1 },
        body: { blocked_users: ['user1'] },
        user: { company_id: 1, role: 'ADMIN', user_id: 99, user_name: 'John' },
      });
      await controllerModule.blockChargebackUser(req, res);
      expect(chargeBackService.blockChargebackUserService).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ updated_by: 99 }),
        'ADMIN',
      );
    });
  });
});
