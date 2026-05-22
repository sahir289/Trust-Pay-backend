/* global describe, it, expect, afterEach, beforeAll, afterAll */
// ESM mock for logger at the top
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
import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/utils/db.js', () => ({
  executeQuery: jest.fn(),
  buildInsertQuery: jest.fn(),
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

let dao, db, logger;

beforeAll(async () => {
  dao = await import('../../src/apis/calculation/calculationDao.js');
  db = await import('../../src/utils/db.js');
  logger = await import('../../src/utils/logger.js');
});

afterEach(() => {
  jest.clearAllMocks();
  if (logger && logger.error) logger.error.mockReset && logger.error.mockReset();
});

afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 100)); // let pending timers flush
});

describe('calculationDao (Extreme Automation-Grade)', () => {
  describe('getCalculationDao', () => {
    it('should return first row if rows exist', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }] });
      const result = await dao.getCalculationDao({}, new Date(), new Date(), 0, 10, [], null);
      expect(result).toEqual({ id: 1 });
    });
    it('should return undefined if no rows', async () => {
      db.executeQuery.mockResolvedValue({ rows: [] });
      const result = await dao.getCalculationDao({}, new Date(), new Date(), 0, 10, [], null);
      expect(result).toBeUndefined();
    });
    it('should log and throw on db error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      const loggerModule = await import('../../src/utils/logger.js');
      const errorSpy = jest.spyOn(loggerModule.logger, 'error');
      await expect(dao.getCalculationDao({}, new Date(), new Date(), 0, 10, [], null)).rejects.toThrow('fail');
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  // Add more DAO tests as needed, similar to bankResponseDao
});
