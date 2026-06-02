import { describe, it, expect, beforeAll, beforeEach, afterEach, jest } from '@jest/globals';

jest.unstable_mockModule('../../src/utils/responseHandlers.js', () => ({
  sendSuccess: jest.fn(),
}));

jest.unstable_mockModule('../../src/apis/vendors/vendorService.js', () => ({
  createVendorService: jest.fn(),
  deleteVendorService: jest.fn(),
  getVendorsCodeService: jest.fn(),
  getVendorsService: jest.fn(),
  updateVendorService: jest.fn(),
  getVendorsBySearchService: jest.fn(),
  getBankResponseAccessByIDService: jest.fn(),
  getVendorsByCodeService: jest.fn(),
  linkVendorService: jest.fn(),
  unlinkVendorService: jest.fn(),
  transferVendorService: jest.fn(),
}));

jest.unstable_mockModule('../../src/schemas/vendorSchema.js', () => ({
  VALIDATE_VENDOR_BY_ID: { validate: jest.fn() },
  VALIDATE_UPDATE_VENDOR_STATUS: { validate: jest.fn() },
  VALIDATE_VENDOR_SCHEMA: { validate: jest.fn() },
}));

jest.unstable_mockModule('../../src/utils/redishashkey.js', () => ({
  generateCacheKey: jest.fn(),
}));

jest.unstable_mockModule('../../src/utils/controllerCache.js', () => ({
  normalizeQueryForCache: jest.fn(),
  readJsonCache: jest.fn(),
  shouldServeCachedResponse: jest.fn(),
  writeJsonCache: jest.fn(),
  invalidateCompanyCacheByPrefix: jest.fn(),
}));

jest.unstable_mockModule('../../src/config/config.js', () => ({
  default: {
    controllerCacheTtls: {
      vendors: {
        list: 3600,
        search: 3600,
        codes: 1800,
      },
    },
  },
}));

jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: { log: jest.fn(), error: jest.fn() },
}));

let controller, responseHandlers, vendorService, schemas, cacheUtils, logger;

beforeAll(async () => {
  responseHandlers = await import('../../src/utils/responseHandlers.js');
  vendorService = await import('../../src/apis/vendors/vendorService.js');
  schemas = await import('../../src/schemas/vendorSchema.js');
  cacheUtils = await import('../../src/utils/controllerCache.js');
  logger = await import('../../src/utils/logger.js');
  controller = await import('../../src/apis/vendors/vendorController.js');
});

