// -------------------- ESM MOCKS --------------------
/* global describe, it, expect, beforeEach, afterEach, beforeAll */
import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/utils/appErrors.js', () => ({
  BadRequestError: class BadRequestError extends Error {},
  NotFoundError: class NotFoundError extends Error {},
}));

jest.unstable_mockModule('../../src/constants/index.js', () => ({
  columns: { SETTLEMENT: ['id', 'status'] },
  merchantColumns: { SETTLEMENT: ['id', 'amount'] },
  vendorColumns: { SETTLEMENT: ['id', 'method'] },
  Role: {
    ADMIN: 'ADMIN',
    MERCHANT: 'MERCHANT',
    VENDOR: 'VENDOR',
    SUB_VENDOR: 'SUB_VENDOR',
    MERCHANT_OPERATIONS: 'MERCHANT_OPERATIONS',
    VENDOR_OPERATIONS: 'VENDOR_OPERATIONS',
  },
  Status: {
    BOT: 'BOT',
    INITIATED: 'INITIATED',
    SUCCESS: 'SUCCESS',
    REJECTED: 'REJECTED',
    REVERSED: 'REVERSED',
  },
  tableName: {
    SETTLEMENT: 'Settlement',
    BANK_RESPONSE: 'BankResponse',
  },
}));

jest.unstable_mockModule('../../src/utils/db.js', () => ({
  beginTransaction: jest.fn(async () => {}),
  commit: jest.fn(async () => {}),
  rollback: jest.fn(async () => {}),
  getConnection: jest.fn(async () => ({ release: jest.fn(), query: jest.fn() })),
  buildAndExecuteUpdateQuery: jest.fn(async () => ({})),
}));

jest.unstable_mockModule('../../src/apis/settlement/settlementDao.js', () => ({
  createSettlementDao: jest.fn(async () => ({ id: 'settle-1' })),
  deleteSettlementDao: jest.fn(async () => ({ id: 'settle-1' })),
  getSettlementDao: jest.fn(async () => [{ id: 'settle-1' }]),
  updateSettlementDao: jest.fn(async () => ({ id: 'settle-1', status: 'INITIATED', config: {} })),
  getSettlementsBySearchDao: jest.fn(async () => ({ totalCount: 1, totalPages: 1, settlements: [{ id: 'settle-1' }] })),
  getSettlementByUTRDao: jest.fn(async () => []),
}));

jest.unstable_mockModule('../../src/apis/calculation/calculationDao.js', () => ({
  getCalculationforCronDao: jest.fn(async () => []),
  updateCalculationBalanceDao: jest.fn(async () => ({})),
  updateCalculationConfigDao: jest.fn(async () => ({})),
}));

jest.unstable_mockModule('../../src/apis/merchants/merchantDao.js', () => ({
  getMerchantsDao: jest.fn(async () => []),
}));

jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

jest.unstable_mockModule('../../src/apis/userHierarchy/userHierarchyDao.js', () => ({
  getUserHierarchysDao: jest.fn(async () => []),
}));

jest.unstable_mockModule('../../src/apis/bankResponse/bankResponseDao.js', () => ({
  getBankResponseByUTR: jest.fn(async () => null),
  getInternalBankResponseByUTR: jest.fn(async () => null),
  updateBankResponseDao: jest.fn(async () => ({})),
}));

jest.unstable_mockModule('../../src/apis/vendors/vendorDao.js', () => ({
  getVendorsDao: jest.fn(async () => []),
}));

jest.unstable_mockModule('../../src/utils/calculation.js', () => ({
  calculateCommission: jest.fn(() => 0),
}));

jest.unstable_mockModule('../../src/helpers/index.js', () => ({
  getISTDateString: jest.fn(() => '01-01-2026 12:00:00 AM'),
}));

jest.unstable_mockModule('../../src/utils/advisoryLock.js', () => ({
  checkLockEdit: jest.fn(async () => {}),
}));

jest.unstable_mockModule('../../src/apis/beneficiaryAccounts/beneficiaryAccountDao.js', () => ({
  getBeneficiaryAccountDao: jest.fn(async () => []),
}));

jest.unstable_mockModule('../../src/utils/sockets.js', () => ({
  newTableEntry: jest.fn(async () => ({})),
}));

jest.unstable_mockModule('../../src/utils/trackVendorsNetBalance.js', () => ({
  trackVendorsNetBalance: jest.fn(async () => {}),
}));

// -------------------- IMPORTS ----------------------
let service;
let constants;
let db;
let dao;
let loggerModule;
let userHierarchyDao;
let locks;
let calculationDao;
let bankResponseDao;
let vendorDao;
let merchantDao;
let sockets;
let calculationUtils;
let helpersModule;

let conn;
const makeConn = () => ({
  release: jest.fn(),
  query: jest.fn(),
});

beforeAll(async () => {
  service = await import('../../src/apis/settlement/settlementServices.js');
  constants = await import('../../src/constants/index.js');
  db = await import('../../src/utils/db.js');
  dao = await import('../../src/apis/settlement/settlementDao.js');
  loggerModule = await import('../../src/utils/logger.js');
  userHierarchyDao = await import('../../src/apis/userHierarchy/userHierarchyDao.js');
  locks = await import('../../src/utils/advisoryLock.js');
  calculationDao = await import('../../src/apis/calculation/calculationDao.js');
  bankResponseDao = await import('../../src/apis/bankResponse/bankResponseDao.js');
  vendorDao = await import('../../src/apis/vendors/vendorDao.js');
  merchantDao = await import('../../src/apis/merchants/merchantDao.js');
  sockets = await import('../../src/utils/sockets.js');
  calculationUtils = await import('../../src/utils/calculation.js');
  helpersModule = await import('../../src/helpers/index.js');
});

