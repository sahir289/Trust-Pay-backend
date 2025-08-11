const {
    getBankaccountService,
    getBankAccountBySearchService,
    getBankaccountServiceNickName,
    createBankaccountService,
    updateBankaccountService,
    deleteBankaccountService,
  } = require('./bankaccountServices');
  const { Role } = require('../../constants');
  const { BadRequestError, InternalServerError } = require('../../utils/appErrors');
  const {
    beginTransaction,
    commit,
    getConnection,
    rollback,
  } = require('../../utils/db');
  const { logger } = require('../../utils/logger');
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
  const { deactivateBank } = require('../../utils/sockets');
  const { getBankResponsesforFreeze, updateBotResponseDao } = require('../bankResponse/bankResponseDao');
  const { stringifyJSON } = require('../../utils');
  
  jest.mock('../../utils/db');
  jest.mock('../../utils/logger');
  jest.mock('../userHierarchy/userHierarchyDao');
  jest.mock('./bankaccountDao');
  jest.mock('../../utils/sockets');
  jest.mock('../bankResponse/bankResponseDao');
  jest.mock('../../utils');
  
  describe('Bank Account Service', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    describe('getBankaccountService', () => {
      it('should fetch bank accounts for VENDOR role', async () => {
        const filters = {};
        const company_id = 'comp1';
        const role = Role.VENDOR;
        const user_id = 'user1';
        const page = '1';
        const limit = '10';
        const designation = 'other';
        const mockAccounts = [{ id: '1', name: 'Bank1' }];
  
        getUserHierarchysDao.mockResolvedValue([]);
        getAllBankaccountDao.mockResolvedValue(mockAccounts);
  
        const result = await getBankaccountService(filters, company_id, role, page, limit, user_id, designation);
  
        expect(filters.user_id).toEqual([user_id]);
        expect(getAllBankaccountDao).toHaveBeenCalledWith(
          { company_id, user_id: [user_id] },
          1,
          10,
          role,
          designation
        );
        expect(result).toEqual(mockAccounts);
      });
  
      it('should fetch bank accounts for VENDOR_OPERATIONS role with parent', async () => {
        const filters = {};
        const company_id = 'comp1';
        const role = 'ADMIN';
        const user_id = 'user1';
        const page = '1';
        const limit = '10';
        const designation = Role.VENDOR_OPERATIONS;
        const mockAccounts = [{ id: '1', name: 'Bank1' }];
        const parentID = 'parent1';
  
        getUserHierarchysDao.mockResolvedValue([{ config: { parent: parentID } }]);
        getAllBankaccountDao.mockResolvedValue(mockAccounts);
  
        const result = await getBankaccountService(filters, company_id, role, page, limit, user_id, designation);
  
        expect(filters.user_id).toEqual([parentID]);
        expect(getAllBankaccountDao).toHaveBeenCalledWith(
          { company_id, user_id: [parentID] },
          1,
          10,
          role,
          designation
        );
        expect(result).toEqual(mockAccounts);
      });
  
      it('should fetch bank accounts for other roles without user filter', async () => {
        const filters = {};
        const company_id = 'comp1';
        const role = 'ADMIN';
        const user_id = 'user1';
        const page = '1';
        const limit = '10';
        const designation = 'admin';
        const mockAccounts = [{ id: '1', name: 'Bank1' }];
  
        getUserHierarchysDao.mockResolvedValue([]);
        getAllBankaccountDao.mockResolvedValue(mockAccounts);
  
        const result = await getBankaccountService(filters, company_id, role, page, limit, user_id, designation);
  
        expect(filters.user_id).toBeUndefined();
        expect(getAllBankaccountDao).toHaveBeenCalledWith(
          { company_id },
          1,
          10,
          role,
          designation
        );
        expect(result).toEqual(mockAccounts);
      });
  
      it('should use default pagination if not provided', async () => {
        const filters = {};
        const company_id = 'comp1';
        const role = 'ADMIN';
        const user_id = 'user1';
        const page = undefined;
        const limit = undefined;
        const designation = 'other';
        const mockAccounts = [{ id: '1', name: 'Bank1' }];
  
        getUserHierarchysDao.mockResolvedValue([]);
        getAllBankaccountDao.mockResolvedValue(mockAccounts);
  
        const result = await getBankaccountService(filters, company_id, role, page, limit, user_id, designation);
  
        expect(getAllBankaccountDao).toHaveBeenCalledWith(
          { company_id },
          1,
          10,
          role,
          designation
        );
        expect(result).toEqual(mockAccounts);
      });
  
      it('should throw error on failure', async () => {
        const error = new Error('DB error');
        getUserHierarchysDao.mockRejectedValue(error);
        logger.error.mockImplementation(() => {});
  
        await expect(
          getBankaccountService({}, 'comp1', 'ADMIN', '1', '10', 'user1', 'other')
        ).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('error getting while  getting banks', error);
      });
    });
  
    describe('getBankAccountBySearchService', () => {
      it('should search bank accounts with search terms for VENDOR', async () => {
        const filters = {};
        const company_id = 'comp1';
        const role = Role.VENDOR;
        const user_id = 'user1';
        const page = '1';
        const limit = '10';
        const designation = 'other';
        const search = 'bank1,bank2';
        const mockAccounts = [{ id: '1', name: 'Bank1' }];
  
        getUserHierarchysDao.mockResolvedValue([]);
        getBankAccountsBySearchDao.mockResolvedValue(mockAccounts);
  
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
  
        expect(filters.user_id).toEqual([user_id]);
        expect(getBankAccountsBySearchDao).toHaveBeenCalledWith(
          { company_id, user_id: [user_id] },
          1,
          10,
          role,
          designation,
          ['bank1', 'bank2']
        );
        expect(result).toEqual(mockAccounts);
      });
  
      it('should search without search terms', async () => {
        const filters = {};
        const company_id = 'comp1';
        const role = 'ADMIN';
        const user_id = 'user1';
        const page = '1';
        const limit = '10';
        const designation = 'other';
        const search = '';
        const mockAccounts = [{ id: '1', name: 'Bank1' }];
  
        getUserHierarchysDao.mockResolvedValue([]);
        getBankAccountsBySearchDao.mockResolvedValue(mockAccounts);
  
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
          undefined
        );
        expect(result).toEqual(mockAccounts);
      });
  
      it('should filter empty search terms', async () => {
        const search = ' , ,bank1, ';
        getUserHierarchysDao.mockResolvedValue([]);
        await getBankAccountBySearchService({}, 'comp1', 'ADMIN', '1', '10', 'user1', 'other', search);
        expect(getBankAccountsBySearchDao).toHaveBeenCalledWith(expect.any(Object), 1, 10, 'ADMIN', 'other', ['bank1']);
      });
  
      it('should throw InternalServerError on failure', async () => {
        const error = new Error('Search error');
        getUserHierarchysDao.mockRejectedValue(error);
        logger.error.mockImplementation(() => {});
  
        await expect(
          getBankAccountBySearchService({}, 'comp1', 'ADMIN', '1', '10', 'user1', 'other', 'search')
        ).rejects.toThrow(InternalServerError);
        expect(logger.error).toHaveBeenCalledWith('error getting while getting check utr by search', error);
      });
    });
  
    describe('getBankaccountServiceNickName', () => {
      let mockConnection;
      beforeEach(() => {
        mockConnection = { release: jest.fn(), beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn() };
        getConnection.mockResolvedValue(mockConnection);
      });
  
      it('should fetch for VENDOR role', async () => {
        const company_id = 'comp1';
        const type = 'type1';
        const role = Role.VENDOR;
        const user_id = 'user1';
        const designation = 'other';
        const user = undefined;
        const mockResult = [{ nickname: 'Bank1' }];
  
        getUserHierarchysDao.mockResolvedValue([]);
        getBankAccountDaoNickName.mockResolvedValue(mockResult);
  
        const result = await getBankaccountServiceNickName(company_id, type, role, user_id, designation, user);
  
        expect(getBankAccountDaoNickName).toHaveBeenCalledWith(mockConnection, company_id, type, { user_id: [user_id] });
        expect(result).toEqual(mockResult);
      });
  
      it('should fetch with specific user', async () => {
        const company_id = 'comp1';
        const type = 'type1';
        const role = 'ADMIN';
        const user_id = 'user1';
        const designation = 'other';
        const user = 'user2';
        const mockResult = [{ nickname: 'Bank1' }];
  
        getUserHierarchysDao.mockResolvedValue([]);
        getBankAccountDaoNickName.mockResolvedValue(mockResult);
  
        const result = await getBankaccountServiceNickName(company_id, type, role, user_id, designation, user);
  
        expect(getBankAccountDaoNickName).toHaveBeenCalledWith(mockConnection, company_id, type, { user_id: [user] });
        expect(result).toEqual(mockResult);
      });
  
      it('should fetch for VENDOR_OPERATIONS with parent', async () => {
        const company_id = 'comp1';
        const type = 'type1';
        const role = 'ADMIN';
        const user_id = 'user1';
        const designation = Role.VENDOR_OPERATIONS;
        const user = undefined;
        const parentID = 'parent1';
        const mockResult = [{ nickname: 'Bank1' }];
  
        getUserHierarchysDao.mockResolvedValue([{ config: { parent: parentID } }]);
        getBankAccountDaoNickName.mockResolvedValue(mockResult);
  
        const result = await getBankaccountServiceNickName(company_id, type, role, user_id, designation, user);
  
        expect(getBankAccountDaoNickName).toHaveBeenCalledWith(mockConnection, company_id, type, { user_id: [parentID] });
        expect(result).toEqual(mockResult);
      });
  
      it('should rollback and release on error', async () => {
        const error = new Error('DB error');
        getUserHierarchysDao.mockRejectedValue(error);
        logger.error.mockImplementation(() => {});
      
        await expect(
          getBankaccountServiceNickName('comp1', 'type1', 'ADMIN', 'user1', 'other', undefined)
        ).rejects.toThrow(error);
        expect(mockConnection.release).toHaveBeenCalled();
      });
  
      it('should log release error', async () => {
        const releaseError = new Error('Release error');
        mockConnection.release.mockImplementation(() => { throw releaseError; });
        getUserHierarchysDao.mockResolvedValue([]);
        getBankAccountDaoNickName.mockResolvedValue([]);
  
        await getBankaccountServiceNickName('comp1', 'type1', 'ADMIN', 'user1', 'other', undefined);
        expect(logger.error).toHaveBeenCalledWith('Error while releasing the connection', releaseError);
      });
    });
  
    describe('createBankaccountService', () => {
      it('should create bank account normally', async () => {
        const conn = { mock: true };
        const payload = { bank_used_for: 'test', nick_name: 'Bank1', user_id: 'user1' };
        const designation = 'other';
        const user_id = 'user1';
        const mockResult = { id: '1', ...payload };
  
        getUserHierarchysDao.mockResolvedValue([]);
        createBankaccountDao.mockResolvedValue(mockResult);
  
        const result = await createBankaccountService(conn, payload, designation, user_id);
  
        expect(createBankaccountDao).toHaveBeenCalledWith(payload);
        expect(result).toEqual(mockResult);
      });
  
      it('should create for VENDOR_OPERATIONS with parent user_id', async () => {
        const conn = { mock: true };
        const payload = { bank_used_for: 'test', nick_name: 'Bank1' };
        const designation = Role.VENDOR_OPERATIONS;
        const user_id = 'child1';
        const parentUserId = 'parent1';
        const mockResult = { id: '1', ...payload, user_id: parentUserId };
  
        getUserHierarchysDao.mockResolvedValue([{ config: { parent: parentUserId } }]);
        createBankaccountDao.mockResolvedValue(mockResult);
  
        const result = await createBankaccountService(conn, payload, designation, user_id);
  
        expect(payload.user_id).toBe(parentUserId);
        expect(createBankaccountDao).toHaveBeenCalledWith(payload);
        expect(result).toEqual(mockResult);
      });
  
      it('should throw BadRequestError on failure', async () => {
        const conn = { mock: true };
        const payload = { bank_used_for: 'test', nick_name: 'Bank1' };
        const designation = Role.VENDOR_OPERATIONS;
        const user_id = 'user1';
        const error = new Error('Create error');
      
        getUserHierarchysDao.mockRejectedValue(error);
        logger.error.mockImplementation(() => {});
      
        await expect(
          createBankaccountService(conn, payload, designation, user_id)
        ).rejects.toThrow(BadRequestError);
        expect(logger.error).toHaveBeenCalledWith('error getting while  creating banks', error);
      });
    });
  
    describe('updateBankaccountService', () => {
      let mockBank;
      beforeEach(() => {
        mockBank = [{ id: '1', user_id: 'user1', nick_name: 'Bank1', is_enabled: true, config: { max_limit: 1000, merchants: ['merch1'] } }];
        getBankaccountDao.mockResolvedValue(mockBank);
        getUserHierarchysDao.mockResolvedValue([]);
        stringifyJSON.mockImplementation((obj) => JSON.stringify(obj));
      });
  
      it('should clear merchants when disabling bank', async () => {
        const conn = { mock: true };
        const ids = { id: '1', company_id: 'comp1' };
        const payload = { is_enabled: false };
        const role = 'ADMIN';
        const mockResult = { updated: true };
  
        updateBankaccountDao.mockResolvedValue(mockResult);
  
        const result = await updateBankaccountService(conn, ids, payload, role);
  
        expect(updateBankaccountDao).toHaveBeenCalledWith(ids, { 
          is_enabled: false,
          config: { merchants: [] }
        }, conn);
        expect(result).toEqual(mockResult);
      });
  
      it('should deactivate bank if balance >= max_limit', async () => {
        const conn = { mock: true };
        const ids = { id: '1', company_id: 'comp1' };
        const payload = { latest_balance: 1000 };
        const role = 'ADMIN';
        const mockResult = { updated: true };
  
        updateBankaccountDao.mockResolvedValue(mockResult);
  
        const result = await updateBankaccountService(conn, ids, payload, role);
  
        expect(deactivateBank).toHaveBeenCalledWith('Bank1', '1', 'user1');
        expect(updateBankaccountDao).toHaveBeenCalledWith(ids, { is_enabled: false }, conn);
        expect(result).toEqual(mockResult);
      });
  
  
      it('should warn deactivate if balance == max_limit', async () => {
        const conn = { mock: true };
        const ids = { id: '1', company_id: 'comp1' };
        const payload = { latest_balance: 1000 };
        mockBank[0].config.max_limit = 1000;
        const role = 'ADMIN';
        const mockResult = { updated: true };
      
        updateBankaccountDao.mockResolvedValue(mockResult);
      
        const result = await updateBankaccountService(conn, ids, payload, role);
      
        expect(deactivateBank).toHaveBeenCalledWith('Bank1', '1', 'user1'); 
        expect(updateBankaccountDao).toHaveBeenCalledWith(ids, { is_enabled: false }, conn);
        expect(result).toEqual(mockResult);
      });
  
      it('should not update if no other changes after balance', async () => {
        const conn = { mock: true };
        const ids = { id: '1', company_id: 'comp1' };
        const payload = { latest_balance: 500 };
        const role = 'ADMIN';
  
        const result = await updateBankaccountService(conn, ids, payload, role);
  
        expect(updateBankaccountDao).not.toHaveBeenCalled();
        expect(result).toBeUndefined();
      });
  
      it('should merge merchant_added', async () => {
        const conn = { mock: true };
        const ids = { id: '1', company_id: 'comp1' };
        const payload = { config: { merchant_added: { merch2: 'date2' } } };
        mockBank[0].config.merchant_added = { merch1: 'date1' };
        const role = 'ADMIN';
        const mockResult = { updated: true };
      
        updateBankaccountDao.mockResolvedValue(mockResult);
      
        const result = await updateBankaccountService(conn, ids, payload, role);
      
        expect(payload.config.merchant_added).toEqual({ merch2: 'date2' }); 
        expect(updateBankaccountDao).toHaveBeenCalledWith(ids, payload, conn);
        expect(result).toEqual(mockResult);
      });

      it('should handle merchant_added with array-like keys', async () => {
        const conn = { mock: true };
        const ids = { id: '1', company_id: 'comp1' };
        const payload = { config: { merchant_added: { '["merch2"]': 'date2' } } };
        const role = 'ADMIN';
        const mockResult = { updated: true };
  
        updateBankaccountDao.mockResolvedValue(mockResult);
  
        await updateBankaccountService(conn, ids, payload, role);
  
        expect(payload.config.merchant_added).toEqual({ merch2: 'date2' });
      });
  
      it('should freeze and update responses', async () => {
        const conn = { mock: true };
        const ids = { id: '1', company_id: 'comp1' };
        const payload = { config: { is_freeze: true } };
        const role = 'ADMIN';
        const mockResponses = [{ id: 'resp1' }, { id: 'resp2' }];
        const mockResult = { updated: true };
  
        getBankResponsesforFreeze.mockResolvedValue(mockResponses);
        updateBotResponseDao.mockResolvedValue({});
        updateBankaccountDao.mockResolvedValue(mockResult);
  
        const result = await updateBankaccountService(conn, ids, payload, role);
  
        expect(getBankResponsesforFreeze).toHaveBeenCalledWith({ bank_id: '1', is_used: false, status: '/success' });
        expect(updateBotResponseDao).toHaveBeenCalledWith('resp1', { status: '/freezed' }, conn);
        expect(updateBotResponseDao).toHaveBeenCalledWith('resp2', { status: '/freezed' }, conn);
        expect(result).toEqual(mockResult);
      });
  
      it('should unfreeze and update responses', async () => {
        const conn = { mock: true };
        const ids = { id: '1', company_id: 'comp1' };
        const payload = { config: { is_freeze: false } };
        const role = 'ADMIN';
        const mockResponses = [{ id: 'resp1' }];
        const mockResult = { updated: true };
  
        getBankResponsesforFreeze.mockResolvedValue(mockResponses);
        updateBotResponseDao.mockResolvedValue({});
        updateBankaccountDao.mockResolvedValue(mockResult);
  
        const result = await updateBankaccountService(conn, ids, payload, role);
  
        expect(getBankResponsesforFreeze).toHaveBeenCalledWith({ bank_id: '1', is_used: false, status: '/freezed' });
        expect(updateBotResponseDao).toHaveBeenCalledWith('resp1', { status: '/success' }, conn);
        expect(result).toEqual(mockResult);
      });
  
      it('should not update responses if no responses', async () => {
        const conn = { mock: true };
        const ids = { id: '1', company_id: 'comp1' };
        const payload = { config: { is_freeze: true } };
        const role = 'ADMIN';
        const mockResult = { updated: true };
  
        getBankResponsesforFreeze.mockResolvedValue([]);
        updateBankaccountDao.mockResolvedValue(mockResult);
  
        await updateBankaccountService(conn, ids, payload, role);
  
        expect(updateBotResponseDao).not.toHaveBeenCalled();
      });
  
      it('should use parent userId for VENDOR_OPERATIONS', async () => {
        const conn = { mock: true };
        const ids = { id: '1', company_id: 'comp1' };
        const payload = { latest_balance: 1000 };
        const role = Role.VENDOR_OPERATIONS;
        const parentId = 'parent1';
  
        getUserHierarchysDao.mockResolvedValue([{ config: { parent: parentId } }]);
  
        await updateBankaccountService(conn, ids, payload, role);
  
        expect(deactivateBank).toHaveBeenCalledWith('Bank1', '1', parentId);
      });
  
      it('should not deactivate if bank disabled', async () => {
        const conn = { mock: true };
        const ids = { id: '1', company_id: 'comp1' };
        const payload = { latest_balance: 1000 };
        const role = 'ADMIN';
        mockBank[0].is_enabled = false;
  
        await updateBankaccountService(conn, ids, payload, role);
  
        expect(deactivateBank).not.toHaveBeenCalled();
      });
  
      it('should not deactivate if max_limit 0', async () => {
        const conn = { mock: true };
        const ids = { id: '1', company_id: 'comp1' };
        const payload = { latest_balance: 1000 };
        const role = 'ADMIN';
        mockBank[0].config.max_limit = 0;
  
        await updateBankaccountService(conn, ids, payload, role);
  
        expect(deactivateBank).not.toHaveBeenCalled();
      });
  
      it('should throw error on failure', async () => {
        const conn = { mock: true };
        const ids = { id: '1', company_id: 'comp1' };
        const payload = {};
        const role = 'ADMIN';
        const error = new Error('Update error');
  
        getBankaccountDao.mockRejectedValue(error);
        logger.error.mockImplementation(() => {});
  
        await expect(
          updateBankaccountService(conn, ids, payload, role)
        ).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('error getting while  updating banks', error);
      });
    });
  
    describe('deleteBankaccountService', () => {
      it('should delete bank account', async () => {
        const conn = { mock: true };
        const ids = { id: '1', company_id: 'comp1' };
        const user_id = 'user1';
        const mockResult = { id: '1', nick_name: 'Bank1' };
  
        deleteBankaccountDao.mockResolvedValue(mockResult);
  
        const result = await deleteBankaccountService(conn, ids, user_id);
  
        expect(deleteBankaccountDao).toHaveBeenCalledWith(
          conn,
          ids,
          { is_obsolete: true, updated_by: user_id }
        );
        expect(result).toEqual(mockResult);
      });
  
      it('should throw BadRequestError on failure of delete', async () => {
        const conn = { mock: true };
        const ids = { id: '1', company_id: 'comp1' };
        const user_id = 'user1';
        const error = new Error('Delete error');
  
        deleteBankaccountDao.mockRejectedValue(error);
        logger.error.mockImplementation(() => {});
  
        await expect(
          deleteBankaccountService(conn, ids, user_id)
        ).rejects.toThrow(BadRequestError);
        expect(logger.error).toHaveBeenCalledWith('error getting while deleting banks', error);
      });
    });
  });