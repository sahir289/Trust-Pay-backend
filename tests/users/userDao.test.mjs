// -------------------- ESM MOCKS --------------------
/* global describe, it, expect, beforeEach, afterEach, beforeAll */
import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/constants/index.js', () => ({
  tableName: {
    USER: 'User',
    ROLE: 'Role',
    DESIGNATION: 'Designation',
  },
  Role: { MERCHANT: 'MERCHANT', VENDOR: 'VENDOR', ADMIN: 'ADMIN' },
}));

jest.unstable_mockModule('../../src/utils/db.js', () => ({
  buildInsertQuery: jest.fn(() => ['SQL', []]),
  buildSelectQuery: jest.fn(() => ['SQL', []]),
  buildUpdateQuery: jest.fn(() => ['SQL', []]),
  buildJoinQuery: jest.fn(() => 'SELECT * FROM User'),
  executeQuery: jest.fn(async () => ({ rows: [{}] })),
}));

jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

jest.unstable_mockModule('../../src/utils/searchBuilder.js', () => ({
  buildSearchFilterObj: jest.fn((search) => ({ or: { id: `%${search}%` } })),
}));

// -------------------- IMPORTS ----------------------
let dao, db, loggerModule, searchBuilder;

beforeAll(async () => {
  searchBuilder = await import('../../src/utils/searchBuilder.js');
  dao = await import('../../src/apis/users/userDao.js');
  db = await import('../../src/utils/db.js');
  loggerModule = await import('../../src/utils/logger.js');
});

beforeEach(() => {
  // Reassign all mock functions for isolation
  if (db) {
    db.buildInsertQuery = jest.fn(() => ['SQL', []]);
    db.buildSelectQuery = jest.fn(() => ['SQL', []]);
    db.buildUpdateQuery = jest.fn(() => ['SQL', []]);
    db.buildJoinQuery = jest.fn(() => 'SELECT * FROM User');
    db.executeQuery = jest.fn(async () => ({ rows: [{}] }));
  }
  if (loggerModule?.logger) {
    loggerModule.logger.error = jest.fn();
    loggerModule.logger.info = jest.fn();
    loggerModule.logger.warn = jest.fn();
  }
  if (searchBuilder) {
    searchBuilder.buildSearchFilterObj = jest.fn((search) => ({
      or: { id: `%${search}%` },
    }));
  }
});

afterEach(() => {
  jest.clearAllMocks();
});

// -------------------- HELPERS ----------------------
function mockConn() { return {}; }

