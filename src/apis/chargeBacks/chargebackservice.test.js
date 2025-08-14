// chargeBackService.test.js
import {
    createChargeBackService,
    getChargeBacksService,
    getChargeBacksBySearchService,
    updateChargeBackService,
    deleteChargeBackService,
    blockChargebackUserService,
  } from './chargeBackService.js';
  
  import {
    beginTransaction,
    commit,
    getConnection,
    rollback,
  } from '../../utils/db.js';
  
  import {
    createChargeBackDao,
    deleteChargeBackDao,
    updateChargeBackDao,
    getChargeBacksBySearchDao,
    getChargebackByIdDao,
    getAllChargeBackDao,
  } from './chargeBackDao.js';
  
  import {
    getCompanyDao,
    updateCompanyConfigDao,
  } from '../company/companyDao.js';
  
  import {
    getMerchantByUserIdDao,
    updateMerchantDao,
  } from '../merchants/merchantDao.js';
  
  import {
    getCalculationforCronDao,
    updateCalculationBalanceDao,
  } from '../calculation/calculationDao.js';
  
  import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
  import { InternalServerError, NotFoundError, BadRequestError } from '../../utils/appErrors.js';
  import { Role } from '../../constants/index.js';
  
  // Mock all imports
  jest.mock('../../utils/db.js');
  jest.mock('./chargeBackDao.js');
  jest.mock('../company/companyDao.js');
  jest.mock('../merchants/merchantDao.js');
  jest.mock('../calculation/calculationDao.js');
  jest.mock('../userHierarchy/userHierarchyDao.js');
  
  describe('ChargeBack Service', () => {
    let mockConn;
  
    beforeEach(() => {
      jest.clearAllMocks();
      mockConn = { release: jest.fn() };
      getConnection.mockResolvedValue(mockConn);
      beginTransaction.mockResolvedValue();
      commit.mockResolvedValue();
      rollback.mockResolvedValue();
    });
  
    describe('createChargeBackService', () => {
      const payload = { amount: 100 };
      const PayinDetails = [
        { vendor_user_id: 1, merchant_user_id: 2, payin_id: 10, bank_acc_id: 5, user: 'u123', user_ip: '127.0.0.1' },
      ];
      const company_id = 99;
      const user_id = 7;
  
      beforeEach(() => {
        getCompanyDao.mockResolvedValue([{ config: { blocked_users: [] } }]);
        createChargeBackDao.mockResolvedValue({ merchant_user_id: 2, vendor_user_id: 1 });
        getMerchantByUserIdDao.mockResolvedValue([{ config: { blocked_users: [] } }]);
        getCalculationforCronDao.mockResolvedValue([{ id: 10 }]);
        updateCompanyConfigDao.mockResolvedValue();
        updateMerchantDao.mockResolvedValue();
        updateCalculationBalanceDao.mockResolvedValue();
      });
  
      test('should create a chargeback and commit transaction', async () => {
        const result = await createChargeBackService(payload, PayinDetails, Role.ADMIN, company_id, user_id);
        expect(getConnection).toHaveBeenCalled();
        expect(beginTransaction).toHaveBeenCalledWith(mockConn);
        expect(createChargeBackDao).toHaveBeenCalled();
        expect(updateCompanyConfigDao).toHaveBeenCalled();
        expect(updateMerchantDao).toHaveBeenCalled();
        expect(commit).toHaveBeenCalledWith(mockConn);
        expect(result).toEqual({ merchant_user_id: 2, vendor_user_id: 1 });
      });
  
      test('should throw NotFoundError if company not found', async () => {
        getCompanyDao.mockResolvedValue([]);
        await expect(
          createChargeBackService(payload, PayinDetails, Role.ADMIN, company_id, user_id)
        ).rejects.toThrow(NotFoundError);
        expect(rollback).toHaveBeenCalledWith(mockConn);
      });
    });
  
    describe('getChargeBacksService', () => {
      test('should fetch chargebacks with proper filters', async () => {
        getAllChargeBackDao.mockResolvedValue([{ id: 1 }]);
        getUserHierarchysDao.mockResolvedValue([]);
        const result = await getChargeBacksService({}, Role.MERCHANT, 1, 10, 5);
        expect(getAllChargeBackDao).toHaveBeenCalled();
        expect(result).toEqual([{ id: 1 }]);
      });
  
      test('should throw InternalServerError on DAO failure', async () => {
        getAllChargeBackDao.mockRejectedValue(new Error('DB fail'));
        await expect(
          getChargeBacksService({}, Role.MERCHANT, 1, 10, 5)
        ).rejects.toThrow(InternalServerError);
      });
    });
  
    describe('getChargeBacksBySearchService', () => {
      test('should pass search terms to DAO', async () => {
        getChargeBacksBySearchDao.mockResolvedValue([{ id: 1 }]);
        const filters = { search: 'abc, def' };
        const result = await getChargeBacksBySearchService(filters, Role.ADMIN, 1, 10, 2);
        expect(getChargeBacksBySearchDao).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Number),
          expect.any(Number),
          'sno',
          'DESC',
          expect.anything(),
          Role.ADMIN,
          ['abc', 'def']
        );
        expect(result).toEqual([{ id: 1 }]);
      });
    });
  
    describe('blockChargebackUserService', () => {
      beforeEach(() => {
        getChargebackByIdDao.mockResolvedValue([{ id: 1, config: { blocked_users: [] } }]);
        getCompanyDao.mockResolvedValue([{ config: { blocked_users: [] } }]);
        getMerchantByUserIdDao.mockResolvedValue([{ config: { blocked_users: [] } }]);
        updateChargeBackDao.mockResolvedValue();
        updateCompanyConfigDao.mockResolvedValue();
        updateMerchantDao.mockResolvedValue();
      });
  
      test('should block a user if not already blocked', async () => {
        const result = await blockChargebackUserService(
          { id: 1, company_id: 1 },
          { config: { user_ip: '127.0.0.1', userId: 'u123', merchant_user_id: 2 } }
        );
        expect(updateChargeBackDao).toHaveBeenCalled();
        expect(updateCompanyConfigDao).toHaveBeenCalled();
        expect(updateMerchantDao).toHaveBeenCalled();
        expect(result.config.blocked_users.length).toBe(1);
      });
  
      test('should throw NotFoundError if chargeback not found', async () => {
        getChargebackByIdDao.mockResolvedValue([]);
        await expect(
          blockChargebackUserService({ id: 1, company_id: 1 }, { config: {} })
        ).rejects.toThrow(NotFoundError);
      });
    });
  
    describe('updateChargeBackService', () => {
      beforeEach(() => {
        getChargebackByIdDao.mockResolvedValue([
          { id: 1, created_at: new Date().toISOString(), amount: 50 }
        ]);
        updateChargeBackDao.mockResolvedValue({ merchant_user_id: 2, vendor_user_id: 1, amount: 100 });
        getCalculationforCronDao.mockResolvedValue([{ id: 1 }]);
        updateCalculationBalanceDao.mockResolvedValue();
      });
  
      test('should update chargeback successfully', async () => {
        const result = await updateChargeBackService({ id: 1, company_id: 1 }, { amount: 100 });
        expect(updateChargeBackDao).toHaveBeenCalled();
        expect(updateCalculationBalanceDao).toHaveBeenCalled();
        expect(result.amount).toBe(100);
      });
  
      test('should throw BadRequestError if chargeback is not from today', async () => {
        getChargebackByIdDao.mockResolvedValue([
          { id: 1, created_at: '2020-01-01T00:00:00Z', amount: 50 }
        ]);
        await expect(
          updateChargeBackService({ id: 1, company_id: 1 }, { amount: 100 })
        ).rejects.toThrow(BadRequestError);
      });
    });
  
    describe('deleteChargeBackService', () => {
      test('should delete and return filtered result', async () => {
        deleteChargeBackDao.mockResolvedValue([{ id: 1, extra: 'ignore' }]);
        const result = await deleteChargeBackService({ id: 1 }, {}, Role.ADMIN);
        expect(deleteChargeBackDao).toHaveBeenCalled();
        expect(result).toBeDefined();
      });
    });
    describe('blockChargebackUserService edge cases', () => {
        beforeEach(() => {
          getChargebackByIdDao.mockResolvedValue([{ id: 1, config: { blocked_users: [{ userId: 'u123', user_ip: '127.0.0.1' }] } }]);
          getCompanyDao.mockResolvedValue([{ config: { blocked_users: [{ user_ip: ['127.0.0.1'] }] } }]);
          getMerchantByUserIdDao.mockResolvedValue([{ config: { blocked_users: [{ userId: ['u123'] }] } }]);
          updateChargeBackDao.mockResolvedValue();
          updateCompanyConfigDao.mockResolvedValue();
          updateMerchantDao.mockResolvedValue();
        });
    
        test('should unblock a user if already blocked', async () => {
          const result = await blockChargebackUserService(
            { id: 1, company_id: 1 },
            { config: { user_ip: '127.0.0.1', userId: 'u123', merchant_user_id: 2 } }
          );
          expect(result.config.blocked_users.length).toBe(0);
          expect(updateCompanyConfigDao).toHaveBeenCalledWith(
            { id: 1 },
            { config: { blocked_users: [] } },
            mockConn
          );
        });
      });
    
      describe('getChargeBacksService pagination edge cases', () => {
        beforeEach(() => {
          getAllChargeBackDao.mockResolvedValue([{ id: 1 }]);
          getUserHierarchysDao.mockResolvedValue([]);
        });
    
        test('should handle no_pagination for both page and limit', async () => {
          await getChargeBacksService({}, Role.ADMIN, 'no_pagination', 'no_pagination', 1);
          expect(getAllChargeBackDao).toHaveBeenCalledWith(
            expect.any(Object),
            null,
            null,
            'sno',
            'DESC',
            expect.anything(),
            Role.ADMIN
          );
        });
    
        test('should expand merchant_user_id with hierarchy siblings', async () => {
          getUserHierarchysDao.mockResolvedValue([{ config: { siblings: { sub_merchants: [99] } } }]);
          const filters = {};
          await getChargeBacksService(filters, Role.MERCHANT, 1, 10, 123);
          expect(filters.merchant_user_id).toContain(99);
        });
      });
    
      describe('getChargeBacksBySearchService edge cases', () => {
        beforeEach(() => {
          getChargeBacksBySearchDao.mockResolvedValue([{ id: 1 }]);
          getUserHierarchysDao.mockResolvedValue([]);
        });
    
        test('should handle empty search string gracefully', async () => {
          const filters = { search: '' };
          await getChargeBacksBySearchService(filters, Role.ADMIN, 1, 10, 2);
          expect(getChargeBacksBySearchDao).toHaveBeenCalledWith(
            expect.any(Object),
            expect.any(Number),
            expect.any(Number),
            'sno',
            'DESC',
            expect.anything(),
            Role.ADMIN,
            undefined // no search terms
          );
        });
    
        test('should trim and filter out empty search terms', async () => {
          const filters = { search: 'abc, , def' };
          await getChargeBacksBySearchService(filters, Role.ADMIN, 1, 10, 2);
          expect(getChargeBacksBySearchDao).toHaveBeenCalledWith(
            expect.any(Object),
            expect.any(Number),
            expect.any(Number),
            'sno',
            'DESC',
            expect.anything(),
            Role.ADMIN,
            ['abc', 'def']
          );
        });
      });
    
      describe('updateChargeBackService amount change scenarios', () => {
        beforeEach(() => {
          getCalculationforCronDao.mockResolvedValue([{ id: 1 }]);
          updateCalculationBalanceDao.mockResolvedValue();
        });
    
        test('should handle increase in amount', async () => {
          getChargebackByIdDao.mockResolvedValue([{ id: 1, created_at: new Date().toISOString(), amount: 50 }]);
          updateChargeBackDao.mockResolvedValue({ merchant_user_id: 2, vendor_user_id: 1, amount: 100 });
          const result = await updateChargeBackService({ id: 1, company_id: 1 }, { amount: 100 });
          expect(updateCalculationBalanceDao).toHaveBeenCalledWith(
            { id: 1 },
            expect.objectContaining({ total_chargeback_amount: 50 }),
            mockConn
          );
          expect(result.amount).toBe(100);
        });
    
        test('should handle decrease in amount', async () => {
          getChargebackByIdDao.mockResolvedValue([{ id: 1, created_at: new Date().toISOString(), amount: 150 }]);
          updateChargeBackDao.mockResolvedValue({ merchant_user_id: 2, vendor_user_id: 1, amount: 100 });
          const result = await updateChargeBackService({ id: 1, company_id: 1 }, { amount: 100 });
          expect(updateCalculationBalanceDao).toHaveBeenCalledWith(
            { id: 1 },
            expect.objectContaining({ total_chargeback_amount: -50 }),
            mockConn
          );
          expect(result.amount).toBe(100);
        });
      });
    
      describe('Transaction rollback scenarios', () => {
        test('should rollback if DAO throws inside createChargeBackService', async () => {
          getCompanyDao.mockResolvedValue([{ config: {} }]);
          createChargeBackDao.mockRejectedValue(new Error('DAO fail'));
          await expect(
            createChargeBackService({}, [{ vendor_user_id: 1, merchant_user_id: 2, payin_id: 10, bank_acc_id: 5, user: 'u', user_ip: '1.1.1.1' }], Role.ADMIN, 1, 1)
          ).rejects.toThrow('DAO fail');
          expect(rollback).toHaveBeenCalledWith(mockConn);
        });
    
        test('should rollback if error occurs in blockChargebackUserService', async () => {
          getChargebackByIdDao.mockRejectedValue(new Error('fail'));
          await expect(
            blockChargebackUserService({ id: 1, company_id: 1 }, { config: {} })
          ).rejects.toThrow('fail');
          expect(rollback).toHaveBeenCalledWith(mockConn);
        });
      });
  });


  
  