beforeEach(() => {
  conn = makeConn();

  db.getConnection = jest.fn(async () => conn);
  db.beginTransaction = jest.fn(async () => {});
  db.commit = jest.fn(async () => {});
  db.rollback = jest.fn(async () => {});
  db.buildAndExecuteUpdateQuery = jest.fn(async () => ({}));

  dao.createSettlementDao = jest.fn(async () => ({ id: 'settle-1', status: 'INITIATED', config: {} }));
  dao.deleteSettlementDao = jest.fn(async () => ({ id: 'settle-1' }));
  dao.getSettlementDao = jest.fn(async () => [{ id: 'settle-1', user_id: 'user-1', status: constants.Status.INITIATED, method: 'BANK', config: {} }]);
  dao.updateSettlementDao = jest.fn(async () => ({ id: 'settle-1', status: constants.Status.INITIATED, config: {} }));
  dao.getSettlementsBySearchDao = jest.fn(async () => ({ totalCount: 1, totalPages: 1, settlements: [{ id: 'settle-1' }] }));
  dao.getSettlementByUTRDao = jest.fn(async () => []);

  userHierarchyDao.getUserHierarchysDao = jest.fn(async () => []);
  locks.checkLockEdit = jest.fn(async () => {});

  calculationDao.getCalculationforCronDao = jest.fn(async () => []);
  calculationDao.updateCalculationBalanceDao = jest.fn(async () => ({}));
  calculationDao.updateCalculationConfigDao = jest.fn(async () => ({}));

  bankResponseDao.getBankResponseByUTR = jest.fn(async () => null);
  bankResponseDao.getInternalBankResponseByUTR = jest.fn(async () => null);
  bankResponseDao.updateBankResponseDao = jest.fn(async () => ({}));

  vendorDao.getVendorsDao = jest.fn(async () => []);
  merchantDao.getMerchantsDao = jest.fn(async () => []);
  if (sockets?.newTableEntry?.mockResolvedValue) {
    sockets.newTableEntry.mockResolvedValue({});
  }
  if (calculationUtils?.calculateCommission?.mockImplementation) {
    calculationUtils.calculateCommission.mockImplementation(() => 5);
  }
  if (helpersModule?.getISTDateString?.mockReturnValue) {
    helpersModule.getISTDateString.mockReturnValue('01-01-2026 12:00:00 AM');
  }

  loggerModule.logger.error = jest.fn();
  loggerModule.logger.info = jest.fn();
  loggerModule.logger.warn = jest.fn();
});

afterEach(() => {
  jest.clearAllMocks();
});

