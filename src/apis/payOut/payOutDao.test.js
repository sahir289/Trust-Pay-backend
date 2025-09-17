// src/apis/payOut/__tests__/payOutDao.test.js
'use strict';
import { expect, describe, beforeEach, test } from '@jest/globals';

// Mock dayjs.tz chain used by DAO
jest.mock('dayjs', () => ({
  tz: (str, tz) => ({
    utc: () => ({
      format: () => '2020-01-01T00:00:00Z',
    }),
  }),
}));

// Mock DB utilities (factory must not capture external variables)
jest.mock('../../utils/db.js', () => ({
  buildInsertQuery: jest.fn(),
  buildUpdateQuery: jest.fn(),
  buildAndExecuteUpdateQuery: jest.fn(),
  executeQuery: jest.fn(),
  getConnection: jest.fn(),
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
}));

// Mock logger
jest.mock('../../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
  },
}));

// After mocks are registered, require the mocked db module (to configure mocks in tests)
const dbMocks = require('../../utils/db.js');

// Now require the DAO under test
const dao = require('./payOutDao.js');

// Helper: Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// ---------- Tests ----------
describe('payOutDao', () => {
  describe('createPayoutDao', () => {
    test('inserts new payout and returns rows[0] when conn not provided and data.config missing', async () => {
      // Arrange
      const fakeSQL = 'INSERT INTO "Payout" (...) RETURNING *';
      const fakeParams = ['a', 'b'];
      dbMocks.buildInsertQuery.mockReturnValue([fakeSQL, fakeParams]);
      dbMocks.executeQuery.mockResolvedValue({ rows: [{ id: 'new-payout', amount: 100 }] });

      // Act
      const result = await dao.createPayoutDao(null, { amount: 100 });

      // Assert
      expect(dbMocks.buildInsertQuery).toHaveBeenCalledWith('Payout', expect.any(Object));
      expect(dbMocks.executeQuery).toHaveBeenCalledWith(fakeSQL, fakeParams);
      expect(result).toEqual({ id: 'new-payout', amount: 100 });
    });

    test('throws if executeQuery errors', async () => {
      dbMocks.buildInsertQuery.mockReturnValue(['SQL', []]);
      dbMocks.executeQuery.mockRejectedValue(new Error('DB down'));

      await expect(dao.createPayoutDao(null, { amount: 5 })).rejects.toThrow('DB down');
    });
  });

  describe('assignedPayoutDao', () => {
    test('throws when payoutData is not an array', async () => {
      await expect(dao.assignedPayoutDao('not-array', { id: 'v1' }, 'u1', 'c1', null)).rejects.toThrow('payoutData must be an array');
    });

    test('updates each payout and returns array of ids (using executeQuery)', async () => {
      // Arrange
      const payouts = [11, 22];
      dbMocks.buildUpdateQuery.mockImplementation((table, updatedData, where) => {
        return [`UPDATE ... WHERE id=${where.id}`, [updatedData.vendor_id, where.id]];
      });
      dbMocks.executeQuery.mockImplementation((sql, params) => {
        return Promise.resolve({ rows: [{ id: `updated-${params[1]}` }] });
      });

      const res = await dao.assignedPayoutDao(payouts, { id: 'vend-1' }, 'upd-by', 'comp-1', null);

      expect(dbMocks.buildUpdateQuery).toHaveBeenCalledTimes(2);
      expect(dbMocks.executeQuery).toHaveBeenCalledTimes(2);
      expect(res).toEqual(['updated-11', 'updated-22']);
    });

    test('uses conn.query when conn provided', async () => {
      const payouts = [5];
      dbMocks.buildUpdateQuery.mockReturnValue(['SQL', [1]]);
      const conn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 'c-updated' }] }) };
      const result = await dao.assignedPayoutDao(payouts, { id: 'v1' }, 'u1', 'c1', conn);
      expect(conn.query).toHaveBeenCalled();
      expect(result).toEqual(['c-updated']);
    });
  });

  describe('getPayoutsDao', () => {
    test('builds query with startDate/endDate and pagination and returns rows (conn)', async () => {
      const filters = { startDate: '2020-01-01', endDate: '2020-01-02', foo: 'a,b' };
      const conn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }) };
      const rows = await dao.getPayoutsDao(filters, 'comp-1', 2, 10, 'DESC', null, conn);
      expect(conn.query).toHaveBeenCalled();
      expect(rows).toEqual([{ id: 1 }]);
    });

    test('uses executeQuery when conn not provided', async () => {
      const filters = { foo: 'x' };
      dbMocks.executeQuery.mockResolvedValue({ rows: [{ id: 'r1' }] });
      const rows = await dao.getPayoutsDao(filters, 'comp-2', 1, 5, 'ASC', null, null);
      expect(dbMocks.executeQuery).toHaveBeenCalled();
      expect(rows).toEqual([{ id: 'r1' }]);
    });

    test('handles string company_id trimming', async () => {
      dbMocks.executeQuery.mockResolvedValue({ rows: [] });
      await dao.getPayoutsDao({}, ' comp-3 ', 1, 5, undefined, null, null);
      expect(dbMocks.executeQuery).toHaveBeenCalled();
    });
  });

  describe('getPayoutBankDetailsDao', () => {
    test('returns bank details for payOutids array', async () => {
      dbMocks.executeQuery.mockResolvedValue({ rows: [{ id: 101, amount: 200 }] });
      const res = await dao.getPayoutBankDetailsDao({ payOutids: [101] }, 'c1');
      expect(dbMocks.executeQuery).toHaveBeenCalled();
      expect(res).toEqual([{ id: 101, amount: 200 }]);
    });

    test('propagates error from executeQuery', async () => {
      dbMocks.executeQuery.mockRejectedValue(new Error('db fail'));
      await expect(dao.getPayoutBankDetailsDao({ payOutids: [1] }, 'c1')).rejects.toThrow('db fail');
    });
  });

  describe('getAllPayoutsDao', () => {
    test('handles userId and status filters (stringified JSON) and returns rows', async () => {
      const filters = {
        userId: JSON.stringify([10, 20]),
        status: JSON.stringify(['APPROVED']),
      };
      dbMocks.executeQuery.mockResolvedValue({ rows: [{ id: 'p1' }] });
      const rows = await dao.getAllPayoutsDao(filters, 'comp-1', 1, 10, 'DESC', null, null);
      expect(dbMocks.executeQuery).toHaveBeenCalled();
      expect(rows).toEqual([{ id: 'p1' }]);
    });
  });

  describe('getPayoutsBySearchDao', () => {
    test('handles status, searchTerms, updated_at and ifamount true returns totals and payouts', async () => {
      dbMocks.executeQuery.mockImplementation((sql, params) => {
        if (sql && sql.includes('SUM(p.amount)')) {
          return Promise.resolve({ rows: [{ total_amount: '123.45' }] });
        }
        if (sql && sql.toLowerCase().includes('count(*)')) {
          return Promise.resolve({ rows: [{ total: '1' }] });
        }
        return Promise.resolve({ rows: [{ id: 'psearch1' }] });
      });

      const filters = { company_id: 'comp-1', status: 'APPROVED', updated_at: '01-01-2020' };
      const searchTerms = ['term1'];
      const data = await dao.getPayoutsBySearchDao(filters, searchTerms, 10, 0, null, true);

      expect(dbMocks.executeQuery).toHaveBeenCalled();
      expect(data.totalAmount).toBeCloseTo(123.45);
      expect(data.totalCount).toBe(1);
      expect(Array.isArray(data.payout)).toBe(true);
    });

    test('throws when updated_at malformed', async () => {
      const badFilters = { company_id: 'c1', updated_at: 'bad-date' };
      await expect(dao.getPayoutsBySearchDao(badFilters, [], 10, 0, null, false)).rejects.toThrow();
    });
  });

  describe('getPayoutsCronDao', () => {
    test('uses conn.query and returns rows', async () => {
      const conn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 'cron1' }] }) };
      const res = await dao.getPayoutsCronDao(conn, 'PENDING');
      expect(conn.query).toHaveBeenCalled();
      expect(res).toEqual([{ id: 'cron1' }]);
    });

    test('throws on query error', async () => {
      const conn = { query: jest.fn().mockRejectedValue(new Error('conn fail')) };
      await expect(dao.getPayoutsCronDao(conn, 'PENDING')).rejects.toThrow('conn fail');
    });
  });

  describe('updatePayoutDao', () => {
    test('merges existing config and calls buildAndExecuteUpdateQuery', async () => {
      dbMocks.executeQuery.mockResolvedValueOnce({ rows: [{ config: { foo: 'bar' } }] });
      dbMocks.buildAndExecuteUpdateQuery.mockResolvedValue({ id: 'updated-1', config: { foo: 'bar', new: 'value' } });

      const ids = { id: 'p1' };
      const payload = { config: { new: 'value' }, other: 1 };
      const out = await dao.updatePayoutDao(ids, payload, null);

      expect(dbMocks.executeQuery).toHaveBeenCalled();
      expect(dbMocks.buildAndExecuteUpdateQuery).toHaveBeenCalledWith(
        'Payout',
        expect.objectContaining({ config: expect.any(Object), other: 1 }),
        ids,
        {},
        { returnUpdated: true },
        null,
      );
      expect(out).toEqual({ id: 'updated-1', config: { foo: 'bar', new: 'value' } });
    });

    test('throws when buildAndExecuteUpdateQuery errors', async () => {
      dbMocks.executeQuery.mockResolvedValueOnce({ rows: [{ config: {} }] });
      dbMocks.buildAndExecuteUpdateQuery.mockRejectedValue(new Error('update fail'));
      await expect(dao.updatePayoutDao({ id: 'pX' }, { config: { x: 1 } }, null)).rejects.toThrow('update fail');
    });
  });

  describe('getPayoutByTxnId', () => {
    test('returns first row for txn id', async () => {
      dbMocks.executeQuery.mockResolvedValue({ rows: [{ id: 'bytxn', name: 'x' }] });
      const row = await dao.getPayoutByTxnId('txn-1');
      expect(dbMocks.executeQuery).toHaveBeenCalled();
      expect(row).toEqual({ id: 'bytxn', name: 'x' });
    });
  });

  describe('deletePayoutDao', () => {
    test('builds update query and returns rows[0]', async () => {
      dbMocks.buildUpdateQuery.mockReturnValue(['UPDATE ...', ['param']]);
      dbMocks.executeQuery.mockResolvedValue({ rows: [{ id: 'deleted-1' }] });
      const out = await dao.deletePayoutDao({ id: 'p1' }, { is_obsolete: true });
      expect(dbMocks.buildUpdateQuery).toHaveBeenCalled();
      expect(dbMocks.executeQuery).toHaveBeenCalled();
      expect(out).toEqual({ id: 'deleted-1' });
    });

    test('throws when executeQuery fails', async () => {
      dbMocks.buildUpdateQuery.mockReturnValue(['SQL', []]);
      dbMocks.executeQuery.mockRejectedValueOnce(new Error('del-fail'));
      await expect(dao.deletePayoutDao({ id: 'p1' }, { is_obsolete: true })).rejects.toThrow('del-fail');
    });
  });
});
