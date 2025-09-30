// payoutService.test.js
import {
  createPayoutService,
  getPayoutsService,
  checkPayOutStatusService,
  getPayoutsBySearchService,
  updatePayoutService,
  deletePayoutService,
  assignedPayoutService,
  walletsPayoutsService,
  getWalletsBalanceService,
  tataPayPayoutsService,
  getTataPayBalanceService,
} from './payOutService'; // Adjust the import path to match your file structure

import * as merchantDao from '../merchants/merchantDao.js';
import * as payoutDao from './payOutDao.js';
import * as vendorDao from '../vendors/vendorDao.js';
import * as calculationDao from '../calculation/calculationDao.js';
import * as bankaccountDao from '../bankAccounts/bankaccountDao.js';
import * as companyDao from '../company/companyDao.js';
import * as userHierarchyDao from '../userHierarchy/userHierarchyDao.js';
import { Role, Status } from '../../constants/index.js';
import axios from 'axios';
import { getConnection, beginTransaction, commit, rollback } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import * as helpers from '../../helpers/index.js';
import { checkLockEdit } from '../../utils/advisoryLock.js';
import { merchantPayoutCallback } from '../../callBacksAndWebHook/merchantCallBacks.js';
import { newTableEntry } from '../../utils/sockets.js';
import { trackVendorsNetBalance } from '../../utils/trackVendorsNetBalance.js';

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

