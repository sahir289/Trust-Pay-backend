import {
    getBeneficiaryAccountService,
    getBeneficiaryAccountBySearchService,
    createBeneficiaryAccountService,
    updateBeneficiaryAccountService,
    deleteBeneficiaryAccountService,
    getBeneficiaryAccountServiceByBankName,
  } from './beneficiaryAccountServices.js';
  import { Role } from '../../constants/index.js';
  import { BadRequestError } from '../../utils/appErrors.js';
  import {
    beginTransaction,
    commit,
    getConnection,
    rollback,
  } from '../../utils/db.js';
  import { logger } from '../../utils/logger.js';
  import {
    getRoleDao,
  } from '../roles/rolesDao.js';
  import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
  import {
    getUserByCompanyCreatedAtDao,
    getUserByIdDao,
  } from '../users/userDao.js';
  import {
    getBeneficiaryAccountDao,
    createBeneficiaryAccountDao,
    updateBeneficiaryAccountDao,
    getBeneficiaryAccountDaoByBankName,
    getBeneficiaryAccountBySearchDao,
    getBeneficiaryAccountDaoAll,
    deleteBeneficiaryDao,
    checkBeneficiaryAccountExistsDao,
  } from './beneficiaryAccountDao.js';
  
  jest.mock('../../utils/appErrors.js', () => ({
    BadRequestError: jest.fn((message) => ({ message })),
  }));
  
  jest.mock('../../utils/db.js');
  
  jest.mock('../../utils/logger.js', () => ({
    logger: {
      error: jest.fn(),
    },
  }));
  
  jest.mock('../roles/rolesDao.js', () => ({
    getRoleDao: jest.fn(),
  }));
  
  jest.mock('../userHierarchy/userHierarchyDao.js', () => ({
    getUserHierarchysDao: jest.fn(),
  }));
  
  jest.mock('../users/userDao.js', () => ({
    getUserByCompanyCreatedAtDao: jest.fn(),
    getUserByIdDao: jest.fn(),
  }));
  
  jest.mock('./beneficiaryAccountDao.js', () => ({
    getBeneficiaryAccountDao: jest.fn(),
    createBeneficiaryAccountDao: jest.fn(),
    updateBeneficiaryAccountDao: jest.fn(),
    getBeneficiaryAccountDaoByBankName: jest.fn(),
    getBeneficiaryAccountBySearchDao: jest.fn(),
    getBeneficiaryAccountDaoAll: jest.fn(),
    deleteBeneficiaryDao: jest.fn(),
    checkBeneficiaryAccountExistsDao: jest.fn(),
  }));
  
  describe('Beneficiary Account Services', () => {
    let conn;
  
    beforeEach(() => {
      conn = { release: jest.fn() };
      getConnection.mockResolvedValue(conn);
      jest.clearAllMocks();
    });
  
    describe('getBeneficiaryAccountService', () => {
      test('should fetch beneficiary accounts for ADMIN role with filters', async () => {
        const filters = { beneficiary_role: Role.VENDOR, user_id: 2 };
        const role = Role.ADMIN;
        const user_id = 1;
        const designation = Role.ADMIN;
        const company_id = 'company_id_345678';
        const page = '1';
        const limit = '10';
        const mockResult = [{ id: 1, bankAccountsname: 'test_account' }];
        getRoleDao.mockResolvedValue([{ id: 'role_id_4356789' }]);
        getUserByCompanyCreatedAtDao.mockResolvedValue({ id: 'company_id_345678' });
        getBeneficiaryAccountDaoAll.mockResolvedValue(mockResult);
  
        const result = await getBeneficiaryAccountService(filters, role, page, limit, user_id, designation, company_id);
  
        expect(getRoleDao).toHaveBeenCalledWith({ role: Role.VENDOR });
        expect(getUserByCompanyCreatedAtDao).toHaveBeenCalledWith(company_id, Role.ADMIN);
        expect(getBeneficiaryAccountDaoAll).toHaveBeenCalledWith(
          { role_id: ['role_id_4356789', 'role_id_4356789'], user_id: [2, 'company_id_345678'], company_id: 'company_id_345678' },
          1,
          10,
          role
        );
        expect(result).toEqual(mockResult);
      });
  
      test('should apply MERCHANT role filters with sub-merchants', async () => {
        const filters = { beneficiary_role: Role.VENDOR };
        const role = Role.MERCHANT;
        const user_id = 1;
        const designation = Role.MERCHANT;
        const company_id = 1;
        const page = '1';
        const limit = '10';
        const mockResult = [{ id: 1, bankAccountsname: 'test_account' }];
        getUserHierarchysDao.mockResolvedValue([{ config: { siblings: { sub_merchants: [2, 3] } } }]);
        getRoleDao
          .mockResolvedValueOnce([{ id: 3 }]) // VENDOR role
          .mockResolvedValueOnce([{ id: 4 }]); // ADMIN role
        getBeneficiaryAccountDaoAll.mockResolvedValue(mockResult);
      
        const result = await getBeneficiaryAccountService(filters, role, page, limit, user_id, designation, company_id);
      
        expect(getUserHierarchysDao).toHaveBeenCalledWith({ user_id: 1 });
        expect(getBeneficiaryAccountDaoAll).toHaveBeenCalledWith(
          { role_id: [3, 4], user_id: [[1, 2, 3]], company_id: 1 },
          1,
          10,
          role
        );
        expect(result).toEqual(mockResult);
      });
  
      test('should throw error on failure', async () => {
        const filters = { beneficiary_role: Role.VENDOR };
        const role = Role.ADMIN;
        const error = new Error('DB error');
        getRoleDao.mockRejectedValue(error);
  
        await expect(getBeneficiaryAccountService(filters, role, '1', '10', 1, Role.ADMIN, 1))
          .rejects.toEqual(error);
        expect(logger.error).toHaveBeenCalledWith('error getting while getting beneficiary banks', error);
      });
    });
  
    describe('getBeneficiaryAccountBySearchService', () => {
      test('should fetch beneficiary accounts by search for VENDOR role', async () => {
        const filters = { beneficiary_role: Role.VENDOR, search: 'test, account' };
        const role = Role.VENDOR;
        const user_id = 1;
        const designation = Role.VENDOR;
        const company_id = 1;
        const page = '1';
        const limit = '10';
        const mockResult = [{ id: 1, bankAccountsname: 'test_account' }];
        getUserByCompanyCreatedAtDao.mockResolvedValue({ id: 3 });
        getRoleDao.mockResolvedValue([{ id: 3 }]);
        getBeneficiaryAccountBySearchDao.mockResolvedValue(mockResult);
  
        const result = await getBeneficiaryAccountBySearchService(filters, role, page, limit, user_id, designation, company_id);
  
        expect(getUserByCompanyCreatedAtDao).toHaveBeenCalledWith(company_id, Role.ADMIN);
        expect(getBeneficiaryAccountBySearchDao).toHaveBeenCalledWith(
          { role_id: [3, 3], user_id: [1, 3], company_id: 1 },
          1,
          10,
          role,
          ['test', 'account']
        );
        expect(result).toEqual(mockResult);
      });
  
      test('should throw BadRequestError for invalid search terms', async () => {
        const filters = { search: '' };
        const role = Role.ADMIN;
        getUserByCompanyCreatedAtDao.mockResolvedValue({ id: 4 });
        getRoleDao.mockResolvedValue([{ id: 3 }]);
        getBeneficiaryAccountBySearchDao.mockImplementation(() => {
          throw new BadRequestError('Please provide valid search items');
        });
  
        await expect(getBeneficiaryAccountBySearchService(filters, role, '1', '10', 1, Role.ADMIN, 1))
          .rejects.toEqual({ message: 'Please provide valid search items' });
        expect(logger.error).toHaveBeenCalled();
      });
    });
  
    describe('getBeneficiaryAccountServiceByBankName', () => {
      test('should fetch beneficiary accounts by bank name with transaction', async () => {
        const company_id = 1;
        const type = 'savings';
        const role = Role.VENDOR;
        const user_id = 1;
        const designation = Role.VENDOR;
        const mockResult = [{ id: 1, bankAccountsname: 'test_account' }];
        getUserHierarchysDao.mockResolvedValue([]);
        getBeneficiaryAccountDaoByBankName.mockResolvedValue(mockResult);
  
        const result = await getBeneficiaryAccountServiceByBankName(company_id, type, role, user_id, designation);
  
        expect(beginTransaction).toHaveBeenCalledWith(conn);
        expect(getBeneficiaryAccountDaoByBankName).toHaveBeenCalledWith(conn, company_id, type, { user_id: [1] });
        expect(commit).toHaveBeenCalledWith(conn);
        expect(conn.release).toHaveBeenCalled();
        expect(result).toEqual(mockResult);
      });
  
      test('should rollback on error', async () => {
        const company_id = 1;
        const type = 'savings';
        const role = Role.VENDOR;
        const user_id = 1;
        const designation = Role.VENDOR;
        const error = new Error('DB error');
        getUserHierarchysDao.mockRejectedValue(error);
  
        await expect(getBeneficiaryAccountServiceByBankName(company_id, type, role, user_id, designation))
          .rejects.toEqual(error);
        expect(rollback).toHaveBeenCalledWith(conn);
        expect(conn.release).toHaveBeenCalled();
      });
    });
  
    describe('createBeneficiaryAccountService', () => {
      test('should create beneficiary account for VENDOR role', async () => {
        const payload = { acc_no: '123', user_id: 1, created_by: 1, company_id: 1 };
        const company_id = 1;
        const mockResult = { id: 1 };
        getUserByIdDao.mockResolvedValue([{ role: Role.VENDOR }]);
        getRoleDao.mockResolvedValue([{ id: 3, role: Role.VENDOR }]);
        getBeneficiaryAccountDao.mockResolvedValue([]);
        createBeneficiaryAccountDao.mockResolvedValue(mockResult);
  
        const result = await createBeneficiaryAccountService(conn, payload, company_id);
  
        expect(getUserByIdDao).toHaveBeenCalledWith(conn, { id: 1 });
        expect(getRoleDao).toHaveBeenCalledWith({ role: Role.VENDOR });
        expect(getBeneficiaryAccountDao).toHaveBeenCalledWith({ acc_no: '123', user_id: 1 }, null, null, Role.VENDOR);
        expect(createBeneficiaryAccountDao).toHaveBeenCalledWith(conn, {
          acc_no: '123',
          user_id: 1,
          created_by: 1,
          company_id: 1,
          role_id: 3,
          config: { type: 'Personal', initial_balance: 0, closing_balance: 0, is_enabled: true }
        });
        expect(result).toEqual(mockResult);
      });
  
      test('should throw BadRequestError if account already exists', async () => {
        const payload = { acc_no: '123', user_id: 1, created_by: 1, company_id: 1 };
        const company_id = 1;
        getUserByIdDao.mockResolvedValue([{ role: Role.VENDOR }]);
        getRoleDao.mockResolvedValue([{ id: 3, role: Role.VENDOR }]);
        getBeneficiaryAccountDao.mockResolvedValue([{ id: 1 }]);
  
        await expect(createBeneficiaryAccountService(conn, payload, company_id))
          .rejects.toEqual({ message: 'Beneficiary account already exists for this merchant' });
        expect(createBeneficiaryAccountDao).not.toHaveBeenCalled();
      });
    });
  
    describe('updateBeneficiaryAccountService', () => {
      test('should update beneficiary account', async () => {
        const ids = { id: '1', company_id: 1 };
        const payload = { acc_no: '123', updated_by: 1 };
        const mockResult = { id: 1 };
        getBeneficiaryAccountDao.mockResolvedValue([{ id: 1, bank_name: 'test_bank' }]);
        checkBeneficiaryAccountExistsDao.mockResolvedValue(null);
        updateBeneficiaryAccountDao.mockResolvedValue(mockResult);
  
        const result = await updateBeneficiaryAccountService(conn, ids, payload);
  
        expect(checkBeneficiaryAccountExistsDao).toHaveBeenCalledWith({ acc_no: '123', company_id: 1 });
        expect(getBeneficiaryAccountDao).toHaveBeenCalledWith({ id: '1', company_id: 1 });
        expect(updateBeneficiaryAccountDao).toHaveBeenCalledWith({ id: '1', company_id: 1 }, payload, conn);
        expect(result).toEqual(mockResult);
      });
  
      test('should throw BadRequestError if account not found', async () => {
        const ids = { id: '1', company_id: 1 };
        const payload = { acc_no: '123', updated_by: 1 };
        getBeneficiaryAccountDao.mockResolvedValue([]);
  
        await expect(updateBeneficiaryAccountService(conn, ids, payload))
          .rejects.toEqual({ message: 'Beneficiary account not found' });
        expect(updateBeneficiaryAccountDao).not.toHaveBeenCalled();
      });
    });
  
    describe('deleteBeneficiaryAccountService', () => {
      test('should delete beneficiary account', async () => {
        const ids = { id: '1', company_id: 1 };
        const mockResult = { id: 1 };
        deleteBeneficiaryDao.mockResolvedValue(mockResult);
  
        const result = await deleteBeneficiaryAccountService(conn, ids);
  
        expect(deleteBeneficiaryDao).toHaveBeenCalledWith(conn, { id: '1', company_id: 1 }, { is_obsolete: true });
        expect(result).toEqual(mockResult);
      });
  
      test('should throw BadRequestError on failure', async () => {
        const ids = { id: '1', company_id: 1 };
        const error = new Error('DB error');
        deleteBeneficiaryDao.mockRejectedValue(error);
  
        await expect(deleteBeneficiaryAccountService(conn, ids))
          .rejects.toEqual({ message: 'Error getting while  deleting banks' });
        expect(logger.error).toHaveBeenCalledWith('error getting while deleting banks', error);
      });
    });
  });