import { ValidationError } from '../../utils/appErrors.js';
import * as controller from './chargeBackController.js';
import {
  VALIDATE_CHARGEBACK_SCHEMA,
  VALIDATE_CHARGEBACK_BY_ID,
  VALIDATE_UPDATE_CHARGEBACK_SCHEMA,
  VALIDATE_DELETE_CHARGEBACK
} from '../../schemas/chargeBackSchema.js';

// Mock all external dependencies
jest.mock('../../utils/responseHandlers.js', () => ({
  sendSuccess: jest.fn()
}));
jest.mock('./chargeBackService.js');
jest.mock('../payIn/payInDao.js');
jest.mock('./chargeBackDao.js');
jest.mock('../bankResponse/bankResponseDao.js');
jest.mock('../../schemas/chargeBackSchema.js', () => ({
  VALIDATE_CHARGEBACK_SCHEMA: { validate: jest.fn() },
  VALIDATE_CHARGEBACK_BY_ID: { validate: jest.fn() },
  VALIDATE_UPDATE_CHARGEBACK_SCHEMA: { validate: jest.fn() },
  VALIDATE_DELETE_CHARGEBACK: { validate: jest.fn() }
}));

// src/apis/chargeBacks/chargebackController.test.js

describe('ChargeBack Controller', () => {
    let req, res;
  
    beforeEach(() => {
      req = {
        body: {},
        params: {},
        query: {},
        user: { company_id: 1, role: 'admin', user_id: 99, user_name: 'Tester', designation: 'OPERATIONS' }
      };
      res = {};
      jest.clearAllMocks();
    });
  
    // ========================
    // createChargeBack
    // ========================
    describe('createChargeBack', () => {
      test('throws ValidationError if schema validation fails', async () => {
        VALIDATE_CHARGEBACK_SCHEMA.validate.mockReturnValue({
          error: {
            details: [{ message: '"field" is required' }]
          }
        });
  
        await expect(controller.createChargeBack(req, res))
          .rejects.toThrow(ValidationError);
      });
  
      // ... other tests remain unchanged
    });
  
    // ========================
    // getChargeBacksById
    // ========================
    describe('getChargeBacksById', () => {
      test('throws ValidationError if params invalid', async () => {
        VALIDATE_CHARGEBACK_BY_ID.validate.mockReturnValue({
          error: {
            details: [{ message: '"id" must be a number' }]
          }
        });
  
        await expect(controller.getChargeBacksById(req, res))
          .rejects.toThrow(ValidationError);
      });
  
      // ... other tests remain unchanged
    });
  
    describe('getChargeBacksBySearch', () => {
      test('should fetch chargebacks by search successfully', async () => {
        const mockData = [{ id: 1, amount: 100 }];
        require('./chargeBackService.js').getChargeBacksBySearchService.mockResolvedValue(mockData);
        req.query = { page: 1, limit: 10, search: 'test' };

        await controller.getChargeBacksBySearch(req, res);

        expect(require('./chargeBackService.js').getChargeBacksBySearchService).toHaveBeenCalledWith(
          { company_id: 1, search: 'test' },
          'admin',
          1,
          10,
          99,
          undefined,
          'OPERATIONS'
        );
        expect(require('../../utils/responseHandlers.js').sendSuccess).toHaveBeenCalledWith(
          res,
          mockData,
          'ChargeBacks fetched successfully'
        );
      });

      test('should handle service errors', async () => {
        const error = new Error('Service error');
        require('./chargeBackService.js').getChargeBacksBySearchService.mockRejectedValue(error);

        await expect(controller.getChargeBacksBySearch(req, res)).rejects.toThrow(error);
      });
    });

    describe('getChargeBacks', () => {
      test('should fetch chargebacks successfully', async () => {
        const mockData = [{ id: 1, amount: 100 }];
        require('./chargeBackService.js').getChargeBacksService.mockResolvedValue(mockData);
        req.query = { page: 1, limit: 10 };

        await controller.getChargeBacks(req, res);

        expect(require('./chargeBackService.js').getChargeBacksService).toHaveBeenCalledWith(
          { company_id: 1 },
          'admin',
          1,
          10,
          99,
          undefined,
          'OPERATIONS'
        );
        expect(require('../../utils/responseHandlers.js').sendSuccess).toHaveBeenCalledWith(
          res,
          mockData,
          'ChargeBacks fetched successfully'
        );
      });

      test('should handle service errors', async () => {
        const error = new Error('Service error');
        require('./chargeBackService.js').getChargeBacksService.mockRejectedValue(error);

        await expect(controller.getChargeBacks(req, res)).rejects.toThrow(error);
      });
    });
  
    // ========================
    // blockChargebackUser
    // ========================
    describe('blockChargebackUser', () => {
      test('throws ValidationError if body invalid', async () => {
        VALIDATE_UPDATE_CHARGEBACK_SCHEMA.validate.mockReturnValue({
          error: {
            details: [{ message: '"user_id" is required' }]
          }
        });
  
        await expect(controller.blockChargebackUser(req, res))
          .rejects.toThrow(ValidationError);
      });
  
      // ... other tests remain unchanged
    });
  
    // ========================
    // updateChargeBack
    // ========================
    describe('updateChargeBack', () => {
      test('throws ValidationError if params invalid', async () => {
        VALIDATE_DELETE_CHARGEBACK.validate.mockReturnValue({
          error: {
            details: [{ message: '"id" must be a number' }]
          }
        });
  
        await expect(controller.updateChargeBack(req, res))
          .rejects.toThrow(ValidationError);
      });
  
      test('throws ValidationError if body invalid', async () => {
        VALIDATE_DELETE_CHARGEBACK.validate.mockReturnValue({ error: null });
        VALIDATE_UPDATE_CHARGEBACK_SCHEMA.validate.mockReturnValue({
          error: {
            details: [{ message: '"status" is required' }]
          }
        });
  
        await expect(controller.updateChargeBack(req, res))
          .rejects.toThrow(ValidationError);
      });
  
      // ... other tests remain unchanged
    });
  
    // ========================
    // deleteChargeBack
    // ========================
    describe('deleteChargeBack', () => {
      test('throws ValidationError if params invalid', async () => {
        VALIDATE_DELETE_CHARGEBACK.validate.mockReturnValue({
          error: {
            details: [{ message: '"id" must be a number' }]
          }
        });
  
        await expect(controller.deleteChargeBack(req, res))
          .rejects.toThrow(ValidationError);
      });
  
      // ... other tests remain unchanged
    });
  });
