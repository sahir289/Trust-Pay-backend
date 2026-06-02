// -------------------- ESM MOCKS --------------------
/* global describe, it, expect, beforeEach, afterEach, beforeAll */
import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/constants/index.js', () => ({
  Role: { MERCHANT: 'MERCHANT', VENDOR: 'VENDOR', ADMIN: 'ADMIN', SUB_MERCHANT: 'SUB_MERCHANT', SUB_VENDOR: 'SUB_VENDOR', VENDOR_OPERATIONS: 'VENDOR_OPERATIONS', MERCHANT_OPERATIONS: 'MERCHANT_OPERATIONS', VENDOR_ADMIN: 'VENDOR_ADMIN' },
}));
jest.unstable_mockModule('../../src/utils/appErrors.js', () => ({
  ValidationError: class extends Error {},
  BadRequestError: class extends Error {},
  NotFoundError: class extends Error {},
}));
jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));
jest.unstable_mockModule('../../src/schemas/BeneficiaryAccountSchema.js', () => ({
  BENEFICIARY_ACCOUNT_SCHEMA: { validate: jest.fn(() => ({ error: null, value: {} })) },
  UPDATE_BENEFICIARY_ACCOUNT_SCHEMA: { validate: jest.fn(() => ({ error: null, value: {} })) },
  VALIDATE_BENEFICIARY_ACCOUNT_BY_ID: { validate: jest.fn(() => ({ error: null, value: 1 })) },
}));
jest.unstable_mockModule('../../src/apis/beneficiaryAccounts/beneficiaryAccountServices.js', () => ({
  getBeneficiaryAccountService: jest.fn(),
  getBeneficiaryAccountBySearchService: jest.fn(),
  createBeneficiaryAccountService: jest.fn(),
  updateBeneficiaryAccountService: jest.fn(),
  deleteBeneficiaryAccountService: jest.fn(),
  getBeneficiaryAccountServiceByBankName: jest.fn(),
}));
jest.unstable_mockModule('../../src/utils/responseHandlers.js', () => ({
  sendSuccess: jest.fn((res, data, msg) => res.status(200).json({ success: true, data, msg })),
  sendNewSuccess: jest.fn((res, statusCode, data, msg) => res.status(statusCode).json({ success: true, data, msg })),
  sendError: jest.fn((res, statusCode, msg) => res.status(statusCode).json({ success: false, msg })),
}));
jest.unstable_mockModule('../../src/utils/redishashkey.js', () => ({
  generateCacheKey: jest.fn((prefix, id) => `${prefix}:${id}`),
}));
jest.unstable_mockModule('../../src/utils/controllerCache.js', () => ({
  normalizeQueryForCache: jest.fn((q) => q),
  readJsonCache: jest.fn(),
  shouldServeCachedResponse: jest.fn(() => false),
  writeJsonCache: jest.fn(),
  invalidateCompanyCacheByPrefix: jest.fn(),
}));
jest.unstable_mockModule('../../src/config/config.js', () => ({
  default: { cacheDataTime: 3600 },
}));

// -------------------- HELPERS ----------------------
function mockReqRes() {
  return {
    req: {
      body: {},
      query: {},
      params: { id: 1 },
      headers: { authorization: 'Bearer token' },
      user: { id: 1, company_id: 1, role: 'MERCHANT', designation: 'MERCHANT' },
    },
    res: {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      locals: {},
    },
  };
}

// -------------------- IMPORTS ----------------------
let controller, service, schemas, handlers, logger;
beforeAll(async () => {
  controller = await import('../../src/apis/beneficiaryAccounts/beneficiaryAccountController.js');
  service = await import('../../src/apis/beneficiaryAccounts/beneficiaryAccountServices.js');
  schemas = await import('../../src/schemas/BeneficiaryAccountSchema.js');
  handlers = await import('../../src/utils/responseHandlers.js');
  logger = await import('../../src/utils/logger.js');
});

