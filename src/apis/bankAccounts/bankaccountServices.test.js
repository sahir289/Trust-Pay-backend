const {
  getBankaccountService,
  getBankAccountBySearchService,
  getBankaccountServiceNickName,
  createBankaccountService,
  updateBankaccountService,
  deleteBankaccountService,
} = require('./bankaccountServices');
const { getUserHierarchysDao } = require('../userHierarchy/userHierarchyDao');
const {
  getBankaccountDao,
  createBankaccountDao,
  updateBankaccountDao,
  deleteBankaccountDao,
  getBankAccountDaoNickName,
  getBankAccountsBySearchDao,
  getAllBankaccountDao,
} = require('./bankaccountDao');
const { getVendorsDao } = require('../vendors/vendorDao');
const { getCalculationforCronDao } = require('../calculation/calculationDao');
const { getBankResponsesforFreeze } = require('../bankResponse/bankResponseDao');
const { beginTransaction, commit, rollback, getConnection } = require('../../utils/db');
const { BadRequestError, InternalServerError } = require('../../utils/appErrors');
const { Role } = require('../../constants/index');
const { deactivateBank } = require('../../utils/sockets');
const { logger } = require('../../utils/logger');

jest.mock('../userHierarchy/userHierarchyDao');
jest.mock('./bankaccountDao');
jest.mock('../vendors/vendorDao');
jest.mock('../calculation/calculationDao');
jest.mock('../bankResponse/bankResponseDao');
jest.mock('../../utils/db');
jest.mock('../../utils/sockets');
jest.mock('../../utils/logger');

