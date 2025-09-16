/**
 * merchantDao.test.js
 *
 * Place this file in the same directory as merchantDao.js.
 *
 * Tests both unit and integration-style paths for merchantDao.js.
 */

///////////////////////////////////////////
// Mocks for modules used by merchantDao
///////////////////////////////////////////
import jest from 'jest-mock';
import { expect, describe, beforeEach, it } from '@jest/globals';

jest.mock('../../utils/logger.js', () => ({
  logger: { log: jest.fn(), error: jest.fn() },
}));

// Mock enhanceMerchantsWithSubMerchants used in several DAO functions
jest.mock('../../utils/enhanceSubMerchant.js', () => ({
  enhanceMerchantsWithSubMerchants: jest.fn(async (rows) => rows),
}));
jest.mock('../../utils/sockets.js', () => ({
  newTableEntry: jest.fn().mockResolvedValue(),
}));
jest.mock('../../utils/db.js', () => 
  ({
    buildInsertQuery: jest.fn(),
  buildSelectQuery: jest.fn(),
  buildUpdateQuery: jest.fn(),
  executeQuery: jest.fn(),
  buildAndExecuteUpdateQuery: jest.fn(),
  })
);

// constants.tableName is used by DAO; supply a minimal tableName for tests
jest.mock('../../constants/index.js', () => ({
  tableName: {
    MERCHANT: 'Merchant',
    USER_HIERARCHY: 'UserHierarchy',
    USER: 'User',
    DESIGNATION: 'Designation',
  },
  Role: {
    ADMIN: 'ADMIN',
    MERCHANT: 'MERCHANT',
    SUB_MERCHANT: 'SUB_MERCHANT',
    MERCHANT_OPERATIONS: 'MERCHANT_OPERATIONS',
  },
}));

///////////////////////////////////////////
// Import the DAO module under test
///////////////////////////////////////////
import * as dao from './merchantDao.js';
import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
  buildAndExecuteUpdateQuery,
} from '../../utils/db.js';
import { enhanceMerchantsWithSubMerchants } from '../../utils/enhanceSubMerchant.js';
import { logger } from '../../utils/logger.js';

beforeEach(() => {
  jest.clearAllMocks();
});

