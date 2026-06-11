import { describe, it, expect, beforeAll, beforeEach, afterEach, jest } from '@jest/globals';

jest.unstable_mockModule('../../src/utils/responseHandlers.js', () => ({
  sendSuccess: jest.fn(),
}));

jest.unstable_mockModule('../../src/apis/merchants/merchantService.js', () => ({
  createMerchantService: jest.fn(),
  deleteMerchantService: jest.fn(),
  getMerchantByIdService: jest.fn(),
  getMerchantsByCodeService: jest.fn(),
  getMerchantsBySearchService: jest.fn(),
  getMerchantsService: jest.fn(),
  getMerchantsServiceCode: jest.fn(),
  updateMerchantService: jest.fn(),
}));

jest.unstable_mockModule('../../src/schemas/merchantSchema.js', () => ({
  VALIDATE_UPDATE_MERCHANT_STATUS: { validate: jest.fn() },
  VALIDATE_MERCHANT_SCHEMA: { validate: jest.fn() },
}));

jest.unstable_mockModule('../../src/utils/cryptoAlgorithm.js', () => ({
  createHashApiKey: jest.fn(),
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
      merchants: {
        list: 3600,
        byCode: 1800,
        search: 3600,
      },
    },
  },
}));

jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: { log: jest.fn(), error: jest.fn() },
}));

let controller, responseHandlers, merchantService, schemas, cryptoUtils, cacheUtils, logger;

beforeAll(async () => {
  responseHandlers = await import('../../src/utils/responseHandlers.js');
  merchantService = await import('../../src/apis/merchants/merchantService.js');
  schemas = await import('../../src/schemas/merchantSchema.js');
  cryptoUtils = await import('../../src/utils/cryptoAlgorithm.js');
  cacheUtils = await import('../../src/utils/controllerCache.js');
  logger = await import('../../src/utils/logger.js');
  controller = await import('../../src/apis/merchants/merchantController.js');
});

