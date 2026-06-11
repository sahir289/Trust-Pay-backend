// ESM MOCKS MUST STAY AT THE VERY TOP
/* global describe, it, expect, afterEach, beforeAll, afterAll */
import { jest } from '@jest/globals';

// ─────────────────────────────────────────────
// LOGGER MOCK
// ─────────────────────────────────────────────
jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: {
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    infoOnce: jest.fn(),
    warnOnce: jest.fn(),
    close: jest.fn(),
  },

  default: {
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    infoOnce: jest.fn(),
    warnOnce: jest.fn(),
    close: jest.fn(),
  },
}));

// ─────────────────────────────────────────────
// DB MOCK
// ─────────────────────────────────────────────
jest.unstable_mockModule('../../src/utils/db.js', () => ({
  executeQuery: jest.fn(),
  buildInsertQuery: jest.fn(),
}));

// ─────────────────────────────────────────────
// REDIS MOCK
// ─────────────────────────────────────────────
jest.unstable_mockModule('../../src/utils/redisClient.js', () => ({
  default: {
    get: jest.fn(),

    set: jest.fn(),

    scan: jest.fn().mockResolvedValue([
      '0',
      [],
    ]),

    del: jest.fn(),

    on: jest.fn(),

    config: jest.fn(),

    quit: jest.fn(),
  },

  closeRedis: jest.fn(),
}));

// ─────────────────────────────────────────────
// REDIS HASH KEY MOCK
// ─────────────────────────────────────────────
jest.unstable_mockModule('../../src/utils/redishashkey.js', () => ({
  AUTH_SESSION_CACHE_TTL_SEC: 30,

  buildScopedCacheKey: jest.fn(),

  buildAuthSessionCacheKey: jest.fn(),

  generateCacheKey: jest.fn(() => 'mocked-cache-key'),

  getCachedData: jest.fn(),
}));

// ─────────────────────────────────────────────
// CONTROLLER CACHE MOCK
// ─────────────────────────────────────────────
jest.unstable_mockModule('../../src/utils/controllerCache.js', () => ({
  readJsonCache: jest.fn(),

  writeJsonCache: jest.fn(),

  shouldServeCachedResponse: jest.fn(),

  normalizeQueryForCache: jest.fn(),

  invalidateCompanyCacheByPrefix: jest.fn(),
}));

// ─────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────
let dao;

let db;

let logger;

// ─────────────────────────────────────────────
// SETUP
// ─────────────────────────────────────────────
beforeAll(async () => {
  dao = await import('../../src/apis/calculation/calculationDao.js');

  db = await import('../../src/utils/db.js');

  logger = await import('../../src/utils/logger.js');

  db.executeQuery = jest.fn();
});

afterEach(() => {
  jest.clearAllMocks();

  if (logger && logger.error) {
    logger.error.mockReset && logger.error.mockReset();
  }
});

afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 100));
});

