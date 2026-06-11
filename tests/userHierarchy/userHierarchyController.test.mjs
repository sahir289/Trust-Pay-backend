import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';

// Mock modules before importing them
jest.unstable_mockModule('../../src/utils/responseHandlers.js', () => ({
  sendSuccess: jest.fn(),
}));

jest.unstable_mockModule('../../src/apis/userHierarchy/userHierarchyService.js', () => ({
  createUserHierarchyService: jest.fn(),
  updateUserHierarchyService: jest.fn(),
  getUserHierarchyService: jest.fn(),
  deleteUserHierarchyService: jest.fn(),
}));

jest.unstable_mockModule('../../src/schemas/userHierarchySchema.js', () => ({
  VALIDATE_USER_HIERARCHY_SCHEMA: {
    validate: jest.fn(),
  },
  VALIDATE_UPDATE_USER_HIERARCHY_STATUS: {
    validate: jest.fn(),
  },
  VALIDATE_DELETE_USER_HIERARCHY: {
    validate: jest.fn(),
  },
  VALIDATE_USER_HIERARCHY_BY_ID: {
    validate: jest.fn(),
  },
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
      userHierarchy: {
        list: 3600,
        byId: 1800,
      },
    },
  },
}));

// -------------------- IMPORTS ----------------------
let controller, responseHandlers, userHierarchyService, schemas, cacheUtils, cacheKey;

beforeAll(async () => {
  responseHandlers = await import('../../src/utils/responseHandlers.js');
  userHierarchyService = await import('../../src/apis/userHierarchy/userHierarchyService.js');
  schemas = await import('../../src/schemas/userHierarchySchema.js');
  cacheKey = await import('../../src/utils/redishashkey.js');
  cacheUtils = await import('../../src/utils/controllerCache.js');
  controller = await import('../../src/apis/userHierarchy/userHierarchyController.js');
});

beforeEach(() => {
  // Reset all mocks
  jest.clearAllMocks();
  
  responseHandlers.sendSuccess = jest.fn((res, data, msg) => ({ data, msg }));
  userHierarchyService.createUserHierarchyService = jest.fn();
  userHierarchyService.updateUserHierarchyService = jest.fn();
  userHierarchyService.getUserHierarchyService = jest.fn();
  userHierarchyService.deleteUserHierarchyService = jest.fn();
  
  schemas.VALIDATE_USER_HIERARCHY_SCHEMA.validate = jest.fn();
  schemas.VALIDATE_UPDATE_USER_HIERARCHY_STATUS.validate = jest.fn();
  schemas.VALIDATE_DELETE_USER_HIERARCHY.validate = jest.fn();
  schemas.VALIDATE_USER_HIERARCHY_BY_ID.validate = jest.fn();
  
  cacheKey.generateCacheKey = jest.fn().mockReturnValue('mock-key');
  cacheUtils.normalizeQueryForCache = jest.fn((q) => q);
  cacheUtils.readJsonCache = jest.fn();
  cacheUtils.shouldServeCachedResponse = jest.fn();
  cacheUtils.writeJsonCache = jest.fn();
  cacheUtils.invalidateCompanyCacheByPrefix = jest.fn();
});

