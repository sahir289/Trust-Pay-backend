// -------------------- ESM MOCKS --------------------
/* global describe, it, expect, beforeEach, beforeAll */
import { jest } from '@jest/globals';
jest.unstable_mockModule('../../src/constants/index.js', () => ({
  BankTypes: { BANK_TRANSFER: 'BANK_TRANSFER', UPI: 'UPI', PHONE_PE: 'PHONE_PE', INTENT: 'INTENT' },
  Currency: { INR: 'INR' },
  Role: { ADMIN: 'ADMIN', MERCHANT: 'MERCHANT' },
  Status: { INITIATED: 'INITIATED', ASSIGNED: 'ASSIGNED', DROPPED: 'DROPPED', DUPLICATE: 'DUPLICATE', IMG_PENDING: 'IMG_PENDING', FAILED: 'FAILED' },
  Type: { PAYIN: 'PAYIN', PAYOUT: 'PAYOUT' },
  tableName: { PAYIN: 'Payin', MERCHANT: 'Merchant' },
  columns: { Payin: { id: 'id', merchant_id: 'merchant_id', company_id: 'company_id', amount: 'amount', status: 'status', bank_response_id: 'bank_response_id', config: 'config', merchant_order_id: 'merchant_order_id', user_submitted_utr: 'user_submitted_utr' } },
  merchantColumns: { id: 'id', code: 'code', company_id: 'company_id', config: 'config', min_payin: 'min_payin', max_payin: 'max_payin' },
  vendorColumns: { id: 'id', code: 'code', company_id: 'company_id', config: 'config', min_payin: 'min_payin', max_payin: 'max_payin' },
  unblocked_countries: ['IND'],
  AccessRoles: {
    ADMIN: {
      GET: [
        'ADMIN',
        'TRANSACTIONS',
        'MERCHANT_ADMIN',
        'MERCHANT',
        'VENDOR',
        'VENDOR_ADMIN',
        'SUB_VENDOR',
      ],
      CREATE_DELETE: ['ADMIN', 'TRANSACTIONS', 'MERCHANT'],
      UPDATE_READ: [
        'ADMIN',
        'TRANSACTIONS',
        'MERCHANT_ADMIN',
        'MERCHANT',
        'VENDOR',
        'VENDOR_ADMIN',
        'SUB_VENDOR',
      ],
    },
    MERCHANT: {
      GET: [
        'MERCHANT',
        'TRANSACTIONS',
        'MERCHANT_ADMIN',
        'MERCHANT',
        'VENDOR',
        'VENDOR_ADMIN',
        'SUB_VENDOR',
      ],
      CREATE_DELETE: ['ADMIN', 'TRANSACTIONS', 'MERCHANT'],
      UPDATE_READ: [
        'ADMIN',
        'TRANSACTIONS',
        'MERCHANT_ADMIN',
        'MERCHANT',
        'VENDOR',
        'VENDOR_ADMIN',
        'SUB_VENDOR',
      ],
    },
    VENDOR: {
      GET: [
        'VENDOR',
        'TRANSACTIONS',
        'MERCHANT_ADMIN',
        'MERCHANT',
        'VENDOR',
        'VENDOR_ADMIN',
        'SUB_VENDOR',
      ],
      CREATE_DELETE: ['ADMIN', 'TRANSACTIONS', 'MERCHANT'],
      UPDATE_READ: [
        'ADMIN',
        'TRANSACTIONS',
        'MERCHANT_ADMIN',
        'MERCHANT',
        'VENDOR',
        'VENDOR_ADMIN',
        'SUB_VENDOR',
      ],
    },
    CHARGE_BACK: {
      GET: [
        'ADMIN',
        'TRANSACTIONS',
        'MERCHANT_ADMIN',
        'MERCHANT',
        'VENDOR',
        'VENDOR_ADMIN',
        'SUB_VENDOR',
      ],
      CREATE_DELETE: ['ADMIN', 'TRANSACTIONS', 'MERCHANT'],
      UPDATE_READ: [
        'ADMIN',
        'TRANSACTIONS',
        'MERCHANT_ADMIN',
        'MERCHANT',
        'VENDOR',
        'VENDOR_ADMIN',
        'SUB_VENDOR',
      ],
    },
    USER_HIERARCHY: {
      GET: [
        'ADMIN',
        'TRANSACTIONS',
        'MERCHANT_ADMIN',
        'MERCHANT',
        'VENDOR',
        'VENDOR_ADMIN',
        'SUB_VENDOR',
      ],
      CREATE_DELETE: ['ADMIN', 'TRANSACTIONS'],
      UPDATE_READ: [
        'ADMIN',
        'TRANSACTIONS',
        'MERCHANT_ADMIN',
        'MERCHANT',
        'VENDOR',
        'VENDOR_ADMIN',
        'SUB_VENDOR',
      ],
    },
  },
  DesignationIs: { SUPER_ADMIN: 'SUPER_ADMIN', ADMIN: 'ADMIN', MERCHANT: 'MERCHANT', VENDOR: 'VENDOR' },
  RoleIs: { SUPER_ADMIN: 'SUPER_ADMIN', ADMIN: 'ADMIN', MERCHANT: 'MERCHANT', VENDOR: 'VENDOR' },
  Method: { GET: 'GET', POST: 'POST' },
  payAssistErrorCodeMap: { 'ERR001': 'Invalid UTR', 'ERR002': 'Amount Mismatch', 'ERR003': 'Bank Not Assigned' },
}));
jest.unstable_mockModule('dayjs', () => {
  const dayjsMock = jest.fn(() => ({ add: jest.fn(() => ({ toISOString: jest.fn(() => '2026-01-01T00:00:00.000Z') })) }));
  dayjsMock.extend = jest.fn();
  dayjsMock.default = dayjsMock;
  return dayjsMock;
});
jest.unstable_mockModule('nanoid', () => ({ 
  nanoid: jest.fn(() => 'ABCDE'),
  customAlphabet: jest.fn(() => jest.fn(() => 'ABCDE')),
}));
jest.unstable_mockModule('uuid', () => ({ v4: jest.fn(() => 'uuid-123') }));
jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), log: jest.fn() },
}));
jest.unstable_mockModule('../../src/utils/index.js', () => ({
  stringifyJSON: jest.fn((x) => JSON.stringify(x)),
  multerUpload: { single: jest.fn(() => (req, res, next) => next()) },
}));
jest.unstable_mockModule('../../src/utils/sockets.js', () => ({ 
  newTableEntry: jest.fn(), 
  forceLogoutUser: jest.fn(), 
  logOutUser: jest.fn(),
  notifyBankResponseAccessUpdate: jest.fn(),
  deactivateBank: jest.fn(),
}));
jest.unstable_mockModule('../../src/cashfree/cashfree.js', () => ({
  createCashfreeOrder: jest.fn(),
  payOrder: jest.fn(),
}));
jest.unstable_mockModule('../../src/razorpay/razorpay.js', () => ({ 
    createRazorPayOrder: jest.fn(),
    verifyRazorPaySignature: jest.fn(), 
}));
jest.unstable_mockModule('../../src/intent/createIntentTransaction.js', () => ({
  createPaymentTransaction: jest.fn(),
  generateHash: jest.fn(),
}));

