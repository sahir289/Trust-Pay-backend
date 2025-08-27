import {
    getRoleDao,
    createRoleDao,
    updateRoleDao,
    deleteRoleDao,
    getRolesById,
  } from './rolesDao.js';
  import * as db from '../../utils/db.js';
  import { logger } from '../../utils/logger.js';
  
  jest.mock('../../utils/db.js', () => ({
    buildInsertQuery: jest.fn(),
    buildSelectQuery: jest.fn(),
    buildUpdateQuery: jest.fn(),
    executeQuery: jest.fn(),
  }));

  jest.mock('../../utils/searchBuilder.js', () => ({
    buildSearchFilterObj: jest.fn(() => []),
  }));  
  
  jest.mock('../../utils/logger.js', () => ({
    logger: { error: jest.fn() },
  }));
  
  describe('Roles DAO', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    describe('getRoleDao', () => {
        it('should return rows from executeQuery', async () => {
            const mockRows = [{ id: 1, role: 'Admin' }];
            db.buildSelectQuery.mockReturnValue(['SELECT * FROM roles', []]);
            db.executeQuery.mockResolvedValue({ rows: mockRows });
          
            const result = await getRoleDao({ search: 'Admin' });
            expect(result).toEqual(mockRows);
            expect(db.buildSelectQuery).toHaveBeenCalled();
            expect(db.executeQuery).toHaveBeenCalledWith('SELECT * FROM roles', []);
          });          
  
      it('should log and throw error on failure', async () => {
        const error = new Error('DB error');
        db.buildSelectQuery.mockImplementation(() => { throw error; });
        await expect(getRoleDao({})).rejects.toThrow('DB error');
        expect(logger.error).toHaveBeenCalledWith('Error in getRolesDao:', error);
      });
    });
  
    describe('createRoleDao', () => {
      it('should return created row using executeQuery', async () => {
        const data = { role: 'Admin' };
        db.buildInsertQuery.mockReturnValue(['INSERT INTO roles ...', [data]]);
        db.executeQuery.mockResolvedValue({ rows: [data] });
  
        const result = await createRoleDao(null, data);
        expect(result).toEqual(data);
        expect(db.buildInsertQuery).toHaveBeenCalledWith('Role', data);
        expect(db.executeQuery).toHaveBeenCalled();
      });
  
      it('should use conn.query if connection object provided', async () => {
        const data = { role: 'Admin' };
        const mockConn = { query: jest.fn().mockResolvedValue({ rows: [data] }) };
        db.buildInsertQuery.mockReturnValue(['INSERT INTO roles ...', [data]]);
  
        const result = await createRoleDao(mockConn, data);
        expect(result).toEqual(data);
        expect(mockConn.query).toHaveBeenCalledWith('INSERT INTO roles ...', [data]);
      });
    });
  
    describe('updateRoleDao', () => {
      it('should return updated row using executeQuery', async () => {
        const data = { role: 'Manager' };
        db.buildUpdateQuery.mockReturnValue(['UPDATE roles ...', [data]]);
        db.executeQuery.mockResolvedValue({ rows: [data] });
  
        const result = await updateRoleDao(null, { id: 1 }, data);
        expect(result).toEqual(data);
        expect(db.buildUpdateQuery).toHaveBeenCalledWith('Role', data, { id: 1 });
      });
    });
  
    describe('deleteRoleDao', () => {
      it('should return deleted (soft) row using executeQuery', async () => {
        const data = { is_obsolete: true };
        db.buildUpdateQuery.mockReturnValue(['UPDATE roles ...', [data]]);
        db.executeQuery.mockResolvedValue({ rows: [data] });
  
        const result = await deleteRoleDao({ id: 1 }, data);
        expect(result).toEqual(data);
        expect(db.buildUpdateQuery).toHaveBeenCalledWith('Role', data, { id: 1 });
      });
    });
  
    describe('getRolesById', () => {
      it('should return role row by ID', async () => {
        const mockRow = { id: 1, role: 'Admin' };
        db.executeQuery.mockResolvedValue({ rows: [mockRow] });
  
        const result = await getRolesById(1);
        expect(result).toEqual(mockRow);
        expect(db.executeQuery).toHaveBeenCalledWith('SELECT * FROM "Role" WHERE id = $1', [1]);
      });
  
      it('should log and throw error on failure', async () => {
        const error = new Error('DB error');
        db.executeQuery.mockRejectedValue(error);
  
        await expect(getRolesById(1)).rejects.toThrow('DB error');
        expect(logger.error).toHaveBeenCalledWith('Error in getRolesById:', error);
      });
    });
  });
  