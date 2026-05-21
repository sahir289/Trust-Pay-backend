/* global describe, it, expect, afterEach, beforeAll */
import { jest } from '@jest/globals';

// ESM mocking: mock db.js before importing the DAO
jest.unstable_mockModule('../../src/utils/db.js', () => ({
  executeQuery: jest.fn(),
  buildInsertQuery: jest.fn(),
}));

let dao, db;

beforeAll(async () => {
  dao = await import('../../src/apis/bankHistory/bankHistoryDao.js');
  db = await import('../../src/utils/db.js');
  // Guarantee db mocks are Jest mock functions
  db.executeQuery = jest.fn();
  db.buildInsertQuery = jest.fn();
  db.buildUpdateQuery = jest.fn();
});

afterEach(() => { jest.clearAllMocks(); });

describe('bankHistoryDao', () => {
  const daoNames = [
    'getBankHistoryDao',
    'createBankHistoryDao',
    'getallBankHistoryDao',
  ];

  daoNames.forEach((name) => {
    it(`${name} should be defined`, () => {
      expect(dao[name]).toBeDefined();
      expect(typeof dao[name]).toBe('function');
    });
  });

  describe('getBankHistoryDao', () => {
    it('should throw if missing filters', async () => {
      await expect(dao.getBankHistoryDao({}, null)).rejects.toThrow();
    });
    it('should return rows if valid', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ count: 1, today_balance: 100 }] });
      const result = await dao.getBankHistoryDao({ bank_account_id: 1, date: '2024-01-01' }, null);
      expect(result).toEqual([{ count: 1, today_balance: 100 }]);
      expect(db.executeQuery).toHaveBeenCalled();
    });
    it('should throw on db error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      await expect(dao.getBankHistoryDao({ bank_account_id: 1, date: '2024-01-01' }, null)).rejects.toThrow('fail');
    });
  });

  describe('createBankHistoryDao', () => {
    it('should insert and return row', async () => {
      db.buildInsertQuery.mockReturnValue(['SQL', ['a', 'b']]);
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
      const result = await dao.createBankHistoryDao({ foo: 'bar' }, null);
      expect(result).toEqual({ id: 1 });
      expect(db.buildInsertQuery).toHaveBeenCalled();
      expect(db.executeQuery).toHaveBeenCalled();
    });
    it('should throw on db error', async () => {
      db.buildInsertQuery.mockReturnValue(['SQL', ['a', 'b']]);
      db.executeQuery.mockRejectedValue(new Error('fail'));
      await expect(dao.createBankHistoryDao({ foo: 'bar' }, null)).rejects.toThrow('fail');
    });
  });
});
