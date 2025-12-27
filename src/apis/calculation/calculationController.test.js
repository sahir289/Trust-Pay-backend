import {
    getCalculationById,
    getCalculation,
    createCalculation,
    updateCalculation,
    deleteCalculation,
    calculateSuccessRatios,
    updateCalculations,
  } from './calculationController.js';
  import { sendSuccess } from '../../utils/responseHandlers.js';
  import {
    getCalculationService,
    createCalculationService,
    updateCalculationService,
    deleteCalculationService,
    calculateSuccessRatiosService,
    updateCalculationsService,
  } from './calculationService.js';
  import { transactionWrapper } from '../../utils/db.js';
  import {
    VALIDATE_CALCULATION_SCHEMA,
    VALIDATE_UPDATE_CALCULATION_STATUS,
    VALIDATE_UPDATE_CALCULATIONS_SCHEMA,
  } from '../../schemas/calculationSchema.js';
  import {  ValidationError } from '../../utils/appErrors.js';
  import { logger } from '../../utils/logger.js';
  
  jest.mock('../../utils/responseHandlers.js', () => ({
    sendSuccess: jest.fn(),
  }));
  
  jest.mock('./calculationService.js', () => ({
    getCalculationService: jest.fn(),
    createCalculationService: jest.fn(),
    updateCalculationService: jest.fn(),
    deleteCalculationService: jest.fn(),
    calculateSuccessRatiosService: jest.fn(),
    updateCalculationsService: jest.fn(),
  }));
  
  jest.mock('../../utils/db.js', () => ({
  createPool: jest.fn(),
  transactionWrapper: jest.fn((fn) => (...args) => fn(...args)),
  }));
  
  jest.mock('../../schemas/calculationSchema.js', () => ({
    VALIDATE_CALCULATION_SCHEMA: { validate: jest.fn() },
    VALIDATE_UPDATE_CALCULATION_STATUS: { validate: jest.fn() },
    VALIDATE_UPDATE_CALCULATIONS_SCHEMA: { validate: jest.fn() },
  }));
  
  jest.mock('../../utils/appErrors.js', () => ({
    BadRequestError: jest.fn((message) => ({ message })),
    ValidationError: jest.fn((message) => ({ message })),
  }));
  
  jest.mock('chalk', () => ({
    bgCyanBright: jest.fn(),
    yellow: jest.fn(),
    default: {
      bgCyanBright: jest.fn(),
      yellow: jest.fn(),
      underline: { red: jest.fn() },
    },
  }));

