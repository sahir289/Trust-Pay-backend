// -------------------- ESM MOCKS --------------------
/* global describe, it, expect, beforeEach, afterEach, beforeAll */
import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/utils/db.js', () => ({
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  getConnection: jest.fn(),
}));
jest.unstable_mockModule('../../src/apis/chargeBacks/chargeBackDao.js', () => ({
  createChargeBackDao: jest.fn(),
  getChargebackByIdDao: jest.fn(),
  getChargeBackDao: jest.fn(),
  getAllChargeBackDao: jest.fn(),
  getChargeBacksBySearchDao: jest.fn(),
  updateChargeBackDao: jest.fn(),
  deleteChargeBackDao: jest.fn(),
  chargeBackExistsByPayinIdDao: jest.fn(),
}));
jest.unstable_mockModule('../../src/apis/calculation/calculationDao.js', () => ({
  getCalculationforCronDao: jest.fn(),
  updateCalculationBalanceDao: jest.fn(),
}));
jest.unstable_mockModule('../../src/apis/company/companyDao.js', () => ({
  getCompanyDao: jest.fn(),
  updateCompanyConfigDao: jest.fn(),
}));
jest.unstable_mockModule('../../src/apis/merchants/merchantDao.js', () => ({
  getMerchantByUserIdDao: jest.fn(),
  getMerchantConfigByUserIdDao: jest.fn(),
  updateMerchantDao: jest.fn(),
}));
jest.unstable_mockModule('../../src/apis/userHierarchy/userHierarchyDao.js', () => ({
  getUserHierarchysDao: jest.fn(),
}));
jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));
jest.unstable_mockModule('../../src/utils/appErrors.js', () => ({
  InternalServerError: class extends Error {},
  NotFoundError: class extends Error {},
  BadRequestError: class extends Error {},
}));
jest.unstable_mockModule('../../src/helpers/index.js', () => ({
  filterResponse: jest.fn((data) => data),
  trackVendorsNetBalance: jest.fn(),
}));
jest.unstable_mockModule('../../src/utils/sockets.js', () => ({
  newTableEntry: jest.fn(),
}));
jest.unstable_mockModule('../../src/constants/index.js', () => ({
  Role: { ADMIN: 'ADMIN', MERCHANT: 'MERCHANT', VENDOR: 'VENDOR' },
  tableName: { CHARGE_BACK: 'ChargeBack' },
  columns: {
    CHARGE_BACK: {
      id: true,
      amount: true,
      status: true,
      created_at: true,
    },
  },
  merchantColumns: {
    CHARGE_BACK: {
      id: true,
      amount: true,
      status: true,
    },
  },
  vendorColumns: {
    CHARGE_BACK: {
      id: true,
      amount: true,
    },
  },
}));
jest.unstable_mockModule('../../src/utils/trackVendorsNetBalance.js', () => ({
  trackVendorsNetBalance: jest.fn(),
}));

// -------------------- HELPERS ----------------------
function mockConn() {
  return {
    release: jest.fn(),
  };
}

// -------------------- IMPORTS (via beforeAll) ----------------------
let service, chargeBackDao, calculationDao, companyDao, merchantDao;
let loggerModule, userHierarchyDao, helpers, db;

beforeAll(async () => {
  service = await import('../../src/apis/chargeBacks/chargeBackService.js');
  chargeBackDao = await import('../../src/apis/chargeBacks/chargeBackDao.js');
  calculationDao = await import('../../src/apis/calculation/calculationDao.js');
  companyDao = await import('../../src/apis/company/companyDao.js');
  merchantDao = await import('../../src/apis/merchants/merchantDao.js');
  loggerModule = await import('../../src/utils/logger.js');
  userHierarchyDao = await import('../../src/apis/userHierarchy/userHierarchyDao.js');
  helpers = await import('../../src/helpers/index.js');
  db = await import('../../src/utils/db.js');
});

