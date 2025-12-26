
// payoutService.test.js
import {
  createPayoutService,
  getPayoutsService,
  checkPayOutStatusService,
  getPayoutsBySearchService,
  updatePayoutService,
  deletePayoutService,
  assignedPayoutService,
  createTataPayBulkPayoutService,
} from './payOutService'; // Adjust the import path to match your file structure

import * as merchantDao from '../merchants/merchantDao.js';
import * as payoutDao from './payOutDao.js';
import * as vendorDao from '../vendors/vendorDao.js';
import * as calculationDao from '../calculation/calculationDao.js';
import * as bankaccountDao from '../bankAccounts/bankaccountDao.js';
// import * as companyDao from '../company/companyDao.js';
import * as userHierarchyDao from '../userHierarchy/userHierarchyDao.js';
import { Role, Status } from '../../constants/index.js';
// import axios from 'axios';
import { getConnection, beginTransaction, commit, rollback } from '../../utils/db.js';
// import { logger } from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import * as helpers from '../../helpers/index.js';
import { checkLockEdit } from '../../utils/advisoryLock.js';
import { merchantPayoutCallback } from '../../callBacksAndWebHook/merchantCallBacks.js';
import { newTableEntry } from '../../utils/sockets.js';
import { trackVendorsNetBalance } from '../../utils/trackVendorsNetBalance.js';
import * as tatapay from '../../tatapay/tatapay.js';
// Mock dependencies
jest.mock('axios');
jest.mock('../../utils/db.js');
jest.mock('../../utils/logger.js');
jest.mock('../../config/config.js');
jest.mock('../merchants/merchantDao.js');
jest.mock('./payOutDao.js');
jest.mock('../vendors/vendorDao.js');
jest.mock('../calculation/calculationDao.js');
jest.mock('../bankAccounts/bankaccountDao.js');
jest.mock('../company/companyDao.js');
jest.mock('../userHierarchy/userHierarchyDao.js');
jest.mock('../../utils/sockets.js');
jest.mock('../../utils/trackVendorsNetBalance.js');
jest.mock('../../callBacksAndWebHook/merchantCallBacks.js');
jest.mock('../../utils/advisoryLock.js');
jest.mock('uuid');
jest.mock('../../helpers/index.js');
jest.mock('../../tatapay/tatapay.js'); // <-- mock the module

// Setup common mocks
const mockConn = { release: jest.fn() };
getConnection.mockResolvedValue(mockConn);
beginTransaction.mockResolvedValue(undefined);
commit.mockResolvedValue(undefined);
rollback.mockResolvedValue(undefined);
checkLockEdit.mockResolvedValue(undefined);
helpers.filterResponse.mockImplementation((data) => data);
helpers.calculateCommission.mockImplementation((amount, commission) => amount * commission / 100);
newTableEntry.mockResolvedValue(undefined);
trackVendorsNetBalance.mockResolvedValue(undefined);
merchantPayoutCallback.mockResolvedValue(undefined);
uuidv4.mockReturnValue('mock-uuid');