jest.unstable_mockModule('../../src/intent/createSilkIntentTransaction.js', () => ({
  createSilkPaymentTransaction: jest.fn(),
  generateSign: jest.fn(),
}));

jest.unstable_mockModule('../../src/intent/createOnePayIntentTransaction.js', () => ({
  createOnePayPaymentTransaction: jest.fn(),
  generateSign: jest.fn(),
}));

jest.unstable_mockModule('../../src/intent/createCpsIntentTransaction.js', () => ({
  createCpsPaymentTransaction: jest.fn(),
  generateSign: jest.fn(),
}));

jest.unstable_mockModule('../../src/intent/createtytlPayIntentTransaction.js', () => ({
  createtytlPaymentTransaction: jest.fn(),
}));

jest.unstable_mockModule('../../src/intent/createPayeasyIntentTransaction.js', () => ({
  createPayeasyTransaction: jest.fn(),
}));

jest.unstable_mockModule('../../src/intent/createAlbeCollectIntentTransaction.js', () => ({
  createAlbeCollectTransaction: jest.fn(),
  generateAlbeCollectHash: jest.fn(),
}));

// -------------------- IMPORTS ----------------------
let service, merchantDao, payInDao, companyDao, loggerModule, bankaccountDao, vendorDao, payoutDao, bankResponseDao, callbacks, createIntentTransaction, redishashkey, helpers, sendTelegramMessages;
beforeAll(async () => {
  service = await import('../../src/apis/payIn/payInService.js');
  merchantDao = await import('../../src/apis/merchants/merchantDao.js');
  payInDao = await import('../../src/apis/payIn/payInDao.js');
  companyDao = await import('../../src/apis/company/companyDao.js');
  loggerModule = await import('../../src/utils/logger.js');
  bankaccountDao = await import('../../src/apis/bankAccounts/bankaccountDao.js');
  vendorDao = await import('../../src/apis/vendors/vendorDao.js');
  payoutDao = await import('../../src/apis/payOut/payOutDao.js');
  bankResponseDao = await import('../../src/apis/bankResponse/bankResponseDao.js');
  callbacks = await import('../../src/callBacksAndWebHook/merchantCallBacks.js');
  createIntentTransaction = await import('../../src/intent/createIntentTransaction.js');
  redishashkey = await import('../../src/utils/redishashkey.js');
  helpers = await import('../../src/helpers/index.js');
  sendTelegramMessages = await import('../../src/utils/sendTelegramMessages.js');
});


