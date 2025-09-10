import pkg from 'pg';
import * as dbUtils from './db.js';
import { logger } from './logger.js';
import { DbError } from './appErrors.js';

jest.mock('./logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('pg', () => {
  const mClient = { query: jest.fn(), release: jest.fn() };
  const mPool = {
    connect: jest.fn().mockResolvedValue(mClient),
    query: jest.fn(),
    on: jest.fn(), // <-- add this
    end: jest.fn().mockResolvedValue(true), // also mock end if closePool is tested
  };
  return { Pool: jest.fn(() => mPool) };
});


describe('Database Utilities', () => {
  let pool;
  beforeEach(() => {
    jest.clearAllMocks();
    pool = new pkg.Pool();
  });

  describe('getConnection', () => {
    it('should return a client from writerPool', async () => {
      const client = await dbUtils.getConnection('writer');
      expect(client.query).toBeDefined();
      expect(client.release).toBeDefined();
    });

    it('should retry on connection failure and throw DbError', async () => {
      pool.connect.mockRejectedValueOnce(new Error('fail'));
      await expect(dbUtils.getConnection('writer')).rejects.toThrow(DbError);
    });
  });

  describe('transactionWrapper', () => {
    it('should commit transaction when no error occurs', async () => {
      const fn = jest.fn().mockResolvedValue('data');
      const wrapped = dbUtils.transactionWrapper(fn);
      const result = await wrapped();
      expect(result).toBe('data');
      expect(logger.info).toHaveBeenCalledWith('Releasing connection');
    });

    it('should rollback transaction on error', async () => {
      const errorFn = jest.fn().mockRejectedValue(new Error('fail'));
      const wrapped = dbUtils.transactionWrapper(errorFn);
      await expect(wrapped()).rejects.toThrow('fail');
      expect(logger.error).toHaveBeenCalledWith(
        'Transaction rolled back due to error:',
        expect.any(Error),
      );
    });
  });

  describe('buildJoinQuery', () => {
    it('should build correct SQL for joins', () => {
      const sql = dbUtils.buildJoinQuery('Merchant', '*', [
        { table: 'User', keys: 'user_id', columns: ['first_name'] },
      ]);
      expect(sql).toContain('SELECT "Merchant".*');
      expect(sql).toContain('JOIN "User" ON "Merchant".user_id = "User".user_id');
    });
  });

  describe('buildFilterConditions', () => {
    it('should return correct conditions and params', () => {
      const filters = { status: 'active', type: 'admin' };
      const fieldMap = { status: 'status', type: 'role_type' };
      const { conditions, params } = dbUtils.buildFilterConditions(filters, fieldMap);
      expect(conditions).toEqual(['status = $1', 'role_type = $2']);
      expect(params).toEqual(['active', 'admin']);
    });
  });

  describe('executePaginatedQuery', () => {
    it('should call executeQuery with limit and offset', async () => {
      const baseQuery = 'SELECT * FROM test';
      const countQuery = 'SELECT COUNT(*) as total FROM test';
      jest.spyOn(dbUtils, 'executeQuery')
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ total: 1 }] });

      const result = await dbUtils.executePaginatedQuery({ baseQuery, countQuery, page: 1, limit: 10 });
      expect(result.rows).toEqual([{ id: 1 }]);
      expect(result.totalCount).toBe(1);
    });
  });
});