jest.mock('../vendors/vendorDao.js', () => ({
  getVendorByIdDao: jest.fn(),
  getVendorsDao : jest.fn(),
}));
describe('Payout Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    merchantDao.getMerchantsDao.mockResolvedValue([]);
    payoutDao.getPayoutsDao.mockResolvedValue([]);
  });

  describe('createPayoutService', () => {
    it('should return error if merchant does not exist', async () => {
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([]);
      const result = await createPayoutService(null, {}, { code: 'invalid' }, Role.MERCHANT, '127.0.0.1', true);
      expect(result).toEqual({ status: 404, message: 'Merchant is inactive. Contact support for help!' });
    });

    it('should return error if IP not whitelisted', async () => {
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([{ config: { whitelist_ips: ['192.168.1.1'] } }]);
      const result = await createPayoutService(null, {}, { code: 'valid' }, Role.MERCHANT, '127.0.0.1', true);
      expect(result).toEqual({ status: 400, message: 'IP not whitelisted' });
    });

    it('should return error if merchant balance is insufficient', async () => {
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([{ balance: -100, config: {} }]);
      const result = await createPayoutService(null, {}, { code: 'valid', amount: 50 }, Role.MERCHANT, '127.0.0.1', true);
      expect(result).toEqual({ status: 400, message: 'Merchant balance is less than payout amount' });
    });

    it('should return error if merchant_order_id already exists', async () => {
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([{ id: 1, config: {}, balance: 1000 }]);
    // service uses getPayoutByMerchantOrderIdDao to check duplicate merchant_order_id
    payoutDao.getPayoutByMerchantOrderIdDao.mockResolvedValueOnce({ id: 1 });
      const result = await createPayoutService(null, {}, { code: 'valid', amount: 50, x_api_key: 'valid_key', merchant_order_id: 'dup' }, Role.MERCHANT, '127.0.0.1', true);
      expect(result).toEqual({ status: 400, message: 'Merchant Order ID already exists' });
    });

    it('should return error if invalid API key', async () => {
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([{ id: 1, config: { keys: { private: 'private', public: 'public' } }, balance: 1000 }]);
      payoutDao.getPayoutsDao.mockResolvedValueOnce([]);
      const result = await createPayoutService(null, {}, { code: 'valid', amount: 50, x_api_key: 'invalid' }, Role.MERCHANT, '127.0.0.1', true);
      expect(result).toEqual({ status: 404, message: 'Enter valid Api key' });
    });

    it('should create payout successfully', async () => {
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([{ id: 1, config: { keys: { private: 'private', public: 'public' }}, balance: 1000, min_payout: 10, max_payout: 1000, company_id: 1, user_id: 1 }]);
      payoutDao.getPayoutsDao.mockResolvedValue([]);
      payoutDao.createPayoutDao.mockResolvedValue({ id: 1 });
      const result = await createPayoutService(null, {}, { code: 'valid', amount: 50, x_api_key: 'private' }, Role.MERCHANT, '127.0.0.1', true);
      expect(result).toEqual({ id: 1 });
    });
  });

  describe('getPayoutsService', () => {
    it('should fetch payouts for merchant role', async () => {
      userHierarchyDao.getUserHierarchysDao.mockResolvedValue([{ config: { siblings: { sub_merchants: [] } } }]);
      merchantDao.getMerchantByUserIdDao.mockResolvedValue([{ id: 1 }]);
      payoutDao.getAllPayoutsDao.mockResolvedValue([{ total: 1, id: 1 }]);
      const result = await getPayoutsService(1, 1, 10, 'DESC', {}, Role.MERCHANT, 1, Role.MERCHANT);
      expect(result).toEqual({ totalCount: 1, payout: [{ total: 1, id: 1 }] });
    });

    it('should fetch payouts for vendor role', async () => {
      userHierarchyDao.getUserHierarchysDao.mockResolvedValue([{ config: { siblings: { sub_vendors: [] } } }]);
      vendorDao.getVendorsDao.mockResolvedValue([{ id: 1 }]);
      payoutDao.getAllPayoutsDao.mockResolvedValue([{ total: 2, id: 2 }]);
      const result = await getPayoutsService(1, 1, 10, 'DESC', {}, Role.VENDOR, 1, Role.VENDOR);
      expect(result).toEqual({ totalCount: 2, payout: [{ total: 2, id: 2 }] });
    });

    it('should handle errors', async () => {
      payoutDao.getAllPayoutsDao.mockRejectedValue(new Error('DB error'));
      await expect(getPayoutsService(1, 1, 10, 'DESC', {}, Role.MERCHANT, 1, Role.MERCHANT)).rejects.toThrow('DB error');
    });

    it('should fetch payouts for sub-merchant', async () => {
      userHierarchyDao.getUserHierarchysDao.mockResolvedValue([]);
      merchantDao.getMerchantByUserIdDao.mockResolvedValue([{ id: 3 }]);
      payoutDao.getAllPayoutsDao.mockResolvedValue([{ total: 3, id: 3 }]);
      const result = await getPayoutsService(1, 1, 10, 'DESC', {}, Role.MERCHANT, 1, Role.SUB_MERCHANT);
      expect(result).toEqual({ totalCount: 3, payout: [{ total: 3, id: 3 }] });
    });
  });

  describe('checkPayOutStatusService', () => {
    it('should return error if merchant not found', async () => {
      merchantDao.getMerchantsDao.mockResolvedValue([]);
      const result = await checkPayOutStatusService(1, 'invalid', 'order1', 'key');
      // service returns a generic merchant-not-found message when no merchant is found
      expect(result).toEqual({ status: 400, message: 'Merchant does not exist' });
    });

    it('should return error if invalid API key', async () => {
      merchantDao.getMerchantsDao.mockResolvedValue([{ id: 1, config: { keys: { private: 'private', public: 'public' }} }]);
      const result = await checkPayOutStatusService(1, 'valid', 'order1', 'invalid');
      expect(result).toEqual({ status: 404, message: 'Enter valid Api key' });
    });

    // it('should return payout status', async () => {
    //   merchantDao.getMerchantsDao.mockResolvedValue([
    //     { id: 1, code: 'valid', config: { keys: { private: 'private', public: 'public' } } }
    //   ]);
    //   payoutDao.getPayoutsDao.mockResolvedValueOnce([
    //     { merchant_id: 1, status: Status.APPROVED, merchant_order_id: 'order1', amount: 100, id: 1, utr_id: 'utr123' }
    //   ]);

    //   const result = await checkPayOutStatusService(1, 'valid', 'order1', 'private');
    //   expect(result).toEqual({ status: Status.APPROVED, merchantOrderId: 'order1', amount: 100, payoutId: 1, utr_id: 'utr123' });
    // });

    // it('should return error if payout does not belong to merchant', async () => {
    //   merchantDao.getMerchantsDao.mockResolvedValue([{ id: 1, config: { keys: { private: 'private', public: 'public' }} }]);
    //   payoutDao.getPayoutsDao.mockResolvedValue([{ merchant_id: 2, status: Status.APPROVED, merchant_order_id: 'order1', amount: 100, id: 1, utr_id: 'utr123' }]);
    //   const result = await checkPayOutStatusService(1, 'valid', 'order1', 'private');
    //   // service message refers to payOut ID specifically
    //   expect(result).toEqual({ status: 404, message: 'merchant_order_id and payOut ID do not belong to the specified merchant' });
    // });
  });

  describe('getPayoutsBySearchService', () => {
    it('should throw error on invalid pagination', async () => {
      await expect(getPayoutsBySearchService({ page: 'invalid', limit: 10, search: 'term' }, Role.MERCHANT, 1, Role.MERCHANT, false)).rejects.toThrow('Invalid pagination parameters');
    });

    it('should search payouts successfully', async () => {
      userHierarchyDao.getUserHierarchysDao.mockResolvedValue([{ config: { siblings: { sub_merchants: [] } } }]);
      merchantDao.getMerchantByUserIdDao.mockResolvedValue([{ id: 1 }]);
      payoutDao.getPayoutsBySearchDao.mockResolvedValue([{ id: 1 }]);
      const result = await getPayoutsBySearchService({ page: 1, limit: 10, search: 'term' }, Role.MERCHANT, 1, Role.MERCHANT, false);
      expect(result).toEqual([{ id: 1 }]);
    });

    it('should handle empty search terms', async () => {
      userHierarchyDao.getUserHierarchysDao.mockResolvedValue([{ config: { siblings: { sub_merchants: [] } } }]);
      merchantDao.getMerchantByUserIdDao.mockResolvedValue([{ id: 1 }]);
      payoutDao.getPayoutsBySearchDao.mockResolvedValue([]);
      const result = await getPayoutsBySearchService({ page: 1, limit: 10, search: '' }, Role.MERCHANT, 1, Role.MERCHANT, false);
      expect(result).toEqual([]);
    });

    it('should search with amount', async () => {
      userHierarchyDao.getUserHierarchysDao.mockResolvedValue([{ config: { siblings: { sub_merchants: [] } } }]);
      merchantDao.getMerchantByUserIdDao.mockResolvedValue([{ id: 1 }]);
      payoutDao.getPayoutsBySearchDao.mockResolvedValue([{ id: 2 }]);
      const result = await getPayoutsBySearchService({ page: 1, limit: 10, search: '100' }, Role.MERCHANT, 1, Role.MERCHANT, true);
      expect(result).toEqual([{ id: 2 }]);
    });
  });

  describe('updatePayoutService', () => {

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should throw error if payout not found', async () => {
      payoutDao.getPayoutsDao.mockResolvedValue([]);
      await expect(updatePayoutService(mockConn, { id: 1, company_id: 1 }, {}, Role.ADMIN))
        .rejects.toThrow('Payout not found!');
    });

    it('should update payout successfully for approved status', async () => {
      payoutDao.getPayoutsDao.mockResolvedValue([
        { id: 1, status: Status.PENDING, merchant_id: 1, bank_acc_id: 1, amount: 100, config: { urls: { notify: '' } } }
      ]);

      merchantDao.getMerchantByIdDao.mockResolvedValue([
        { id: 1, user_id: 1, payout_commission: 1, balance: 1000, config: { urls: { payout_notify: '' } } }
      ]);

      bankaccountDao.getBankByIdDao.mockResolvedValue([
        { id: 1, user_id: 2, payin_count: 0, today_balance: 1000, balance: 1000, is_obsolete: false, is_blocked: false, config: { max_limit: 2000 } }
      ]);

      // ✅ FIX: mock getVendorByIdDao
      vendorDao.getVendorByIdDao.mockResolvedValue([
        { id: 1, payout_commission: 1, designation_name: Role.VENDOR, config: {} }
      ]);

      payoutDao.updatePayoutDao
        .mockResolvedValueOnce({ id: 1, status: Status.APPROVED, approved_at: new Date().toISOString(), config: { urls: { notify: '' } } })
        .mockResolvedValueOnce({ id: 1, status: Status.APPROVED, approved_at: new Date().toISOString(), config: { urls: { notify: '' } } });

      calculationDao.getCalculationforCronDao
        .mockResolvedValueOnce([{ id: 1 }]) // merchant
        .mockResolvedValueOnce([{ id: 2 }]); // vendor

      calculationDao.updateCalculationBalanceDao.mockResolvedValue({});
      bankaccountDao.updateBankaccountDao.mockResolvedValue({});
      payoutDao.getPayoutsDao.mockResolvedValueOnce([{ status: Status.PENDING }]); // post check

      const result = await updatePayoutService(
        mockConn,
        { id: 1, company_id: 1 },
        { status: Status.APPROVED, utr_id: 'utr123', bank_acc_id: 1, updated_by: 1 },
        Role.ADMIN
      );

      expect(result).toEqual({
        id: 1,
        status: Status.APPROVED,
        approved_at: expect.any(String),
        config: { urls: { notify: '' } }
      });
    });

    it('should update payout to rejected status', async () => {
      payoutDao.getPayoutsDao.mockResolvedValue([
        { id: 1, status: Status.PENDING, merchant_id: 1, bank_acc_id: 1, amount: 100, config: { urls: { notify: '' } } }
      ]);
      merchantDao.getMerchantByIdDao.mockResolvedValue([
        { id: 1, user_id: 1, payout_commission: 1, balance: 1000, config: { urls: { payout_notify: '' } } }
      ]);
      bankaccountDao.getBankByIdDao.mockResolvedValue([
        { id: 1, user_id: 2, payin_count: 0, today_balance: 1000, balance: 1000, is_obsolete: false, is_blocked: false, config: { max_limit: 2000 } }
      ]);
      vendorDao.getVendorByIdDao.mockResolvedValue([
        { id: 1, payout_commission: 1, designation_name: Role.VENDOR, config: {} }
      ]);
      payoutDao.updatePayoutDao.mockResolvedValue({ id: 1, status: Status.REJECTED, rejected_at: new Date().toISOString(), config: { urls: { notify: '' } } });
      payoutDao.getPayoutsDao.mockResolvedValueOnce([{ status: Status.PENDING }]); // post check

      const result = await updatePayoutService(
        mockConn,
        { id: 1, company_id: 1 },
        { status: Status.REJECTED, config: { rejected_reason: 'reason' }, updated_by: 1 },
        Role.ADMIN
      );

      expect(result).toEqual({
        id: 1,
        status: Status.REJECTED,
        rejected_at: expect.any(String),
        config: { urls: { notify: '' } }
      });
    });
  });

  describe('deletePayoutService', () => {
    it('should delete payout successfully', async () => {
      payoutDao.deletePayoutDao.mockResolvedValue({ id: 1 });
      const result = await deletePayoutService(1, 1, Role.ADMIN);
      expect(result).toEqual({ id: 1 });
      expect(payoutDao.deletePayoutDao).toHaveBeenCalledWith(1, { is_obsolete: true, updated_by: 1 });
    });

    it('should handle transaction rollback on error', async () => {
      payoutDao.deletePayoutDao.mockRejectedValue(new Error('Delete error'));
      await expect(deletePayoutService(1, 1, Role.ADMIN)).rejects.toThrow('Delete error');
      expect(rollback).toHaveBeenCalled();
    });

    it('should delete for merchant role', async () => {
      payoutDao.deletePayoutDao.mockResolvedValue({ id: 2 });
      const result = await deletePayoutService(2, 2, Role.MERCHANT);
      expect(result).toEqual({ id: 2 });
    });
  });

  describe('assignedPayoutService', () => {
    it('should assign payout successfully', async () => {
      payoutDao.assignedPayoutDao.mockResolvedValue({ id: 1 });
      const result = await assignedPayoutService(mockConn, 1, { vendor_id: 1 }, 1, 1);
      expect(result).toEqual({ id: 1 });
    });

    it('should handle assignment error', async () => {
      payoutDao.assignedPayoutDao.mockRejectedValue(new Error('Assignment error'));
      await expect(assignedPayoutService(mockConn, 1, { vendor_id: 1 }, 1, 1)).rejects.toThrow('Assignment error');
    });

    it('should assign with different payload', async () => {
      payoutDao.assignedPayoutDao.mockResolvedValue({ id: 2 });
      const result = await assignedPayoutService(mockConn, 2, { bank_acc_id: 2 }, 2, 2);
      expect(result).toEqual({ id: 2 });
    });
  });
  describe('createTataPayBulkPayoutService', () => {
    const mockConn = { release: jest.fn() };

    beforeEach(() => {
      getConnection.mockResolvedValue(mockConn);
      jest.clearAllMocks();
    });

    it('should successfully call createTataPayBulkPayout and return result', async () => {
      const payload = { payoutEntries: [{ id: 1 }], company_id: 1, user_id: 1 };

      const mockResult = {
        data: { totalRecords: 1, successpayout: 1, skippayout: 0 },
      };

      tatapay.createTataPayBulkPayout.mockResolvedValue(mockResult);

      const result = await createTataPayBulkPayoutService(mockConn, payload);

      expect(tatapay.createTataPayBulkPayout).toHaveBeenCalledWith(
        payload.payoutEntries,
        payload.company_id,
        null, // getPayoutData not needed since we are passing entries
        expect.any(Function), // updatePayoutStatusBulk
        expect.any(Object) // rabbitMQ
      );

      expect(result).toEqual(mockResult);
    });

    it('should fallback to direct DB update if RabbitMQ fails', async () => {
      const payload = { payoutEntries: [{ id: 1, status: Status.APPROVED }], company_id: 1, user_id: 1 };

      tatapay.createTataPayBulkPayout.mockImplementation(async (_entries, _companyId, _getDataFn, updateBulk, rabbitMQ) => {
        await rabbitMQ.sendMessage('queueName', { individualUpdates: [{ payoutId: 1, status: Status.APPROVED }] });
        return { data: { totalRecords: 1, successpayout: 1, skippayout: 0 } };
      });

      payoutDao.updatePayoutDao.mockResolvedValue({ id: 1, status: Status.APPROVED });

      const result = await createTataPayBulkPayoutService(mockConn, payload);

      expect(result.data.totalRecords).toBe(1);
      expect(payoutDao.updatePayoutDao).toHaveBeenCalledWith(
        { id: 1 },
        expect.objectContaining({ status: Status.APPROVED, updated_at: expect.any(String) }),
        mockConn
      );
    });
  });
});