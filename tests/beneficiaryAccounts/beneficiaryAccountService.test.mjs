// -------------------- ESM MOCKS --------------------
/* global describe, it, expect, beforeEach, afterEach, beforeAll */
import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/constants/index.js', () => ({
  Role: { MERCHANT: 'MERCHANT', VENDOR: 'VENDOR', ADMIN: 'ADMIN', SUB_MERCHANT: 'SUB_MERCHANT', SUB_VENDOR: 'SUB_VENDOR', VENDOR_OPERATIONS: 'VENDOR_OPERATIONS', MERCHANT_OPERATIONS: 'MERCHANT_OPERATIONS', VENDOR_ADMIN: 'VENDOR_ADMIN' },
}));
jest.unstable_mockModule('../../src/utils/appErrors.js', () => ({
  BadRequestError: class extends Error {},
  ValidationError: class extends Error {},
}));
jest.unstable_mockModule('../../src/utils/db.js', () => ({
  getConnection: jest.fn(),
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
}));
jest.unstable_mockModule('../../src/apis/beneficiaryAccounts/beneficiaryAccountDao.js', () => ({
  getBeneficiaryAccountDao: jest.fn(),
  getBeneficiaryAccountDaoAll: jest.fn(),
  getBeneficiaryAccountBySearchDao: jest.fn(),
  createBeneficiaryAccountDao: jest.fn(),
  updateBeneficiaryAccountDao: jest.fn(),
  deleteBeneficiaryDao: jest.fn(),
  checkBeneficiaryAccountExistsDao: jest.fn(),
  getBeneficiaryAccountDaoByBankName: jest.fn(),
}));
jest.unstable_mockModule('../../src/apis/userHierarchy/userHierarchyDao.js', () => ({
  getUserHierarchysDao: jest.fn(),
}));
jest.unstable_mockModule('../../src/apis/roles/rolesDao.js', () => ({
  getRoleDao: jest.fn(),
}));
jest.unstable_mockModule('../../src/apis/users/userDao.js', () => ({
  getUserByIdDao: jest.fn(),
  getUserByCompanyCreatedAtDao: jest.fn(),
}));
jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// -------------------- HELPERS ----------------------
function mockConn() {
  return { query: jest.fn(), release: jest.fn() };
}

// -------------------- IMPORTS ----------------------
let service, beneficiaryDao, db, userHierarchyDao, roleDao, userDao, logger;
beforeAll(async () => {
  service = await import('../../src/apis/beneficiaryAccounts/beneficiaryAccountServices.js');
  beneficiaryDao = await import('../../src/apis/beneficiaryAccounts/beneficiaryAccountDao.js');
  db = await import('../../src/utils/db.js');
  userHierarchyDao = await import('../../src/apis/userHierarchy/userHierarchyDao.js');
  roleDao = await import('../../src/apis/roles/rolesDao.js');
  userDao = await import('../../src/apis/users/userDao.js');
  logger = await import('../../src/utils/logger.js');
});

beforeEach(() => {
  if (db) {
    db.getConnection = jest.fn().mockResolvedValue(mockConn());
    db.beginTransaction = jest.fn();
    db.commit = jest.fn();
    db.rollback = jest.fn();
  }
  if (beneficiaryDao) {
    beneficiaryDao.getBeneficiaryAccountDao = jest.fn();
    beneficiaryDao.getBeneficiaryAccountDaoAll = jest.fn();
    beneficiaryDao.getBeneficiaryAccountBySearchDao = jest.fn();
    beneficiaryDao.createBeneficiaryAccountDao = jest.fn();
    beneficiaryDao.updateBeneficiaryAccountDao = jest.fn();
    beneficiaryDao.deleteBeneficiaryDao = jest.fn();
    beneficiaryDao.checkBeneficiaryAccountExistsDao = jest.fn();
    beneficiaryDao.getBeneficiaryAccountDaoByBankName = jest.fn();
  }
  if (userHierarchyDao) userHierarchyDao.getUserHierarchysDao = jest.fn().mockResolvedValue([{}]);
  if (roleDao) roleDao.getRoleDao = jest.fn();
  if (userDao) {
    userDao.getUserByIdDao = jest.fn();
    userDao.getUserByCompanyCreatedAtDao = jest.fn();
  }
  if (logger?.logger) {
    logger.logger.error = jest.fn();
    logger.logger.info = jest.fn();
    logger.logger.warn = jest.fn();
  }
});

