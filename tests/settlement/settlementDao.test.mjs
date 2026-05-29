// -------------------- ESM MOCKS --------------------
/* global describe, it, expect, beforeEach, afterEach, beforeAll */
import { jest } from '@jest/globals';
jest.unstable_mockModule('../../src/constants/index.js', () => ({
  tableName: { SETTLEMENT: 'Settlement', USER: 'User', ROLE: 'Role', BENEFICIARY_ACCOUNTS: 'BeneficiaryAccounts', MERCHANT: 'Merchant', VENDOR: 'Vendor' },
  Status: { SUCCESS: 'SUCCESS', REJECTED: 'REJECTED', REVERSED: 'REVERSED' },
  Role: { ADMIN: 'ADMIN', MERCHANT: 'MERCHANT', VENDOR: 'VENDOR' },
}));
jest.unstable_mockModule('../../src/utils/db.js', () => ({
  buildInsertQuery: jest.fn(() => ['INSERT INTO ...', ['a', 'b']]),
  buildUpdateQuery: jest.fn(() => ['UPDATE ...', ['a', 'b']]),
  executeQuery: jest.fn(async () => ({ rows: [{ id: 'settle-id', user_id: 'user-uuid', status: 'INITIATED' }] })),
}));
jest.unstable_mockModule('dayjs', () => Object.assign(() => jest.fn(), { default: jest.fn() }));
jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// -------------------- IMPORTS ----------------------
let dao, db, loggerModule;
beforeAll(async () => {
  dao = await import('../../src/apis/settlement/settlementDao.js');
  db = await import('../../src/utils/db.js');
  loggerModule = await import('../../src/utils/logger.js');
});

