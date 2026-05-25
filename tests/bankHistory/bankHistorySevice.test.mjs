/* global describe, it, expect, afterEach, beforeAll */
import { jest } from '@jest/globals';

// ─────────────────────────────────────────────
// ESM MOCKS (must be before imports)
// ─────────────────────────────────────────────
jest.unstable_mockModule(
  '../../src/apis/bankAccounts/bankaccountDao.js',
  () => ({
    getBankaccountDashBoardReportDao: jest.fn(),
  }),
);

jest.unstable_mockModule(
  '../../src/apis/bankHistory/bankHistoryDao.js',
  () => ({
    createBankHistoryDao: jest.fn(),
  }),
);

// ─────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────
let service;
let bankaccountDao;
let bankHistoryDao;

beforeAll(async () => {
  service = await import(
    '../../src/apis/bankHistory/bankHistorySevice.js'
  );

  bankaccountDao = await import(
    '../../src/apis/bankAccounts/bankaccountDao.js'
  );

  bankHistoryDao = await import(
    '../../src/apis/bankHistory/bankHistoryDao.js'
  );

  // ensure mocks are jest functions
  bankaccountDao.getBankaccountDashBoardReportDao = jest.fn();
  bankHistoryDao.createBankHistoryDao = jest.fn();
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────
// TEST SUITE
// ─────────────────────────────────────────────
describe('bankHistorySevice', () => {
  it('createBankHistoryService should be defined', () => {
    expect(service.createBankHistoryService).toBeDefined();
    expect(typeof service.createBankHistoryService).toBe(
      'function',
    );
  });

  // ─────────────────────────────────────────
  // createBankHistoryService
  // ─────────────────────────────────────────
  describe('createBankHistoryService', () => {
    it('should throw if not array', async () => {
      bankaccountDao.getBankaccountDashBoardReportDao
        .mockResolvedValue(null);

      await expect(
        service.createBankHistoryService(null),
      ).rejects.toThrow();
    });

    it('should create history for each bank', async () => {
      bankaccountDao.getBankaccountDashBoardReportDao
        .mockResolvedValue([
          {
            id: 1,
            today_balance: 100,
            balance: 200,
            payin_count: 2,
          },
          {
            id: 2,
            today_balance: 50,
            balance: 60,
            payin_count: 1,
          },
        ]);

      bankHistoryDao.createBankHistoryDao
        .mockResolvedValue({ id: 1 });

      const result =
        await service.createBankHistoryService(null);

      expect(
        bankaccountDao.getBankaccountDashBoardReportDao,
      ).toHaveBeenCalled();

      expect(
        bankHistoryDao.createBankHistoryDao,
      ).toHaveBeenCalled();

      expect(Array.isArray(result)).toBe(true);
    });

    it('should throw on error', async () => {
      bankaccountDao.getBankaccountDashBoardReportDao
        .mockRejectedValue(new Error('fail'));

      await expect(
        service.createBankHistoryService(null),
      ).rejects.toThrow('fail');
    });
  });
});