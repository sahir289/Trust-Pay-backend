import { Role, Status } from "../../constants";
import { logger } from "../../utils/logger";
import { getPayInForDisputeServiceDao, getPayInForResetDao, getPayInForTelegramResponseArrayDao, getPayInForTelegramResponseDao, getPayInForTelegramUtrDao, getPayInForUpdateDao, getPayInForUpdateServiceDao, getPayinsForServiccDao, getPayinsWithoutHistoryDao, updatePayInUrlDao } from "./payInDao";
import { merchantPayinCallback, merchantPayoutCallback } from '../../callBacksAndWebHook/merchantCallBacks.js';
import { getPayInUrlService , expirePayInUrlService , checkPayInStatusService , getPayInForCheckStatusDao , updatePaymentNotificationStatusService, updateDepositStatusService, resetDepositService, getPayinsBySearchService, telegramResponseService, disputeDuplicateTransactionService, processPayInService, telegramCheckUTRService, verifyPayinsService, generateUpiUrlService, updateCalculationTable, updatePayInService } from './payInService.js';
import { getMerchantByUserIdDao, getMerchantsDao } from '../../apis/merchants/merchantDao.js';
import { getPayoutsDao } from "../payOut/payOutDao.js";
import { getBankResponseDao, updateBankResponseDao, updateBotResponseDao } from "../bankResponse/bankResponseDao.js";
import { getBankaccountDao, getMerchantBankDao, updateBankaccountDao } from "../bankAccounts/bankaccountDao.js";
import { getVendorsDao } from "../vendors/vendorDao.js";
import { createResetHistoryService } from "../resetHistory/resetServices.js";
import { getUserHierarchysDao } from "../userHierarchy/userHierarchyDao.js";
import { getImageContentFromOCr, getTelegramFilePath, getTelegramImageBase64 } from "../../helpers/index.js";
import { sendAlreadyConfirmedMessageTelegramBot } from "../../utils/sendTelegramMessages.js";
import config from "../../config/config.js";
import { BadRequestError, InternalServerError, NotFoundError } from "../../utils/appErrors.js";
import { createCheckUtrService } from "../checkutr/checkUtrServices.js";
import { getAllUsersDao, getUserByIdDao } from "../users/userDao.js";
import { getAllCalculationforCronDao, getCalculationforCronDao, updateCalculationBalanceDao } from "../calculation/calculationDao.js";
import trackVendorsNetBalance from "../../utils/trackVendorsNetBalance.js";

