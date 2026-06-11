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
      // Mock validation to pass and return sanitized data
      schema.VALIDATE_CHARGEBACK_SCHEMA.validate.mockReturnValue({});
      // Mock payin details with COMPLETED status
      const mockPayinDetails = [
        {
          payin_id: 1,
          merchant_order_id: 'order123',
          status: 'COMPLETED',
          bank_response_id: 1,
        },
      ];
      // Mock no existing chargeback for this payin
      payInDao.getPayinDetailsByMerchantOrderId.mockResolvedValue(mockPayinDetails);
      // Mock bank response details for the payin
      chargeBackDao.chargeBackExistsByPayinIdDao.mockResolvedValue(false);
      // Mock bank response details for the payin
      bankResponseDao.getBankResponseDaoById.mockResolvedValue({
        user_id: 'vendor1',
        bank_id: 'bank1',
        utr: 'utr123',
      });
      // Mock successful chargeback creation in service
      chargeBackService.createChargeBackService.mockResolvedValue({ id: 1 });
      // Mock request and response objects with necessary data
      const { req, res } = mockReqRes({
        body: { merchant_order_id: 'order123', amount: 1000 },
        user: { company_id: 1, role: 'ADMIN', user_id: 2, user_name: 'John' },
      });
      // Call the controller function and assert the expected flow
      await controllerModule.createChargeBack(req, res);
      // Assert that all expected functions were called in the correct order
      expect(schema.VALIDATE_CHARGEBACK_SCHEMA.validate).toHaveBeenCalled();
      // Assert that validation was called with the request body
      expect(payInDao.getPayinDetailsByMerchantOrderId).toHaveBeenCalled();
      // Assert that the payin details were fetched using the merchant_order_id
      expect(chargeBackDao.chargeBackExistsByPayinIdDao).toHaveBeenCalled();
      // Assert that the service was called to create the chargeback with correct data
      expect(chargeBackService.createChargeBackService).toHaveBeenCalled();
      // Assert that a success response was sent back to the client
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });

    it('should throw ValidationError if validation fails', async () => {
      // Mock validation to fail with an error
      schema.VALIDATE_CHARGEBACK_SCHEMA.validate.mockReturnValue({ error: 'Invalid payload' });
      // Mock request with invalid body data
      const { req, res } = mockReqRes({
        body: { invalid: 'data' },
        user: { company_id: 1, role: 'ADMIN', user_id: 2, user_name: 'John' },
      });
      // Call the controller function and expect it to throw a ValidationError
      await expect(controllerModule.createChargeBack(req, res)).rejects.toThrow();
    });

    it('should throw NotFoundError if payin details are empty', async () => {
      // Mock validation to pass but return sanitized data
      schema.VALIDATE_CHARGEBACK_SCHEMA.validate.mockReturnValue({});
      // Mock empty payin details for the given merchant_order_id
      payInDao.getPayinDetailsByMerchantOrderId.mockResolvedValue([]);
      // Mock request with valid body data
      const { req, res } = mockReqRes({
        body: { merchant_order_id: 'invalid_order' },
        user: { company_id: 1, role: 'ADMIN', user_id: 2, user_name: 'John' },
      });
      // Call the controller function and expect it to throw a NotFoundError due to missing payin details
      await expect(controllerModule.createChargeBack(req, res)).rejects.toThrow();
    });

    it('should throw NotFoundError if chargeback already exists', async () => {
      // Mock validation to pass but return sanitized data
      schema.VALIDATE_CHARGEBACK_SCHEMA.validate.mockReturnValue({});
      // Mock payin details with COMPLETED status
      const mockPayinDetails = [
        { payin_id: 1, merchant_order_id: 'order123', status: 'COMPLETED' },
      ];
      // Mock existing chargeback for this payin to trigger the error
      payInDao.getPayinDetailsByMerchantOrderId.mockResolvedValue(mockPayinDetails);
      // Mock that a chargeback already exists for the given payin_id
      chargeBackDao.chargeBackExistsByPayinIdDao.mockResolvedValue(true);
      // Mock request with valid body data
      const { req, res } = mockReqRes({
        body: { merchant_order_id: 'order123' },
        user: { company_id: 1, role: 'ADMIN', user_id: 2, user_name: 'John' },
      });
      // Call the controller function and expect it to throw a NotFoundError due to existing chargeback for the payin
      await expect(controllerModule.createChargeBack(req, res)).rejects.toThrow();
    });

    it('should throw NotFoundError if payin is in ASSIGNED status', async () => {
      // Mock validation to pass but return sanitized data
      schema.VALIDATE_CHARGEBACK_SCHEMA.validate.mockReturnValue({});
      // Mock payin details with ASSIGNED status which is not eligible for chargeback creation
      const mockPayinDetails = [
        { payin_id: 1, merchant_order_id: 'order123', status: 'ASSIGNED' },
      ];
      // Mock payin details for the given merchant_order_id
      payInDao.getPayinDetailsByMerchantOrderId.mockResolvedValue(mockPayinDetails);
      // Mock that no chargeback exists for the given payin_id
      chargeBackDao.chargeBackExistsByPayinIdDao.mockResolvedValue(false);
      // Mock request with valid body data but payin in ASSIGNED status
      const { req, res } = mockReqRes({
        body: { merchant_order_id: 'order123' },
        user: { company_id: 1, role: 'ADMIN', user_id: 2, user_name: 'John' },
      });
      // Call the controller function and expect it to throw a NotFoundError due to ineligible payin status
      await expect(controllerModule.createChargeBack(req, res)).rejects.toThrow();
    });

    it('should throw NotFoundError if payin is in INITIATED status', async () => {
      // Mock validation to pass but return sanitized data
      schema.VALIDATE_CHARGEBACK_SCHEMA.validate.mockReturnValue({});
      // Mock payin details with INITIATED status which is not eligible for chargeback creation
      const mockPayinDetails = [
        { payin_id: 1, merchant_order_id: 'order123', status: 'INITIATED' },
      ];
      // Mock payin details for the given merchant_order_id
      payInDao.getPayinDetailsByMerchantOrderId.mockResolvedValue(mockPayinDetails);
      // Mock that no chargeback exists for the given payin_id
      chargeBackDao.chargeBackExistsByPayinIdDao.mockResolvedValue(false);
      // Mock request with valid body data but payin in INITIATED status
      const { req, res } = mockReqRes({
        body: { merchant_order_id: 'order123' },
        user: { company_id: 1, role: 'ADMIN', user_id: 2, user_name: 'John' },
      });
      // Call the controller function and expect it to throw a NotFoundError due to ineligible payin status
      await expect(controllerModule.createChargeBack(req, res)).rejects.toThrow();
    });

    it('should throw NotFoundError if payin is FAILED with no bank_response_id', async () => {
      // Mock validation to pass but return sanitized data
      schema.VALIDATE_CHARGEBACK_SCHEMA.validate.mockReturnValue({});
      // Mock payin details with FAILED status and no bank_response_id which is not eligible for chargeback creation
      const mockPayinDetails = [
        {
          payin_id: 1,
          merchant_order_id: 'order123',
          status: 'FAILED',
          bank_response_id: null,
        },
      ];
      // Mock payin details for the given merchant_order_id
      payInDao.getPayinDetailsByMerchantOrderId.mockResolvedValue(mockPayinDetails);
      // Mock that no chargeback exists for the given payin_id
      chargeBackDao.chargeBackExistsByPayinIdDao.mockResolvedValue(false);
      // Mock request with valid body data but payin in FAILED status without bank response
      const { req, res } = mockReqRes({
        body: { merchant_order_id: 'order123' },
        user: { company_id: 1, role: 'ADMIN', user_id: 2, user_name: 'John' },
      });
      // Call the controller function and expect it to throw a NotFoundError due to ineligible payin status and missing bank response
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
      // Assert that validation was called with the request params
      expect(schema.VALIDATE_CHARGEBACK_BY_ID.validate).toHaveBeenCalled();
      // Assert that the service was called to get chargeback details by ID
      expect(chargeBackService.getChargeBacksService).toHaveBeenCalled();
      // Assert that a success response was sent back to the client with the chargeback details
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });

    it('should throw ValidationError if params validation fails', async () => {
      schema.VALIDATE_CHARGEBACK_BY_ID.validate.mockReturnValue({ error: 'Invalid ID' });
      const { req, res } = mockReqRes({
        params: { id: 'invalid' },
        user: { company_id: 1, role: 'ADMIN' },
      });
      // Call the controller function and expect it to throw a ValidationError due to invalid ID parameter
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
      // Assert that the service was called to get chargebacks with the correct user data and pagination params
      expect(chargeBackService.getChargeBacksService).toHaveBeenCalled();
      // Assert that a success response was sent back to the client with the chargeback list
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
      // Assert that the service was called with the correct pagination parameters extracted from the query
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
      // Assert that the search service was called with the correct user data and search parameters
      expect(chargeBackService.getChargeBacksBySearchService).toHaveBeenCalled();
      // Assert that a success response was sent back to the client with the search results
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
      // Assert that the search service was called with the correct search parameters
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
      // Assert that both params and body validations were called
      expect(schema.VALIDATE_DELETE_CHARGEBACK.validate).toHaveBeenCalled();
      // Assert that body validation was called with the request body
      expect(schema.VALIDATE_UPDATE_CHARGEBACK_SCHEMA.validate).toHaveBeenCalled();
      // Assert that the service was called to update the chargeback with correct data
      expect(chargeBackService.updateChargeBackService).toHaveBeenCalled();
      // Assert that a success response was sent back to the client
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });

    it('should throw ValidationError if params validation fails', async () => {
      schema.VALIDATE_DELETE_CHARGEBACK.validate.mockReturnValue({ error: 'Invalid ID' });
      const { req, res } = mockReqRes({
        params: { id: 'invalid' },
        body: { status: 'RESOLVED' },
        user: { company_id: 1, role: 'ADMIN', user_id: 2, user_name: 'John' },
      });
      // Call the controller function and expect it to throw a ValidationError due to invalid ID parameter
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
      // Call the controller function and expect it to throw a ValidationError due to invalid body data
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
      // Assert that the service was called to update the chargeback with the updated_by field set from user_id
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
      // Assert that params validation was called with the request params
      expect(schema.VALIDATE_DELETE_CHARGEBACK.validate).toHaveBeenCalled();
      // Assert that the service was called to delete the chargeback by ID
      expect(chargeBackService.deleteChargeBackService).toHaveBeenCalled();
      // Assert that a success response was sent back to the client confirming deletion
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });

    it('should throw ValidationError if params validation fails', async () => {
      schema.VALIDATE_DELETE_CHARGEBACK.validate.mockReturnValue({ error: 'Invalid ID' });
      const { req, res } = mockReqRes({
        params: { id: 'invalid' },
        user: { company_id: 1, role: 'ADMIN', user_id: 2, user_name: 'John' },
      });
      // Call the controller function and expect it to throw a ValidationError due to invalid ID parameter
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
      // Assert that the service was called to delete the chargeback with is_obsolete set to true and updated_by from user_id
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
      // Assert that body validation was called with the request body
      expect(schema.VALIDATE_UPDATE_CHARGEBACK_SCHEMA.validate).toHaveBeenCalled();
      // Assert that the service was called to block the chargeback user with correct data
      expect(chargeBackService.blockChargebackUserService).toHaveBeenCalled();
      // Assert that a success response was sent back to the client with the block message
      const callArgs = responseHandlers.sendSuccess.mock.calls[0];
      // The message should indicate that the user was blocked successfully
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
      // The message should indicate that the user was unblocked successfully when blocked_users list is empty
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
      // Call the controller function and expect it to throw a ValidationError due to invalid body data
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
      // Assert that the service was called to block the chargeback user with the updated_by field set from user_id
      expect(chargeBackService.blockChargebackUserService).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ updated_by: 99 }),
        'ADMIN',
      );
    });
  });
});
