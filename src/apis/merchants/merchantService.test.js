import * as merchantService from './merchantService.js';

describe('merchantService', () => {
  
  it('createMerchantService: should handle errors from createMerchantDao', async () => {
    const merchantService = require('./merchantService.js');
    const errorFn = jest.spyOn(require('./merchantDao.js'), 'createMerchantDao').mockRejectedValue(new Error('DAO error'));
    const conn = {};
    const payload = { name: 'Test Merchant', code: 'TST', role: 'MERCHANT', role_id: 'roleid', designation: 'MERCHANT', parent_id: 'parentid' };
    await expect(merchantService.createMerchantService(conn, payload)).rejects.toThrow('DAO error');
    errorFn.mockRestore();
  });

  it('getMerchantsService: should handle errors from getAllMerchantsDao', async () => {
    const merchantService = require('./merchantService.js');
    const errorFn = jest.spyOn(require('./merchantDao.js'), 'getAllMerchantsDao').mockRejectedValue(new Error('DAO error'));
    const filters = { company_id: 'company123' };
    await expect(merchantService.getMerchantsService(filters, 'ADMIN', 1, 10, 'ADMIN', 'user1')).rejects.toThrow('DAO error');
    errorFn.mockRestore();
  });

  it('getMerchantsBySearchService: should handle errors from getMerchantsBySearchDao', async () => {
    const merchantService = require('./merchantService.js');
    const errorFn = jest.spyOn(require('./merchantDao.js'), 'getMerchantsBySearchDao').mockRejectedValue(new Error('DAO error'));
    const filters = { company_id: 'company123', search: 'Test', page: 1, limit: 10 };
    await expect(merchantService.getMerchantsBySearchService(filters, 'ADMIN', 'ADMIN', 'user1')).rejects.toThrow('DAO error');
    errorFn.mockRestore();
  });

  it('updateMerchantService: should handle errors from updateMerchantDao', async () => {
    const merchantService = require('./merchantService.js');
    const errorFn = jest.spyOn(require('./merchantDao.js'), 'updateMerchantDao').mockRejectedValue(new Error('DAO error'));
    const conn = {};
    const ids = { id: 1 };
    const payload = { name: 'Updated Merchant' };
    await expect(merchantService.updateMerchantService(conn, ids, payload)).rejects.toThrow('DAO error');
    errorFn.mockRestore();
  });

  it('deleteMerchantService: should handle errors from deleteMerchantDao', async () => {
    const merchantService = require('./merchantService.js');
    const errorFn = jest.spyOn(require('./merchantDao.js'), 'deleteMerchantDao').mockRejectedValue(new Error('DAO error'));
    const ids = { id: 1, company_id: 'company123' };
    const updated_by = 'user1';
    // Mock getMerchantsDao to return a valid merchantDetails to avoid undefined error
    jest.spyOn(require('./merchantDao.js'), 'getMerchantsDao').mockResolvedValue([{ user_id: 'user1' }]);
    await expect(merchantService.deleteMerchantService(ids, { updated_by }, 'ADMIN')).rejects.toThrow('DAO error');
    jest.restoreAllMocks();
    errorFn.mockRestore();
  });

  it('getMerchantByIdService: should handle errors from getMerchantsDao', async () => {
    const merchantService = require('./merchantService.js');
    const errorFn = jest.spyOn(require('./merchantDao.js'), 'getMerchantsDao').mockRejectedValue(new Error('DAO error'));
    const filters = { id: 1, company_id: 'company123' };
    await expect(merchantService.getMerchantByIdService(filters, 'ADMIN')).rejects.toThrow('DAO error');
    errorFn.mockRestore();
  });

  it('getMerchantsServiceCode: should handle errors from getMerchantsCodeDao', async () => {
    const merchantService = require('./merchantService.js');
    const errorFn = jest.spyOn(require('./merchantDao.js'), 'getMerchantsCodeDao').mockRejectedValue(new Error('DAO error'));
    const filters = { company_id: 'company123' };
    await expect(merchantService.getMerchantsServiceCode(filters, 'ADMIN', 'ADMIN', 'user1')).rejects.toThrow('DAO error');
    errorFn.mockRestore();
  });

  it('getMerchantsByCodeService: should handle errors from getMerchantByCodeDao', async () => {
    const merchantService = require('./merchantService.js');
    const errorFn = jest.spyOn(require('./merchantDao.js'), 'getMerchantByCodeDao').mockRejectedValue(new Error('DAO error'));
    await expect(merchantService.getMerchantsByCodeService('TST')).rejects.toThrow('DAO error');
    errorFn.mockRestore();
  });
  it('createMerchantService: should create a merchant', async () => {
    const data = { name: 'Test Merchant', code: 'TST' };
    const conn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }) };
    await expect(merchantService.createMerchantService(conn, data)).resolves.toBeDefined();
  });

  it('getMerchantsService: should get merchants', async () => {
    const filters = { company_id: 'company123' };
    await expect(merchantService.getMerchantsService(filters, 1, 10, 'created_at', 'ASC', 'ADMIN')).resolves.toBeDefined();
  });

  it('updateMerchantService: should update merchant', async () => {
    const ids = { id: 1 };
    const data = { name: 'Updated Merchant' };
    const conn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }) };
    await expect(merchantService.updateMerchantService(conn, ids, data)).resolves.toBeDefined();
  });

  it('deleteMerchantService: should delete merchant', async () => {
    const conn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }) };
    const ids = { id: 1, company_id: 'company123' };
    const data = { updated_by: 'user1' };
    // Mock getMerchantsDao to return a valid merchantDetails to avoid undefined error
    jest.spyOn(require('./merchantDao.js'), 'getMerchantsDao').mockResolvedValue([{ user_id: 'user1' }]);
    await expect(merchantService.deleteMerchantService(conn, ids, data)).resolves.toBeDefined();
    jest.restoreAllMocks();
  });

  it('getMerchantsBySearchService: should search merchants', async () => {
    const filters = { company_id: 'company123' };
    await expect(merchantService.getMerchantsBySearchService(filters, 1, 10, 'updated_at', 'ASC', 'ADMIN', ['Test'])).resolves.toBeDefined();
  });

});
