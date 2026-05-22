/* global describe, it, expect, beforeAll, beforeEach, afterEach */
// ESM mock calls in all tests
import { jest, } from '@jest/globals';

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

  const controllerNames = [
    'getCalculation',
    'updateCalculation',
  ];

  controllerNames.forEach((name) => {
    it(`${name} should be defined`, () => {
      expect(controllers[name]).toBeDefined();
      expect(typeof controllers[name]).toBe('function');
    });
  });

  describe('getCalculation', () => {
    let req, res, getCalculationServiceMock, sendSuccessMock;
    beforeEach(() => {
      req = { user: { company_id: realCompanyId, user_id: 2, designation: 'ADMIN', role: 'ADMIN' }, query: {} };
      res = {};
      getCalculationServiceMock = jest.spyOn(services, 'getCalculationService');
      sendSuccessMock = jest.spyOn(responseHandlers, 'sendSuccess');
    });
    afterEach(() => { jest.clearAllMocks(); });
    it('should call service and send success', async () => {
      getCalculationServiceMock.mockResolvedValue([{ id: 1 }]);
      sendSuccessMock.mockImplementation((res, data, msg) => { res._sent = { data, msg }; return res; });
      await controllers.getCalculation(req, res);
      expect(getCalculationServiceMock).toHaveBeenCalled();
      expect(sendSuccessMock).toHaveBeenCalled();
      expect(res._sent.data).toEqual([{ id: 1 }]);
    });
    // it('should throw if service fails', async () => {
    //   getCalculationServiceMock.mockRejectedValue(new Error('fail'));
    //   await expect(controllers.getCalculation(req, res)).rejects.toThrow('fail');
    // });
  });

  describe('updateCalculation', () => {
    let req, res, updateCalculationServiceMock, sendSuccessMock;
    beforeEach(() => {
      req = { user: { role: 'ADMIN', company_id: realCompanyId, user_id: realUserId }, params: { id: 'id' }, body: { config: { foo: 'bar' } } };
      res = {};
      updateCalculationServiceMock = jest.spyOn(services, 'updateCalculationService');
      sendSuccessMock = jest.spyOn(responseHandlers, 'sendSuccess');
      schema.VALIDATE_UPDATE_CALCULATION_STATUS.validate = jest.fn()
      schema.VALIDATE_UPDATE_CALCULATION_STATUS.validate.mockReturnValue({});
    });
    afterEach(() => { jest.clearAllMocks(); });
    it('should call service and send success', async () => {
      updateCalculationServiceMock.mockResolvedValue({});
      sendSuccessMock.mockImplementation((res, data, msg) => { res._sent = { data, msg }; return res; });
      await controllers.updateCalculation(req, res);
      expect(updateCalculationServiceMock).toHaveBeenCalled();
      expect(sendSuccessMock).toHaveBeenCalled();
      expect(res._sent.msg).toBe('Update Calculation successfully');
    });
    it('should throw if validation fails', async () => {
      schema.VALIDATE_UPDATE_CALCULATION_STATUS.validate.mockReturnValue({ error: { details: [{ message: 'err' }] } });
      await expect(controllers.updateCalculation(req, res)).rejects.toThrow();
    });
    it('should throw if params missing', async () => {
      req.params = undefined;
      await expect(controllers.updateCalculation(req, res)).rejects.toThrow();
    });
    it('should throw if service fails', async () => {
      updateCalculationServiceMock.mockRejectedValue(new Error('fail'));
      await expect(controllers.updateCalculation(req, res)).rejects.toThrow('fail');
    });
  });

  describe('deleteCalculation', () => {
    let req, res, deleteCalculationServiceMock, sendSuccessMock;
    beforeEach(() => {
      req = { user: { role: 'ADMIN', company_id: realCompanyId, user_id: realUserId }, params: { id: 'id' } };
      res = {};
      deleteCalculationServiceMock = jest.spyOn(services, 'deleteCalculationService');
      sendSuccessMock = jest.spyOn(responseHandlers, 'sendSuccess');
    });
    afterEach(() => { jest.clearAllMocks(); });
    it('should call service and send success', async () => {
      deleteCalculationServiceMock.mockResolvedValue({});
      sendSuccessMock.mockImplementation((res, data, msg) => { res._sent = { data, msg }; return res; });
      await controllers.deleteCalculation(req, res);
      expect(deleteCalculationServiceMock).toHaveBeenCalled();
      expect(sendSuccessMock).toHaveBeenCalled();
      expect(res._sent.msg).toBe('Delete Calculation successfully');
    });
    it('should throw if params missing', async () => {
      req.params = undefined;
      await expect(controllers.deleteCalculation(req, res)).rejects.toThrow();
    });
    it('should throw if service fails', async () => {
      deleteCalculationServiceMock.mockRejectedValue(new Error('fail'));
      await expect(controllers.deleteCalculation(req, res)).rejects.toThrow('fail');
    });
  });

  describe('calculateSuccessRatios', () => {
    let req, res, calculateSuccessRatiosServiceMock, sendSuccessMock;
    beforeEach(() => {
      req = { body: { date: '2024-01-01', user_ids: ['u1', 'u2'] } };
      res = {};
      calculateSuccessRatiosServiceMock = jest.spyOn(services, 'calculateSuccessRatiosService');
      sendSuccessMock = jest.spyOn(responseHandlers, 'sendSuccess');
    });
    afterEach(() => { jest.clearAllMocks(); });
    it('should call service and send success', async () => {
      calculateSuccessRatiosServiceMock.mockResolvedValue([{ id: 1 }]);
      sendSuccessMock.mockImplementation((res, data, msg) => { res._sent = { data, msg }; return res; });
      await controllers.calculateSuccessRatios(req, res);
      expect(calculateSuccessRatiosServiceMock).toHaveBeenCalled();
      expect(sendSuccessMock).toHaveBeenCalled();
      expect(res._sent.data).toEqual([{ id: 1 }]);
    });
    it('should throw if user_ids missing', async () => {
      req.body.user_ids = undefined;
      await expect(controllers.calculateSuccessRatios(req, res)).rejects.toThrow();
    });
    it('should throw if service fails', async () => {
      calculateSuccessRatiosServiceMock.mockRejectedValue(new Error('fail'));
      await expect(controllers.calculateSuccessRatios(req, res)).rejects.toThrow('fail');
    });
  });

  describe('updateCalculations', () => {
    let req, res, updateCalculationsServiceMock, sendSuccessMock;
    beforeEach(() => {
      req = { user: { company_id: realCompanyId, user_id: realUserId }, body: { date: '2024-01-01', user_id: realUserId, startDate: '2024-01-01', endDate: '2024-01-02' } };
      res = {};
      updateCalculationsServiceMock = jest.spyOn(services, 'updateCalculationsService');
      sendSuccessMock = jest.spyOn(responseHandlers, 'sendSuccess');
      schema.VALIDATE_UPDATE_CALCULATIONS_SCHEMA.validate = jest.fn()
      schema.VALIDATE_UPDATE_CALCULATIONS_SCHEMA.validate.mockReturnValue({});
    });
    afterEach(() => { jest.clearAllMocks(); });
    it('should call service and send success', async () => {
      updateCalculationsServiceMock.mockResolvedValue({});
      sendSuccessMock.mockImplementation((res, data, msg) => { res._sent = { data, msg }; return res; });
      await controllers.updateCalculations(req, res);
      expect(updateCalculationsServiceMock).toHaveBeenCalled();
      expect(sendSuccessMock).toHaveBeenCalled();
      expect(res._sent.msg).toBe('Calculations updated successfully');
    });
    it('should throw if validation fails', async () => {
      schema.VALIDATE_UPDATE_CALCULATIONS_SCHEMA.validate.mockReturnValue({ error: { details: [{ message: 'err' }] } });
      await expect(controllers.updateCalculations(req, res)).rejects.toThrow();
    });
    it('should throw if user_id missing', async () => {
      req.body.user_id = undefined;
      await expect(controllers.updateCalculations(req, res)).rejects.toThrow();
    });
    it('should throw if service fails', async () => {
      updateCalculationsServiceMock.mockRejectedValue(new Error('fail'));
      await expect(controllers.updateCalculations(req, res)).rejects.toThrow('fail');
    });
  }); 
});