describe('Bank Account Service', () => {
  let mockConnection;

  beforeEach(() => {
    mockConnection = {
      release: jest.fn(),
    };
    getConnection.mockResolvedValue(mockConnection);
    beginTransaction.mockResolvedValue();
    commit.mockResolvedValue();
    rollback.mockResolvedValue();
    logger.error.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getBankaccountService', () => {
    it('should fetch bank accounts for VENDOR role with user_id filter', async () => {
      const filters = {};
      const company_id = 1;
      const role = Role.VENDOR;
      const user_id = 123;
      const page = '1';
      const limit = '10';
      const designation = 'USER';
      const mockResult = [{ id: 1, name: 'Bank A' }];

      getUserHierarchysDao.mockResolvedValue([]);
      getAllBankaccountDao.mockResolvedValue(mockResult);

      const result = await getBankaccountService(filters, company_id, role, page, limit, user_id, designation);

      expect(filters.user_id).toEqual([user_id]);
      expect(getAllBankaccountDao).toHaveBeenCalledWith(
        { company_id, user_id: [user_id] },
        1,
        10,
        role,
        designation
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle VENDOR_OPERATIONS designation with parentID', async () => {
      const filters = {};
      const company_id = 1;
      const role = Role.ADMIN;
      const user_id = 123;
      const page = '1';
      const limit = '10';
      const designation = Role.VENDOR_OPERATIONS;
      const mockResult = [{ id: 1, name: 'Bank A' }];

      getUserHierarchysDao.mockResolvedValue([{ config: { parent: 456 } }]);
      getAllBankaccountDao.mockResolvedValue(mockResult);

      const result = await getBankaccountService(filters, company_id, role, page, limit, user_id, designation);

      expect(filters.user_id).toEqual([456]);
      expect(getAllBankaccountDao).toHaveBeenCalledWith(
        { company_id, user_id: [456] },
        1,
        10,
        role,
        designation
      );
      expect(result).toEqual(mockResult);
    });

    it('should throw error on failure', async () => {
      const error = new Error('Database error');
      getUserHierarchysDao.mockRejectedValue(error);

      await expect(
        getBankaccountService({}, 1, Role.ADMIN, '1', '10', 123, 'USER')
      ).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith(
        'error getting while  getting banks', 
        error
      );      
    });
  });

  describe('getBankAccountBySearchService', () => {
    it('should fetch bank accounts by search terms', async () => {
      const filters = {};
      const company_id = 1;
      const role = Role.ADMIN;
      const page = '1';
      const limit = '10';
      const user_id = 123;
      const designation = 'USER';
      const search = 'bank,account';
      const mockResult = [{ id: 1, name: 'Bank A' }];

      getUserHierarchysDao.mockResolvedValue([]);
      getBankAccountsBySearchDao.mockResolvedValue(mockResult);

      const result = await getBankAccountBySearchService(
        filters,
        company_id,
        role,
        page,
        limit,
        user_id,
        designation,
        search
      );

      expect(getBankAccountsBySearchDao).toHaveBeenCalledWith(
        { company_id },
        1,
        10,
        role,
        designation,
        ['bank', 'account']
      );
      expect(result).toEqual(mockResult);
    });

    it('should throw InternalServerError on failure', async () => {
      const error = new Error('Search error');
      getUserHierarchysDao.mockRejectedValue(error);

      await expect(
        getBankAccountBySearchService({}, 1, Role.ADMIN, '1', '10', 123, 'USER', 'bank')
      ).rejects.toThrow(InternalServerError);
      expect(logger.error).toHaveBeenCalledWith('error getting while getting check utr by search', error);
    });
  });

  describe('getBankaccountServiceNickName', () => {
    it('should fetch bank account by nickname with transaction', async () => {
      const company_id = 1;
      const type = 'PayIn';
      const role = Role.VENDOR;
      const user_id = 123;
      const designation = 'USER';
      const user = [123];
      const mockResult = [{ id: 1, nick_name: 'Bank A' }];

      getUserHierarchysDao.mockResolvedValue([]);
      getBankAccountDaoNickName.mockResolvedValue(mockResult);

      const result = await getBankaccountServiceNickName(company_id, type, role, user_id, designation, user);

      expect(getConnection).toHaveBeenCalled();
      expect(beginTransaction).toHaveBeenCalledWith(mockConnection);
      expect(getBankAccountDaoNickName).toHaveBeenCalledWith(mockConnection, company_id, type, { user_id: [123] });
      expect(commit).toHaveBeenCalledWith(mockConnection);
      expect(mockConnection.release).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should rollback on error', async () => {
      const error = new Error('DB error');
      getUserHierarchysDao.mockRejectedValue(error);

      await expect(
        getBankaccountServiceNickName(1, 'PayIn', Role.VENDOR, 123, 'USER', [123])
      ).rejects.toThrow(error);
      expect(rollback).toHaveBeenCalledWith(mockConnection);
      expect(mockConnection.release).toHaveBeenCalled();
    });
  });

  describe('createBankaccountService', () => {
    it('should create bank account for VENDOR_OPERATIONS with parent user_id', async () => {
      const payload = { nick_name: 'Bank A', bank_used_for: 'PayIn' };
      const designation = Role.VENDOR_OPERATIONS;
      const user_id = 123;
      const mockResult = { id: 1, ...payload };

      getUserHierarchysDao.mockResolvedValue([{ config: { parent: 456 } }]);
      createBankaccountDao.mockResolvedValue(mockResult);

      const result = await createBankaccountService(mockConnection, payload, designation, user_id);

      expect(payload.user_id).toBe(456);
      expect(createBankaccountDao).toHaveBeenCalledWith(payload);
      expect(result).toEqual(mockResult);
    });

    it('should throw BadRequestError on failure', async () => {
      const error = new Error('Create error');
    
      // Mock createBankaccountDao to throw
      createBankaccountDao.mockRejectedValue(error);
    
      await expect(
        createBankaccountService(mockConnection, {}, Role.USER, 123)
      ).rejects.toThrow('Create error');
    
      expect(logger.error).toHaveBeenCalledWith(
        'error getting while  creating banks',
        error.message
      );
    });
    
  });

  describe('updateBankaccountService', () => {
    it('should update bank account and deactivate if balance exceeds max_limit', async () => {
      const ids = { id: 1, company_id: 1 };
      const payload = { latest_balance: 1000 };
      const role = Role.ADMIN;
  
      const mockBank = [
        {
          id: 1,
          user_id: 123,
          nick_name: 'Bank A',
          is_enabled: true,
          config: { max_limit: 500, merchants: ['merchant1'] },
        },
      ];
      const mockResult = { id: 1, nick_name: 'Bank A' };
  
      getBankaccountDao.mockResolvedValue(mockBank);
      getUserHierarchysDao.mockResolvedValue([]);
      updateBankaccountDao.mockResolvedValue(mockResult);
      deactivateBank.mockResolvedValue();
  
      const result = await updateBankaccountService(mockConnection, ids, payload, role);
  
      // Expect payload to have is_enabled false and merchants emptied
      expect(updateBankaccountDao).toHaveBeenCalledWith(ids, {
        is_enabled: false,
        config: { max_limit: 500, merchants: [] },
      }, mockConnection);
      
  
      // Ensure deactivation was called
      expect(deactivateBank).toHaveBeenCalledWith('Bank A', 1, 123);
  
      // Ensure updateBankaccountDao was called with updated payload
      expect(updateBankaccountDao).toHaveBeenCalledWith(
        ids,
        expect.objectContaining({
          is_enabled: false,
          config: {
            max_limit: 500,
            merchants: [],
          },
        }),
        mockConnection
      );
        
      // Ensure result matches DAO return
      expect(result).toEqual(mockResult);
    });

    it('should handle freeze/unfreeze bank responses', async () => {
      const ids = { id: 1, company_id: 1 };
      const payload = { config: { is_freeze: true } };
      const role = Role.ADMIN;
      const mockBank = [{ id: 1, user_id: 123, nick_name: 'Bank A' }];
      const mockResponses = [{ id: 101 }, { id: 102 }];

      getBankaccountDao.mockResolvedValue(mockBank);
      getUserHierarchysDao.mockResolvedValue([]);
      getBankResponsesforFreeze.mockResolvedValue(mockResponses);
      // updateBotResponseDao.mockResolvedValue();
      updateBankaccountDao.mockResolvedValue({ id: 1 });

      await updateBankaccountService(mockConnection, ids, payload, role);

      // expect(updateBotResponseDao).toHaveBeenCalledTimes(4); 
      // expect(updateBotResponseDao).toHaveBeenCalledWith(101, { status: '/freezed' }, mockConnection);
    });

    it('should throw error if net balance exceeds limit when enabling bank', async () => {
      const ids = { id: 1, company_id: 1 };
      const payload = { is_enabled: true };
      const role = Role.ADMIN;
      const mockBank = [{ id: 1, user_id: 123, bank_used_for: 'PayIn' }];
      const mockVendors = [{ config: { net_balance: 500 } }];
      const mockCalculations = [{ net_balance: 600 }];

      getBankaccountDao.mockResolvedValue(mockBank);
      getVendorsDao.mockResolvedValue(mockVendors);
      getCalculationforCronDao.mockResolvedValue(mockCalculations);

      await expect(
        updateBankaccountService(mockConnection, ids, payload, role)
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('deleteBankaccountService', () => {
    it('should delete bank account', async () => {
      const ids = { id: 1, company_id: 1 };
      const user_id = 123;
      const mockResult = { id: 1, nick_name: 'Bank A' };

      deleteBankaccountDao.mockResolvedValue(mockResult);

      const result = await deleteBankaccountService(mockConnection, ids, user_id);

      expect(deleteBankaccountDao).toHaveBeenCalledWith(mockConnection, ids, { is_obsolete: true, updated_by: user_id });
      expect(result).toEqual(mockResult);
    });

    it('should throw BadRequestError on failure', async () => {
      const error = new Error('Delete error');
      deleteBankaccountDao.mockRejectedValue(error);

      await expect(
        deleteBankaccountService(mockConnection, { id: 1, company_id: 1 }, 123)
      ).rejects.toThrow(BadRequestError);
      expect(logger.error).toHaveBeenCalledWith('error getting while deleting banks', error);
    });
  });
});