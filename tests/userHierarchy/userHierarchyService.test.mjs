import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';

// Mock modules before importing them
jest.unstable_mockModule('../../src/utils/db.js', () => ({
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  getConnection: jest.fn(),
  rollback: jest.fn(),
}));

jest.unstable_mockModule('../../src/apis/userHierarchy/userHierarchyDao.js', () => ({
  createUserHierarchyDao: jest.fn(),
  deleteUserHierarchyDao: jest.fn(),
  getUserHierarchysDao: jest.fn(),
  updateUserHierarchyDao: jest.fn(),
}));

jest.unstable_mockModule('../../src/constants/index.js', () => ({
  columns: {
    USER_HIERARCHY: ['id', 'user_id', 'config', 'created_at', 'updated_at'],
  },
  merchantColumns: {
    USER_HIERARCHY: ['id', 'user_id', 'config'],
  },
  Role: {
    MERCHANT: 'MERCHANT',
    VENDOR: 'VENDOR',
    SUB_VENDOR: 'SUB_VENDOR',
    ADMIN: 'ADMIN',
  },
}));

jest.unstable_mockModule('../../src/helpers/index.js', () => ({
  filterResponse: jest.fn((data) => data),
}));

jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// -------------------- IMPORTS ----------------------
let service, userHierarchyDao, db, loggerModule, filterResponse, constants;

beforeAll(async () => {
  userHierarchyDao = await import('../../src/apis/userHierarchy/userHierarchyDao.js');
  db = await import('../../src/utils/db.js');
  loggerModule = await import('../../src/utils/logger.js');
  filterResponse = await import('../../src/helpers/index.js');
  constants = await import('../../src/constants/index.js');
  service = await import('../../src/apis/userHierarchy/userHierarchyService.js');
});

beforeEach(() => {
  jest.clearAllMocks();
  
  userHierarchyDao.createUserHierarchyDao = jest.fn();
  userHierarchyDao.deleteUserHierarchyDao = jest.fn();
  userHierarchyDao.getUserHierarchysDao = jest.fn();
  userHierarchyDao.updateUserHierarchyDao = jest.fn();
  
  db.getConnection = jest.fn();
  db.beginTransaction = jest.fn();
  db.commit = jest.fn();
  db.rollback = jest.fn();
  
  loggerModule.logger.error = jest.fn();
  loggerModule.logger.info = jest.fn();
  
  filterResponse.filterResponse = jest.fn((data) => data);
});

