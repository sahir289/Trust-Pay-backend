import {
  getDesignationService,
  createDesignationService,
  updateDesignationService,
  deleteDesignationService,
} from './designationServices.js';
import {
  getDesignationDao,
  createDesignationDao,
  updateDesignationDao,
  deleteDesignationDao,
} from './designationDao.js';
import { logger } from '../../utils/logger.js';


jest.mock('./designationDao.js');
jest.mock('../../utils/logger.js', () => {
  const mockLogger = {
    error: jest.fn(() => {}),
    info: jest.fn(() => {}),
    warn: jest.fn(() => {}),
  };
  return { logger: mockLogger };
});

describe('Designation Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Logger Mock', () => {
    it('should have logger defined with error method', () => {
      expect(logger).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(typeof logger.error).toBe('function');
    });
  });

  describe('getDesignationService', () => {
    it('should return designations for valid user and pagination', async () => {
      const mockUser = { company_id: '1' };
      const mockPage = '1';
      const mockLimit = '10';
      const mockResult = [{ id: 1, name: 'Admin' }];
      getDesignationDao.mockResolvedValue(mockResult);

      const result = await getDesignationService(mockUser, mockPage, mockLimit);

      expect(getDesignationDao).toHaveBeenCalledWith(mockUser, mockPage, mockLimit);
      expect(result).toEqual(mockResult);
    });

    it('should handle empty pagination parameters', async () => {
      const mockUser = { company_id: '1' };
      const mockResult = [{ id: 1, name: 'Admin' }];
      getDesignationDao.mockResolvedValue(mockResult);

      const result = await getDesignationService(mockUser);

      expect(getDesignationDao).toHaveBeenCalledWith(mockUser, undefined, undefined);
      expect(result).toEqual(mockResult);
    });

    it('should throw and log error when DAO fails', async () => {
      const mockUser = { company_id: '1' };
      const mockError = new Error('Database error');
      getDesignationDao.mockRejectedValue(mockError);

      await expect(getDesignationService(mockUser)).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith('error getting while Designation', mockError);
    });
  });

  describe('createDesignationService', () => {
    it('should create designation with connection object', async () => {
      const mockConn = { query: jest.fn() };
      const mockPayload = { name: 'Admin' };
      const mockResult = { id: 1, name: 'Admin' };
      createDesignationDao.mockResolvedValue(mockResult);

      const result = await createDesignationService(mockConn, mockPayload);

      expect(createDesignationDao).toHaveBeenCalledWith(mockConn, mockPayload);
      expect(result).toEqual(mockResult);
    });

    it('should create designation without connection object', async () => {
      const mockPayload = { name: 'Admin' };
      const mockResult = { id: 1, name: 'Admin' };
      createDesignationDao.mockResolvedValue(mockResult);

      const result = await createDesignationService(null, mockPayload);

      expect(createDesignationDao).toHaveBeenCalledWith(null, mockPayload);
      expect(result).toEqual(mockResult);
    });

    it('should throw and log error when DAO fails', async () => {
      const mockPayload = { name: 'Admin' };
      const mockError = new Error('Creation failed');
      createDesignationDao.mockRejectedValue(mockError);

      await expect(createDesignationService(null, mockPayload)).rejects.toThrow('Creation failed');
      expect(logger.error).toHaveBeenCalledWith('error getting while Designation', mockError);
    });

    it('should handle invalid payload', async () => {
      const mockPayload = {};
      const mockError = new Error('Invalid payload');
      createDesignationDao.mockRejectedValue(mockError);

      await expect(createDesignationService(null, mockPayload)).rejects.toThrow('Invalid payload');
      expect(logger.error).toHaveBeenCalledWith('error getting while Designation', mockError);
    });
  });

  describe('updateDesignationService', () => {
    it('should update designation successfully', async () => {
      const mockId = { id: '1' };
      const mockPayload = { name: 'Updated Admin' };
      const mockResult = { id: '1', name: 'Updated Admin' };
      updateDesignationDao.mockResolvedValue(mockResult);

      const result = await updateDesignationService(mockId, mockPayload);

      expect(updateDesignationDao).toHaveBeenCalledWith(mockId, mockPayload);
      expect(result).toEqual(mockResult);
    });

    it('should throw and log error when DAO fails', async () => {
      const mockId = { id: '1' };
      const mockPayload = { name: 'Updated Admin' };
      const mockError = new Error('Update failed');
      updateDesignationDao.mockRejectedValue(mockError);

      await expect(updateDesignationService(mockId, mockPayload)).rejects.toThrow('Update failed');
      expect(logger.error).toHaveBeenCalledWith('error getting while Designation', mockError);
    });

    it('should handle invalid ID', async () => {
      const mockId = {};
      const mockPayload = { name: 'Updated Admin' };
      const mockError = new Error('Invalid ID');
      updateDesignationDao.mockRejectedValue(mockError);

      await expect(updateDesignationService(mockId, mockPayload)).rejects.toThrow('Invalid ID');
      expect(logger.error).toHaveBeenCalledWith('error getting while Designation', mockError);
    });
  });

  describe('deleteDesignationService', () => {
    it('should soft delete designation successfully', async () => {
      const mockId = { id: '1' };
      const mockResult = { id: '1', is_obsolete: true };
      deleteDesignationDao.mockResolvedValue(mockResult);

      const result = await deleteDesignationService(mockId);

      expect(deleteDesignationDao).toHaveBeenCalledWith(mockId, { is_obsolete: true });
      expect(result).toEqual(mockResult);
    });

    it('should throw and log error when DAO fails', async () => {
      const mockId = { id: '1' };
      const mockError = new Error('Delete failed');
      deleteDesignationDao.mockRejectedValue(mockError);

      await expect(deleteDesignationService(mockId)).rejects.toThrow('Delete failed');
      expect(logger.error).toHaveBeenCalledWith('error getting while Designation', mockError);
    });

    it('should handle invalid ID', async () => {
      const mockId = {};
      const mockError = new Error('Invalid ID');
      deleteDesignationDao.mockRejectedValue(mockError);

      await expect(deleteDesignationService(mockId)).rejects.toThrow('Invalid ID');
      expect(logger.error).toHaveBeenCalledWith('error getting while Designation', mockError);
    });
  });
});