// -------------------- SETUP & TEARDOWN -------------
beforeEach(() => {
  // Reassign all mock functions for isolation
  if (merchantDao) {
    merchantDao.getMerchantsByCodeDao = jest.fn();
    merchantDao.getMerchantBankDao = jest.fn();
    merchantDao.getMerchantsDao = jest.fn();
    merchantDao.getMerchantForNotifyDao = jest.fn();
  }
  if (payInDao) {
    payInDao.getPayInForCheckStatusDao = jest.fn();
    payInDao.getPayInIntentDao = jest.fn();
    payInDao.updatePayInUrlDao = jest.fn();
    payInDao.getPayInForUpdateServiceDao = jest.fn();
    payInDao.getPayInPendingDao = jest.fn();
    payInDao.getPayinsForServiceDao = jest.fn();
    payInDao.getPayInForResetDao = jest.fn();
    payInDao.getPayInForDisputeServiceDao = jest.fn();
    payInDao.getPayinsSumAndCountByStatusDao = jest.fn();
    payInDao.getPayinsForServiccDao = jest.fn();
  }
  if (companyDao) {
    companyDao.getCompanyByIDDao = jest.fn();
  }
  if (loggerModule?.logger) {
    loggerModule.logger.error = jest.fn();
    loggerModule.logger.info = jest.fn();
    loggerModule.logger.warn = jest.fn();
    loggerModule.logger.log = jest.fn();
  }
  if (bankaccountDao) {
    bankaccountDao.getBankaccountDao = jest.fn();
  }
  if (vendorDao) {
    vendorDao.getVendorsDao = jest.fn();
  }
  if (payoutDao) {
    payoutDao.getPayoutsNotifyDao = jest.fn();
  }
  if (bankResponseDao) {
    bankResponseDao.getBankResponseDao = jest.fn();
    bankResponseDao.getBankResponsePayinDao = jest.fn();
  }
  if (callbacks) {
    callbacks.merchantPayinCallback = jest.fn();
  }
  if (createIntentTransaction) {
    createIntentTransaction.createPaymentTransaction = jest.fn();
  }
  if (redishashkey) {
    redishashkey.get = jest.fn();
    redishashkey.set = jest.fn();
    redishashkey.setIfNotExists = jest.fn();
    redishashkey.delete = jest.fn();
    redishashkey.buildAuthSessionCacheKey = jest.fn();
    redishashkey.generateCacheKey = jest.fn();
    redishashkey.getCachedData = jest.fn();
  }
  if (helpers) {
    helpers.someHelperFunction = jest.fn();
    helpers.getImageContentFromOCr = jest.fn();
    helpers.getTelegramFilePath = jest.fn();
    helpers.getTelegramImageBase64 = jest.fn();
  }
  if (sendTelegramMessages) {
    sendTelegramMessages.send = jest.fn();
    sendTelegramMessages.sendErrorMessageNoMerchantOrderIdFoundTelegramBot = jest.fn();
  }
  jest.clearAllMocks();
});