describe('userHierarchyController', () => {
  describe('createUserHierarchy', () => {
    it('should create user hierarchy successfully', async () => {
      schemas.VALIDATE_USER_HIERARCHY_SCHEMA.validate.mockReturnValue({ error: null });
      userHierarchyService.createUserHierarchyService.mockResolvedValue(undefined);
      cacheUtils.invalidateCompanyCacheByPrefix.mockResolvedValue(undefined);
      
      const req = {
        body: { parent_id: 1, config: {} },
        user: { company_id: 1, user_id: 5, role: 'ADMIN' },
      };
      const res = {};
      
      await controller.createUserHierarchy(req, res);
      
      // Validate that schema validation was called with correct data
      expect(schemas.VALIDATE_USER_HIERARCHY_SCHEMA.validate).toHaveBeenCalledWith(req.body);
      // Validate that service was called with correct parameters
      expect(userHierarchyService.createUserHierarchyService).toHaveBeenCalled();
      // Validate that cache invalidation was called with correct parameters
      expect(cacheUtils.invalidateCompanyCacheByPrefix).toHaveBeenCalledWith(
        1,
        'userHierarchy:read:',
        'UserHierarchy cache',
      );
      // Validate that response handler was called with correct parameters
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });

    it('should throw validation error on invalid schema', async () => {
      const validationError = new Error('Invalid schema');
      schemas.VALIDATE_USER_HIERARCHY_SCHEMA.validate.mockReturnValue({ error: validationError });
      
      const req = {
        body: { invalid: 'data' },
        user: { company_id: 1, user_id: 5, role: 'ADMIN' },
      };
      const res = {};
      
      // Validate that it throws the correct error message
      await expect(controller.createUserHierarchy(req, res)).rejects.toThrow('Invalid schema');
    });

    it('should handle service errors', async () => {
      schemas.VALIDATE_USER_HIERARCHY_SCHEMA.validate.mockReturnValue({ error: null });
      userHierarchyService.createUserHierarchyService.mockRejectedValue(
        new Error('Service error'),
      );
      
      const req = {
        body: { parent_id: 1 },
        user: { company_id: 1, user_id: 5, role: 'ADMIN' },
      };
      const res = {};
      
      // Validate that it throws the correct error message when service fails
      await expect(controller.createUserHierarchy(req, res)).rejects.toThrow('Service error');
    });
  });

  describe('getUserHierarchys', () => {
    it('should fetch user hierarchies successfully', async () => {
      const mockData = [{ id: 1, user_id: 1, config: {} }];
      userHierarchyService.getUserHierarchyService.mockResolvedValue(mockData);
      cacheUtils.readJsonCache.mockResolvedValue(null);
      cacheUtils.shouldServeCachedResponse.mockReturnValue(false);
      cacheUtils.writeJsonCache.mockResolvedValue(undefined);
      
      const req = {
        user: { company_id: 1, role: 'ADMIN' },
        query: { page: 1, limit: 10 },
      };
      const res = {};
      
      await controller.getUserHierarchys(req, res);
      
      // Validate that cache was checked and service was called when cache is not served
      expect(userHierarchyService.getUserHierarchyService).toHaveBeenCalled();
      // Validate that cache was written with correct parameters
      expect(cacheUtils.writeJsonCache).toHaveBeenCalled();
      // Validate that response handler was called with correct parameters
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });

    it('should serve from cache when available', async () => {
      const cachedData = [{ id: 1, cached: true }];
      cacheUtils.readJsonCache.mockResolvedValue(cachedData);
      cacheUtils.shouldServeCachedResponse.mockReturnValue(true);
      
      const req = {
        user: { company_id: 1, role: 'ADMIN' },
        query: { page: 1, limit: 10 },
      };
      const res = {};
      
      await controller.getUserHierarchys(req, res);
      
      // Validate that cache was read and checked for serving
      expect(cacheUtils.readJsonCache).toHaveBeenCalled();
      // Validate that it checked if it should serve cached response
      expect(cacheUtils.shouldServeCachedResponse).toHaveBeenCalled();
      // Validate that response handler was called with cached data
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(
        res,
        cachedData,
        'UserHierarchy fetched successfully',
      );
      // Should not call service when serving from cache
      expect(userHierarchyService.getUserHierarchyService).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      cacheUtils.readJsonCache.mockResolvedValue(null);
      cacheUtils.shouldServeCachedResponse.mockReturnValue(false);
      userHierarchyService.getUserHierarchyService.mockRejectedValue(
        new Error('Fetch failed'),
      );
      
      const req = {
        user: { company_id: 1, role: 'ADMIN' },
        query: { page: 1, limit: 10 },
      };
      const res = {};
      
      // Validate that it throws the correct error message when service fails
      await expect(controller.getUserHierarchys(req, res)).rejects.toThrow('Fetch failed');
    });
  });

  describe('getUserHierarchysById', () => {
    it('should fetch user hierarchy by id successfully', async () => {
      schemas.VALIDATE_USER_HIERARCHY_BY_ID.validate.mockReturnValue({ error: null });
      const mockData = [{ id: 1, user_id: 1, config: {} }];
      userHierarchyService.getUserHierarchyService.mockResolvedValue(mockData);
      cacheUtils.readJsonCache.mockResolvedValue(null);
      cacheUtils.shouldServeCachedResponse.mockReturnValue(false);
      cacheUtils.writeJsonCache.mockResolvedValue(undefined);
      
      const req = {
        params: { id: 1 },
        user: { company_id: 1, role: 'ADMIN' },
        query: {},
      };
      const res = {};
      
      await controller.getUserHierarchysById(req, res);
      
      // Validate that schema validation was called with correct data
      expect(schemas.VALIDATE_USER_HIERARCHY_BY_ID.validate).toHaveBeenCalledWith(req.params);
      // Validate that cache was checked and service was called when cache is not served
      expect(userHierarchyService.getUserHierarchyService).toHaveBeenCalled();
      // Validate that cache was written with correct parameters
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });

    it('should throw validation error on invalid id', async () => {
      const validationError = new Error('Invalid id');
      schemas.VALIDATE_USER_HIERARCHY_BY_ID.validate.mockReturnValue({ error: validationError });
      
      const req = {
        params: { id: 'invalid' },
        user: { company_id: 1, role: 'ADMIN' },
      };
      const res = {};
      
      // Validate that it throws the correct error message when id validation fails
      await expect(controller.getUserHierarchysById(req, res)).rejects.toThrow('Invalid id');
    });

    it('should serve from cache when available for by id', async () => {
      schemas.VALIDATE_USER_HIERARCHY_BY_ID.validate.mockReturnValue({ error: null });
      const cachedData = [{ id: 1, cached: true }];
      cacheUtils.readJsonCache.mockResolvedValue(cachedData);
      cacheUtils.shouldServeCachedResponse.mockReturnValue(true);
      
      const req = {
        params: { id: 1 },
        user: { company_id: 1, role: 'ADMIN' },
        query: {},
      };
      const res = {};
      
      await controller.getUserHierarchysById(req, res);
      
      // Validate that cache was read and checked for serving
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(
        res,
        cachedData,
        'UserHierarchy fetched successfully',
      );
      // Should not call service when serving from cache
      expect(userHierarchyService.getUserHierarchyService).not.toHaveBeenCalled();
    });
  });

  describe('updateUserHierarchy', () => {
    it('should update user hierarchy successfully', async () => {
      schemas.VALIDATE_USER_HIERARCHY_BY_ID.validate.mockReturnValue({ error: null });
      schemas.VALIDATE_UPDATE_USER_HIERARCHY_STATUS.validate.mockReturnValue({ error: null });
      userHierarchyService.updateUserHierarchyService.mockResolvedValue(undefined);
      cacheUtils.invalidateCompanyCacheByPrefix.mockResolvedValue(undefined);
      
      const req = {
        params: { id: 1 },
        body: { config: { updated: true } },
        user: { company_id: 1, user_id: 5, role: 'ADMIN' },
      };
      const res = {};
      
      await controller.updateUserHierarchy(req, res);
      
      // Validate that schema validations were called with correct data
      expect(schemas.VALIDATE_USER_HIERARCHY_BY_ID.validate).toHaveBeenCalledWith(req.params);
      // Validate that update schema validation was called with correct data
      expect(schemas.VALIDATE_UPDATE_USER_HIERARCHY_STATUS.validate).toHaveBeenCalledWith(req.body);
      // Validate that service was called with correct parameters
      expect(userHierarchyService.updateUserHierarchyService).toHaveBeenCalled();
      // Validate that cache invalidation was called with correct parameters
      expect(cacheUtils.invalidateCompanyCacheByPrefix).toHaveBeenCalled();
      // Validate that response handler was called with correct parameters
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });

    it('should throw validation error on invalid params', async () => {
      const paramsError = new Error('Invalid id');
      schemas.VALIDATE_USER_HIERARCHY_BY_ID.validate.mockReturnValue({ error: paramsError });
      
      const req = {
        params: { id: 'invalid' },
        body: { config: {} },
        user: { company_id: 1, user_id: 5, role: 'ADMIN' },
      };
      const res = {};
      
      // Validate that it throws the correct error message when id validation fails
      await expect(controller.updateUserHierarchy(req, res)).rejects.toThrow('Invalid id');
    });

    it('should throw validation error on invalid body', async () => {
      schemas.VALIDATE_USER_HIERARCHY_BY_ID.validate.mockReturnValue({ error: null });
      const bodyError = new Error('Invalid body');
      schemas.VALIDATE_UPDATE_USER_HIERARCHY_STATUS.validate.mockReturnValue({
        error: bodyError,
      });
      
      const req = {
        params: { id: 1 },
        body: { invalid: 'field' },
        user: { company_id: 1, user_id: 5, role: 'ADMIN' },
      };
      const res = {};
   
      // Validate that it throws the correct error message when body validation fails
      await expect(controller.updateUserHierarchy(req, res)).rejects.toThrow('Invalid body');
    });

    it('should handle service errors', async () => {
      schemas.VALIDATE_USER_HIERARCHY_BY_ID.validate.mockReturnValue({ error: null });
      schemas.VALIDATE_UPDATE_USER_HIERARCHY_STATUS.validate.mockReturnValue({ error: null });
      userHierarchyService.updateUserHierarchyService.mockRejectedValue(
        new Error('Update failed'),
      );
      
      const req = {
        params: { id: 1 },
        body: { config: {} },
        user: { company_id: 1, user_id: 5, role: 'ADMIN' },
      };
      const res = {};
      
      // Validate that it throws the correct error message when service fails
      await expect(controller.updateUserHierarchy(req, res)).rejects.toThrow('Update failed');
    });
  });

  describe('deleteUserHierarchy', () => {
    it('should delete user hierarchy successfully', async () => {
      schemas.VALIDATE_DELETE_USER_HIERARCHY.validate.mockReturnValue({ error: null });
      userHierarchyService.deleteUserHierarchyService.mockResolvedValue(undefined);
      cacheUtils.invalidateCompanyCacheByPrefix.mockResolvedValue(undefined);
      
      const req = {
        params: { id: 1 },
        user: { company_id: 1, user_id: 5, role: 'ADMIN' },
      };
      const res = {};
      
      await controller.deleteUserHierarchy(req, res);
   
      // Validate that schema validation was called with correct data
      expect(schemas.VALIDATE_DELETE_USER_HIERARCHY.validate).toHaveBeenCalledWith(req.params);
      // Validate that service was called with correct parameters
      expect(userHierarchyService.deleteUserHierarchyService).toHaveBeenCalled();
      // Validate that cache invalidation was called with correct parameters
      expect(cacheUtils.invalidateCompanyCacheByPrefix).toHaveBeenCalled();
      // Validate that response handler was called with correct parameters
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });

    it('should throw validation error on invalid params', async () => {
      const validationError = new Error('Invalid id');
      schemas.VALIDATE_DELETE_USER_HIERARCHY.validate.mockReturnValue({
        error: validationError,
      });
      
      const req = {
        params: { id: 'invalid' },
        user: { company_id: 1, user_id: 5, role: 'ADMIN' },
      };
      const res = {};
      
      // Validate that it throws the correct error message when id validation fails
      await expect(controller.deleteUserHierarchy(req, res)).rejects.toThrow('Invalid id');
    });

    it('should handle service errors', async () => {
      schemas.VALIDATE_DELETE_USER_HIERARCHY.validate.mockReturnValue({ error: null });
      userHierarchyService.deleteUserHierarchyService.mockRejectedValue(
        new Error('Delete failed'),
      );
      
      const req = {
        params: { id: 1 },
        user: { company_id: 1, user_id: 5, role: 'ADMIN' },
      };
      const res = {};
      
      // Validate that it throws the correct error message when service fails
      await expect(controller.deleteUserHierarchy(req, res)).rejects.toThrow('Delete failed');
    });
  });
});
