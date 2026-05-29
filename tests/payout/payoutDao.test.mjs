/* global describe, it, expect, beforeEach, beforeAll */
import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/utils/db.js', () => ({
  buildInsertQuery: jest.fn(() => ['INSERT INTO ...', []]),
  executeQuery: jest.fn(() => Promise.resolve({ rows: [{ id: 1 }] })),
  buildUpdateQuery: jest.fn(() => ['UPDATE ...', []]),
  buildAndExecuteUpdateQuery: jest.fn(),
  buildSelectQuery: jest.fn(),
}));
jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));
jest.unstable_mockModule('dayjs', () => ({
  default: { tz: jest.fn(() => ({ utc: () => ({ format: () => '2026-01-01T00:00:00Z' }) })) },
}));

let payoutDao, db, loggerModule;
beforeAll(async () => {
  payoutDao = await import('../../src/apis/payOut/payOutDao.js');
  db = await import('../../src/utils/db.js');
  loggerModule = await import('../../src/utils/logger.js');
});
beforeEach(() => {
  if (db) {
    db.buildInsertQuery = jest.fn(() => ['SQL', []]);
    db.buildSelectQuery = jest.fn(() => ['SQL', []]);
    db.buildUpdateQuery = jest.fn(() => ['SQL', []]);
    db.buildAndExecuteUpdateQuery = jest.fn(() => ['SQL', []]);
    db.executeQuery = jest.fn(async () => ({ rows: [{}] }));
  }
  if (loggerModule?.logger) {
    loggerModule.logger.error = jest.fn();
    loggerModule.logger.info = jest.fn();
    loggerModule.logger.warn = jest.fn();
  }
});

