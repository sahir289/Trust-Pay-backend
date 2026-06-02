import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';

// Mock modules before importing them
jest.unstable_mockModule('../../src/constants/index.js', () => ({
  tableName: {
    USER_HIERARCHY: 'UserHierarchy',
    MERCHANT: 'merchants',
  },
}));

jest.unstable_mockModule('../../src/utils/db.js', () => ({
  buildInsertQuery: jest.fn(),
  buildSelectQuery: jest.fn(),
  buildUpdateQuery: jest.fn(),
  executeQuery: jest.fn(),
}));

jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.unstable_mockModule('../../src/utils/searchBuilder.js', () => ({
  buildSearchFilterObj: jest.fn(),
}));

// -------------------- IMPORTS ----------------------
let userHierarchyDao, db, logger, searchBuilder;

beforeAll(async () => {
  db = await import('../../src/utils/db.js');
  logger = await import('../../src/utils/logger.js');
  searchBuilder = await import('../../src/utils/searchBuilder.js');
  userHierarchyDao = await import('../../src/apis/userHierarchy/userHierarchyDao.js');
});

beforeEach(() => {
  jest.clearAllMocks();
  db.buildInsertQuery = jest.fn();
  db.buildSelectQuery = jest.fn();
  db.buildUpdateQuery = jest.fn();
  db.executeQuery = jest.fn();
  logger.logger.error = jest.fn();
  logger.logger.info = jest.fn();
  searchBuilder.buildSearchFilterObj = jest.fn();
});

