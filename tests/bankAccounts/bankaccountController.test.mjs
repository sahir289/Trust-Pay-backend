/* global describe, it, expect, beforeEach, afterEach, beforeAll, afterAll */
import { jest } from '@jest/globals';

// ─────────────────────────────────────────────
// ESM MOCKS (must be before imports)
// ─────────────────────────────────────────────
jest.unstable_mockModule(
  '../../src/utils/responseHandlers.js',
  () => ({
    sendSuccess: jest.fn(),
  }),
);

jest.unstable_mockModule(
  '../../src/apis/bankAccounts/bankaccountServices.js',
  () => ({
    getBankaccountService: jest.fn(),
  }),
);

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

jest.unstable_mockModule(
  '../../src/utils/db.js',
  () => ({
    executeQuery: jest.fn(),
    buildInsertQuery: jest.fn(),
  }),
);

// ─────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────
let controllers;
let responseHandlers;
let services;
let controllerCache;

beforeAll(async () => {
  controllers = await import(
    '../../src/apis/bankAccounts/bankaccountController.js'
  );

  responseHandlers = await import(
    '../../src/utils/responseHandlers.js'
  );

  services = await import(
    '../../src/apis/bankAccounts/bankaccountServices.js'
  );

  controllerCache = await import(
    '../../src/utils/controllerCache.js'
  );

  // ensure all mocks are jest functions
  controllerCache.readJsonCache = jest.fn();
  controllerCache.writeJsonCache = jest.fn();
  controllerCache.shouldServeCachedResponse = jest.fn();
  responseHandlers.sendSuccess = jest.fn();
  services.getBankaccountService = jest.fn();
});

afterEach(() => {
  jest.clearAllMocks();
});

afterAll(async () => {
  await new Promise((resolve) =>
    setTimeout(resolve, 100),
  );
});

// ─────────────────────────────────────────────
// TEST SUITE
// ─────────────────────────────────────────────
describe('bankaccountController', () => {
  const controllerNames = [
    'getBankaccount',
    'getBankAccountBySearch',
    'getBankaccountById',
    'createBankaccount',
    'updateBankaccount',
    'deleteBankaccount',
    'getMerchantBank',
    'getBankaccountNickName',
    'activeInactiveBankAccount',
  ];

  controllerNames.forEach((name) => {
    it(`${name} should be defined`, () => {
      expect(controllers[name]).toBeDefined();
      expect(typeof controllers[name]).toBe(
        'function',
      );
    });
  });

  // ─────────────────────────────────────────
  // getBankaccount
  // ─────────────────────────────────────────
  describe('getBankaccount', () => {
    let req, res;

    beforeEach(() => {
      req = {
        user: {
          company_id: 1,
          role: 'ADMIN',
          user_id: 2,
          designation: 'ADMIN',
        },
        query: {},
      };

      res = {};
    });

    it('should return cached data if available', async () => {
      controllerCache.readJsonCache.mockResolvedValue({
        cached: true,
      });

      controllerCache.shouldServeCachedResponse
        .mockReturnValue(true);

      responseHandlers.sendSuccess.mockImplementation(
        (res, data, msg) => {
          res._sent = { data, msg };
          return res;
        },
      );

      await controllers.getBankaccount(req, res);

      expect(
        responseHandlers.sendSuccess,
      ).toHaveBeenCalled();

      expect(res._sent.data).toEqual({ cached: true });
    });

    it('should call service and cache if no cache', async () => {
      controllerCache.readJsonCache.mockResolvedValue(
        null,
      );

      controllerCache.shouldServeCachedResponse
        .mockReturnValue(false);

      services.getBankaccountService.mockResolvedValue([
        { id: 1 },
      ]);

      controllerCache.writeJsonCache.mockResolvedValue();

      responseHandlers.sendSuccess.mockImplementation(
        (res, data, msg) => {
          res._sent = { data, msg };
          return res;
        },
      );

      await controllers.getBankaccount(req, res);

      expect(
        services.getBankaccountService,
      ).toHaveBeenCalled();

      expect(
        controllerCache.writeJsonCache,
      ).toHaveBeenCalled();

      expect(
        responseHandlers.sendSuccess,
      ).toHaveBeenCalled();

      expect(res._sent.data).toEqual([{ id: 1 }]);
    });
  });
});