beforeEach(() => {
  if (db) {
    db.buildInsertQuery = jest.fn(() => ['INSERT INTO ...', ['a', 'b']]);
    db.buildUpdateQuery = jest.fn(() => ['UPDATE ...', ['a', 'b']]);
    db.executeQuery = jest.fn(async () => ({ rows: [{ id: 'settle-id', user_id: 'user-uuid', status: 'INITIATED' }] }));
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

function mockConn() { return {}; }

// -------------------- TESTS ------------------------
describe('settlementDao', () => {
  describe('createSettlementDao', () => {
    it('should insert and return entry', async () => {
      db.buildInsertQuery.mockReturnValue(['INSERT INTO ...', ['a', 'b']]);
      const goodConn = { query: jest.fn(() => Promise.resolve({ rows: [{ id: 'settle-id' }] })) };
      const result = await dao.createSettlementDao({ foo: 'bar' }, goodConn);
      expect(db.buildInsertQuery).toHaveBeenCalled();
      expect(goodConn.query).toHaveBeenCalled();
      expect(result).toEqual({ id: 'settle-id' });
    });
    it('should handle empty result', async () => {
      const emptyConn = { query: jest.fn(() => Promise.resolve({ rows: [] })) };
      const result = await dao.createSettlementDao({ foo: 'bar' }, emptyConn);
      expect(result).toBeUndefined();
    });
    it('should work without conn', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 'settle-id' }] });
      const result = await dao.createSettlementDao({ foo: 'bar' });
      expect(result).toEqual({ id: 'settle-id' });
    });
    it('should log and throw on error', async () => {
      const badConn = { query: jest.fn(() => { throw new Error('fail'); }) };
      await expect(dao.createSettlementDao({}, badConn)).rejects.toThrow('fail');
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('updateSettlementDao', () => {
    it('should update and return entry', async () => {
      db.buildUpdateQuery.mockReturnValue(['UPDATE ...', ['a', 'b']]);
      const goodConn = { query: jest.fn(() => Promise.resolve({ rows: [{ id: 'settle-id', status: 'SUCCESS' }] })) };
      const result = await dao.updateSettlementDao('settle-id', { status: 'SUCCESS' }, goodConn);
      expect(db.buildUpdateQuery).toHaveBeenCalled();
      expect(goodConn.query).toHaveBeenCalled();
      expect(result).toEqual({ id: 'settle-id', status: 'SUCCESS' });
    });
    it('should handle empty result', async () => {
      const emptyConn = { query: jest.fn(() => Promise.resolve({ rows: [] })) };
      const result = await dao.updateSettlementDao('settle-id', { status: 'SUCCESS' }, emptyConn);
      expect(result).toBeUndefined();
    });
    it('should work without conn', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 'settle-id', status: 'SUCCESS' }] });
      const result = await dao.updateSettlementDao('settle-id', { status: 'SUCCESS' });
      expect(result).toEqual({ id: 'settle-id', status: 'SUCCESS' });
    });
    it('should log and throw on error', async () => {
      const badConn = { query: jest.fn(() => { throw new Error('fail'); }) };
      await expect(dao.updateSettlementDao('settle-id', {}, badConn)).rejects.toThrow('fail');
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('deleteSettlementDao', () => {
    it('should mark as deleted and return entry', async () => {
      db.buildUpdateQuery.mockReturnValue(['UPDATE ...', ['a', 'b']]);
      const goodConn = { query: jest.fn(() => Promise.resolve({ rows: [{ id: 'settle-id', is_obsolete: true }] })) };
      const result = await dao.deleteSettlementDao('settle-id', { is_obsolete: true }, goodConn);
      expect(db.buildUpdateQuery).toHaveBeenCalled();
      expect(goodConn.query).toHaveBeenCalled();
      expect(result).toEqual({ id: 'settle-id', is_obsolete: true });
    });
    it('should handle empty result', async () => {
      const emptyConn = { query: jest.fn(() => Promise.resolve({ rows: [] })) };
      const result = await dao.deleteSettlementDao('settle-id', { is_obsolete: true }, emptyConn);
      expect(result).toBeUndefined();
    });
    it('should work without conn', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 'settle-id', is_obsolete: true }] });
      const result = await dao.deleteSettlementDao('settle-id', { is_obsolete: true });
      expect(result).toEqual({ id: 'settle-id', is_obsolete: true });
    });
    it('should log and throw on error', async () => {
      // Provide a mock conn with a query method that throws
      const badConn = { query: jest.fn(() => { throw new Error('fail'); }) };
      await expect(dao.deleteSettlementDao('settle-id', {}, badConn)).rejects.toThrow('fail');
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getSettlementDao', () => {
    it('should fetch settlements with filters', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 'settle-id', user_id: 'user-uuid' }] });
      const result = await dao.getSettlementDao({ user_id: 'user-uuid' }, 1, 10, 'sno', 'DESC', [], mockConn());
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('id', 'settle-id');
    });
    it('should handle empty result', async () => {
      db.executeQuery.mockResolvedValue({ rows: [] });
      const result = await dao.getSettlementDao({ user_id: 'user-uuid' }, 1, 10, 'sno', 'DESC', [], mockConn());
      expect(result).toEqual([]);
    });
    it('should handle multiple rows', async () => {
      db.executeQuery.mockResolvedValue({ rows: [
        { id: 'settle-id-1', user_id: 'user-uuid' },
        { id: 'settle-id-2', user_id: 'user-uuid' },
      ] });
      const result = await dao.getSettlementDao({ user_id: 'user-uuid' }, 1, 10, 'sno', 'DESC', [], mockConn());
      expect(result.length).toBe(2);
    });
    it('should work without conn', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 'settle-id', user_id: 'user-uuid' }] });
      const result = await dao.getSettlementDao({ user_id: 'user-uuid' }, 1, 10, 'sno', 'DESC', []);
      expect(result[0]).toHaveProperty('id', 'settle-id');
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      await expect(dao.getSettlementDao({}, 1, 10, 'sno', 'DESC', [], mockConn())).rejects.toThrow('fail');
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getSettlementsBySearchDao', () => {
    it('should fetch settlements by search and return paginated result', async () => {
      db.executeQuery.mockResolvedValueOnce({ rows: [{ total: 1 }] });
      db.executeQuery.mockResolvedValueOnce({ rows: [{ id: 'settle-id', user_id: 'user-uuid' }] });
      const result = await dao.getSettlementsBySearchDao({ user_id: 'user-uuid' }, 1, 10, 'sno', 'DESC', [], [], 'ADMIN', mockConn());
      expect(result).toHaveProperty('totalCount', 1);
      expect(result).toHaveProperty('totalPages', 1);
      expect(Array.isArray(result.settlements)).toBe(true);
      expect(result.settlements[0]).toHaveProperty('id', 'settle-id');
    });
    it('should handle empty settlements', async () => {
      db.executeQuery.mockResolvedValueOnce({ rows: [{ total: 0 }] });
      db.executeQuery.mockResolvedValueOnce({ rows: [] });
      const result = await dao.getSettlementsBySearchDao({}, 1, 10, 'sno', 'DESC', [], [], 'ADMIN', mockConn());
      expect(result.totalCount).toBe(0);
      expect(result.settlements).toEqual([]);
    });
    it('should handle multiple settlements', async () => {
      db.executeQuery.mockResolvedValueOnce({ rows: [{ total: 2 }] });
      db.executeQuery.mockResolvedValueOnce({ rows: [
        { id: 'settle-id-1', user_id: 'user-uuid' },
        { id: 'settle-id-2', user_id: 'user-uuid' },
      ] });
      const result = await dao.getSettlementsBySearchDao({}, 1, 10, 'sno', 'DESC', [], [], 'ADMIN', mockConn());
      expect(result.totalCount).toBe(2);
      expect(result.settlements.length).toBe(2);
    });
    it('should work without conn', async () => {
      db.executeQuery.mockResolvedValueOnce({ rows: [{ total: 1 }] });
      db.executeQuery.mockResolvedValueOnce({ rows: [{ id: 'settle-id', user_id: 'user-uuid' }] });
      const result = await dao.getSettlementsBySearchDao({}, 1, 10, 'sno', 'DESC', [], [], 'ADMIN');
      expect(result.totalCount).toBe(1);
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      await expect(dao.getSettlementsBySearchDao({}, 1, 10, 'sno', 'DESC', [], [], 'ADMIN', mockConn())).rejects.toThrow('fail');
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getSettlementByUTRDao', () => {
    it('should fetch settlement by UTR', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 'settle-utr', user_id: 'user-uuid', status: 'INITIATED' }] });
      const result = await dao.getSettlementByUTRDao('utr-123', mockConn());
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('id', 'settle-utr');
    });
    it('should handle empty result', async () => {
      db.executeQuery.mockResolvedValue({ rows: [] });
      const result = await dao.getSettlementByUTRDao('utr-123', mockConn());
      expect(result).toBeUndefined();
    });
    it('should work without conn', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 'settle-utr', user_id: 'user-uuid', status: 'INITIATED' }] });
      const result = await dao.getSettlementByUTRDao('utr-123');
      expect(Array.isArray(result)).toBe(true);
    });
    it('should log and throw on error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      await expect(dao.getSettlementByUTRDao('utr-123', mockConn())).rejects.toThrow('fail');
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });
});
