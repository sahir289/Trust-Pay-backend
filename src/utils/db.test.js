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

jest.doMock('../utils/db.js', () => {
  return {
    createPool: jest.fn(() => ({
      connect: jest.fn().mockResolvedValue({ query: jest.fn(), release: jest.fn() }),
      query: jest.fn(),
      on: jest.fn(),   // <-- add this
    })),
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
});