describe('Payout DAO', () => {
  it('should have getPayoutsDao defined', () => {
    expect(payoutDao.getPayoutsDao).toBeDefined();
  });

  it('createPayoutDao should insert and return row', async () => {
    db.executeQuery.mockResolvedValueOnce({ rows: [{ id: 42 }] });
    const result = await payoutDao.createPayoutDao({});
    expect(db.buildInsertQuery).toHaveBeenCalled();
    expect(db.executeQuery).toHaveBeenCalled();
    expect(result).toEqual({ id: 42 });
  });

  it('createPayoutDao should log and throw on error', async () => {
    db.executeQuery.mockRejectedValueOnce(new Error('fail'));
    await expect(payoutDao.createPayoutDao({})).rejects.toThrow('fail');
    expect(loggerModule.logger.error).toHaveBeenCalled();
  });

  it('assignedPayoutDao should update and return ids', async () => {
    db.executeQuery.mockResolvedValueOnce({ rows: [{ id: 5 }] });
    const result = await payoutDao.assignedPayoutDao([123], { id: 7 }, 2, 1);
    expect(db.buildUpdateQuery).toHaveBeenCalled();
    expect(result).toEqual([5]);
  });

  it('assignedPayoutDao should throw if payoutData is not array', async () => {
    await expect(payoutDao.assignedPayoutDao('bad', { id: 1 }, 2, 1)).rejects.toThrow();
  });

  it('getPayoutsDao should build query and call executeQuery', async () => {
    db.executeQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const result = await payoutDao.getPayoutsDao({}, 1, 1, 10, 'DESC', 'MERCHANT');
    expect(Array.isArray(result)).toBe(true);
  });

  it('getPayoutsDao should log and throw on error', async () => {
    db.executeQuery.mockRejectedValueOnce(new Error('fail'));
    await expect(payoutDao.getPayoutsDao({}, 1, 1, 10, 'DESC', 'MERCHANT')).rejects.toThrow('fail');
    expect(loggerModule.logger.error).toHaveBeenCalled();
  });

  it('getPayoutByIdDao should return row or null', async () => {
    const { getPayoutByIdDao } = payoutDao;
    db.executeQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    expect(await getPayoutByIdDao(1, 1)).toEqual({ id: 1 });
    db.executeQuery.mockResolvedValueOnce({ rows: [] });
    expect(await getPayoutByIdDao(1, 1)).toBeNull();
  });

  it('getPayoutByMerchantOrderIdDao should return row or null', async () => {
    const { getPayoutByMerchantOrderIdDao } = payoutDao;
    db.executeQuery.mockResolvedValueOnce({ rows: [{ id: 2 }] });
    expect(await getPayoutByMerchantOrderIdDao('order', 1)).toEqual({ id: 2 });
    db.executeQuery.mockResolvedValueOnce({ rows: [] });
    expect(await getPayoutByMerchantOrderIdDao('order', 1)).toBeNull();
  });

  it('getPayoutByUtrIdDao should return row or null', async () => {
    const { getPayoutByUtrIdDao } = payoutDao;
    db.executeQuery.mockResolvedValueOnce({ rows: [{ id: 3 }] });
    expect(await getPayoutByUtrIdDao('utr', 1)).toEqual({ id: 3 });
    db.executeQuery.mockResolvedValueOnce({ rows: [] });
    expect(await getPayoutByUtrIdDao('utr', 1)).toBeNull();
  });

  it('getPayoutBankDetailsDao should return rows', async () => {
    const { getPayoutBankDetailsDao } = payoutDao;
    db.executeQuery.mockResolvedValueOnce({ rows: [{ id: 4 }] });
    expect(await getPayoutBankDetailsDao({ payOutids: [1, 2] }, 1)).toEqual([{ id: 4 }]);
  });

  it('getPayoutsNotifyDao should return rows', async () => {
    const { getPayoutsNotifyDao } = payoutDao;
    db.buildSelectQuery.mockReturnValue(['SELECT ...', []]);
    db.executeQuery.mockResolvedValueOnce({ rows: [{ id: 5 }] });
    expect(await getPayoutsNotifyDao({}, 1)).toEqual([{ id: 5 }]);
  });

  it('getAllPayoutsDao should return rows', async () => {
    const { getAllPayoutsDao } = payoutDao;
    db.executeQuery.mockResolvedValueOnce({ rows: [{ id: 6 }] });
    expect(await getAllPayoutsDao({}, 1, 1, 10, 'DESC', 'MERCHANT')).toEqual([{ id: 6 }]);
  });

  it('getCompanyIdByMerchantOrderIdDao should return row or rows', async () => {
    const { getCompanyIdByMerchantOrderIdDao } = payoutDao;
    db.executeQuery.mockResolvedValueOnce({ rows: [{ id: 7 }] });
    expect(await getCompanyIdByMerchantOrderIdDao('order')).toEqual({ id: 7 });
    db.executeQuery.mockResolvedValueOnce({ rows: [] });
    expect(await getCompanyIdByMerchantOrderIdDao('order')).toEqual([]);
  });

  it('getPayoutsBySearchDao should return data object', async () => {
    const { getPayoutsBySearchDao } = payoutDao;
    db.executeQuery.mockResolvedValue({ rows: [{ id: 8 }] });
    const result = await getPayoutsBySearchDao({ company_id: 1 }, [], 10, 0, 'MERCHANT', false);
    expect(result).toHaveProperty('totalCount');
    expect(result).toHaveProperty('payout');
  });

  it('getInitiatedAndPendingSummaryByMerchant should return summary', async () => {
    const { getInitiatedAndPendingSummaryByMerchant } = payoutDao;
    db.executeQuery.mockResolvedValueOnce({ rows: [{ merchant_code: 'M', total_count: '2', total_amount: '100' }] });
    const result = await getInitiatedAndPendingSummaryByMerchant(1);
    expect(result[0]).toHaveProperty('merchant', 'M');
    expect(result[0]).toHaveProperty('count', 2);
    expect(result[0]).toHaveProperty('amount', 100);
  });

  it('getPayoutsCronDao should return rows', async () => {
    const { getPayoutsCronDao } = payoutDao;
    db.executeQuery.mockResolvedValueOnce({ rows: [{ id: 9 }] });
    expect(await getPayoutsCronDao('PENDING')).toEqual([{ id: 9 }]);
  });

  it('updatePayoutDao should call buildAndExecuteUpdateQuery and return result', async () => {
    const { updatePayoutDao } = payoutDao;
    db.executeQuery.mockResolvedValueOnce({ rows: [{ config: {} }] });
    db.buildAndExecuteUpdateQuery.mockResolvedValueOnce({ id: 10 });
    expect(await updatePayoutDao({ id: 1 }, { txnid: 'tx1', config: {} })).toEqual({ id: 10 });
  });

  it('getPayoutByTxnId should return row', async () => {
    const { getPayoutByTxnId } = payoutDao;
    db.executeQuery.mockResolvedValueOnce({ rows: [{ id: 11 }] });
    expect(await getPayoutByTxnId('tx1')).toEqual({ id: 11 });
  });

  it('deletePayoutDao should call buildUpdateQuery and return row', async () => {
    const { deletePayoutDao } = payoutDao;
    db.executeQuery.mockResolvedValueOnce({ rows: [{ id: 12 }] });
    expect(await deletePayoutDao({ id: 1 }, { is_obsolete: true })).toEqual({ id: 12 });
  });
});
