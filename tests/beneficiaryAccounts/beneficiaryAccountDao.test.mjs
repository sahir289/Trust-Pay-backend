// -------------------- ESM MOCKS --------------------
/* global describe, it, expect, beforeEach, afterEach, beforeAll */
import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/constants/index.js', () => ({
  Role: { MERCHANT: 'MERCHANT', VENDOR: 'VENDOR', ADMIN: 'ADMIN', SUB_MERCHANT: 'SUB_MERCHANT', SUB_VENDOR: 'SUB_VENDOR', VENDOR_OPERATIONS: 'VENDOR_OPERATIONS', MERCHANT_OPERATIONS: 'MERCHANT_OPERATIONS', VENDOR_ADMIN: 'VENDOR_ADMIN' },
  tableName: { BENEFICIARY_ACCOUNTS: 'BeneficiaryAccounts' },
}));
jest.unstable_mockModule('../../src/utils/appErrors.js', () => ({
  BadRequestError: class extends Error {},
  ValidationError: class extends Error {},
}));
jest.unstable_mockModule('../../src/utils/db.js', () => ({
  buildInsertQuery: jest.fn(() => ['SQL', []]),
  buildUpdateQuery: jest.fn(() => ['SQL', []]),
  buildAndExecuteUpdateQuery: jest.fn(),
  executeQuery: jest.fn(async () => ({ rows: [{}], rowCount: 1 })),
}));
jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// -------------------- HELPERS ----------------------
function mockConn() {
  return { query: jest.fn(), release: jest.fn() };
}

// -------------------- IMPORTS ----------------------
let dao, db, logger;
beforeAll(async () => {
  dao = await import('../../src/apis/beneficiaryAccounts/beneficiaryAccountDao.js');
  db = await import('../../src/utils/db.js');
  logger = await import('../../src/utils/logger.js');
});

beforeEach(() => {
  if (db) {
    db.buildInsertQuery = jest.fn(() => ['SQL', []]);
    db.buildUpdateQuery = jest.fn(() => ['SQL', []]);
    db.buildAndExecuteUpdateQuery = jest.fn();
    db.executeQuery = jest.fn(async () => ({ rows: [{}], rowCount: 1 }));
  }
  if (logger?.logger) {
    logger.logger.error = jest.fn();
    logger.logger.info = jest.fn();
    logger.logger.warn = jest.fn();
  }
});

afterEach(() => {
  jest.clearAllMocks();
});