// ─────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────
describe('calculationDao (Extreme Automation-Grade)', () => {

  // ─────────────────────────────────────────
  // getCalculationDao
  // ─────────────────────────────────────────
  describe('getCalculationDao', () => {

    it('should return rows if present', async () => {
      db.executeQuery.mockResolvedValue({
        rows: [
          { id: 1 },
          { id: 2 },
        ],
      });

      const result = await dao.getCalculationDao(
        {},
        1,
        10,
        null,
        null,
        [],
        null,
      );

      // Should return the expected rows from the database
      expect(result).toEqual([
        { id: 1 },
        { id: 2 },
      ]);
    });

    it('should return empty array if no rows', async () => {
      db.executeQuery.mockResolvedValue({
        rows: [],
      });

      const result = await dao.getCalculationDao(
        {},
        1,
        10,
        null,
        null,
        [],
        null,
      );

      // Should return an empty array if the database returns no rows
      expect(result).toEqual([]);
    });

    it('should log and throw on db error', async () => {
      db.executeQuery.mockRejectedValue(
        new Error('fail'),
      );

      const loggerModule = await import('../../src/utils/logger.js');

      const errorSpy = jest.spyOn(
        loggerModule.logger,
        'error',
      );

      // Should throw the error when the database query fails
      await expect(
        dao.getCalculationDao(
          {},
          1,
          10,
          null,
          null,
          [],
          null,
        ),
      ).rejects.toThrow('fail');

      // Should log the error when the database query fails
      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });
  });

  // ─────────────────────────────────────────
  // getCalculationDashBoardReportDao
  // ─────────────────────────────────────────
  describe('getCalculationDashBoardReportDao', () => {

    it('should return rows if present', async () => {
      db.executeQuery.mockResolvedValue({
        rows: [
          { a: 1 },
        ],
      });

      const result =
        await dao.getCalculationDashBoardReportDao({
          user_id: 1,
          company_id: 2,
          sDate: '2024-01-01',
          eDate: '2024-01-02',
        });

      // Should return the expected rows from the database
      expect(result).toEqual([
        { a: 1 },
      ]);
    });

    it('should return empty array if no rows', async () => {
      db.executeQuery.mockResolvedValue({
        rows: [],
      });

      const result =
        await dao.getCalculationDashBoardReportDao({
          user_id: 1,
          company_id: 2,
          sDate: '2024-01-01',
          eDate: '2024-01-02',
        });

      // Should return an empty array if the database returns no rows
      expect(result).toEqual([]);
    });

    it('should throw if required params missing', async () => {
      // Should throw if required parameters are missing
      await expect(
        dao.getCalculationDashBoardReportDao({}),
      ).rejects.toThrow();
    });

    it('should log and throw on db error', async () => {
      db.executeQuery.mockRejectedValue(
        new Error('fail'),
      );

      // Should throw the error when the database query fails
      await expect(
        dao.getCalculationDashBoardReportDao({
          user_id: 1,
          company_id: 2,
          sDate: '2024-01-01',
          eDate: '2024-01-02',
        }),
      ).rejects.toThrow('fail');
    });
  });

  // ─────────────────────────────────────────
  // getCalculationByDateAndUserDao
  // ─────────────────────────────────────────
  describe('getCalculationByDateAndUserDao', () => {

    it('should return rows if present', async () => {
      db.executeQuery.mockResolvedValue({
        rows: [
          { id: 1 },
        ],
      });

      const result =
        await dao.getCalculationByDateAndUserDao(
          '2024-01-01',
        );

      // Should return the expected rows from the database
      expect(result).toEqual([
        { id: 1 },
      ]);
    });

    it('should return empty array if no rows', async () => {
      db.executeQuery.mockResolvedValue({
        rows: [],
      });

      const result =
        await dao.getCalculationByDateAndUserDao(
          '2024-01-01',
        );

      // Should return an empty array if the database returns no rows
      expect(result).toEqual([]);
    });

    it('should throw if date missing', async () => {
      // Should throw if date parameter is missing
      await expect(
        dao.getCalculationByDateAndUserDao(),
      ).rejects.toThrow();
    });

    it('should throw if invalid date', async () => {
      // Should throw if date parameter is invalid
      await expect(
        dao.getCalculationByDateAndUserDao(
          'bad-date',
        ),
      ).rejects.toThrow();
    });

    it('should log and throw on db error', async () => {
      db.executeQuery.mockRejectedValue(
        new Error('fail'),
      );

      // Should throw the error when the database query fails
      await expect(
        dao.getCalculationByDateAndUserDao(
          '2024-01-01',
        ),
      ).rejects.toThrow('fail');
    });
  });

  // ─────────────────────────────────────────
  // updateTodayNetBalanceDao
  // ─────────────────────────────────────────
  describe('updateTodayNetBalanceDao', () => {

    it('should return row if present', async () => {
      db.executeQuery.mockResolvedValue({
        rows: [
          { id: 1 },
        ],
      });

      const result =
        await dao.updateTodayNetBalanceDao(
          'id',
          100,
        );

      // Should return the expected row from the database
      expect(result).toEqual({
        id: 1,
      });
    });

    it('should return null if no rows', async () => {
      db.executeQuery.mockResolvedValue({
        rows: [],
      });

      // Should return null if the database returns no rows instead of an empty array
      const result =
        await dao.updateTodayNetBalanceDao(
          'id',
          100,
        );

      // Should return null if the database returns no rows
      expect(result).toBeNull();
    });

    it('should log and throw on db error', async () => {
      db.executeQuery.mockRejectedValue(
        new Error('fail'),
      );

      // Should throw the error when the database query fails
      await expect(
        dao.updateTodayNetBalanceDao(
          'id',
          100,
        ),
      ).rejects.toThrow('fail');
    });
  });
});