describe('userHierarchyDao', () => {
  describe('createUserHierarchyDao', () => {
    it('should create user hierarchy successfully', async () => {
      const mockData = { user_id: 1, config: { parent: 2 } };
      const mockResult = { id: 1, user_id: 1, config: { parent: 2 } };
      
      db.buildInsertQuery.mockReturnValue(['INSERT INTO...', [mockData]]);
      db.executeQuery.mockResolvedValue({ rows: [mockResult], rowCount: 1 });
      
      const result = await userHierarchyDao.createUserHierarchyDao(mockData);
      
      expect(db.buildInsertQuery).toHaveBeenCalledWith('UserHierarchy', mockData);
      expect(db.executeQuery).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should handle errors during creation', async () => {
      const mockData = { user_id: 1 };
      const error = new Error('Insert failed');
      
      db.buildInsertQuery.mockReturnValue(['INSERT INTO...', [mockData]]);
      db.executeQuery.mockRejectedValue(error);
      
      await expect(userHierarchyDao.createUserHierarchyDao(mockData)).rejects.toThrow(
        'Insert failed',
      );
      expect(logger.logger.error).toHaveBeenCalled();
    });

    it('should support transaction with connection', async () => {
      const mockData = { user_id: 1 };
      const mockConn = {};
      const mockResult = { id: 1, user_id: 1 };
      
      db.buildInsertQuery.mockReturnValue(['INSERT INTO...', [mockData]]);
      db.executeQuery.mockResolvedValue({ rows: [mockResult] });
      
      const result = await userHierarchyDao.createUserHierarchyDao(mockData, mockConn);
      
      expect(db.executeQuery).toHaveBeenCalledWith('INSERT INTO...', [mockData], mockConn);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getUserHierarchysDashBoardReportDao', () => {
    it('should fetch dashboard report data successfully', async () => {
      const mockFilters = { company_id: 1 };
      const mockResult = [{ id: 1, config: {} }];
      
      db.buildSelectQuery.mockReturnValue(['SELECT config FROM...', []]);
      db.executeQuery.mockResolvedValue({ rows: mockResult });
      
      const result = await userHierarchyDao.getUserHierarchysDashBoardReportDao(mockFilters);
      
      expect(db.buildSelectQuery).toHaveBeenCalled();
      expect(db.executeQuery).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should return empty array when no data found', async () => {
      const mockFilters = { company_id: 999 };
      
      db.buildSelectQuery.mockReturnValue(['SELECT config FROM...', []]);
      db.executeQuery.mockResolvedValue({ rows: null });
      
      const result = await userHierarchyDao.getUserHierarchysDashBoardReportDao(mockFilters);
      
      expect(result).toEqual([]);
    });

    it('should handle errors during fetch', async () => {
      const error = new Error('Query failed');
      
      db.buildSelectQuery.mockReturnValue(['SELECT config FROM...', []]);
      db.executeQuery.mockRejectedValue(error);
      
      await expect(
        userHierarchyDao.getUserHierarchysDashBoardReportDao({}),
      ).rejects.toThrow('Query failed');
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

  describe('getUserHierarchysDao', () => {
    it('should fetch user hierarchies with pagination', async () => {
      const mockFilters = { company_id: 1 };
      const mockResult = [
        { id: 1, user_id: 1, config: {} },
        { id: 2, user_id: 2, config: {} },
      ];
      
      db.buildSelectQuery.mockReturnValue([
        'SELECT * FROM user_hierarchies...',
        [],
      ]);
      db.executeQuery.mockResolvedValue({ rows: mockResult });
      
      const result = await userHierarchyDao.getUserHierarchysDao(
        mockFilters,
        1,
        10,
        null,
        null,
        [],
      );
      
      expect(db.buildSelectQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        mockFilters,
        1,
        10,
        null,
        null,
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle search filters', async () => {
      const mockFilters = { company_id: 1, search: 'test' };
      const mockResult = [{ id: 1, user_id: 1 }];
      
      db.buildSelectQuery.mockReturnValue(['SELECT * FROM...', []]);
      db.executeQuery.mockResolvedValue({ rows: mockResult });
      searchBuilder.buildSearchFilterObj.mockReturnValue({ or: {} });
      
      const result = await userHierarchyDao.getUserHierarchysDao(mockFilters, 1, 10);
      
      expect(searchBuilder.buildSearchFilterObj).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should support custom columns selection', async () => {
      const mockFilters = { company_id: 1 };
      const customColumns = ['id', 'user_id', 'config'];
      const mockResult = [{ id: 1, user_id: 1, config: {} }];
      
      db.buildSelectQuery.mockReturnValue(['SELECT...', []]);
      db.executeQuery.mockResolvedValue({ rows: mockResult });
      
      const result = await userHierarchyDao.getUserHierarchysDao(
        mockFilters,
        1,
        10,
        null,
        null,
        customColumns,
      );
      
      expect(db.buildSelectQuery).toHaveBeenCalledWith(
        expect.stringContaining(customColumns.join(', ')),
        mockFilters,
        1,
        10,
        null,
        null,
      );
      expect(result).toEqual(mockResult);
    });

    it('should support transaction with connection', async () => {
      const mockConn = {};
      const mockResult = [{ id: 1 }];
      
      db.buildSelectQuery.mockReturnValue(['SELECT * FROM...', []]);
      db.executeQuery.mockResolvedValue({ rows: mockResult });
      
      const result = await userHierarchyDao.getUserHierarchysDao(
        { company_id: 1 },
        1,
        10,
        null,
        null,
        [],
        mockConn,
      );
      
      expect(db.executeQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        mockConn,
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle errors during fetch', async () => {
      const error = new Error('Query failed');
      
      db.buildSelectQuery.mockReturnValue(['SELECT * FROM...', []]);
      db.executeQuery.mockRejectedValue(error);
      
      await expect(
        userHierarchyDao.getUserHierarchysDao({ company_id: 1 }, 1, 10),
      ).rejects.toThrow('Query failed');
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

  describe('updateUserHierarchyDao', () => {
    it('should update user hierarchy successfully', async () => {
      const mockId = { id: 1 };
      const mockData = { config: { updated: true } };
      const mockResult = { id: 1, config: { updated: true } };
      
      db.buildUpdateQuery.mockReturnValue(['UPDATE user_hierarchies SET...', []]);
      db.executeQuery.mockResolvedValue({ rows: [mockResult] });
      
      const result = await userHierarchyDao.updateUserHierarchyDao(mockId, mockData);
      
      expect(db.buildUpdateQuery).toHaveBeenCalledWith('UserHierarchy', mockData, mockId);
      expect(db.executeQuery).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should return updated hierarchy data', async () => {
      const mockResult = { id: 1, user_id: 2, config: { parent: 3 } };
      
      db.buildUpdateQuery.mockReturnValue(['UPDATE...', []]);
      db.executeQuery.mockResolvedValue({ rows: [mockResult] });
      
      const result = await userHierarchyDao.updateUserHierarchyDao({ id: 1 }, { config: {} });
      
      expect(result).toEqual(mockResult);
    });

    it('should support transaction with connection', async () => {
      const mockConn = {};
      const mockResult = { id: 1 };
      
      db.buildUpdateQuery.mockReturnValue(['UPDATE...', []]);
      db.executeQuery.mockResolvedValue({ rows: [mockResult] });
      
      await userHierarchyDao.updateUserHierarchyDao(
        { id: 1 },
        { config: {} },
        mockConn,
      );
      
      expect(db.executeQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        mockConn,
      );
    });

    it('should handle errors during update', async () => {
      const error = new Error('Update failed');
      
      db.buildUpdateQuery.mockReturnValue(['UPDATE...', []]);
      db.executeQuery.mockRejectedValue(error);
      
      await expect(
        userHierarchyDao.updateUserHierarchyDao({ id: 1 }, { config: {} }),
      ).rejects.toThrow('Update failed');
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

  describe('deleteUserHierarchyDao', () => {
    it('should delete user hierarchy successfully', async () => {
      const mockId = { id: 1 };
      const mockData = { is_obsolete: true };
      const mockResult = { id: 1, is_obsolete: true };
      
      db.buildUpdateQuery.mockReturnValue(['UPDATE user_hierarchies SET...', []]);
      db.executeQuery.mockResolvedValue({ rows: [mockResult] });
      
      const result = await userHierarchyDao.deleteUserHierarchyDao(mockId, mockData);
      
      expect(db.buildUpdateQuery).toHaveBeenCalledWith('UserHierarchy', mockData, mockId);
      expect(db.executeQuery).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should mark as obsolete instead of hard delete', async () => {
      const mockResult = { id: 1, is_obsolete: true };
      
      db.buildUpdateQuery.mockReturnValue(['UPDATE...', []]);
      db.executeQuery.mockResolvedValue({ rows: [mockResult] });
      
      const result = await userHierarchyDao.deleteUserHierarchyDao(
        { id: 1 },
        { is_obsolete: true },
      );
      
      expect(result.is_obsolete).toBe(true);
    });

    it('should support transaction with connection', async () => {
      const mockConn = {};
      const mockResult = { id: 1 };
      
      db.buildUpdateQuery.mockReturnValue(['UPDATE...', []]);
      db.executeQuery.mockResolvedValue({ rows: [mockResult] });
      
      await userHierarchyDao.deleteUserHierarchyDao(
        { id: 1 },
        { is_obsolete: true },
        mockConn,
      );
      
      expect(db.executeQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        mockConn,
      );
    });

    it('should handle errors during delete', async () => {
      const error = new Error('Delete failed');
      
      db.buildUpdateQuery.mockReturnValue(['UPDATE...', []]);
      db.executeQuery.mockRejectedValue(error);
      
      await expect(
        userHierarchyDao.deleteUserHierarchyDao({ id: 1 }, { is_obsolete: true }),
      ).rejects.toThrow('Delete failed');
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

  describe('getUserHierarchyVendor', () => {
    it('should fetch user hierarchy vendor config', async () => {
      const mockConfig = { parent: 1, child: { operations: [2, 3] } };
      
      db.executeQuery.mockResolvedValue({ rows: [{ config: mockConfig }] });
      
      const result = await userHierarchyDao.getUserHierarchyVendor(1);
      
      expect(db.executeQuery).toHaveBeenCalled();
      expect(result).toEqual(mockConfig);
    });

    it('should return empty object when user hierarchy not found', async () => {
      db.executeQuery.mockResolvedValue({ rows: [] });
      
      const result = await userHierarchyDao.getUserHierarchyVendor(999);
      
      expect(result).toEqual({});
    });

    it('should support transaction with connection', async () => {
      const mockConn = {};
      const mockConfig = { parent: 1 };
      
      db.executeQuery.mockResolvedValue({ rows: [{ config: mockConfig }] });
      
      await userHierarchyDao.getUserHierarchyVendor(1, mockConn);
      
      expect(db.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('user_id = $1'),
        [1],
        mockConn,
      );
    });

    it('should handle errors', async () => {
      const error = new Error('Query failed');
      db.executeQuery.mockRejectedValue(error);
      
      await expect(userHierarchyDao.getUserHierarchyVendor(1)).rejects.toThrow('Query failed');
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

  describe('updateUserHierarchyVendor', () => {
    it('should update user hierarchy vendor config', async () => {
      const mockConfig = { parent: 1, child: { operations: [2] } };
      const mockResult = { id: 1, config: mockConfig };
      
      db.executeQuery.mockResolvedValue({ rows: [mockResult] });
      
      const result = await userHierarchyDao.updateUserHierarchyVendor(
        1,
        mockConfig,
        5,
      );
      
      expect(db.executeQuery).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should include updated_by in update', async () => {
      const mockConfig = { parent: 1 };
      const mockResult = { id: 1 };
      
      db.executeQuery.mockResolvedValue({ rows: [mockResult] });
      
      await userHierarchyDao.updateUserHierarchyVendor(1, mockConfig, 5);
      
      expect(db.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('UserHierarchy'),
        [mockConfig, 5, 1],
        null,
      );
    });

    it('should support transaction with connection', async () => {
      const mockConn = {};
      const mockResult = { id: 1 };
      
      db.executeQuery.mockResolvedValue({ rows: [mockResult] });
      
      await userHierarchyDao.updateUserHierarchyVendor(1, {}, 5, mockConn);
      
      expect(db.executeQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        mockConn,
      );
    });

    it('should handle errors', async () => {
      const error = new Error('Update failed');
      db.executeQuery.mockRejectedValue(error);
      
      await expect(
        userHierarchyDao.updateUserHierarchyVendor(1, {}, 5),
      ).rejects.toThrow('Update failed');
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

});
