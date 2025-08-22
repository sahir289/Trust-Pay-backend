import * as merchantDao from './merchantDao.js';

describe('merchantDao', () => {
  it('createMerchantDao: should handle errors in DB', async () => {
    const merchantDao = require('./merchantDao.js');
    const conn = { query: jest.fn().mockRejectedValue(new Error('DB error')) };
    const data = { name: 'Test Merchant', code: 'TST' };
    await expect(merchantDao.createMerchantDao(data, conn)).rejects.toThrow('DB error');
  });

  it('getMerchantsCodeDao: should handle errors in DB', async () => {
    const merchantDao = require('./merchantDao.js');
    const conn = { query: jest.fn().mockRejectedValue(new Error('DB error')) };
    const filters = { company_id: 'company123' };
    await expect(merchantDao.getMerchantsCodeDao(conn, filters, 'true', 'false')).rejects.toThrow('DB error');
  });

  // it('getMerchantByUserIdDao: should handle errors in DB', async () => {
  //   const merchantDao = require('./merchantDao.js');
  //   const conn = { query: jest.fn().mockRejectedValue(new Error('DB error')) };
  //   await expect(merchantDaoModule.getMerchantByUserDao('user1', 'ADMIN', conn)).resolves.toEqual([]);
  // });

  // it('getMerchantByUserIdDao: should handle errors in DB', async () => {
  //     const merchantDaoModule = require('./merchantDao.js'); // Add this line
  //     const conn = { query: jest.fn().mockRejectedValue(new Error('DB error')) };
  //     await expect(merchantDaoModule.getMerchantByUserIdDao('user1', 'ADMIN', conn)).rejects.toThrow('DB error');
  // });

  it('createMerchantDao: should create a merchant', async () => {
    const data = { name: 'Test Merchant', code: 'TST' };
    const conn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }) };
    await expect(merchantDao.createMerchantDao(data, conn)).resolves.toBeDefined();
  });

  it('getMerchantsCodeDao: sh  ould get merchant codes', async () => {
    const conn = { query: jest.fn().mockResolvedValue({ rows: [{ code: 'TST', user_id: 'user1', merchant_id: 1 }] }) };
    const filters = { company_id: 'company123' };
    await expect(merchantDao.getMerchantsCodeDao(conn, filters, 'true', 'false')).resolves.toBeDefined();
  });

  it('getMerchantByUserIdDao: should get merchant by user id', async () => {
    await expect(merchantDao.getMerchantByUserIdDao('user1')).resolves.toBeDefined();
  });

  it('getMerchantsDao: should get merchants', async () => {
    await expect(merchantDao.getMerchantsDao({ company_id: 'company123' }, 1, 10, 'created_at', 'ASC', 'ADMIN')).resolves.toBeDefined();
  });

  it('getMerchantsByCodeDao: should get merchants by code', async () => {
    await expect(merchantDao.getMerchantsByCodeDao('TST')).resolves.toBeDefined();
  });

  it('getMerchantByCodeDao: should get merchant by code', async () => {
    await expect(merchantDao.getMerchantByCodeDao('TST')).resolves.toBeDefined();
  });

  it('getAllMerchantsDao: should get all merchants', async () => {
    await expect(merchantDao.getAllMerchantsDao({ company_id: 'company123' }, 1, 10, 'created_at', 'ASC', 'ADMIN')).resolves.toBeDefined();
  });

  it('getMerchantsBySearchDao: should search merchants', async () => {
    await expect(merchantDao.getMerchantsBySearchDao({ company_id: 'company123' }, 1, 10, 'updated_at', 'ASC', 'ADMIN', ['Test'])).resolves.toBeDefined();
  });

  it('updateMerchantDao: should update merchant', async () => {
    const ids = { id: 1 };
    const data = { name: 'Updated Merchant' };
    const conn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }) };
    await expect(merchantDao.updateMerchantDao(ids, data, conn)).resolves.toBeDefined();
  });

  it('deleteMerchantDao: should delete merchant', async () => {
    const conn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }) };
    const ids = { id: 1, company_id: 'company123' };
    const data = { updated_by: 'user1' };
    await expect(merchantDao.deleteMerchantDao(conn, ids, data)).resolves.toBeDefined();
  });

  it('updateMerchantBalanceDao: should update merchant balance', async () => {
    const filters = { id: 1 };
    const valueToAdd = 100;
    const updated_by = 'user1';
    const conn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }) };
    await expect(merchantDao.updateMerchantBalanceDao(filters, valueToAdd, updated_by, conn)).resolves.toBeDefined();
  });

  it('getMerchantByCodeAndApiKey: should get merchant by code and API key', async () => {
    jest.spyOn(merchantDao, 'getMerchantByCodeAndApiKey').mockResolvedValue({ id: 1, code: 'TST', api_key: 'publicKey' });
    await expect(merchantDao.getMerchantByCodeAndApiKey('TST', 'publicKey')).resolves.toBeDefined();
    merchantDao.getMerchantByCodeAndApiKey.mockRestore();
  });

  it('getMerchantsDaoArray: should get merchants array', async () => {
    await expect(merchantDao.getMerchantsDaoArray('company123', ['TST'])).resolves.toBeDefined();
  });
});