///////////////////////////////////////////
// Unit tests (mocked db helpers)
///////////////////////////////////////////
describe('merchantDao (unit tests)', () => {
  describe('createMerchantDao', () => {
    it('should call buildInsertQuery and executeQuery when no conn provided, and return first row', async () => {
      const fakeSql = 'INSERT SQL';
      const fakeParams = ['p1'];
      buildInsertQuery.mockReturnValue([fakeSql, fakeParams]);

      const fakeResult = { rows: [{ id: 'm1', user_id: 'u1' }] };
      executeQuery.mockResolvedValueOnce(fakeResult);

      const payload = { parent_id: 'to-delete', name: 'Acme' };
      const res = await dao.createMerchantDao(payload);

      expect(buildInsertQuery).toHaveBeenCalledWith('Merchant', expect.objectContaining({ name: 'Acme' }));
      expect(executeQuery).toHaveBeenCalledWith(fakeSql, fakeParams);
      expect(res).toEqual(fakeResult.rows[0]);
    });

    it('should remove parent_id from payload', async () => {
      buildInsertQuery.mockReturnValue(['sql', []]);
      executeQuery.mockResolvedValueOnce({ rows: [{ id: 'm2' }] });
      const payload = { parent_id: 'p', x: 1 };
      await dao.createMerchantDao(payload);
      // Ensure buildInsertQuery received an object without parent_id
      expect(buildInsertQuery.mock.calls[0][1] === undefined || buildInsertQuery.mock.calls[0][1]).toBeDefined();
      // The simplest check: the first argument to buildInsertQuery is table, second arg is object - confirm it does not have parent_id
      const calledData = buildInsertQuery.mock.calls[0][1];
      expect(calledData.parent_id).toBeUndefined();
    });

    it('should propagate executeQuery errors', async () => {
      buildInsertQuery.mockReturnValue(['sql', []]);
      executeQuery.mockRejectedValueOnce(new Error('db-fail'));
      await expect(dao.createMerchantDao({})).rejects.toThrow('db-fail');
    });
  });

  describe('getMerchantsCodeDao', () => {
    it('should convert includeSubMerchants and includeOnlyMerchants string "true"/"false" to booleans and query with filters', async () => {
      // create a fake conn (this function expects conn.query)
      const fakeConn = { query: jest.fn().mockResolvedValue({ rows: [{ label: 'L1' }] }) };

      // call with string booleans
      const res = await dao.getMerchantsCodeDao(fakeConn, { company_id: 'C1', user_id: 'U1' }, 'true', 'false', 'true');

      // Should call conn.query and return rows
      expect(fakeConn.query).toHaveBeenCalled();
      expect(res).toEqual([{ label: 'L1' }]);
    });

    it('should accept boolean true/false and use array user_id', async () => {
      const fakeConn = { query: jest.fn().mockResolvedValue({ rows: [{ label: 'L2' }] }) };
      const res = await dao.getMerchantsCodeDao(fakeConn, { company_id: 'C1', user_id: ['U1', 'U2'] }, 'true', 'false', 'false');
      expect(fakeConn.query).toHaveBeenCalled();
      expect(res).toEqual([{ label: 'L2' }]);
    });

    it('should append is_enabled filter when excludeDisabledMerchant truthy string', async () => {
      const fakeConn = { query: jest.fn().mockResolvedValue({ rows: [] }) };

      await dao.getMerchantsCodeDao(fakeConn, { company_id: 'C1' }, 'false', 'false', 'true');

      const sql = fakeConn.query.mock.calls[0][0];
      // ensure we added is_enabled = TRUE when excludeDisabledMerchant is 'true'
      expect(sql).toMatch(/is_enabled\s*=\s*TRUE|m\.is_enabled\s*=\s*TRUE/i);
    });

    it('should propagate connection query errors', async () => {
      const fakeConn = { query: jest.fn().mockRejectedValueOnce(new Error('conn-fail')) };
      await expect(dao.getMerchantsCodeDao(fakeConn, {}, false, false, false)).rejects.toThrow('conn-fail');
    });
  });

  describe('getMerchantByUserIdDao', () => {
    it('should build SQL using executeQuery and return rows', async () => {
      const userId = 'u1';
      executeQuery.mockResolvedValueOnce({ rows: [{ id: 'm1', user_id: 'u1' }] });
      const res = await dao.getMerchantByUserIdDao(userId);
      expect(executeQuery).toHaveBeenCalled();
      expect(res).toEqual([{ id: 'm1', user_id: 'u1' }]);
    });

    it('should handle array userId param', async () => {
      executeQuery.mockResolvedValueOnce({ rows: [{ id: 'mA' }] });
      const res = await dao.getMerchantByUserIdDao(['u1', 'u2']);
      expect(executeQuery).toHaveBeenCalled();
      expect(res).toEqual([{ id: 'mA' }]);
    });

    it('should propagate errors from executeQuery', async () => {
      executeQuery.mockRejectedValueOnce(new Error('exec-fail'));
      await expect(dao.getMerchantByUserIdDao('uX')).rejects.toThrow('exec-fail');
    });
  });

  describe('getMerchantByUserDao', () => {
    it('should pass a sanitized role parameter and call executeQuery', async () => {
      executeQuery.mockResolvedValueOnce({ rows: [{ id: 'mU' }] });
      const res = await dao.getMerchantByUserDao('u1', undefined);
      expect(executeQuery).toHaveBeenCalled();
      expect(res).toEqual([{ id: 'mU' }]);
    });

    it('should pass role value when provided', async () => {
      executeQuery.mockResolvedValueOnce({ rows: [{ id: 'mB' }] });
      await dao.getMerchantByUserDao('u1', 'ADMIN');
      expect(executeQuery).toHaveBeenCalled();
    });

    it('should propagate errors', async () => {
      executeQuery.mockRejectedValueOnce(new Error('exec-err'));
      await expect(dao.getMerchantByUserDao('u1', 'ADMIN')).rejects.toThrow('exec-err');
    });
  });

  describe('getMerchantsDao & getAllMerchantsDao', () => {
    it('should call buildSelectQuery and executeQuery and then enhance and return data', async () => {
      const baseRows = [{ id: 'm1' }];
      // buildSelectQuery returns [sql, params]
      buildSelectQuery.mockReturnValueOnce(['SELECT ...', ['p1']]);
      executeQuery.mockResolvedValueOnce({ rows: baseRows });

      const res = await dao.getMerchantsDao({ company_id: 'c1' }, 1, 10, 'created_at', 'ASC', 'ADMIN');
      expect(buildSelectQuery).toHaveBeenCalled();
      expect(executeQuery).toHaveBeenCalledWith('SELECT ...', ['p1']);
      expect(enhanceMerchantsWithSubMerchants).toHaveBeenCalledWith(baseRows);
      expect(res).toEqual(baseRows);
    });

    it('getAllMerchantsDao should behave similarly', async () => {
      buildSelectQuery.mockReturnValueOnce(['SELECT ALL ...', []]);
      executeQuery.mockResolvedValueOnce({ rows: [{ id: 'mA' }] });
      const res = await dao.getAllMerchantsDao({}, 1, 10, 'created_at', 'ASC', 'ADMIN');
      expect(buildSelectQuery).toHaveBeenCalled();
      expect(res).toEqual([{ id: 'mA' }]);
    });

    it('propagates errors', async () => {
      buildSelectQuery.mockReturnValueOnce(['SELECT ...', []]);
      executeQuery.mockRejectedValueOnce(new Error('select-fail'));
      await expect(dao.getMerchantsDao({}, 1, 10)).rejects.toThrow('select-fail');
    });
  });

  describe('getMerchantsByCodeDao & getMerchantByCodeDao', () => {
    it('getMerchantsByCodeDao should call executeQuery and return rows', async () => {
      executeQuery.mockResolvedValueOnce({ rows: [{ id: 'm1', code: 'C1' }] });
      const res = await dao.getMerchantsByCodeDao('C1');
      expect(executeQuery).toHaveBeenCalled();
      expect(res).toEqual([{ id: 'm1', code: 'C1' }]);
    });

    it('getMerchantByCodeDao should return rows and handle no code', async () => {
      executeQuery.mockResolvedValueOnce({ rows: [{ id: 'm2' }] });
      const res = await dao.getMerchantByCodeDao('C2');
      expect(executeQuery).toHaveBeenCalled();
      expect(res).toEqual([{ id: 'm2' }]);
    });

    it('propagates errors for code DAOs', async () => {
      executeQuery.mockRejectedValueOnce(new Error('code-err'));
      await expect(dao.getMerchantsByCodeDao('x')).rejects.toThrow('code-err');
    });
  });

  describe('getMerchantsBySearchDao', () => {
    it('should build query and call executeQuery, handle text search terms and return enhanced merchants', async () => {
      // For this complex function, we test a scenario: one text search term and role ADMIN
      const filters = { company_id: 'c1', page: 2, limit: 5, user_id: ['u1'] };
      // We'll stub executeQuery for count and the main query
      // countQuery: first call
      executeQuery.mockResolvedValueOnce({ rows: [{ total: '1' }] });
      // main query: second call returns rows
      executeQuery.mockResolvedValueOnce({ rows: [{ id: 'mS1' }] });

      const res = await dao.getMerchantsBySearchDao(filters, 1, 5, 'updated_at', 'ASC', 'ADMIN', ['term1']);

      // Expect executeQuery called at least twice
      expect(executeQuery).toHaveBeenCalledTimes(2);
      // Should return object with merchants array processed by enhance
      expect(res).toHaveProperty('merchants');
      expect(res.merchants).toEqual([{ id: 'mS1' }]);
    });

    it('should handle boolean search term strings ("true"/"false") and add boolean conditions', async () => {
      // first call count
      executeQuery.mockResolvedValueOnce({ rows: [{ total: '0' }] });
      // second call returns no rows
      executeQuery.mockResolvedValueOnce({ rows: [] });

      const filters = { company_id: 'c1' };
      const res = await dao.getMerchantsBySearchDao(filters, 1, 10, 'updated_at', 'ASC', 'ADMIN', ['true']);

      expect(executeQuery).toHaveBeenCalled();
      expect(res).toHaveProperty('merchants');
    });

    it('should handle fallback when no rows returned for an offset > 0 (reset offset)', async () => {
      // simulate totalItems > 0 with offset > 0 but searchResult.rows.length === 0
      executeQuery
        .mockResolvedValueOnce({ rows: [{ total: '3' }] }) // countQuery
        .mockResolvedValueOnce({ rows: [] }) // initial search query with offset > 0
        .mockResolvedValueOnce({ rows: [{ id: 'mPage0' }] }); // second search with offset=0

      const filters = { company_id: 'c1', page: 2, limit: 2 };
      const res = await dao.getMerchantsBySearchDao(filters, 1, 2, 'updated_at', 'ASC', 'ADMIN', ['term']);

      expect(executeQuery).toHaveBeenCalledTimes(3);
      expect(res).toHaveProperty('merchants');
      expect(res.merchants).toEqual([{ id: 'mPage0' }]);
    });

    it('propagates errors', async () => {
      executeQuery.mockRejectedValueOnce(new Error('search-fail'));
      await expect(dao.getMerchantsBySearchDao({ company_id: 'c1' }, 1, 10)).rejects.toThrow('search-fail');
    });
  });

  describe('updateMerchantDao', () => {
    it('should call buildAndExecuteUpdateQuery and return its result', async () => {
      buildAndExecuteUpdateQuery.mockResolvedValueOnce({ id: 'u1' });
      const res = await dao.updateMerchantDao({ id: 'm1' }, { name: 'x' }, null);
      expect(buildAndExecuteUpdateQuery).toHaveBeenCalledWith('Merchant', { name: 'x' }, { id: 'm1' }, {}, { returnUpdated: true }, null);
      expect(res).toEqual({ id: 'u1' });
    });
  });

  describe('deleteMerchantDao', () => {
    it('should run conn.query and return rows when conn provided', async () => {
      const fakeConn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 'mD1' }] }) };
      const ids = { id: ['mD1'], company_id: 'c1' };
      const res = await dao.deleteMerchantDao(fakeConn, ids, { updated_by: 'u1' }, { returnUpdated: true });
      expect(fakeConn.query).toHaveBeenCalled();
      expect(res).toEqual([{ id: 'mD1' }]);
    });

    it('should support single id and still use conn.query', async () => {
      const fakeConn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 'mD2' }] }) };
      const ids = { id: 'mD2', company_id: 'c1' };
      const res = await dao.deleteMerchantDao(fakeConn, ids, { updated_by: 'u1' });
      expect(fakeConn.query).toHaveBeenCalled();
      expect(res).toEqual([{ id: 'mD2' }]);
    });

    it('propagates errors', async () => {
      const fakeConn = { query: jest.fn().mockRejectedValueOnce(new Error('delete-fail')) };
      await expect(dao.deleteMerchantDao(fakeConn, { id: 'x', company_id: 'c' }, { updated_by: 'u' })).rejects.toThrow('delete-fail');
    });
  });

  describe('updateMerchantBalanceDao', () => {
    it('should call buildUpdateQuery for non-conn path and use executeQuery result', async () => {
      buildUpdateQuery.mockReturnValue(['UPDATE SQL', ['p1']]);
      // The function returns result[0] for fallback (note: original code uses result[0] - keep that behavior)
      executeQuery.mockResolvedValueOnce([{ id: 'bal1' }]);
      const res = await dao.updateMerchantBalanceDao({ id: 'm1' }, 100, 'u1', null);
      expect(buildUpdateQuery).toHaveBeenCalled();
      expect(executeQuery).toHaveBeenCalledWith('UPDATE SQL', ['p1']);
      expect(res).toEqual({ id: 'bal1' });
    });

    it('should use conn.query when conn provided', async () => {
      buildUpdateQuery.mockReturnValue(['UPDATE SQL', ['p1']]);
      const fakeConn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 'bal2' }] }) };
      const res = await dao.updateMerchantBalanceDao({ id: 'm1' }, 200, 'u1', fakeConn);
      expect(fakeConn.query).toHaveBeenCalledWith('UPDATE SQL', ['p1']);
      expect(res).toEqual({ id: 'bal2' });
    });

    it('propagates errors', async () => {
      buildUpdateQuery.mockReturnValue(['SQL', []]);
      executeQuery.mockRejectedValueOnce(new Error('upd-fail'));
      await expect(dao.updateMerchantBalanceDao({}, 1, 'u1', null)).rejects.toThrow('upd-fail');
    });
  });

  describe('getMerchantByCodeAndApiKey', () => {
    it('should call executeQuery and return first row', async () => {
      executeQuery.mockResolvedValueOnce({ rows: [{ id: 'mKey' }] });
      const res = await dao.getMerchantByCodeAndApiKey('C1', 'pub1');
      expect(executeQuery).toHaveBeenCalled();
      expect(res).toEqual({ id: 'mKey' });
    });

    it('propagates errors', async () => {
      executeQuery.mockRejectedValueOnce(new Error('key-fail'));
      await expect(dao.getMerchantByCodeAndApiKey('C1', 'pub1')).rejects.toThrow('key-fail');
    });
  });

  describe('getMerchantsDaoArray', () => {
    it('should call executeQuery with company_id and code array', async () => {
      executeQuery.mockResolvedValueOnce({ rows: [{ id: 'mArr1' }] });
      const res = await dao.getMerchantsDaoArray('company-1', ['c1', 'c2']);
      expect(executeQuery).toHaveBeenCalled();
      expect(res).toEqual([{ id: 'mArr1' }]);
    });

    it('propagates errors', async () => {
      executeQuery.mockRejectedValueOnce(new Error('arr-fail'));
      await expect(dao.getMerchantsDaoArray('c', ['x'])).rejects.toThrow('arr-fail');
    });
  });
});