describe('userHierarchyService', () => {
  describe('createUserHierarchyService', () => {
    it('should create user hierarchy successfully', async () => {
      const mockPayload = { user_id: 1, config: { parent: 2 }, company_id: 1 };
      const mockConn = { release: jest.fn() };
      const mockResult = { id: 1, user_id: 1, config: { parent: 2 } };
      
      db.getConnection.mockResolvedValue(mockConn);
      db.beginTransaction.mockResolvedValue(undefined);
      db.commit.mockResolvedValue(undefined);
      userHierarchyDao.createUserHierarchyDao.mockResolvedValue(mockResult);
      filterResponse.filterResponse.mockReturnValue(mockResult);
      
      const result = await service.createUserHierarchyService(mockPayload, 'ADMIN');
      
      expect(db.getConnection).toHaveBeenCalled();
      expect(db.beginTransaction).toHaveBeenCalled();
      expect(userHierarchyDao.createUserHierarchyDao).toHaveBeenCalledWith(
        mockPayload,
        mockConn,
      );
      expect(db.commit).toHaveBeenCalled();
      expect(mockConn.release).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should rollback on creation error', async () => {
      const mockPayload = { user_id: 1 };
      const mockConn = { release: jest.fn() };
      
      db.getConnection.mockResolvedValue(mockConn);
      db.beginTransaction.mockResolvedValue(undefined);
      db.rollback.mockResolvedValue(undefined);
      userHierarchyDao.createUserHierarchyDao.mockRejectedValue(
        new Error('Insert failed'),
      );
      
      await expect(
        service.createUserHierarchyService(mockPayload, 'ADMIN'),
      ).rejects.toThrow('Insert failed');
      
      expect(db.rollback).toHaveBeenCalledWith(mockConn);
      expect(mockConn.release).toHaveBeenCalled();
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });

    it('should apply merchant columns filter for MERCHANT role', async () => {
      const mockPayload = { user_id: 1 };
      const mockConn = { release: jest.fn() };
      const mockResult = { id: 1, user_id: 1 };
      
      db.getConnection.mockResolvedValue(mockConn);
      db.beginTransaction.mockResolvedValue(undefined);
      db.commit.mockResolvedValue(undefined);
      userHierarchyDao.createUserHierarchyDao.mockResolvedValue(mockResult);
      filterResponse.filterResponse.mockReturnValue(mockResult);
      
      await service.createUserHierarchyService(mockPayload, 'MERCHANT');
      
      expect(filterResponse.filterResponse).toHaveBeenCalledWith(
        mockResult,
        constants.merchantColumns.USER_HIERARCHY,
      );
    });

    it('should apply default columns filter for other roles', async () => {
      const mockPayload = { user_id: 1 };
      const mockConn = { release: jest.fn() };
      const mockResult = { id: 1, user_id: 1 };
      
      db.getConnection.mockResolvedValue(mockConn);
      db.beginTransaction.mockResolvedValue(undefined);
      db.commit.mockResolvedValue(undefined);
      userHierarchyDao.createUserHierarchyDao.mockResolvedValue(mockResult);
      filterResponse.filterResponse.mockReturnValue(mockResult);
      
      await service.createUserHierarchyService(mockPayload, 'ADMIN');
      
      expect(filterResponse.filterResponse).toHaveBeenCalledWith(
        mockResult,
        constants.columns.USER_HIERARCHY,
      );
    });

    it('should handle connection errors', async () => {
      db.getConnection.mockRejectedValue(new Error('Connection error'));
      
      await expect(
        service.createUserHierarchyService({}, 'ADMIN'),
      ).rejects.toThrow('Connection error');
      
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getUserHierarchyService', () => {
    it('should fetch user hierarchies successfully', async () => {
      const mockFilters = { company_id: 1 };
      const mockResult = [
        { id: 1, user_id: 1, config: {} },
        { id: 2, user_id: 2, config: {} },
      ];
      
      userHierarchyDao.getUserHierarchysDao.mockResolvedValue(mockResult);
      
      const result = await service.getUserHierarchyService(mockFilters, 'ADMIN', 1, 10);
      
      expect(userHierarchyDao.getUserHierarchysDao).toHaveBeenCalledWith(
        mockFilters,
        1,
        10,
        null,
        null,
        constants.columns.USER_HIERARCHY,
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle pagination parameters', async () => {
      const mockResult = [];
      userHierarchyDao.getUserHierarchysDao.mockResolvedValue(mockResult);
      
      await service.getUserHierarchyService({}, 'ADMIN', '2', '20');
      
      expect(userHierarchyDao.getUserHierarchysDao).toHaveBeenCalledWith(
        {},
        2,
        20,
        null,
        null,
        constants.columns.USER_HIERARCHY,
      );
    });

    it('should use default pagination values', async () => {
      const mockResult = [];
      userHierarchyDao.getUserHierarchysDao.mockResolvedValue(mockResult);
      
      await service.getUserHierarchyService({}, 'ADMIN', null, null);
      
      expect(userHierarchyDao.getUserHierarchysDao).toHaveBeenCalledWith(
        {},
        1,
        10,
        null,
        null,
        constants.columns.USER_HIERARCHY,
      );
    });

    it('should apply merchant columns filter for MERCHANT role', async () => {
      const mockResult = [];
      userHierarchyDao.getUserHierarchysDao.mockResolvedValue(mockResult);
      
      await service.getUserHierarchyService({}, 'MERCHANT', 1, 10);
      
      expect(userHierarchyDao.getUserHierarchysDao).toHaveBeenCalledWith(
        {},
        1,
        10,
        null,
        null,
        constants.merchantColumns.USER_HIERARCHY,
      );
    });

    it('should handle fetch errors', async () => {
      userHierarchyDao.getUserHierarchysDao.mockRejectedValue(new Error('Fetch failed'));
      
      await expect(
        service.getUserHierarchyService({}, 'ADMIN', 1, 10),
      ).rejects.toThrow('Fetch failed');
      
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('updateUserHierarchyService', () => {
    it('should update user hierarchy successfully', async () => {
      const mockId = { id: 1 };
      const mockPayload = { config: { updated: true } };
      const mockConn = { release: jest.fn() };
      const mockResult = { id: 1, config: { updated: true } };
      
      db.getConnection.mockResolvedValue(mockConn);
      db.beginTransaction.mockResolvedValue(undefined);
      db.commit.mockResolvedValue(undefined);
      userHierarchyDao.updateUserHierarchyDao.mockResolvedValue(mockResult);
      filterResponse.filterResponse.mockReturnValue(mockResult);
      
      const result = await service.updateUserHierarchyService(mockId, mockPayload, 'ADMIN');
      
      expect(db.getConnection).toHaveBeenCalled();
      expect(db.beginTransaction).toHaveBeenCalled();
      expect(userHierarchyDao.updateUserHierarchyDao).toHaveBeenCalledWith(
        mockId,
        mockPayload,
        mockConn,
      );
      expect(db.commit).toHaveBeenCalled();
      expect(mockConn.release).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should rollback on update error', async () => {
      const mockId = { id: 1 };
      const mockPayload = { config: {} };
      const mockConn = { release: jest.fn() };
      
      db.getConnection.mockResolvedValue(mockConn);
      db.beginTransaction.mockResolvedValue(undefined);
      db.rollback.mockResolvedValue(undefined);
      userHierarchyDao.updateUserHierarchyDao.mockRejectedValue(
        new Error('Update failed'),
      );
      
      await expect(
        service.updateUserHierarchyService(mockId, mockPayload, 'ADMIN'),
      ).rejects.toThrow('Update failed');
      
      expect(db.rollback).toHaveBeenCalledWith(mockConn);
      expect(mockConn.release).toHaveBeenCalled();
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });

    it('should apply merchant columns filter for MERCHANT role', async () => {
      const mockId = { id: 1 };
      const mockPayload = { config: {} };
      const mockConn = { release: jest.fn() };
      const mockResult = { id: 1 };
      
      db.getConnection.mockResolvedValue(mockConn);
      db.beginTransaction.mockResolvedValue(undefined);
      db.commit.mockResolvedValue(undefined);
      userHierarchyDao.updateUserHierarchyDao.mockResolvedValue(mockResult);
      filterResponse.filterResponse.mockReturnValue(mockResult);
      
      await service.updateUserHierarchyService(mockId, mockPayload, 'MERCHANT');
      
      expect(filterResponse.filterResponse).toHaveBeenCalledWith(
        mockResult,
        constants.merchantColumns.USER_HIERARCHY,
      );
    });

    it('should handle connection errors', async () => {
      db.getConnection.mockRejectedValue(new Error('Connection error'));
      
      await expect(
        service.updateUserHierarchyService({ id: 1 }, {}, 'ADMIN'),
      ).rejects.toThrow('Connection error');
      
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('deleteUserHierarchyService', () => {
    it('should delete user hierarchy successfully', async () => {
      const mockIds = { id: 1, company_id: 1 };
      const mockConn = { release: jest.fn() };
      const mockResult = { id: 1, is_obsolete: true };
      
      db.getConnection.mockResolvedValue(mockConn);
      db.beginTransaction.mockResolvedValue(undefined);
      db.commit.mockResolvedValue(undefined);
      userHierarchyDao.deleteUserHierarchyDao.mockResolvedValue(mockResult);
      filterResponse.filterResponse.mockReturnValue(mockResult);
      
      const result = await service.deleteUserHierarchyService(mockIds, 5, 'ADMIN');
      
      expect(db.getConnection).toHaveBeenCalled();
      expect(db.beginTransaction).toHaveBeenCalled();
      expect(userHierarchyDao.deleteUserHierarchyDao).toHaveBeenCalledWith(
        mockIds,
        { is_obsolete: true, updated_by: 5 },
        mockConn,
      );
      expect(db.commit).toHaveBeenCalled();
      expect(mockConn.release).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should mark as obsolete and include updated_by', async () => {
      const mockIds = { id: 1 };
      const mockConn = { release: jest.fn() };
      const mockResult = { id: 1, is_obsolete: true };
      
      db.getConnection.mockResolvedValue(mockConn);
      db.beginTransaction.mockResolvedValue(undefined);
      db.commit.mockResolvedValue(undefined);
      userHierarchyDao.deleteUserHierarchyDao.mockResolvedValue(mockResult);
      filterResponse.filterResponse.mockReturnValue(mockResult);
      
      await service.deleteUserHierarchyService(mockIds, 10, 'ADMIN');
      
      expect(userHierarchyDao.deleteUserHierarchyDao).toHaveBeenCalledWith(
        mockIds,
        { is_obsolete: true, updated_by: 10 },
        mockConn,
      );
    });

    it('should rollback on delete error', async () => {
      const mockIds = { id: 1 };
      const mockConn = { release: jest.fn() };
      
      db.getConnection.mockResolvedValue(mockConn);
      db.beginTransaction.mockResolvedValue(undefined);
      db.rollback.mockResolvedValue(undefined);
      userHierarchyDao.deleteUserHierarchyDao.mockRejectedValue(
        new Error('Delete failed'),
      );
      
      await expect(
        service.deleteUserHierarchyService(mockIds, 5, 'ADMIN'),
      ).rejects.toThrow('Delete failed');
      
      expect(db.rollback).toHaveBeenCalledWith(mockConn);
      expect(mockConn.release).toHaveBeenCalled();
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });

    it('should apply merchant columns filter for MERCHANT role', async () => {
      const mockIds = { id: 1 };
      const mockConn = { release: jest.fn() };
      const mockResult = { id: 1, is_obsolete: true };
      
      db.getConnection.mockResolvedValue(mockConn);
      db.beginTransaction.mockResolvedValue(undefined);
      db.commit.mockResolvedValue(undefined);
      userHierarchyDao.deleteUserHierarchyDao.mockResolvedValue(mockResult);
      filterResponse.filterResponse.mockReturnValue(mockResult);
      
      await service.deleteUserHierarchyService(mockIds, 5, 'MERCHANT');
      
      expect(filterResponse.filterResponse).toHaveBeenCalledWith(
        mockResult,
        constants.merchantColumns.USER_HIERARCHY,
      );
    });

    it('should handle connection errors', async () => {
      db.getConnection.mockRejectedValue(new Error('Connection error'));
      
      await expect(
        service.deleteUserHierarchyService({ id: 1 }, 5, 'ADMIN'),
      ).rejects.toThrow('Connection error');
      
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });
});
