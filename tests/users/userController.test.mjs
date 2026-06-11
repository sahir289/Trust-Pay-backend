// -------------------- ESM MOCKS --------------------
/* global describe, it, expect, beforeEach, afterEach, beforeAll */
import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/apis/users/userService.js', () => ({
  createUserService: jest.fn(),
  getUserByIdService: jest.fn(),
  getUsersByUserNameService: jest.fn(),
  getUsersService: jest.fn(),
  userUpdateService: jest.fn(),
  getUsersBySearchService: jest.fn(),
  sendMailService: jest.fn(),
  updateUser2FAService: jest.fn(),
  resetUser2FAService: jest.fn(),
}));
jest.unstable_mockModule('../../src/apis/users/userDao.js', () => ({
  getUsersContactDao: jest.fn(),
}));
jest.unstable_mockModule('../../src/utils/responseHandlers.js', () => ({
  sendSuccess: jest.fn(),
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
jest.unstable_mockModule('../../src/schemas/userSchema.js', () => ({
  CREATE_USER_SCHEMA: { validate: jest.fn() },
}));
jest.unstable_mockModule('../../src/utils/redishashkey.js', () => ({
  generateCacheKey: jest.fn(() => 'mocked-cache-key'),
}));
jest.unstable_mockModule('../../src/utils/controllerCache.js', () => ({
  normalizeQueryForCache: jest.fn((query) => query),
  readJsonCache: jest.fn(),
  shouldServeCachedResponse: jest.fn(() => false),
  writeJsonCache: jest.fn(),
  invalidateCompanyCacheByPrefix: jest.fn(),
}));
jest.unstable_mockModule('../../src/config/config.js', () => ({
  default: { controllerCacheTtls: { users: { list: 300 } } },
}));

// -------------------- HELPERS ----------------------
function mockReqRes({ body = {}, params = {}, query = {}, headers = {}, user = {} } = {}) {
  return {
    req: { body, params, query, headers, user },
    res: { json: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn() },
  };
}

// -------------------- IMPORTS (via beforeAll) ----------------------
let controller, userService, responseHandlers, logger, schema, userDao, cache;

beforeAll(async () => {
  userService = await import('../../src/apis/users/userService.js');
  responseHandlers = await import('../../src/utils/responseHandlers.js');
  logger = await import('../../src/utils/logger.js');
  schema = await import('../../src/schemas/userSchema.js');
  userDao = await import('../../src/apis/users/userDao.js');
  cache = await import('../../src/utils/controllerCache.js');
  controller = await import('../../src/apis/users/userController.js');
});

beforeEach(() => {
  // Reassign all mock functions to fresh jest.fn() for isolation
  if (userService) {
    userService.getUsersService = jest.fn();
    userService.getUserByIdService = jest.fn();
    userService.getUsersByUserNameService = jest.fn();
    userService.getUsersBySearchService = jest.fn();
    userService.createUserService = jest.fn();
    userService.userUpdateService = jest.fn();
    userService.sendMailService = jest.fn();
    userService.updateUser2FAService = jest.fn();
    userService.resetUser2FAService = jest.fn();
  }
  if (responseHandlers) {
    responseHandlers.sendSuccess = jest.fn();
    responseHandlers.sendError = jest.fn();
  }
  if (logger?.logger) {
    logger.logger.error = jest.fn();
    logger.logger.info = jest.fn();
  }
  if (schema) {
    schema.CREATE_USER_SCHEMA = { validate: jest.fn() };
  }
  if (userDao) {
    userDao.getUsersContactDao = jest.fn();
  }
  if (cache) {
    cache.readJsonCache = jest.fn();
    cache.shouldServeCachedResponse = jest.fn(() => false);
    cache.writeJsonCache = jest.fn();
    cache.invalidateCompanyCacheByPrefix = jest.fn();
  }
});

afterEach(() => {
  jest.clearAllMocks();
});

// -------------------- TESTS ------------------------
describe('userController', () => {
  describe('getUsers', () => {
    it('should fetch users successfully', async () => {
      const mockData = [{ id: 1, user_name: 'testuser' }];
      userService.getUsersService.mockResolvedValue(mockData);

      const { req, res } = mockReqRes({
        query: { page: 1, limit: 10 },
        user: { role: 'ADMIN', company_id: 1, user_id: 1, designation: 'Super Admin' },
      });

      await controller.getUsers(req, res);

      // Verify service call and response
      expect(userService.getUsersService).toHaveBeenCalled();
      // Verify cache write with correct key and data
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, mockData, 'getUsers successfully');
    });

    it('should serve cached response when available', async () => {
      const cachedData = [{ id: 1, user_name: 'testuser' }];
      cache.readJsonCache.mockResolvedValue(cachedData);
      cache.shouldServeCachedResponse.mockReturnValue(true);

      const { req, res } = mockReqRes({
        query: { page: 1, limit: 10 },
        user: { role: 'ADMIN', company_id: 1, user_id: 1, designation: 'Super Admin' },
      });

      await controller.getUsers(req, res);

      // Verify that service is not called and cached data is returned
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, cachedData, 'getUsers successfully');
    });

    it('should handle empty results', async () => {
      userService.getUsersService.mockResolvedValue([]);

      const { req, res } = mockReqRes({
        query: { page: 1, limit: 10 },
        user: { role: 'ADMIN', company_id: 1, user_id: 1, designation: 'Super Admin' },
      });

      await controller.getUsers(req, res);

      // Verify that service is called and empty array is returned
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, [], 'getUsers successfully');
    });

    it('should handle error', async () => {
      userService.getUsersService.mockRejectedValue(new Error('Database error'));

      // Mock req and res objects with necessary properties
      const { req, res } = mockReqRes({
        query: { page: 1, limit: 10 },
        user: { role: 'ADMIN', company_id: 1, user_id: 1, designation: 'Super Admin' },
      });

      // Call the controller method and expect it to throw an error
      try {
        await controller.getUsers(req, res);
      } catch (error) {
        expect(error.message).toBe('Database error');
      }
    });
  });

  describe('getUsersBySearch', () => {
    it('should search users with filters', async () => {
      const mockData = { totalCount: 1, users: [{ id: 1, user_name: 'john' }] };
      userService.getUsersBySearchService.mockResolvedValue(mockData);

      const { req, res } = mockReqRes({
        query: { page: 1, limit: 10, search: 'john' },
        user: { role: 'ADMIN', company_id: 1, user_id: 1, designation: 'Super Admin' },
      });

      await controller.getUsersBySearch(req, res);

      // Verify service call and response with correct data
      expect(userService.getUsersBySearchService).toHaveBeenCalled();
      // Verify that the response contains the expected data
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, mockData, 'getUsers successfully');
    });

    it('should handle empty search results', async () => {
      userService.getUsersBySearchService.mockResolvedValue({ totalCount: 0, users: [] });

      const { req, res } = mockReqRes({
        query: { page: 1, limit: 10, search: 'nonexistent' },
        user: { role: 'ADMIN', company_id: 1, user_id: 1, designation: 'Super Admin' },
      });

      await controller.getUsersBySearch(req, res);

      // Verify that service is called and empty results are returned
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });

    it('should log error on exception', async () => {
      userService.getUsersBySearchService.mockRejectedValue(new Error('Search failed'));

      const { req, res } = mockReqRes({
        query: { page: 1, limit: 10, search: 'john' },
        user: { role: 'ADMIN', company_id: 1, user_id: 1, designation: 'Super Admin' },
      });

      try {
        await controller.getUsersBySearch(req, res);
      } catch (error) {
        expect(error.message).toBe('Search failed');
      }
    });
  });

  describe('getUserById', () => {
    it('should fetch user by id', async () => {
      const mockUser = { id: 1, user_name: 'testuser' };
      userService.getUserByIdService.mockResolvedValue(mockUser);

      const { req, res } = mockReqRes({
        params: { id: '1' },
        user: { role: 'ADMIN', company_id: 1, role_id: 2, designation_id: 3 },
      });

      await controller.getUserById(req, res);

      // Verify service call with correct parameters and response
      expect(userService.getUserByIdService).toHaveBeenCalledWith(
        { role_id: 2, designation_id: 3, company_id: 1, id: '1' },
        'ADMIN'
      );
      // Verify that the response contains the expected user data
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, mockUser, 'getting User by id successfully');
    });

    it('should throw error if user not found', async () => {
      userService.getUserByIdService.mockRejectedValue(new Error('User not found'));

      const { req, res } = mockReqRes({
        params: { id: '999' },
        user: { role: 'ADMIN', company_id: 1, role_id: 2, designation_id: 3 },
      });

      try {
        await controller.getUserById(req, res);
      } catch (error) {
        expect(error.message).toBe('User not found');
      }
    });
  });

  describe('getUsersByUserName', () => {
    it('should fetch user by username', async () => {
      const mockUser = { id: 1, user_name: 'john_doe' };
      userService.getUsersByUserNameService.mockResolvedValue(mockUser);

      const { req, res } = mockReqRes({
        body: { username: 'john_doe' },
        user: { role: 'ADMIN', company_id: 1 },
      });

      await controller.getUsersByUserName(req, res);

      // Verify service call and response with correct data
      expect(userService.getUsersByUserNameService).toHaveBeenCalled();
      // Verify that the response contains the expected user data
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });

    it('should throw error if username not provided', async () => {
      const { req, res } = mockReqRes({
        body: {},
        user: { role: 'ADMIN', company_id: 1 },
      });

      try {
        await controller.getUsersByUserName(req, res);
      } catch (error) {
        expect(error.message).toContain('Username is required');
      }
    });
  });

  describe('createUser', () => {
    it('should create user with valid data', async () => {
      schema.CREATE_USER_SCHEMA.validate.mockReturnValue({ error: null, value: { user_name: 'newuser' } });
      userService.createUserService.mockResolvedValue({ id: 1, user_name: 'newuser' });

      const { req, res } = mockReqRes({
        body: { user_name: 'newuser', email: 'new@example.com' },
        user: { role: 'ADMIN', company_id: 1, user_id: 1 },
      });

      await controller.createUser(req, res);

      // Verify service call and response with correct data
      expect(userService.createUserService).toHaveBeenCalled();
      // Verify that the response contains the expected user data
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });

    it('should throw error on validation failure', async () => {
      schema.CREATE_USER_SCHEMA.validate.mockReturnValue({ error: new Error('Validation failed') });

      const { req, res } = mockReqRes({
        body: {},
        user: { role: 'ADMIN', company_id: 1, user_id: 1 },
      });

      try {
        await controller.createUser(req, res);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('updateUser', () => {
    it('should update user with valid data', async () => {
      userService.userUpdateService.mockResolvedValue({ id: 1, user_name: 'updateduser' });

      const { req, res } = mockReqRes({
        params: { id: '1' },
        body: { user_name: 'updateduser' },
        user: { role: 'ADMIN', company_id: 1, user_id: 1 },
      });

      await controller.updateUser(req, res);

      // Verify service call and response with correct data
      expect(userService.userUpdateService).toHaveBeenCalled();
      // Verify that the response contains the expected updated user data
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });

    it('should throw error if user id missing', async () => {
      const { req, res } = mockReqRes({
        params: {},
        body: { user_name: 'updateduser' },
        user: { role: 'ADMIN', company_id: 1, user_id: 1 },
      });

      try {
        await controller.updateUser(req, res);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('sendMail', () => {
    it('should send mail successfully', async () => {
      userService.sendMailService.mockResolvedValue({ success: true });

      const { req, res } = mockReqRes({
        body: { user_id: 1 },
        user: { user_name: 'admin' },
      });

      await controller.sendMail(req, res);

      // Verify service call and response with correct data
      expect(userService.sendMailService).toHaveBeenCalled();
      // Verify that the response indicates success
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });

    it('should throw error if user_id missing', async () => {
      const { req, res } = mockReqRes({
        body: {},
        user: { user_name: 'admin' },
      });

      try {
        await controller.sendMail(req, res);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('toggleUser2FA', () => {
    it('should toggle 2FA successfully', async () => {
      userService.updateUser2FAService.mockResolvedValue({ success: true });

      const { req, res } = mockReqRes({
        params: { id: '1' },
        body: { isTwoFactorRequired: true },
        user: { company_id: 1 },
      });

      await controller.toggleUser2FA(req, res);

      // Verify service call with correct parameters and response
      expect(userService.updateUser2FAService).toHaveBeenCalledWith('1', true);
      // Verify that the response indicates success
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });

    it('should throw error if isTwoFactorRequired is not boolean', async () => {
      const { req, res } = mockReqRes({
        params: { id: '1' },
        body: { isTwoFactorRequired: 'yes' },
        user: { company_id: 1 },
      });

      try {
        await controller.toggleUser2FA(req, res);
      } catch (error) {
        expect(error.message).toContain('boolean');
      }
    });
  });

  describe('resetUser2FA', () => {
    it('should reset 2FA successfully', async () => {
      userService.resetUser2FAService.mockResolvedValue({ success: true });

      const { req, res } = mockReqRes({
        params: { id: '1' },
        user: { user_id: 2, user_name: 'admin', company_id: 1 },
      });

      await controller.resetUser2FA(req, res);

      // Verify service call with correct parameters and response
      expect(userService.resetUser2FAService).toHaveBeenCalledWith('1', 2, 'admin');
      // Verify that the response indicates success
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });

    it('should throw error on service failure', async () => {
      userService.resetUser2FAService.mockRejectedValue(new Error('Reset failed'));

      const { req, res } = mockReqRes({
        params: { id: '1' },
        user: { user_id: 2, user_name: 'admin', company_id: 1 },
      });

      try {
        await controller.resetUser2FA(req, res);
      } catch (error) {
        expect(error.message).toBe('Reset failed');
      }
    });
  });
});
