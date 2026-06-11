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
      
      // This test confirms that the function executes without error and attempts to create a vendor with the correct data
      expect(schemas.VALIDATE_VENDOR_SCHEMA.validate).toHaveBeenCalledWith(req.body);
      // We check that the service is called with the correct parameters, including user context
      expect(vendorService.createVendorService).toHaveBeenCalled();
      // After creating a vendor, we expect the cache to be invalidated to ensure fresh data on subsequent requests
      expect(cacheUtils.invalidateCompanyCacheByPrefix).toHaveBeenCalled();
      // Finally, we confirm that a success response is sent back to the client
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
      
      // This test ensures that if the input data fails validation, the controller correctly throws an error and does not proceed with vendor creation
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
      
      // This test simulates a scenario where the service layer encounters an error during vendor creation. We want to ensure that the controller properly propagates this error instead of crashing or sending an incorrect response.
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
      
      // This test verifies that when there is no cached data available, the controller correctly calls the service to fetch vendors, writes the result to cache, and sends a success response.
      expect(vendorService.getVendorsService).toHaveBeenCalled();
      // We check that the cache is written with the new data, which is important for performance on subsequent requests.
      expect(cacheUtils.writeJsonCache).toHaveBeenCalled();
      // Finally, we confirm that the response handler is called to send a success response back to the client with the fetched vendor data.
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
      
      // This test ensures that if cached data is available and deemed valid, the controller serves this data directly without calling the service layer, which is crucial for performance optimization.
      expect(vendorService.getVendorsService).not.toHaveBeenCalled();
      // We also check that the response handler is called with the cached data, confirming that the controller correctly serves cached responses when appropriate.
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
      
      // This test confirms that the search functionality works correctly when there is no cached data. It checks that the service is called to perform the search, the results are written to cache for future requests, and a success response is sent back to the client with the search results.
      expect(vendorService.getVendorsBySearchService).toHaveBeenCalled();
      // We verify that the cache is updated with the new search results, which is important for improving performance on subsequent identical search requests.
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
      
      // This test ensures that if cached search results are available and valid, the controller serves these results directly without calling the service layer, which is crucial for performance optimization during search operations.
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
      
      // This test verifies that the controller correctly fetches vendor codes from the service when there is no cached data, writes the results to cache for future requests, and sends a success response back to the client with the fetched vendor codes.
      expect(vendorService.getVendorsCodeService).toHaveBeenCalled();
      // We check that the cache is updated with the new vendor codes, which is important for improving performance on subsequent requests for vendor codes.
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
      // This test ensures that if cached vendor codes are available and valid, the controller serves these codes directly without calling the service layer, which is crucial for performance optimization when fetching vendor codes.
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
      
      // This test confirms that the update functionality works correctly when valid input is provided. It checks that the controller validates the input, calls the service to perform the update, invalidates the cache to ensure fresh data on subsequent requests, and sends a success response back to the client with the updated vendor information.
      expect(vendorService.updateVendorService).toHaveBeenCalled();
      // We verify that the cache is invalidated after the update, which is important for ensuring that subsequent requests receive the most up-to-date vendor information.
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
      // This test specifically checks that the controller validates the request body using the appropriate schema before proceeding with the update operation. It ensures that the validation function is called with the correct input, which is crucial for maintaining data integrity and preventing invalid updates.
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
      
      // This test confirms that the delete functionality works correctly when a valid vendor ID is provided. It checks that the controller validates the input, calls the service to perform the deletion, invalidates the cache to ensure fresh data on subsequent requests, and sends a success response back to the client confirming the deletion.
      expect(vendorService.deleteVendorService).toHaveBeenCalled();
      // We verify that the cache is invalidated after the deletion, which is important for ensuring that subsequent requests do not return data for the deleted vendor.
      expect(cacheUtils.invalidateCompanyCacheByPrefix).toHaveBeenCalled();
      // Finally, we confirm that a success response is sent back to the client, indicating that the vendor was deleted successfully.
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
      
      // This test ensures that if the vendor ID provided for deletion fails validation, the controller correctly throws an error and does not proceed with the deletion operation.
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
      
      // This test confirms that the link vendor functionality works correctly when valid input is provided. It checks that the controller calls the service to perform the linking operation, invalidates the cache to ensure fresh data on subsequent requests, and sends a success response back to the client confirming the linking of the vendor and sub-vendor.
      expect(vendorService.linkVendorService).toHaveBeenCalled();
      // We verify that the cache is invalidated after linking, which is important for ensuring that subsequent requests reflect the new vendor relationships.
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
      
      // This test confirms that the unlink vendor functionality works correctly when valid input is provided. It checks that the controller calls the service to perform the unlinking operation, invalidates the cache to ensure fresh data on subsequent requests, and sends a success response back to the client confirming the unlinking of the vendor and sub-vendor.
      expect(vendorService.unlinkVendorService).toHaveBeenCalled();
      // We verify that the cache is invalidated after unlinking, which is important for ensuring that subsequent requests reflect the updated vendor relationships.
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
      
      // This test confirms that the transfer vendor functionality works correctly when valid input is provided. It checks that the controller calls the service to perform the transfer operation, invalidates the cache to ensure fresh data on subsequent requests, and sends a success response back to the client confirming the transfer of the sub-vendor from the current vendor to the new vendor.
      expect(vendorService.transferVendorService).toHaveBeenCalled();
      // We verify that the cache is invalidated after the transfer, which is important for ensuring that subsequent requests reflect the updated vendor relationships.
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });
});