beforeEach(() => {
  vendorService.createVendorService = jest.fn();
  vendorService.deleteVendorService = jest.fn();
  vendorService.getVendorsCodeService = jest.fn();
  vendorService.getVendorsService = jest.fn();
  vendorService.updateVendorService = jest.fn();
  vendorService.getVendorsBySearchService = jest.fn();
  vendorService.getBankResponseAccessByIDService = jest.fn();
  vendorService.getVendorsByCodeService = jest.fn();
  vendorService.linkVendorService = jest.fn();
  vendorService.unlinkVendorService = jest.fn();
  vendorService.transferVendorService = jest.fn();
  
  schemas.VALIDATE_VENDOR_SCHEMA.validate = jest.fn();
  schemas.VALIDATE_UPDATE_VENDOR_STATUS.validate = jest.fn();
  schemas.VALIDATE_VENDOR_BY_ID.validate = jest.fn();
  
  cacheUtils.generateCacheKey = jest.fn().mockReturnValue('mock-key');
  cacheUtils.normalizeQueryForCache = jest.fn((q) => q);
  cacheUtils.readJsonCache = jest.fn();
  cacheUtils.shouldServeCachedResponse = jest.fn();
  cacheUtils.writeJsonCache = jest.fn();
  cacheUtils.invalidateCompanyCacheByPrefix = jest.fn();
  
  logger.logger.log = jest.fn();
  logger.logger.error = jest.fn();
  responseHandlers.sendSuccess = jest.fn();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('vendorController', () => {
  describe('createVendor', () => {
    it('should create vendor successfully', async () => {
      schemas.VALIDATE_VENDOR_SCHEMA.validate.mockReturnValue({ error: null });
      vendorService.createVendorService.mockResolvedValue({ id: 1, code: 'VENDOR1' });
      cacheUtils.invalidateCompanyCacheByPrefix.mockResolvedValue(undefined);
      
      const req = {
        body: { code: 'VENDOR1', name: 'Test Vendor' },
        user: { company_id: 1, user_id: 5 },
      };
      const res = {};
      
      await controller.createVendor(req, res);
      
      expect(schemas.VALIDATE_VENDOR_SCHEMA.validate).toHaveBeenCalledWith(req.body);
      expect(vendorService.createVendorService).toHaveBeenCalled();
      expect(cacheUtils.invalidateCompanyCacheByPrefix).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });

    it('should throw validation error on invalid schema', async () => {
      const validationError = new Error('Invalid schema');
      schemas.VALIDATE_VENDOR_SCHEMA.validate.mockReturnValue({ error: validationError });
      
      const req = {
        body: { invalid: 'data' },
        user: { company_id: 1, user_id: 5 },
      };
      const res = {};
      
      await expect(controller.createVendor(req, res)).rejects.toThrow();
    });

    it('should handle service errors', async () => {
      schemas.VALIDATE_VENDOR_SCHEMA.validate.mockReturnValue({ error: null });
      vendorService.createVendorService.mockRejectedValue(new Error('Service error'));
      
      const req = {
        body: { code: 'VENDOR1' },
        user: { company_id: 1, user_id: 5 },
      };
      const res = {};
      
      await expect(controller.createVendor(req, res)).rejects.toThrow('Service error');
    });
  });

  describe('getVendors', () => {
    it('should fetch vendors successfully', async () => {
      const mockData = [{ id: 1, code: 'VENDOR1' }];
      vendorService.getVendorsService.mockResolvedValue(mockData);
      cacheUtils.readJsonCache.mockResolvedValue(null);
      cacheUtils.shouldServeCachedResponse.mockReturnValue(false);
      cacheUtils.writeJsonCache.mockResolvedValue(undefined);
      
      const req = {
        user: { company_id: 1, role: 'ADMIN', user_id: 1, designation: 'Admin' },
        query: { page: 1, limit: 10 },
      };
      const res = {};
      
      await controller.getVendors(req, res);
      
      expect(vendorService.getVendorsService).toHaveBeenCalled();
      expect(cacheUtils.writeJsonCache).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });

    it('should serve from cache when available', async () => {
      const cachedData = [{ id: 1, cached: true }];
      cacheUtils.readJsonCache.mockResolvedValue(cachedData);
      cacheUtils.shouldServeCachedResponse.mockReturnValue(true);
      
      const req = {
        user: { company_id: 1, role: 'ADMIN', user_id: 1, designation: 'Admin' },
        query: { page: 1, limit: 10 },
      };
      const res = {};
      
      await controller.getVendors(req, res);
      
      expect(vendorService.getVendorsService).not.toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(
        res,
        cachedData,
        'Vendors fetched successfully',
      );
    });
  });

  describe('getVendorsBySearch', () => {
    it('should search vendors successfully', async () => {
      const mockData = { vendors: [{ id: 1 }], total: 1 };
      vendorService.getVendorsBySearchService.mockResolvedValue(mockData);
      cacheUtils.readJsonCache.mockResolvedValue(null);
      cacheUtils.shouldServeCachedResponse.mockReturnValue(false);
      cacheUtils.writeJsonCache.mockResolvedValue(undefined);
      
      const req = {
        query: { page: 1, limit: 10 },
        user: { company_id: 1, role: 'ADMIN', user_id: 1, designation: 'Admin' },
      };
      const res = {};
      
      await controller.getVendorsBySearch(req, res);
      
      expect(vendorService.getVendorsBySearchService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });

    it('should serve search results from cache', async () => {
      const cachedData = [{ id: 1 }];
      cacheUtils.readJsonCache.mockResolvedValue(cachedData);
      cacheUtils.shouldServeCachedResponse.mockReturnValue(true);
      
      const req = {
        query: { page: 1, limit: 10 },
        user: { company_id: 1, role: 'ADMIN', user_id: 1, designation: 'Admin' },
      };
      const res = {};
      
      await controller.getVendorsBySearch(req, res);
      
      expect(vendorService.getVendorsBySearchService).not.toHaveBeenCalled();
    });
  });

  describe('getVendorCodes', () => {
    it('should fetch vendor codes successfully', async () => {
      const mockData = [{ label: 'VENDOR1', value: 1 }];
      vendorService.getVendorsCodeService.mockResolvedValue(mockData);
      cacheUtils.readJsonCache.mockResolvedValue(null);
      cacheUtils.shouldServeCachedResponse.mockReturnValue(false);
      cacheUtils.writeJsonCache.mockResolvedValue(undefined);
      
      const req = {
        query: { includeSubVendors: 'true' },
        user: { company_id: 1, user_id: 1, role: 'ADMIN', designation: 'Admin' },
      };
      const res = {};
      
      await controller.getVendorCodes(req, res);
      
      expect(vendorService.getVendorsCodeService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });

    it('should support cache for vendor codes', async () => {
      const cachedData = [{ label: 'VENDOR1' }];
      cacheUtils.readJsonCache.mockResolvedValue(cachedData);
      cacheUtils.shouldServeCachedResponse.mockReturnValue(true);
      
      const req = {
        query: {},
        user: { company_id: 1, user_id: 1, role: 'ADMIN', designation: 'Admin' },
      };
      const res = {};
      
      await controller.getVendorCodes(req, res);
      
      expect(vendorService.getVendorsCodeService).not.toHaveBeenCalled();
    });
  });

  describe('updateVendor', () => {
    it('should update vendor successfully', async () => {
      schemas.VALIDATE_VENDOR_BY_ID.validate.mockReturnValue({ error: null });
      schemas.VALIDATE_UPDATE_VENDOR_STATUS.validate.mockReturnValue({ error: null });
      vendorService.updateVendorService.mockResolvedValue({ id: 1, name: 'TEST' });
      cacheUtils.invalidateCompanyCacheByPrefix.mockResolvedValue(undefined);
      
      const req = {
        params: { id: 1 },
        body: { balance: 1000 },
        user: { company_id: 1, user_id: 5, user_name: 'John' },
      };
      const res = {};
      
      await controller.updateVendor(req, res);
      
      expect(vendorService.updateVendorService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });

    it('should validate body only', async () => {
      schemas.VALIDATE_UPDATE_VENDOR_STATUS.validate.mockReturnValue({ error: null });
      vendorService.updateVendorService.mockResolvedValue({ id: 1, name: 'TEST' });
      cacheUtils.invalidateCompanyCacheByPrefix.mockResolvedValue(undefined);
      
      const req = {
        params: { id: 1 },
        body: { balance: 1000 },
        user: { company_id: 1, user_id: 5, user_name: 'John' },
      };
      const res = {};
      
      await controller.updateVendor(req, res);
      
      expect(schemas.VALIDATE_UPDATE_VENDOR_STATUS.validate).toHaveBeenCalledWith(req.body);
    });
  });

  describe('deleteVendor', () => {
    it('should delete vendor successfully', async () => {
      schemas.VALIDATE_VENDOR_BY_ID.validate.mockReturnValue({ error: null });
      vendorService.deleteVendorService.mockResolvedValue({ id: 1, name: 'TEST' });
      cacheUtils.invalidateCompanyCacheByPrefix.mockResolvedValue(undefined);
      
      const req = {
        params: { user_id: 1 },
        user: { company_id: 1, user_id: 5, user_name: 'John' },
      };
      const res = {};
      
      await controller.deleteVendor(req, res);
      
      expect(vendorService.deleteVendorService).toHaveBeenCalled();
      expect(cacheUtils.invalidateCompanyCacheByPrefix).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });

    it('should throw validation error on invalid id', async () => {
      const validationError = new Error('Invalid id');
      schemas.VALIDATE_VENDOR_BY_ID.validate.mockReturnValue({ error: validationError });
      
      const req = {
        params: { user_id: 'invalid' },
        user: { company_id: 1, user_id: 5 },
      };
      const res = {};
      
      await expect(controller.deleteVendor(req, res)).rejects.toThrow();
    });
  });

  describe('linkVendor', () => {
    it('should link vendor successfully', async () => {
      vendorService.linkVendorService.mockResolvedValue({ status: 'success' });
      cacheUtils.invalidateCompanyCacheByPrefix.mockResolvedValue(undefined);
      
      const req = {
        body: { vendorUserId: 1, subVendorUserId: 2 },
        user: { company_id: 1, user_id: 5 },
      };
      const res = {};
      
      await controller.linkVendor(req, res);
      
      expect(vendorService.linkVendorService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('unlinkVendor', () => {
    it('should unlink vendor successfully', async () => {
      vendorService.unlinkVendorService.mockResolvedValue({ status: 'success' });
      cacheUtils.invalidateCompanyCacheByPrefix.mockResolvedValue(undefined);
      
      const req = {
        body: { vendorUserId: 1, subVendorUserId: 2 },
        user: { company_id: 1, user_id: 5 },
      };
      const res = {};
      
      await controller.unlinkVendor(req, res);
      
      expect(vendorService.unlinkVendorService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('transferVendor', () => {
    it('should transfer vendor successfully', async () => {
      vendorService.transferVendorService.mockResolvedValue({ status: 'success' });
      cacheUtils.invalidateCompanyCacheByPrefix.mockResolvedValue(undefined);
      
      const req = {
        body: { subVendorUserId: 2, newVendorUserId: 3, currentVendorUserId: 1 },
        user: { company_id: 1, user_id: 5 },
      };
      const res = {};
      
      await controller.transferVendor(req, res);
      
      expect(vendorService.transferVendorService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });
});
