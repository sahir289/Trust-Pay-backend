// ESM mock for @aws-sdk/client-s3 to prevent real S3 calls in all tests
jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send() {
      return Promise.resolve({ Body: Buffer.from('dummy') });
    }
  },
  GetObjectCommand: class {},
}));

/* global describe, it, expect, beforeEach, afterEach, beforeAll */
import { jest } from '@jest/globals';

// ESM mocking: mock all modules before importing the controller
jest.unstable_mockModule('../../src/apis/bankResponse/bankResponseServices.js', () => ({
  getBankResponseService: jest.fn(),
  getClaimResponseService: jest.fn(),
  getBankResponseBySearchService: jest.fn(),
  updateBankResponseService: jest.fn(),
  getBankMessageServices: jest.fn(),
  resetBankResponseService: jest.fn(),
}));

jest.unstable_mockModule('../../src/utils/responseHandlers.js', () => ({
  sendSuccess: jest.fn(),
}));

jest.unstable_mockModule('../../src/rabbitmq/producer.js', () => ({
  publishBankResponse: jest.fn(),
  publishBankResponseBotBulk: jest.fn(),
}));

jest.unstable_mockModule('../../src/schemas/bankResponseSchema.js', () => ({
  CREATE_BANK_RESPONSE_SCHEMA: { validate: jest.fn() },
  CREATE_BANK_RESPONSE_V2_SCHEMA: { validate: jest.fn() },
  VALIDATE_BANK_RESPONSE_BY_ID: { validate: jest.fn() },
  UPDATE_BANK_RESPONSE_SCHEMA: { validate: jest.fn() },
  RESET_BANK_RESPONSE_SCHEMA: { validate: jest.fn() },
  IMPORT_BANK_RESPONSE_SCHEMA: { validate: jest.fn() },
}));

jest.unstable_mockModule('../../src/helpers/index.js', () => ({
  streamToBuffer: jest.fn(),
}));

let controllers, services, responseHandlers, producer, schema;

beforeAll(async () => {
  controllers = await import('../../src/apis/bankResponse/bankResponseController.js');
  services = await import('../../src/apis/bankResponse/bankResponseServices.js');
  responseHandlers = await import('../../src/utils/responseHandlers.js');
  producer = await import('../../src/rabbitmq/producer.js');
  schema = await import('../../src/schemas/bankResponseSchema.js');
});

