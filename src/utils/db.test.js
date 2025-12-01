/**
 * @file db.utils.test.js
 *
 * Full test suite for db utils (getConnection, buildAndExecuteUpdateQuery, etc.)
 *
 * Notes:
 * - We mock 'pg' only ONCE (important).
 * - We mock logger and buildElasticSearch (not used directly but safe).
 * - We mock ../utils/db.js to replace pools & executeQuery with jest.fn(),
 *   but keep the real implementation for functions we want to test via
 *   jest.requireActual when needed (buildAndExecuteUpdateQuery).
 *
 * Run with: jest --detectOpenHandles --runInBand
 */

import { jest } from '@jest/globals';

// -----------------------------
// Mock 'pg' ONCE (single detailed mock)
// -----------------------------
jest.mock('pg', () => {
  const mockClient = { query: jest.fn(), release: jest.fn() };

  const mockPool = {
    connect: jest.fn().mockResolvedValue(mockClient),
    query: jest.fn(),
    end: jest.fn().mockResolvedValue(undefined),
    on: jest.fn((event, handler) => {
      // allow tests to simulate connect event if they care
      if (event === 'connect') {
        // don't call handler immediately here by default
        // tests can call mockPool.on.mock.calls if needed
      }
    }),
  };

  return {
    Pool: jest.fn(() => mockPool),
  };
});

// -----------------------------
// Other lightweight mocks
// -----------------------------
jest.mock('../utils/buildElasticSearch.js', () => ({
  buildESQuery: jest.fn(),
  buildInES: jest.fn(),
  updateInES: jest.fn(),
  deleteInES: jest.fn(),
  getIndexName: jest.fn(),
  setupIndexWithMappings: jest.fn(),
  bulkIndexFromPG: jest.fn(),
}));

