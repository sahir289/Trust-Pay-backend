import{
    getUsersDao,
    getAllUsersDao,
    getUserByIdDao,
    getUsersForCronDao,
    getUsersByUserNameDao,
    getAdminUserIdsDao,
    getUserByCompanyCreatedAtDao,
    getUserByRoleDao,
    createUserDao,
    updateUserDao,
} from './userDao.js';
import jest from 'jest-mock';
import { expect, describe, beforeEach, it  } from '@jest/globals';
import { Role, tableName } from '../../constants/index.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';
import {
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
  buildJoinQuery,
  buildInsertQuery,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';

jest.mock('../../utils/db.js', () => ({
  ...jest.requireActual('../../utils/db.js'), // keep all real exports
    buildSelectQuery: jest.fn(),
    buildUpdateQuery: jest.fn(),
    executeQuery: jest.fn(),
    buildJoinQuery: jest.fn(),
    buildInsertQuery: jest.fn(),
}));
jest.mock('../../utils/sockets.js', () => ({
  newTableEntry: jest.fn().mockResolvedValue(),
}));
jest.mock('../../utils/searchBuilder.js', () => ({
    buildSearchFilterObj: jest.fn(),
    }));
jest.mock('../../utils/logger.js', () => ({
    logger: { error: jest.fn() },
}));
describe('userDao', () => {
    beforeEach(() => {
        mockConn = {
        query: jest.fn(),
        };
    });
    it('getUsersDao: should work with (conn, filter, page, limit, sortBy, sortOrder)', async () => {
        const conn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1, user_name: 'Test User' }] }) };
        const filter = { company_id: 'company123' };
        const page = 1;
        const limit = 10;
        const sortBy = 'id';
        const sortOrder = 'ASC';
        buildSelectQuery.mockReturnValue('SELECT * FROM users WHERE company_id = $1 ORDER BY id ASC LIMIT 10 OFFSET 0');
        const result = await getUsersDao(conn, filter, page, limit, sortBy, sortOrder);
        expect(buildSelectQuery).toHaveBeenCalledWith({
            tableName: 'users',
            filter,
            page,
            limit,
            sortBy,
            sortOrder,
        });
        expect(result).toHaveProperty('rows');
        expect(result.rows[0].user_name).toBe('Test User');
    });
    it('should fetch users with default pagination and sorting', async () => {
        const conn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 2, user_name: 'Another User' }] }) };
        const filter = { role: Role.MERCHANT };
        buildSelectQuery.mockReturnValue('SELECT * FROM users WHERE role = $1 ORDER BY id DESC LIMIT 20 OFFSET 0');
        const result = await getUsersDao(conn, filter);
        expect(buildSelectQuery).toHaveBeenCalledWith({
            tableName: 'users',
            filter,
            page: 1,
            limit: 20,
            sortBy: 'id',
            sortOrder: 'DESC',
        });
        expect(result.rows[0].user_name).toBe('Another User');
    });
    it('should use executeQuery if conn is not provided', async () => {
        const filter = { designation_id: 5 };
        buildSelectQuery.mockReturnValue('SELECT * FROM users WHERE designation_id = $1 ORDER BY id DESC LIMIT 20 OFFSET 0');
        executeQuery.mockResolvedValue({ rows: [{ id: 3, user_name: 'Exec User' }] });
        const result = await getUsersDao(null, filter);
        expect(buildSelectQuery).toHaveBeenCalledWith({
            tableName: 'users',
            filter,
            page: 1,
            limit: 20,
            sortBy: 'id',
            sortOrder: 'DESC',
        });
        expect(executeQuery).toHaveBeenCalled();
        expect(result.rows[0].user_name).toBe('Exec User');
    });
    it('should log and throw error if query fails', async () => {
        const conn = { query: jest.fn().mockRejectedValue(new Error('DB error')) };
        const filter = { company_id: 'company123' };
        buildSelectQuery.mockReturnValue('SELECT * FROM users WHERE company_id = $1 ORDER BY id ASC LIMIT 10 OFFSET 0');
        await expect(getUsersDao(conn, filter)).rejects.toThrow('DB error');
        expect(logger.error).toHaveBeenCalledWith('Error in getUsersDao:', expect.any(Error));
    });
    it('getAllUsersDao: should work with (filter, page, limit, sortBy, sortOrder)', async () => {
        const filter = { company_id: 'company123' };
        const page = 1;
        const limit = 10;
        const sortBy = 'id';
        const sortOrder = 'ASC';
        buildSelectQuery.mockReturnValue('SELECT * FROM users WHERE company_id = $1 ORDER BY id ASC LIMIT 10 OFFSET 0');
        executeQuery.mockResolvedValue({ rows: [{ id: 1, user_name: 'Test User' }] });
        const result = await getAllUsersDao(filter, page, limit, sortBy, sortOrder);
        expect(buildSelectQuery).toHaveBeenCalledWith({
            tableName: 'users',
            filter,
            page,
            limit,
            sortBy,
            sortOrder,
        });
        expect(executeQuery).toHaveBeenCalled();
        expect(result.rows[0].user_name).toBe('Test User');
    });
    it('should fetch all users with default pagination and sorting', async () => {
        const filter = { role: Role.MERCHANT };
        buildSelectQuery.mockReturnValue('SELECT * FROM users WHERE role = $1 ORDER BY id DESC LIMIT 20 OFFSET 0');
        executeQuery.mockResolvedValue({ rows: [{ id: 2, user_name: 'Another User' }] });
        const result = await getAllUsersDao(filter);
        expect(buildSelectQuery).toHaveBeenCalledWith({
            tableName: 'users',
            filter,
            page: 1,
            limit: 20,
            sortBy: 'id',
            sortOrder: 'DESC',
        });
        expect(executeQuery).toHaveBeenCalled();
        expect(result.rows[0].user_name).toBe('Another User');
    });
    it('should log and throw error if query fails', async () => {
        const filter = { company_id: 'company123' };
        buildSelectQuery.mockReturnValue('SELECT * FROM users WHERE company_id = $1 ORDER BY id ASC LIMIT 10 OFFSET 0');
        executeQuery.mockRejectedValue(new Error('DB error'));
        await expect(getAllUsersDao(filter)).rejects.toThrow('DB error');
        expect(logger.error).toHaveBeenCalledWith('Error in getAllUsersDao:', expect.any(Error));
    });
    it('getUserByIdDao: should work with (id, conn)', async () => {
        const conn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1, user_name: 'Test User' }] }) };
        const userId = 1;
        buildSelectQuery.mockReturnValue('SELECT * FROM users WHERE id = $1');
        const result = await getUserByIdDao(userId, conn);
        expect(buildSelectQuery).toHaveBeenCalledWith({
            tableName: 'users',
            filter: { id: userId },
            page: null,
            limit: null,
            sortBy: null,
            sortOrder: null,
        });
        expect(result).toHaveProperty('rows');
        expect(result.rows[0].user_name).toBe('Test User');
    });
    it('should use executeQuery if conn is not provided', async () => {
        const userId = 2;
        buildSelectQuery.mockReturnValue('SELECT * FROM users WHERE id = $1');
        executeQuery.mockResolvedValue({ rows: [{ id: 2, user_name: 'Exec User' }] });
        const result = await getUserByIdDao(userId);
        expect(buildSelectQuery).toHaveBeenCalledWith({
            tableName: 'users',
            filter: { id: userId },
            page: null,
            limit: null,
            sortBy: null,
            sortOrder: null,
        });
        expect(executeQuery).toHaveBeenCalled();
        expect(result.rows[0].user_name).toBe('Exec User');
    });
    it('should log and throw error if query fails', async () => {
        const userId = 1;
        buildSelectQuery.mockReturnValue('SELECT * FROM users WHERE id = $1');
        executeQuery.mockRejectedValue(new Error('DB error'));
        await expect(getUserByIdDao(userId)).rejects.toThrow('DB error');
        expect(logger.error).toHaveBeenCalledWith('Error in getUserByIdDao:', expect.any(Error));
    });
    it('getUsersByUserNameDao: should work with (username, conn)', async () => {
        const conn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1, user_name: 'Test User' }] }) };
        const username = 'Test User';
        buildSelectQuery.mockReturnValue('SELECT * FROM users WHERE user_name = $1');
        const result = await getUsersByUserNameDao(username, conn);
        expect(buildSelectQuery).toHaveBeenCalledWith({
            tableName: 'users',
            filter: { user_name: username },
            page: null,
            limit: null,
            sortBy: null,
            sortOrder: null,
        });
        expect(result).toHaveProperty('rows');
        expect(result.rows[0].user_name).toBe('Test User');
    });
    it('should use executeQuery if conn is not provided', async () => {
        const username = 'Another User';
        buildSelectQuery.mockReturnValue('SELECT * FROM users WHERE user_name = $1');
        executeQuery.mockResolvedValue({ rows: [{ id: 2, user_name: 'Another User' }] });
        const result = await getUsersByUserNameDao(username);
        expect(buildSelectQuery).toHaveBeenCalledWith({
            tableName: 'users',
            filter: { user_name: username },
            page: null,
            limit: null,
            sortBy: null,
            sortOrder: null,
        });
        expect(executeQuery).toHaveBeenCalled();
        expect(result.rows[0].user_name).toBe('Another User');
    });
    it('should log and throw error if query fails', async () => {
        const username = 'Test User';
        buildSelectQuery.mockReturnValue('SELECT * FROM users WHERE user_name = $1');
        executeQuery.mockRejectedValue(new Error('DB error'));
        await expect(getUsersByUserNameDao(username)).rejects.toThrow('DB error');
        expect(logger.error).toHaveBeenCalledWith('Error in getUsersByUserNameDao:', expect.any(Error));
    });
    // Additional tests for other DAO functions can be added here following the same pattern
    it('createUserDao: should work with (conn, data)', async () => {
        const conn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1, user_name: 'New User' }] }) };
        const data = { user_name: 'New User', company_id: 'company123' };
        buildInsertQuery.mockReturnValue('INSERT INTO users (user_name, company_id) VALUES ($1, $2) RETURNING *');
        const result = await createUserDao(conn, data);
        expect(buildInsertQuery).toHaveBeenCalledWith({
            tableName: 'users',
            data,
        });
        expect(result).toHaveProperty('rows');
        expect(result.rows[0].user_name).toBe('New User');
    });
    it('should use executeQuery if conn is not provided', async () => {
        const data = { user_name: 'Exec User', company_id: 'company123' };
        buildInsertQuery.mockReturnValue('INSERT INTO users (user_name, company_id) VALUES ($1, $2) RETURNING *');
        executeQuery.mockResolvedValue({ rows: [{ id: 2, user_name: 'Exec User' }] });
        const result = await createUserDao(null, data);
        expect(buildInsertQuery).toHaveBeenCalledWith({
            tableName: 'users',
            data,
        });
        expect(executeQuery).toHaveBeenCalled();
        expect(result.rows[0].user_name).toBe('Exec User');
    });
    it('should log and throw error if query fails', async () => {
        const data = { user_name: 'New User', company_id: 'company123' };
        buildInsertQuery.mockReturnValue('INSERT INTO users (user_name, company_id) VALUES ($1, $2) RETURNING *');
        executeQuery.mockRejectedValue(new Error('DB error'));
        await expect(createUserDao(null, data)).rejects.toThrow('DB error');
        expect(logger.error).toHaveBeenCalledWith('Error in createUserDao:', expect.any(Error));
    });
    it('updateUserDao: should work with (conn, ids, data)', async () => {
        const conn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1, user_name: 'Updated User' }] }) };
        const ids = { id: 1 };
        const data = { user_name: 'Updated User' };
        buildUpdateQuery.mockReturnValue('UPDATE users SET user_name = $1 WHERE id = $2 RETURNING *');
        const result = await updateUserDao(conn, ids, data);
        expect(buildUpdateQuery).toHaveBeenCalledWith({
            tableName: 'users',
            ids,
            data,
        });
        expect(result).toHaveProperty('rows');
        expect(result.rows[0].user_name).toBe('Updated User');
    });
    it('should use executeQuery if conn is not provided', async () => {
        const ids = { id: 2 };
        const data = { user_name: 'Exec Updated User' };
        buildUpdateQuery.mockReturnValue('UPDATE users SET user_name = $1 WHERE id = $2 RETURNING *');
        executeQuery.mockResolvedValue({ rows: [{ id: 2, user_name: 'Exec Updated User' }] });
        const result = await updateUserDao(null, ids, data);
        expect(buildUpdateQuery).toHaveBeenCalledWith({
            tableName: 'users',
            ids,
            data,
        });
        expect(executeQuery).toHaveBeenCalled();
        expect(result.rows[0].user_name).toBe('Exec Updated User');
    });
    it('should log and throw error if query fails', async () => {
        const ids = { id: 1 };
        const data = { user_name: 'Updated User' };
        buildUpdateQuery.mockReturnValue('UPDATE users SET user_name = $1 WHERE id = $2 RETURNING *');
        executeQuery.mockRejectedValue(new Error('DB error'));
        await expect(updateUserDao(null, ids, data)).rejects.toThrow('DB error');
        expect(logger.error).toHaveBeenCalledWith('Error in updateUserDao:', expect.any(Error));
    });
});
//     it('getMerchantByUserIdDao: should handle errors from query', async () => {
//         const conn = { query: jest.fn().mockRejectedValue(new Error('DB error    ')) };
//         await expect(merchantDao.getMerchantByUserIdDao('user1', 'ADMIN', conn)).rejects.toThrow('DB error');
//     });
//     it('createMerchantDao: should handle errors from query', async () => {
//         const conn = { query: jest.fn().mockRejectedValue(new Error('DB error')) };
//         const data = { name: 'Test Merchant', code: 'TST' }; // Example data
//         await expect(merchantDao.createMerchantDao(data, conn)).rejects.toThrow('DB error');
//     });
//     it('getMerchantsDao: should handle errors from query', async () => {
//         const conn = { query: jest.fn().mockRejectedValue(new Error('DB error')) };
//         const filter = { company_id: 'company123' };
//         await expect(merchantDao.getMerchantsDao(filter, 1, 10, 'created_at', 'ASC', 'ADMIN', conn)).rejects.toThrow('DB error');
//     });
//     it('getMerchantsByCodeDao: should handle errors from query', async () => {
//         const conn = { query: jest.fn().mockRejectedValue(new Error('DB error')) };
//         await expect(merchantDao.getMerchantsByCodeDao('TST', conn)).rejects.toThrow('DB error');
//     });
//     it('getMerchantByCodeDao: should handle errors from query', async () => {
//         const conn = { query: jest.fn().mockRejectedValue(new Error('DB error')) };
//         await expect(merchantDao.getMerchantByCodeDao('TST', conn)).rejects.toThrow('DB error');
//     });
//     it('getAllMerchantsDao: should handle errors from query', async () => {
//         const conn = { query: jest.fn().mockRejectedValue(new Error('DB error')) };
//         const filter = { company_id: 'company123' };
//         await expect(merchantDao.getAllMerchantsDao(filter, 1, 10, 'created_at', 'ASC', 'ADMIN', conn)).rejects.toThrow('DB error');
//     });
//     it('getMerchantsBySearchDao: should handle errors from query', async () => {
//         const conn = { query: jest.fn().mockRejectedValue(new Error('DB error')) };
//         const filter = { company_id: 'company123' };
//         await expect(merchantDao.getMerchantsBySearchDao(filter, 1, 10, 'updated_at', 'ASC', 'ADMIN', ['Test'], conn)).rejects.toThrow('DB error');
//     });
//     it('updateMerchantDao: should handle errors from query', async () => {
//         const conn = { query: jest.fn().mockRejectedValue(new Error('DB error')) };
//         const ids = { id: 1 }; // Example ID
//         const data = { name: 'Updated Merchant' }; // Example data
//         await expect(merchantDao.updateMerchantDao(ids, data, conn)).rejects.toBegin('DB error');
//     });  
// });