// -------------------- TESTS ------------------------
describe('userDao', () => {
  describe('getUsersContactDao', () => {
    it('should return true when contact exists', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
      const result = await dao.getUsersContactDao(1, '9876543210', mockConn());
      // Verify that the service call was made and the result is correct
      expect(db.executeQuery).toHaveBeenCalled();
      // The actual return value depends on the implementation of getUsersContactDao
      expect(result).toBe(true);
    });

    it('should return false when contact does not exist', async () => {
      db.executeQuery.mockResolvedValue({ rows: [] });
      const result = await dao.getUsersContactDao(1, '9876543210', mockConn());
      // Verify that the service call was made and the result is correct
      expect(result).toBe(false);
    });

    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('query failed'));
      // Verify that the error is logged and thrown
      await expect(dao.getUsersContactDao(1, '9876543210', mockConn())).rejects.toThrow('query failed');
      // Verify that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getUsersNameDao', () => {
    it('should select and return user name data', async () => {
      const mockUser = { user_name: 'john_doe', code: 'JD001', role: 'ADMIN', designation: 'Super Admin' };
      db.executeQuery.mockResolvedValue({ rows: [mockUser] });
      const result = await dao.getUsersNameDao(1, mockConn());
      // Verify that the service call was made and the result is correct
      expect(db.executeQuery).toHaveBeenCalled();
      // The actual return value depends on the implementation of getUsersNameDao
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      db.executeQuery.mockResolvedValue({ rows: [] });
      const result = await dao.getUsersNameDao(999, mockConn());
      // Verify that the service call was made and the result is correct
      expect(result).toBeNull();
    });

    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('query failed'));
      // Verify that the error is logged and thrown
      await expect(dao.getUsersNameDao(1, mockConn())).rejects.toThrow('query failed');
      // Verify that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getUsersDao', () => {
    it('should select and return users with pagination', async () => {
      db.buildJoinQuery.mockReturnValue('SELECT * FROM User');
      db.buildSelectQuery.mockReturnValue(['SQL', []]);
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1, user_name: 'john' }] });
      
      const result = await dao.getUsersDao(
        { company_id: 1 },
        1,
        10,
        'id',
        'ASC',
        [],
        mockConn()
      );
      
      // Verify that the service calls were made and the result is correct
      expect(db.buildJoinQuery).toHaveBeenCalled();
      // The actual return value depends on the implementation of getUsersDao
      expect(db.buildSelectQuery).toHaveBeenCalled();
      // The actual return value depends on the implementation of getUsersDao
      expect(db.executeQuery).toHaveBeenCalled();
      // The actual return value depends on the implementation of getUsersDao
      expect(Array.isArray(result)).toBe(true);
    });

    it('should log and throw on error', async () => {
      db.buildJoinQuery.mockReturnValue('SELECT * FROM User');
      db.buildSelectQuery.mockReturnValue(['SQL', []]);
      db.executeQuery.mockRejectedValue(new Error('query failed'));
      
      await expect(dao.getUsersDao(
        { company_id: 1 },
        1,
        10,
        'id',
        'ASC',
        [],
        mockConn()
      )).rejects.toThrow('query failed');
      
      // Verify that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });

    it('should handle search filters', async () => {
      db.buildJoinQuery.mockReturnValue('SELECT * FROM User');
      db.buildSelectQuery.mockReturnValue(['SQL', []]);
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
      
      await dao.getUsersDao(
        { company_id: 1, search: 'john' },
        1,
        10,
        'id',
        'ASC',
        [],
        mockConn()
      );
      
      // Verify that the search filter was built and applied correctly
      expect(searchBuilder.buildSearchFilterObj).toHaveBeenCalled();
    });
  });

  describe('getAllUsersDao', () => {
    it('should select and return all users', async () => {
      db.buildJoinQuery.mockReturnValue('SELECT * FROM User');
      db.buildSelectQuery.mockReturnValue(['SQL', []]);
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1, user_name: 'john' }] });
      
      const result = await dao.getAllUsersDao(
        { company_id: 1 },
        1,
        10,
        'id',
        'ASC',
        [],
        mockConn()
      );
      
      // Verify that the service calls were made and the result is correct
      expect(db.executeQuery).toHaveBeenCalled();
      // The actual return value depends on the implementation of getAllUsersDao
      expect(Array.isArray(result)).toBe(true);
    });

    it('should log and throw on error', async () => {
      db.buildJoinQuery.mockReturnValue('SELECT * FROM User');
      db.buildSelectQuery.mockReturnValue(['SQL', []]);
      db.executeQuery.mockRejectedValue(new Error('query failed'));
      
      await expect(dao.getAllUsersDao(
        { company_id: 1 },
        1,
        10,
        'id',
        'ASC',
        [],
        mockConn()
      )).rejects.toThrow('query failed');
     
      // Verify that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getUsersBySearchDao', () => {
    it('should search and return users with pagination', async () => {
      db.executeQuery
        .mockResolvedValueOnce({ rows: [{ total: 10 }] }) // count query
        .mockResolvedValueOnce({ rows: [{ id: 1, user_name: 'john' }] }); // search query
      
      const result = await dao.getUsersBySearchDao(
        { company_id: 1 },
        ['john'],
        1,
        10,
        'ADMIN',
        mockConn()
      );
      
      // Verify that the service calls were made and the result is correct
      expect(db.executeQuery).toHaveBeenCalled();
      // The actual return value depends on the implementation of getUsersBySearchDao
      expect(result.totalCount).toBe(10);
      // The actual return value depends on the implementation of getUsersBySearchDao
      expect(result.totalPages).toBeDefined();
      // The actual return value depends on the implementation of getUsersBySearchDao
      expect(Array.isArray(result.Users)).toBe(true);
    });

    it('should handle empty search results', async () => {
      db.executeQuery
        .mockResolvedValueOnce({ rows: [{ total: 0 }] }) // count query
        .mockResolvedValueOnce({ rows: [] }); // search query
      
      const result = await dao.getUsersBySearchDao(
        { company_id: 1 },
        ['nonexistent'],
        1,
        10,
        'ADMIN',
        mockConn()
      );
      
      // Verify that the service calls were made and the result is correct
      expect(result.totalCount).toBe(0);
      // The actual return value depends on the implementation of getUsersBySearchDao
      expect(result.Users.length).toBe(0);
    });

    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('query failed'));
      
      await expect(dao.getUsersBySearchDao(
        { company_id: 1 },
        ['john'],
        1,
        10,
        'ADMIN',
        mockConn()
      )).rejects.toThrow('query failed');
      
      // Verify that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('createUserDao', () => {
    it('should insert and return user', async () => {
      db.buildInsertQuery.mockReturnValue(['SQL', []]);
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1, user_name: 'newuser', email: 'new@example.com' }] });
      
      const result = await dao.createUserDao({ user_name: 'newuser', email: 'new@example.com' }, mockConn());
      
      // Verify that the service calls were made and the result is correct
      expect(db.buildInsertQuery).toHaveBeenCalled();
      // The actual return value depends on the implementation of createUserDao
      expect(db.executeQuery).toHaveBeenCalled();
      // The actual return value depends on the implementation of createUserDao
      expect(result).toEqual({ id: 1, user_name: 'newuser', email: 'new@example.com' });
    });

    it('should log and throw on error', async () => {
      db.buildInsertQuery.mockReturnValue(['SQL', []]);
      db.executeQuery.mockRejectedValue(new Error('insert failed'));
      
      // Verify that the error is logged and thrown
      await expect(dao.createUserDao({ user_name: 'newuser' }, mockConn())).rejects.toThrow('insert failed');
      // Verify that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getUserByIdDao', () => {
    it('should select and return user by id', async () => {
      const mockUser = { id: 1, user_name: 'john', email: 'john@example.com' };
      db.executeQuery.mockResolvedValue({ rows: [mockUser], rowCount: 1 });
      
      const result = await dao.getUserByIdDao({ id: 1 }, mockConn());
      
      // Verify that the service call was made and the result is correct
      expect(db.executeQuery).toHaveBeenCalled();
      // The actual return value depends on the implementation of getUserByIdDao
      expect(Array.isArray(result)).toBe(true);
      // The actual return value depends on the implementation of getUserByIdDao
      expect(result).toEqual([mockUser]);
    });

    it('should return empty array if user not found', async () => {
      db.executeQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      
      const result = await dao.getUserByIdDao({ id: 999 }, mockConn());
      // Verify that the service call was made and the result is correct
      expect(result).toEqual([]);
    });

    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('query failed'));
      
      // Verify that the error is logged and thrown
      await expect(dao.getUserByIdDao({ id: 1 }, mockConn())).rejects.toThrow('query failed');
      // Verify that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getUsersByUserNameDao', () => {
    it('should select and return user by username', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1, user_name: 'john_doe' }], rowCount: 1 });
      
      const result = await dao.getUsersByUserNameDao({ company_id: 1 }, 'john_doe', mockConn());
      
      // Verify that the service call was made and the result is correct
      expect(db.executeQuery).toHaveBeenCalled();
      // The actual return value depends on the implementation of getUsersByUserNameDao
      expect(result).toEqual({ id: 1, user_name: 'john_doe' });
    });

    it('should return null if user not found', async () => {
      db.executeQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      
      const result = await dao.getUsersByUserNameDao({ company_id: 1 }, 'nonexistent', mockConn());
      // Verify that the service call was made and the result is correct
      expect(result).toBeNull();
    });

    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('query failed'));
      // Verify that the error is logged and thrown
      await expect(dao.getUsersByUserNameDao({ company_id: 1 }, 'john', mockConn())).rejects.toThrow('query failed');
      // Verify that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('updateUserDao', () => {
    it('should update and return updated user', async () => {
      db.buildUpdateQuery.mockReturnValue(['SQL', []]);
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1, user_name: 'updated_user' }] });
      
      const result = await dao.updateUserDao(
        { id: 1 },
        { user_name: 'updated_user' },
        mockConn()
      );
      
      // Verify that the service calls were made and the result is correct
      expect(db.buildUpdateQuery).toHaveBeenCalled();
      // The actual return value depends on the implementation of updateUserDao
      expect(db.executeQuery).toHaveBeenCalled();
      // The actual return value depends on the implementation of updateUserDao
      expect(result).toEqual({ id: 1, user_name: 'updated_user' });
    });

    it('should log and throw on error', async () => {
      db.buildUpdateQuery.mockReturnValue(['SQL', []]);
      db.executeQuery.mockRejectedValue(new Error('update failed'));
      
      // Verify that the error is logged and thrown
      await expect(dao.updateUserDao(
        { id: 1 },
        { user_name: 'updated' },
        mockConn()
      )).rejects.toThrow('update failed');
      
      // Verify that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('updateUserByIDDao', () => {
    it('should update user by ID', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1, user_name: 'updated' }] });
      
      const result = await dao.updateUserByIDDao(
        { id: 1 },
        { user_name: 'updated' },
        mockConn()
      );
      
      // Verify that the service calls were made and the result is correct
      expect(db.executeQuery).toHaveBeenCalled();
      // The actual return value depends on the implementation of updateUserByIDDao
      expect(Array.isArray(result)).toBe(true);
    });

    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('update failed'));
      // Verify that the error is logged and thrown
      await expect(dao.updateUserByIDDao({ id: 1 }, { user_name: 'updated' }, mockConn())).rejects.toThrow('update failed');
      // Verify that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('updateUser2FAStatusDao', () => {
    it('should update 2FA status', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
      
      const result = await dao.updateUser2FAStatusDao(
        1,
        true,
        mockConn()
      );
      
      // Verify that the service calls were made and the result is correct
      expect(db.executeQuery).toHaveBeenCalled();
      // The actual return value depends on the implementation of updateUser2FAStatusDao
      expect(result).toEqual({ id: 1 });
    });

    it('should return null if user not found', async () => {
      db.executeQuery.mockResolvedValue({ rows: [] });
      
      const result = await dao.updateUser2FAStatusDao(999, true, mockConn());
      // Verify that the service call was made and the result is correct
      expect(result).toBeNull();
    });

    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('update failed'));
      // Verify that the error is logged and thrown
      await expect(dao.updateUser2FAStatusDao(1, true, mockConn())).rejects.toThrow('update failed');
      // Verify that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getUserDao', () => {
    it('should select and return user', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1, user_name: 'john' }], rowCount: 1 });
      
      const result = await dao.getUserDao({ id: 1 }, mockConn());
      
      // Verify that the service call was made and the result is correct
      expect(db.executeQuery).toHaveBeenCalled();
      // The actual return value depends on the implementation of getUserDao
      expect(Array.isArray(result)).toBe(true);
      // The actual return value depends on the implementation of getUserDao
      expect(result).toEqual([{ id: 1, user_name: 'john' }]);
    });

    it('should return empty array if user not found', async () => {
      db.executeQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      
      const result = await dao.getUserDao({ id: 999 }, mockConn());
      
      // Verify that the service call was made and the result is correct
      expect(result).toEqual([]);
    });

    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('query failed'));
      
      // Verify that the error is logged and thrown
      await expect(dao.getUserDao({ id: 1 }, mockConn())).rejects.toThrow('query failed');
      // Verify that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('deleteUserDao', () => {
    it('should soft delete user by setting is_obsolete', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1, is_obsolete: true }] });
      
      const result = await dao.deleteUserDao({ id: 1 }, { is_obsolete: true }, mockConn());
      
      // Verify that the service calls were made and the result is correct
      expect(db.executeQuery).toHaveBeenCalled();
      // The actual return value depends on the implementation of deleteUserDao
      expect(Array.isArray(result)).toBe(true);
    });

    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('delete failed'));
      // Verify that the error is logged and thrown
      await expect(dao.deleteUserDao({ id: 1 }, { is_obsolete: true }, mockConn())).rejects.toThrow('delete failed');
      // Verify that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });
});
