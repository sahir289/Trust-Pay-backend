import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';

jest.unstable_mockModule('../../src/constants/index.js', () => ({
  tableName: {
    MERCHANT: 'Merchant',
    USER_HIERARCHY: 'UserHierarchy',
    USER: 'User',
    DESIGNATION: 'Designation',
  },
  Role: {
    MERCHANT: 'MERCHANT',
    SUB_MERCHANT: 'SUB_MERCHANT',
    ADMIN: 'ADMIN',
  },
}));

jest.unstable_mockModule('../../src/utils/db.js', () => ({
  buildInsertQuery: jest.fn(),
  buildSelectQuery: jest.fn(),
  buildUpdateQuery: jest.fn(),
  executeQuery: jest.fn(),
  buildAndExecuteUpdateQuery: jest.fn(),
}));

jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: { error: jest.fn(), log: jest.fn() },
}));

jest.unstable_mockModule('../../src/utils/enhanceSubMerchant.js', () => ({
  enhanceMerchantsWithSubMerchants: jest.fn(),
}));

let merchantDao, db, logger;

beforeAll(async () => {
  db = await import('../../src/utils/db.js');
  logger = await import('../../src/utils/logger.js');
  merchantDao = await import('../../src/apis/merchants/merchantDao.js');
});

beforeEach(() => {
  jest.clearAllMocks();
  db.buildInsertQuery = jest.fn();
  db.buildSelectQuery = jest.fn();
  db.buildUpdateQuery = jest.fn();
  db.executeQuery = jest.fn();
  db.buildAndExecuteUpdateQuery = jest.fn();
  logger.logger.error = jest.fn();
  logger.logger.log = jest.fn();
});

describe('merchantDao', () => {
  describe('createMerchantDao', () => {
    it('should call executeQuery with built sql', async () => {
      const data = { user_id: 1, code: 'TEST' };
      db.buildInsertQuery.mockReturnValue(['INSERT ...', [data]]);
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
      
      await merchantDao.createMerchantDao(data);
      
      expect(db.buildInsertQuery).toHaveBeenCalledWith('Merchant', expect.any(Object));
      expect(db.executeQuery).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      db.buildInsertQuery.mockReturnValue(['INSERT...', []]);
      db.executeQuery.mockRejectedValue(new Error('DB error'));
      
      await expect(merchantDao.createMerchantDao({})).rejects.toThrow();
    });
  });

  describe('getMerchantForEsDao', () => {
    it('should call executeQuery', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ code: 'TEST' }] });
      
      await merchantDao.getMerchantForEsDao(1);
      
      expect(db.executeQuery).toHaveBeenCalled();
    });
  });

  describe('getMerchantsCodeDao', () => {
    it('should call executeQuery', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ label: 'TEST' }] });
      
      await merchantDao.getMerchantsCodeDao({ company_id: 1 });
      
      expect(db.executeQuery).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      db.executeQuery.mockRejectedValue(new Error('Query failed'));
      
      await expect(merchantDao.getMerchantsCodeDao({})).rejects.toThrow();
    });
  });

  describe('getMerchantByUserIdDao', () => {
    it('should call executeQuery', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
      
      await merchantDao.getMerchantByUserIdDao(5);
      
      expect(db.executeQuery).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      db.executeQuery.mockRejectedValue(new Error('Query failed'));
      
      await expect(merchantDao.getMerchantByUserIdDao(5)).rejects.toThrow();
    });
  });
});
