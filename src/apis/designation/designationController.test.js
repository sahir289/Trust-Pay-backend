import {
  getDesignation,
  getDesignationById,
  createDesignation,
  updateDesignation,
  deleteDesignation,
} from './designationController.js';
import {
  getDesignationService,
  createDesignationService,
  updateDesignationService,
  deleteDesignationService,
} from './designationServices.js';
import {
  CREATE_DESIGNATION_SCHEMA,
  UPDATE_DESIGNATION_SCHEMA,
  VALIDATE_DESIGNATION_BY_ID,
} from '../../schemas/designationSchema.js';
import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
import { transactionWrapper } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';

// Mock custom error classes
class MockBadRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BadRequestError';
    this.status = 400;
  }
}

class MockValidationError extends Error {
  constructor(details) {
    super(details);
    this.name = 'ValidationError';
    this.status = 400;
  }
}

// Mock dependencies
jest.mock('./designationServices.js');
jest.mock('../../schemas/designationSchema.js');
jest.mock('../../utils/appErrors.js', () => ({
  BadRequestError: jest.fn().mockImplementation((message) => new MockBadRequestError(message)),
  ValidationError: jest.fn().mockImplementation((error) => {
    const message = error.details ? error.details[0].message : 'Validation error';
    return new MockValidationError(message);
  }),
}));
jest.mock('../../utils/db.js');
jest.mock('../../utils/logger.js', () => {
  const mockLogger = {
    error: jest.fn(() => {}),
    info: jest.fn(() => {}),
    warn: jest.fn(() => {}),
  };
  return { logger: mockLogger };
});
jest.mock('../../utils/responseHandlers.js');

