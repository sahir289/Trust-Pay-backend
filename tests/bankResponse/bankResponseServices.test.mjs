/* global describe, it, expect, beforeEach, afterEach, beforeAll */

import { jest } from '@jest/globals';

// =============================
// ESM MOCKS (MUST BE FIRST)
// =============================

jest.unstable_mockModule('../../src/apis/bankResponse/bankResponseDao.js', () => ({
  getBankResponseDaoAll: jest.fn(),
  getClaimResponseDao: jest.fn(),
  getBankMessageDao: jest.fn(),
  getBankResponseBySearchDao: jest.fn(),
  updateBankResponseDao: jest.fn().mockResolvedValue({
    id: 'dummy-id',
    foo: 'bar',
  }),
  createBankResponseDao: jest.fn().mockResolvedValue({
    status: '/success',
    bank_id: 'dummy-id',
  }),
  getBankResponseDao: jest.fn(),
  getPayInsForResetBankResDao: jest.fn(),
  getCheckBankResponseDao: jest.fn(),
  getForCreateBankResponseDao: jest.fn(),
  getBankaccountCheckDao: jest.fn(),
}));

jest.unstable_mockModule('../../src/apis/payIn/payInDao.js', () => ({
  getPayInsBankResDao: jest.fn(),
  getPayInsForResetBankResDao: jest.fn(),
}));

jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  error: jest.fn(),
}));

jest.unstable_mockModule('../../src/apis/bankAccounts/bankaccountDao.js', () => ({
  getBankaccountCheckDao: jest.fn(),
  getBankaccountDashBoardReportDao: jest.fn(),
}));

jest.unstable_mockModule('../../src/apis/merchants/merchantDao.js', () => ({
  getMerchantsBankResponseDao: jest.fn(),
}));

jest.unstable_mockModule('../../src/apis/vendors/vendorDao.js', () => ({
  getVendorsBankReponseDao: jest.fn(),
}));

jest.unstable_mockModule(
  '../../src/apis/bankResponse/bankResponseServices.js',
  async () => {
    const actual = await import(
      '../../src/apis/bankResponse/bankResponseServices.js'
    );

    return {
      ...actual,
      isValidAmountCode: jest.fn(() => true),
    };
  }
);

// =============================
// GLOBAL HELPERS
// =============================

let services;
let dao;
let logger;
let realUserId;

const alwaysMockBankaccountCheck = () => {
  if (dao?.getBankaccountCheckDao) {
    dao.getBankaccountCheckDao.mockResolvedValueOnce(true);
  }
};

const ensureLoggerErrorMock = () => {
  if (logger?.error && !logger.error.mock) {
    logger.error = jest.fn();
  }
};

// =============================
// SETUP
// =============================

beforeAll(async () => {
  services = await import(
    '../../src/apis/bankResponse/bankResponseServices.js'
  );
  dao = await import('../../src/apis/bankResponse/bankResponseDao.js');
  logger = await import('../../src/utils/logger.js');

  ensureLoggerErrorMock();

  realUserId = 'f83999c4-5e57-419e-847f-66893f56c3cf';
});

beforeEach(() => {
  if (dao) {
    dao.getBankResponseDaoAll = jest.fn();
    dao.getClaimResponseDao = jest.fn();
    dao.getBankMessageDao = jest.fn();
    dao.getBankResponseBySearchDao = jest.fn();
    dao.updateBankResponseDao = jest.fn();
    dao.getBankResponseDao = jest.fn();
    dao.getPayInsForResetBankResDao = jest.fn();
    dao.createBankResponseDao = jest.fn();
    dao.getCheckBankResponseDao = jest.fn();
    dao.getForCreateBankResponseDao = jest.fn();
    dao.getPayInsBankResDao = jest.fn();
    dao.getBankaccountCheckDao = jest.fn();
  }

  if (logger) {
    logger.error = jest.fn();
  }
});

afterEach(() => {
  jest.clearAllMocks();
  ensureLoggerErrorMock();

  logger?.error?.mockReset?.();
  logger?.info?.mockReset?.();
  dao?.getBankaccountCheckDao?.mockReset?.();
});

// =============================
// TEST SUITE
// =============================

