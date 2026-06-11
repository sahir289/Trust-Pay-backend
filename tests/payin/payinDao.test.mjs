// -------------------- ESM MOCKS --------------------
/* global describe, it, expect, beforeEach, afterEach, beforeAll */
import { jest } from '@jest/globals';
jest.unstable_mockModule('../../src/constants/index.js', () => ({
  tableName: { PAYIN: 'Payin', MERCHANT: 'Merchant' },
}));
jest.unstable_mockModule('../../src/utils/appErrors.js', () => ({
  BadRequestError: class extends Error {},
}));
jest.unstable_mockModule('../../src/utils/db.js', () => ({
  buildInsertQuery: jest.fn(() => ['SQL', []]),
  buildSelectQuery: jest.fn(() => ['SQL', []]),
  buildUpdateQuery: jest.fn(() => ['SQL', []]),
  executeQuery: jest.fn(async () => ({ rows: [{}] })),
}));
jest.unstable_mockModule('dayjs', () => Object.assign(() => jest.fn(), { default: jest.fn() }));
jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// -------------------- IMPORTS ----------------------
let dao, db, loggerModule;
beforeAll(async () => {
  dao = await import('../../src/apis/payIn/payInDao.js');
  db = await import('../../src/utils/db.js');
  loggerModule = await import('../../src/utils/logger.js');
});

beforeEach(() => {
  // Reassign all mock functions for isolation
  if (db) {
    db.buildInsertQuery = jest.fn(() => ['SQL', []]);
    db.buildSelectQuery = jest.fn(() => ['SQL', []]);
    db.buildUpdateQuery = jest.fn(() => ['SQL', []]);
    db.executeQuery = jest.fn(async () => ({ rows: [{}] }));
  }
  if (loggerModule?.logger) {
    loggerModule.logger.error = jest.fn();
    loggerModule.logger.info = jest.fn();
    loggerModule.logger.warn = jest.fn();
  }
});

afterEach(() => {
  jest.clearAllMocks();
});

// Use loggerModule.logger everywhere instead of logger

// -------------------- HELPERS ----------------------
function mockConn() { return {}; }

