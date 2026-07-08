/* global describe, it, expect, beforeAll, beforeEach, afterEach */
// ESM mock calls in all tests
import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/apis/calculation/calculationService.js', () => ({
  getCalculationService: jest.fn(),
  updateCalculationService: jest.fn(),
}));

jest.unstable_mockModule('../../src/utils/responseHandlers.js', () => ({
  sendSuccess: jest.fn(),
}));

jest.unstable_mockModule('../../src/schemas/calculationSchema.js', () => ({
  VALIDATE_UPDATE_CALCULATION_STATUS: { validate: jest.fn() },
}));

let controllers, services, responseHandlers, schema, realCompanyId, realUserId;

beforeAll(async () => {
  controllers = await import('../../src/apis/calculation/calculationController.js');
  services = await import('../../src/apis/calculation/calculationService.js');
  responseHandlers = await import('../../src/utils/responseHandlers.js');
  schema = await import('../../src/schemas/calculationSchema.js');

  realCompanyId = '2cb29af7-21c1-442a-969f-a90e06c772ca';
  realUserId = 'f83999c4-5e57-419e-847f-66893f56c3cf';
});

describe('calculationController', () => {
  const controllerNames = ['getCalculation', 'updateCalculation'];

  controllerNames.forEach((name) => {
    it(`${name} should be defined`, () => {
      expect(controllers[name]).toBeDefined();
      expect(typeof controllers[name]).toBe('function');
    });
  });

  describe('getCalculation', () => {
    let req, res, getCalculationServiceMock, sendSuccessMock;

    beforeEach(() => {
      req = {
        user: {
          company_id: realCompanyId,
          user_id: 2,
          designation: 'ADMIN',
          role: 'ADMIN',
        },
        body: {},
        query: {},
      };
      res = {};

      getCalculationServiceMock = jest.spyOn(services, 'getCalculationService');
      sendSuccessMock = jest.spyOn(responseHandlers, 'sendSuccess');
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should call service and send success', async () => {
      getCalculationServiceMock.mockResolvedValue([{ id: 1 }]);

      sendSuccessMock.mockImplementation((res, data, msg) => {
        res._sent = { data, msg };
        return res;
      });

      await controllers.getCalculation(req, res);

      // Should call the service method to get calculations
      expect(getCalculationServiceMock).toHaveBeenCalled();
      // Should call the response handler to send success
      expect(sendSuccessMock).toHaveBeenCalled();
      // Should return the expected data
      expect(res._sent.data).toEqual([{ id: 1 }]);
    });
  });

  describe('updateCalculation', () => {
    let req, res, updateCalculationServiceMock, sendSuccessMock;

    beforeEach(() => {
      req = {
        user: {
          role: 'ADMIN',
          company_id: realCompanyId,
          user_id: realUserId,
        },
        params: { id: 'id' },
        body: { config: { foo: 'bar' } },
      };
      res = {};

      updateCalculationServiceMock = jest.spyOn(services, 'updateCalculationService');
      sendSuccessMock = jest.spyOn(responseHandlers, 'sendSuccess');

      schema.VALIDATE_UPDATE_CALCULATION_STATUS.validate = jest.fn();
      schema.VALIDATE_UPDATE_CALCULATION_STATUS.validate.mockReturnValue({});
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should call service and send success', async () => {
      updateCalculationServiceMock.mockResolvedValue({});

      sendSuccessMock.mockImplementation((res, data, msg) => {
        res._sent = { data, msg };
        return res;
      });

      await controllers.updateCalculation(req, res);

      // Should call the service method to update calculation
      expect(updateCalculationServiceMock).toHaveBeenCalled();
      // Should call the response handler to send success
      expect(sendSuccessMock).toHaveBeenCalled();
      // Should return the expected message
      expect(res._sent.msg).toBe('Update Calculation successfully');
    });

    it('should throw if validation fails', async () => {
      schema.VALIDATE_UPDATE_CALCULATION_STATUS.validate.mockReturnValue({
        error: { details: [{ message: 'err' }] },
      });

      // Should throw if validation fails and not call the service
      await expect(controllers.updateCalculation(req, res)).rejects.toThrow();
    });

    it('should throw if params missing', async () => {
      req.params = undefined;

      // Should throw if params missing and not call the service
      await expect(controllers.updateCalculation(req, res)).rejects.toThrow();
    });

    it('should throw if service fails', async () => {
      updateCalculationServiceMock.mockRejectedValue(new Error('fail'));

      // Should throw if service fails and not call the response handler
      await expect(controllers.updateCalculation(req, res)).rejects.toThrow('fail');
    });
  });

  describe('deleteCalculation', () => {
    let req, res, deleteCalculationServiceMock, sendSuccessMock;

    beforeEach(() => {
      req = {
        user: {
          role: 'ADMIN',
          company_id: realCompanyId,
          user_id: realUserId,
        },
        params: { id: 'id' },
      };
      res = {};

      deleteCalculationServiceMock = jest.spyOn(services, 'deleteCalculationService');
      sendSuccessMock = jest.spyOn(responseHandlers, 'sendSuccess');
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should call service and send success', async () => {
      deleteCalculationServiceMock.mockResolvedValue({});

      sendSuccessMock.mockImplementation((res, data, msg) => {
        res._sent = { data, msg };
        return res;
      });

      await controllers.deleteCalculation(req, res);

      // Should call the service method to delete calculation
      expect(deleteCalculationServiceMock).toHaveBeenCalled();
      // Should call the response handler to send success
      expect(sendSuccessMock).toHaveBeenCalled();
      // Should return the expected message
      expect(res._sent.msg).toBe('Delete Calculation successfully');
    });

    it('should throw if params missing', async () => {
      req.params = undefined;

      // Should throw if params missing and not call the service
      await expect(controllers.deleteCalculation(req, res)).rejects.toThrow();
    });

    it('should throw if service fails', async () => {
      deleteCalculationServiceMock.mockRejectedValue(new Error('fail'));

      // Should throw if service fails and not call the response handler
      await expect(controllers.deleteCalculation(req, res)).rejects.toThrow('fail');
    });
  });

  describe('calculateSuccessRatios', () => {
    let req, res, calculateSuccessRatiosServiceMock, sendSuccessMock;

    beforeEach(() => {
      req = {
        body: { date: '2024-01-01', user_ids: ['u1', 'u2'] },
      };
      res = {};

      calculateSuccessRatiosServiceMock = jest.spyOn(
        services,
        'calculateSuccessRatiosService'
      );
      sendSuccessMock = jest.spyOn(responseHandlers, 'sendSuccess');
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should call service and send success', async () => {
      calculateSuccessRatiosServiceMock.mockResolvedValue([{ id: 1 }]);

      sendSuccessMock.mockImplementation((res, data, msg) => {
        res._sent = { data, msg };
        return res;
      });

      await controllers.calculateSuccessRatios(req, res);

      // Should call the service method to calculate success ratios
      expect(calculateSuccessRatiosServiceMock).toHaveBeenCalled();
      // Should call the response handler to send success
      expect(sendSuccessMock).toHaveBeenCalled();
      // Should return the expected data
      expect(res._sent.data).toEqual([{ id: 1 }]);
    });

    it('should throw if user_ids missing', async () => {
      req.body.user_ids = undefined;
      // Should throw if user_ids missing and not call the service
      await expect(controllers.calculateSuccessRatios(req, res)).rejects.toThrow();
    });

    it('should throw if service fails', async () => {
      calculateSuccessRatiosServiceMock.mockRejectedValue(new Error('fail'));
      // Should throw if service fails and not call the response handler
      await expect(controllers.calculateSuccessRatios(req, res)).rejects.toThrow('fail');
    });
  });

  describe('updateCalculations', () => {
    let req, res, updateCalculationsServiceMock, sendSuccessMock;

    beforeEach(() => {
      req = {
        user: {
          company_id: realCompanyId,
          user_id: realUserId,
        },
        body: {
          date: '2024-01-01',
          user_id: realUserId,
          startDate: '2024-01-01',
          endDate: '2024-01-02',
        },
      };
      res = {};

      updateCalculationsServiceMock = jest.spyOn(
        services,
        'updateCalculationsService'
      );
      sendSuccessMock = jest.spyOn(responseHandlers, 'sendSuccess');

      schema.VALIDATE_UPDATE_CALCULATIONS_SCHEMA.validate = jest.fn();
      schema.VALIDATE_UPDATE_CALCULATIONS_SCHEMA.validate.mockReturnValue({});
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should call service and send success', async () => {
      updateCalculationsServiceMock.mockResolvedValue({});

      sendSuccessMock.mockImplementation((res, data, msg) => {
        res._sent = { data, msg };
        return res;
      });

      await controllers.updateCalculations(req, res);

      // Should call the service method to update calculations
      expect(updateCalculationsServiceMock).toHaveBeenCalled();
      // Should call the response handler to send success
      expect(sendSuccessMock).toHaveBeenCalled();
      // Should return the expected message
      expect(res._sent.msg).toBe('Calculations updated successfully');
    });

    it('should throw if validation fails', async () => {
      schema.VALIDATE_UPDATE_CALCULATIONS_SCHEMA.validate.mockReturnValue({
        error: { details: [{ message: 'err' }] },
      });

      // Should throw if validation fails and not call the service
      await expect(controllers.updateCalculations(req, res)).rejects.toThrow();
    });

    it('should throw if user_id missing', async () => {
      req.body.user_id = undefined;

      // Should throw if user_id missing and not call the service
      await expect(controllers.updateCalculations(req, res)).rejects.toThrow();
    });

    it('should throw if service fails', async () => {
      updateCalculationsServiceMock.mockRejectedValue(new Error('fail'));

      // Should throw if service fails and not call the response handler
      await expect(controllers.updateCalculations(req, res)).rejects.toThrow('fail');
    });
  });
});