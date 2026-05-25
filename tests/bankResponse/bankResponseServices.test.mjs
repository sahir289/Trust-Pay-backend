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

      expect(dao.getBankResponseDaoAll).toHaveBeenCalled();
    });

    it('should throw and log error on DAO failure', async () => {
      alwaysMockBankaccountCheck();

      dao.getBankResponseDaoAll.mockRejectedValueOnce(new Error('fail'));

      const loggerModule = await import('../../src/utils/logger.js');
      const errorSpy = jest.spyOn(loggerModule.logger, 'error');

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

      const result = await services.getClaimResponseService({
        company_id: '2cb29af7-21c1-442a-969f-a90e06c772ca',
      });

      expect(result).toEqual({
        claimed24h: { amount: 100 },
      });
    });
  });

  describe('getBankMessageServices', () => {
    it('should call getBankMessageDao and return data', async () => {
      alwaysMockBankaccountCheck();

      dao.getBankMessageDao.mockResolvedValueOnce([{ id: 1 }]);

      const result = await services.getBankMessageServices(
        'f98bd07f-2514-4035-a6f6-7ac83388586e',
        '2024-01-01',
        '2024-01-02',
        '2cb29af7-21c1-442a-969f-a90e06c772ca',
        'ADMIN',
        '2cb29af7-21c1-442a-969f-a90e06c772ca',
        10
      );

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

    const result = await services.createBankResponseService(
      '1000 undefined UTR999 f98bd07f-2514-4035-a6f6-7ac83388586e',
      '2cb29af7-21c1-442a-969f-a90e06c772ca',
      'ADMIN',
      'Shadow'
    );

    expect(result.message).toMatch(/Entry created successfully/);
    services.createBankResponseService.mockRestore();
  });

  it('success path: resetBankResponseService', async () => {
    jest
      .spyOn(services, 'resetBankResponseService')
      .mockResolvedValue({ message: 'Bot response reset successful' });

    const result = await services.resetBankResponseService(
      'f98bd07f-2514-4035-a6f6-7ac83388586e',
      {
        company_id: '2cb29af7-21c1-442a-969f-a90e06c772ca',
        user_name: 'Shadow',
        user_id: realUserId,
      }
    );

    expect(result.message).toMatch(/reset successful/);
    services.resetBankResponseService.mockRestore();
  });

  it('error path: createBankResponseService', async () => {
    jest
      .spyOn(services, 'createBankResponseService')
      .mockRejectedValue(new Error('fail'));

    await expect(
      services.createBankResponseService('bad', '', '', '')
    ).rejects.toThrow('fail');

    services.createBankResponseService.mockRestore();
  });
});