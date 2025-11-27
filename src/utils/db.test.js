import { jest } from '@jest/globals';

// ✅ mock pg first (before db.js gets imported)

jest.mock('pg', () => {
  return {
    Pool: jest.fn(),
  };
});
jest.mock('../utils/buildElasticSearch.js', () => ({
  buildESQuery: jest.fn(),
  buildInES: jest.fn(),
  updateInES: jest.fn(),
  deleteInES: jest.fn(),
  getIndexName: jest.fn(),
  setupIndexWithMappings: jest.fn(),
  bulkIndexFromPG: jest.fn(),
}));

jest.mock('pg', () => {
  const mockClient = { query: jest.fn(), release: jest.fn() };

  const mockPool = {
    connect: jest.fn().mockResolvedValue(mockClient),
    query: jest.fn(),
    on: jest.fn((event, handler) => {
      if (event === 'connect') {
        handler(mockClient); // simulate the connect event
      }
    }),
  };

  return {
    Pool: jest.fn(() => mockPool),
  };
});




jest.mock('../utils/logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import {
  getConnection,
  readerPool,
  writerPool,
} from '../utils/db.js';

jest.useFakeTimers();

jest.mock('../utils/db.js', () => {
  const actual = jest.requireActual('../utils/db.js');
  return {
    ...actual,            // <-- keeps the REAL function
    executeQuery: jest.fn(), 
    getConnection: jest.fn(),
    beginTransaction: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    buildSelectQuery: jest.fn(),
    buildInsertQuery: jest.fn(),
    buildUpdateQuery: jest.fn(),
    writerPool: { connect: jest.fn(), on: jest.fn() }, // <-- add on here too
    readerPool: { connect: jest.fn(), on: jest.fn() }, // <-- and here
  };
});
import { buildAndExecuteUpdateQuery, executeQuery } from '../utils/db.js';