// -------------------- TESTS ------------------------
describe('payInDao', () => {
  describe('generatePayInUrlDao', () => {
    it('should insert and return entry', async () => {
      db.buildInsertQuery.mockReturnValue(['SQL', []]);
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
      const result = await dao.generatePayInUrlDao({ foo: 'bar' }, mockConn());
      // We can check if the insert query was built with expected parameters if needed
      expect(db.buildInsertQuery).toHaveBeenCalled();
      // We can also check if executeQuery was called with the SQL from buildInsertQuery
      expect(db.executeQuery).toHaveBeenCalled();
      // Finally, we check if the result is as expected
      expect(result).toEqual({ id: 1 });
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      // We expect the promise to reject with the error message 'fail'
      await expect(dao.generatePayInUrlDao({}, mockConn())).rejects.toThrow('fail');
      // We also expect that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getPayInwithMerchantDao', () => {
    it('should select and return row', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 2 }] });
      const result = await dao.getPayInwithMerchantDao('orderid', mockConn());
      // We can check if the select query was built with expected parameters if needed
      expect(db.executeQuery).toHaveBeenCalled();
      // Finally, we check if the result is as expected
      expect(result).toEqual({ id: 2 });
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      // We expect the promise to reject with the error message 'fail'
      await expect(dao.getPayInwithMerchantDao('orderid', mockConn())).rejects.toThrow('fail');
      // We also expect that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getPayInWithMerchantOrderIdDao', () => {
    it('should select and return row', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 3 }] });
      const result = await dao.getPayInWithMerchantOrderIdDao('orderid', mockConn());
      // We can check if the select query was built with expected parameters if needed
      expect(result).toEqual({ id: 3 });
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      // We expect the promise to reject with the error message 'fail'
      await expect(dao.getPayInWithMerchantOrderIdDao('orderid', mockConn())).rejects.toThrow('fail');
      // We also expect that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getPayInsBankResDao', () => {
    it('should select and return rows', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 4 }] });
      const result = await dao.getPayInsBankResDao({}, mockConn());
      // We can check if the select query was built with expected parameters if needed
      expect(Array.isArray(result)).toBe(true);
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      // We expect the promise to reject with the error message 'fail'
      await expect(dao.getPayInsBankResDao({}, mockConn())).rejects.toThrow('fail');
      // We also expect that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getPayInsForSuccessRatioDao', () => {
    it('should select and return rows', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 5 }] });
      const result = await dao.getPayInsForSuccessRatioDao({ company_id: 1 }, mockConn());
      // We can check if the select query was built with expected parameters if needed
      expect(Array.isArray(result)).toBe(true);
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      // We expect the promise to reject with the error message 'fail'
      await expect(dao.getPayInsForSuccessRatioDao({ company_id: 1 }, mockConn())).rejects.toThrow('fail');
      // We also expect that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getSuccessPayInsDao', () => {
    it('should select and return rows', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 6 }] });
      const result = await dao.getSuccessPayInsDao({}, mockConn());
      // We can check if the select query was built with expected parameters if needed
      expect(Array.isArray(result)).toBe(true);
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      // We expect the promise to reject with the error message 'fail'
      await expect(dao.getSuccessPayInsDao({}, mockConn())).rejects.toThrow('fail');
      // We also expect that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getPayInForUpdateDao', () => {
    it('should select and return row or null', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 7 }] });
      const result = await dao.getPayInForUpdateDao({}, mockConn());
      // We can check if the select query was built with expected parameters if needed
      expect(result).toEqual({ id: 7 });
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      // We expect the promise to reject with the error message 'fail'
      await expect(dao.getPayInForUpdateDao({}, mockConn())).rejects.toThrow('fail');
      // We also expect that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getPayInForUpdateServiceDao', () => {
    it('should select and return row or null', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 8 }] });
      const result = await dao.getPayInForUpdateServiceDao({}, mockConn());
      // We can check if the select query was built with expected parameters if needed
      expect(result).toEqual({ id: 8 });
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      // We expect the promise to reject with the error message 'fail'
      await expect(dao.getPayInForUpdateServiceDao({}, mockConn())).rejects.toThrow('fail');
      // We also expect that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getPayInForCheckStatusDao', () => {
    it('should select and return row', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 9 }] });
      const result = await dao.getPayInForCheckStatusDao({}, mockConn());
      // We can check if the select query was built with expected parameters if needed
      expect(result).toEqual({ id: 9 });
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      // We expect the promise to reject with the error message 'fail'
      await expect(dao.getPayInForCheckStatusDao({}, mockConn())).rejects.toThrow('fail');
      // We also expect that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getPayinsForServiccDao', () => {
    it('should select and return row', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 10 }] });
      const result = await dao.getPayinsForServiccDao({}, mockConn());
      // We can check if the select query was built with expected parameters if needed
      expect(result).toEqual({ id: 10 });
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      // We expect the promise to reject with the error message 'fail'
      await expect(dao.getPayinsForServiccDao({}, mockConn())).rejects.toThrow('fail');
      // We also expect that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getPayInForDisputeServiceDao', () => {
    it('should select and return row or null', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 11 }] });
      const result = await dao.getPayInForDisputeServiceDao({}, mockConn());
      // We can check if the select query was built with expected parameters if needed
      expect(result).toEqual({ id: 11 });
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      // We expect the promise to reject with the error message 'fail'
      await expect(dao.getPayInForDisputeServiceDao({}, mockConn())).rejects.toThrow('fail');
      // We also expect that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getPayInIntentDao', () => {
    it('should select and return row or []', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 12 }] });
      const result = await dao.getPayInIntentDao('orderid', mockConn());
      // We can check if the select query was built with expected parameters if needed
      expect(result).toEqual({ id: 12 });
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      // We expect the promise to reject with the error message 'fail'
      await expect(dao.getPayInIntentDao('orderid', mockConn())).rejects.toThrow('fail');
      // We also expect that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getPayInByClientRefNoDao', () => {
    it('should select and return row or null', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 13 }] });
      const result = await dao.getPayInByClientRefNoDao('refno', mockConn());
      // We can check if the select query was built with expected parameters if needed
      expect(result).toEqual({ id: 13 });
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      // We expect the promise to reject with the error message 'fail'
      await expect(dao.getPayInByClientRefNoDao('refno', mockConn())).rejects.toThrow('fail');
      // We also expect that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getPayInsForCronDao', () => {
    it('should select and return rows', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 14 }] });
      const result = await dao.getPayInsForCronDao({}, mockConn());
      // We can check if the select query was built with expected parameters if needed
      expect(Array.isArray(result)).toBe(true);
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      // We expect the promise to reject with the error message 'fail'
      await expect(dao.getPayInsForCronDao({}, mockConn())).rejects.toThrow('fail');
      // We also expect that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getExpiredPayInsDao', () => {
    it('should select and return rows', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 15 }] });
      const result = await dao.getExpiredPayInsDao('expire', 'status', 'created_at', mockConn());
      // We can check if the select query was built with expected parameters if needed
      expect(Array.isArray(result)).toBe(true);
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      // We expect the promise to reject with the error message 'fail'
      await expect(dao.getExpiredPayInsDao('expire', 'status', 'created_at', mockConn())).rejects.toThrow('fail');
      // We also expect that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getPayInsForCronByDateRangeDao', () => {
    it('should select and return rows', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 16 }] });
      const result = await dao.getPayInsForCronByDateRangeDao({ statuses: ['A'], isNotified: true, startTime: 1, endTime: 2, maxRows: 10 }, mockConn());
      // We can check if the select query was built with expected parameters if needed
      expect(Array.isArray(result)).toBe(true);
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      // We expect the promise to reject with the error message 'fail'
      await expect(dao.getPayInsForCronByDateRangeDao({ statuses: ['A'], isNotified: true, startTime: 1, endTime: 2, maxRows: 10 }, mockConn())).rejects.toThrow('fail');
      // We also expect that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getPayInForTelegramUtrDao', () => {
    it('should select and return row or null', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 17 }] });
      const result = await dao.getPayInForTelegramUtrDao({}, mockConn());
      // We can check if the select query was built with expected parameters if needed
      expect(result).toEqual({ id: 17 });
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      // We expect the promise to reject with the error message 'fail'
      await expect(dao.getPayInForTelegramUtrDao({}, mockConn())).rejects.toThrow('fail');
      // We also expect that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getPayInForResetDao', () => {
    it('should select and return row or null', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 18 }] });
      const result = await dao.getPayInForResetDao({}, mockConn());
      // We can check if the select query was built with expected parameters if needed
      expect(result).toEqual({ id: 18 });
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      // We expect the promise to reject with the error message 'fail'
      await expect(dao.getPayInForResetDao({}, mockConn())).rejects.toThrow('fail');
      // We also expect that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getPayInForTelegramResponseDao', () => {
    it('should select and return row or null', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 19 }] });
      const result = await dao.getPayInForTelegramResponseDao({}, mockConn());
      // We can check if the select query was built with expected parameters if needed
      expect(result).toEqual({ id: 19 });
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      // We expect the promise to reject with the error message 'fail'
      await expect(dao.getPayInForTelegramResponseDao({}, mockConn())).rejects.toThrow('fail');
      // We also expect that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getPayInForTelegramResponseArrayDao', () => {
    it('should select and return rows', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 20 }] });
      const result = await dao.getPayInForTelegramResponseArrayDao({}, mockConn());
      // We can check if the select query was built with expected parameters if needed
      expect(Array.isArray(result)).toBe(true);
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      // We expect the promise to reject with the error message 'fail'
      await expect(dao.getPayInForTelegramResponseArrayDao({}, mockConn())).rejects.toThrow('fail');
      // We also expect that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getPayInResetBasicDao', () => {
    it('should select and return row or null', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 21 }] });
      const result = await dao.getPayInResetBasicDao({}, mockConn());
      // We can check if the select query was built with expected parameters if needed
      expect(result).toEqual({ id: 21 });
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      // We expect the promise to reject with the error message 'fail'
      await expect(dao.getPayInResetBasicDao({}, mockConn())).rejects.toThrow('fail');
      // We also expect that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getPayInForExpireDao', () => {
    it('should select and return row or null', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 22 }] });
      const result = await dao.getPayInForExpireDao({}, mockConn());
      // We can check if the select query was built with expected parameters if needed
      expect(result).toEqual({ id: 22 });
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      // We expect the promise to reject with the error message 'fail'
      await expect(dao.getPayInForExpireDao({}, mockConn())).rejects.toThrow('fail');
      // We also expect that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getPayInPendingDao', () => {
    it('should select and return rows', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 23 }] });
      const result = await dao.getPayInPendingDao({ company_id: 1, status: 'PENDING' }, mockConn());
      // We can check if the select query was built with expected parameters if needed
      expect(Array.isArray(result)).toBe(true);
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      // We expect the promise to reject with the error message 'fail'
      await expect(dao.getPayInPendingDao({ company_id: 1, status: 'PENDING' }, mockConn())).rejects.toThrow('fail');
      // We also expect that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getPayInDaoByCode', () => {
    it('should select and return rows', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 24 }] });
      const result = await dao.getPayInDaoByCode({ id: 1, company_id: 2 }, mockConn());
      // We can check if the select query was built with expected parameters if needed
      expect(Array.isArray(result)).toBe(true);
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      // We expect the promise to reject with the error message 'fail'
      await expect(dao.getPayInDaoByCode({ id: 1, company_id: 2 }, mockConn())).rejects.toThrow('fail');
      // We also expect that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });
});
