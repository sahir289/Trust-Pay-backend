/* global describe, it, expect, afterEach, beforeAll */
import { jest } from '@jest/globals';

// ─────────────────────────────────────────────
// DAO MOCK
// ─────────────────────────────────────────────
jest.unstable_mockModule(
  '../../src/apis/bankAccounts/bankaccountDao.js',
  () => ({
    getAllBankaccountDao: jest.fn(),
  }),
);

// ─────────────────────────────────────────────
// SERVICE PARTIAL MOCK (keeping real logic where needed)
// ─────────────────────────────────────────────
jest.unstable_mockModule(
  '../../src/apis/bankAccounts/bankaccountServices.js',
  () => ({
    ...jest.requireActual(
      '../../src/apis/bankAccounts/bankaccountServices.js',
    ),
    applyBankUserScopeFilters: jest.fn(),
  }),
);

// ─────────────────────────────────────────────
// REDIS MOCK
// ─────────────────────────────────────────────
jest.unstable_mockModule(
  '../../src/utils/redisClient.js',
  () => ({
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
  }),
);

// ─────────────────────────────────────────────
// LOGGER MOCK
// ─────────────────────────────────────────────
jest.unstable_mockModule(
  '../../src/utils/logger.js',
  () => ({
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
  }),
);

// ─────────────────────────────────────────────
// DB MOCK
// ─────────────────────────────────────────────
jest.unstable_mockModule(
  '../../src/utils/db.js',
  () => ({
    executeQuery: jest.fn(),
    buildInsertQuery: jest.fn(),
  }),
);

// ─────────────────────────────────────────────
// REDIS HASH KEY MOCK
// ─────────────────────────────────────────────
jest.unstable_mockModule(
  '../../src/utils/redishashkey.js',
  () => ({
    AUTH_SESSION_CACHE_TTL_SEC: 30,
    buildScopedCacheKey: jest.fn(),
    buildAuthSessionCacheKey: jest.fn(),
    generateCacheKey: jest.fn(() => 'mocked-cache-key'),
    getCachedData: jest.fn(),
  }),
);

// ─────────────────────────────────────────────
// CONTROLLER CACHE MOCK
// ─────────────────────────────────────────────
jest.unstable_mockModule(
  '../../src/utils/controllerCache.js',
  () => ({
    readJsonCache: jest.fn(),
    writeJsonCache: jest.fn(),
    shouldServeCachedResponse: jest.fn(),
    normalizeQueryForCache: jest.fn(),
    invalidateCompanyCacheByPrefix: jest.fn(),
  }),
);

// ─────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────
let services;
let dao;

beforeAll(async () => {
  services = await import(
    '../../src/apis/bankAccounts/bankaccountServices.js'
  );

  dao = await import(
    '../../src/apis/bankAccounts/bankaccountDao.js'
  );

  // ensure mock consistency
  dao.getAllBankaccountDao = jest.fn();
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────
// TEST SUITE
// ─────────────────────────────────────────────
describe('bankaccountServices', () => {
  const serviceNames = [
    'getBankaccountService',
    'createBankaccountService',
    'updateBankaccountService',
    'deleteBankaccountService',
    'getBankaccountServiceNickName',
    'getBankAccountBySearchService',
    'activeInactiveBankAccountService',
  ];

  serviceNames.forEach((name) => {
    it(`${name} should be defined`, () => {
      expect(services[name]).toBeDefined();
      expect(typeof services[name]).toBe('function');
    });
  });

  // ─────────────────────────────────────────
  // getBankaccountService
  // ─────────────────────────────────────────
  describe('getBankaccountService', () => {
    it('should call getAllBankaccountDao and return data', async () => {
      dao.getAllBankaccountDao.mockResolvedValue([
        { id: 1 },
      ]);

      const result =
        await services.getBankaccountService(
          {},
          1,
          'ADMIN',
          1,
          10,
          2,
          'ADMIN',
        );

      // Check that the DAO was called to get data
      expect(
        dao.getAllBankaccountDao,
      ).toHaveBeenCalled();

      // Check that the service returns the expected data
      expect(result).toEqual([{ id: 1 }]);
    });

    it('should throw on error', async () => {
      dao.getAllBankaccountDao.mockRejectedValue(
        new Error('fail'),
      );

      // Call the service and expect it to throw an error
      await expect(
        services.getBankaccountService(
          {},
          1,
          'ADMIN',
          1,
          10,
          2,
          'ADMIN',
        ),
      ).rejects.toThrow('fail');
    });
  });
});