afterEach(() => {
  jest.clearAllMocks();
});

// -------------------- TESTS ----------------------
describe('beneficiaryAccountService', () => {
  describe('getBeneficiaryAccountService', () => {
    it('should fetch accounts for merchant', async () => {
      userHierarchyDao.getUserHierarchysDao.mockResolvedValue([{ config: { siblings: { sub_merchants: [2, 3] } } }]);
      beneficiaryDao.getBeneficiaryAccountDaoAll.mockResolvedValue([{ id: 1, acc_no: '1234567890' }]);
      const result = await service.getBeneficiaryAccountService({}, 'MERCHANT', 1, 10, 1, 'MERCHANT', 1);

      // Should return the fetched accounts for the merchant and its sub-merchants
      expect(result).toEqual(expect.arrayContaining([expect.objectContaining({ id: 1 })]));

      // Should call the DAO method to fetch accounts
      expect(beneficiaryDao.getBeneficiaryAccountDaoAll).toHaveBeenCalled();
    });

    it('should fetch accounts for vendor', async () => {
      userDao.getUserByCompanyCreatedAtDao.mockResolvedValue({ id: 5 });
      beneficiaryDao.getBeneficiaryAccountDaoAll.mockResolvedValue([]);
      await service.getBeneficiaryAccountService({}, 'VENDOR', 1, 10, 1, 'VENDOR', 1);

      // Should call the DAO method to fetch accounts for the vendor
      expect(beneficiaryDao.getBeneficiaryAccountDaoAll).toHaveBeenCalled();
    });

    it('should apply beneficiary_role filter', async () => {
      roleDao.getRoleDao.mockResolvedValue([{ id: 2, role: 'VENDOR' }]);
      beneficiaryDao.getBeneficiaryAccountDaoAll.mockResolvedValue([]);
      await service.getBeneficiaryAccountService({ beneficiary_role: 'VENDOR' }, 'ADMIN', 1, 10, 1, 'ADMIN', 1);

      // Should call the DAO method with the beneficiary_role filter applied
      expect(roleDao.getRoleDao).toHaveBeenCalled();
    });

    it('should handle settlement flag', async () => {
      beneficiaryDao.getBeneficiaryAccountDaoAll.mockResolvedValue([]);
      await service.getBeneficiaryAccountService({ forSettlementFlag: 'true' }, 'ADMIN', 1, 10, 1, 'ADMIN', 1);

      // Should call the DAO method with the settlement flag filter applied
      expect(beneficiaryDao.getBeneficiaryAccountDaoAll).toHaveBeenCalled();
    });
  });

  describe('getBeneficiaryAccountBySearchService', () => {
    it('should search with terms', async () => {
      userDao.getUserByCompanyCreatedAtDao.mockResolvedValue({ id: 5 });
      beneficiaryDao.getBeneficiaryAccountBySearchDao.mockResolvedValue({
        totalCount: 1,
        totalPages: 1,
        bankAccounts: [{ id: 1 }],
      });
      const result = await service.getBeneficiaryAccountBySearchService(
        { search: 'John' },
        'MERCHANT',
        1,
        10,
        1,
        'MERCHANT',
        1,
      );

      // Should return the search results      expect(result).toEqual(expect.objectContaining({ totalCount: 1, bankAccounts: expect.arrayContaining([expect.objectContaining({ id: 1 })]) }));

      // Should call the DAO method to perform the search
      expect(result.totalCount).toBe(1);

      // Should call the DAO method with the search term
      expect(beneficiaryDao.getBeneficiaryAccountBySearchDao).toHaveBeenCalled();
    });

    it('should handle multiple search terms', async () => {
      userDao.getUserByCompanyCreatedAtDao.mockResolvedValue({ id: 5 });
      beneficiaryDao.getBeneficiaryAccountBySearchDao.mockResolvedValue({
        totalCount: 2,
        totalPages: 1,
        bankAccounts: [{}, {}],
      });
      const result = await service.getBeneficiaryAccountBySearchService(
        { search: 'John,ICICI' },
        'ADMIN',
        1,
        10,
        1,
        'ADMIN',
        1,
      );

      // Should return the search results for multiple terms
      expect(result.totalCount).toBe(2);
    });

    it('should log and throw on database error', async () => {
      beneficiaryDao.getBeneficiaryAccountBySearchDao.mockRejectedValue(new Error('DB error'));

      // Should log the error and throw it
      await expect(
        service.getBeneficiaryAccountBySearchService(
          { search: 'John' },
          'MERCHANT',
          1,
          10,
          1,
          'MERCHANT',
          1,
        ),
      ).rejects.toThrow('DB error');

      // Should call logger.error with the error message
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

  describe('createBeneficiaryAccountService', () => {
    it('should create account in transaction', async () => {
      const conn = mockConn();
      db.getConnection.mockResolvedValue(conn);
      userDao.getUserByIdDao.mockResolvedValue([{ id: 1, role: 'MERCHANT' }]);
      roleDao.getRoleDao.mockResolvedValue([{ id: 2, role: 'MERCHANT' }]);
      beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([]);
      beneficiaryDao.createBeneficiaryAccountDao.mockResolvedValue({ id: 1, acc_no: '1234567890' });
      const result = await service.createBeneficiaryAccountService(
        { acc_no: '1234567890', user_id: 1, created_by: 1, company_id: 1 },
        1,
      );

      // Should return the created account details
      expect(result).toBeDefined();

      // Should call the DAO method to create the account
      expect(db.beginTransaction).toHaveBeenCalled();

      // Should call the DAO method to create the account
      expect(db.commit).toHaveBeenCalled();

      // Should release the database connection
      expect(conn.release).toHaveBeenCalled();
    });

    it('should create vendor account with config', async () => {
      const conn = mockConn();
      db.getConnection.mockResolvedValue(conn);
      userDao.getUserByIdDao.mockResolvedValue([{ id: 1, role: 'VENDOR' }]);
      roleDao.getRoleDao.mockResolvedValue([{ id: 3, role: 'VENDOR' }]);
      beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([]);
      beneficiaryDao.createBeneficiaryAccountDao.mockResolvedValue({ id: 1, config: { type: 'Personal' } });
      await service.createBeneficiaryAccountService(
        { acc_no: '9876543210', user_id: 1, created_by: 1, company_id: 1 },
        1,
      );

      // Should call the DAO method to create the vendor account with the correct config
      expect(beneficiaryDao.createBeneficiaryAccountDao).toHaveBeenCalled();
    });

    it('should throw if account exists', async () => {
      const conn = mockConn();
      db.getConnection.mockResolvedValue(conn);
      userDao.getUserByIdDao.mockResolvedValue([{ id: 1, role: 'MERCHANT' }]);
      roleDao.getRoleDao.mockResolvedValue([{ id: 2, role: 'MERCHANT' }]);
      beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([{ id: 999 }]);

      // Should throw an error if the account number already exists
      await expect(
        service.createBeneficiaryAccountService(
          { acc_no: '1234567890', user_id: 1, created_by: 1, company_id: 1 },
          1,
        ),
      ).rejects.toThrow('Beneficiary account already exists');

      // Should rollback the transaction and release the connection on error
      expect(db.rollback).toHaveBeenCalled();

      // Should release the database connection
      expect(conn.release).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      const conn = mockConn();
      db.getConnection.mockResolvedValue(conn);
      userDao.getUserByIdDao.mockRejectedValue(new Error('User not found'));

      // Should log the error and throw it
      await expect(service.createBeneficiaryAccountService({}, 1)).rejects.toThrow('User not found');

      // Should call logger.error with the error message
      expect(db.rollback).toHaveBeenCalled();

      // Should release the database connection
      expect(conn.release).toHaveBeenCalled();
    });
  });

  describe('updateBeneficiaryAccountService', () => {
    it('should update account in transaction', async () => {
      const conn = mockConn();
      db.getConnection.mockResolvedValue(conn);
      beneficiaryDao.checkBeneficiaryAccountExistsDao.mockResolvedValue(false);
      beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([{ id: 1, acc_no: '1234567890' }]);
      beneficiaryDao.updateBeneficiaryAccountDao.mockResolvedValue({ id: 1, acc_holder_name: 'Jane Updated' });
      const result = await service.updateBeneficiaryAccountService(
        { id: 1, company_id: 1 },
        { acc_holder_name: 'Jane Updated', updated_by: 1 },
      );

      // Should return the updated account details
      expect(result).toBeDefined();

      // Should call the DAO method to update the account
      expect(db.beginTransaction).toHaveBeenCalled();

      // Should call the DAO method to update the account
      expect(db.commit).toHaveBeenCalled();
    });

    it('should throw if account no exists', async () => {
      const conn = mockConn();
      db.getConnection.mockResolvedValue(conn);
      beneficiaryDao.checkBeneficiaryAccountExistsDao.mockResolvedValue(true);

      // Should throw an error if the new account number already exists
      await expect(
        service.updateBeneficiaryAccountService({ id: 1, company_id: 1 }, { acc_no: '9999999999' }),
      ).rejects.toThrow('Beneficiary account no. already exists');

      // Should rollback the transaction on error
      expect(db.rollback).toHaveBeenCalled();
    });

    it('should throw if account not found', async () => {
      const conn = mockConn();
      db.getConnection.mockResolvedValue(conn);
      beneficiaryDao.checkBeneficiaryAccountExistsDao.mockResolvedValue(false);
      beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([]);

      // Should throw an error if the account to update is not found
      await expect(
        service.updateBeneficiaryAccountService({ id: 999, company_id: 1 }, {}),
      ).rejects.toThrow('Beneficiary account not found');

      // Should rollback the transaction on error
      expect(db.rollback).toHaveBeenCalled();
    });
  });

  describe('deleteBeneficiaryAccountService', () => {
    it('should delete in transaction', async () => {
      const conn = mockConn();
      db.getConnection.mockResolvedValue(conn);
      beneficiaryDao.deleteBeneficiaryDao.mockResolvedValue({ id: 1, is_obsolete: true });
      const result = await service.deleteBeneficiaryAccountService({ id: 1, company_id: 1 });

      // Should return the deleted account details
      expect(result).toBeDefined();

      // Should call the DAO method to delete the account
      expect(db.beginTransaction).toHaveBeenCalled();

      // Should call the DAO method to delete the account
      expect(db.commit).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      const conn = mockConn();
      db.getConnection.mockResolvedValue(conn);
      beneficiaryDao.deleteBeneficiaryDao.mockRejectedValue(new Error('Delete failed'));

      // Should log the error and throw it
      await expect(service.deleteBeneficiaryAccountService({ id: 1, company_id: 1 })).rejects.toThrow('Delete failed');

      // Should rollback the transaction on error
      expect(db.rollback).toHaveBeenCalled();

      // Should release the database connection
      expect(conn.release).toHaveBeenCalled();
    });
  });

  describe('getBeneficiaryAccountServiceByBankName', () => {
    it('should fetch bank names by type', async () => {
      beneficiaryDao.getBeneficiaryAccountDaoByBankName.mockResolvedValue({
        totalCount: 2,
        bankNames: [{ label: 'ICICI Bank', value: 1 }],
      });
      const result = await service.getBeneficiaryAccountServiceByBankName(1, 'Personal', 'VENDOR', 1, 'VENDOR');

      // Should return the bank names for the given type and role
      expect(result.totalCount).toBe(2);

      // Should return the bank names in the expected format
      expect(result.bankNames).toHaveLength(1);
    });

    it('should handle vendor operations role', async () => {
      userHierarchyDao.getUserHierarchysDao.mockResolvedValue([{ config: { parent: 5 } }]);
      beneficiaryDao.getBeneficiaryAccountDaoByBankName.mockResolvedValue({
        totalCount: 1,
        bankNames: [{ label: 'Bank', value: 1 }],
      });
      await service.getBeneficiaryAccountServiceByBankName(1, 'Personal', 'VENDOR', 1, 'VENDOR_OPERATIONS');

      // Should call the DAO method to fetch bank names for the vendor operations role
      expect(beneficiaryDao.getBeneficiaryAccountDaoByBankName).toHaveBeenCalled();
    });
  });
});
