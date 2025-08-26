const {
    createUserHierarchyDao,
    getUserHierarchysDao,
    updateUserHierarchyDao,
    deleteUserHierarchyDao,
  } = require('./userHierarchyDao');
  const { tableName } = require('../../constants');
  const { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } = require('../../utils/db');
  const { logger } = require('../../utils/logger');
  const { buildSearchFilterObj } = require('../../utils/searchBuilder');
  
  jest.mock('../../utils/db');
  jest.mock('../../utils/logger');
  jest.mock('../../utils/searchBuilder');
  
  describe('User Hierarchy DAO', () => {
    beforeEach(() => {
      logger.error = jest.fn();
      buildInsertQuery.mockReturnValue(['INSERT INTO user_hierarchy (name) VALUES ($1)', ['Test Hierarchy']]);
      buildSelectQuery.mockReturnValue(['SELECT * FROM "user_hierarchy" WHERE 1=1', []]);
      buildUpdateQuery.mockReturnValue(['UPDATE user_hierarchy SET name = $1 WHERE id = $2', ['Updated Hierarchy', 1]]);
      executeQuery.mockResolvedValue({ rows: [{ id: 1, name: 'Test Hierarchy' }] });
    });
  
    afterEach(() => {
      jest.clearAllMocks();
    });
  
    describe('createUserHierarchyDao', () => {
      const data = { name: 'Test Hierarchy' };
      const mockResult = { id: 1, name: 'Test Hierarchy' };
  
      test('should create user hierarchy with connection', async () => {
        const mockConn = { query: jest.fn().mockResolvedValue({ rows: [mockResult] }) };
        const result = await createUserHierarchyDao(data, mockConn);
  
        expect(buildInsertQuery).toHaveBeenCalledWith(tableName.USER_HIERARCHY, data);
        expect(mockConn.query).toHaveBeenCalledWith('INSERT INTO user_hierarchy (name) VALUES ($1)', ['Test Hierarchy']);
        expect(result).toEqual(mockResult);
      });
  
      test('should create user hierarchy without connection', async () => {
        const result = await createUserHierarchyDao(data);
  
        expect(buildInsertQuery).toHaveBeenCalledWith(tableName.USER_HIERARCHY, data);
        expect(executeQuery).toHaveBeenCalledWith('INSERT INTO user_hierarchy (name) VALUES ($1)', ['Test Hierarchy']);
        expect(result).toEqual(mockResult);
      });
  
      test('should handle error during creation', async () => {
        const error = new Error('Database error');
        executeQuery.mockRejectedValue(error);
  
        await expect(createUserHierarchyDao(data)).rejects.toThrow('Database error');
        expect(logger.error).toHaveBeenCalledWith('Error in create UserHierarchy Dao:', error);
      });
    });
  
    describe('getUserHierarchysDao', () => {
      const filters = { name: 'Test' };
      const mockResult = [{ id: 1, name: 'Test Hierarchy' }];
  
      test('should fetch user hierarchies with filters and columns', async () => {
        const columns = ['id', 'name'];
        const result = await getUserHierarchysDao(filters, 1, 10, 'name', 'ASC', columns);
  
        expect(buildSelectQuery).toHaveBeenCalledWith(
          'SELECT id, name FROM "UserHierarchy" WHERE 1=1',
          filters,
          1,
          10,
          'name',
          'ASC'
        );
        expect(executeQuery).toHaveBeenCalledWith('SELECT * FROM "user_hierarchy" WHERE 1=1', []);
        expect(result).toEqual(mockResult);
      });
  
      test('should handle search filter', async () => {
        const filtersWithSearch = { search: 'test query' };
        const mockSearchFilter = { name: 'test query' };
        buildSearchFilterObj.mockReturnValue(mockSearchFilter);
  
        const result = await getUserHierarchysDao(filtersWithSearch, 1, 10);
  
        expect(buildSearchFilterObj).toHaveBeenCalledWith('test query', tableName.MERCHANT);
        expect(buildSelectQuery).toHaveBeenCalledWith(
          'SELECT * FROM "UserHierarchy\" WHERE 1=1',
          { or: mockSearchFilter },
          1,
          10,
          undefined,
          undefined
        );
        expect(result).toEqual(mockResult);
      });
  
      test('should handle error during fetch', async () => {
        const error = new Error('Database error');
        executeQuery.mockRejectedValue(error);
  
        await expect(getUserHierarchysDao(filters, 1, 10)).rejects.toThrow('Database error');
        expect(logger.error).toHaveBeenCalledWith('Error in get UserHierarchy Dao:', error);
      });
    });
  
    describe('updateUserHierarchyDao', () => {
      const id = 1;
      const data = { name: 'Updated Hierarchy' };
      const mockResult = { id: 1, name: 'Test Hierarchy' };
  
      test('should update user hierarchy with connection', async () => {
        const mockConn = { query: jest.fn().mockResolvedValue({ rows: [mockResult] }) };
        const result = await updateUserHierarchyDao(id, data, mockConn);
  
        expect(buildUpdateQuery).toHaveBeenCalledWith(tableName.USER_HIERARCHY, data, id);
        expect(mockConn.query).toHaveBeenCalledWith('UPDATE user_hierarchy SET name = $1 WHERE id = $2', ['Updated Hierarchy', 1]);
        expect(result).toEqual(mockResult);
      });
  
      test('should update user hierarchy without connection', async () => {
        const result = await updateUserHierarchyDao(id, data);
  
        expect(buildUpdateQuery).toHaveBeenCalledWith(tableName.USER_HIERARCHY, data, id);
        expect(executeQuery).toHaveBeenCalledWith('UPDATE user_hierarchy SET name = $1 WHERE id = $2', ['Updated Hierarchy', 1]);
        expect(result).toEqual(mockResult);
      });
  
      test('should handle error during update', async () => {
        const error = new Error('Database error');
        executeQuery.mockRejectedValue(error);
  
        await expect(updateUserHierarchyDao(id, data)).rejects.toThrow('Database error');
        expect(logger.error).toHaveBeenCalledWith('Error in updateUserHierarchyDao:', error);
      });
    });
  
    describe('deleteUserHierarchyDao', () => {
      const id = [1, 2];
      const data = { is_obsolete: true, updated_by: 'admin' };
      const mockResult = { id: 1, name: "Test Hierarchy" };
  
      test('should delete user hierarchy', async () => {
        const result = await deleteUserHierarchyDao(id, data);
  
        expect(buildUpdateQuery).toHaveBeenCalledWith(tableName.USER_HIERARCHY, data, id);
        expect(executeQuery).toHaveBeenCalledWith('UPDATE user_hierarchy SET name = $1 WHERE id = $2', ['Updated Hierarchy', 1]);
        expect(result).toEqual(mockResult);
      });
  
      test('should handle error during deletion', async () => {
        const error = new Error('Database error');
        executeQuery.mockRejectedValue(error);
  
        await expect(deleteUserHierarchyDao(id, data)).rejects.toThrow('Database error');
        expect(logger.error).toHaveBeenCalledWith('Error in deleteUserHierarchyDao:', error);
      });
    });
  });