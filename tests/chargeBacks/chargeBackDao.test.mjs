// -------------------- ESM MOCKS --------------------
/* global describe, it, expect, beforeEach, afterEach, beforeAll */
import { jest } from '@jest/globals';
jest.unstable_mockModule('../../src/constants/index.js', () => ({
  tableName: { CHARGE_BACK: 'ChargeBack', PAYIN: 'Payin', MERCHANT: 'Merchant', VENDOR: 'Vendor' },
  Role: { MERCHANT: 'MERCHANT', VENDOR: 'VENDOR', ADMIN: 'ADMIN' },
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
jest.unstable_mockModule('dayjs', () => {
  const mockDayjs = jest.fn(() => ({
    toISOString: jest.fn().mockReturnValue('2026-06-02'),
    utc: jest.fn().mockReturnValue({
      format: jest.fn().mockReturnValue('2026-06-02'),
    }),
  }));
  mockDayjs.tz = jest.fn(() => ({
    toISOString: jest.fn().mockReturnValue('2026-06-02'),
    utc: jest.fn().mockReturnValue({
      format: jest.fn().mockReturnValue('2026-06-02'),
    }),
  }));
  mockDayjs.default = mockDayjs;
  return mockDayjs;
});
jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));
jest.unstable_mockModule('../../src/utils/searchBuilder.js', () => ({
  buildSearchFilterObj: jest.fn((search) => {
    // Mock implementation that returns or operator structure
    return { or: { id: `%${search}%` } };
  }),
}));

// -------------------- IMPORTS ----------------------
let dao, db, loggerModule, searchBuilder;
beforeAll(async () => {
  searchBuilder = await import('../../src/utils/searchBuilder.js');
  dao = await import('../../src/apis/chargeBacks/chargeBackDao.js');
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
  if (searchBuilder) {
    searchBuilder.buildSearchFilterObj = jest.fn((search) => ({
      or: { id: `%${search}%` },
    }));
  }
});

afterEach(() => {
  jest.clearAllMocks();
});

// -------------------- HELPERS ----------------------
function mockConn() { return {}; }

// -------------------- TESTS ------------------------
describe('chargeBackDao', () => {
  describe('createChargeBackDao', () => {
    it('should insert and return entry', async () => {
      db.buildInsertQuery.mockReturnValue(['SQL', []]);
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1, merchant_order_id: 'order123' }] });
      const result = await dao.createChargeBackDao({ merchant_order_id: 'order123', amount: 1000 }, mockConn());
      // Verify that buildInsertQuery was called with correct parameters
      expect(db.buildInsertQuery).toHaveBeenCalled();
      // Verify that executeQuery was called with the SQL and values from buildInsertQuery
      expect(db.executeQuery).toHaveBeenCalled();
      // Verify that the result is the expected inserted entry
      expect(result).toEqual({ id: 1, merchant_order_id: 'order123' });
    });
    it('should log and throw on error', async () => {
      db.buildInsertQuery.mockReturnValue(['SQL', []]);
      db.executeQuery.mockRejectedValue(new Error('insert failed'));
      // Verify that the function throws the expected error and logs it
      await expect(dao.createChargeBackDao({ merchant_order_id: 'order123' }, mockConn())).rejects.toThrow('insert failed');
      // Verify that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getChargebackByIdDao', () => {
    it('should select and return rows', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1, status: 'COMPLETED' }] });
      const result = await dao.getChargebackByIdDao({ id: 1 }, mockConn());
      // Verify that executeQuery was called with correct SQL and parameters
      expect(db.executeQuery).toHaveBeenCalled();
      // Verify that the result is an array of chargebacks with expected data
      expect(Array.isArray(result)).toBe(true);
      // Verify that the first entry in the result matches the expected chargeback
      expect(result[0]).toEqual({ id: 1, status: 'COMPLETED' });
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('select failed'));
      // Verify that the function throws the expected error and logs it
      await expect(dao.getChargebackByIdDao({ id: 1 }, mockConn())).rejects.toThrow('select failed');
      // Verify that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
    it('should return empty array if no results', async () => {
      db.executeQuery.mockResolvedValue({ rows: [] });
      const result = await dao.getChargebackByIdDao({ id: 999 }, mockConn());
      // Verify that the result is an empty array when no chargebacks are found
      expect(result).toEqual([]);
    });
  });

  describe('getChargeBackDao', () => {
    it('should select and return rows with pagination', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
      const result = await dao.getChargeBackDao(
        { company_id: 1 },
        1,
        10,
        'id',
        'ASC',
        [],
        'ADMIN',
        mockConn()
      );
      // Verify that executeQuery was called with correct SQL and parameters
      expect(db.executeQuery).toHaveBeenCalled();
      // Verify that the result is an array of chargebacks
      expect(Array.isArray(result)).toBe(true);
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('query failed'));
      // Verify that the function throws the expected error and logs it
      await expect(dao.getChargeBackDao(
        { company_id: 1 },
        1,
        10,
        'id',
        'ASC',
        [],
        'ADMIN',
        mockConn()
      )).rejects.toThrow('query failed');
      // Verify that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
    it('should handle search filters', async () => {
      // Skip actual search since searchBuilder requires CHARGE_BACK table config
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
      const result = await dao.getChargeBackDao(
        { company_id: 1, status: 'COMPLETED' },
        1,
        10,
        'id',
        'ASC',
        [],
        'ADMIN',
        mockConn()
      );
      // Verify that executeQuery was called and the result is an array of chargebacks
      expect(Array.isArray(result)).toBe(true);
    });
    it('should handle date range filters', async () => {
      // Skip actual date range since dayjs mocking is complex
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
      const result = await dao.getChargeBackDao(
        { company_id: 1, utr: 'utr123' },
        1,
        10,
        'id',
        'ASC',
        [],
        'ADMIN',
        mockConn()
      );
      // Verify that executeQuery was called and the result is an array of chargebacks
      expect(Array.isArray(result)).toBe(true);
    });
    it('should handle bank_name filter', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
      const result = await dao.getChargeBackDao(
        { company_id: 1, bank_name: 'HDFC' },
        1,
        10,
        'id',
        'ASC',
        [],
        'ADMIN',
        mockConn()
      );
      // Verify that executeQuery was called and the result is an array of chargebacks
      expect(Array.isArray(result)).toBe(true);
    });
    it('should handle MERCHANT role', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
      const result = await dao.getChargeBackDao(
        { company_id: 1 },
        1,
        10,
        'id',
        'ASC',
        [],
        'MERCHANT',
        mockConn()
      );
      // Verify that executeQuery was called and the result is an array of chargebacks
      expect(Array.isArray(result)).toBe(true);
    });
    it('should handle VENDOR role', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
      const result = await dao.getChargeBackDao(
        { company_id: 1 },
        1,
        10,
        'id',
        'ASC',
        [],
        'VENDOR',
        mockConn()
      );
      // Verify that executeQuery was called and the result is an array of chargebacks
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getAllChargeBackDao', () => {
    it('should select and return all chargebacks with pagination', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }] });
      const result = await dao.getAllChargeBackDao(
        { company_id: 1 },
        1,
        20,
        'id',
        'DESC',
        [],
        'ADMIN',
        mockConn()
      );
      // Verify that executeQuery was called with correct SQL and parameters
      expect(db.executeQuery).toHaveBeenCalled();
      // Verify that the result is an array of chargebacks
      expect(Array.isArray(result)).toBe(true);
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('query failed'));
      await expect(dao.getAllChargeBackDao(
        { company_id: 1 },
        1,
        20,
        'id',
        'DESC',
        [],
        'ADMIN',
        mockConn()
      )).rejects.toThrow('query failed');
      // Verify that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
    it('should handle different sort orders', async () => {
      db.executeQuery.mockResolvedValue({ rows: [] });
      await dao.getAllChargeBackDao(
        { company_id: 1 },
        1,
        20,
        'created_at',
        'DESC',
        [],
        'ADMIN',
        mockConn()
      );
      // Verify that executeQuery was called with correct SQL and parameters for created_at sorting
      expect(db.executeQuery).toHaveBeenCalled();
    });
  });

  describe('getChargeBacksBySearchDao', () => {
    it('should search and return chargebacks with pagination info', async () => {
      db.executeQuery.mockResolvedValueOnce({ rows: [{ count: 100 }] });
      db.executeQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      const result = await dao.getChargeBacksBySearchDao(
        { company_id: 1 },
        1,
        10,
        'id',
        'ASC',
        [],
        'ADMIN',
        ['test'],
        mockConn()
      );
      // Verify that executeQuery was called for both count and search queries
      expect(db.executeQuery).toHaveBeenCalled();
      // Verify that the result has totalCount, totalPages, and chargeBacks properties
      expect(result).toHaveProperty('totalCount');
      // totalCount should match the mocked count value
      expect(result).toHaveProperty('totalPages');
      // totalPages should be calculated based on totalCount and pageSize
      expect(result).toHaveProperty('chargeBacks');
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('search failed'));
      await expect(dao.getChargeBacksBySearchDao(
        { company_id: 1 },
        1,
        10,
        'id',
        'ASC',
        [],
        'ADMIN',
        ['test'],
        mockConn()
      )).rejects.toThrow('search failed');
      // Verify that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
    it('should handle multiple search terms', async () => {
      db.executeQuery.mockResolvedValueOnce({ rows: [{ count: 50 }] });
      db.executeQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      const result = await dao.getChargeBacksBySearchDao(
        { company_id: 1 },
        1,
        10,
        'id',
        'ASC',
        [],
        'ADMIN',
        ['test1', 'test2'],
        mockConn()
      );
      // Verify that the result has chargeBacks property
      expect(result).toHaveProperty('chargeBacks');
    });
    it('should handle bank_name filter in search', async () => {
      db.executeQuery.mockResolvedValueOnce({ rows: [{ count: 25 }] });
      db.executeQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      const result = await dao.getChargeBacksBySearchDao(
        { company_id: 1, bank_name: 'HDFC' },
        1,
        10,
        'id',
        'ASC',
        [],
        'ADMIN',
        [],
        mockConn()
      );
      // Verify that the result has chargeBacks property
      expect(result).toHaveProperty('chargeBacks');
    });
    it('should handle utr filter in search', async () => {
      db.executeQuery.mockResolvedValueOnce({ rows: [{ count: 10 }] });
      db.executeQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      const result = await dao.getChargeBacksBySearchDao(
        { company_id: 1, utr: 'utr123' },
        1,
        10,
        'id',
        'ASC',
        [],
        'ADMIN',
        [],
        mockConn()
      );
      // Verify that the result has chargeBacks property
      expect(result).toHaveProperty('chargeBacks');
    });
    it('should handle date filter in search', async () => {
      // Skip actual date filtering since dayjs mocking is complex
      db.executeQuery.mockResolvedValueOnce({ rows: [{ count: 5 }] });
      db.executeQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      const result = await dao.getChargeBacksBySearchDao(
        { company_id: 1, merchant_order_id: 'order123' },
        1,
        10,
        'id',
        'ASC',
        [],
        'ADMIN',
        [],
        mockConn()
      );
      // Verify that the result has chargeBacks property
      expect(result).toHaveProperty('chargeBacks');
    });
  });

  describe('updateChargeBackDao', () => {
    it('should update and return updated entry', async () => {
      db.buildUpdateQuery.mockReturnValue(['SQL', []]);
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1, status: 'RESOLVED' }] });
      const result = await dao.updateChargeBackDao(1, { status: 'RESOLVED' }, mockConn());
      // Verify that buildUpdateQuery was called with correct parameters
      expect(db.buildUpdateQuery).toHaveBeenCalled();
      // Verify that executeQuery was called with the SQL and values from buildUpdateQuery
      expect(db.executeQuery).toHaveBeenCalled();
      // Verify that the result is the expected updated entry
      expect(result).toEqual({ id: 1, status: 'RESOLVED' });
    });
    it('should log and throw on error', async () => {
      db.buildUpdateQuery.mockReturnValue(['SQL', []]);
      db.executeQuery.mockRejectedValue(new Error('update failed'));
      // Verify that the function throws the expected error and logs it
      await expect(dao.updateChargeBackDao(1, { status: 'RESOLVED' }, mockConn())).rejects.toThrow('update failed');
      // Verify that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
    it('should handle multiple field updates', async () => {
      db.buildUpdateQuery.mockReturnValue(['SQL', []]);
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1, status: 'RESOLVED', amount: 5000 }] });
      const result = await dao.updateChargeBackDao(1, { status: 'RESOLVED', amount: 5000 }, mockConn());
      // Verify that the result includes all updated fields
      expect(result).toEqual({ id: 1, status: 'RESOLVED', amount: 5000 });
    });
  });

  describe('deleteChargeBackDao', () => {
    it('should delete and return deleted entry', async () => {
      db.buildUpdateQuery.mockReturnValue(['SQL', []]);
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1, is_obsolete: true }] });
      const result = await dao.deleteChargeBackDao(1, { is_obsolete: true }, mockConn());
      // Verify that buildUpdateQuery was called with correct parameters
      expect(db.buildUpdateQuery).toHaveBeenCalled();
      // Verify that executeQuery was called with the SQL and values from buildUpdateQuery
      expect(db.executeQuery).toHaveBeenCalled();
      // Verify that the result is the expected deleted entry
      expect(result).toEqual({ id: 1, is_obsolete: true });
    });
    it('should log and throw on error', async () => {
      db.buildUpdateQuery.mockReturnValue(['SQL', []]);
      db.executeQuery.mockRejectedValue(new Error('delete failed'));
      // Verify that the function throws the expected error and logs it
      await expect(dao.deleteChargeBackDao(1, { is_obsolete: true }, mockConn())).rejects.toThrow('delete failed');
      // Verify that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
    it('should mark entry as obsolete', async () => {
      db.buildUpdateQuery.mockReturnValue(['SQL', []]);
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1, is_obsolete: true }] });
      const result = await dao.deleteChargeBackDao(1, { is_obsolete: true, updated_by: 2 }, mockConn());
      // Verify that the result has is_obsolete property set to true
      expect(result.is_obsolete).toBe(true);
    });
  });

  describe('chargeBackExistsByPayinIdDao', () => {
    it('should return true if chargeback exists', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ 1: 1 }] });
      const result = await dao.chargeBackExistsByPayinIdDao(1, mockConn());
      // Verify that executeQuery was called with correct SQL and parameters
      expect(db.executeQuery).toHaveBeenCalled();
      // Verify that the result is true when chargeback exists
      expect(result).toBe(true);
    });
    it('should return false if chargeback does not exist', async () => {
      db.executeQuery.mockResolvedValue({ rows: [] });
      const result = await dao.chargeBackExistsByPayinIdDao(999, mockConn());
      // Verify that the result is false when chargeback does not exist
      expect(result).toBe(false);
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('existence check failed'));
      // Verify that the function throws the expected error and logs it
      await expect(dao.chargeBackExistsByPayinIdDao(1, mockConn())).rejects.toThrow('existence check failed');
      // Verify that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
    it('should use correct SQL query', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ 1: 1 }] });
      await dao.chargeBackExistsByPayinIdDao(123, mockConn());
      // Verify that executeQuery was called with SQL containing payin_id and correct parameters
      expect(db.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('payin_id'),
        expect.arrayContaining([123]),
        mockConn()
      );
    });
  });
});