describe('Payout Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      payoutDao.getPayoutsDao.mockResolvedValueOnce([{ id: 1 }]);
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
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([{ id: 1, config: { keys: { private: 'private' } }, balance: 1000, min_payout: 10, max_payout: 1000, company_id: 1, user_id: 1 }]);
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
      expect(result).toEqual({ status: 400, message: 'Merchant Order ID already exists' });
    });

    it('should return error if invalid API key', async () => {
      merchantDao.getMerchantsDao.mockResolvedValue([{ id: 1, config: { keys: { private: 'private' } } }]);
      const result = await checkPayOutStatusService(1, 'valid', 'order1', 'invalid');
      expect(result).toEqual({ status: 404, message: 'Enter valid Api key' });
    });

    it('should return payout status', async () => {
      merchantDao.getMerchantsDao.mockResolvedValue([{ id: 1, config: { keys: { private: 'private' } } }]);
      payoutDao.getPayoutsDao.mockResolvedValue([{ merchant_id: 1, status: Status.APPROVED, merchant_order_id: 'order1', amount: 100, id: 1, utr_id: 'utr123' }]);
      const result = await checkPayOutStatusService(1, 'valid', 'order1', 'private');
      expect(result).toEqual({ status: Status.APPROVED, merchantOrderId: 'order1', amount: 100, payoutId: 1, utr_id: 'utr123' });
    });

    it('should return error if payout does not belong to merchant', async () => {
      merchantDao.getMerchantsDao.mockResolvedValue([{ id: 1, config: { keys: { private: 'private' } } }]);
      payoutDao.getPayoutsDao.mockResolvedValue([{ merchant_id: 2, status: Status.APPROVED, merchant_order_id: 'order1', amount: 100, id: 1, utr_id: 'utr123' }]);
      const result = await checkPayOutStatusService(1, 'valid', 'order1', 'private');
      expect(result).toEqual({ status: 404, message: 'merchant_order_id and payIn ID do not belong to the specified merchant' });
    });
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
    it('should throw error if payout not found', async () => {
      payoutDao.getPayoutsDao.mockResolvedValue([]);
      await expect(updatePayoutService(mockConn, { id: 1, company_id: 1 }, {}, Role.ADMIN)).rejects.toThrow('Payout not found!');
    });

    it('should update payout successfully for approved status', async () => {
      payoutDao.getPayoutsDao.mockResolvedValueOnce([]); // UTR check
      payoutDao.getPayoutsDao.mockResolvedValueOnce([{ id: 1, status: Status.PENDING, merchant_id: 1, bank_acc_id: 1, amount: 100, config: { urls: { notify: '' } } }]); // single
      merchantDao.getMerchantsDao.mockResolvedValue([{ user_id: 1, payout_commission: 1, config: { urls: { payout_notify: '' } } }]);
      bankaccountDao.getBankByIdDao.mockResolvedValue([{ user_id: 2, payin_count: 0, today_balance: 1000, balance: 1000, is_obsolete: false, is_blocked: false, config: { max_limit: 2000 } }]);
      vendorDao.getVendorsDao.mockResolvedValue([{ id: 1, payout_commission: 1 }]);
      payoutDao.updatePayoutDao.mockResolvedValueOnce({ id: 1, status: Status.APPROVED, approved_at: new Date().toISOString(), config: { urls: { notify: '' } } }); // first update
      payoutDao.updatePayoutDao.mockResolvedValueOnce({ id: 1, status: Status.APPROVED, approved_at: new Date().toISOString(), config: { urls: { notify: '' } } }); // second with commissions
      calculationDao.getCalculationforCronDao.mockResolvedValueOnce([{ id: 1 }]); // merchant
      calculationDao.getCalculationforCronDao.mockResolvedValueOnce([{ id: 2 }]); // vendor
      calculationDao.updateCalculationBalanceDao.mockResolvedValueOnce({});
      calculationDao.updateCalculationBalanceDao.mockResolvedValueOnce({});
      bankaccountDao.updateBankaccountDao.mockResolvedValue({});
      payoutDao.getPayoutsDao.mockResolvedValueOnce([{ status: Status.PENDING }]); // post check

      const result = await updatePayoutService(mockConn, { id: 1, company_id: 1 }, { status: Status.APPROVED, utr_id: 'utr123', bank_acc_id: 1, updated_by: 1 }, Role.ADMIN);
      expect(result).toEqual({ id: 1, status: Status.APPROVED, approved_at: expect.any(String), config: { urls: { notify: '' } } });
    });

    it('should update payout to rejected status', async () => {
      payoutDao.getPayoutsDao.mockResolvedValueOnce([{ id: 1, status: Status.PENDING, merchant_id: 1, bank_acc_id: 1, amount: 100, config: { urls: { notify: '' } } }]); // single
      merchantDao.getMerchantsDao.mockResolvedValue([{ user_id: 1, payout_commission: 1, config: { urls: { payout_notify: '' } } }]);
      bankaccountDao.getBankByIdDao.mockResolvedValue([{ user_id: 2, payin_count: 0, today_balance: 1000, balance: 1000, is_obsolete: false, is_blocked: false, config: { max_limit: 2000 } }]);
      vendorDao.getVendorsDao.mockResolvedValue([{ id: 1, payout_commission: 1 }]);
      payoutDao.updatePayoutDao.mockResolvedValue({ id: 1, status: Status.REJECTED, rejected_at: new Date().toISOString(), config: { urls: { notify: '' } } });
      payoutDao.getPayoutsDao.mockResolvedValueOnce([{ status: Status.PENDING }]); // post check

      const result = await updatePayoutService(mockConn, { id: 1, company_id: 1 }, { status: Status.REJECTED, config: { rejected_reason: 'reason' }, updated_by: 1 }, Role.ADMIN);
      expect(result).toEqual({ id: 1, status: Status.REJECTED, rejected_at: expect.any(String), config: { urls: { notify: '' } } });
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

  describe('walletsPayoutsService', () => {
    it('should return error if mode not provided', async () => {
      const result = await walletsPayoutsService(mockConn, { payOutids: [1] }, 1);
      expect(result).toEqual({ status: 400, message: 'Amount and TransactionType are required' });
    });

    it('should handle payout rejection', async () => {
      payoutDao.getPayoutBankDetailsDao.mockResolvedValue([{ id: 1, amount: 100, user_bank_details: { account_holder_name: 'Test', account_no: '123', bank_name: 'Bank', ifsc_code: 'IFSC' } }]);
      companyDao.getCompanyByIDDao.mockResolvedValue([{ config: { PAY_ASSIST: { walletsPayoutsUrl: 'url', walletsPayoutsAgent: 'agent', walletsPayoutsApiKey: 'key', walletsPayoutsAgentCode: 'code', defaultBankId: 1 } } }]);
      axios.post.mockResolvedValueOnce({ data: { ErrorCode: '14', Response: {} } });
      axios.post.mockResolvedValueOnce({ data: { ErrorCode: '14', Response: { message: 'Transaction Failed' } } });
      bankaccountDao.getBankByIdDao.mockResolvedValue([{ user_id: 1 }]);
      vendorDao.getVendorsDao.mockResolvedValue([{ id: 1 }]);
      payoutDao.updatePayoutDao.mockResolvedValue({ id: 1, status: Status.REJECTED });

      const result = await walletsPayoutsService(mockConn, { mode: 'IMPS', payOutids: [1], company_id: 1 }, 1);
      expect(result[0].status).toBe(Status.REJECTED);
    });

    it('should handle API error', async () => {
      payoutDao.getPayoutBankDetailsDao.mockResolvedValue([{ id: 1, amount: 100, user_bank_details: { account_holder_name: 'Test', account_no: '123', bank_name: 'Bank', ifsc_code: 'IFSC' } }]);
      companyDao.getCompanyByIDDao.mockResolvedValue([{ config: { PAY_ASSIST: { walletsPayoutsUrl: 'url', walletsPayoutsAgent: 'agent', walletsPayoutsApiKey: 'key', walletsPayoutsAgentCode: 'code', defaultBankId: 1 } } }]);
      axios.post.mockRejectedValue(new Error('API error'));
      const result = await walletsPayoutsService(mockConn, { mode: 'IMPS', payOutids: [1], company_id: 1 }, 1);
      expect(result[0].status).toBe(Status.REJECTED);
      expect(result[0].rejected_reason).toBe('API Request Failed');
    });
  });

  describe('getWalletsBalanceService', () => {
    it('should fetch balance successfully', async () => {
      companyDao.getCompanyByIDDao.mockResolvedValue([{ config: { PAY_ASSIST: { walletsPayoutsUrl: 'url', walletsPayoutsAgent: 'agent', walletsPayoutsApiKey: 'key' } } }]);
      axios.get.mockResolvedValue({ data: { Response: { Balance: 1000 } } });
      const result = await getWalletsBalanceService(1);
      expect(result).toEqual({ balance: 1000 });
    });

    it('should handle API error', async () => {
      companyDao.getCompanyByIDDao.mockResolvedValue([{ config: { PAY_ASSIST: { walletsPayoutsUrl: 'url', walletsPayoutsAgent: 'agent', walletsPayoutsApiKey: 'key' } } }]);
      axios.get.mockRejectedValue(new Error('API error'));
      await expect(getWalletsBalanceService(1)).rejects.toThrow('API error');
    });

    it('should fetch for different company', async () => {
      companyDao.getCompanyByIDDao.mockResolvedValue([{ config: { PAY_ASSIST: { walletsPayoutsUrl: 'url2', walletsPayoutsAgent: 'agent2', walletsPayoutsApiKey: 'key2' } } }]);
      axios.get.mockResolvedValue({ data: { Response: { Balance: 2000 } } });
      const result = await getWalletsBalanceService(2);
      expect(result).toEqual({ balance: 2000 });
    });
  });

  // payoutService.test.js (relevant section for tataPayPayoutsService)

  describe('tataPayPayoutsService', () => {
    const mockConn = {};
    const mockUpdatedBy = 'test-user';
    const mockRes = {};
    const mockPayload = {
      mode: 'NEFT',
      payOutids: [1, 2],
      company_id: 'company123',
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should return 400 if mode is missing', async () => {
      const invalidPayload = { ...mockPayload, mode: undefined };

      const result = await tataPayPayoutsService(mockConn, invalidPayload, mockUpdatedBy, mockRes);

      expect(result).toEqual({
        status: 400,
        message: 'Amount and TransactionType are required',
      });
    });

    test('should return 404 if no payouts are found', async () => {
      payoutDao.getPayoutBankDetailsDao.mockResolvedValue([]);

      const result = await tataPayPayoutsService(mockConn, mockPayload, mockUpdatedBy, mockRes);

      expect(result).toEqual({
        status: 404,
        message: 'Payout not found',
      });
      expect(payoutDao.getPayoutBankDetailsDao).toHaveBeenCalledWith(
        { payOutids: mockPayload.payOutids },
        mockPayload.company_id
      );
    });

    test('should handle API error for a single payout and return REJECTED status', async () => {
      const mockPayouts = [
        {
          id: 1,
          user_bank_details: {
            account_holder_name: 'John Doe',
            account_no: '1234567890',
            ifsc_code: 'IFSC1234',
            bank_name: 'Test Bank',
          },
          amount: 1000,
        },
      ];
      const mockCompany = [
        {
          config: {
            TATA_PAY: {
              walletsPayoutsApiKey: 'api-key',
              walletsPayoutsUrl: 'https://api.test.com',
              defaultBankId: 'bank123',
            },
          },
        },
      ];

      payoutDao.getPayoutBankDetailsDao.mockResolvedValue(mockPayouts);
      companyDao.getCompanyByIDDao.mockResolvedValue(mockCompany);
      axios.post.mockRejectedValue(new Error('API Error'));

      const result = await tataPayPayoutsService(mockConn, mockPayload, mockUpdatedBy, mockRes);

      expect(result).toEqual([
        {
          id: 1,
          status: Status.REJECTED,
          utr_id: null,
          rejected_reason: 'API Request Failed',
        },
      ]);
      expect(logger.error).toHaveBeenCalledWith(`Error processing payout 1:`, expect.any(Error));
    });

    test('should throw error for unexpected failure', async () => {
      const error = new Error('Unexpected error');
      payoutDao.getPayoutBankDetailsDao.mockRejectedValue(error);

      await expect(tataPayPayoutsService(mockConn, mockPayload, mockUpdatedBy, mockRes)).rejects.toThrow('Unexpected error');
      expect(logger.error).toHaveBeenCalledWith('Error in walletsPayoutsService:', error);
    });
  });

  describe('getTataPayBalanceService', () => {
    it('should fetch TataPay balance successfully', async () => {
      companyDao.getCompanyByIDDao.mockResolvedValue([{ config: { TATA_PAY: { walletsPayoutsUrl: 'url', walletsPayoutsApiKey: 'key' } } }]);
      axios.get.mockResolvedValue({ data: { user: { credit: 1000 } } });
      const result = await getTataPayBalanceService(1);
      expect(result).toEqual({ balance: 1000 });
    });

    it('should handle API error', async () => {
      companyDao.getCompanyByIDDao.mockResolvedValue([{ config: { TATA_PAY: { walletsPayoutsUrl: 'url', walletsPayoutsApiKey: 'key' } } }]);
      axios.get.mockRejectedValue(new Error('API error'));
      await expect(getTataPayBalanceService(1)).rejects.toThrow('API error');
    });

    it('should fetch for different company', async () => {
      companyDao.getCompanyByIDDao.mockResolvedValue([{ config: { TATA_PAY: { walletsPayoutsUrl: 'url2', walletsPayoutsApiKey: 'key2' } } }]);
      axios.get.mockResolvedValue({ data: { user: { credit: 2000 } } });
      const result = await getTataPayBalanceService(2);
      expect(result).toEqual({ balance: 2000 });
    });
  });
});