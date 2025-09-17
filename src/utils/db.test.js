import { jest } from '@jest/globals';
import { Pool } from 'pg';
import {
  getConnection,
  beginTransaction,
  commit,
  rollback,
  buildSelectQuery,
  buildInsertQuery,
  buildUpdateQuery,
  writerPool,
  readerPool,
} from '../utils/db.js';


jest.mock('pg'); // mock the entire pg module
jest.mock('../utils/logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.useFakeTimers(); // use fake timers for all tests

describe('DB Utils', () => {
  let mockPool, mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = { query: jest.fn(), release: jest.fn() };
    mockPool = { connect: jest.fn().mockResolvedValue(mockClient) };
    Pool.mockImplementation(() => mockPool);
  });

  describe('Transactions', () => {
    it('beginTransaction calls BEGIN', async () => {
      await beginTransaction(mockClient);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    });

    it('commit calls COMMIT', async () => {
      await commit(mockClient);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('rollback calls ROLLBACK', async () => {
      await rollback(mockClient);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('Query Builders', () => {
    it('buildSelectQuery works', () => {
      const [sql, values] = buildSelectQuery('SELECT * FROM User', { name: 'Alice' }, 1, 10);
      expect(sql).toContain('WHERE');
      expect(values).toContain('Alice');
    });

    it('buildInsertQuery works', () => {
      const [sql, values] = buildInsertQuery('User', { name: 'Alice' });
      expect(sql).toContain('INSERT');
      expect(values).toContain('Alice');
    });

    it('buildUpdateQuery works', () => {
      const [sql, values] = buildUpdateQuery('User', { age: 30 }, { id: 1 });
      expect(sql).toContain('UPDATE');
      expect(values).toContain(30);
      expect(values).toContain(1);
    });
  });
});

describe('DB Utils - getConnection', () => {
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = { query: jest.fn(), release: jest.fn() };

    // Override the real pools with mocks
    writerPool.connect = jest.fn().mockResolvedValue(mockClient);
    readerPool.connect = jest.fn().mockResolvedValue(mockClient);
  });

  it('returns client on success', async () => {
    const promise = getConnection('writer');

    // Fast-forward all timers (should be none for first success)
    jest.runAllTimers();

    const client = await promise;
    expect(client).toBe(mockClient);
    expect(writerPool.connect).toHaveBeenCalledTimes(1);
  });

  it('retries once on first failure and then succeeds', async () => {
    writerPool.connect
      .mockRejectedValueOnce(new Error('DB down'))
      .mockResolvedValueOnce(mockClient);

    const promise = getConnection('writer');

    // Advance timers for first retry (2s)
    await jest.advanceTimersByTimeAsync(2000);

    const client = await promise;
    expect(client).toBe(mockClient);
    expect(writerPool.connect).toHaveBeenCalledTimes(2);
  });

  // it('throws DbError after max retries', async () => {
  //   writerPool.connect.mockRejectedValue(new Error('Always fail'));

  //   const promise = getConnection('writer');
  //   await jest.advanceTimersByTimeAsync(2000 + 4000 + 8000 + 16000 + 32000);

  //   await expect(promise).rejects.toThrow(DbError);
  //   expect(writerPool.connect).toHaveBeenCalledTimes(5);
  // });
});
