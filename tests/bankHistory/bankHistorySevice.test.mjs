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
    // Check that the service function is defined and is a function
    expect(service.createBankHistoryService).toBeDefined();

    // Check that it is a function
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

      // Call the service and expect it to throw an error
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

      // Check that the DAOs were called with the expected parameters
      expect(
        bankaccountDao.getBankaccountDashBoardReportDao,
      ).toHaveBeenCalled();

      // Check that createBankHistoryDao was called for each bank account
      expect(
        bankHistoryDao.createBankHistoryDao,
      ).toHaveBeenCalled();

      // Check that the result is an array (since we expect it to return an array of created histories)
      expect(Array.isArray(result)).toBe(true);
    });

    it('should throw on error', async () => {
      bankaccountDao.getBankaccountDashBoardReportDao
        .mockRejectedValue(new Error('fail'));

      // Call the service and expect it to throw an error
      await expect(
        service.createBankHistoryService(null),
      ).rejects.toThrow('fail');
    });
  });
});