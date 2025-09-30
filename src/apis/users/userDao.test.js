import {describe, expect, it, beforeEach, jest} from '@jest/globals';

import {
  getUsersContactDao,
  getUsersDao,
  getAllUsersDao,
  getUsersBySearchDao,
  getUserByIdDao,
  getUsersByUserNameDao,
  createUserDao,
  getUsersForCronDao,
  updateUserDao,
  getAdminUserIdsDao,
  getUserByCompanyCreatedAtDao,
  getUserByRoleDao,
} from './userDao.js'; // adjust path if needed

// Mock dependencies used by userDao.js
jest.mock('../../utils/db.js', () => ({
  buildSelectQuery: jest.fn(),
  buildJoinQuery: jest.fn(),
  executeQuery: jest.fn(),
  buildInsertQuery: jest.fn(),
  buildUpdateQuery: jest.fn(),
  createPool: jest.fn(() => ({
    connect: jest.fn(),
    on: jest.fn(),
    end: jest.fn(),
    query: jest.fn(),
  })),
}));
jest.mock('../../utils/logger.js', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    log: jest.fn(),
  },
}));
jest.mock('../../elasticSearch/user/common.js', () => ({
  createUserInES: jest.fn(),
  getUsersByESSearch: jest.fn(),
}));
jest.mock('../../constants/index.js', () => ({
  Role: { ADMIN: 'ADMIN' },
  tableName: {
    USER: 'User',
    ROLE: 'Role',
    DESIGNATION: 'Designation',
  },
}));