/* eslint-disable no-unused-vars */
jest.mock('./payInDao');
jest.mock('../merchants/merchantDao');
jest.mock('../bankResponse/bankResponseDao');
jest.mock('../payOut/payOutDao');
jest.mock('../../callBacksAndWebHook/merchantCallBacks');
jest.mock('../../utils/logger');
jest.mock('../../utils/sendTelegramMessages');
jest.mock('../../helpers/index');
jest.mock('../checkutr/checkUtrServices');
jest.mock('../resetHistory/resetServices');
jest.mock('../userHierarchy/userHierarchyDao');
jest.mock('../company/companyDao');
jest.mock('../users/userDao');
jest.mock('../../utils/trackVendorsNetBalance');
jest.mock('../../utils/index');
jest.mock('../payIn/index', () => ({}));
// Mock app.js to prevent router initialization
jest.mock('../../app', () => ({}));
// Mock apis/index.js if it’s importing the router
jest.mock('../index', () => ({}));
describe('PayIn Services - Additional Test Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPayInUrlService - Additional Cases', () => {
    it('should throw InternalServerError when database query fails', async () => {
      getPayinsForServiccDao.mockRejectedValue(new Error('Database error'));

      await expect(getPayInUrlService('123', {}, true)).rejects.toThrow("InternalServerError");
      expect(logger.error).toHaveBeenCalledWith('Error get payin url:', expect.any(Error));
    });

    it('should handle payIn with missing config', async () => {
      const mockPayIn = {
        merchant_order_id: '123',
        is_url_expires: false,
        one_time_used: false,
        expiration_date: Date.now() + 10000,
        status: Status.INITIATED,
        config: null, // Missing config
      };
      getPayinsForServiccDao.mockResolvedValue(mockPayIn);

      const result = await getPayInUrlService('123', {}, true);

      expect(result).toEqual(mockPayIn);
      expect(merchantPayinCallback).not.toHaveBeenCalled();
    });

    it('should handle edge case with exact expiration time', async () => {
      const mockPayIn = {
        merchant_order_id: '123',
        is_url_expires: false,
        one_time_used: false,
        expiration_date: Date.now(),
        status: Status.PENDING,
        config: { urls: { notify: 'http://notify.url' } },
        id: 'payin123',
        amount: 100,
        utr: 'utr123',
      };
      getPayinsForServiccDao.mockResolvedValue(mockPayIn);
      updatePayInUrlDao.mockResolvedValue(mockPayIn);
      merchantPayinCallback.mockImplementation(() => Promise.resolve());

      await expect(getPayInUrlService('123', {}, true)).rejects.toThrow(InternalServerError);
      expect(updatePayInUrlDao).toHaveBeenCalledWith(
        '123',
        { is_url_expires: true, status: Status.DROPPED },
        {},
      );
    });
  });

  describe('expirePayInUrlService - Additional Cases', () => {
    it('should handle database failure during update', async () => {
      const mockPayIn = { id: 'payin123', config: {}, amount: 100, utr: 'utr123' };
      getPayinsForServiccDao.mockResolvedValue(mockPayIn);
      updatePayInUrlDao.mockRejectedValue(new Error('Update failed'));

      await expect(expirePayInUrlService('payin123')).rejects.toThrow(InternalServerError);
      expect(logger.error).toHaveBeenCalledWith('Error expire payin url:', expect.any(Error));
    });

    it('should handle payIn with no notify URL', async () => {
      const mockPayIn = {
        id: 'payin123',
        merchant_order_id: '123',
        config: { urls: {} }, // No notify URL
        amount: 100,
        utr: 'utr123',
      };
      getPayinsForServiccDao.mockResolvedValue(mockPayIn);
      updatePayInUrlDao.mockResolvedValue(mockPayIn);

      await expirePayInUrlService('payin123');

      expect(merchantPayinCallback).toHaveBeenCalledWith(undefined, expect.any(Object));
    });
  });

  describe('checkPayInStatusService - Additional Cases', () => {
    it('should handle missing bank_response_id', async () => {
      const mockMerchant = {
        id: 'merchant1',
        config: { keys: { private: 'privateKey' } },
      };
      const mockPayIn = {
        id: 'payin1',
        merchant_id: 'merchant1',
        merchant_order_id: 'order123',
        status: Status.SUCCESS,
        amount: 100,
        bank_response_id: null,
        user_submitted_utr: 'utr123',
        company_id: 'company1',
      };
      getMerchantsDao.mockResolvedValue([mockMerchant]);
      getPayInForCheckStatusDao.mockResolvedValue(mockPayIn);

      const result = await checkPayInStatusService('payin1', 'merchantCode', 'order123', 'privateKey');

      expect(result).toEqual({
        status: Status.SUCCESS,
        merchantOrderId: 'order123',
        amount: null,
        payinId: 'payin1',
        req_amount: 100,
        utr_id: 'utr123',
      });
    });

    it('should handle merchant config with no keys', async () => {
      const mockMerchant = { id: 'merchant1', config: {} };
      getMerchantsDao.mockResolvedValue([mockMerchant]);

      const result = await checkPayInStatusService('payin1', 'merchantCode', 'order123', 'invalidKey');

      expect(result).toEqual({
        status: 404,
        message: 'Enter valid Api key',
      });
    });
  });

  describe('updatePaymentNotificationStatusService - Additional Cases', () => {
    it('should handle payIn with no bank_response_id', async () => {
      const mockPayIn = {
        id: 'payin1',
        status: Status.SUCCESS,
        merchant_order_id: 'order123',
        amount: 100,
        bank_response_id: null,
        config: { urls: { notify: 'http://notify.url' } },
        user_submitted_utr: 'utr123',
        company_id: 'company1',
      };
      updatePayInUrlDao.mockResolvedValue(mockPayIn);
      merchantPayinCallback.mockResolvedValue({ success: true });

      const result = await updatePaymentNotificationStatusService('payin1', 'PAYIN', 'company1');

      expect(merchantPayinCallback).toHaveBeenCalledWith('http://notify.url', expect.objectContaining({
        amount: null,
        utr_id: 'utr123',
      }));
      expect(result).toEqual({ success: true });
    });

    it('should handle payout with missing notify URL', async () => {
      const mockPayout = {
        id: 'payout1',
        merchant_id: 'merchant1',
        merchant_order_id: 'order123',
        amount: 200,
        status: Status.SUCCESS,
        utr_id: 'utr456',
        payout_details: { urls: {} },
      };
      const mockMerchant = { id: 'merchant1', code: 'merchantCode' };
      getPayoutsDao.mockResolvedValue([mockPayout]);
      getMerchantsDao.mockResolvedValue([mockMerchant]);
      merchantPayoutCallback.mockResolvedValue({ success: true });

      const result = await updatePaymentNotificationStatusService('payout1', "PAYOUT", 'company1');

      expect(merchantPayoutCallback).toHaveBeenCalledWith(undefined, expect.any(Object));
      expect(result).toEqual({ success: true });
    });
  });

  describe('updateDepositStatusService - Additional Cases', () => {
    it('should handle bank response with null amount', async () => {
      const mockConn = {};
      const mockPayInData = {
        id: 'payin1',
        merchant_order_id: 'order123',
        status: Status.BANK_MISMATCH,
        amount: 100,
        created_at: new Date(),
        bank_response_id: 'bankRes1',
        merchant_id: 'merchant1',
        company_id: 'company1',
      };
      const mockMerchant = { id: 'merchant1', user_id: 'user1', payin_commission: 5 };
      const mockBankResponse = { id: 'bankRes1', amount: null, bank_id: 'bank1', utr: 'utr123', company_id: 'company1' };
      const mockBank = { id: 'bank1', user_id: 'vendor1' };
      getPayInForUpdateServiceDao.mockResolvedValue(mockPayInData);
      getMerchantsDao.mockResolvedValue([mockMerchant]);
      getBankResponseDao.mockResolvedValue(mockBankResponse);
      getBankaccountDao.mockResolvedValue([mockBank]);
      getVendorsDao.mockResolvedValue([{ user_id: 'vendor1', payin_commission: 3 }]);
      updatePayInUrlDao.mockResolvedValue({ ...mockPayInData, status: Status.DISPUTE });

      await updateDepositStatusService(mockConn, 'order123', 'nick', 'company1', 'updated_by');

      expect(updatePayInUrlDao).toHaveBeenCalledWith('payin1', expect.objectContaining({
        status: Status.DISPUTE,
      }), mockConn);
    });

    it('should handle vendor not found', async () => {
      const mockConn = {};
      const mockPayInData = {
        id: 'payin1',
        merchant_order_id: 'order123',
        status: Status.BANK_MISMATCH,
        amount: 100,
        created_at: new Date(),
        bank_response_id: 'bankRes1',
        merchant_id: 'merchant1',
        company_id: 'company1',
      };
      getPayInForUpdateServiceDao.mockResolvedValue(mockPayInData);
      getMerchantsDao.mockResolvedValue([{ id: 'merchant1', user_id: 'user1', payin_commission: 5 }]);
      getBankResponseDao.mockResolvedValue({ id: 'bankRes1', amount: 100, bank_id: 'bank1', utr: 'utr123', company_id: 'company1' });
      getBankaccountDao.mockResolvedValue([{ id: 'bank1', user_id: 'vendor1' }]);
      getVendorsDao.mockResolvedValue([]);

      await expect(updateDepositStatusService(mockConn, 'order123', 'nick', 'company1', 'updated_by')).rejects.toThrow(NotFoundError);
    });
  });

  describe('resetDepositService - Additional Cases', () => {
    it('should handle bank response not found', async () => {
      const mockConn = {};
      const mockPayIn = {
        id: 'payin1',
        merchant_order_id: 'order123',
        status: Status.IMG_PENDING,
        created_at: new Date(Date.now() - 5000),
        user_submitted_utr: 'utr123',
        bank_response_id: 'bankRes1',
        company_id: 'company1',
      };
      getPayInForResetDao.mockResolvedValue(mockPayIn);
      getBankResponseDao.mockResolvedValue(null);
      createResetHistoryService.mockResolvedValue({});
      updatePayInUrlDao.mockResolvedValue({ ...mockPayIn, status: Status.ASSIGNED });

      const result = await resetDepositService(mockConn, 'order123', 'company1', 'updated_by');

      expect(result.status).toBe(Status.ASSIGNED);
      expect(updateBotResponseDao).not.toHaveBeenCalled();
    });

    it('should throw error for expired payIn with non-resettable status', async () => {
      const mockConn = {};
      const mockPayIn = {
        id: 'payin1',
        merchant_order_id: 'order123',
        status: Status.FAILED,
        created_at: new Date(Date.now() - 15 * 60 * 1000),
      };
      getPayInForResetDao.mockResolvedValue(mockPayIn);

      await expect(resetDepositService(mockConn, 'order123', 'company1', 'updated_by')).rejects.toThrow(BadRequestError);
    });
  });

  describe('getPayinsBySearchService - Additional Cases', () => {
    it('should handle empty search terms', async () => {
      const mockFilters = { page: '1', limit: '10', search: '' };
      const mockUserHierarchy = [{ config: { siblings: { sub_merchants: ['sub1'] } } }];
      const mockMerchants = [{ id: 'm1' }, { id: 'm2' }];
      const mockData = { payins: [], total: 0 };
      getUserHierarchysDao.mockResolvedValue(mockUserHierarchy);
      getMerchantByUserIdDao.mockResolvedValue(mockMerchants);
      getPayinsWithoutHistoryDao.mockResolvedValue(mockData);

      const result = await getPayinsBySearchService(mockFilters, Role.MERCHANT, 'user1', Role.MERCHANT, false);

      expect(getPayinsWithoutHistoryDao).toHaveBeenCalledWith(
        { ...mockFilters, merchant_id: ['m1', 'm2'] },
        [],
        10,
        0,
        Role.MERCHANT,
        Role.MERCHANT,
      );
      expect(result).toEqual(mockData);
    });

    it('should handle database failure', async () => {
      const mockFilters = { page: '1', limit: '10' };
      getUserHierarchysDao.mockRejectedValue(new Error('DB error'));

      await expect(getPayinsBySearchService(mockFilters, Role.MERCHANT, 'user1', Role.MERCHANT, false)).rejects.toThrow(InternalServerError);
    });

    it('should handle vendor with no parent hierarchy', async () => {
      const mockFilters = { page: '1', limit: '10' };
      getUserHierarchysDao.mockResolvedValue([]);
      getBankaccountDao.mockResolvedValue([{ id: 'bank1' }]);

      const result = await getPayinsBySearchService(mockFilters, Role.VENDOR, 'user1', Role.VENDOR_OPERATIONS, false);

      expect(result).toEqual([]);
    });
  });

  describe('telegramResponseService - Additional Cases', () => {
    it('should handle OCR failure', async () => {
      const mockConn = {};
      const mockMessage = {
        photo: [{ file_id: 'file1' }],
        caption: 'order123',
        chat: { id: 123 },
        message_id: 456,
      };
      getTelegramFilePath.mockResolvedValue('path');
      getTelegramImageBase64.mockResolvedValue('base64');
      getImageContentFromOCr.mockRejectedValue(new Error('OCR failed'));

      await expect(telegramResponseService(mockConn, mockMessage)).rejects.toThrow(InternalServerError);
      expect(logger.error).toHaveBeenCalledWith('Error processing Telegram response:', expect.any(Error));
    });

    it('should handle multiple payIns with same UTR', async () => {
      const mockConn = {};
      const mockMessage = {
        photo: [{ file_id: 'file1' }],
        caption: 'order123',
        chat: { id: 123 },
        message_id: 456,
      };
      const mockContent = { utr: 'utr123', amount: 100 };
      const mockPayIn = {
        merchant_order_id: 'order123',
        amount: 100,
        status: Status.PENDING,
        user_submitted_utr: 'utr123',
        bank_response_id: null,
        company_id: 'company1',
      };
      const mockBankResponse = { id: 'bankRes1', utr: 'utr123', is_used: false };
      const mockOtherPayIns = [{ id: 'payin2', status: Status.SUCCESS }];
      getTelegramFilePath.mockResolvedValue('path');
      getTelegramImageBase64.mockResolvedValue('base64');
      getImageContentFromOCr.mockResolvedValue(mockContent);
      getPayInForTelegramResponseDao.mockResolvedValue(mockPayIn);
      getBankResponseDao.mockResolvedValue(mockBankResponse);
      getPayInForTelegramResponseArrayDao.mockResolvedValue(mockOtherPayIns);

      await telegramResponseService(mockConn, mockMessage);

      expect(sendAlreadyConfirmedMessageTelegramBot).toHaveBeenCalledWith(
        123,
        'utr123',
        config.telegramOcrBotToken,
        456,
        mockOtherPayIns,
        mockPayIn,
      );
    });
  });

  describe('disputeDuplicateTransactionService - Additional Cases', () => {
    it('should handle merchant order ID mismatch', async () => {
      const mockConn = {};
      const mockPayload = { payInId: 'payin1', merchantOrderId: 'order124', confirmed: true };
      const mockPayIn = {
        id: 'payin1',
        status: Status.DISPUTE,
        merchant_order_id: 'order123',
        amount: 100,
        bank_acc_id: 'bank1',
        bank_response_id: 'bankRes1',
        merchant_id: 'merchant1',
        company_id: 'company1',
      };
      getPayInForDisputeServiceDao.mockResolvedValue(mockPayIn);

      await expect(disputeDuplicateTransactionService(mockConn, mockPayload, 'company1', 'updated_by')).rejects.toThrow(BadRequestError);
    });

    it('should handle bank response with used status', async () => {
      const mockConn = {};
      const mockPayload = { payInId: 'payin1', confirmed: true };
      const mockPayIn = {
        id: 'payin1',
        status: Status.DISPUTE,
        merchant_order_id: 'order123',
        amount: 100,
        bank_acc_id: 'bank1',
        bank_response_id: 'bankRes1',
        merchant_id: 'merchant1',
        company_id: 'company1',
        user_submitted_utr: 'utr123',
      };
      const mockBankResponse = { id: 'bankRes1', amount: 100, utr: 'utr123', bank_id: 'bank1', is_used: true, company_id: 'company1' };
      getPayInForDisputeServiceDao.mockResolvedValue(mockPayIn);
      getBankResponseDao.mockResolvedValue(mockBankResponse);

      await disputeDuplicateTransactionService(mockConn, mockPayload, 'company1', 'updated_by');

      expect(updatePayInUrlDao).toHaveBeenCalledWith('payin1', expect.objectContaining({
        status: Status.SUCCESS,
      }));
    });
  });

  describe('telegramCheckUTRService - Additional Cases', () => {
    it('should handle payIn with existing bank response ID', async () => {
      const mockConn = {};
      const mockPayIn = {
        id: 'payin1',
        merchant_order_id: 'order123',
        amount: 100,
        status: Status.ASSIGNED,
        user_submitted_utr: null,
        bank_response_id: 'bankRes2',
        company_id: 'company1',
      };
      const mockBankResponse = { id: 'bankRes1', status: '/success', utr: 'utr123', company_id: 'company1' };
      const mockOtherBankResponse = { id: 'bankRes2', utr: 'utr456' };
      getBankResponseDao.mockResolvedValue(mockBankResponse);
      getPayInForTelegramUtrDao.mockResolvedValue(mockPayIn);
      getBankResponseDao.mockResolvedValueOnce(mockOtherBankResponse);
      createCheckUtrService.mockResolvedValue({});
      processPayInService.mockResolvedValue({ status: Status.SUCCESS });

      const result = await telegramCheckUTRService(mockConn, 'utr123', 'order123', 'company1', 'updated_by', Role.VENDOR);

      expect(result).toEqual({ status: Status.SUCCESS });
    });

    it('should handle invalid merchant order ID', async () => {
      getBankResponseDao.mockResolvedValue({ status: '/success' });
      getPayInForTelegramUtrDao.mockResolvedValue(null);

      await expect(telegramCheckUTRService({}, 'utr123', 'order123', 'company1', 'updated_by', Role.VENDOR)).rejects.toThrow(NotFoundError);
    });
  });

  describe('verifyPayinsService - Additional Cases', () => {
    it('should handle missing user data', async () => {
      const mockPayIn = {
        id: 'payin1',
        merchant_order_id: 'order123',
        expiration_date: Date.now() + 10000,
        amount: 100,
        one_time_used: false,
        status: Status.INITIATED,
        config: { urls: { return: 'return.url' } },
        merchant_id: 'merchant1',
        created_by: 'user1',
        company_id: 'company1',
      };
      getPayInUrlService.mockResolvedValue(mockPayIn);
      getUserByIdDao.mockResolvedValue([]);
      getMerchantsDao.mockResolvedValue([{ min_payin: 50, max_payin: 500, id: 'merchant1' }]);
      getMerchantBankDao.mockResolvedValue([{ is_qr: true, is_enabled: true, bank_used_for: 'PayIn' }]);
      updatePayInUrlDao.mockResolvedValue(mockPayIn);

      const result = await verifyPayinsService({}, 'order123', 'user_location', false);

      expect(result.isAdmin).toBe(false);
    });

    it('should handle no enabled banks', async () => {
      const mockPayIn = {
        id: 'payin1',
        merchant_order_id: 'order123',
        expiration_date: Date.now() + 10000,
        amount: 100,
        one_time_used: false,
        status: Status.INITIATED,
        config: { urls: { return: 'return.url' } },
        merchant_id: 'merchant1',
        created_by: 'user1',
        company_id: 'company1',
      };
      getPayInUrlService.mockResolvedValue(mockPayIn);
      getMerchantsDao.mockResolvedValue([{ min_payin: 50, max_payin: 500, id: 'merchant1' }]);
      getMerchantBankDao.mockResolvedValue([]);
      getUserByIdDao.mockResolvedValue([{ role: Role.ADMIN }]);
      updatePayInUrlDao.mockResolvedValue(mockPayIn);

      const result = await verifyPayinsService({}, 'order123', 'user_location', false);

      expect(result).toEqual(expect.objectContaining({
        is_qr: false,
        is_phonepay: false,
        is_bank: false,
      }));
    });
  });

  describe('generateUpiUrlService - Additional Cases', () => {
    it('should handle optional fields in payload', async () => {
      const mockPayload = {
        amount: 100,
        payeeVPA: 'test@paytm',
        payeeName: 'Test',
        transactionNote: 'Payment',
        merchantCode: 'MC123',
        businessName: 'TestCorp',
        mode: '02',
        purpose: '00',
      };
      const result = await generateUpiUrlService(mockPayload);

      expect(result.phonepeUrl).toContain('mc=MC123');
      expect(result.phonepeUrl).toContain('bn=TestCorp');
      expect(result.phonepeUrl).toContain('mode=02');
      expect(result.phonepeUrl).toContain('purpose=00');
    });

    it('should handle minimal payload', async () => {
      const mockPayload = { amount: 100, payeeVPA: 'test@paytm' };
      const result = await generateUpiUrlService(mockPayload);

      expect(result.phonepeUrl).toContain('pn=');
      expect(result.phonepeUrl).toContain('tn=');
    });
  });

  describe('updateCalculationTable - Additional Cases', () => {
    it('should handle negative commission', async () => {
      const mockConn = {};
      const mockCalculationData = [{ id: 'calc1' }];
      getCalculationforCronDao.mockResolvedValue(mockCalculationData);
      updateCalculationBalanceDao.mockResolvedValue({ current_balance: -5 });
      trackVendorsNetBalance.mockResolvedValue();

      await updateCalculationTable('user1', { amount: 100, payinCommission: -5 }, mockConn);

      expect(updateCalculationBalanceDao).toHaveBeenCalledWith({ id: 'calc1' }, expect.objectContaining({
        total_payin_commission: -5,
        current_balance: 105,
      }), mockConn);
    });

    it('should handle zero amount', async () => {
      const mockConn = {};
      const mockCalculationData = [{ id: 'calc1' }];
      getCalculationforCronDao.mockResolvedValue(mockCalculationData);
      updateCalculationBalanceDao.mockResolvedValue({ current_balance: 0 });
      trackVendorsNetBalance.mockResolvedValue();

      await updateCalculationTable('user1', { amount: 0, payinCommission: 0 }, mockConn);

      expect(updateCalculationBalanceDao).toHaveBeenCalledWith({ id: 'calc1' }, expect.objectContaining({
        total_payin_amount: 0,
        total_payin_commission: 0,
        current_balance: 0,
      }), mockConn);
    });
  });

  describe('updatePayInService - Additional Cases', () => {
    it('should handle invalid config JSON', async () => {
      const mockConn = {};
      const mockPayload = { amount: 150 };
      const mockPayIn = {
        id: 'payin1',
        merchant_order_id: 'order123',
        approved_at: new Date(),
        amount: 100,
        payin_merchant_commission: 5,
        payin_vendor_commission: 3,
        config: 'invalid_json', // Invalid JSON
        user_submitted_utr: null,
        bank_acc_id: 'bank1',
        company_id: 'company1',
      };
      const mockBankResponse = {
        id: 'bankRes1',
        amount: 100,
        bank_id: 'bank1',
        created_at: new Date(),
        utr: 'utr123',
        company_id: 'company1',
      };
      getPayInForUpdateDao.mockResolvedValue(mockPayIn);
      getBankResponseDao.mockResolvedValue(mockBankResponse);
      getAllUsersDao.mockResolvedValue([{ user_name: 'testUser' }]);
      getBankaccountDao.mockResolvedValue([{ id: 'bank1', balance: 0, today_balance: 0, user_id: 'vendor1' }]);
      getVendorsDao.mockResolvedValue([{ user_id: 'vendor1', balance: 0, payin_commission: 3 }]);
      getMerchantsDao.mockResolvedValue([{ user_id: 'merchant1', payin_commission: 5 }]);
      getAllCalculationforCronDao.mockResolvedValue([{ id: 'calc1', created_at: new Date() }]);
      updatePayInUrlDao.mockResolvedValue({ ...mockPayIn, amount: 150 });

      const result = await updatePayInService(mockConn, mockPayload, 'order123', 'user1', 'company1');

      expect(result).toEqual(expect.objectContaining({
        config: expect.objectContaining({
          history: expect.any(Array),
        }),
      }));
    });

    it('should handle bank_acc_id update with same vendor', async () => {
      const mockConn = {};
      const mockPayload = { bank_acc_id: 'bank2' };
      const mockPayIn = {
        id: 'payin1',
        merchant_order_id: 'order123',
        approved_at: new Date(),
        amount: 100,
        payin_merchant_commission: 5,
        payin_vendor_commission: 3,
        config: '{}',
        user_submitted_utr: null,
        bank_acc_id: 'bank1',
        bank_response_id: 'bankRes1',
        company_id: 'company1',
      };
      const mockBankResponse = {
        id: 'bankRes1',
        amount: 100,
        bank_id: 'bank1',
        created_at: new Date(),
        utr: 'utr123',
        company_id: 'company1',
      };
      getPayInForUpdateDao.mockResolvedValue(mockPayIn);
      getBankResponseDao.mockResolvedValue(mockBankResponse);
      getAllUsersDao.mockResolvedValue([{ user_name: 'testUser' }]);
      getBankaccountDao
        .mockResolvedValueOnce([{ id: 'bank1', user_id: 'vendor1', balance: 100, today_balance: 100 }])
        .mockResolvedValueOnce([{ id: 'bank2', user_id: 'vendor1', balance: 0, today_balance: 0 }]);
      getVendorsDao.mockResolvedValue([{ user_id: 'vendor1', balance: 0, payin_commission: 3 }]);
      getMerchantsDao.mockResolvedValue([{ user_id: 'merchant1', payin_commission: 5 }]);
      updateBankaccountDao.mockResolvedValue({ balance: 0, today_balance: 0 });
      updateBankResponseDao.mockResolvedValue({});
      updatePayInUrlDao.mockResolvedValue({ ...mockPayIn, bank_acc_id: 'bank2' });

      const result = await updatePayInService(mockConn, mockPayload, 'order123', 'user1', 'company1');

      expect(updateBankaccountDao).toHaveBeenCalledTimes(2);
      expect(result.bank_acc_id).toBe('bank2');
    });
  });

  

});