beforeEach(() => {
  if (service) {
    service.getBeneficiaryAccountService = jest.fn();
    service.getBeneficiaryAccountBySearchService = jest.fn();
    service.createBeneficiaryAccountService = jest.fn();
    service.updateBeneficiaryAccountService = jest.fn();
    service.deleteBeneficiaryAccountService = jest.fn();
    service.getBeneficiaryAccountServiceByBankName = jest.fn();
  }
  if (schemas) {
    schemas.BENEFICIARY_ACCOUNT_SCHEMA.validate = jest.fn(() => ({ error: null, value: {} }));
    schemas.UPDATE_BENEFICIARY_ACCOUNT_SCHEMA.validate = jest.fn(() => ({ error: null, value: {} }));
    schemas.VALIDATE_BENEFICIARY_ACCOUNT_BY_ID.validate = jest.fn(() => ({ error: null, value: 1 }));
  }
  if (handlers) {
    handlers.sendSuccess = jest.fn();
    handlers.sendNewSuccess = jest.fn();
    handlers.sendError = jest.fn();
  }
  if (logger?.logger) {
    logger.logger.error = jest.fn();
    logger.logger.info = jest.fn();
    logger.logger.warn = jest.fn();
  }
});

afterEach(() => {
  jest.clearAllMocks();
});