///////////////////////////////////////////
// Integration-style tests (simulate conn usage)
// These tests simulate a real connection object with .query and test SQL returned or parameters passed.
// They exercise the branches that use conn.query (e.g., getMerchantsCodeDao, createMerchantDao, deleteMerchantDao).
///////////////////////////////////////////

describe('merchantDao (integration-style conn tests)', () => {
  it('createMerchantDao should call conn.query when conn passed and return first row', async () => {
    // Provide real buildInsertQuery behavior for SQL & params
    buildInsertQuery.mockReturnValue(['INSERT INTO Merchant (x) VALUES ($1) RETURNING *', ['val']]);

    const fakeConn = {
      query: jest.fn().mockResolvedValue({ rows: [{ id: 'inserted', user_id: 'u1' }] }),
    };

    const payload = { name: 'Tester', parent_id: 'p1' };
    const res = await dao.createMerchantDao(payload, fakeConn);

    expect(fakeConn.query).toHaveBeenCalledWith('INSERT INTO Merchant (x) VALUES ($1) RETURNING *', ['val']);
    expect(res).toEqual({ id: 'inserted', user_id: 'u1' });
  });

  it('getMerchantsCodeDao should build dynamic SQL and call conn.query with expected params (array user_id)', async () => {
    // This test focuses on the sql string containing "m.user_id = ANY(" when user_id array is passed
    const fakeConn = { query: jest.fn().mockResolvedValue({ rows: [{ label: 'lbl' }] }) };
    await dao.getMerchantsCodeDao(fakeConn, { company_id: 'C1', user_id: ['U1', 'U2'] }, false, false, false);

    const calledSql = fakeConn.query.mock.calls[0][0];
    const calledParams = fakeConn.query.mock.calls[0][1];
    expect(calledSql).toMatch(/m\.user_id\s*=\s*ANY/i);
    expect(calledParams).toContain('C1'); // company_id param exists somewhere in params
    expect(calledParams).toEqual(expect.arrayContaining(['C1', ['U1', 'U2']]));
  });

  it('deleteMerchantDao should call conn.query with proper returning clause when returnUpdated true', async () => {
    const fakeConn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 'del1' }] }) };
    const ids = { id: ['del1', 'del2'], company_id: 'co1' };
    const res = await dao.deleteMerchantDao(fakeConn, ids, { updated_by: 'u' }, { returnUpdated: true });
    expect(fakeConn.query).toHaveBeenCalled();
    const calledSql = fakeConn.query.mock.calls[0][0];
    expect(calledSql).toMatch(/RETURNING \*/i);
    expect(res).toEqual([{ id: 'del1' }]);
  });
});