describe('DB Utils - getConnection', () => {
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = { query: jest.fn(), release: jest.fn() };

    // Override pools with mocks
    writerPool.connect = jest.fn().mockResolvedValue(mockClient);
    readerPool.connect = jest.fn().mockResolvedValue(mockClient);
  });

  it('returns client on success', async () => {
    const promise = getConnection('writer');
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
  });

  it('waits before retrying connection (delay check)', async () => {
    writerPool.connect
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce(mockClient);

    const promise = getConnection('writer');

    expect(writerPool.connect).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1999);
    expect(writerPool.connect).toHaveBeenCalledTimes(1);

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
  it("buildAndExecuteUpdateQuery should build correct SQL and execute client.query", async () => {
    // Get ACTUAL function (because your mock setup mocks it)
    const realDB = jest.requireActual('../utils/db.js');
    const buildAndExecuteUpdateQuery = realDB.buildAndExecuteUpdateQuery;

    const mockClient = { query: jest.fn().mockResolvedValue({
      rows: [{ id: 123, column1: 'value1', column2: 'value2' }]
    })};

    const tableName = 'test_table';
    const data = { 
      column1: 'value1', 
      column2: 'value2',
      config: { nested: "abc" }
    };
    const where = { id: 123 };

    // Execute the real function
    await buildAndExecuteUpdateQuery(
      tableName,
      data,
      where,
      {},                  // specialFields
      { returnUpdated: true },
      mockClient           // connection
    );

    // Expect query to be called
    expect(mockClient.query).toHaveBeenCalled();

    // Extract what was called
    const [sql, params] = mockClient.query.mock.calls[0];

    // Assert SQL contains essential parts
    expect(sql).toContain('UPDATE "test_table" SET');
    expect(sql).toContain('"column1" = $'); 
    expect(sql).toContain('"column2" = $');
    expect(sql).toContain('"config" = jsonb_set'); 
    expect(sql).toContain('WHERE "id" = $');

    // Assert params array contains update values
    expect(params).toEqual(
      expect.arrayContaining(['value1', 'value2', expect.any(String), 123])
    );
  });
  it("buildAndExecuteUpdateQuery supports arithmetic updates using specialFields", async () => {
    const realDB = jest.requireActual('../utils/db.js');
    const buildAndExecuteUpdateQuery = realDB.buildAndExecuteUpdateQuery;

    const mockClient = { query: jest.fn().mockResolvedValue({
      rows: [{ id: 1, amount: 150 }]
    })};

    const tableName = "wallets";
    const data = { amount: 50, status: "active" };
    const where = { id: 1 };
    const specialFields = { amount: "+" };  // perform amount = amount + $1

    await buildAndExecuteUpdateQuery(
      tableName,
      data,
      where,
      specialFields,
      { returnUpdated: true },
      mockClient
    );

    expect(mockClient.query).toHaveBeenCalled();

    const [sql, params] = mockClient.query.mock.calls[0];

    expect(sql).toContain(`"amount" = "amount" + $`);
    expect(sql).toContain(`"status" = $`);
    expect(sql).toContain(`WHERE "id" = $`);

    expect(params).toEqual(expect.arrayContaining([50, "active", 1]));
  });
  it("buildAndExecuteUpdateQuery handles nested JSONB inside config", async () => {
    const realDB = jest.requireActual('../utils/db.js');
    const buildAndExecuteUpdateQuery = realDB.buildAndExecuteUpdateQuery;

    const mockClient = { query: jest.fn().mockResolvedValue({
      rows: [{ id: 5 }]
    })};

    const tableName = "users";

    const data = {
      config: {
        settings: {
          theme: "dark",
          limits: {
            max: 10,
          }
        }
      }
    };

    const where = { id: 5 };

    await buildAndExecuteUpdateQuery(
      tableName,
      data,
      where,
      {},
      { returnUpdated: true },
      mockClient
    );

    expect(mockClient.query).toHaveBeenCalled();

    const [sql, params] = mockClient.query.mock.calls[0];

    // Verify nested JSON paths
    expect(sql).toContain(`jsonb_set(`);
    expect(sql).toContain(`'{settings,theme}'`);
    expect(sql).toContain(`'{settings,limits,max}'`);

    // params contain JSON-stringified values
    expect(params).toEqual(
      expect.arrayContaining([
        JSON.stringify("dark"),
        JSON.stringify(10),
        5
      ])
    );
  });
  it("throws an error when no rows are updated", async () => {
    const realDB = jest.requireActual('../utils/db.js');
    const buildAndExecuteUpdateQuery = realDB.buildAndExecuteUpdateQuery;

    const { logger } = require('../utils/logger.js');

    const mockClient = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    const tableName = "users";
    const data = { status: "inactive" };
    const where = { id: 999 };

    await expect(
      buildAndExecuteUpdateQuery(
        tableName,
        data,
        where,
        {},
        { returnUpdated: true },
        mockClient
      )
    ).rejects.toThrow("No rows updated");

    expect(logger.warn).toHaveBeenCalled();
  });
  it("does not include RETURNING clause when returnUpdated=false", async () => {
    const realDB = jest.requireActual('../utils/db.js');
    const buildAndExecuteUpdateQuery = realDB.buildAndExecuteUpdateQuery;

    const mockClient = { query: jest.fn().mockResolvedValue({
      rows: [{ id: 10, status: "active" }]
    })};

    const tableName = "accounts";
    const data = { status: "active" };
    const where = { id: 10 };

    await buildAndExecuteUpdateQuery(
      tableName,
      data,
      where,
      {},
      { returnUpdated: false },
      mockClient
    );

    const [sql] = mockClient.query.mock.calls[0];

    // SQL should NOT have RETURNING *
    expect(sql.includes("RETURNING")).toBe(false);

    expect(sql).toContain(`UPDATE "accounts" SET "status" = $1`);
  });
  it("uses default executeQuery when no connection is passed", async () => {

    executeQuery.mockClear();
    executeQuery.mockResolvedValue({
      rows: [{ id: 20, status: "done" }]
    });

    const result = await buildAndExecuteUpdateQuery(
      "tasks",
      { status: "done" },
      { id: 20 },
      {},
      { returnUpdated: true },
    );

    expect(executeQuery).toHaveBeenCalledTimes(1);

    const [sql, params] = executeQuery.mock.calls[0];

    expect(sql).toContain(`UPDATE "tasks" SET "status" = $1`);
    expect(params).toEqual(["done", 20]);
    expect(result.rows).toEqual([{ id: 20, status: "done" }]);
  });
  it("handles merchant_added merge logic inside config JSON", async () => {
    const realDB = jest.requireActual('../utils/db.js');
    const buildAndExecuteUpdateQuery = realDB.buildAndExecuteUpdateQuery;

    const mockClient = { query: jest.fn().mockResolvedValue({
      rows: [{ id: 2 }]
    })};

    const tableName = "settings";

    const data = {
      config: {
        merchant_added: { flag: true },
        level: 2
      }
    };

    const where = { id: 2 };

    await buildAndExecuteUpdateQuery(
      tableName,
      data,
      where,
      {},
      { returnUpdated: true },
      mockClient
    );

    const [sql, params] = mockClient.query.mock.calls[0];

    // should contain MERGE logic
    expect(sql).toContain("coalesce");
    expect(sql).toContain("merchant_added");

    // parameters should have JSON merged object stringified
    expect(params).toEqual(
      expect.arrayContaining([
        JSON.stringify({ flag: true }),
        JSON.stringify(2),
        2
      ])
    );
  });

});