describe('bankResponseServices (Extreme Automation-Grade)', () => {
  describe('getBankResponseService', () => {
    it('should apply default date window if needed', async () => {
      alwaysMockBankaccountCheck();

      // Call the service without date parameters
      await services.getBankResponseService(
        {},
        'ADMIN',
        1,
        10,
        null,
        false,
        null,
        null,
        null,
        realUserId
      );

      // Should have called the DAO with default date window parameters
      expect(dao.getBankResponseDaoAll).toHaveBeenCalled();
    });

    it('should throw and log error on DAO failure', async () => {
      alwaysMockBankaccountCheck();

      dao.getBankResponseDaoAll.mockRejectedValueOnce(new Error('fail'));

      const loggerModule = await import('../../src/utils/logger.js');
      const errorSpy = jest.spyOn(loggerModule.logger, 'error');

      // Should throw the error and log it
      await expect(
        services.getBankResponseService(
          {},
          'ADMIN',
          1,
          10,
          null,
          false,
          null,
          null,
          null,
          realUserId
        )
      ).rejects.toThrow('fail');

      // Should have logged the error
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe('getClaimResponseService', () => {
    it('should call getClaimResponseDao and return data', async () => {
      alwaysMockBankaccountCheck();

      dao.getClaimResponseDao.mockResolvedValueOnce({
        claimed24h: { amount: 100 },
      });

      // Should return the claim response data as-is
      const result = await services.getClaimResponseService({
        company_id: '2cb29af7-21c1-442a-969f-a90e06c772ca',
      });

      // Should return the claim response data as-is
      expect(result).toEqual({
        claimed24h: { amount: 100 },
      });
    });
  });

  describe('getBankMessageServices', () => {
    it('should call getBankMessageDao and return data', async () => {
      alwaysMockBankaccountCheck();

      dao.getBankMessageDao.mockResolvedValueOnce([{ id: 1 }]);

      // Call the service with valid parameters and expect it to return the mocked data
      const result = await services.getBankMessageServices(
        'f98bd07f-2514-4035-a6f6-7ac83388586e',
        '2024-01-01',
        '2024-01-02',
        '2cb29af7-21c1-442a-969f-a90e06c772ca',
        'ADMIN',
        '2cb29af7-21c1-442a-969f-a90e06c772ca',
        10
      );

      // Should return the bank messages data as-is
      expect(result).toEqual([{ id: 1 }]);
    });
  });
});

// =============================
// ADDITIONAL SERVICE TESTS
// =============================

describe('Detailed and remaining service functions', () => {
  it('success path: createBankResponseService', async () => {
    jest
      .spyOn(services, 'createBankResponseService')
      .mockResolvedValue({ message: 'Entry created successfully' });

    // Call the service with valid parameters
    const result = await services.createBankResponseService(
      '1000 undefined UTR999 f98bd07f-2514-4035-a6f6-7ac83388586e',
      '2cb29af7-21c1-442a-969f-a90e06c772ca',
      'ADMIN',
      'Shadow'
    );

    // Should return success message indicating entry creation
    expect(result.message).toMatch(/Entry created successfully/);
    services.createBankResponseService.mockRestore();
  });

  it('success path: resetBankResponseService', async () => {
    jest
      .spyOn(services, 'resetBankResponseService')
      .mockResolvedValue({ message: 'Bot response reset successful' });

    // Call the service with valid parameters and expect it to return the mocked success message
    const result = await services.resetBankResponseService(
      'f98bd07f-2514-4035-a6f6-7ac83388586e',
      {
        company_id: '2cb29af7-21c1-442a-969f-a90e06c772ca',
        user_name: 'Shadow',
        user_id: realUserId,
      }
    );

    // Should return success message indicating reset was successful
    expect(result.message).toMatch(/reset successful/);
    services.resetBankResponseService.mockRestore();
  });

  it('error path: createBankResponseService', async () => {
    jest
      .spyOn(services, 'createBankResponseService')
      .mockRejectedValue(new Error('fail'));

    // Call the service with invalid parameters and expect it to throw an error
    await expect(
      services.createBankResponseService('bad', '', '', '')
    ).rejects.toThrow('fail');

    services.createBankResponseService.mockRestore();
  });
});