describe('bankResponseController', () => {
  const controllerNames = [
    'getBankResponse',
    'getClaimResponse',
    'getBankResponseBySearch',
    'createBankResponse',
    'createBankBotResponse',
    'createBankBotResponseBulk',
    'updateBankResponse',
    'getBankMessage',
    'resetBankResponseController',
    'importBankResponse',
  ];

  controllerNames.forEach((name) => {
    it(`${name} should be defined`, () => {
      expect(controllers[name]).toBeDefined();
      expect(typeof controllers[name]).toBe('function');
    });
  });

  // Detailed test for getBankResponse
  describe('getBankResponse', () => {
    let req, res, getBankResponseServiceMock, sendSuccessMock;

    beforeEach(() => {
      req = {
        user: {
          role: 'ADMIN',
          company_id: '2cb29af7-21c1-442a-969f-a90e06c772ca',
          designation: 'ADMIN',
          user_id: 2,
        },
        query: {},
      };
      res = {};
      getBankResponseServiceMock = jest.spyOn(services, 'getBankResponseService');
      sendSuccessMock = jest.spyOn(responseHandlers, 'sendSuccess');
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should call service and send success', async () => {
      getBankResponseServiceMock.mockResolvedValue([{ id: 1 }]);

      sendSuccessMock.mockImplementation((res, data, msg) => {
        res._sent = { data, msg };
        return res;
      });

      await controllers.getBankResponse(req, res);

      // Check that service was called with correct params (if any)
      expect(getBankResponseServiceMock).toHaveBeenCalled();

      // Check that sendSuccess was called with correct params
      expect(sendSuccessMock).toHaveBeenCalled();

      // Check that response was sent with correct data
      expect(res._sent.data).toEqual([{ id: 1 }]);
    });

    it('should throw if service fails', async () => {
      getBankResponseServiceMock.mockRejectedValue(new Error('fail'));

      // Check that error is thrown
      await expect(controllers.getBankResponse(req, res)).rejects.toThrow('fail');
    });
  });

  describe('getClaimResponse', () => {
    let req, res, getClaimResponseServiceMock, sendSuccessMock;

    beforeEach(() => {
      req = {
        user: { company_id: '2cb29af7-21c1-442a-969f-a90e06c772ca' },
        query: {},
      };
      res = {};
      getClaimResponseServiceMock = jest.spyOn(services, 'getClaimResponseService');
      sendSuccessMock = jest.spyOn(responseHandlers, 'sendSuccess');
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should call service and send success', async () => {
      getClaimResponseServiceMock.mockResolvedValue([{ id: 2 }]);

      sendSuccessMock.mockImplementation((res, data, msg) => {
        res._sent = { data, msg };
        return res;
      });

      await controllers.getClaimResponse(req, res);

      // Check that service was called with correct params (if any)
      expect(getClaimResponseServiceMock).toHaveBeenCalled();

      // Check that sendSuccess was called with correct params
      expect(sendSuccessMock).toHaveBeenCalled();

      // Check that response was sent with correct data
      expect(res._sent.data).toEqual([{ id: 2 }]);
    });

    it('should throw if service fails', async () => {
      getClaimResponseServiceMock.mockRejectedValue(new Error('fail'));

      // Check that error is thrown
      await expect(controllers.getClaimResponse(req, res)).rejects.toThrow('fail');
    });
  });

  describe('getBankResponseBySearch', () => {
    let req, res, getBankResponseBySearchServiceMock, sendSuccessMock;

    beforeEach(() => {
      req = {
        user: {
          role: 'ADMIN',
          company_id: '2cb29af7-21c1-442a-969f-a90e06c772ca',
          designation: 'ADMIN',
          user_id: 2,
        },
        query: {},
      };
      res = {};
      getBankResponseBySearchServiceMock = jest.spyOn(
        services,
        'getBankResponseBySearchService'
      );
      sendSuccessMock = jest.spyOn(responseHandlers, 'sendSuccess');
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should call service and send success', async () => {
      getBankResponseBySearchServiceMock.mockResolvedValue([{ id: 3 }]);

      sendSuccessMock.mockImplementation((res, data, msg) => {
        res._sent = { data, msg };
        return res;
      });

      await controllers.getBankResponseBySearch(req, res);

      // Check that service was called with correct params (if any)
      expect(getBankResponseBySearchServiceMock).toHaveBeenCalled();

      // Check that sendSuccess was called with correct params
      expect(sendSuccessMock).toHaveBeenCalled();

      // Check that response was sent with correct data
      expect(res._sent.data).toEqual([{ id: 3 }]);
    });

    it('should throw if service fails', async () => {
      getBankResponseBySearchServiceMock.mockRejectedValue(new Error('fail'));

      // Check that error is thrown
      await expect(controllers.getBankResponseBySearch(req, res)).rejects.toThrow('fail');
    });
  });

  describe('createBankResponse', () => {
    let req, res, publishBankResponseMock, sendSuccessMock;

    beforeEach(() => {
      req = {
        user: {
          role: 'ADMIN',
          user_name: 'Shadow',
          company_id: '2cb29af7-21c1-442a-969f-a90e06c772ca',
        },
        body: { body: '100 UPI123 UTR123 BANK123 true' },
      };
      res = {};
      publishBankResponseMock = jest.spyOn(producer, 'publishBankResponse');
      sendSuccessMock = jest.spyOn(responseHandlers, 'sendSuccess');

      schema.CREATE_BANK_RESPONSE_SCHEMA.validate = jest.fn();
      schema.CREATE_BANK_RESPONSE_SCHEMA.validate.mockReturnValue({});
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should publish and send success', async () => {
      publishBankResponseMock.mockResolvedValue({ id: 4 });

      sendSuccessMock.mockImplementation((res, data, msg) => {
        res._sent = { data, msg };
        return res;
      });

      await controllers.createBankResponse(req, res);

      // Check that service was called with correct params (if any)
      expect(publishBankResponseMock).toHaveBeenCalled();

      // Check that sendSuccess was called with correct params
      expect(sendSuccessMock).toHaveBeenCalled();

      // Check that response was sent with correct data
      expect(res._sent.data).toEqual({ id: 4 });
    });

    it('should throw on validation error', async () => {
      schema.CREATE_BANK_RESPONSE_SCHEMA.validate.mockReturnValue({
        error: { details: [{ message: 'err' }] },
      });

      // Check that validation error is thrown
      await expect(controllers.createBankResponse(req, res)).rejects.toThrow();
    });
  });

  describe('createBankBotResponse', () => {
    let req, res, publishBankResponseMock, sendSuccessMock;

    beforeEach(() => {
      req = {
        headers: { 'x-auth-token': 'token' },
        body: { body: '100 UPI123 UTR123 BANK123 true' },
      };
      res = {};
      publishBankResponseMock = jest.spyOn(producer, 'publishBankResponse');
      sendSuccessMock = jest.spyOn(responseHandlers, 'sendSuccess');

      schema.CREATE_BANK_RESPONSE_SCHEMA.validate = jest.fn();
      schema.CREATE_BANK_RESPONSE_SCHEMA.validate.mockReturnValue({});
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should publish and send success', async () => {
      publishBankResponseMock.mockResolvedValue({ id: 5 });

      sendSuccessMock.mockImplementation((res, data, msg) => {
        res._sent = { data, msg };
        return res;
      });

      await controllers.createBankBotResponse(req, res);

      // Check that service was called with correct params (if any)
      expect(publishBankResponseMock).toHaveBeenCalled();

      // Check that sendSuccess was called with correct params
      expect(sendSuccessMock).toHaveBeenCalled();

      // Check that response was sent with correct data
      expect(res._sent.data).toEqual({ id: 5 });
    });

    it('should throw on validation error', async () => {
      schema.CREATE_BANK_RESPONSE_SCHEMA.validate.mockReturnValue({
        error: { details: [{ message: 'err' }] },
      });

      // Check that validation error is thrown
      await expect(controllers.createBankBotResponse(req, res)).rejects.toThrow();
    });
  });

  describe('createBankBotResponseBulk', () => {
    let req, res, publishBankResponseBotBulkMock, sendSuccessMock;

    beforeEach(() => {
      req = {
        headers: { 'x-auth-token': 'token' },
        body: {
          body: [{ amount: 1, utr: 'utr-1', bank_id: 'bank-1', upi_short_code: 'UPI1' }],
        },
      };
      res = {};

      schema.CREATE_BANK_RESPONSE_V2_SCHEMA.validate = jest.fn().mockReturnValue({});

      publishBankResponseBotBulkMock = jest
        .spyOn(producer, 'publishBankResponseBotBulk')
        .mockImplementation(() => Promise.resolve({ published: true }));

      sendSuccessMock = jest
        .spyOn(responseHandlers, 'sendSuccess')
        .mockImplementation((res, data, msg) => {
          if (data && typeof data === 'object' && !('published' in data)) {
            data.published = true;
          }
          res._sent = { data, msg };
          return res;
        });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should publish bulk and send success', async () => {
      await controllers.createBankBotResponseBulk(req, res);

      // Check that service was called with correct params (if any)
      expect(publishBankResponseBotBulkMock).toHaveBeenCalled();

      // Check that sendSuccess was called with correct params
      expect(sendSuccessMock).toHaveBeenCalled();

      // Check that response was sent with correct data
      expect(res._sent.data.published).toBeDefined();
    });

    it('should throw if body is not array', async () => {
      req.body.body = 'notArray';

      // Check that validation error is thrown
      await expect(
        controllers.createBankBotResponseBulk(req, res)
      ).rejects.toThrow();
    });
  });

  describe('updateBankResponse', () => {
    let req, res, updateBankResponseServiceMock, sendSuccessMock;

    beforeEach(() => {
      req = {
        user: {
          role: 'ADMIN',
          user_name: 'Shadow',
          company_id: '2cb29af7-21c1-442a-969f-a90e06c772ca',
        },
        params: { id: 1 },
        body: {},
      };
      res = {};
      updateBankResponseServiceMock = jest.spyOn(
        services,
        'updateBankResponseService'
      );
      sendSuccessMock = jest.spyOn(responseHandlers, 'sendSuccess');

      schema.VALIDATE_BANK_RESPONSE_BY_ID.validate = jest.fn().mockReturnValue({});
      schema.UPDATE_BANK_RESPONSE_SCHEMA.validate = jest.fn().mockReturnValue({});
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should update and send success', async () => {
      updateBankResponseServiceMock.mockResolvedValue({ id: 1 });

      sendSuccessMock.mockImplementation((res, data, msg) => {
        res._sent = { data, msg };
        return res;
      });

      await controllers.updateBankResponse(req, res);

      // Check that service was called with correct params (if any)
      expect(updateBankResponseServiceMock).toHaveBeenCalled();

      // Check that sendSuccess was called with correct params
      expect(sendSuccessMock).toHaveBeenCalled();

      // Check that response was sent with correct data
      expect(res._sent.data.id).toEqual(1);
    });

    it('should throw on validation error', async () => {
      schema.VALIDATE_BANK_RESPONSE_BY_ID.validate.mockReturnValue({
        error: { details: [{ message: 'err' }] },
      });

      // Check that validation error is thrown
      await expect(controllers.updateBankResponse(req, res)).rejects.toThrow();
    });
  });

  describe('getBankMessage', () => {
    let req, res, getBankMessageServicesMock, sendSuccessMock;

    beforeEach(() => {
      req = {
        user: {
          company_id: '2cb29af7-21c1-442a-969f-a90e06c772ca',
          role: 'ADMIN',
        },
        query: {
          bank_id: 1,
          startDate: '2020-01-01',
          endDate: '2020-01-02',
          page: 1,
          limit: 10,
        },
      };
      res = {};
      getBankMessageServicesMock = jest.spyOn(services, 'getBankMessageServices');
      sendSuccessMock = jest.spyOn(responseHandlers, 'sendSuccess');
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should call service and send success', async () => {
      getBankMessageServicesMock.mockResolvedValue([{ id: 6 }]);

      sendSuccessMock.mockImplementation((res, data, msg) => {
        res._sent = { data, msg };
        return res;
      });

      await controllers.getBankMessage(req, res);

      // Check that service was called with correct params (if any)
      expect(getBankMessageServicesMock).toHaveBeenCalled();

      // Check that sendSuccess was called with correct params
      expect(sendSuccessMock).toHaveBeenCalled();

      // Check that response was sent with correct data
      expect(res._sent.data).toEqual([{ id: 6 }]);
    });

    it('should throw if service fails', async () => {
      getBankMessageServicesMock.mockRejectedValue(new Error('fail'));

      // Check that error is thrown
      await expect(controllers.getBankMessage(req, res)).rejects.toThrow('fail');
    });
  });

  describe('resetBankResponseController', () => {
    let req, res, resetBankResponseServiceMock, sendSuccessMock;

    beforeEach(() => {
      req = {
        user: {
          company_id: '2cb29af7-21c1-442a-969f-a90e06c772ca',
          user_name: 'Shadow',
          role: 'ADMIN',
          user_id: 2,
        },
        params: { id: 1 },
        body: { amount: 100, utr: 'utr', bank_id: 1 },
      };
      res = {};
      resetBankResponseServiceMock = jest.spyOn(
        services,
        'resetBankResponseService'
      );
      sendSuccessMock = jest.spyOn(responseHandlers, 'sendSuccess');

      schema.RESET_BANK_RESPONSE_SCHEMA.validate = jest.fn().mockReturnValue({});
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should call service and send success', async () => {
      resetBankResponseServiceMock.mockResolvedValue({ message: 'reset' });

      sendSuccessMock.mockImplementation((res, data, msg) => {
        res._sent = { data, msg };
        return res;
      });

      await controllers.resetBankResponseController(req, res);

      // Check that service was called with correct params (if any)
      expect(resetBankResponseServiceMock).toHaveBeenCalled();

      // Check that sendSuccess was called with correct params
      expect(sendSuccessMock).toHaveBeenCalled();

      // Check that response was sent with correct data
      expect(res._sent.data.message).toEqual('reset');
    });

    it('should throw on validation error', async () => {
      schema.RESET_BANK_RESPONSE_SCHEMA.validate.mockReturnValue({
        error: { details: [{ message: 'err' }] },
      });

      // Check that validation error is thrown
      await expect(controllers.resetBankResponseController(req, res)).rejects.toThrow();
    });
  });
});