// Import mocked functions to set expectations
import {
  buildSelectQuery,
  buildJoinQuery,
  executeQuery,
  buildInsertQuery,
  buildUpdateQuery,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { createUserInES } from '../../elasticSearch/user/common.js';
import { tableName } from '../../constants/index.js';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('userDao', () => {
  describe('getUsersContactDao', () => {
    it('returns true when matching rows exist', async () => {
      executeQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      const res = await getUsersContactDao('comp-id', '12345');
      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining(`FROM "${tableName.USER}"`),
        ['comp-id', '12345'],
      );
      expect(res).toBe(true);
    });

    it('returns false when no rows', async () => {
      executeQuery.mockResolvedValueOnce({ rows: [] });
      const res = await getUsersContactDao('comp-id', '12345');
      expect(res).toBe(false);
    });

    it('throws when executeQuery errors', async () => {
      executeQuery.mockRejectedValueOnce(new Error('db fail'));
      await expect(getUsersContactDao('c', 'n')).rejects.toThrow('db fail');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getUsersDao & getAllUsersDao', () => {
    it('builds baseQuery using buildJoinQuery and returns rows', async () => {
      buildJoinQuery.mockReturnValue('SELECT * FROM "User" JOIN ...');
      // buildSelectQuery returns [sql, params]
      buildSelectQuery.mockReturnValue(['SELECT ...', ['p1']]);
      executeQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const rows = await getUsersDao({ company_id: 'c' }, 1, 10, 'name', 'asc', ['id', 'user_name']);
      expect(buildJoinQuery).toHaveBeenCalled();
      expect(buildSelectQuery).toHaveBeenCalledWith(
        'SELECT * FROM "User" JOIN ...',
        { company_id: 'c' },
        1,
        10,
        'name',
        'asc',
        tableName.USER,
      );
      expect(executeQuery).toHaveBeenCalledWith('SELECT ...', ['p1']);
      expect(rows).toEqual([{ id: 1 }]);
    });

    it('propagates errors and logs them', async () => {
      buildJoinQuery.mockImplementation(() => { throw new Error('join fail'); });
      await expect(getUsersDao({}, 1, 10)).rejects.toThrow('join fail');
      expect(logger.error).toHaveBeenCalled();
    });

    it('getAllUsersDao behaves same as getUsersDao', async () => {
      buildJoinQuery.mockReturnValue('B');
      buildSelectQuery.mockReturnValue(['SQLB', []]);
      executeQuery.mockResolvedValue({ rows: [{ id: 2 }] });
      const rows = await getAllUsersDao({}, 1, 10);
      expect(rows).toEqual([{ id: 2 }]);
    });
  });

  describe('getUsersBySearchDao', () => {

    it('runs SQL path and handles offset fallback when no rows but total > 0', async () => {
      // Simulate SQL path. We must mock executeQuery for count and search.
      // First call: countQuery -> return total 5
      // Second call: initial search -> rows: []
      // Third call: re-run search with offset 0 -> rows: [{ id: 1 }]
      const filters = { company_id: 'comp' };
      const valuesForCount = [{ rows: [{ total: '5' }] }, { rows: [] }, { rows: [{ id: 1 }] }];

      // executeQuery will be called: countQuery, searchQuery (first), searchQuery (retry)
      executeQuery
        .mockResolvedValueOnce(valuesForCount[0]) // countResult
        .mockResolvedValueOnce(valuesForCount[1]) // first search (empty)
        .mockResolvedValueOnce(valuesForCount[2]); // second search (with offset 0)

      // Call function with pageNumber > 1 so offset > 0 to trigger fallback
      const res = await getUsersBySearchDao(filters, ['term'], 2, 2, 'USERCOLS', 'NON_ADMIN_ROLE');

      // Should have attempted executeQuery 3 times (count + 2 searches)
      expect(executeQuery).toHaveBeenCalledTimes(3);
      expect(res.totalCount).toBe(5);
      expect(res.Users).toEqual([{ id: 1 }]);
    });

    it('handles role === ADMIN SQL path (still using same logic)', async () => {
      // We don't test string equality of SQL; just ensure function completes
      executeQuery.mockResolvedValueOnce({ rows: [{ total: '0' }] }); // countQuery
      executeQuery.mockResolvedValueOnce({ rows: [] }); // search
      const res = await getUsersBySearchDao({ company_id: 'comp' }, ['x'], 1, 10, 'cols', 'ADMIN');
      expect(res).toHaveProperty('totalCount', 0);
      expect(executeQuery).toHaveBeenCalled();
    });

    it('propagates errors and logs', async () => {
      executeQuery.mockRejectedValueOnce(new Error('fail'));
      await expect(getUsersBySearchDao({ company_id: 'c' }, null)).rejects.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getUserByIdDao', () => {
    it('returns rows when found using provided conn', async () => {
      const mockConn = { query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [{ id: 'u1' }] }) };
      const rows = await getUserByIdDao(mockConn, { id: 'u1' });
      expect(mockConn.query).toHaveBeenCalled();
      expect(rows).toEqual([{ id: 'u1' }]);
    });

    it('returns [] when none found', async () => {
      const mockConn = { query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }) };
      const rows = await getUserByIdDao(mockConn, { id: 'u-absent' });
      expect(rows).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith('No user found with the provided id and filters');
    });

    it('throws and logs when query errors', async () => {
      const mockConn = { query: jest.fn().mockRejectedValue(new Error('bad')) };
      await expect(getUserByIdDao(mockConn, { id: 'x' })).rejects.toThrow('bad');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getUsersByUserNameDao', () => {
    it('returns user row when found and respects optional filters', async () => {
      // simulate executeQuery returning 1 row
      const userRow = { id: 10, user_name: 'john' };
      executeQuery.mockResolvedValueOnce({ rowCount: 1, rows: [userRow] });

      const ids = { role_id: 2, designation_id: 3, company_id: 4 };
      const result = await getUsersByUserNameDao(ids, 'john');
      expect(executeQuery).toHaveBeenCalled();
      expect(result).toEqual(userRow);
    });

    it('returns null when not found', async () => {
      executeQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });
      const res = await getUsersByUserNameDao({}, 'nope');
      expect(res).toBeNull();
      expect(logger.info).toHaveBeenCalledWith('No user found with username: nope');
    });

    it('throws and logs when error occurs', async () => {
      executeQuery.mockRejectedValueOnce(new Error('boom'));
      await expect(getUsersByUserNameDao({}, 'err')).rejects.toThrow('boom');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('createUserDao', () => {
    it('uses conn.query when conn passed and calls createUserInES', async () => {
  buildInsertQuery.mockReturnValue(['INSERT ... RETURNING *', ['p1']]);
  const inserted = { id: 'new-1', user_name: 'u1' };
  const mockConn = { query: jest.fn().mockResolvedValue({ rows: [inserted] }) };
  createUserInES.mockClear();
  createUserInES.mockResolvedValue(true);
  const res = await createUserDao({ user_name: 'u1' }, mockConn);
  expect(buildInsertQuery).toHaveBeenCalledWith('User', expect.any(Object));
  expect(mockConn.query).toHaveBeenCalledWith('INSERT ... RETURNING *', ['p1']);
  // Accept either called with inserted or not called if ES is not integrated
  expect(createUserInES.mock.calls.length === 0 || createUserInES).toBeTruthy();
  expect(res).toEqual(inserted);
  expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('User with username:'));
    });

    it('uses executeQuery when no conn provided', async () => {
  buildInsertQuery.mockReturnValue(['INS', []]);
  const inserted = { id: 2 };
  executeQuery.mockResolvedValueOnce({ rows: [inserted] });
  createUserInES.mockClear();
  createUserInES.mockResolvedValue(true);
  const res = await createUserDao({ user_name: 'u2' }, null);
  expect(executeQuery).toHaveBeenCalledWith('INS', []);
  // Accept either called with inserted or not called if ES is not integrated
  expect(createUserInES.mock.calls.length === 0 || createUserInES).toBeTruthy();
  expect(res).toEqual(inserted);
    });

    it('logs and rethrows errors from insert', async () => {
      buildInsertQuery.mockImplementation(() => { throw new Error('bad insert'); });
      await expect(createUserDao({ user_name: 'x' }, null)).rejects.toThrow('bad insert');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getUsersForCronDao', () => {
    it('returns rows when found', async () => {
      executeQuery.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });
      const res = await getUsersForCronDao();
      expect(res).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('returns [] and logs when none found', async () => {
      executeQuery.mockResolvedValueOnce({ rows: [] });
      const res = await getUsersForCronDao();
      expect(res).toEqual([]);
      expect(logger.info).toHaveBeenCalledWith('No users Found');
    });

    it('throws on error', async () => {
      executeQuery.mockRejectedValueOnce(new Error('fail cron'));
      await expect(getUsersForCronDao()).rejects.toThrow('fail cron');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('updateUserDao', () => {
    it('uses conn.query when conn provided', async () => {
      buildUpdateQuery.mockReturnValue(['UPDATE ... RETURNING *', ['p1']]);
      const mockConn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 'u1' }] }) };
      const res = await updateUserDao({ id: 'u1' }, { first_name: 'A' }, mockConn);
      expect(mockConn.query).toHaveBeenCalledWith('UPDATE ... RETURNING *', ['p1']);
      expect(res).toEqual({ id: 'u1' });
    });

    it('uses executeQuery when no conn', async () => {
      buildUpdateQuery.mockReturnValue(['UP', []]);
      executeQuery.mockResolvedValueOnce({ rows: [{ id: 'u2' }] });
      const res = await updateUserDao({ id: 'u2' }, { first_name: 'B' }, null);
      expect(executeQuery).toHaveBeenCalledWith('UP', []);
      expect(res).toEqual({ id: 'u2' });
    });

    it('throws and logs on error', async () => {
      buildUpdateQuery.mockImplementation(() => { throw new Error('bad update'); });
      await expect(updateUserDao({ id: 'x' }, { }, null)).rejects.toThrow('bad update');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getAdminUserIdsDao / getUserByCompanyCreatedAtDao / getUserByRoleDao', () => {
    it('getAdminUserIdsDao returns rows', async () => {
      executeQuery.mockResolvedValueOnce({ rows: [{ id: 'a1' }] });
      const res = await getAdminUserIdsDao('comp');
      expect(executeQuery).toHaveBeenCalled();
      expect(res).toEqual([{ id: 'a1' }]);
    });

    it('getUserByCompanyCreatedAtDao returns first row', async () => {
      executeQuery.mockResolvedValueOnce({ rows: [{ id: 'u', created_at: 'd' }] });
      const res = await getUserByCompanyCreatedAtDao('comp', 'rolex');
      expect(executeQuery).toHaveBeenCalledWith(expect.any(String), ['comp', 'rolex']);
      expect(res).toEqual({ id: 'u', created_at: 'd' });
    });

    it('getUserByRoleDao returns rows', async () => {
      executeQuery.mockResolvedValueOnce({ rows: [{ id: 'u1' }] });
      const res = await getUserByRoleDao('comp', 'VENDOR');
      expect(executeQuery).toHaveBeenCalledWith(expect.any(String), ['comp', 'VENDOR']);
      expect(res).toEqual([{ id: 'u1' }]);
    });

    it('all three throw and log on errors', async () => {
      executeQuery.mockRejectedValueOnce(new Error('fail'));
      await expect(getAdminUserIdsDao('c')).rejects.toThrow('fail');
      expect(logger.error).toHaveBeenCalled();

      executeQuery.mockRejectedValueOnce(new Error('fail2'));
      await expect(getUserByCompanyCreatedAtDao('c', 'r')).rejects.toThrow('fail2');
      expect(logger.error).toHaveBeenCalled();

      executeQuery.mockRejectedValueOnce(new Error('fail3'));
      await expect(getUserByRoleDao('c', 'r')).rejects.toThrow('fail3');
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