jest.mock('../../utils/logger.js', () => ({
    logger: { 
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn()
    },
  }));
  
  describe('Calculation Controller', () => {
    let req, res;
  
    beforeEach(() => {
      req = {
        user: { company_id: '1', user_id: '2', designation: 'ADMIN', role: 'ADMIN' },
        params: {},
        body: {},
        query: {},
      };
      res = {};
      jest.clearAllMocks();
      sendSuccess.mockImplementation((res, data, message) => ({ status: 200, data, message }));
    });
  
    describe('getCalculationById', () => {
      test('should fetch calculation by ID successfully', async () => {
        const mockData = [{ id: '1', value: 100 }];
        getCalculationService.mockResolvedValue(mockData);
        req.params = { user_id: '2' };
  
        const result = await getCalculationById(req, res);
  
        expect(getCalculationService).toHaveBeenCalledWith(
          { user_id: '2', company_id: '1' },
          'ADMIN'
        );
        expect(sendSuccess).toHaveBeenCalledWith(res, mockData, 'Get Calculation successfully');
        expect(result).toEqual({ status: 200, data: mockData, message: 'Get Calculation successfully' });
      });
  
      test('should throw BadRequestError if params are missing', async () => {
        req.params = null;
  
        await expect(getCalculationById(req, res)).rejects.toEqual({ message: 'User_id Required' });
        expect(getCalculationService).not.toHaveBeenCalled();
      });
    });
  
    describe('getCalculation', () => {
      test('should fetch calculations successfully with query parameters', async () => {
        const mockData = [{ id: '1', value: 100 }];
        getCalculationService.mockResolvedValue(mockData);
        req.query = { users: '3,4', startDate: '2025-01-01', endDate: '2025-12-31' };
  
        const result = await getCalculation(req, res);
  
        expect(getCalculationService).toHaveBeenCalledWith(
          {
            company_id: '1',
            user_id: '2',
            designation: 'ADMIN',
            users: '3,4',
            startDate: '2025-01-01',
            endDate: '2025-12-31',
          },
          'ADMIN'
        );
        expect(sendSuccess).toHaveBeenCalledWith(res, mockData, 'Get Calculations successfully');
        expect(result).toEqual({ status: 200, data: mockData, message: 'Get Calculations successfully' });
      });
  
      test('should handle service errors', async () => {
        const error = new Error('Service error');
        getCalculationService.mockRejectedValue(error);
  
        await expect(getCalculation(req, res)).rejects.toEqual(error);
        expect(sendSuccess).not.toHaveBeenCalled();
      });
    });
  
    describe('createCalculation', () => {
      test('should create calculation successfully', async () => {
        const payload = { value: 100 };
        VALIDATE_CALCULATION_SCHEMA.validate.mockReturnValue({ error: null });
        createCalculationService.mockResolvedValue({});
        req.body = payload;
  
        const result = await createCalculation(req, res);
  
        expect(VALIDATE_CALCULATION_SCHEMA.validate).toHaveBeenCalledWith(payload);
        expect(transactionWrapper).toHaveBeenCalled();
        expect(createCalculationService).toHaveBeenCalledWith(
          { ...payload, company_id: '1' },
          'ADMIN'
        );
        expect(sendSuccess).toHaveBeenCalledWith(res, {}, 'Create Calculation successfully');
        expect(result).toEqual({ status: 200, data: {}, message: 'Create Calculation successfully' });
      });
  
      test('should throw ValidationError for invalid payload', async () => {
        const payload = { value: 'invalid' };
        const validationError = { details: 'Invalid value' };
        VALIDATE_CALCULATION_SCHEMA.validate.mockReturnValue({ error: validationError });
        req.body = payload;
  
        await expect(createCalculation(req, res)).rejects.toEqual({ message: validationError });
        expect(ValidationError).toHaveBeenCalledWith(validationError);
        expect(createCalculationService).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
      });
  
      test('should throw ValidationError if payload is missing', async () => {
        req.body = null;
      
        await expect(createCalculation(req, res)).rejects.toMatchObject({
          message: expect.objectContaining({ details: expect.any(String) })
        });
        expect(logger.error).not.toHaveBeenCalled(); // Adjust based on actual logging
        expect(createCalculationService).not.toHaveBeenCalled();
      });
    });
  
    describe('updateCalculation', () => {
      test('should update calculation successfully', async () => {
        const payload = { status: 'completed' };
        const id = '1';
        VALIDATE_UPDATE_CALCULATION_STATUS.validate.mockReturnValue({ error: null });
        updateCalculationService.mockResolvedValue({});
        req.body = payload;
        req.params = { id };
  
        const result = await updateCalculation(req, res);
  
        expect(VALIDATE_UPDATE_CALCULATION_STATUS.validate).toHaveBeenCalledWith(payload);
        expect(transactionWrapper).toHaveBeenCalled();
        expect(updateCalculationService).toHaveBeenCalledWith(
          { company_id: '1', id: '1' },
          payload,
          'ADMIN'
        );
        expect(sendSuccess).toHaveBeenCalledWith(res, {}, 'Update Calculation successfully');
        expect(result).toEqual({ status: 200, data: {}, message: 'Update Calculation successfully' });
      });
  
      test('should throw ValidationError for invalid payload', async () => {
        const payload = { status: 'invalid' };
        const validationError = { details: 'Invalid status' };
        VALIDATE_UPDATE_CALCULATION_STATUS.validate.mockReturnValue({ error: validationError });
        req.body = payload;
        req.params = { id: '1' };
  
        await expect(updateCalculation(req, res)).rejects.toEqual({ message: validationError });
        expect(ValidationError).toHaveBeenCalledWith(validationError);
        expect(updateCalculationService).not.toHaveBeenCalled();
      });
  
      test('should throw BadRequestError if params are missing', async () => {
        req.params = null;
  
        await expect(updateCalculation(req, res)).rejects.toEqual({ message: 'id Required' });
        expect(updateCalculationService).not.toHaveBeenCalled();
      });
    });
  
    describe('deleteCalculation', () => {
      test('should delete calculation successfully', async () => {
        const id = '1';
        deleteCalculationService.mockResolvedValue({});
        req.params = { id };
  
        const result = await deleteCalculation(req, res);
  
        expect(transactionWrapper).toHaveBeenCalled();
        expect(deleteCalculationService).toHaveBeenCalledWith(
          { id: '1', company_id: '1' },
          'ADMIN'
        );
        expect(sendSuccess).toHaveBeenCalledWith(res, {}, 'Delete Calculation successfully');
        expect(result).toEqual({ status: 200, data: {}, message: 'Delete Calculation successfully' });
      });
  
      test('should throw BadRequestError if params are missing', async () => {
        req.params = null;
  
        await expect(deleteCalculation(req, res)).rejects.toEqual({ message: 'id Required' });
        expect(deleteCalculationService).not.toHaveBeenCalled();
      });
    });
  
    describe('calculateSuccessRatios', () => {
      test('should calculate success ratios successfully', async () => {
        const mockData = { ratio: 0.95 };
        calculateSuccessRatiosService.mockResolvedValue(mockData);
        req.body = { date: '2025-01-01', user_ids: ['1', '2'] };
  
        const result = await calculateSuccessRatios(req, res);
  
        expect(calculateSuccessRatiosService).toHaveBeenCalledWith('2025-01-01', ['1', '2']);
        expect(sendSuccess).toHaveBeenCalledWith(res, mockData, 'Success ratios fetched successfully');
        expect(result).toEqual({ status: 200, data: mockData, message: 'Success ratios fetched successfully' });
      });
  
      test('should throw BadRequestError if user_ids is missing or invalid', async () => {
        req.body = { date: '2025-01-01', user_ids: [] };
  
        await expect(calculateSuccessRatios(req, res)).rejects.toEqual({
          message: 'user_ids array is required',
        });
        expect(logger.error).toHaveBeenCalledWith('Error fetching success ratio data:', expect.any(Object));
        expect(calculateSuccessRatiosService).not.toHaveBeenCalled();
      });
  
      test('should handle service errors', async () => {
        const error = new Error('Service error');
        calculateSuccessRatiosService.mockRejectedValue(error);
        req.body = { date: '2025-01-01', user_ids: ['1', '2'] };
  
        await expect(calculateSuccessRatios(req, res)).rejects.toEqual(error);
        expect(logger.error).toHaveBeenCalledWith('Error fetching success ratio data:', error);
        expect(sendSuccess).not.toHaveBeenCalled();
      });
    });

    describe('updateCalculations', () => {
      test('should update calculations successfully', async () => {
        const req = {
          user: { company_id: 'comp1' },
          body: { user_id: 'user1', date: '2025-01-01', startDate: '2025-01-01', endDate: '2025-01-01' },
        };
        const res = {};
        const mockData = { updated: true };
        VALIDATE_UPDATE_CALCULATIONS_SCHEMA.validate.mockReturnValue({ error: null });
        updateCalculationsService.mockResolvedValue(mockData);

        await updateCalculations(req, res);

        expect(VALIDATE_UPDATE_CALCULATIONS_SCHEMA.validate).toHaveBeenCalledWith(req.body);
        expect(updateCalculationsService).toHaveBeenCalledWith({
          date: '2025-01-01',
          user_id: 'user1',
          startDate: '2025-01-01',
          endDate: '2025-01-01',
          company_id: 'comp1',
        });
        expect(sendSuccess).toHaveBeenCalledWith(res, mockData, 'Calculations updated successfully');
      });

      test('should use current date if no date provided', async () => {
        const req = {
          user: { company_id: 'comp1' },
          body: { user_id: 'user1' },
        };
        const res = {};
        const mockData = { updated: true };
        VALIDATE_UPDATE_CALCULATIONS_SCHEMA.validate.mockReturnValue({ error: null });
        updateCalculationsService.mockResolvedValue(mockData);

        await updateCalculations(req, res);

        const expectedDate = new Date().toISOString().split('T')[0];
        expect(updateCalculationsService).toHaveBeenCalledWith({
          date: expectedDate,
          user_id: 'user1',
          startDate: undefined,
          endDate: undefined,
          company_id: 'comp1',
        });
      });

      test('should throw ValidationError on invalid body', async () => {
        const req = {
          user: { company_id: 'comp1' },
          body: { invalid: true },
        };
        const res = {};
        VALIDATE_UPDATE_CALCULATIONS_SCHEMA.validate.mockReturnValue({ error: 'validation error' });

        await expect(updateCalculations(req, res)).rejects.toEqual({ message: 'validation error' });
      });

      test('should throw BadRequestError if user_id is not string', async () => {
        const req = {
          user: { company_id: 'comp1' },
          body: { user_id: 123 },
        };
        const res = {};
        VALIDATE_UPDATE_CALCULATIONS_SCHEMA.validate.mockReturnValue({ error: null });

        await expect(updateCalculations(req, res)).rejects.toEqual({ message: 'user_id string is required' });
      });

      test('should handle service errors', async () => {
        const req = {
          user: { company_id: 'comp1' },
          body: { user_id: 'user1' },
        };
        const res = {};
        const error = new Error('Service error');
        VALIDATE_UPDATE_CALCULATIONS_SCHEMA.validate.mockReturnValue({ error: null });
        updateCalculationsService.mockRejectedValue(error);

        await expect(updateCalculations(req, res)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error updating calculations:', error);
      });
    });
  });