// -------------------- TESTS ------------------------
describe('settlementServices', () => {
  describe('getSettlementServiceById', () => {
    it('should fetch settlement by id with admin columns', async () => {
      dao.getSettlementDao.mockResolvedValue([{ id: 'settle-1' }]);

      const result = await service.getSettlementServiceById({
        id: 'settle-1',
        company_id: 'company-1',
        role: constants.Role.ADMIN,
      });

      // Result should match the mocked DAO response
      expect(dao.getSettlementDao).toHaveBeenCalled();
      expect(result).toEqual([{ id: 'settle-1' }]);
    });

    it('should log and throw on dao error', async () => {
      dao.getSettlementDao.mockRejectedValue(new Error('fail'));

      await expect(
        service.getSettlementServiceById({
          id: 'settle-1',
          company_id: 'company-1',
          role: constants.Role.ADMIN,
        }),
      ).rejects.toThrow('fail');

      // Logger should have been called with the error
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });

    it('should use merchant settlement columns for merchant role', async () => {
      await service.getSettlementServiceById({
        id: 'settle-1',
        company_id: 'company-1',
        role: constants.Role.MERCHANT,
      });

      const args = dao.getSettlementDao.mock.calls[0];
      // Check that the correct columns were passed for merchant role
      expect(args[5]).toEqual(constants.merchantColumns.SETTLEMENT);
    });

    it('should use vendor settlement columns for vendor role', async () => {
      await service.getSettlementServiceById({
        id: 'settle-1',
        company_id: 'company-1',
        role: constants.Role.VENDOR,
      });

      const args = dao.getSettlementDao.mock.calls[0];
      // Check that the correct columns were passed for vendor role
      expect(args[5]).toEqual(constants.vendorColumns.SETTLEMENT);
    });
  });

  describe('getSettlementService', () => {
    it('should throw if company_id is missing', async () => {
      // Company ID is required for fetching settlements, so the service should throw an error if it's not provided
      await expect(
        service.getSettlementService(
          {},
          {},
          1,
          10,
          'sno',
          'DESC',
          constants.Role.ADMIN,
          'user-1',
          constants.Role.ADMIN,
        ),
      ).rejects.toThrow('Company ID is required');
    });

    it('should apply user filter for merchant non-operations role', async () => {
      const filters = {};
      await service.getSettlementService(
        { company_id: 'company-1', role: constants.Role.MERCHANT },
        filters,
        1,
        10,
        'sno',
        'DESC',
        constants.Role.MERCHANT,
        'merchant-user-1',
        constants.Role.ADMIN,
      );

      // For merchant role, the service should apply a filter to only return settlements for the logged-in user
      expect(dao.getSettlementDao).toHaveBeenCalled();
      // Check that the user_id filter was set to the logged-in user's ID
      expect(filters.user_id).toEqual(['merchant-user-1']);
    });

    it('should return settlements for valid input', async () => {
      dao.getSettlementDao.mockResolvedValue([{ id: 'settle-1' }]);

      const result = await service.getSettlementService(
        { company_id: 'company-1', role: constants.Role.ADMIN },
        {},
        1,
        10,
        'sno',
        'DESC',
        constants.Role.ADMIN,
        'user-1',
        constants.Role.ADMIN,
      );

      // The service should return the settlements as provided by the DAO
      expect(result).toEqual([{ id: 'settle-1' }]);
    });

    it('should log and throw on dao error', async () => {
      dao.getSettlementDao.mockRejectedValue(new Error('fail'));

      // The service should log the error and re-throw it when the DAO call fails
      await expect(
        service.getSettlementService(
          { company_id: 'company-1', role: constants.Role.ADMIN },
          {},
          1,
          10,
          'sno',
          'DESC',
          constants.Role.ADMIN,
          'user-1',
          constants.Role.ADMIN,
        ),
      ).rejects.toThrow('fail');

      // Logger should have been called with the error
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });

    it('should apply user filter for vendor non-operations role', async () => {
      const filters = {};
      await service.getSettlementService(
        { company_id: 'company-1', role: constants.Role.VENDOR },
        filters,
        1,
        10,
        'sno',
        'DESC',
        constants.Role.VENDOR,
        'vendor-user-1',
        constants.Role.ADMIN,
      );

      // For vendor role, the service should apply a filter to only return settlements for the logged-in user
      expect(filters.user_id).toEqual(['vendor-user-1']);
    });

    it('should map parent user_id for merchant operations role', async () => {
      userHierarchyDao.getUserHierarchysDao.mockResolvedValue([
        { config: { parent: 'merchant-parent-1' } },
      ]);

      const filters = {};
      await service.getSettlementService(
        { company_id: 'company-1', role: constants.Role.MERCHANT },
        filters,
        1,
        10,
        'sno',
        'DESC',
        constants.Role.MERCHANT,
        'merchant-op-user-1',
        constants.Role.MERCHANT_OPERATIONS,
      );

      // For merchant operations role, the service should fetch the parent user ID and apply it as a filter to return settlements for the parent merchant
      expect(filters.user_id).toEqual(['merchant-parent-1']);
    });

    it('should use default sort values when sortBy and sortOrder are missing', async () => {
      await service.getSettlementService(
        { company_id: 'company-1', role: constants.Role.ADMIN },
        {},
        1,
        10,
        undefined,
        undefined,
        constants.Role.ADMIN,
        'user-1',
        constants.Role.ADMIN,
      );

      const args = dao.getSettlementDao.mock.calls[0];
      // The service should default to sorting by 'sno' in descending order when sortBy and sortOrder are not provided
      expect(args[3]).toBe('sno');
      // The service should default to 'DESC' sort order when sortOrder is not provided
      expect(args[4]).toBe('DESC');
    });
  });

  describe('getSettlementsBySearchService', () => {
    it('should throw if company_id is missing', async () => {
      // Company ID is required for searching settlements, so the service should throw an error if it's not provided
      await expect(
        service.getSettlementsBySearchService(
          {},
          {},
          1,
          10,
          'sno',
          'DESC',
          constants.Role.ADMIN,
          'user-1',
          constants.Role.ADMIN,
        ),
      ).rejects.toThrow('Company ID is required');
    });

    it('should parse search terms and call search dao', async () => {
      const result = await service.getSettlementsBySearchService(
        { company_id: 'company-1' },
        { search: 'abc, def' },
        1,
        10,
        'sno',
        'DESC',
        constants.Role.ADMIN,
        'user-1',
        constants.Role.ADMIN,
      );

      // The service should parse the search string into an array of search terms and pass it to the DAO
      expect(dao.getSettlementsBySearchDao).toHaveBeenCalled();
      // The search terms should be parsed into an array and passed as the 6th argument to the DAO
      expect(result).toHaveProperty('totalCount', 1);
    });

    it('should map parent user_id for merchant operations role', async () => {
      userHierarchyDao.getUserHierarchysDao
        .mockResolvedValueOnce([{ config: { parent: 'parent-user-1' } }])
        .mockResolvedValueOnce([]);

      await service.getSettlementsBySearchService(
        { company_id: 'company-1' },
        {},
        1,
        10,
        'sno',
        'DESC',
        constants.Role.MERCHANT,
        'merchant-op-user-1',
        constants.Role.MERCHANT_OPERATIONS,
      );

      const firstCallArgs = dao.getSettlementsBySearchDao.mock.calls[0][0];
      // For merchant operations role, the service should fetch the parent user ID and apply it as a filter to return settlements for the parent merchant
      expect(firstCallArgs.user_id).toEqual(['parent-user-1']);
    });

    it('should include sub vendors for vendor role', async () => {
      userHierarchyDao.getUserHierarchysDao
        .mockResolvedValueOnce([
          { config: { siblings: { sub_vendors: ['sub-1', 'sub-2'] } } },
        ])
        .mockResolvedValueOnce([]);

      await service.getSettlementsBySearchService(
        { company_id: 'company-1' },
        {},
        1,
        10,
        'sno',
        'DESC',
        constants.Role.VENDOR,
        'vendor-user-1',
        constants.Role.ADMIN,
      );

      const firstCallArgs = dao.getSettlementsBySearchDao.mock.calls[0][0];
      // For vendor role, the service should apply a filter to only return settlements for the logged-in user and their sub-vendors
      expect(firstCallArgs.user_id).toEqual(['vendor-user-1', 'sub-1', 'sub-2']);
    });

    it('should log and throw on dao error', async () => {
      dao.getSettlementsBySearchDao.mockRejectedValue(new Error('fail'));

      // The service should log the error and re-throw it when the DAO call fails
      await expect(
        service.getSettlementsBySearchService(
          { company_id: 'company-1' },
          {},
          1,
          10,
          'sno',
          'DESC',
          constants.Role.ADMIN,
          'user-1',
          constants.Role.ADMIN,
        ),
      ).rejects.toThrow('fail');

      // Logger should have been called with the error
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });

    it('should apply only self user_id for sub-vendor role', async () => {
      await service.getSettlementsBySearchService(
        { company_id: 'company-1' },
        {},
        1,
        10,
        'sno',
        'DESC',
        constants.Role.SUB_VENDOR,
        'sub-vendor-user-1',
        constants.Role.ADMIN,
      );

      const firstCallArgs = dao.getSettlementsBySearchDao.mock.calls[0][0];
      // For sub-vendor role, the service should apply a filter to only return settlements for the logged-in sub-vendor user
      expect(firstCallArgs.user_id).toEqual(['sub-vendor-user-1']);
    });

    it('should use parent and sub-vendors for vendor operations role', async () => {
      userHierarchyDao.getUserHierarchysDao.mockResolvedValue([
        {
          config: {
            parent: 'parent-vendor-1',
            siblings: { sub_vendors: ['sub-1', 'sub-2'] },
          },
        },
      ]);

      await service.getSettlementsBySearchService(
        { company_id: 'company-1' },
        {},
        1,
        10,
        'sno',
        'DESC',
        constants.Role.VENDOR,
        'vendor-op-user-1',
        constants.Role.VENDOR_OPERATIONS,
      );

      const firstCallArgs = dao.getSettlementsBySearchDao.mock.calls[0][0];
      // For vendor operations role, the service should apply a filter to return settlements for the parent vendor and their sub-vendors
      expect(firstCallArgs.user_id).toEqual(['parent-vendor-1', 'sub-1', 'sub-2']);
    });

    it('should pass empty search terms when search is missing', async () => {
      await service.getSettlementsBySearchService(
        { company_id: 'company-1' },
        {},
        1,
        10,
        undefined,
        undefined,
        constants.Role.ADMIN,
        'user-1',
        constants.Role.ADMIN,
      );

      const args = dao.getSettlementsBySearchDao.mock.calls[0];
      // The service should default to an empty array of search terms when the search string is not provided
      expect(args[3]).toBe('sno');
      // The service should default to 'DESC' sort order when sortOrder is not provided
      expect(args[4]).toBe('DESC');
      // The service should pass an empty array for search terms when search is not provided
      expect(args[6]).toEqual([]);
    });
  });

  describe('createSettlementService', () => {
    it('should begin, commit and return created settlement', async () => {
      dao.createSettlementDao.mockResolvedValue({ id: 'settle-1', status: 'INITIATED', config: {} });

      const result = await service.createSettlementService(
        {
          method: 'BANK',
          amount: 100,
          user_id: 'user-1',
          company_id: 'company-1',
          config: {},
        },
        constants.Role.ADMIN,
      );

      // The service should call the DAO to create the settlement, commit the transaction, and return the created settlement
      expect(db.getConnection).toHaveBeenCalled();
      // The service should begin a transaction before creating the settlement
      expect(db.beginTransaction).toHaveBeenCalledWith(conn);
      // The service should call the DAO to create the settlement with the provided data
      expect(dao.createSettlementDao).toHaveBeenCalled();
      // The service should commit the transaction after successfully creating the settlement
      expect(db.commit).toHaveBeenCalledWith(conn);
      // The service should release the database connection after the operation is complete
      expect(conn.release).toHaveBeenCalled();
      // The result should match the mocked DAO response for the created settlement
      expect(result).toEqual({ id: 'settle-1', status: 'INITIATED', config: {} });
    });

    it('should rollback and throw on create error', async () => {
      dao.createSettlementDao.mockRejectedValue(new Error('fail'));

      // The service should rollback the transaction and re-throw the error when the DAO call to create the settlement fails
      await expect(
        service.createSettlementService(
          {
            method: 'BANK',
            amount: 100,
            user_id: 'user-1',
            company_id: 'company-1',
            config: {},
          },
          constants.Role.ADMIN,
        ),
      ).rejects.toThrow('fail');

      // The service should rollback the transaction when an error occurs during settlement creation
      expect(db.rollback).toHaveBeenCalledWith(conn);
      // The service should log the error when settlement creation fails
      expect(loggerModule.logger.error).toHaveBeenCalled();
      // The service should release the database connection after the operation is complete, even when an error occurs
      expect(conn.release).toHaveBeenCalled();
    });

    it('should throw when internal transfer UTR is not found', async () => {
      bankResponseDao.getBankResponseByUTR.mockResolvedValue(null);

      // When creating an internal transfer settlement, if the provided UTR does not match any bank response, the service should throw an error indicating that the bank response was not found
      await expect(
        service.createSettlementService(
          {
            method: 'INTERNAL_QR_TRANSFER',
            amount: 100,
            user_id: 'user-1',
            company_id: 'company-1',
            config: { reference_id: 'UTR-1', debit_credit: 'PAID' },
          },
          constants.Role.ADMIN,
        ),
      ).rejects.toThrow('Bank response not found for the provided UTR');

      // The service should rollback the transaction when the UTR validation fails during internal transfer settlement creation
      expect(db.rollback).toHaveBeenCalledWith(conn);
    });

    it('should throw when internal transfer UTR is already used', async () => {
      bankResponseDao.getBankResponseByUTR.mockResolvedValue({
        id: 'br-1',
        is_used: true,
        status: constants.Status.BOT,
      });
      dao.getSettlementByUTRDao.mockResolvedValue([]);

      // When creating an internal transfer settlement, if the provided UTR matches a bank response that is already marked as used, the service should throw an error indicating that the UTR is already used
      await expect(
        service.createSettlementService(
          {
            method: 'INTERNAL_QR_TRANSFER',
            amount: 100,
            user_id: 'user-1',
            company_id: 'company-1',
            config: { reference_id: 'UTR-1', debit_credit: 'PAID' },
          },
          constants.Role.ADMIN,
        ),
      ).rejects.toThrow('UTR is already used');

      // The service should rollback the transaction when the UTR validation fails due to it being already used during internal transfer settlement creation
      expect(db.rollback).toHaveBeenCalledWith(conn);
    });

    it('should create internal transfer for vendor role with valid UTR', async () => {
      bankResponseDao.getBankResponseByUTR.mockResolvedValue({
        id: 'br-1',
        is_used: false,
        status: constants.Status.BOT,
      });
      dao.getSettlementByUTRDao.mockResolvedValue([]);
      dao.createSettlementDao.mockResolvedValue({ id: 'settle-2', amount: 150, status: 'INITIATED', config: {} });

      const result = await service.createSettlementService(
        {
          method: 'INTERNAL_QR_TRANSFER',
          amount: 150,
          user_id: 'vendor-user-1',
          company_id: 'company-1',
          config: { reference_id: 'UTR-1', debit_credit: 'PAID' },
        },
        constants.Role.VENDOR,
      );

      // The service should successfully create an internal transfer settlement for a vendor role when a valid UTR is provided, and return the created settlement
      expect(dao.createSettlementDao).toHaveBeenCalled();
      // The result should match the mocked DAO response for the created settlement
      expect(result).toHaveProperty('id', 'settle-2');
      // The service should commit the transaction after successfully creating the settlement
      expect(db.commit).toHaveBeenCalledWith(conn);
    });

    it('should throw when internal transfer admin flow has no vendor data', async () => {
      bankResponseDao.getBankResponseByUTR.mockResolvedValue({
        id: 'br-1',
        is_used: false,
        status: constants.Status.BOT,
      });
      dao.getSettlementByUTRDao.mockResolvedValue([]);
      vendorDao.getVendorsDao.mockResolvedValue([]);

      // When creating an internal transfer settlement as an admin, if the provided UTR is valid but there is no corresponding vendor data for the user ID, the service should throw an error indicating that the vendor was not found
      await expect(
        service.createSettlementService(
          {
            method: 'INTERNAL_QR_TRANSFER',
            amount: 100,
            user_id: 'vendor-user-1',
            company_id: 'company-1',
            config: { reference_id: 'UTR-2', debit_credit: 'PAID' },
          },
          constants.Role.ADMIN,
        ),
      ).rejects.toThrow('Vendor not found');
    });

    it('should throw when internal transfer admin flow has no calculation data', async () => {
      bankResponseDao.getBankResponseByUTR.mockResolvedValue({
        id: 'br-1',
        is_used: false,
        status: constants.Status.BOT,
      });
      dao.getSettlementByUTRDao.mockResolvedValue([]);
      vendorDao.getVendorsDao.mockResolvedValue([{ user_id: 'vendor-user-1' }]);
      calculationDao.getCalculationforCronDao.mockResolvedValue([]);

      // When creating an internal transfer settlement as an admin, if the provided UTR is valid and there is corresponding vendor data for the user ID, but there is no calculation data available for that vendor, the service should throw an error indicating that the calculation data was not found
      await expect(
        service.createSettlementService(
          {
            method: 'INTERNAL_QR_TRANSFER',
            amount: 100,
            user_id: 'vendor-user-1',
            company_id: 'company-1',
            config: { reference_id: 'UTR-3', debit_credit: 'PAID' },
          },
          constants.Role.ADMIN,
        ),
      ).rejects.toThrow('Calculation data not found');
    });

    it('should process internal transfer for admin and trigger bank/calculation updates', async () => {
      bankResponseDao.getBankResponseByUTR.mockResolvedValue({
        id: 'br-1',
        is_used: false,
        status: constants.Status.BOT,
      });
      dao.getSettlementByUTRDao.mockResolvedValue([]);
      vendorDao.getVendorsDao.mockResolvedValue([
        {
          user_id: 'vendor-user-1',
          payin_commission: 2,
          designation: constants.Role.VENDOR,
          config: {},
        },
      ]);
      calculationDao.getCalculationforCronDao.mockResolvedValue([
        { id: 'calc-1', user_id: 'vendor-user-1', config: {} },
      ]);
      bankResponseDao.updateBankResponseDao.mockResolvedValue({
        id: 'br-1',
        sno: 1,
        status: '/internalTransfer',
        bank_id: 'bank-1',
        amount: 100,
        utr: 'UTR-4',
        is_used: 'false',
        created_at: new Date(),
        updated_at: new Date(),
        created_by: 'user-1',
        updated_by: 'user-1',
        config: {},
      });
      calculationDao.updateCalculationBalanceDao.mockResolvedValue({ id: 'calc-1' });
      dao.createSettlementDao.mockResolvedValue({
        id: 'settle-3',
        sno: 3,
        amount: 100,
        status: constants.Status.SUCCESS,
        method: 'INTERNAL_QR_TRANSFER',
        user_id: 'vendor-user-1',
        company_id: 'company-1',
        config: { reference_id: 'UTR-4' },
      });

      const result = await service.createSettlementService(
        {
          method: 'INTERNAL_QR_TRANSFER',
          amount: 100,
          user_id: 'vendor-user-1',
          company_id: 'company-1',
          config: { reference_id: 'UTR-4', debit_credit: 'PAID' },
        },
        constants.Role.ADMIN,
      );

      // The service should successfully process the internal transfer settlement for an admin role when a valid UTR is provided, update the bank response and calculation data accordingly, and return the created settlement
      expect(bankResponseDao.updateBankResponseDao).toHaveBeenCalled();
      // The service should update the calculation balance for the vendor based on the internal transfer settlement creation
      expect(calculationDao.updateCalculationBalanceDao).toHaveBeenCalled();
      // The service should update the calculation config for the vendor based on the internal transfer settlement creation
      expect(calculationDao.updateCalculationConfigDao).toHaveBeenCalled();
      // The result should match the mocked DAO response for the created settlement
      expect(result).toHaveProperty('id', 'settle-3');
    });

    it('should rollback when beginTransaction fails in create flow', async () => {
      db.beginTransaction.mockRejectedValue(new Error('begin-fail'));

      // The service should attempt to begin a transaction when creating a settlement, and if beginning the transaction fails, it should rollback and throw the error
      await expect(
        service.createSettlementService(
          {
            method: 'BANK',
            amount: 100,
            user_id: 'user-1',
            company_id: 'company-1',
            config: {},
          },
          constants.Role.ADMIN,
        ),
      ).rejects.toThrow('begin-fail');

      // The service should attempt to rollback the transaction when beginning the transaction fails during settlement creation
      expect(db.rollback).toHaveBeenCalledWith(conn);
      // The service should log the error when beginning the transaction fails during settlement creation
      expect(conn.release).toHaveBeenCalled();
    });
  });

  describe('updateSettlementService', () => {
    it('should begin, commit and update settlement', async () => {
      const result = await service.updateSettlementService(
        { id: 'settle-1', company_id: 'company-1' },
        { updated_by: 'user-1', config: {} },
      );

      // The service should call the DAO to update the settlement, commit the transaction, and return the updated settlement
      expect(db.beginTransaction).toHaveBeenCalledWith(conn);
      // The service should check for locks before updating the settlement
      expect(locks.checkLockEdit).toHaveBeenCalled();
      // The service should call the DAO to get the existing settlement before updating
      expect(dao.getSettlementDao).toHaveBeenCalled();
      // The service should call the DAO to update the settlement with the provided data
      expect(dao.updateSettlementDao).toHaveBeenCalled();
      // The service should commit the transaction after successfully updating the settlement
      expect(db.commit).toHaveBeenCalledWith(conn);
      // The service should release the database connection after the operation is complete
      expect(conn.release).toHaveBeenCalled();
      // The result should match the mocked DAO response for the updated settlement
      expect(result).toHaveProperty('id', 'settle-1');
    });

    it('should rollback and throw on update error', async () => {
      locks.checkLockEdit.mockRejectedValue(new Error('fail'));

      // The service should rollback the transaction and re-throw the error when the lock check fails during settlement update
      await expect(
        service.updateSettlementService(
          { id: 'settle-1', company_id: 'company-1' },
          { updated_by: 'user-1', config: {} },
        ),
      ).rejects.toThrow('fail');

      // The service should rollback the transaction when an error occurs during settlement update
      expect(db.rollback).toHaveBeenCalledWith(conn);
      // The service should log the error when settlement update fails
      expect(loggerModule.logger.error).toHaveBeenCalled();
      // The service should release the database connection after the operation is complete, even when an error occurs
      expect(conn.release).toHaveBeenCalled();
    });

    it('should throw when settlement does not exist', async () => {
      dao.getSettlementDao.mockResolvedValue([]);

      // When updating a settlement, if the settlement with the provided ID and company ID does not exist, the service should throw an error indicating that the settlement was not found
      await expect(
        service.updateSettlementService(
          { id: 'settle-404', company_id: 'company-1' },
          { updated_by: 'user-1', config: {} },
        ),
      ).rejects.toThrow('Settlement not found');

      // The service should rollback the transaction when the settlement does not exist
      expect(db.rollback).toHaveBeenCalledWith(conn);
    });

    it('should throw when same UTR is provided for non-internal method', async () => {
      dao.getSettlementDao.mockResolvedValue([
        {
          id: 'settle-1',
          user_id: 'user-1',
          company_id: 'company-1',
          status: constants.Status.INITIATED,
          method: 'BANK',
          config: { reference_id: 'UTR-SAME' },
          role: constants.Role.MERCHANT,
        },
      ]);

      // When updating a settlement, if the provided UTR in the config is the same as the existing UTR for a non-internal transfer method, the service should throw an error indicating that the UTR already exists
      await expect(
        service.updateSettlementService(
          { id: 'settle-1', company_id: 'company-1' },
          { updated_by: 'user-1', config: { reference_id: 'UTR-SAME' } },
        ),
      ).rejects.toThrow('UTR already exists');

      // The service should rollback the transaction when the same UTR is provided for a non-internal transfer method during settlement update
      expect(db.rollback).toHaveBeenCalledWith(conn);
    });

    it('should throw when trying to reverse an already reversed settlement', async () => {
      dao.getSettlementDao.mockResolvedValue([
        {
          id: 'settle-1',
          user_id: 'user-1',
          company_id: 'company-1',
          status: constants.Status.REVERSED,
          method: 'BANK',
          config: { reference_id: 'UTR-1' },
          role: constants.Role.MERCHANT,
        },
      ]);
      calculationDao.getCalculationforCronDao.mockResolvedValue([]);

      // When updating a settlement, if the current status of the settlement is already reversed and the update is attempting to set it to reversed again, the service should throw an error indicating that the settlement is already reversed
      await expect(
        service.updateSettlementService(
          { id: 'settle-1', company_id: 'company-1' },
          { updated_by: 'user-1', status: constants.Status.INITIATED, config: {} },
        ),
      ).rejects.toThrow('Settlement is already reversed');

      // The service should rollback the transaction when trying to reverse an already reversed settlement during settlement update
      expect(db.rollback).toHaveBeenCalledWith(conn);
    });

    it('should throw when status is updated to the same value', async () => {
      dao.getSettlementDao.mockResolvedValue([
        {
          id: 'settle-1',
          user_id: 'user-1',
          company_id: 'company-1',
          status: constants.Status.SUCCESS,
          method: 'BANK',
          config: {},
          role: constants.Role.MERCHANT,
        },
      ]);

      // When updating a settlement, if the provided status is the same as the existing status of the settlement, the service should throw an error indicating that the payout status cannot be updated to the same value
      await expect(
        service.updateSettlementService(
          { id: 'settle-1', company_id: 'company-1' },
          { updated_by: 'user-1', status: constants.Status.SUCCESS, config: {} },
        ),
      ).rejects.toThrow('Payout status cannot be updated to the same value');
    });

    it('should throw when transitioning from rejected to success', async () => {
      dao.getSettlementDao.mockResolvedValue([
        {
          id: 'settle-1',
          user_id: 'user-1',
          company_id: 'company-1',
          status: constants.Status.REJECTED,
          method: 'BANK',
          config: {},
          role: constants.Role.MERCHANT,
        },
      ]);

      // When updating a settlement, if the current status of the settlement is rejected and the update is attempting to set it to success, the service should throw an error indicating that the payout status cannot be changed from rejected to approved
      await expect(
        service.updateSettlementService(
          { id: 'settle-1', company_id: 'company-1' },
          { updated_by: 'user-1', status: constants.Status.SUCCESS, config: {} },
        ),
      ).rejects.toThrow('Cannot change payout status from rejected to approved');
    });

    it('should update internal transfer UTR and mark settlement success', async () => {
      dao.getSettlementDao.mockResolvedValue([
        {
          id: 'settle-10',
          user_id: 'user-10',
          company_id: 'company-1',
          status: constants.Status.INITIATED,
          method: 'INTERNAL_QR_TRANSFER',
          config: { reference_id: '' },
          role: constants.Role.VENDOR,
        },
      ]);
      bankResponseDao.getBankResponseByUTR.mockResolvedValue({
        id: 'br-10',
        is_used: false,
        status: constants.Status.BOT,
      });
      bankResponseDao.updateBankResponseDao.mockResolvedValue({
        id: 'br-10',
        sno: 10,
        status: '/internalTransfer',
        bank_id: 'bank-10',
        amount: 100,
        utr: 'UTR-10',
        is_used: 'false',
        created_at: new Date(),
        updated_at: new Date(),
        created_by: 'user-1',
        updated_by: 'user-1',
        config: {},
      });
      calculationDao.getCalculationforCronDao.mockResolvedValue([]);
      merchantDao.getMerchantsDao.mockResolvedValue([]);
      dao.updateSettlementDao.mockResolvedValue({ id: 'settle-10', status: constants.Status.SUCCESS, config: {} });

      const result = await service.updateSettlementService(
        { id: 'settle-10', company_id: 'company-1' },
        { updated_by: 'user-1', amount: 100, config: { reference_id: 'UTR-10' } },
      );

      // The service should successfully update the internal transfer settlement with the new UTR, mark the settlement as success, and update the bank response accordingly
      expect(bankResponseDao.updateBankResponseDao).toHaveBeenCalled();
      // The service should update the settlement status to success when a valid UTR is provided for an internal transfer settlement
      expect(dao.updateSettlementDao).toHaveBeenCalled();
      // The result should match the mocked DAO response for the updated settlement
      expect(result).toHaveProperty('status', constants.Status.SUCCESS);
    });

    it('should set rejected status and clear reference id when rejected_reason is provided', async () => {
      dao.getSettlementDao.mockResolvedValue([
        {
          id: 'settle-11',
          user_id: 'user-11',
          company_id: 'company-1',
          status: constants.Status.INITIATED,
          method: 'BANK',
          config: { reference_id: 'OLD-UTR' },
          role: constants.Role.MERCHANT,
        },
      ]);
      calculationDao.getCalculationforCronDao.mockResolvedValue([]);

      await service.updateSettlementService(
        { id: 'settle-11', company_id: 'company-1' },
        {
          updated_by: 'user-1',
          config: { rejected_reason: 'manual rejection', reference_id: 'NEW-UTR' },
        },
      );

      const updateArgs = dao.updateSettlementDao.mock.calls[0][1];
      // The service should set the settlement status to rejected and clear the reference ID when a rejected reason is provided in the config during settlement update
      expect(updateArgs.status).toBe(constants.Status.REJECTED);
      // The service should clear the reference ID when a settlement is rejected during settlement update
      expect(updateArgs.config.reference_id).toBe('');
    });

    it('should update calculation config for CASH SENT on success', async () => {
      dao.getSettlementDao.mockResolvedValue([
        {
          id: 'settle-cash',
          user_id: 'user-cash',
          company_id: 'company-1',
          status: constants.Status.INITIATED,
          method: 'CASH',
          config: { reference_id: 'OLD-CASH' },
          role: constants.Role.MERCHANT,
        },
      ]);
      calculationDao.getCalculationforCronDao.mockResolvedValue([
        {
          id: 'calc-cash',
          user_id: 'user-cash',
          config: { total_cashSentSettlement_amount: 10 },
        },
      ]);
      merchantDao.getMerchantsDao.mockResolvedValue([{}]);
      dao.updateSettlementDao.mockResolvedValue({ id: 'settle-cash', status: constants.Status.SUCCESS, config: {} });

      await service.updateSettlementService(
        { id: 'settle-cash', company_id: 'company-1' },
        {
          updated_by: 'user-1',
          amount: 5,
          method: 'CASH',
          config: { reference_id: 'NEW-CASH', debit_credit: 'SENT' },
        },
      );

      // The service should update the calculation config for cash sent settlements when a settlement is marked as success with the cash method, and update the total cash sent settlement amount accordingly
      expect(calculationDao.updateCalculationConfigDao).toHaveBeenCalledWith(
        { id: 'calc-cash' },
        { config: { total_cashSentSettlement_amount: 15 } },
        conn,
      );
    });

    it('should update calculation config for BANK RECEIVED on success', async () => {
      dao.getSettlementDao.mockResolvedValue([
        {
          id: 'settle-bank',
          user_id: 'user-bank',
          company_id: 'company-1',
          status: constants.Status.INITIATED,
          method: 'BANK',
          config: { reference_id: 'OLD-BANK' },
          role: constants.Role.MERCHANT,
        },
      ]);
      calculationDao.getCalculationforCronDao.mockResolvedValue([
        {
          id: 'calc-bank',
          user_id: 'user-bank',
          config: { total_bankReceivedSettlement_amount: 0 },
        },
      ]);
      merchantDao.getMerchantsDao.mockResolvedValue([{}]);
      dao.updateSettlementDao.mockResolvedValue({ id: 'settle-bank', status: constants.Status.SUCCESS, config: {} });

      await service.updateSettlementService(
        { id: 'settle-bank', company_id: 'company-1' },
        {
          updated_by: 'user-1',
          amount: 8,
          method: 'BANK',
          config: { reference_id: 'NEW-BANK', debit_credit: 'RECEIVED' },
        },
      );

      // The service should update the calculation config for bank received settlements when a settlement is marked as success with the bank method, and update the total bank received settlement amount accordingly
      expect(calculationDao.updateCalculationConfigDao).toHaveBeenCalledWith(
        { id: 'calc-bank' },
        { config: { total_bankReceivedSettlement_amount: 8 } },
        conn,
      );
    });

    it('should update calculation config for CRYPTO SENT on reversal', async () => {
      dao.getSettlementDao.mockResolvedValue([
        {
          id: 'settle-crypto',
          user_id: 'user-crypto',
          company_id: 'company-1',
          status: constants.Status.SUCCESS,
          method: 'CRYPTO',
          config: { reference_id: 'UTR-CRYPTO' },
          role: constants.Role.MERCHANT,
        },
      ]);
      calculationDao.getCalculationforCronDao.mockResolvedValue([
        {
          id: 'calc-crypto',
          user_id: 'user-crypto',
          config: { total_cryptoSentSettlement_amount: 20 },
        },
      ]);
      merchantDao.getMerchantsDao.mockResolvedValue([{}]);
      dao.updateSettlementDao.mockResolvedValue({ id: 'settle-crypto', status: constants.Status.REVERSED, config: {} });

      await service.updateSettlementService(
        { id: 'settle-crypto', company_id: 'company-1' },
        {
          updated_by: 'user-1',
          status: constants.Status.INITIATED,
          amount: 7,
          method: 'CRYPTO',
          config: { debit_credit: 'SENT' },
        },
      );

      // The service should update the calculation config for crypto sent settlements when a settlement is reversed with the crypto method, and update the total crypto sent settlement amount accordingly
      expect(calculationDao.updateCalculationConfigDao).toHaveBeenCalledWith(
        { id: 'calc-crypto' },
        { config: { total_cryptoSentSettlement_amount: 13 } },
        conn,
      );
    });

    it('should update calculation config for AED RECEIVED on reversal', async () => {
      dao.getSettlementDao.mockResolvedValue([
        {
          id: 'settle-aed',
          user_id: 'user-aed',
          company_id: 'company-1',
          status: constants.Status.SUCCESS,
          method: 'AED',
          config: { reference_id: 'UTR-AED' },
          role: constants.Role.MERCHANT,
        },
      ]);
      calculationDao.getCalculationforCronDao.mockResolvedValue([
        {
          id: 'calc-aed',
          user_id: 'user-aed',
          config: { total_aedReceivedSettlement_amount: 12 },
        },
      ]);
      merchantDao.getMerchantsDao.mockResolvedValue([{}]);
      dao.updateSettlementDao.mockResolvedValue({ id: 'settle-aed', status: constants.Status.REVERSED, config: {} });

      await service.updateSettlementService(
        { id: 'settle-aed', company_id: 'company-1' },
        {
          updated_by: 'user-1',
          status: constants.Status.INITIATED,
          amount: 4,
          method: 'AED',
          config: { debit_credit: 'RECEIVED' },
        },
      );

      // The service should update the calculation config for AED received settlements when a settlement is reversed with the AED method, and update the total AED received settlement amount accordingly
      expect(calculationDao.updateCalculationConfigDao).toHaveBeenCalledWith(
        { id: 'calc-aed' },
        { config: { total_aedReceivedSettlement_amount: 8 } },
        conn,
      );
    });
  });

  describe('deleteSettlementService', () => {
    it('should begin, commit and soft delete settlement', async () => {
      dao.deleteSettlementDao.mockResolvedValue({ id: 'settle-1' });

      const result = await service.deleteSettlementService({
        id: 'settle-1',
        company_id: 'company-1',
        user_id: 'user-1',
      });

      // The service should call the DAO to soft delete the settlement, commit the transaction, and return the deleted settlement ID
      expect(db.beginTransaction).toHaveBeenCalledWith(conn);
      // The service should call the DAO to soft delete the settlement with the provided ID and company ID, and set is_obsolete to true
      expect(dao.deleteSettlementDao).toHaveBeenCalledWith(
        { id: 'settle-1', company_id: 'company-1' },
        { is_obsolete: true, updated_by: 'user-1' },
        conn,
      );
      // The service should commit the transaction after successfully soft deleting the settlement
      expect(db.commit).toHaveBeenCalledWith(conn);
      // The service should release the database connection after the operation is complete
      expect(conn.release).toHaveBeenCalled();
      // The result should match the mocked DAO response for the deleted settlement ID
      expect(result).toEqual({ id: 'settle-1' });
    });

    it('should rollback and throw on delete error', async () => {
      dao.deleteSettlementDao.mockRejectedValue(new Error('fail'));

      // The service should rollback the transaction and re-throw the error when the DAO call to delete the settlement fails
      await expect(
        service.deleteSettlementService({
          id: 'settle-1',
          company_id: 'company-1',
          user_id: 'user-1',
        }),
      ).rejects.toThrow('fail');

      // The service should rollback the transaction and re-throw the error when the DAO call to delete the settlement fails
      expect(db.rollback).toHaveBeenCalledWith(conn);
      // The service should log the error when settlement deletion fails
      expect(loggerModule.logger.error).toHaveBeenCalled();
      // The service should release the database connection after the operation is complete, even when an error occurs
      expect(conn.release).toHaveBeenCalled();
    });

    it('should rollback when beginTransaction fails in delete flow', async () => {
      db.beginTransaction.mockRejectedValue(new Error('begin-fail'));

      // The service should attempt to begin a transaction when deleting a settlement, and if beginning the transaction fails, it should rollback and throw the error
      await expect(
        service.deleteSettlementService({
          id: 'settle-1',
          company_id: 'company-1',
          user_id: 'user-1',
        }),
      ).rejects.toThrow('begin-fail');

      // The service should attempt to rollback the transaction when beginning the transaction fails during settlement deletion
      expect(db.rollback).toHaveBeenCalledWith(conn);
      // The service should log the error when beginning the transaction fails during settlement deletion
      expect(conn.release).toHaveBeenCalled();
    });
  });
});