jest.mock('../utils/logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

// -----------------------------
// Mock ../utils/db.js but keep REAL implementations where useful
// This mock must come BEFORE importing anything from ../utils/db.js
// -----------------------------
jest.mock('../utils/db.js', () => {
  const actual = jest.requireActual('../utils/db.js');

  // Replace the actual module's pool methods with jest.fn so the real functions
  // (which close over actual.writerPool/actual.readerPool) will call mockable functions.
  // Tests will override connect in beforeEach by assigning to the exported writerPool/readerPool.
  if (actual.writerPool) {
    actual.writerPool.connect = jest.fn();
    actual.writerPool.on = jest.fn();
    actual.writerPool.end = jest.fn();
  } else {
    actual.writerPool = { connect: jest.fn(), on: jest.fn(), end: jest.fn() };
  }

  if (actual.readerPool) {
    actual.readerPool.connect = jest.fn();
    actual.readerPool.on = jest.fn();
    actual.readerPool.end = jest.fn();
  } else {
    actual.readerPool = { connect: jest.fn(), on: jest.fn(), end: jest.fn() };
  }

  // Override the actual module's exported helper functions on the actual object itself
  // so that functions defined in the module (which close over these identifiers) will
  // call the mocked implementations during tests.
  actual.executeQuery = jest.fn();
  actual.beginTransaction = jest.fn();
  actual.commit = jest.fn();
  actual.rollback = jest.fn();
  actual.buildSelectQuery = jest.fn();
  actual.buildInsertQuery = jest.fn();
  actual.buildUpdateQuery = jest.fn();

  // Return the actual module object (possibly with some overrides) so tests can further
  // override methods like writerPool.connect in beforeEach.
  return {
    ...actual,
    // Export the same pool objects so tests can override their methods and the real code uses them
    writerPool: actual.writerPool,
    readerPool: actual.readerPool,
  };
});

// Now import the (mocked) db utilities
import {
  getConnection,
  readerPool,
  writerPool,
} from '../utils/db.js';

jest.useFakeTimers();

// Also import the (mocked) executeQuery so tests can assert calls
import { buildAndExecuteUpdateQuery, executeQuery } from '../utils/db.js';

describe('DB Utils - getConnection and buildAndExecuteUpdateQuery', () => {
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();

    // fresh mock client for each test
    mockClient = { query: jest.fn(), release: jest.fn() };

    // Ensure pools return this mock client by default
    writerPool.connect = jest.fn().mockResolvedValue(mockClient);
    readerPool.connect = jest.fn().mockResolvedValue(mockClient);

    // Make sure executeQuery mock is reset for tests that use real buildAndExecuteUpdateQuery
    if (executeQuery && executeQuery.mockClear) executeQuery.mockClear();
  });

  // -----------------------------
  // getConnection tests
  // -----------------------------
  it('returns client on success (writer)', async () => {
    const promise = getConnection('writer');
    // allow any timers (connection attempt shouldn't depend on timers, but keep for parity)
    jest.runAllTimers();
    const client = await promise;
    expect(client).toMatchObject({
      query: expect.any(Function),
      release: expect.any(Function),
    });
    expect(writerPool.connect).toHaveBeenCalledTimes(1);
  });

  it('retries once on first failure and then succeeds', async () => {
    writerPool.connect
      .mockRejectedValueOnce(new Error('DB down'))
      .mockResolvedValueOnce(mockClient);

    const promise = getConnection('writer');

    // advance fake timers so the retry backoff resolves (baseDelay is 2000 in implementation)
    await jest.advanceTimersByTimeAsync(2000);

    const client = await promise;
    expect(client).toBe(mockClient);
    expect(writerPool.connect).toHaveBeenCalledTimes(2);
  });

  it('logs error on first failure', async () => {
    writerPool.connect
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockResolvedValueOnce(mockClient);

    const promise = getConnection('writer');

    await jest.advanceTimersByTimeAsync(2000);

    await promise;

    const { logger } = require('../utils/logger.js');
    expect(logger.error).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('waits before retrying connection (delay check)', async () => {
    writerPool.connect
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce(mockClient);

    const promise = getConnection('writer');

    // first call should have been attempted immediately
    expect(writerPool.connect).toHaveBeenCalledTimes(1);

    // advance timers almost to delay boundary
    await jest.advanceTimersByTimeAsync(1999);
    expect(writerPool.connect).toHaveBeenCalledTimes(1);

    // step the last millisecond to trigger retry
    await jest.advanceTimersByTimeAsync(1);
    expect(writerPool.connect).toHaveBeenCalledTimes(2);

    await promise;
  });

  it('handles pool.connect returning a client without query function', async () => {
    const badClient = {};
    writerPool.connect.mockResolvedValueOnce(badClient);

    const promise = getConnection('writer');

    jest.runAllTimers();

    const client = await promise;
    expect(client).toBe(badClient);
  });

  it('verifies pool.connect called with correct context (writer)', async () => {
    const promise = getConnection('writer');
    jest.runAllTimers();
    await promise;

    expect(writerPool.connect).toHaveBeenCalled();
  });

  it('verifies pool.connect called with correct context (reader)', async () => {
    const promise = getConnection('reader');
    jest.runAllTimers();
    await promise;

    expect(readerPool.connect).toHaveBeenCalled();
  });

  // -----------------------------
  // buildAndExecuteUpdateQuery tests (using real implementation via requireActual)
  // We load the actual implementation inside each test via jest.requireActual
  // to avoid the overridden executeQuery mock interfering when we want the real function.
  // -----------------------------
  it('buildAndExecuteUpdateQuery should build correct SQL and execute client.query', async () => {
    // Use the actual module implementation
    const realDB = jest.requireActual('../utils/db.js');
    const realBuildAndExecute = realDB.buildAndExecuteUpdateQuery;

    const client = { query: jest.fn().mockResolvedValue({
      rows: [{ id: 123, column1: 'value1', column2: 'value2' }]
    }) };

    const tableName = 'test_table';
    const data = {
      column1: 'value1',
      column2: 'value2',
      config: { nested: 'abc' },
    };
    const where = { id: 123 };

    await realBuildAndExecute(
      tableName,
      data,
      where,
      {}, // specialFields
      { returnUpdated: true },
      client,
    );

    expect(client.query).toHaveBeenCalled();

    const [sql, params] = client.query.mock.calls[0];

    // Basic assertions: update statement, columns present, jsonb_set present and where clause
    expect(sql).toContain('UPDATE "test_table" SET');
    expect(sql).toContain('"column1" = $');
    expect(sql).toContain('"column2" = $');
    // For B1 style nested jsonb_set, jsonb_set should appear at least once
    expect(sql).toContain('jsonb_set');
    expect(sql).toContain('WHERE "id" = $');

    // params should include the scalar values and a JSON-stringified value for nested config,
    // and the final where id (123)
    expect(params).toEqual(
      expect.arrayContaining(['value1', 'value2', expect.any(String), 123])
    );
  });

  it('buildAndExecuteUpdateQuery supports arithmetic updates using specialFields', async () => {
    const realDB = jest.requireActual('../utils/db.js');
    const realBuildAndExecute = realDB.buildAndExecuteUpdateQuery;

    const client = { query: jest.fn().mockResolvedValue({
      rows: [{ id: 1, amount: 150 }]
    }) };

    const tableName = 'wallets';
    const data = { amount: 50, status: 'active' };
    const where = { id: 1 };
    const specialFields = { amount: '+' }; // amount = amount + $1

    await realBuildAndExecute(
      tableName,
      data,
      where,
      specialFields,
      { returnUpdated: true },
      client,
    );

    expect(client.query).toHaveBeenCalled();

    const [sql, params] = client.query.mock.calls[0];

    expect(sql).toContain(`"amount" = "amount" + $`);
    expect(sql).toContain(`"status" = $`);
    expect(sql).toContain(`WHERE "id" = $`);
    expect(params).toEqual(expect.arrayContaining([50, 'active', 1]));
  });

  it('buildAndExecuteUpdateQuery handles nested JSONB inside config (deep nested)', async () => {
    const realDB = jest.requireActual('../utils/db.js');
    const realBuildAndExecute = realDB.buildAndExecuteUpdateQuery;

    const client = { query: jest.fn().mockResolvedValue({
      rows: [{ id: 5 }]
    }) };

    const tableName = 'users';
    const data = {
      config: {
        settings: {
          theme: 'dark',
          limits: {
            max: 10,
          },
        },
      },
    };
    const where = { id: 5 };

    await realBuildAndExecute(
      tableName,
      data,
      where,
      {},
      { returnUpdated: true },
      client,
    );

    expect(client.query).toHaveBeenCalled();
    const [sql, params] = client.query.mock.calls[0];

    // For B1 we expect multiple jsonb_set calls nesting one into another
    expect(sql).toContain('jsonb_set(');
    // the path tokens should appear somewhere in the query
    expect(sql).toContain(`'{settings,theme}'`);
    expect(sql).toContain(`'{settings,limits,max}'`);

    // params include JSON-stringified values for "dark" and 10 and the where id
    expect(params).toEqual(
      expect.arrayContaining([
        JSON.stringify('dark'),
        JSON.stringify(10),
        5,
      ])
    );
  });

  it('throws an error when no rows are updated', async () => {
    const realDB = jest.requireActual('../utils/db.js');
    const realBuildAndExecute = realDB.buildAndExecuteUpdateQuery;

    const { logger } = require('../utils/logger.js');

    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    const tableName = 'users';
    const data = { status: 'inactive' };
    const where = { id: 999 };

    await expect(
      realBuildAndExecute(
        tableName,
        data,
        where,
        {},
        { returnUpdated: true },
        client,
      )
    ).rejects.toThrow('No rows updated');

    expect(logger.warn).toHaveBeenCalled();
  });

  it('does not include RETURNING clause when returnUpdated=false', async () => {
    const realDB = jest.requireActual('../utils/db.js');
    const realBuildAndExecute = realDB.buildAndExecuteUpdateQuery;

    const client = { query: jest.fn().mockResolvedValue({
      rows: [{ id: 10, status: 'active' }]
    }) };

    const tableName = 'accounts';
    const data = { status: 'active' };
    const where = { id: 10 };

    await realBuildAndExecute(
      tableName,
      data,
      where,
      {},
      { returnUpdated: false },
      client,
    );

    const [sql] = client.query.mock.calls[0];

    // SQL should NOT have RETURNING *
    expect(sql.includes('RETURNING')).toBe(false);

    expect(sql).toContain(`UPDATE "accounts" SET "status" = $1`);
  });

  it('uses default executeQuery when no connection is passed', async () => {
    // Here we want buildAndExecute to call the module's executeQuery (which is mocked at top)
    executeQuery.mockClear();
    executeQuery.mockResolvedValue({
      rows: [{ id: 20, status: 'done' }],
    });

    const result = await buildAndExecuteUpdateQuery(
      'tasks',
      { status: 'done' },
      { id: 20 },
      {},
      { returnUpdated: true },
    );

    // should have used mocked executeQuery
    expect(executeQuery).toHaveBeenCalledTimes(1);

    const [sql, params] = executeQuery.mock.calls[0];

    expect(sql).toContain(`UPDATE "tasks" SET "status" = $1`);
    expect(params).toEqual(['done', 20]);
    expect(result.rows).toEqual([{ id: 20, status: 'done' }]);
  });

  it('handles merchant_added merge logic inside config JSON', async () => {
    const realDB = jest.requireActual('../utils/db.js');
    const realBuildAndExecute = realDB.buildAndExecuteUpdateQuery;

    const client = { query: jest.fn().mockResolvedValue({
      rows: [{ id: 2 }]
    }) };

    const tableName = 'settings';
    const data = {
      config: {
        merchant_added: { flag: true },
        level: 2,
      },
    };
    const where = { id: 2 };

    await realBuildAndExecute(
      tableName,
      data,
      where,
      {},
      { returnUpdated: true },
      client,
    );

    const [sql, params] = client.query.mock.calls[0];

    // Expect some form of merge/ coalesce logic and merchant_added path
    expect(sql.toLowerCase()).toContain('coalesce');
    expect(sql).toContain('merchant_added');

    // parameters should include JSON merged object stringified and the scalar for level and final id
    expect(params).toEqual(
      expect.arrayContaining([
        JSON.stringify({ flag: true }),
        JSON.stringify(2),
        2,
      ])
    );
  });
});