describe('Designation Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      query: {},
      params: {},
      body: {},
      user: { company_id: '1' },
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    sendSuccess.mockImplementation((res, data, message) => {
      res.status(200).json({ success: true, data, message });
      return res;
    });
    BadRequestError.mockClear();
    ValidationError.mockClear();
  });

  describe('Logger Mock', () => {
    it('should have logger defined with error method', () => {
      expect(logger).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(typeof logger.error).toBe('function');
    });
  });

  describe('getDesignation', () => {
    it('should return designations successfully with valid query', async () => {
      const mockData = [{ id: 1, name: 'Admin' }];
      mockReq.query = { page: '1', limit: '10' };
      getDesignationService.mockResolvedValue(mockData);

      await getDesignation(mockReq, mockRes);

      expect(getDesignationService).toHaveBeenCalledWith(
        { page: '1', limit: '10' },
        '1',
        '10'
      );
      expect(sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockData,
        'get  Designations successfully'
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockData,
        message: 'get  Designations successfully',
      });
    });

    it('should handle service errors', async () => {
      const mockError = new Error('Service error');
      mockError.name = 'Error';
      mockError.status = 500;
      mockReq.query = { page: '1', limit: '10' };
      getDesignationService.mockRejectedValue(mockError);

      await expect(getDesignation(mockReq, mockRes)).rejects.toThrow('Service error');

      expect(getDesignationService).toHaveBeenCalledWith(
        { page: '1', limit: '10' },
        '1',
        '10'
      );
      expect(logger.error).not.toHaveBeenCalled(); // No logger since controller doesn't catch
    });

    it('should handle empty query parameters', async () => {
      const mockData = [{ id: 1, name: 'Admin' }];
      getDesignationService.mockResolvedValue(mockData);

      await getDesignation(mockReq, mockRes);

      expect(getDesignationService).toHaveBeenCalledWith(
        {},
        undefined,
        undefined
      );
      expect(sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockData,
        'get  Designations successfully'
      );
    });
  });

  describe('getDesignationById', () => {
    it('should return designation by ID successfully', async () => {
      const mockData = { id: '1', name: 'Admin' };
      mockReq.params = { id: '1' };
      VALIDATE_DESIGNATION_BY_ID.validate.mockReturnValue({ error: null });
      getDesignationService.mockResolvedValue(mockData);

      await getDesignationById(mockReq, mockRes);

      expect(VALIDATE_DESIGNATION_BY_ID.validate).toHaveBeenCalledWith({ id: '1' });
      expect(getDesignationService).toHaveBeenCalledWith({ id: '1', company_id: '1' });
      expect(sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockData,
        'get  Designation successfully'
      );
    });

    it('should throw ValidationError for invalid ID', async () => {
      const mockValidationError = { details: [{ message: 'Invalid ID' }] };
      mockReq.params = { id: 'invalid' };
      VALIDATE_DESIGNATION_BY_ID.validate.mockReturnValue({ error: mockValidationError });

      await expect(getDesignationById(mockReq, mockRes)).rejects.toThrow('Invalid ID');

      expect(VALIDATE_DESIGNATION_BY_ID.validate).toHaveBeenCalledWith({ id: 'invalid' });
      expect(ValidationError).toHaveBeenCalledWith({"details": [{"message": "Invalid ID"}]});
    });

    it('should handle service errors', async () => {
      const mockError = new Error('Service error');
      mockError.name = 'Error';
      mockError.status = 500;
      mockReq.params = { id: '1' };
      VALIDATE_DESIGNATION_BY_ID.validate.mockReturnValue({ error: null });
      getDesignationService.mockRejectedValue(mockError);

      await expect(getDesignationById(mockReq, mockRes)).rejects.toThrow('Service error');

      expect(VALIDATE_DESIGNATION_BY_ID.validate).toHaveBeenCalledWith({ id: '1' });
      expect(getDesignationService).toHaveBeenCalledWith({ id: '1', company_id: '1' });
      expect(logger.error).not.toHaveBeenCalled(); // No logger since controller doesn't catch
    });
  });

  describe('createDesignation', () => {
    it('should create designation successfully', async () => {
      const mockPayload = { name: 'Admin' };
      mockReq.body = mockPayload;
      CREATE_DESIGNATION_SCHEMA.validate.mockReturnValue({ error: null });
      const mockResult = { id: '1', name: 'Admin' };
      const mockTransactionWrapper = jest.fn().mockResolvedValue(mockResult);
      transactionWrapper.mockReturnValue(mockTransactionWrapper);

      await createDesignation(mockReq, mockRes);

      expect(CREATE_DESIGNATION_SCHEMA.validate).toHaveBeenCalledWith(mockPayload);
      expect(transactionWrapper).toHaveBeenCalledWith(createDesignationService);
      expect(mockTransactionWrapper).toHaveBeenCalledWith(mockPayload);
      expect(sendSuccess).toHaveBeenCalledWith(
        mockRes,
        {},
        'Create Designations successfully'
      );
    });

    it('should throw ValidationError for invalid payload', async () => {
      const mockValidationError = { details: [{ message: 'Invalid payload' }] };
      mockReq.body = { name: '' };
      CREATE_DESIGNATION_SCHEMA.validate.mockReturnValue({ error: mockValidationError });

      await expect(createDesignation(mockReq, mockRes)).rejects.toThrow('Invalid payload');

      expect(CREATE_DESIGNATION_SCHEMA.validate).toHaveBeenCalledWith({ name: '' });
      expect(ValidationError).toHaveBeenCalledWith({"details": [{"message": "Invalid payload"}]});
    });

    it('should handle service errors within transaction', async () => {
      const mockError = new Error('Service error');
      mockError.name = 'Error';
      mockError.status = 500;
      mockReq.body = { name: 'Admin' };
      CREATE_DESIGNATION_SCHEMA.validate.mockReturnValue({ error: null });
      const mockTransactionWrapper = jest.fn().mockRejectedValue(mockError);
      transactionWrapper.mockReturnValue(mockTransactionWrapper);

      await expect(createDesignation(mockReq, mockRes)).rejects.toThrow('Service error');

      expect(CREATE_DESIGNATION_SCHEMA.validate).toHaveBeenCalledWith({ name: 'Admin' });
      expect(transactionWrapper).toHaveBeenCalledWith(createDesignationService);
      expect(mockTransactionWrapper).toHaveBeenCalledWith({ name: 'Admin' });
      expect(logger.error).not.toHaveBeenCalled(); // No logger since controller doesn't catch
    });
  });

  describe('updateDesignation', () => {
    it('should update designation successfully', async () => {
      const mockPayload = { name: 'Updated Admin' };
      mockReq.params = { id: '1' };
      mockReq.body = mockPayload;
      VALIDATE_DESIGNATION_BY_ID.validate.mockReturnValue({ error: null });
      UPDATE_DESIGNATION_SCHEMA.validate.mockReturnValue({ error: null });
      const mockResult = { id: '1', name: 'Updated Admin' };
      updateDesignationService.mockResolvedValue(mockResult);

      await updateDesignation(mockReq, mockRes);

      expect(VALIDATE_DESIGNATION_BY_ID.validate).toHaveBeenCalledWith({ id: '1' });
      expect(UPDATE_DESIGNATION_SCHEMA.validate).toHaveBeenCalledWith(mockPayload);
      expect(updateDesignationService).toHaveBeenCalledWith({ id: '1' }, mockPayload);
      expect(sendSuccess).toHaveBeenCalledWith(
        mockRes,
        {},
        'update Designations successfully'
      );
    });

    it('should throw ValidationError for invalid ID', async () => {
      const mockValidationError = { details: [{ message: 'Invalid ID' }] };
      mockReq.params = { id: 'invalid' };
      VALIDATE_DESIGNATION_BY_ID.validate.mockReturnValue({ error: mockValidationError });

      await expect(updateDesignation(mockReq, mockRes)).rejects.toThrow('Invalid ID');

      expect(VALIDATE_DESIGNATION_BY_ID.validate).toHaveBeenCalledWith({ id: 'invalid' });
      expect(ValidationError).toHaveBeenCalledWith({"details": [{"message": "Invalid ID"}]});
    });

    it('should throw ValidationError for invalid payload', async () => {
      const mockValidationError = { details: [{ message: 'Invalid payload' }] };
      mockReq.params = { id: '1' };
      mockReq.body = { name: '' };
      VALIDATE_DESIGNATION_BY_ID.validate.mockReturnValue({ error: null });
      UPDATE_DESIGNATION_SCHEMA.validate.mockReturnValue({ error: mockValidationError });

      await expect(updateDesignation(mockReq, mockRes)).rejects.toThrow('Invalid payload');

      expect(VALIDATE_DESIGNATION_BY_ID.validate).toHaveBeenCalledWith({ id: '1' });
      expect(UPDATE_DESIGNATION_SCHEMA.validate).toHaveBeenCalledWith({ id: "1", });
      expect(ValidationError).toHaveBeenCalledWith({"details": [{"message": "Invalid payload"}]});
    });

    it('should handle service errors', async () => {
      const mockError = new Error('Service error');
      mockError.name = 'Error';
      mockError.status = 500;
      mockReq.params = { id: '1' };
      mockReq.body = { name: 'Updated Admin' };
      VALIDATE_DESIGNATION_BY_ID.validate.mockReturnValue({ error: null });
      UPDATE_DESIGNATION_SCHEMA.validate.mockReturnValue({ error: null });
      updateDesignationService.mockRejectedValue(mockError);

      await expect(updateDesignation(mockReq, mockRes)).rejects.toThrow('Service error');

      expect(VALIDATE_DESIGNATION_BY_ID.validate).toHaveBeenCalledWith({ id: '1' });
      expect(UPDATE_DESIGNATION_SCHEMA.validate).toHaveBeenCalledWith({ name: 'Updated Admin' });
      expect(updateDesignationService).toHaveBeenCalledWith({ id: '1' }, { name: 'Updated Admin' });
      expect(logger.error).not.toHaveBeenCalled(); // No logger since controller doesn't catch
    });
  });

  describe('deleteDesignation', () => {
    it('should delete designation successfully', async () => {
      mockReq.params = { id: '1' };
      VALIDATE_DESIGNATION_BY_ID.validate.mockReturnValue({ error: null });
      const mockResult = { id: '1', is_obsolete: true };
      deleteDesignationService.mockResolvedValue(mockResult);

      await deleteDesignation(mockReq, mockRes);

      expect(VALIDATE_DESIGNATION_BY_ID.validate).toHaveBeenCalledWith({ id: '1' });
      expect(deleteDesignationService).toHaveBeenCalledWith({ id: '1' });
      expect(sendSuccess).toHaveBeenCalledWith(
        mockRes,
        {},
        'delete Designations successfully'
      );
    });

    it('should throw ValidationError for invalid ID', async () => {
      const mockValidationError = { details: [{ message: 'Invalid ID' }] };
      mockReq.params = { id: 'invalid' };
      VALIDATE_DESIGNATION_BY_ID.validate.mockReturnValue({ error: mockValidationError });

      await expect(deleteDesignation(mockReq, mockRes)).rejects.toThrow('Invalid ID');

      expect(VALIDATE_DESIGNATION_BY_ID.validate).toHaveBeenCalledWith({ id: 'invalid' });
      expect(ValidationError).toHaveBeenCalledWith({"details": [{"message": "Invalid ID"}]});
    });

    it('should throw BadRequestError for missing ID', async () => {
      mockReq.params = {};
      VALIDATE_DESIGNATION_BY_ID.validate.mockReturnValue({ error: null });

      await expect(deleteDesignation(mockReq, mockRes)).rejects.toThrow('payload is required');

      expect(VALIDATE_DESIGNATION_BY_ID.validate).toHaveBeenCalledWith({});
      expect(BadRequestError).toHaveBeenCalledWith('payload is required');
      expect(logger.error).toHaveBeenCalledWith('payload is required');
    });

    it('should handle service errors', async () => {
      const mockError = new Error('Service error');
      mockError.name = 'Error';
      mockError.status = 500;
      mockReq.params = { id: '1' };
      VALIDATE_DESIGNATION_BY_ID.validate.mockReturnValue({ error: null });
      deleteDesignationService.mockRejectedValue(mockError);

      await expect(deleteDesignation(mockReq, mockRes)).rejects.toThrow('Service error');

      expect(VALIDATE_DESIGNATION_BY_ID.validate).toHaveBeenCalledWith({ id: '1' });
      expect(deleteDesignationService).toHaveBeenCalledWith({ id: '1' });
      expect(logger.error).not.toHaveBeenCalled(); // No logger since controller doesn't catch
    });
  });
});