beforeEach(() => {
  // Reassign all mock functions for isolation
  if (db) {
    db.beginTransaction = jest.fn();
    db.commit = jest.fn();
    db.rollback = jest.fn();
    db.getConnection = jest.fn();
  }
  if (chargeBackDao) {
    chargeBackDao.createChargeBackDao = jest.fn();
    chargeBackDao.getChargebackByIdDao = jest.fn();
    chargeBackDao.getChargeBackDao = jest.fn();
    chargeBackDao.getAllChargeBackDao = jest.fn();
    chargeBackDao.getChargeBacksBySearchDao = jest.fn();
    chargeBackDao.updateChargeBackDao = jest.fn();
    chargeBackDao.deleteChargeBackDao = jest.fn();
    chargeBackDao.chargeBackExistsByPayinIdDao = jest.fn();
  }
  if (calculationDao) {
    calculationDao.getCalculationforCronDao = jest.fn();
    calculationDao.updateCalculationBalanceDao = jest.fn();
  }
  if (companyDao) {
    companyDao.getCompanyDao = jest.fn();
    companyDao.updateCompanyConfigDao = jest.fn();
  }
  if (merchantDao) {
    merchantDao.getMerchantByUserIdDao = jest.fn();
    merchantDao.getMerchantConfigByUserIdDao = jest.fn();
    merchantDao.updateMerchantDao = jest.fn();
  }
  if (userHierarchyDao) {
    userHierarchyDao.getUserHierarchysDao = jest.fn();
  }
  if (loggerModule?.logger) {
    loggerModule.logger.error = jest.fn();
    loggerModule.logger.info = jest.fn();
    loggerModule.logger.warn = jest.fn();
  }
  if (helpers) {
    helpers.filterResponse = jest.fn((data) => data);
    helpers.trackVendorsNetBalance = jest.fn();
  }
});

afterEach(() => {
  jest.clearAllMocks();
});

