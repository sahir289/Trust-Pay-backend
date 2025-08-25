import {
  getDesignationDao,
  createDesignationDao,
  updateDesignationDao,
  deleteDesignationDao,
} from './designationDao.js';
import { tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';


jest.mock('../../constants/index.js', () => ({
  tableName: {
    DESIGNATION: 'designation',
  },
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

describe('Designation DAO', () => {
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

  describe('getDesignationDao', () => {
    it('should return designations for valid filters', async () => {
      const mockFilters = { name: 'Admin' };
      const mockQuery = 'SELECT * FROM "designation" WHERE 1=1 AND "name" = $1';
      const mockParams = ['Admin'];
      const mockResult = { rows: [{ id: 1, name: 'Admin' }] };
      buildSelectQuery.mockReturnValue([mockQuery, mockParams]);
      executeQuery.mockResolvedValue(mockResult);

      const result = await getDesignationDao(mockFilters);

      expect(buildSelectQuery).toHaveBeenCalledWith(
        'SELECT * FROM "designation" WHERE 1=1',
        mockFilters
      );
      expect(executeQuery).toHaveBeenCalledWith(mockQuery, mockParams);
      expect(result).toEqual(mockResult.rows);
    });

    it('should handle empty filters', async () => {
      const mockQuery = 'SELECT * FROM "designation" WHERE 1=1';
      const mockParams = [];
      const mockResult = { rows: [] };
      buildSelectQuery.mockReturnValue([mockQuery, mockParams]);
      executeQuery.mockResolvedValue(mockResult);

      const result = await getDesignationDao({});

      expect(buildSelectQuery).toHaveBeenCalledWith(
        'SELECT * FROM "designation" WHERE 1=1',
        {}
      );
      expect(executeQuery).toHaveBeenCalledWith(mockQuery, mockParams);
      expect(result).toEqual(mockResult.rows);
    });

    it('should throw and log error when query fails', async () => {
      const mockFilters = { name: 'Admin' };
      const mockError = new Error('Database error');
      buildSelectQuery.mockReturnValue(['SELECT * FROM "designation" WHERE 1=1 AND "name" = $1', ['Admin']]);
      executeQuery.mockRejectedValue(mockError);

      await expect(getDesignationDao(mockFilters)).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith('Error in getDesignationDao:', mockError);
    });
  });

  describe('createDesignationDao', () => {
    it('should create designation with connection object', async () => {
      const mockConn = { query: jest.fn() };
      const mockPayload = { name: 'Admin' };
      const mockQuery = 'INSERT INTO "designation" ("name") VALUES ($1) RETURNING *';
      const mockParams = ['Admin'];
      const mockResult = { rows: [{ id: 1, name: 'Admin' }] };
      buildInsertQuery.mockReturnValue([mockQuery, mockParams]);
      mockConn.query.mockResolvedValue(mockResult);

      const result = await createDesignationDao(mockConn, mockPayload);

      expect(buildInsertQuery).toHaveBeenCalledWith(tableName.DESIGNATION, mockPayload);
      expect(mockConn.query).toHaveBeenCalledWith(mockQuery, mockParams);
      expect(executeQuery).not.toHaveBeenCalled();
      expect(result).toEqual(mockResult.rows[0]);
    });

    it('should create designation without connection object', async () => {
      const mockPayload = { name: 'Admin' };
      const mockQuery = 'INSERT INTO "designation" ("name") VALUES ($1) RETURNING *';
      const mockParams = ['Admin'];
      const mockResult = { rows: [{ id: 1, name: 'Admin' }] };
      buildInsertQuery.mockReturnValue([mockQuery, mockParams]);
      executeQuery.mockResolvedValue(mockResult);

      const result = await createDesignationDao(null, mockPayload);

      expect(buildInsertQuery).toHaveBeenCalledWith(tableName.DESIGNATION, mockPayload);
      expect(executeQuery).toHaveBeenCalledWith(mockQuery, mockParams);
      expect(result).toEqual(mockResult.rows[0]);
    });

    it('should throw and log error when creation fails', async () => {
      const mockPayload = { name: 'Admin' };
      const mockError = new Error('Insert failed');
      buildInsertQuery.mockReturnValue(['INSERT INTO "designation" ("name") VALUES ($1) RETURNING *', ['Admin']]);
      executeQuery.mockRejectedValue(mockError);

      await expect(createDesignationDao(null, mockPayload)).rejects.toThrow('Insert failed');
      expect(logger.error).toHaveBeenCalledWith('Error in createDesignationDao:', mockError);
    });

    it('should throw error for invalid payload', async () => {
      const mockPayload = {};
      const mockError = new Error('Invalid payload');
      buildInsertQuery.mockReturnValue(['INSERT INTO "designation" () VALUES () RETURNING *', []]);
      executeQuery.mockRejectedValue(mockError);

      await expect(createDesignationDao(null, mockPayload)).rejects.toThrow('Invalid payload');
      expect(logger.error).toHaveBeenCalledWith('Error in createDesignationDao:', mockError);
    });
  });

  describe('updateDesignationDao', () => {
    it('should update designation successfully', async () => {
      const mockId = { id: '1' };
      const mockData = { name: 'Updated Admin' };
      const mockQuery = 'UPDATE "designation" SET "name" = $1 WHERE "id" = $2 RETURNING *';
      const mockParams = ['Updated Admin', '1'];
      const mockResult = { rows: [{ id: '1', name: 'Updated Admin' }] };
      buildUpdateQuery.mockReturnValue([mockQuery, mockParams]);
      executeQuery.mockResolvedValue(mockResult);

      const result = await updateDesignationDao(mockId, mockData);

      expect(buildUpdateQuery).toHaveBeenCalledWith(tableName.DESIGNATION, mockData, mockId);
      expect(executeQuery).toHaveBeenCalledWith(mockQuery, mockParams);
      expect(result).toEqual(mockResult.rows[0]);
    });

    it('should throw and log error when update fails', async () => {
      const mockId = { id: '1' };
      const mockData = { name: 'Updated Admin' };
      const mockError = new Error('Update failed');
      buildUpdateQuery.mockReturnValue(['UPDATE "designation" SET "name" = $1 WHERE "id" = $2 RETURNING *', ['Updated Admin', '1']]);
      executeQuery.mockRejectedValue(mockError);

      await expect(updateDesignationDao(mockId, mockData)).rejects.toThrow('Update failed');
      expect(logger.error).toHaveBeenCalledWith('Error in updateDesignationDao:', mockError);
    });

    it('should throw error for invalid ID', async () => {
      const mockId = {};
      const mockData = { name: 'Updated Admin' };
      const mockError = new Error('Invalid ID');
      buildUpdateQuery.mockReturnValue(['UPDATE "designation" SET "name" = $1 WHERE 1=1 RETURNING *', ['Updated Admin']]);
      executeQuery.mockRejectedValue(mockError);

      await expect(updateDesignationDao(mockId, mockData)).rejects.toThrow('Invalid ID');
      expect(logger.error).toHaveBeenCalledWith('Error in updateDesignationDao:', mockError);
    });
  });

  describe('deleteDesignationDao', () => {
    it('should soft delete designation successfully', async () => {
      const mockId = { id: '1' };
      const mockData = { is_obsolete: true };
      const mockQuery = 'UPDATE "designation" SET "is_obsolete" = $1 WHERE "id" = $2 RETURNING *';
      const mockParams = [true, '1'];
      const mockResult = { rows: [{ id: '1', is_obsolete: true }] };
      buildUpdateQuery.mockReturnValue([mockQuery, mockParams]);
      executeQuery.mockResolvedValue(mockResult);

      const result = await deleteDesignationDao(mockId, mockData);

      expect(buildUpdateQuery).toHaveBeenCalledWith(tableName.DESIGNATION, mockData, mockId);
      expect(executeQuery).toHaveBeenCalledWith(mockQuery, mockParams);
      expect(result).toEqual(mockResult.rows[0]);
    });

    it('should throw and log error when delete fails', async () => {
      const mockId = { id: '1' };
      const mockData = { is_obsolete: true };
      const mockError = new Error('Delete failed');
      buildUpdateQuery.mockReturnValue(['UPDATE "designation" SET "is_obsolete" = $1 WHERE "id" = $2 RETURNING *', [true, '1']]);
      executeQuery.mockRejectedValue(mockError);

      await expect(deleteDesignationDao(mockId, mockData)).rejects.toThrow('Delete failed');
      expect(logger.error).toHaveBeenCalledWith('Error in deleteDesignationDao:', mockError);
    });

    it('should throw error for invalid ID', async () => {
      const mockId = {};
      const mockData = { is_obsolete: true };
      const mockError = new Error('Invalid ID');
      buildUpdateQuery.mockReturnValue(['UPDATE "designation" SET "is_obsolete" = $1 WHERE 1=1 RETURNING *', [true]]);
      executeQuery.mockRejectedValue(mockError);

      await expect(deleteDesignationDao(mockId, mockData)).rejects.toThrow('Invalid ID');
      expect(logger.error).toHaveBeenCalledWith('Error in deleteDesignationDao:', mockError);
    });
  });
});