// -------------------- TESTS ------------------------
describe('payinService', () => {
  describe('generatePayInUrlByHashService', () => {
    it('should return 400 if missing params', async () => {
      const req = { query: {}, user: {} };
      const result = await service.generatePayInUrlByHashService(req);
      expect(result.status).toBe(400);
    });
    it('should return 404 if merchant not found', async () => {
      const req = { query: { user_id: 1, code: 'c', ot: 'ot' }, user: {} };
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([]);
      const result = await service.generatePayInUrlByHashService(req);
      expect(result.status).toBe(404);
    });
    // it('should return payInUrl on success', async () => {
    //   const req = { query: { user_id: 1, code: 'c', ot: 'ot', key: 'k' }, user: { role_id: 1, role: 'ADMIN' }, headers: {} };
    //   merchantDao.getMerchantsByCodeDao.mockResolvedValue([{ id: 1, company_id: 1, config: {} }]);
    //   const bankAssigned = [{ is_enabled: true, is_qr: true, is_bank: false, config: {} }];
    //   merchantDao.getMerchantBankDao.mockResolvedValue(bankAssigned);
    //   companyDao.getCompanyByIDDao.mockResolvedValue([{ config: { telegramBankAlertChatId: 'chatid' } }]);
    //   const result = await service.generatePayInUrlByHashService(req);
    //   expect(result.payInUrl).toBeDefined();
    // });
    it('should log and throw on error', async () => {
      const req = { query: { user_id: 1, code: 'c', ot: 'ot', key: 'k' }, user: { role_id: 1, role: 'ADMIN' }, headers: {} };
      merchantDao.getMerchantsByCodeDao.mockRejectedValue(new Error('fail'));
      await expect(service.generatePayInUrlByHashService(req)).rejects.toThrow('fail');
    });
  });

  describe('generatePayInUrlService', () => {
    it('should return 400 if merchant not found', async () => {
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([]);
      const result = await service.generatePayInUrlService({ code: 'c' }, 'ADMIN');
      expect(result.status).toBe(400);
    });
    it('should return 404 if no banks assigned', async () => {
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([{ id: 1, company_id: 1, config: {} }]);
      merchantDao.getMerchantBankDao.mockResolvedValue([]);
      companyDao.getCompanyByIDDao.mockResolvedValue([{ config: {} }]);
      const result = await service.generatePayInUrlService({ code: 'c' }, 'ADMIN');
      expect(result.status).toBe(404);
    });
    it('should throw and log on error', async () => {
      merchantDao.getMerchantsByCodeDao.mockRejectedValue(new Error('fail'));
      await expect(service.generatePayInUrlService({ code: 'c' }, 'ADMIN')).rejects.toThrow('fail');
    });
  });

  describe('checkPayInStatusService', () => {
    it('should return 400 if merchant not found', async () => {
      merchantDao.getMerchantsDao.mockResolvedValue([]);
      const result = await service.checkPayInStatusService(1, 'code', 'order', 'key');
      expect(result.status).toBe(400);
    });
    it('should return 404 if api_key invalid', async () => {
      merchantDao.getMerchantsDao.mockResolvedValue([{ id: 1, config: { keys: { private: 'a', public: 'b' } } }]);
      const result = await service.checkPayInStatusService(1, 'code', 'order', 'badkey');
      expect(result.status).toBe(404);
    });
    it('should return 404 if payIn not found', async () => {
      merchantDao.getMerchantsDao.mockResolvedValue([{ id: 1, config: { keys: { private: 'key', public: 'key' } } }]);
      payInDao.getPayInForCheckStatusDao.mockResolvedValue(undefined);
      const result = await service.checkPayInStatusService(1, 'code', 'order', 'key');
      expect(result.status).toBe(404);
    });
    it('should return 404 if merchant mismatch', async () => {
      merchantDao.getMerchantsDao.mockResolvedValue([{ id: 1, config: { keys: { private: 'key', public: 'key' } } }]);
      payInDao.getPayInForCheckStatusDao.mockResolvedValue({ merchant_id: 2 });
      const result = await service.checkPayInStatusService(1, 'code', 'order', 'key');
      expect(result.status).toBe(404);
    });
    it('should return status and details on success', async () => {
      merchantDao.getMerchantsDao.mockResolvedValue([{ id: 1, config: { keys: { private: 'key', public: 'key' } } }]);
      payInDao.getPayInForCheckStatusDao.mockResolvedValue({ merchant_id: 1, status: 'SUCCESS', id: 1, merchant_order_id: 'order', amount: 100 });
      const result = await service.checkPayInStatusService(1, 'code', 'order', 'key');
      expect(result.status).toBeDefined();
    });
    it('should log and throw on error', async () => {
      merchantDao.getMerchantsDao.mockRejectedValue(new Error('fail'));
      await expect(service.checkPayInStatusService(1, 'code', 'order', 'key')).rejects.toThrow('fail');
    });
  });

  describe('payInIntentGenerateOrderService', () => {
    it('should throw if no handler for provider', async () => {
      payInDao.getPayInIntentDao.mockResolvedValue({});
      await expect(service.payInIntentGenerateOrderService('id', 100, 'unknown')).rejects.toThrow();
    });
    it('should throw if no session_id returned', async () => {
      payInDao.getPayInIntentDao.mockResolvedValue({});
      createIntentTransaction.createPaymentTransaction.mockResolvedValue({});
      await expect(service.payInIntentGenerateOrderService('id', 100, 'ZenTechInd')).rejects.toThrow();
    });
    it('should return session_id for valid provider', async () => {
      payInDao.getPayInIntentDao.mockResolvedValue({ id: 1, config: { urls: { return: '' } } });
      createIntentTransaction.createPaymentTransaction.mockResolvedValue({ payment_url: 'url' });
      const result = await service.payInIntentGenerateOrderService('id', 100, 'ZenTechInd');
      expect(result.session_id).toBe('url');
    });
    it('should log and throw on error', async () => {
      payInDao.getPayInIntentDao.mockRejectedValue(new Error('fail'));
      await expect(service.payInIntentGenerateOrderService('id', 100, 'ZenTechInd')).rejects.toThrow('fail');
    });
  });

  describe('updatePaymentNotificationStatusService', () => {
    it('should throw if type is invalid', async () => {
      await expect(service.updatePaymentNotificationStatusService(1, 'INVALID', 1)).rejects.toThrow();
    });
    it('should throw if payIn not found for PAYIN', async () => {
      payInDao.updatePayInUrlDao.mockResolvedValue(undefined);
      await expect(service.updatePaymentNotificationStatusService(1, 'PAYIN', 1)).rejects.toThrow();
    });
    it('should throw if payout not found for PAYOUT', async () => {
      payoutDao.getPayoutsNotifyDao.mockResolvedValue([]);
      await expect(service.updatePaymentNotificationStatusService(1, 'PAYOUT', 1)).rejects.toThrow();
    });
    it('should throw if merchant not found for PAYOUT', async () => {
      payoutDao.getPayoutsNotifyDao.mockResolvedValue([{ merchant_id: 1 }]);
      merchantDao.getMerchantForNotifyDao.mockResolvedValue([]);
      await expect(service.updatePaymentNotificationStatusService(1, 'PAYOUT', 1)).rejects.toThrow();
    });
    it('should call merchantPayinCallback for PAYIN', async () => {
      payInDao.updatePayInUrlDao.mockResolvedValue({ id: 1, bank_response_id: 2, config: { urls: { notify: 'url' } }, status: 'SUCCESS', merchant_order_id: 'order', amount: 100, user_submitted_utr: 'utr' });
      bankResponseDao.getBankResponseDao.mockResolvedValue({ amount: 100, utr: 'utr' });
      callbacks.merchantPayinCallback.mockResolvedValue('ok');
      const result = await service.updatePaymentNotificationStatusService(1, 'PAYIN', 1);
      expect(result).toBe('ok');
    });
  });

  // Example for assignedBankToPayInUrlService:
  describe('assignedBankToPayInUrlService', () => {
    it('should throw if payIn is not found', async () => {
      const actual = await import('../../src/apis/payIn/payInService.js');
      jest.unstable_mockModule('../../src/apis/payIn/payInService.js', () => ({
        ...actual,
        getPayInUrlService: jest.fn().mockResolvedValue(undefined),
      }));
      const service = await import('../../src/apis/payIn/payInService.js');
      await expect(service.assignedBankToPayInUrlService('id', 100, 'UPI')).rejects.toThrow('Payment Url is incorrect');
    });

    it('should throw if payIn status is not INITIATED or ASSIGNED', async () => {
      const actual = await import('../../src/apis/payIn/payInService.js');
      jest.unstable_mockModule('../../src/apis/payIn/payInService.js', () => ({
        ...actual,
        getPayInUrlService: jest.fn().mockResolvedValue({ status: 'CONFIRMED' }),
      }));
      const service = await import('../../src/apis/payIn/payInService.js');
      await expect(service.assignedBankToPayInUrlService('id', 100, 'UPI')).rejects.toThrow();
    });

    it('should throw if merchant not found', async () => {
      const actual = await import('../../src/apis/payIn/payInService.js');
      jest.unstable_mockModule('../../src/apis/payIn/payInService.js', () => ({
        ...actual,
        getPayInUrlService: jest.fn().mockResolvedValue({ status: 'INITIATED', merchant_id: 1 }),
      }));
      const service = await import('../../src/apis/payIn/payInService.js');
      const { getMerchantsDao } = await import('../../src/apis/merchants/merchantDao.js');
      getMerchantsDao.mockResolvedValue([]);
      await expect(service.assignedBankToPayInUrlService('id', 100, 'UPI')).rejects.toThrow();
    });

    it('should throw if amount is out of range and not admin', async () => {
      const actual = await import('../../src/apis/payIn/payInService.js');
      jest.unstable_mockModule('../../src/apis/payIn/payInService.js', () => ({
        ...actual,
        getPayInUrlService: jest.fn().mockResolvedValue({ status: 'INITIATED', merchant_id: 1 }),
      }));
      const service = await import('../../src/apis/payIn/payInService.js');
      const { getMerchantsDao } = await import('../../src/apis/merchants/merchantDao.js');
      getMerchantsDao.mockResolvedValue([{ min_payin: 10, max_payin: 20 }]);
      await expect(service.assignedBankToPayInUrlService('id', 1000, 'UPI')).rejects.toThrow();
    });

    it('should throw if no bank found with valid amount', async () => {
      const actual = await import('../../src/apis/payIn/payInService.js');
      jest.unstable_mockModule('../../src/apis/payIn/payInService.js', () => ({
        ...actual,
        getPayInUrlService: jest.fn().mockResolvedValue({ status: 'INITIATED', merchant_id: 1, company_id: 1 }),
      }));
      const service = await import('../../src/apis/payIn/payInService.js');
      const { getMerchantsDao } = await import('../../src/apis/merchants/merchantDao.js');
      getMerchantsDao.mockResolvedValue([{ min_payin: 1, max_payin: 100, id: 1 }]);
      merchantDao.getMerchantBankDao.mockResolvedValue([]);
      await expect(service.assignedBankToPayInUrlService('id', 50, 'UPI')).rejects.toThrow();
    });

    it('should throw if no enabled bank found', async () => {
      const actual = await import('../../src/apis/payIn/payInService.js');
      jest.unstable_mockModule('../../src/apis/payIn/payInService.js', () => ({
        ...actual,
        getPayInUrlService: jest.fn().mockResolvedValue({ status: 'INITIATED', merchant_id: 1, company_id: 1 }),
      }));
      const service = await import('../../src/apis/payIn/payInService.js');
      const { getMerchantsDao } = await import('../../src/apis/merchants/merchantDao.js');
      getMerchantsDao.mockResolvedValue([{ min_payin: 1, max_payin: 100, id: 1 }]);
      merchantDao.getMerchantBankDao.mockResolvedValue([{ is_enabled: false, bank_used_for: 'PayIn', min: 1, max: 100, config: {} }]);
      await expect(service.assignedBankToPayInUrlService('id', 50, 'UPI')).rejects.toThrow();
    });

    it('should throw if merchant not found', async () => {
      // ESM compatible mock for getPayInUrlService
      jest.unstable_mockModule('../../src/apis/payIn/payInService.js', async () => {
        const actual = await import('../../src/apis/payIn/payInService.js');
        return {
          ...actual,
          getPayInUrlService: jest.fn().mockResolvedValue({ status: 'INITIATED', merchant_id: 1 }),
        };
      });
      const service = await import('../../src/apis/payIn/payInService.js');
      merchantDao.getMerchantsDao.mockResolvedValue([]);
      await expect(service.assignedBankToPayInUrlService('id', 100, 'UPI')).rejects.toThrow();
    });
    it('should throw if amount is out of range and not admin', async () => {
      jest.unstable_mockModule('../../src/apis/payIn/payInService.js', async () => {
        const actual = await import('../../src/apis/payIn/payInService.js');
        return {
          ...actual,
          getPayInUrlService: jest.fn().mockResolvedValue({ status: 'INITIATED', merchant_id: 1 }),
        };
      });
      const service = await import('../../src/apis/payIn/payInService.js');
      merchantDao.getMerchantsDao.mockResolvedValue([{ min_payin: 10, max_payin: 20 }]);
      await expect(service.assignedBankToPayInUrlService('id', 1000, 'UPI')).rejects.toThrow();
    });
    it('should throw if no bank found with valid amount', async () => {
      jest.unstable_mockModule('../../src/apis/payIn/payInService.js', async () => {
        const actual = await import('../../src/apis/payIn/payInService.js');
        return {
          ...actual,
          getPayInUrlService: jest.fn().mockResolvedValue({ status: 'INITIATED', merchant_id: 1, company_id: 1 }),
        };
      });
      const service = await import('../../src/apis/payIn/payInService.js');
      merchantDao.getMerchantsDao.mockResolvedValue([{ min_payin: 1, max_payin: 100, id: 1 }]);
      merchantDao.getMerchantBankDao.mockResolvedValue([]);
      await expect(service.assignedBankToPayInUrlService('id', 50, 'UPI')).rejects.toThrow();
    });
    it('should throw if no enabled bank found', async () => {
      jest.unstable_mockModule('../../src/apis/payIn/payInService.js', async () => {
        const actual = await import('../../src/apis/payIn/payInService.js');
        return {
          ...actual,
          getPayInUrlService: jest.fn().mockResolvedValue({ status: 'INITIATED', merchant_id: 1, company_id: 1 }),
        };
      });
      const service = await import('../../src/apis/payIn/payInService.js');
      merchantDao.getMerchantsDao.mockResolvedValue([{ min_payin: 1, max_payin: 100, id: 1 }]);
      merchantDao.getMerchantBankDao.mockResolvedValue([{ is_enabled: false, bank_used_for: 'PayIn', min: 1, max: 100, config: {} }]);
      await expect(service.assignedBankToPayInUrlService('id', 50, 'UPI')).rejects.toThrow();
    });
    // it('should return bank details for valid UPI', async () => {
    //   jest.unstable_mockModule('../../src/apis/payIn/payInService.js', async () => {
    //     const actual = await import('../../src/apis/payIn/payInService.js');
    //     return {
    //       ...actual,
    //       getPayInUrlService: jest.fn().mockResolvedValue({
    //         status: 'INITIATED',
    //         merchant_id: 1,
    //         company_id: 1,
    //         amount: 50,
    //         config: { urls: { return: 'url' } },
    //         created_at: new Date().toISOString(),
    //         id: 1,
    //       }),
    //     };
    //   });
    //   const service = await import('../../src/apis/payIn/payInService.js');
    //   merchantDao.getMerchantsDao.mockResolvedValue([{ min_payin: 1, max_payin: 100, id: 1 }]);
    //   merchantDao.getMerchantBankDao.mockResolvedValue([
    //     { is_enabled: true, bank_used_for: 'PayIn', min: 1, max: 100, is_qr: true, id: 2, config: {}, user_id: 3, nick_name: 'Bank', acc_holder_name: 'Holder', upi_id: 'upi@bank' },
    //   ]);
    //   payInDao.updatePayInUrlDao.mockResolvedValue({});
    //   vendorDao.getVendorsDao.mockResolvedValue([{ code: 'V', user_id: 3 }]);
    //   const result = await service.assignedBankToPayInUrlService('id', 50, 'UPI');
    //   expect(result.bank.upi_id).toBeDefined();
    // });
    it('should return 400 if merchant not found', async () => {
      merchantDao.getMerchantsDao.mockResolvedValue([]);
      const result = await service.checkPayInStatusService(1, 'code', 'order', 'key');
      expect(result.status).toBe(400);
    });
    it('should return 404 if api_key invalid', async () => {
      merchantDao.getMerchantsDao.mockResolvedValue([{ id: 1, config: { keys: { private: 'a', public: 'b' } } }]);
      const result = await service.checkPayInStatusService(1, 'code', 'order', 'badkey');
      expect(result.status).toBe(404);
    });
    it('should return 404 if payIn not found', async () => {
      merchantDao.getMerchantsDao.mockResolvedValue([{ id: 1, config: { keys: { private: 'key', public: 'key' } } }]);
      payInDao.getPayInForCheckStatusDao.mockResolvedValue(undefined);
      const result = await service.checkPayInStatusService(1, 'code', 'order', 'key');
      expect(result.status).toBe(404);
    });
    it('should return 404 if merchant mismatch', async () => {
      merchantDao.getMerchantsDao.mockResolvedValue([{ id: 1, config: { keys: { private: 'key', public: 'key' } } }]);
      payInDao.getPayInForCheckStatusDao.mockResolvedValue({ merchant_id: 2 });
      const result = await service.checkPayInStatusService(1, 'code', 'order', 'key');
      expect(result.status).toBe(404);
    });
    it('should return status and details on success', async () => {
      merchantDao.getMerchantsDao.mockResolvedValue([{ id: 1, config: { keys: { private: 'key', public: 'key' } } }]);
      payInDao.getPayInForCheckStatusDao.mockResolvedValue({ merchant_id: 1, status: 'SUCCESS', id: 1, merchant_order_id: 'order', amount: 100 });
      const result = await service.checkPayInStatusService(1, 'code', 'order', 'key');
      expect(result.status).toBeDefined();
    });
    it('should log and throw on error', async () => {
      merchantDao.getMerchantsDao.mockRejectedValue(new Error('fail'));
      await expect(service.checkPayInStatusService(1, 'code', 'order', 'key')).rejects.toThrow('fail');
    });
  });

  describe('generatePayInUrlByHashService', () => {
    it('should return if cooldown is active', async () => {
      redishashkey.getCachedData.mockResolvedValue(true);
      const result = await service.updateDepositStatusService('order', 'nick', 1, 1);
      expect(result).toBeUndefined();
    });

    it('should throw if payInData not found', async () => {
      redishashkey.getCachedData.mockResolvedValue(false);
      payInDao.getPayInForUpdateServiceDao.mockResolvedValue(undefined);
      await expect(service.updateDepositStatusService('order', 'nick', 1, 1)).rejects.toThrow();
    });

    it('should throw if merchant not found', async () => {
      redishashkey.getCachedData.mockResolvedValue(false);
      payInDao.getPayInForUpdateServiceDao.mockResolvedValue({ merchant_id: 1 });
      merchantDao.getMerchantsDao.mockResolvedValue([]);
      await expect(service.updateDepositStatusService('order', 'nick', 1, 1)).rejects.toThrow();
    });

    it('should throw if status is not BANK_MISMATCH', async () => {
      redishashkey.getCachedData.mockResolvedValue(false);
      payInDao.getPayInForUpdateServiceDao.mockResolvedValue({ merchant_id: 1, status: 'SUCCESS' });
      merchantDao.getMerchantsDao.mockResolvedValue([{ id: 1 }]);
      await expect(service.updateDepositStatusService('order', 'nick', 1, 1)).rejects.toThrow();
    });

    it('should throw if bankResponse not found', async () => {
      redishashkey.getCachedData.mockResolvedValue(false);
      payInDao.getPayInForUpdateServiceDao.mockResolvedValue({ merchant_id: 1, status: 'BANK_MISMATCH', bank_response_id: 2 });
      merchantDao.getMerchantsDao.mockResolvedValue([{ id: 1 }]);
      bankResponseDao.getBankResponseDao.mockResolvedValue(undefined);
      await expect(service.updateDepositStatusService('order', 'nick', 1, 1)).rejects.toThrow();
    });

    it('should throw if bank not found', async () => {
      redishashkey.getCachedData.mockResolvedValue(false);
      payInDao.getPayInForUpdateServiceDao.mockResolvedValue({ merchant_id: 1, status: 'BANK_MISMATCH', bank_response_id: 2 });
      merchantDao.getMerchantsDao.mockResolvedValue([{ id: 1 }]);
      bankResponseDao.getBankResponseDao.mockResolvedValue({});
      bankaccountDao.getBankaccountDao.mockResolvedValue([]);
      await expect(service.updateDepositStatusService('order', 'nick', 1, 1)).rejects.toThrow();
    });

    it('should throw if vendor not found', async () => {
      redishashkey.getCachedData.mockResolvedValue(false);
      payInDao.getPayInForUpdateServiceDao.mockResolvedValue({ merchant_id: 1, status: 'BANK_MISMATCH', bank_response_id: 2 });
      merchantDao.getMerchantsDao.mockResolvedValue([{ id: 1 }]);
      bankResponseDao.getBankResponseDao.mockResolvedValue({});
      bankaccountDao.getBankaccountDao.mockResolvedValue([{ user_id: 1 }]);
      vendorDao.getVendorsDao.mockResolvedValue([]);
      await expect(service.updateDepositStatusService('order', 'nick', 1, 1)).rejects.toThrow();
    });

    it('should succeed for valid input', async () => {
      redishashkey.getCachedData.mockResolvedValue(false);
      payInDao.getPayInForUpdateServiceDao.mockResolvedValue({ merchant_id: 1, status: 'BANK_MISMATCH', bank_response_id: 2 });
      merchantDao.getMerchantsDao.mockResolvedValue([{ id: 1, payin_commission: 1 }]);
      bankResponseDao.getBankResponseDao.mockResolvedValue({ amount: 100 });
      bankaccountDao.getBankaccountDao.mockResolvedValue([{ user_id: 1 }]);
      vendorDao.getVendorsDao.mockResolvedValue([{ payin_commission: 1 }]);
      payInDao.updatePayInUrlDao.mockResolvedValue({ sno: 123, amount: 100, status: 'SUCCESS' });
      const result = await service.updateDepositStatusService('order', 'nick', 1, 1);
      expect(result).toBeUndefined();
    });
  });

  describe('processPayInWebHookService', () => {
    it('should throw on error', async () => {
      await expect(service.processPayInWebHookService({}, 1)).rejects.toThrow();
    });
    it('should process and return result on success', async () => {
      service.processPayInWebHookService = jest.fn().mockResolvedValue('ok');
      const result = await service.processPayInWebHookService({ merchantOrderId: 'id', userSubmittedUtr: 'utr', amount: 1, status: 'SUCCESS' }, 1);
      expect(result).toBe('ok');
    });
  });

  describe('telegramResponseService', () => {
    it('should return undefined if no photo', async () => {
      const result = await service.telegramResponseService({});
      expect(result).toBeUndefined();
    });
    it('should handle missing caption', async () => {
      const msg = { photo: [{ file_id: 'f' }], chat: { id: 1 }, message_id: 1 };
      helpers.getTelegramFilePath.mockResolvedValue('path');
      helpers.getTelegramImageBase64.mockResolvedValue('img');
      helpers.getImageContentFromOCr.mockResolvedValue({ utr: 'utr', amount: 1 });
      sendTelegramMessages.sendErrorMessageNoMerchantOrderIdFoundTelegramBot.mockResolvedValue();
      await service.telegramResponseService(msg);
      expect(sendTelegramMessages.sendErrorMessageNoMerchantOrderIdFoundTelegramBot).toHaveBeenCalled();
    });
  });

  describe('processPayInByImageService', () => {
    it('should throw on error', async () => {
      await expect(service.processPayInByImageService({})).rejects.toThrow();
    });
    // it('should return IMG_PENDING if UTR missing', async () => {
    //   helpers.getImageContentFromOCr.mockResolvedValue({});
    //   payInDao.updatePayInUrlDao.mockResolvedValue({});
    //   const result = await service.processPayInByImageService({ base64Image: 'img', merchantOrderId: 'id', amount: 1, fileKey: 'file' });
    //   expect(result.status).toBe('IMG_PENDING');
    // });
  });

  describe('disputeDuplicateTransactionService', () => {
    it('should throw if payIn not found', async () => {
      payInDao.getPayInForDisputeServiceDao.mockResolvedValue(undefined);
      await expect(service.disputeDuplicateTransactionService({}, 1, 1)).rejects.toThrow();
    });
    it('should throw if status is not DISPUTE', async () => {
      payInDao.getPayInForDisputeServiceDao.mockResolvedValue({ status: 'SUCCESS' });
      await expect(service.disputeDuplicateTransactionService({ payInId: 1 }, 1, 1)).rejects.toThrow();
    });
  });

  describe('telegramCheckUTRService', () => {
    it('should throw if bankResponse not found', async () => {
      bankResponseDao.getBankResponsePayinDao.mockResolvedValue(undefined);
      await expect(service.telegramCheckUTRService('utr', 'order', 1, 1, 'ADMIN')).rejects.toThrow();
    });
  });

  describe('getPayinsServiceById', () => {
    it('should throw on error', async () => {
      payInDao.getPayinsForServiccDao.mockRejectedValue(new Error('fail'));
      await expect(service.getPayinsServiceById(1)).rejects.toThrow('fail');
    });
  });

  describe('updateUtrPayinService', () => {
    it('should throw on error', async () => {
      payInDao.updatePayInUrlDao.mockRejectedValue(new Error('fail'));
      await expect(service.updateUtrPayinService(1, 1, 'utr')).rejects.toThrow('fail');
    });
  });

  describe('checkPendingPayinStatusService', () => {
    it('should throw on error', async () => {
      payInDao.getPayInPendingDao.mockRejectedValue(new Error('fail'));
      await expect(service.checkPendingPayinStatusService(1, 1, 'user')).rejects.toThrow('fail');
    });
  });

  describe('verifyPayinsService', () => {
    it('should throw on error', async () => {
      await expect(service.verifyPayinsService('order', {}, false)).rejects.toThrow();
    });
  });

  describe('generateUpiUrlService', () => {
    it('should throw if amount missing', async () => {
      await expect(service.generateUpiUrlService({})).rejects.toThrow();
    });
    it('should return all links for valid input', async () => {
      const result = await service.generateUpiUrlService({ amount: 100 });
      expect(result.upiLink).toBeDefined();
      expect(result.gpayLink).toBeDefined();
      expect(result.paytmLink).toBeDefined();
      expect(result.phonepeLink).toBeDefined();
    });
  });
});