// -------------------- TESTS ------------------------
describe('chargeBackService', () => {
  describe('createChargeBackService', () => {
    it('should create chargeback with valid data', async () => {
      const mockConn_obj = mockConn();
      db.getConnection.mockResolvedValue(mockConn_obj);
      db.beginTransaction.mockResolvedValue();
      db.commit.mockResolvedValue();

      calculationDao.getCalculationforCronDao.mockResolvedValueOnce([{ id: 1 }]);
      calculationDao.getCalculationforCronDao.mockResolvedValueOnce([{ id: 2 }]);
      companyDao.getCompanyDao.mockResolvedValue([{ id: 1, config: { blocked_users: [] } }]);
      merchantDao.getMerchantConfigByUserIdDao.mockResolvedValue([
        { id: 10, name: 'Merchant', code: 'MERC1', config: { blocked_users: [] } },
      ]);
      chargeBackDao.createChargeBackDao.mockResolvedValue({ 
        id: 1, 
        amount: 1000,
        merchant_user_id: 10,
        config: { blocked_users: [{ userId: 'user1', user_ip: '192.168.1.1' }] },
        created_at: '2024-01-01',
        updated_at: '2024-01-01'
      });
      calculationDao.updateCalculationBalanceDao.mockResolvedValue({ id: 2 });

      const payload = { merchant_order_id: 'order123', amount: 1000 };
      const payinDetails = [
        {
          payin_id: 1,
          merchant_user_id: 10,
          vendor_user_id: 20,
          bank_acc_id: 'bank1',
          status: 'COMPLETED',
          user: 'user1',
          user_ip: '192.168.1.1',
          bank_name: 'Test Bank',
          utr: 'UTR123',
          vendor_name: 'Test Vendor',
        },
      ];

      await service.createChargeBackService(payload, payinDetails, 'ADMIN', 1, 2);

      // Verify chargeback creation and balance update
      expect(chargeBackDao.createChargeBackDao).toHaveBeenCalled();
      // Verify balance update for vendor
      expect(db.commit).toHaveBeenCalled();
    });

    it('should throw error if merchant calculation not found', async () => {
      calculationDao.getCalculationforCronDao.mockResolvedValueOnce(null);

      const payload = { merchant_order_id: 'order123', amount: 1000 };
      const payinDetails = [
        {
          payin_id: 1,
          merchant_user_id: 10,
          vendor_user_id: 20,
        },
      ];

      // Expect the service to throw an error about missing merchant calculations
      await expect(
        service.createChargeBackService(payload, payinDetails, 'ADMIN', 1, 2),
      ).rejects.toThrow('Merchant calculations not found');
    });

    it('should throw error if vendor calculation not found', async () => {
      calculationDao.getCalculationforCronDao.mockResolvedValueOnce([{ id: 1 }]);
      calculationDao.getCalculationforCronDao.mockResolvedValueOnce(null);

      const payload = { merchant_order_id: 'order123', amount: 1000 };
      const payinDetails = [
        {
          payin_id: 1,
          merchant_user_id: 10,
          vendor_user_id: 20,
        },
      ];

      // Expect the service to throw an error about missing vendor calculations
      await expect(
        service.createChargeBackService(payload, payinDetails, 'ADMIN', 1, 2),
      ).rejects.toThrow('Vendor calculations not found');
    });

    it('should log error on exception', async () => {
      db.getConnection.mockRejectedValue(new Error('connection failed'));

      calculationDao.getCalculationforCronDao.mockResolvedValueOnce([{ id: 1 }]);
      calculationDao.getCalculationforCronDao.mockResolvedValueOnce([{ id: 2 }]);

      const payload = { merchant_order_id: 'order123', amount: 1000 };
      const payinDetails = [{ payin_id: 1, merchant_user_id: 10, vendor_user_id: 20 }];

      // Expect the service to throw an error about connection failure
      await expect(
        service.createChargeBackService(payload, payinDetails, 'ADMIN', 1, 2),
      ).rejects.toThrow();
    });
  });

  describe('getChargeBacksService', () => {
    it('should fetch chargebacks for ADMIN role', async () => {
      chargeBackDao.getAllChargeBackDao.mockResolvedValue([
        { id: 1, amount: 1000, status: 'COMPLETED' },
      ]);

      const result = await service.getChargeBacksService(
        { company_id: 1 },
        'ADMIN',
        1,
        10,
        2,
      );

      // Verify that the DAO method was called and the result is an array
      expect(chargeBackDao.getAllChargeBackDao).toHaveBeenCalled();
      // Verify that the result is an array of chargebacks
      expect(Array.isArray(result)).toBe(true);
    });

    it('should fetch chargebacks for MERCHANT role', async () => {
      userHierarchyDao.getUserHierarchysDao.mockResolvedValue([
        { config: { siblings: { sub_merchants: [] } } },
      ]);
      chargeBackDao.getAllChargeBackDao.mockResolvedValue([
        { id: 1, amount: 1000, merchant_user_id: 1 },
      ]);

      const result = await service.getChargeBacksService(
        { company_id: 1 },
        'MERCHANT',
        1,
        10,
        1,
      );

      // Verify that the DAO method was called and the result is an array
      expect(chargeBackDao.getAllChargeBackDao).toHaveBeenCalled();
      // Verify that the result is an array of chargebacks
      expect(Array.isArray(result)).toBe(true);
    });

    it('should log error on exception', async () => {
      chargeBackDao.getAllChargeBackDao.mockRejectedValue(new Error('fetch failed'));

      // Expect the service to throw an error about fetch failure
      await expect(
        service.getChargeBacksService({ company_id: 1 }, 'ADMIN', 1, 10, 2),
      ).rejects.toThrow();
      // Verify that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getChargeBacksBySearchService', () => {
    it('should search chargebacks with filters', async () => {
      chargeBackDao.getChargeBacksBySearchDao.mockResolvedValue({
        totalCount: 5,
        totalPages: 1,
        chargeBacks: [{ id: 1, amount: 1000 }],
      });

      const result = await service.getChargeBacksBySearchService(
        { company_id: 1, search: 'test' },
        'ADMIN',
        1,
        10,
        2,
        'ASC',
        'Manager',
        [],
      );

      // Verify that the DAO method was called and the result has expected properties
      expect(chargeBackDao.getChargeBacksBySearchDao).toHaveBeenCalled();
      // Verify that the result has totalCount and chargeBacks properties
      expect(result).toHaveProperty('totalCount');
      // Verify that the result has chargeBacks property which is an array
      expect(result).toHaveProperty('chargeBacks');
    });

    it('should log error on exception', async () => {
      chargeBackDao.getChargeBacksBySearchDao.mockRejectedValue(
        new Error('search failed'),
      );

      // Expect the service to throw an error about search failure
      await expect(
        service.getChargeBacksBySearchService(
          { company_id: 1 },
          'ADMIN',
          1,
          10,
          2,
        ),
      ).rejects.toThrow();
      // Verify that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('updateChargeBackService', () => {
    it('should update chargeback with valid data', async () => {
      const mockConn_obj = mockConn();
      db.getConnection.mockResolvedValue(mockConn_obj);
      db.beginTransaction.mockResolvedValue();
      db.commit.mockResolvedValue();

      const today = new Date().toISOString().split('T')[0];
      chargeBackDao.getChargebackByIdDao.mockResolvedValue([
        {
          id: 1,
          amount: 1000,
          merchant_user_id: 10,
          vendor_user_id: 20,
          created_at: `${today}T00:00:00Z`,
        },
      ]);
      calculationDao.getCalculationforCronDao.mockResolvedValueOnce([{ id: 1 }]);
      calculationDao.getCalculationforCronDao.mockResolvedValueOnce([{ id: 2 }]);
      chargeBackDao.updateChargeBackDao.mockResolvedValue({
        id: 1,
        status: 'RESOLVED',
        amount: 1000,
        merchant_user_id: 10,
        vendor_user_id: 20,
      });
      calculationDao.updateCalculationBalanceDao.mockResolvedValue();

      await service.updateChargeBackService(
        { id: 1, company_id: 1 },
        { status: 'RESOLVED' },
        'ADMIN',
      );

      // Verify that the DAO method was called and the chargeback was updated
      expect(chargeBackDao.updateChargeBackDao).toHaveBeenCalled();
      // Verify that the transaction was committed
      expect(db.commit).toHaveBeenCalled();
    });

    it('should log error on exception', async () => {
      db.getConnection.mockRejectedValue(new Error('connection failed'));

      await expect(
        service.updateChargeBackService(
          { id: 1, company_id: 1 },
          { status: 'RESOLVED' },
          'ADMIN',
        ),
      ).rejects.toThrow();
      // Verify that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('deleteChargeBackService', () => {
    it('should delete chargeback with valid id', async () => {
      chargeBackDao.deleteChargeBackDao.mockResolvedValue({ id: 1 });

      const result = await service.deleteChargeBackService(
        { id: 1, company_id: 1 },
        { is_obsolete: true, updated_by: 2 },
        'ADMIN',
      );

      // Verify that the DAO method was called and the chargeback was marked as obsolete
      expect(chargeBackDao.deleteChargeBackDao).toHaveBeenCalled();
      // Verify that the result is defined and has expected properties
      expect(result).toBeDefined();
    });

    it('should log error on exception', async () => {
      chargeBackDao.deleteChargeBackDao.mockRejectedValue(
        new Error('delete failed'),
      );

      // Expect the service to throw an error about delete failure
      await expect(
        service.deleteChargeBackService(
          { id: 1, company_id: 1 },
          { is_obsolete: true },
          'ADMIN',
        ),
      ).rejects.toThrow();
      // Verify that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('blockChargebackUserService', () => {
    it('should block user with valid data', async () => {
      const mockConn_obj = mockConn();
      db.getConnection.mockResolvedValue(mockConn_obj);
      db.beginTransaction.mockResolvedValue();
      db.commit.mockResolvedValue();

      chargeBackDao.getChargebackByIdDao.mockResolvedValue([
        {
          id: 1,
          merchant_user_id: 10,
          config: { blocked_users: [] },
        },
      ]);
      companyDao.getCompanyDao.mockResolvedValue([
        { id: 1, config: { blocked_users: [] } },
      ]);
      merchantDao.getMerchantByUserIdDao.mockResolvedValue([
        { id: 10, name: 'Merchant' },
      ]);
      chargeBackDao.updateChargeBackDao.mockResolvedValue({
        id: 1,
        config: { blocked_users: [{ userId: 'user1', user_ip: '192.168.1.1' }] },
      });

      await service.blockChargebackUserService(
        { id: 1, company_id: 1 },
        { config: { user_ip: '192.168.1.1', userId: 'user1', merchant_user_id: 10 } },
      );

      // Verify that the DAO method was called and the user was blocked
      expect(chargeBackDao.updateChargeBackDao).toHaveBeenCalled();
      // Verify that the transaction was committed
      expect(db.commit).toHaveBeenCalled();
    });

    it('should unblock user when user already blocked', async () => {
      const mockConn_obj = mockConn();
      db.getConnection.mockResolvedValue(mockConn_obj);
      db.beginTransaction.mockResolvedValue();
      db.commit.mockResolvedValue();

      chargeBackDao.getChargebackByIdDao.mockResolvedValue([
        {
          id: 1,
          merchant_user_id: 10,
          config: { blocked_users: [{ userId: 'user1', user_ip: '192.168.1.1' }] },
        },
      ]);
      companyDao.getCompanyDao.mockResolvedValue([
        { id: 1, config: { blocked_users: [{ user_ip: ['192.168.1.1'] }] } },
      ]);
      merchantDao.getMerchantByUserIdDao.mockResolvedValue([
        { id: 10, name: 'Merchant', config: { blocked_users: [{ userId: ['user1'] }] } },
      ]);
      chargeBackDao.updateChargeBackDao.mockResolvedValue({
        id: 1,
        config: { blocked_users: [] },
      });

      await service.blockChargebackUserService(
        { id: 1, company_id: 1 },
        { config: { user_ip: '192.168.1.1', userId: 'user1', merchant_user_id: 10 } },
      );

      // Verify that the DAO method was called and the user was unblocked
      expect(chargeBackDao.updateChargeBackDao).toHaveBeenCalled();
      // Verify that the transaction was committed
      expect(db.commit).toHaveBeenCalled();
    });

    it('should log error on exception', async () => {
      db.getConnection.mockRejectedValue(new Error('connection failed'));

      // Expect the service to throw an error about connection failure
      await expect(
        service.blockChargebackUserService(
          { id: 1, company_id: 1 },
          { config: { user_ip: '192.168.1.1', userId: 'user1', merchant_user_id: 10 } },
        ),
      ).rejects.toThrow();
      // Verify that the error was logged
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });
});
