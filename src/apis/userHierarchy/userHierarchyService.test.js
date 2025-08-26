const {
    createUserHierarchyService,
    getUserHierarchyService,
    updateUserHierarchyService,
    deleteUserHierarchyService,
  } = require('./userHierarchyService');
  const {
    beginTransaction,
    commit,
    getConnection,
    rollback,
  } = require('../../utils/db');
  const {
    createUserHierarchyDao,
    deleteUserHierarchyDao,
    getUserHierarchysDao,
    updateUserHierarchyDao,
  } = require('./userHierarchyDao');
  const { filterResponse } = require('../../helpers');
  const { logger } = require('../../utils/logger');
  const { columns, merchantColumns, Role } = require('../../constants');
  
  jest.mock('../../utils/db');
  jest.mock('./userHierarchyDao');
  jest.mock('../../helpers');
  jest.mock('../../utils/logger');
  
  describe('User Hierarchy Service', () => {
    let mockConnection;
  
    beforeEach(() => {
      mockConnection = {
        release: jest.fn(),
      };
      getConnection.mockResolvedValue(mockConnection);
      beginTransaction.mockResolvedValue();
      commit.mockResolvedValue();
      rollback.mockResolvedValue();
      logger.error = jest.fn();
      logger.log = jest.fn();
      filterResponse.mockImplementation((data, _) => data);
    });
  
    afterEach(() => {
      jest.clearAllMocks();
    });
  
    describe('createUserHierarchyService', () => {
      const payload = { name: 'Test Hierarchy' };
      const mockData = { id: 1, name: 'Test Hierarchy' };
  
      test('should create user hierarchy successfully for MERCHANT role', async () => {
        createUserHierarchyDao.mockResolvedValue(mockData);
        const result = await createUserHierarchyService(payload, Role.MERCHANT);
  
        expect(getConnection).toHaveBeenCalled();
        expect(beginTransaction).toHaveBeenCalledWith(mockConnection);
        expect(createUserHierarchyDao).toHaveBeenCalledWith(payload);
        expect(commit).toHaveBeenCalledWith(mockConnection);
        expect(filterResponse).toHaveBeenCalledWith(mockData, merchantColumns.USER_HIERARCHY);
        expect(result).toEqual(mockData);
        expect(mockConnection.release).toHaveBeenCalled();
      });
  
      test('should create user hierarchy successfully for non-MERCHANT role', async () => {
        createUserHierarchyDao.mockResolvedValue(mockData);
        const result = await createUserHierarchyService(payload, Role.ADMIN);
  
        expect(filterResponse).toHaveBeenCalledWith(mockData, columns.USER_HIERARCHY);
        expect(result).toEqual(mockData);
      });
  
      test('should handle database error and rollback transaction', async () => {
        const error = new Error('Database error');
        createUserHierarchyDao.mockRejectedValue(error);
  
        await expect(createUserHierarchyService(payload, Role.MERCHANT)).rejects.toThrow('Database error');
        expect(rollback).toHaveBeenCalledWith(mockConnection);
        expect(logger.error).toHaveBeenCalledWith('Error while creating UserHierarchy', error);
        expect(mockConnection.release).toHaveBeenCalled();
      });
  
      test('should handle rollback error', async () => {
        const error = new Error('Database error');
        const rollbackError = new Error('Rollback error');
        createUserHierarchyDao.mockRejectedValue(error);
        rollback.mockRejectedValue(rollbackError);
  
        await expect(createUserHierarchyService(payload, Role.MERCHANT)).rejects.toThrow('Database error');
        expect(logger.log).toHaveBeenCalledWith('Error during transaction rollback', rollbackError);
      });
  
      test('should handle connection release error', async () => {
        const error = new Error('Database error');
        const releaseError = new Error('Release error');
        createUserHierarchyDao.mockRejectedValue(error);
        mockConnection.release.mockImplementation(() => { throw releaseError; });
  
        await expect(createUserHierarchyService(payload, Role.MERCHANT)).rejects.toThrow('Database error');
        expect(logger.log).toHaveBeenCalledWith('Error while releasing the connection', releaseError);
      });
    });
  
    describe('getUserHierarchyService', () => {
      const filters = { name: 'Test' };
      const mockData = [{ id: 1, name: 'Test Hierarchy' }];
  
      test('should fetch user hierarchies successfully for MERCHANT role', async () => {
        getUserHierarchysDao.mockResolvedValue(mockData);
        const result = await getUserHierarchyService(filters, Role.MERCHANT, '1', '10');
  
        expect(getUserHierarchysDao).toHaveBeenCalledWith(filters, 1, 10, null, null, merchantColumns.USER_HIERARCHY);
        expect(result).toEqual(mockData);
      });
  
      test('should fetch user hierarchies successfully for non-MERCHANT role', async () => {
        getUserHierarchysDao.mockResolvedValue(mockData);
        const result = await getUserHierarchyService(filters, Role.ADMIN, '1', '10');
  
        expect(getUserHierarchysDao).toHaveBeenCalledWith(filters, 1, 10, null, null, columns.USER_HIERARCHY);
        expect(result).toEqual(mockData);
      });
  
      test('should handle invalid page and limit values', async () => {
        getUserHierarchysDao.mockResolvedValue(mockData);
        const result = await getUserHierarchyService(filters, Role.MERCHANT, 'invalid', 'invalid');
  
        expect(getUserHierarchysDao).toHaveBeenCalledWith(filters, 1, 10, null, null, merchantColumns.USER_HIERARCHY);
        expect(result).toEqual(mockData);
      });
  
      test('should handle database error', async () => {
        const error = new Error('Database error');
        getUserHierarchysDao.mockRejectedValue(error);
  
        await expect(getUserHierarchyService(filters, Role.MERCHANT, '1', '10')).rejects.toThrow('Database error');
        expect(logger.error).toHaveBeenCalledWith('Error while fetching UserHierarchys', error);
      });
    });
  
    describe('updateUserHierarchyService', () => {
      const id = 1;
      const payload = { name: 'Updated Hierarchy' };
      const mockData = { id: 1, name: 'Updated Hierarchy' };
  
      test('should update user hierarchy successfully for MERCHANT role', async () => {
        updateUserHierarchyDao.mockResolvedValue(mockData);
        const result = await updateUserHierarchyService(id, payload, Role.MERCHANT);
  
        expect(getConnection).toHaveBeenCalled();
        expect(beginTransaction).toHaveBeenCalledWith(mockConnection);
        expect(updateUserHierarchyDao).toHaveBeenCalledWith(id, payload);
        expect(commit).toHaveBeenCalledWith(mockConnection);
        expect(filterResponse).toHaveBeenCalledWith(mockData, merchantColumns.USER_HIERARCHY);
        expect(result).toEqual(mockData);
        expect(mockConnection.release).toHaveBeenCalled();
      });
  
      test('should handle database error and rollback transaction', async () => {
        const error = new Error('Database error');
        updateUserHierarchyDao.mockRejectedValue(error);
  
        await expect(updateUserHierarchyService(id, payload, Role.MERCHANT)).rejects.toThrow('Database error');
        expect(rollback).toHaveBeenCalledWith(mockConnection);
        expect(logger.error).toHaveBeenCalledWith('Error while updating UserHierarchy', error);
        expect(mockConnection.release).toHaveBeenCalled();
      });
    });
  
    describe('deleteUserHierarchyService', () => {
      const ids = [1, 2];
      const updated_by = 'admin';
      const payload = { is_obsolete: true, updated_by };
      const mockData = [{ id: 1 }, { id: 2 }];
  
      test('should delete user hierarchies successfully for MERCHANT role', async () => {
        deleteUserHierarchyDao.mockResolvedValue(mockData);
        const result = await deleteUserHierarchyService(ids, updated_by, Role.MERCHANT);
  
        expect(getConnection).toHaveBeenCalled();
        expect(beginTransaction).toHaveBeenCalledWith(mockConnection);
        expect(deleteUserHierarchyDao).toHaveBeenCalledWith(ids, payload);
        expect(commit).toHaveBeenCalledWith(mockConnection);
        expect(filterResponse).toHaveBeenCalledWith(mockData, merchantColumns.USER_HIERARCHY);
        expect(result).toEqual(mockData);
        expect(mockConnection.release).toHaveBeenCalled();
      });
  
      test('should handle database error and rollback transaction', async () => {
        const error = new Error('Database error');
        deleteUserHierarchyDao.mockRejectedValue(error);
  
        await expect(deleteUserHierarchyService(ids, updated_by, Role.MERCHANT)).rejects.toThrow('Database error');
        expect(rollback).toHaveBeenCalledWith(mockConnection);
        expect(logger.error).toHaveBeenCalledWith('Error while deleting UserHierarchy', error);
        expect(mockConnection.release).toHaveBeenCalled();
      });
    });
  });