// -------------------- TESTS ----------------------
describe('beneficiaryAccountController', () => {
  describe('getBeneficiaryAccount', () => {
    it('should call service and send response', async () => {
      const { req, res } = mockReqRes();
      service.getBeneficiaryAccountService.mockResolvedValue([{ id: 1, acc_no: '1234567890' }]);
      await controller.getBeneficiaryAccount(req, res);
      expect(service.getBeneficiaryAccountService).toHaveBeenCalled();
    });

    it('should support pagination', async () => {
      const { req, res } = mockReqRes();
      req.query = { page: 2, limit: 25 };
      service.getBeneficiaryAccountService.mockResolvedValue([]);
      await controller.getBeneficiaryAccount(req, res);
      expect(service.getBeneficiaryAccountService).toHaveBeenCalled();
    });
  });

  describe('getBeneficiaryAccountBySearch', () => {
    it('should call search service', async () => {
      const { req, res } = mockReqRes();
      req.query = { search: 'John', page: 1, limit: 10 };
      service.getBeneficiaryAccountBySearchService.mockResolvedValue({
        totalCount: 1,
        totalPages: 1,
        bankAccounts: [{ id: 1 }],
      });
      await controller.getBeneficiaryAccountBySearch(req, res);
      expect(service.getBeneficiaryAccountBySearchService).toHaveBeenCalled();
    });

    it('should handle pagination in search', async () => {
      const { req, res } = mockReqRes();
      req.query = { search: 'test', page: 2, limit: 20 };
      service.getBeneficiaryAccountBySearchService.mockResolvedValue({
        totalCount: 50,
        totalPages: 3,
        bankAccounts: [],
      });
      await controller.getBeneficiaryAccountBySearch(req, res);
      expect(service.getBeneficiaryAccountBySearchService).toHaveBeenCalled();
    });
  });

  describe('getBeneficiaryAccountByBankName', () => {
    it('should call bank name service', async () => {
      const { req, res } = mockReqRes();
      req.query = { user_id: 1, type: 'Personal' };
      service.getBeneficiaryAccountServiceByBankName.mockResolvedValue({
        totalCount: 2,
        bankNames: [{ label: 'ICICI Bank', value: 1 }],
      });
      await controller.getBeneficiaryAccountByBankName(req, res);
      expect(service.getBeneficiaryAccountServiceByBankName).toHaveBeenCalled();
    });

    it('should handle different account types', async () => {
      const { req, res } = mockReqRes();
      req.query = { user_id: 1, type: 'Business' };
      service.getBeneficiaryAccountServiceByBankName.mockResolvedValue({
        totalCount: 1,
        bankNames: [],
      });
      await controller.getBeneficiaryAccountByBankName(req, res);
      expect(service.getBeneficiaryAccountServiceByBankName).toHaveBeenCalled();
    });
  });

  describe('getBeneficiaryAccountById', () => {
    it('should call service with account id', async () => {
      const { req, res } = mockReqRes();
      req.params = { id: 1 };
      service.getBeneficiaryAccountService.mockResolvedValue([{ id: 1, acc_no: '1234567890' }]);
      await controller.getBeneficiaryAccountById(req, res);
      expect(service.getBeneficiaryAccountService).toHaveBeenCalled();
    });

    it('should handle different account ids', async () => {
      const { req, res } = mockReqRes();
      req.params = { id: 123 };
      service.getBeneficiaryAccountService.mockResolvedValue([{ id: 123, acc_no: '1234567890' }]);
      await controller.getBeneficiaryAccountById(req, res);
      expect(service.getBeneficiaryAccountService).toHaveBeenCalled();
    });
  });

  describe('createBeneficiaryAccount', () => {
    it('should call create service', async () => {
      const { req, res } = mockReqRes();
      req.body = { acc_no: '9876543210', acc_holder_name: 'Jane', ifsc: 'HDFC0001234', bank_name: 'HDFC' };
      service.createBeneficiaryAccountService.mockResolvedValue({ id: 1, acc_no: '9876543210' });
      await controller.createBeneficiaryAccount(req, res);
      expect(service.createBeneficiaryAccountService).toHaveBeenCalled();
    });

    it('should include company_id from user', async () => {
      const { req, res } = mockReqRes();
      req.body = { acc_no: '9876543210', acc_holder_name: 'Jane', ifsc: 'HDFC0001234', bank_name: 'HDFC' };
      service.createBeneficiaryAccountService.mockResolvedValue({ id: 1 });
      await controller.createBeneficiaryAccount(req, res);
      const callArgs = service.createBeneficiaryAccountService.mock.calls[0][0];
      expect(callArgs.company_id).toBe(1);
    });
  });

  describe('updateBeneficiaryAccount', () => {
    it('should call update service with id from params', async () => {
      const { req, res } = mockReqRes();
      req.params = { id: 1 };
      req.body = { acc_holder_name: 'Jane Updated' };
      service.updateBeneficiaryAccountService.mockResolvedValue({ id: 1 });
      await controller.updateBeneficiaryAccount(req, res);
      expect(service.updateBeneficiaryAccountService).toHaveBeenCalled();
    });

    it('should pass company_id to service', async () => {
      const { req, res } = mockReqRes();
      req.params = { id: 1 };
      req.body = { acc_holder_name: 'Jane' };
      service.updateBeneficiaryAccountService.mockResolvedValue({ id: 1 });
      await controller.updateBeneficiaryAccount(req, res);
      const callArgs = service.updateBeneficiaryAccountService.mock.calls[0][0];
      expect(callArgs.company_id).toBe(1);
    });
  });

  describe('deleteBeneficiaryAccount', () => {
    it('should call delete service with id from params', async () => {
      const { req, res } = mockReqRes();
      req.params = { id: 1 };
      service.deleteBeneficiaryAccountService.mockResolvedValue({ id: 1 });
      await controller.deleteBeneficiaryAccount(req, res);
      expect(service.deleteBeneficiaryAccountService).toHaveBeenCalled();
    });

    it('should pass company_id to delete service', async () => {
      const { req, res } = mockReqRes();
      req.params = { id: 1 };
      service.deleteBeneficiaryAccountService.mockResolvedValue({ id: 1 });
      await controller.deleteBeneficiaryAccount(req, res);
      const callArgs = service.deleteBeneficiaryAccountService.mock.calls[0][0];
      expect(callArgs.company_id).toBe(1);
    });

    it('should invalidate cache on delete', async () => {
      const { req, res } = mockReqRes();
      req.params = { id: 1 };
      service.deleteBeneficiaryAccountService.mockResolvedValue({ id: 1 });
      await controller.deleteBeneficiaryAccount(req, res);
      expect(handlers.sendSuccess).toHaveBeenCalled();
    });
  });
});