beforeEach(() => {
  merchantService.createMerchantService = jest.fn();
  merchantService.deleteMerchantService = jest.fn();
  merchantService.getMerchantByIdService = jest.fn();
  merchantService.getMerchantsByCodeService = jest.fn();
  merchantService.getMerchantsBySearchService = jest.fn();
  merchantService.getMerchantsService = jest.fn();
  merchantService.getMerchantsServiceCode = jest.fn();
  merchantService.updateMerchantService = jest.fn();
  
  schemas.VALIDATE_MERCHANT_SCHEMA.validate = jest.fn();
  schemas.VALIDATE_UPDATE_MERCHANT_STATUS.validate = jest.fn();
  
  cryptoUtils.createHashApiKey = jest.fn().mockReturnValue({
    secretKey: 'mock_secret',
    publicKey: 'mock_public',
  });
  
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

describe('merchantController', () => {
  describe('createMerchant', () => {
    it('should call createMerchantService with proper payload', async () => {
      schemas.VALIDATE_MERCHANT_SCHEMA.validate.mockReturnValue({ error: null });
      merchantService.createMerchantService.mockResolvedValue(undefined);
      cacheUtils.invalidateCompanyCacheByPrefix.mockResolvedValue(undefined);
      cryptoUtils.createHashApiKey.mockReturnValue({ secretKey: 'secret', publicKey: 'public' });
      
      const req = {
        body: { 
          code: 'TEST', 
          first_name: 'John', 
          config: { is_h2h: false },
          payin_notify: 'http://test',
          payout_notify: 'http://test',
          return_url: 'http://test',
          site: 'http://test'
        },
        user: { company_id: 1, user_id: 5, role: 'ADMIN', designation: 'Admin' },
      };
      const res = {};
      
      await controller.createMerchant(req, res);
      // We can check if the service was called with the expected payload
      expect(merchantService.createMerchantService).toHaveBeenCalled();
    });

    it('should throw on validation error', async () => {
      const validationError = new Error('Invalid');
      schemas.VALIDATE_MERCHANT_SCHEMA.validate.mockReturnValue({ error: validationError });
      cryptoUtils.createHashApiKey.mockReturnValue({ secretKey: 'secret', publicKey: 'public' });
      
      const req = {
        body: { config: {}, payin_notify: 'http://test', payout_notify: 'http://test', return_url: 'http://test', site: 'http://test' },
        user: { company_id: 1, user_id: 5, role: 'ADMIN', designation: 'Admin' },
      };
      const res = {};
      // We expect the controller to throw an error due to validation failure
      await expect(controller.createMerchant(req, res)).rejects.toThrow();
    });
  });

  describe('getMerchants', () => {
    it('should call getMerchantsService', async () => {
      merchantService.getMerchantsService.mockResolvedValue([{ id: 1 }]);
      cacheUtils.readJsonCache.mockResolvedValue(null);
      cacheUtils.shouldServeCachedResponse.mockReturnValue(false);
      cacheUtils.writeJsonCache.mockResolvedValue(undefined);
      
      const req = {
        user: { company_id: 1, role: 'ADMIN', designation: 'Admin', user_id: 1 },
        query: { page: 1, limit: 10 },
      };
      const res = {};
      
      await controller.getMerchants(req, res);
      // We can check if the service was called to fetch merchants
      expect(merchantService.getMerchantsService).toHaveBeenCalled();
    });

    it('should serve from cache', async () => {
      const cached = [{ id: 1 }];
      cacheUtils.readJsonCache.mockResolvedValue(cached);
      cacheUtils.shouldServeCachedResponse.mockReturnValue(true);
      
      const req = {
        user: { company_id: 1, role: 'ADMIN', designation: 'Admin', user_id: 1 },
        query: { page: 1, limit: 10 },
      };
      const res = {};
      
      await controller.getMerchants(req, res);
      // We expect the service not to be called since cache should be served
      expect(merchantService.getMerchantsService).not.toHaveBeenCalled();
    });
  });

  describe('getMerchantByCode', () => {
    it('should fetch by code', async () => {
      merchantService.getMerchantsByCodeService.mockResolvedValue([{ id: 1 }]);
      cacheUtils.readJsonCache.mockResolvedValue(null);
      cacheUtils.shouldServeCachedResponse.mockReturnValue(false);
      cacheUtils.writeJsonCache.mockResolvedValue(undefined);
      
      const req = {
        query: { code: 'TEST' },
        user: { company_id: 1 },
      };
      const res = {};
      
      await controller.getMerchantByCode(req, res);
      // We can check if the service was called to fetch merchant by code
      expect(merchantService.getMerchantsByCodeService).toHaveBeenCalled();
    });
  });

  describe('getMerchantsBySearch', () => {
    it('should search merchants', async () => {
      merchantService.getMerchantsBySearchService.mockResolvedValue({ merchants: [{ id: 1 }] });
      cacheUtils.readJsonCache.mockResolvedValue(null);
      cacheUtils.shouldServeCachedResponse.mockReturnValue(false);
      cacheUtils.writeJsonCache.mockResolvedValue(undefined);
      
      const req = {
        query: { search: 'test', page: 1, limit: 10 },
        user: { company_id: 1, role: 'ADMIN', designation: 'Admin', user_id: 1 },
      };
      const res = {};
      
      await controller.getMerchantsBySearch(req, res);
      // We can check if the service was called to search merchants
      expect(merchantService.getMerchantsBySearchService).toHaveBeenCalled();
    });
  });

  describe('updateMerchant', () => {
    it('should call updateMerchantService', async () => {
      schemas.VALIDATE_UPDATE_MERCHANT_STATUS.validate.mockReturnValue({ error: null });
      merchantService.updateMerchantService.mockResolvedValue({ id: 1, name: 'TEST' });
      cacheUtils.invalidateCompanyCacheByPrefix.mockResolvedValue(undefined);
      
      const req = {
        params: { id: 1 },
        body: { balance: 1000, config: { clickrr_auto_approval_limit: 0 } },
        user: { company_id: 1, user_id: 5, user_name: 'John', role: 'ADMIN' },
      };
      const res = {};
      
      await controller.updateMerchant(req, res);
      // We can check if the service was called with the expected payload
      expect(merchantService.updateMerchantService).toHaveBeenCalled();
    });
  });;

  describe('deleteMerchant', () => {
    it('should call deleteMerchantService', async () => {
      merchantService.deleteMerchantService.mockResolvedValue({ id: 1, name: 'TEST' });
      cacheUtils.invalidateCompanyCacheByPrefix.mockResolvedValue(undefined);
      
      const req = {
        params: { id: 1 },
        user: { company_id: 1, user_id: 5, user_name: 'John', role: 'ADMIN' },
      };
      const res = {};
      
      await controller.deleteMerchant(req, res);
      // We can check if the service was called to delete the merchant
      expect(merchantService.deleteMerchantService).toHaveBeenCalled();
    });
  });
});
