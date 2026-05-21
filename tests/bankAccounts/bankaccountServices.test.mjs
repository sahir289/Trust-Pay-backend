/* global describe, it, expect, afterEach, beforeAll */
import { jest } from '@jest/globals';

// ESM mocking: mock all modules before importing the service
jest.unstable_mockModule('../../src/apis/bankAccounts/bankaccountDao.js', () => ({
  getAllBankaccountDao: jest.fn(),
}));
jest.unstable_mockModule('../../src/apis/bankAccounts/bankaccountServices.js', () => ({
  ...jest.requireActual('../../src/apis/bankAccounts/bankaccountServices.js'),
  applyBankUserScopeFilters: jest.fn(),
}));

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
  }
}));

jest.unstable_mockModule('../../src/utils/db.js', () => ({
  executeQuery: jest.fn(),
  buildInsertQuery: jest.fn(),
}));

jest.unstable_mockModule('../../src/utils/redishashkey.js', () => ({
  AUTH_SESSION_CACHE_TTL_SEC: 30,
  buildScopedCacheKey: jest.fn(),
  buildAuthSessionCacheKey: jest.fn(),
  generateCacheKey: jest.fn(() => 'mocked-cache-key'),
  getCachedData: jest.fn(),
}));

jest.unstable_mockModule('../../src/utils/controllerCache.js', () => ({
  readJsonCache: jest.fn(),
  writeJsonCache: jest.fn(),
  shouldServeCachedResponse: jest.fn(),
  normalizeQueryForCache: jest.fn(),
  invalidateCompanyCacheByPrefix: jest.fn(),
}));

let services, dao;

beforeAll(async () => {
  services = await import('../../src/apis/bankAccounts/bankaccountServices.js');
  dao = await import('../../src/apis/bankAccounts/bankaccountDao.js');
  // Guarantee dao mock is a Jest mock function
  dao.getAllBankaccountDao = jest.fn();
});

afterEach(() => { jest.clearAllMocks(); });

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

  describe('getBankaccountService', () => {
    it('should call getAllBankaccountDao and return data', async () => {
      dao.getAllBankaccountDao.mockResolvedValue([{ id: 1 }]);
      const result = await services.getBankaccountService({}, 1, 'ADMIN', 1, 10, 2, 'ADMIN');
      expect(dao.getAllBankaccountDao).toHaveBeenCalled();
      expect(result).toEqual([{ id: 1 }]);
    });
    it('should throw on error', async () => {
      dao.getAllBankaccountDao.mockRejectedValue(new Error('fail'));
      await expect(services.getBankaccountService({}, 1, 'ADMIN', 1, 10, 2, 'ADMIN')).rejects.toThrow('fail');
    });
  });
});
