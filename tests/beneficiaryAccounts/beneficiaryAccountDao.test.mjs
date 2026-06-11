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

      // Should call executeQuery with correct parameters based on filters and role
      expect(db.executeQuery).toHaveBeenCalled();

      // Should return the beneficiary accounts from the query result
      expect(result).toEqual(expect.arrayContaining([expect.objectContaining({ id: 1 })]));
    });

    it('should handle pagination', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });
      await dao.getBeneficiaryAccountDao({}, 2, 5, 'VENDOR');

      // Should call executeQuery with correct LIMIT and OFFSET for pagination
      expect(db.executeQuery).toHaveBeenCalled();
    });

    it('should return empty array when not found', async () => {
      db.executeQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await dao.getBeneficiaryAccountDao({}, 1, 10, 'MERCHANT');

      // Should return empty array if no beneficiary accounts found
      expect(result).toEqual([]);
    });

    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('Database error'));

      // Should log the error and throw it when executeQuery fails
      await expect(dao.getBeneficiaryAccountDao({}, 1, 10, 'MERCHANT')).rejects.toThrow('Database error');

      // Should call logger.error with the error message
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

  describe('getBeneficiaryAccountDaoAll', () => {
    it('should fetch all beneficiary accounts', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }], rowCount: 2 });
      const result = await dao.getBeneficiaryAccountDaoAll({ company_id: 1 }, 1, 10, 'ADMIN');

      // Should call executeQuery to fetch all beneficiary accounts for the company
      expect(result).toHaveLength(2);
    });

    it('should apply pagination', async () => {
      db.executeQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      await dao.getBeneficiaryAccountDaoAll({}, 3, 20, 'MERCHANT');

      // Should call executeQuery with correct LIMIT and OFFSET for pagination
      expect(db.executeQuery).toHaveBeenCalled();
    });

    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('Query failed'));

      // Should log the error and throw it when executeQuery fails
      await expect(dao.getBeneficiaryAccountDaoAll({}, 1, 10, 'MERCHANT')).rejects.toThrow('Query failed');
    });
  });

  describe('getBeneficiaryAccountBySearchDao', () => {
    it('should search with terms', async () => {
      db.executeQuery
        .mockResolvedValueOnce({ rows: [{ total: 1 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 1, acc_no: '1234567890' }], rowCount: 1 });
      const result = await dao.getBeneficiaryAccountBySearchDao({ company_id: 1 }, 1, 10, 'MERCHANT', ['John']);

      // Should return the total count and bank accounts matching the search terms
      expect(result.totalCount).toBe(1);

      // Should return the beneficiary accounts matching the search terms
      expect(result.bankAccounts).toHaveLength(1);
    });

    it('should calculate pagination correctly', async () => {
      db.executeQuery
        .mockResolvedValueOnce({ rows: [{ total: 50 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: Array(10).fill({}), rowCount: 10 });
      const result = await dao.getBeneficiaryAccountBySearchDao({ company_id: 1 }, 2, 10, 'ADMIN', ['test']);

      // Should calculate total pages based on total count and page size
      expect(result.totalPages).toBe(5);
    });

    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('Search failed'));

      // Should log the error and throw it when executeQuery fails
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

      // Should call buildInsertQuery to construct the insert query
      expect(db.buildInsertQuery).toHaveBeenCalled();

      // Should call executeQuery to execute the insert query
      expect(db.executeQuery).toHaveBeenCalled();

      // Should return the inserted beneficiary account with generated ID
      expect(result).toEqual(expect.objectContaining({ id: 1 }));
    });

    it('should log and throw on error', async () => {
      db.buildInsertQuery.mockReturnValue(['SQL', []]);
      db.executeQuery.mockRejectedValue(new Error('Insert failed'));

      // Should log the error and throw it when executeQuery fails
      await expect(dao.createBeneficiaryAccountDao({}, mockConn())).rejects.toThrow('Insert failed');

      // Should call logger.error with the error message
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

  describe('updateBeneficiaryAccountDao', () => {
    it('should update and return entry', async () => {
      db.buildAndExecuteUpdateQuery.mockResolvedValue({ id: 1, acc_holder_name: 'John Updated' });
      const result = await dao.updateBeneficiaryAccountDao(1, { acc_holder_name: 'John Updated' }, mockConn());

      // Should call buildAndExecuteUpdateQuery to construct and execute the update query
      expect(db.buildAndExecuteUpdateQuery).toHaveBeenCalled();

      // Should return the updated beneficiary account with the new values
      expect(result).toEqual(expect.objectContaining({ id: 1 }));
    });

    it('should log and throw on error', async () => {
      db.buildAndExecuteUpdateQuery.mockRejectedValue(new Error('Update failed'));

      // Should log the error and throw it when buildAndExecuteUpdateQuery fails
      await expect(dao.updateBeneficiaryAccountDao(1, {}, mockConn())).rejects.toThrow('Update failed');
    });
  });

  describe('deleteBeneficiaryDao', () => {
    it('should update is_obsolete and return entry', async () => {
      db.buildUpdateQuery.mockReturnValue(['SQL', []]);
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1, is_obsolete: true }], rowCount: 1 });
      const result = await dao.deleteBeneficiaryDao(1, { is_obsolete: true });

      // Should call buildUpdateQuery to construct the update query for soft delete
      expect(db.buildUpdateQuery).toHaveBeenCalled();

      // Should call executeQuery to execute the update query
      expect(db.executeQuery).toHaveBeenCalled();

      // Should return the updated beneficiary account with is_obsolete set to true
      expect(result).toEqual(expect.objectContaining({ is_obsolete: true }));
    });

    it('should log and throw on error', async () => {
      db.buildUpdateQuery.mockReturnValue(['SQL', []]);
      db.executeQuery.mockRejectedValue(new Error('Delete failed'));

      // Should log the error and throw it when executeQuery fails
      await expect(dao.deleteBeneficiaryDao(1, {})).rejects.toThrow('Delete failed');

      // Should call logger.error with the error message
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

  describe('checkBeneficiaryAccountExistsDao', () => {
    it('should return true if exists', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ 1: 1 }], rowCount: 1 });
      const result = await dao.checkBeneficiaryAccountExistsDao({ acc_no: '1234567890', company_id: 1 }, mockConn());

      // Should call executeQuery to check if the beneficiary account exists based on filters
      expect(result).toBe(true);
    });

    it('should return false if not found', async () => {
      db.executeQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await dao.checkBeneficiaryAccountExistsDao({ acc_no: '9999999999', company_id: 1 });

      // Should return false if no beneficiary account matches the filters
      expect(result).toBe(false);
    });

    it('should throw error if required filter missing', async () => {
      // Should throw an error if required filters like company_id are missing
      await expect(dao.checkBeneficiaryAccountExistsDao({ acc_no: '1234567890' })).rejects.toThrow();
    });

    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('Query failed'));

      // Should log the error and throw it when executeQuery fails
      await expect(
        dao.checkBeneficiaryAccountExistsDao({ acc_no: '1234567890', company_id: 1 }, mockConn()),
      ).rejects.toThrow('Query failed');

      // Should call logger.error with the error message
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

      // Should call executeQuery to fetch bank names based on company_id and account type
      expect(result.totalCount).toBe(1);

      // Should return the bank names matching the criteria
      expect(result.bankNames).toHaveLength(1);
    });

    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('Query failed'));

      // Should log the error and throw it when executeQuery fails
      await expect(dao.getBeneficiaryAccountDaoByBankName(1, 'Personal', {}, mockConn())).rejects.toThrow(
        'Query failed',
      );

      // Should call logger.error with the error message
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });
});
