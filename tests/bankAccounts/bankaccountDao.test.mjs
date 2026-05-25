/* global describe, it, expect, afterEach, beforeAll */
import { jest } from '@jest/globals';

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
    scan: jest.fn().mockResolvedValue(['0', []]),
    del: jest.fn(),
    on: jest.fn(),
    config: jest.fn(),
    quit: jest.fn(),
  },
  closeRedis: jest.fn(),
}));

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

beforeAll(async () => {
  dao = await import('../../src/apis/bankAccounts/bankaccountDao.js');
  db = await import('../../src/utils/db.js');

  // ensure mock consistency
  db.executeQuery = jest.fn();
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────
// TEST SUITE
// ─────────────────────────────────────────────
describe('bankaccountDao', () => {
  const daoNames = [
    'getBankaccountPayinDao',
    'getBankAccountCoreByIdDao',
    'getBankaccountDao',
    'createBankaccountDao',
    'patchBankaccountFastDao',
    'updateBankaccountDao',
    'deleteBankaccountDao',
    'getBankAccountDaoNickName',
    'getBankAccountsBySearchDao',
    'getAllBankaccountDao',
  ];

  daoNames.forEach((name) => {
    it(`${name} should be defined`, () => {
      expect(dao[name]).toBeDefined();
      expect(typeof dao[name]).toBe('function');
    });
  });

  // ─────────────────────────────────────────
  // getBankaccountPayinDao
  // ─────────────────────────────────────────
  describe('getBankaccountPayinDao', () => {
    it('should call executeQuery and return rows', async () => {
      db.executeQuery.mockResolvedValue({
        rows: [
          { id: 1, nick_name: 'test', user_id: 2 },
        ],
      });

      const result = await dao.getBankaccountPayinDao({
        id: 1,
      });

      expect(result).toEqual([
        { id: 1, nick_name: 'test', user_id: 2 },
      ]);

      expect(db.executeQuery).toHaveBeenCalled();
    });

    it('should throw on db error', async () => {
      db.executeQuery.mockRejectedValue(
        new Error('fail'),
      );

      await expect(
        dao.getBankaccountPayinDao({ id: 1 }),
      ).rejects.toThrow('fail');
    });
  });
});