// -------------------- TESTS ----------------------
describe('beneficiaryAccountDao', () => {
  describe('getBeneficiaryAccountDao', () => {
    it('should fetch beneficiary accounts with filters', async () => {
      db.executeQuery.mockResolvedValue({
        rows: [{ id: 1, acc_no: '1234567890', acc_holder_name: 'John Doe' }],
        rowCount: 1,
      });
      const result = await dao.getBeneficiaryAccountDao({ company_id: 1 }, 1, 10, 'MERCHANT', mockConn());
      expect(db.executeQuery).toHaveBeenCalled();
      expect(result).toEqual(expect.arrayContaining([expect.objectContaining({ id: 1 })]));
    });

    it('should handle pagination', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });
      await dao.getBeneficiaryAccountDao({}, 2, 5, 'VENDOR');
      expect(db.executeQuery).toHaveBeenCalled();
    });

    it('should return empty array when not found', async () => {
      db.executeQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await dao.getBeneficiaryAccountDao({}, 1, 10, 'MERCHANT');
      expect(result).toEqual([]);
    });

    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('Database error'));
      await expect(dao.getBeneficiaryAccountDao({}, 1, 10, 'MERCHANT')).rejects.toThrow('Database error');
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

  describe('getBeneficiaryAccountDaoAll', () => {
    it('should fetch all beneficiary accounts', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }], rowCount: 2 });
      const result = await dao.getBeneficiaryAccountDaoAll({ company_id: 1 }, 1, 10, 'ADMIN');
      expect(result).toHaveLength(2);
    });

    it('should apply pagination', async () => {
      db.executeQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      await dao.getBeneficiaryAccountDaoAll({}, 3, 20, 'MERCHANT');
      expect(db.executeQuery).toHaveBeenCalled();
    });

    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('Query failed'));
      await expect(dao.getBeneficiaryAccountDaoAll({}, 1, 10, 'MERCHANT')).rejects.toThrow('Query failed');
    });
  });

  describe('getBeneficiaryAccountBySearchDao', () => {
    it('should search with terms', async () => {
      db.executeQuery
        .mockResolvedValueOnce({ rows: [{ total: 1 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 1, acc_no: '1234567890' }], rowCount: 1 });
      const result = await dao.getBeneficiaryAccountBySearchDao({ company_id: 1 }, 1, 10, 'MERCHANT', ['John']);
      expect(result.totalCount).toBe(1);
      expect(result.bankAccounts).toHaveLength(1);
    });

    it('should calculate pagination correctly', async () => {
      db.executeQuery
        .mockResolvedValueOnce({ rows: [{ total: 50 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: Array(10).fill({}), rowCount: 10 });
      const result = await dao.getBeneficiaryAccountBySearchDao({ company_id: 1 }, 2, 10, 'ADMIN', ['test']);
      expect(result.totalPages).toBe(5);
    });

    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('Search failed'));
      await expect(
        dao.getBeneficiaryAccountBySearchDao({ company_id: 1 }, 1, 10, 'MERCHANT', ['test']),
      ).rejects.toThrow('Search failed');
    });
  });

  describe('createBeneficiaryAccountDao', () => {
    it('should insert and return entry', async () => {
      db.buildInsertQuery.mockReturnValue(['SQL', []]);
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1, acc_no: '9876543210' }], rowCount: 1 });
      const result = await dao.createBeneficiaryAccountDao({ acc_no: '9876543210' }, mockConn());
      expect(db.buildInsertQuery).toHaveBeenCalled();
      expect(db.executeQuery).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ id: 1 }));
    });

    it('should log and throw on error', async () => {
      db.buildInsertQuery.mockReturnValue(['SQL', []]);
      db.executeQuery.mockRejectedValue(new Error('Insert failed'));
      await expect(dao.createBeneficiaryAccountDao({}, mockConn())).rejects.toThrow('Insert failed');
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

  describe('updateBeneficiaryAccountDao', () => {
    it('should update and return entry', async () => {
      db.buildAndExecuteUpdateQuery.mockResolvedValue({ id: 1, acc_holder_name: 'John Updated' });
      const result = await dao.updateBeneficiaryAccountDao(1, { acc_holder_name: 'John Updated' }, mockConn());
      expect(db.buildAndExecuteUpdateQuery).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ id: 1 }));
    });

    it('should log and throw on error', async () => {
      db.buildAndExecuteUpdateQuery.mockRejectedValue(new Error('Update failed'));
      await expect(dao.updateBeneficiaryAccountDao(1, {}, mockConn())).rejects.toThrow('Update failed');
    });
  });

  describe('deleteBeneficiaryDao', () => {
    it('should update is_obsolete and return entry', async () => {
      db.buildUpdateQuery.mockReturnValue(['SQL', []]);
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1, is_obsolete: true }], rowCount: 1 });
      const result = await dao.deleteBeneficiaryDao(1, { is_obsolete: true });
      expect(db.buildUpdateQuery).toHaveBeenCalled();
      expect(db.executeQuery).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ is_obsolete: true }));
    });

    it('should log and throw on error', async () => {
      db.buildUpdateQuery.mockReturnValue(['SQL', []]);
      db.executeQuery.mockRejectedValue(new Error('Delete failed'));
      await expect(dao.deleteBeneficiaryDao(1, {})).rejects.toThrow('Delete failed');
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

  describe('checkBeneficiaryAccountExistsDao', () => {
    it('should return true if exists', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ 1: 1 }], rowCount: 1 });
      const result = await dao.checkBeneficiaryAccountExistsDao({ acc_no: '1234567890', company_id: 1 }, mockConn());
      expect(result).toBe(true);
    });

    it('should return false if not found', async () => {
      db.executeQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await dao.checkBeneficiaryAccountExistsDao({ acc_no: '9999999999', company_id: 1 });
      expect(result).toBe(false);
    });

    it('should throw error if required filter missing', async () => {
      await expect(dao.checkBeneficiaryAccountExistsDao({ acc_no: '1234567890' })).rejects.toThrow();
    });

    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('Query failed'));
      await expect(
        dao.checkBeneficiaryAccountExistsDao({ acc_no: '1234567890', company_id: 1 }, mockConn()),
      ).rejects.toThrow('Query failed');
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

  describe('getBeneficiaryAccountDaoByBankName', () => {
    it('should select and return rows', async () => {
      db.executeQuery.mockResolvedValue({
        rows: [{ label: 'ICICI Bank', value: 1 }],
        rowCount: 1,
      });
      const result = await dao.getBeneficiaryAccountDaoByBankName(1, 'Personal', {}, mockConn());
      expect(result.totalCount).toBe(1);
      expect(result.bankNames).toHaveLength(1);
    });

    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('Query failed'));
      await expect(dao.getBeneficiaryAccountDaoByBankName(1, 'Personal', {}, mockConn())).rejects.toThrow(
        'Query failed',
      );
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });
});
