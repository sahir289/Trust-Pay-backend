/* eslint-disable no-unused-vars */
jest.mock('../../utils/sockets.js', () => ({
  newTableEntry: jest.fn().mockResolvedValue(),
}));

jest.mock('../../utils/sockets.js', () => ({
  newTableEntry: jest.fn().mockResolvedValue(),
}));

// Mock cashfree-pg
jest.mock('cashfree-pg', () => ({
  Cashfree: {
    PGCreateOrder: jest.fn().mockResolvedValue({ order_id: 'cashfree_order' }),
    XClientId: null,
    XClientSecret: null,
    XEnvironment: null,
  },
  Environment: {
    PRODUCTION: 'PRODUCTION',
    SANDBOX: 'SANDBOX',
  },
}));

jest.mock('multer', () => ({
  multer: () => ({
    single: () => (req, res, next) => next(),
    memoryStorage: () => ({}),
  }),
  memoryStorage: () => ({}),
}));

jest.mock('../../webhooks/razorPay.js', () => ({
  razorpay: {
    orders: {
      create: jest.fn().mockResolvedValue({ id: 'razorpay_order' }),
    },
  },
  configureCashfree: jest.fn().mockReturnValue({
    PGCreateOrder: jest.fn().mockResolvedValue({ order_id: 'cashfree_order' }),
    XClientId: null,
    XClientSecret: null,
    XEnvironment: 'PRODUCTION',
  }),
}));

import * as payInService from './payInService.js';
import {
  generatePayInUrlDao,
  updatePayInUrlDao,
  getPayInForCheckStatusDao,
  getPayInForCheckDao,
  getPayinsForServiccDao,
  getPayinsWithHistoryDao,
  getPayinsWithoutHistoryDao,
  getPayInPendingDao,
  getPayinsSumAndCountByStatusDao,
  getPayInForUpdateServiceDao,
  getPayInForDisputeServiceDao,
  getPayInForTelegramUtrDao,
  getPayInForResetDao,
  getSuccessPayInsDao,
  getPayInForUpdateDao,
  getPayInForTelegramResponseDao,
  getPayInForTelegramResponseArrayDao,
} from './payInDao.js';
import {
  getBankaccountDao,
  getMerchantBankDao,
  updateBankaccountDao,
} from '../bankAccounts/bankaccountDao.js';
import {
  getBankResponseDao,
  getBankResponseDaoById,
  getBankResponsePendingDao,
  updateBankResponseDao,
  updateBotResponseDao,
} from '../bankResponse/bankResponseDao.js';
import {
  getMerchantsByCodeDao,
  getMerchantsDao,
  getMerchantByUserIdDao,
  updateMerchantBalanceDao,
} from '../merchants/merchantDao.js';
import {
  getAllCalculationforCronDao,
  getCalculationforCronDao,
  updateCalculationBalanceDao,
} from '../calculation/calculationDao.js';
import {
  getVendorsDao,
  updateVendorDao,
} from '../vendors/vendorDao.js';
import { logger } from '../../utils/logger.js';
import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from '../../utils/appErrors.js';
import {
  getImageContentFromOCr,
  calculateDuration,
  getTelegramFilePath,
  getTelegramImageBase64,
} from '../../helpers/index.js';
import {
  calculateCommission,
} from '../../utils/calculation.js';
import {
  checkLockEdit,
} from '../../utils/advisoryLock.js';
import {
  merchantPayinCallback,
  merchantPayoutCallback,
} from '../../callBacksAndWebHook/merchantCallBacks.js';
import {
  sendBankMismatchMessageTelegramBot,
  sendDisputeMessageTelegramBot,
  sendBankNotAssignedAlertTelegram,
  sendAlreadyConfirmedMessageTelegramBot,
  sendDuplicateMessageTelegramBot,
  sendErrorMessageNoDepositFoundTelegramBot,
  sendErrorMessageNoMerchantOrderIdFoundTelegramBot,
  sendErrorMessageTelegram,
  sendPaymentStatusMessageTelegramBot,
  sendErrorMessageUtrOrAmountNotFoundImgTelegramBot,
  sendMerchantOrderIDStatusDuplicateTelegramMessage,
  sendSuccessMessageTelegramBot,
  sendTelegramMessage,
  sendUTRMismatchErrorMessageTelegram,
  sendTelegramDisputeMessage,
} from '../../utils/sendTelegramMessages.js';
import { getCompanyByIDDao } from '../company/companyDao.js';
import { createHash } from '../../utils/bcryptPassword.js';
import { nanoid } from 'nanoid';
import { newTableEntry } from '../../utils/sockets.js';
import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
import { createCheckUtrService } from '../checkutr/checkUtrServices.js';
import { createResetHistoryService } from '../resetHistory/resetServices.js';
import { trackVendorsNetBalance } from '../../utils/trackVendorsNetBalance.js';
// import { stringifyJSON } from '../../utils/index.js';
import { getAllUsersDao, getUserByIdDao } from '../users/userDao.js';
import { getPayoutsDao } from '../payOut/payOutDao.js';
import { razorpay } from '../../webhooks/razorPay.js';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import querystring from 'querystring';
import { generateUUID } from '../../utils/generateUUID.js';
import { usedTokens } from '../../app.js';

// Mock constants and globals
const mockTableName = { PAYIN: 'Payin', BANK_RESPONSE: 'BankResponse' };
const mockStatus = { INITIATED: 'INITIATED', ASSIGNED: 'ASSIGNED', DROPPED: 'DROPPED', DUPLICATE: 'DUPLICATE', SUCCESS: 'SUCCESS', FAILED: 'FAILED', BANK_MISMATCH: 'BANK_MISMATCH', DISPUTE: 'DISPUTE', PENDING: 'PENDING', IMG_PENDING: 'IMG_PENDING' };
const mockRole = { ADMIN: 'ADMIN', MERCHANT: 'MERCHANT', VENDOR: 'VENDOR', SUB_MERCHANT: 'SUB_MERCHANT', MERCHANT_OPERATIONS: 'MERCHANT_OPERATIONS', VENDOR_OPERATIONS: 'VENDOR_OPERATIONS' };
const mockType = { PAYIN: 'PAYIN', PAYOUT: 'PAYOUT' };
const mockBankTypes = { BANK_TRANSFER: 'BANK_TRANSFER', UPI: 'UPI', PHONE_PE: 'PHONE_PE', INTENT: 'INTENT' };
const mockCurrency = { INR: 'INR' };

// payinService.test.js
jest.mock('../../webhooks/razorPay.js', () => ({
  razorpay: {
    orders: {
      create: jest.fn().mockResolvedValue({ id: 'razorpay_order' }),
    },
  },
  configureCashfree: jest.fn().mockReturnValue({
    PGCreateOrder: jest.fn().mockResolvedValue({ order_id: 'cashfree_order' }),
    XClientId: null,
    XClientSecret: null,
    XEnvironment: 'PRODUCTION',
  }),
}));

jest.mock('./payInDao.js', () => ({
  generatePayInUrlDao: jest.fn(),
  updatePayInUrlDao: jest.fn(),
  getPayInForCheckStatusDao: jest.fn(),
  getPayInForCheckDao: jest.fn(),
  getPayinsForServiccDao: jest.fn(),
  getPayinsWithHistoryDao: jest.fn(),
  getPayinsWithoutHistoryDao: jest.fn(),
  getPayInPendingDao: jest.fn(),
  getPayinsSumAndCountByStatusDao: jest.fn(),
  getPayInForUpdateServiceDao: jest.fn(),
  getPayInForDisputeServiceDao: jest.fn(),
  getPayInForTelegramUtrDao: jest.fn(),
  getPayInForResetDao: jest.fn(),
  getSuccessPayInsDao: jest.fn(),
  getPayInForUpdateDao: jest.fn(),
  getPayInForTelegramResponseDao: jest.fn(),
  getPayInForTelegramResponseArrayDao: jest.fn(),
}));

jest.mock('../bankAccounts/bankaccountDao.js', () => ({
  getBankaccountDao: jest.fn(),
  getMerchantBankDao: jest.fn(),
  updateBankaccountDao: jest.fn(),
}));

jest.mock('../bankResponse/bankResponseDao.js', () => ({
  getBankResponseDao: jest.fn(),
  getBankResponseDaoById: jest.fn(),
  getBankResponsePendingDao: jest.fn(),
  updateBankResponseDao: jest.fn(),
  updateBotResponseDao: jest.fn(),
}));

jest.mock('../merchants/merchantDao.js', () => ({
  getMerchantsByCodeDao: jest.fn(),
  getMerchantsDao: jest.fn(),
  getMerchantByUserIdDao: jest.fn(),
  updateMerchantBalanceDao: jest.fn(),
}));

jest.mock('../calculation/calculationDao.js', () => ({
  getAllCalculationforCronDao: jest.fn(),
  getCalculationforCronDao: jest.fn(),
  updateCalculationBalanceDao: jest.fn(),
}));

jest.mock('../vendors/vendorDao.js', () => ({
  getVendorsDao: jest.fn(),
  updateVendorDao: jest.fn(),
}));

jest.mock('../../utils/logger.js', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
  },
}));

jest.mock('../../utils/index.js', () => ({
  multerUpload: {
      single: () => (req, res, next) => {
          req.file = {
              buffer: Buffer.from('id,message\n1,Test message'),
              originalname: 'test.csv',
              mimetype: 'text/csv',
          };
          next();
      },
  },
}));

jest.mock('../../utils/appErrors.js', () => ({
  BadRequestError: jest.fn().mockImplementation(() => ({ message: 'Bad Request' })),
  InternalServerError: jest.fn().mockImplementation(() => ({ message: 'Internal Server Error' })),
  NotFoundError: jest.fn().mockImplementation(() => ({ message: 'Not Found' })),
}));

jest.mock('../../helpers/index.js', () => ({
  getImageContentFromOCr: jest.fn(),
  calculateDuration: jest.fn().mockReturnValue(3600),
  stringifyJSON: jest.fn().mockImplementation(JSON.stringify),
}));

jest.mock('../../utils/calculation.js', () => ({
  calculateCommission: jest.fn().mockReturnValue(20),
}));

jest.mock('../../utils/advisoryLock.js', () => ({
  checkLockEdit: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../callBacksAndWebHook/merchantCallBacks.js', () => ({
  merchantPayinCallback: jest.fn().mockResolvedValue({}),
  merchantPayoutCallback: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../utils/sendTelegramMessages.js', () => ({
  sendBankMismatchMessageTelegramBot: jest.fn().mockResolvedValue(),
  sendDisputeMessageTelegramBot: jest.fn().mockResolvedValue(),
  sendBankNotAssignedAlertTelegram: jest.fn().mockResolvedValue(),
  sendAlreadyConfirmedMessageTelegramBot: jest.fn().mockResolvedValue(),
  sendDuplicateMessageTelegramBot: jest.fn().mockResolvedValue(),
  sendErrorMessageNoDepositFoundTelegramBot: jest.fn().mockResolvedValue(),
  sendErrorMessageNoMerchantOrderIdFoundTelegramBot: jest.fn().mockResolvedValue(),
  sendErrorMessageTelegram: jest.fn().mockResolvedValue(),
  sendPaymentStatusMessageTelegramBot: jest.fn().mockResolvedValue(),
  sendErrorMessageUtrOrAmountNotFoundImgTelegramBot: jest.fn().mockResolvedValue(),
  sendMerchantOrderIDStatusDuplicateTelegramMessage: jest.fn().mockResolvedValue(),
  sendSuccessMessageTelegramBot: jest.fn().mockResolvedValue(),
  sendTelegramMessage: jest.fn().mockResolvedValue(),
  sendUTRMismatchErrorMessageTelegram: jest.fn().mockResolvedValue(),
  sendTelegramDisputeMessage: jest.fn().mockResolvedValue(),
}));

jest.mock('../company/companyDao.js', () => ({
  getCompanyByIDDao: jest.fn().mockResolvedValue([{ config: { telegramBankAlertChatId: 'chat123', telegramBotToken: 'token123' } }]),
}));

jest.mock('../../utils/bcryptPassword.js', () => ({
  createHash: jest.fn().mockReturnValue('mockHash'),
}));

jest.mock('nanoid', () => ({
  nanoid: jest.fn().mockReturnValue('QokKC'),
}));

jest.mock('../../utils/sockets.js', () => ({
  newTableEntry: jest.fn().mockResolvedValue(),
}));

jest.mock('../userHierarchy/userHierarchyDao.js', () => ({
  getUserHierarchysDao: jest.fn().mockResolvedValue([]),
}));

jest.mock('../checkutr/checkUtrServices.js', () => ({
  createCheckUtrService: jest.fn().mockResolvedValue(),
}));

jest.mock('../resetHistory/resetServices.js', () => ({
  createResetHistoryService: jest.fn().mockResolvedValue(),
}));

jest.mock('../../utils/trackVendorsNetBalance.js', () => ({
  trackVendorsNetBalance: jest.fn().mockResolvedValue(),
}));



jest.mock('../users/userDao.js', () => ({
  getAllUsersDao: jest.fn().mockResolvedValue([{ user_name: 'Test User' }]),
  getUserByIdDao: jest.fn().mockResolvedValue([{ role: 'USER' }]),
}));

jest.mock('../payOut/payOutDao.js', () => ({
  getPayoutsDao: jest.fn().mockResolvedValue([{ id: 'payout1' }]),
}));

jest.mock('../../webhooks/razorPay.js', () => ({
  razorpay: {
    orders: {
      create: jest.fn().mockResolvedValue({ id: 'razorpay_order' }),
    },
  },
}));

jest.mock('cashfree-pg', () => ({
  Cashfree: {
    PGCreateOrder: jest.fn().mockResolvedValue({ order_id: 'cashfree_order' }),
  },
  Environment: {
    PRODUCTION: 'PRODUCTION',
  },
}));

jest.mock('dayjs', () => {
  const actual = jest.requireActual('dayjs');
  const mockDayjs = (...args) => {
    const instance = actual(...args);
    instance.add = jest.fn().mockReturnThis();
    instance.toISOString = jest.fn().mockReturnValue('2025-09-13T12:00:00.000Z');
    instance.tz = jest.fn().mockReturnThis();
    instance.format = jest.fn().mockReturnValue('2025-09-13');
    return instance;
  };
  mockDayjs.extend = jest.fn();
  return mockDayjs;
});

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('uuid-v4-mock'),
}));

jest.mock('querystring', () => ({
  stringify: jest.fn().mockImplementation(obj => Object.entries(obj).map(([k, v]) => `${k}=${v}`).join('&')),
}));

jest.mock('../../utils/generateUUID.js', () => ({
  generateUUID: jest.fn().mockReturnValue('uuid-mock'),
}));

// Global beforeEach
beforeEach(() => {
  jest.clearAllMocks();
  jest.resetAllMocks();
  jest.spyOn(global.Set.prototype, 'has').mockReturnValue(false);
  jest.spyOn(global.Set.prototype, 'add').mockImplementation(function () { return this; });
});

// Common mock data
const mockPayIn = {
  id: 'payin123',
  merchant_id: 'merchant1',
  merchant_order_id: 'order123',
  config: { urls: { return: 'http://return.url', notify: 'http://notify.url' } },
  expiration_date: Date.now() + 86400000,
  amount: 100,
  one_time_used: false,
  status: mockStatus.INITIATED,
  user: 'user1',
  company_id: 'company1',
  bank_acc_id: 'bank1',
  created_at: new Date().toISOString(),
  is_url_expires: false,
};

const mockMerchant = {
  id: 'merchant1',
  code: 'MERCH1',
  min_payin: 50,
  max_payin: 1000,
  payin_commission: 2,
  company_id: 'company1',
  user_id: 'merchant_user1',
  config: { keys: { private: 'private_key', public: 'public_key' }, urls: { return: 'http://return.url', payin_notify: 'http://notify.url' } },
};

const mockBank = {
  id: 'bank1',
  nick_name: 'Test Bank',
  acc_holder_name: 'Test Holder',
  acc_no: '123456789',
  ifsc: 'IFSC123',
  upi_id: 'test@upi',
  user_id: 'bank_user1',
  company_id: 'company1',
  config: { is_phonepay: false, is_intent: false, is_staticQR: false, is_freeze: false },
  is_enabled: true,
  is_qr: true,
  is_bank: true,
  bank_used_for: 'PayIn',
};

const mockVendor = {
  id: 'vendor1',
  code: 'VENDOR1',
  user_id: 'bank_user1',
  payin_commission: 1.5,
  company_id: 'company1',
};

const mockBankResponse = {
  id: 'resp123',
  utr: 'UTR123',
  amount: 100,
  bank_id: 'bank1',
  status: '/success',
  is_used: false,
  company_id: 'company1',
};

const mockUserHierarchy = [{ config: { siblings: { sub_merchants: [] }, parent: null } }];

const mockConn = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };

// Tests for generatePayInUrlByHashService
describe('generatePayInUrlByHashService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return 400 for missing required query parameters', async () => {
    const req = { query: { user_id: '123' }, user: { role_id: 'admin1', role: mockRole.ADMIN } };
    const result = await payInService.generatePayInUrlByHashService(mockConn, req);
    expect(result).toEqual({ status: 400, message: 'Missing required query parameters: user_id, code, or ot' });
  });

  test('should return 404 if merchant inactive', async () => {
    const req = { query: { user_id: '123', code: 'INACTIVE', ot: 'y' }, user: { role_id: 'admin1', role: mockRole.ADMIN } };
    getMerchantsByCodeDao.mockResolvedValue([]);
    const result = await payInService.generatePayInUrlByHashService(mockConn, req);
    expect(result).toEqual({ status: 404, message: 'Merchant is inactive. Contact support for help!' });
  });

  test('should return 404 and send alert if no bank assigned', async () => {
    const req = { query: { user_id: '123', code: 'MERCH1', ot: 'y', key: 'key1' }, user: { role_id: 'admin1', role: mockRole.ADMIN } };
    getMerchantsByCodeDao.mockResolvedValue([{ id: 'm1', company_id: 'c1' }]);
    getMerchantBankDao.mockResolvedValue([]);
    const result = await payInService.generatePayInUrlByHashService(mockConn, req);
    expect(result).toEqual({ status: 404, message: 'Bank Account has not been linked with Merchant' });
    expect(sendBankNotAssignedAlertTelegram).toHaveBeenCalled();
  });

  test('should return 404 if all banks disabled', async () => {
    const req = { query: { user_id: '123', code: 'MERCH1', ot: 'y', key: 'key1' }, user: { role_id: 'admin1', role: mockRole.ADMIN } };
    getMerchantsByCodeDao.mockResolvedValue([{ id: 'm1', company_id: 'c1' }]);
    getMerchantBankDao.mockResolvedValue([{ is_enabled: false }]);
    const result = await payInService.generatePayInUrlByHashService(mockConn, req);
    expect(result).toEqual({ status: 404, message: 'Bank Account has not been linked with Merchant' });
  });

  test('should return 404 if no payment methods enabled', async () => {
    const req = { query: { user_id: '123', code: 'MERCH1', ot: 'y', key: 'key1' }, user: { role_id: 'admin1', role: mockRole.ADMIN } };
    getMerchantsByCodeDao.mockResolvedValue([{ id: 'm1', company_id: 'c1' }]);
    getMerchantBankDao.mockResolvedValue([{ is_enabled: true, is_qr: false, is_bank: false, config: { is_phonepay: false } }]);
    const result = await payInService.generatePayInUrlByHashService(mockConn, req);
    expect(result).toEqual({ status: 404, message: 'No Payment Methods Enabled!' });
  });

  test('should generate payInUrl successfully with amount', async () => {
    process.env.REACT_PAYMENT_ORIGIN = 'http://localhost:3000';
    const req = { query: { user_id: '123', code: 'MERCH1', ot: 'y', key: 'key1', amount: '100' }, user: { role_id: 'admin1', role: mockRole.ADMIN } };
    getMerchantsByCodeDao.mockResolvedValue([{ id: 'm1', company_id: 'c1' }]);
    getMerchantBankDao.mockResolvedValue([{ is_enabled: true, is_qr: true }]);
    createHash.mockReturnValue('hash123');
    const result = await payInService.generatePayInUrlByHashService(mockConn, req);
    expect(result).toEqual({
      payInUrl: 'http://localhost:3000/transaction/hash123?user_id=123&code=MERCH1&ot=y&key=key1&amount=100&token=admin1',
    });
  });

  test('should generate payInUrl successfully without amount', async () => {
    process.env.REACT_PAYMENT_ORIGIN = 'http://localhost:3000';
    const req = { query: { user_id: '123', code: 'MERCH1', ot: 'y', key: 'key1' }, user: { role_id: 'admin1', role: mockRole.ADMIN } };
    getMerchantsByCodeDao.mockResolvedValue([{ id: 'm1', company_id: 'c1' }]);
    getMerchantBankDao.mockResolvedValue([{ is_enabled: true, is_qr: true }]);
    createHash.mockReturnValue('hash123');
    const result = await payInService.generatePayInUrlByHashService(mockConn, req);
    expect(result).toEqual({
      payInUrl: 'http://localhost:3000/transaction/hash123?user_id=123&code=MERCH1&ot=y&key=key1&token=admin1',
    });
  });

  test('should handle error in service', async () => {
    const req = { query: { user_id: '123', code: 'MERCH1', ot: 'y' }, user: { role_id: 'admin1', role: mockRole.ADMIN } };
    getMerchantsByCodeDao.mockRejectedValue(new Error('DB Error'));
    await expect(payInService.generatePayInUrlByHashService(mockConn, req)).rejects.toThrow('DB Error');
    expect(logger.error).toHaveBeenCalledWith('Error generating payin hash:', expect.any(Error));
  });
});

// Tests for generatePayInUrlService
describe('generatePayInUrlService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    uuidv4.mockReturnValue('order123');
  });

  test('should generate payIn URL successfully', async () => {
    const payload = { code: 'MERCH1', user_id: 'u1', amount: 100, ot: 'n', api_key: 'private_key' };
    getMerchantsByCodeDao.mockResolvedValue([mockMerchant]);
    getPayInForCheckDao.mockResolvedValue([]);
    generatePayInUrlDao.mockResolvedValue({ id: 'payin1' });
    const result = await payInService.generatePayInUrlService(mockConn, payload, 'creator1', mockRole.MERCHANT, '127.0.0.1', true);
    expect(result).toEqual({ id: 'payin1' });
    expect(generatePayInUrlDao).toHaveBeenCalledWith(expect.objectContaining({ merchant_order_id: 'order123' }));
    expect(newTableEntry).toHaveBeenCalledWith(mockTableName.PAYIN, expect.any(Object));
  });

  test('should return 400 for IP not whitelisted', async () => {
    const payload = { code: 'MERCH1', user_id: 'u1', amount: 100, ot: 'n', api_key: 'private_key' };
    getMerchantsByCodeDao.mockResolvedValue([{ ...mockMerchant, config: { ...mockMerchant.config, whitelist_ips: ['127.0.0.1'] } }]);
    getPayInForCheckDao.mockResolvedValue([]);
    const result = await payInService.generatePayInUrlService(mockConn, payload, 'creator1', mockRole.MERCHANT, '192.168.1.1', false);
    expect(result).toEqual({ status: 400, message: 'IP not whitelisted' });
  });

  test('should return 400 for existing merchant order ID', async () => {
    const payload = { ...mockPayload, merchant_order_id: 'existing' };
    getMerchantsByCodeDao.mockResolvedValue([mockMerchant]);
    getPayInForCheckDao.mockResolvedValue([{ id: 'existing' }]);
    const result = await payInService.generatePayInUrlService(mockConn, payload, 'creator1', mockRole.MERCHANT, '127.0.0.1', true);
    expect(result).toEqual({ status: 400, message: 'Merchant Order ID already exists' });
  });

  test('should return 400 for non-existent merchant', async () => {
    const payload = { code: 'INVALID', user_id: 'u1', amount: 100, ot: 'n' };
    getMerchantsByCodeDao.mockResolvedValue([]);
    const result = await payInService.generatePayInUrlService(mockConn, payload, 'creator1', mockRole.MERCHANT, '127.0.0.1', true);
    expect(result).toEqual({ status: 400, message: 'Merchant does not exist' });
  });

  test('should return 404 for invalid API key', async () => {
    const payload = { code: 'MERCH1', user_id: 'u1', amount: 100, ot: 'n', api_key: 'invalid' };
    getMerchantsByCodeDao.mockResolvedValue([mockMerchant]);
    getPayInForCheckDao.mockResolvedValue([]);
    const result = await payInService.generatePayInUrlService(mockConn, payload, 'creator1', mockRole.MERCHANT, '127.0.0.1', true);
    expect(result).toEqual({ status: 404, message: 'Enter valid Api key' });
  });

  test('should return 400 for amount out of range', async () => {
    const payload = { code: 'MERCH1', user_id: 'u1', amount: 10, ot: 'n', api_key: 'private_key' };
    getMerchantsByCodeDao.mockResolvedValue([{ ...mockMerchant, min_payin: 50 }]);
    getPayInForCheckDao.mockResolvedValue([]);
    const result = await payInService.generatePayInUrlService(mockConn, payload, 'creator1', mockRole.MERCHANT, '127.0.0.1', true);
    expect(result).toEqual({ status: 400, message: 'Amount must be between 50 and 1000' });
  });

  test('should allow amount out of range for admin', async () => {
    const payload = { code: 'MERCH1', user_id: 'u1', amount: 10, ot: 'n', api_key: 'private_key' };
    getMerchantsByCodeDao.mockResolvedValue([{ ...mockMerchant, min_payin: 50 }]);
    getPayInForCheckDao.mockResolvedValue([]);
    generatePayInUrlDao.mockResolvedValue({ id: 'payin1' });
    const result = await payInService.generatePayInUrlService(mockConn, payload, 'admin1', mockRole.ADMIN, '127.0.0.1', true);
    expect(result).toEqual({ id: 'payin1' });
  });

  test('should throw BadRequestError on error', async () => {
    const payload = { code: 'MERCH1', user_id: 'u1', amount: 100, ot: 'n' };
    getMerchantsByCodeDao.mockRejectedValue(new Error('DB Error'));
    await expect(payInService.generatePayInUrlService(mockConn, payload, 'creator1', mockRole.MERCHANT, '127.0.0.1', true)).rejects.toThrow(BadRequestError);
  });
});

// Tests for getPayInUrlService
describe('getPayInUrlService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return payIn if valid', async () => {
    getPayinsForServiccDao.mockResolvedValue(mockPayIn);
    const result = await payInService.getPayInUrlService('order123', mockConn);
    expect(result).toEqual(mockPayIn);
  });

  test('should throw NotFoundError if payIn not found', async () => {
    getPayinsForServiccDao.mockResolvedValue(null);
    await expect(payInService.getPayInUrlService('invalid', mockConn)).rejects.toThrow(NotFoundError);
  });

  test('should handle expired payIn and notify', async () => {
    const expiredPayIn = { ...mockPayIn, expiration_date: Date.now() - 1000, status: mockStatus.ASSIGNED };
    getPayinsForServiccDao.mockResolvedValue(expiredPayIn);
    updatePayInUrlDao.mockResolvedValue({ id: 'payin1' });
    merchantPayinCallback.mockResolvedValue({});
    await payInService.getPayInUrlService('order123', mockConn);
    expect(updatePayInUrlDao).toHaveBeenCalledWith('order123', { is_url_expires: true, status: mockStatus.DROPPED }, mockConn);
    expect(merchantPayinCallback).toHaveBeenCalled();
  });

  test('should skip expiration check if tele_check false', async () => {
    const expiredPayIn = { ...mockPayIn, one_time_used: true, is_url_expires: true };
    getPayinsForServiccDao.mockResolvedValue(expiredPayIn);
    const result = await payInService.getPayInUrlService('order123', mockConn, false);
    expect(result).toEqual({ error: 'Url is expired', result: { redirect_url: mockPayIn.config.urls.return } });
  });

  test('should throw error on exception', async () => {
    getPayinsForServiccDao.mockRejectedValue(new Error('DB Error'));
    await expect(payInService.getPayInUrlService('order123', mockConn)).rejects.toThrow('DB Error');
    expect(logger.error).toHaveBeenCalled();
  });
});

// Tests for expirePayInUrlService
describe('expirePayInUrlService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should expire payIn URL successfully', async () => {
    getPayinsForServiccDao.mockResolvedValue(mockPayIn);
    updatePayInUrlDao.mockResolvedValue({ id: 'payin1' });
    merchantPayinCallback.mockResolvedValue({});
    await payInService.expirePayInUrlService('payin123');
    expect(updatePayInUrlDao).toHaveBeenCalledWith('payin123', { is_url_expires: true, status: mockStatus.DROPPED });
    expect(merchantPayinCallback).toHaveBeenCalled();
  });

  test('should throw NotFoundError if payIn not found', async () => {
    getPayinsForServiccDao.mockResolvedValue(null);
    await expect(payInService.expirePayInUrlService('invalid')).rejects.toThrow(NotFoundError);
  });

  test('should throw error on exception', async () => {
    getPayinsForServiccDao.mockRejectedValue(new Error('DB Error'));
    await expect(payInService.expirePayInUrlService('payin123')).rejects.toThrow('DB Error');
    expect(logger.error).toHaveBeenCalled();
  });
});

// Tests for assignedBankToPayInUrlService
describe('assignedBankToPayInUrlService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should assign bank for UPI type', async () => {
    payInService.getPayInUrlService.mockResolvedValue(mockPayIn);
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    getMerchantBankDao.mockResolvedValue([mockBank]);
    updatePayInUrlDao.mockResolvedValue({ ...mockPayIn, upi_short_code: 'UPI123' });
    getVendorsDao.mockResolvedValue([mockVendor]);
    const result = await payInService.assignedBankToPayInUrlService('order123', 100, mockBankTypes.UPI, mockRole.MERCHANT);
    expect(result).toEqual({
      return: mockPayIn.config.urls.return,
      bank: { upi_id: mockBank.upi_id, acc_holder_name: mockBank.acc_holder_name, code: 'UPI123' },
    });
  });

  test('should assign bank for bank transfer type', async () => {
    payInService.getPayInUrlService.mockResolvedValue(mockPayIn);
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    getMerchantBankDao.mockResolvedValue([mockBank]);
    updatePayInUrlDao.mockResolvedValue(mockPayIn);
    getVendorsDao.mockResolvedValue([mockVendor]);
    const result = await payInService.assignedBankToPayInUrlService('order123', 100, mockBankTypes.BANK_TRANSFER, mockRole.MERCHANT);
    expect(result).toEqual({
      return: mockPayIn.config.urls.return,
      bank: { nick_name: mockBank.nick_name, acc_holder_name: mockBank.acc_holder_name, acc_no: mockBank.acc_no, ifsc: mockBank.ifsc },
    });
  });

  test('should return existing assigned bank details for ASSIGNED status', async () => {
    const assignedPayIn = { ...mockPayIn, status: mockStatus.ASSIGNED, bank_acc_id: 'bank1' };
    payInService.getPayInUrlService.mockResolvedValue(assignedPayIn);
    getBankaccountDao.mockResolvedValue([mockBank]);
    const result = await payInService.assignedBankToPayInUrlService('order123', 100, mockBankTypes.BANK_TRANSFER, mockRole.MERCHANT);
    expect(result).toEqual({
      return: mockPayIn.config.urls.return,
      bank: { nick_name: mockBank.nick_name, acc_holder_name: mockBank.acc_holder_name, acc_no: mockBank.acc_no, ifsc: mockBank.ifsc },
    });
  });

  test('should throw BadRequestError for confirmed payIn', async () => {
    const confirmedPayIn = { ...mockPayIn, status: mockStatus.SUCCESS };
    payInService.getPayInUrlService.mockResolvedValue(confirmedPayIn);
    await expect(payInService.assignedBankToPayInUrlService('order123', 100, mockBankTypes.UPI, mockRole.MERCHANT)).rejects.toThrow(BadRequestError);
  });

  test('should return message for amount out of range', async () => {
    payInService.getPayInUrlService.mockResolvedValue(mockPayIn);
    getMerchantsDao.mockResolvedValue([{ ...mockMerchant, min_payin: 200, max_payin: 500 }]);
    const result = await payInService.assignedBankToPayInUrlService('order123', 100, mockBankTypes.UPI, mockRole.MERCHANT);
    expect(result).toEqual({ message: 'Amount must be between 200 and 500' });
  });

  test('should throw NotFoundError if no enabled banks', async () => {
    payInService.getPayInUrlService.mockResolvedValue(mockPayIn);
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    getMerchantBankDao.mockResolvedValue([{ is_enabled: false }]);
    updatePayInUrlDao.mockResolvedValue(mockPayIn);
    merchantPayinCallback.mockResolvedValue({});
    await expect(payInService.assignedBankToPayInUrlService('order123', 100, mockBankTypes.UPI, mockRole.MERCHANT)).rejects.toThrow(NotFoundError);
    expect(updatePayInUrlDao).toHaveBeenCalledWith(mockPayIn.id, { is_url_expires: true, status: mockStatus.DROPPED });
  });

  test('should throw error on exception', async () => {
    payInService.getPayInUrlService.mockRejectedValue(new Error('DB Error'));
    await expect(payInService.assignedBankToPayInUrlService('order123', 100, mockBankTypes.UPI, mockRole.MERCHANT)).rejects.toThrow('DB Error');
    expect(logger.error).toHaveBeenCalled();
  });
});

// Tests for checkPayInStatusService
describe('checkPayInStatusService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return payIn status successfully', async () => {
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    getPayInForCheckStatusDao.mockResolvedValue({ ...mockPayIn, status: mockStatus.SUCCESS, bank_response_id: 'resp123' });
    getBankResponseDao.mockResolvedValue({ amount: 100, utr: 'UTR123' });
    const result = await payInService.checkPayInStatusService('payin123', 'MERCH1', 'order123', 'private_key');
    expect(result).toEqual({
      status: mockStatus.SUCCESS,
      merchantOrderId: 'order123',
      amount: 100,
      payinId: 'payin123',
      req_amount: 100,
      utr_id: 'UTR123',
    });
  });

  test('should return 400 if merchant not found', async () => {
    getMerchantsDao.mockResolvedValue([]);
    const result = await payInService.checkPayInStatusService('payin123', 'INVALID', 'order123', 'private_key');
    expect(result).toEqual({ status: 400, message: 'Merchant Order ID already exists' });
  });

  test('should return 404 for invalid API key', async () => {
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    const result = await payInService.checkPayInStatusService('payin123', 'MERCH1', 'order123', 'invalid_key');
    expect(result).toEqual({ status: 404, message: 'Enter valid Api key' });
  });

  test('should return 404 if payIn not found', async () => {
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    getPayInForCheckStatusDao.mockResolvedValue(null);
    const result = await payInService.checkPayInStatusService('payin123', 'MERCH1', 'order123', 'private_key');
    expect(result).toEqual({ status: 404, message: 'PayIn not found' });
  });

  test('should return 404 if payIn does not belong to merchant', async () => {
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    getPayInForCheckStatusDao.mockResolvedValue({ ...mockPayIn, merchant_id: 'other_merchant' });
    const result = await payInService.checkPayInStatusService('payin123', 'MERCH1', 'order123', 'private_key');
    expect(result).toEqual({ status: 404, message: 'merchant_order_id and payIn ID do not belong to the specified merchant' });
  });

  test('should handle null amount and utr for certain statuses', async () => {
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    getPayInForCheckStatusDao.mockResolvedValue({ ...mockPayIn, status: mockStatus.INITIATED });
    const result = await payInService.checkPayInStatusService('payin123', 'MERCH1', 'order123', 'private_key');
    expect(result).toEqual({
      status: mockStatus.INITIATED,
      merchantOrderId: 'order123',
      amount: null,
      payinId: 'payin123',
      req_amount: 100,
      utr_id: ' ',
    });
  });

  test('should throw error on exception', async () => {
    getMerchantsDao.mockRejectedValue(new Error('DB Error'));
    await expect(payInService.checkPayInStatusService('payin123', 'MERCH1', 'order123', 'private_key')).rejects.toThrow('DB Error');
    expect(logger.error).toHaveBeenCalled();
  });
});

// Tests for payInIntentGenerateOrderService
describe('payInIntentGenerateOrderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should generate Razorpay order successfully', async () => {
    payInService.getPayInUrlService.mockResolvedValue(mockPayIn);
    razorpay.orders.create.mockResolvedValue({ id: 'rzp_order' });
    const result = await payInService.payInIntentGenerateOrderService('payin123', 100, true);
    expect(result).toEqual({ id: 'rzp_order' });
  });

  test('should generate Cashfree order successfully', async () => {
    payInService.getPayInUrlService.mockResolvedValue(mockPayIn);
    Cashfree.PGCreateOrder.mockResolvedValue({ order_id: 'cf_order' });
    const result = await payInService.payInIntentGenerateOrderService('payin123', 100, false);
    expect(result).toEqual({ payment_amount: 100, cashFreeResponse: { order_id: 'cf_order' }, payInId: 'payin123' });
  });

  test('should throw error for expired payIn', async () => {
    payInService.getPayInUrlService.mockRejectedValue(new BadRequestError('Expired'));
    await expect(payInService.payInIntentGenerateOrderService('payin123', 100, true)).rejects.toThrow(BadRequestError);
  });

  test('should throw error on Cashfree failure', async () => {
    payInService.getPayInUrlService.mockResolvedValue(mockPayIn);
    Cashfree.PGCreateOrder.mockRejectedValue({ response: { data: { message: 'CF Error' } } });
    await expect(payInService.payInIntentGenerateOrderService('payin123', 100, false)).rejects.toThrow('Error while creating CashFree Order');
    expect(logger.error).toHaveBeenCalled();
  });

  test('should throw error on exception', async () => {
    payInService.getPayInUrlService.mockRejectedValue(new Error('DB Error'));
    await expect(payInService.payInIntentGenerateOrderService('payin123', 100, true)).rejects.toThrow('DB Error');
    expect(logger.error).toHaveBeenCalled();
  });
});

// Tests for updatePaymentNotificationStatusService
describe('updatePaymentNotificationStatusService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should update payIn notification successfully', async () => {
    updatePayInUrlDao.mockResolvedValue(mockPayIn);
    getBankResponseDao.mockResolvedValue(mockBankResponse);
    merchantPayinCallback.mockResolvedValue({ success: true });
    const result = await payInService.updatePaymentNotificationStatusService('payin123', mockType.PAYIN, 'company1');
    expect(result).toEqual({ success: true });
  });

  test('should update payout notification successfully', async () => {
    getPayoutsDao.mockResolvedValue([{ id: 'payout1', merchant_id: 'm1', merchant_order_id: 'order1', amount: 100, status: mockStatus.SUCCESS, utr_id: 'UTR1', payout_details: { urls: { notify: 'http://notify.url' } } }]);
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    merchantPayoutCallback.mockResolvedValue({ success: true });
    const result = await payInService.updatePaymentNotificationStatusService('payout123', mockType.PAYOUT, 'company1');
    expect(result).toEqual({ success: true });
  });

  test('should throw BadRequestError for invalid type', async () => {
    await expect(payInService.updatePaymentNotificationStatusService('payin123', 'INVALID', 'company1')).rejects.toThrow(BadRequestError);
  });

  test('should throw NotFoundError if payIn not found', async () => {
    updatePayInUrlDao.mockResolvedValue(null);
    await expect(payInService.updatePaymentNotificationStatusService('payin123', mockType.PAYIN, 'company1')).rejects.toThrow(NotFoundError);
  });

  test('should throw NotFoundError if payout not found', async () => {
    getPayoutsDao.mockResolvedValue([]);
    await expect(payInService.updatePaymentNotificationStatusService('payout123', mockType.PAYOUT, 'company1')).rejects.toThrow(NotFoundError);
  });

  test('should throw NotFoundError if merchant not found for payout', async () => {
    getPayoutsDao.mockResolvedValue([{ id: 'payout1', merchant_id: 'invalid' }]);
    getMerchantsDao.mockResolvedValue([]);
    await expect(payInService.updatePaymentNotificationStatusService('payout123', mockType.PAYOUT, 'company1')).rejects.toThrow(NotFoundError);
  });

  test('should throw error on exception', async () => {
    updatePayInUrlDao.mockRejectedValue(new Error('DB Error'));
    await expect(payInService.updatePaymentNotificationStatusService('payin123', mockType.PAYIN, 'company1')).rejects.toThrow('DB Error');
    expect(logger.error).toHaveBeenCalled();
  });
});

// Tests for updateDepositStatusService
describe('updateDepositStatusService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should update deposit to SUCCESS and balances', async () => {
    getPayInForUpdateServiceDao.mockResolvedValue({ ...mockPayIn, status: mockStatus.BANK_MISMATCH, bank_response_id: 'resp123', amount: 100, created_at: new Date().toISOString(), merchant_id: 'm1', company_id: 'c1' });
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    getBankResponseDao.mockResolvedValue(mockBankResponse);
    getBankaccountDao.mockResolvedValue([mockBank]);
    getVendorsDao.mockResolvedValue([mockVendor]);
    updatePayInUrlDao.mockResolvedValue({ ...mockPayIn, status: mockStatus.SUCCESS });
    updateBotResponseDao.mockResolvedValue();
    updateMerchantBalanceDao.mockResolvedValue();
    payInService.updateCalculationTable.mockResolvedValue();
    const result = await payInService.updateDepositStatusService(mockConn, 'order123', 'Test Bank', 'c1', 'updater1');
    expect(result).toBeUndefined();
    expect(updatePayInUrlDao).toHaveBeenCalled();
    expect(merchantPayinCallback).toHaveBeenCalled();
  });

  test('should throw NotFoundError if payIn not found', async () => {
    getPayInForUpdateServiceDao.mockResolvedValue(null);
    await expect(payInService.updateDepositStatusService(mockConn, 'invalid', 'Test Bank', 'c1', 'updater1')).rejects.toThrow(NotFoundError);
  });

  test('should throw BadRequestError if status not BANK_MISMATCH', async () => {
    getPayInForUpdateServiceDao.mockResolvedValue({ ...mockPayIn, status: mockStatus.SUCCESS });
    await expect(payInService.updateDepositStatusService(mockConn, 'order123', 'Test Bank', 'c1', 'updater1')).rejects.toThrow(BadRequestError);
  });

  test('should throw NotFoundError if bank response not found', async () => {
    getPayInForUpdateServiceDao.mockResolvedValue(mockPayIn);
    getBankResponseDao.mockResolvedValue(null);
    await expect(payInService.updateDepositStatusService(mockConn, 'order123', 'Test Bank', 'c1', 'updater1')).rejects.toThrow(NotFoundError);
  });

  test('should throw NotFoundError if bank not found', async () => {
    getPayInForUpdateServiceDao.mockResolvedValue(mockPayIn);
    getBankResponseDao.mockResolvedValue(mockBankResponse);
    getBankaccountDao.mockResolvedValue([]);
    await expect(payInService.updateDepositStatusService(mockConn, 'order123', 'Test Bank', 'c1', 'updater1')).rejects.toThrow(NotFoundError);
  });

  test('should handle DUPLICATE status', async () => {
    getPayInForUpdateServiceDao.mockResolvedValue({ ...mockPayIn, status: mockStatus.BANK_MISMATCH });
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    getBankResponseDao.mockResolvedValue({ ...mockBankResponse, is_used: true });
    getSuccessPayInsDao.mockResolvedValue([mockPayIn]);
    getBankaccountDao.mockResolvedValue([mockBank]);
    getVendorsDao.mockResolvedValue([mockVendor]);
    updatePayInUrlDao.mockResolvedValue({ status: mockStatus.DUPLICATE });
    updateBotResponseDao.mockResolvedValue();
    await payInService.updateDepositStatusService(mockConn, 'order123', 'Test Bank', 'c1', 'updater1');
    expect(updatePayInUrlDao).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ status: mockStatus.DUPLICATE }), mockConn);
  });

  test('should throw error on exception', async () => {
    getPayInForUpdateServiceDao.mockRejectedValue(new Error('DB Error'));
    await expect(payInService.updateDepositStatusService(mockConn, 'order123', 'Test Bank', 'c1', 'updater1')).rejects.toThrow('DB Error');
    expect(logger.error).toHaveBeenCalled();
  });
});

// Tests for resetDepositService
describe('resetDepositService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should reset deposit successfully', async () => {
    getPayInForResetDao.mockResolvedValue({ ...mockPayIn, status: mockStatus.PENDING, user_submitted_utr: 'UTR123', bank_response_id: null, created_at: new Date().toISOString() });
    createResetHistoryService.mockResolvedValue();
    getBankResponseDao.mockResolvedValue({ is_used: false });
    updatePayInUrlDao.mockResolvedValue({ status: mockStatus.ASSIGNED });
    await payInService.resetDepositService(mockConn, 'order123', 'c1', 'updater1');
    expect(updatePayInUrlDao).toHaveBeenCalled();
  });

  test('should throw NotFoundError if payIn not found', async () => {
    getPayInForResetDao.mockResolvedValue(null);
    await expect(payInService.resetDepositService(mockConn, 'invalid', 'c1', 'updater1')).rejects.toThrow(NotFoundError);
  });

  test('should throw BadRequestError for non-resettable status', async () => {
    getPayInForResetDao.mockResolvedValue({ ...mockPayIn, status: mockStatus.SUCCESS });
    await expect(payInService.resetDepositService(mockConn, 'order123', 'c1', 'updater1')).rejects.toThrow(BadRequestError);
  });

  test('should update bank response if not used', async () => {
    getPayInForResetDao.mockResolvedValue({ ...mockPayIn, status: mockStatus.PENDING, bank_response_id: 'resp123' });
    createResetHistoryService.mockResolvedValue();
    getBankResponseDao.mockResolvedValue({ is_used: true });
    getSuccessPayInsDao.mockResolvedValue([]);
    updateBotResponseDao.mockResolvedValue();
    updatePayInUrlDao.mockResolvedValue({});
    await payInService.resetDepositService(mockConn, 'order123', 'c1', 'updater1');
    expect(updateBotResponseDao).toHaveBeenCalledWith('resp123', { is_used: false }, mockConn);
  });

  test('should throw error on exception', async () => {
    getPayInForResetDao.mockRejectedValue(new Error('DB Error'));
    await expect(payInService.resetDepositService(mockConn, 'order123', 'c1', 'updater1')).rejects.toThrow('DB Error');
    expect(logger.error).toHaveBeenCalled();
  });
});

// Tests for getPayinsBySearchService
describe('getPayinsBySearchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should fetch payins without history for merchant', async () => {
    const filters = { page: '1', limit: '10', search: 'test' };
    getUserHierarchysDao.mockResolvedValue(mockUserHierarchy);
    getMerchantByUserIdDao.mockResolvedValue([{ id: 'm1' }]);
    getPayinsWithoutHistoryDao.mockResolvedValue({ data: [], total: 0 });
    const result = await payInService.getPayinsBySearchService(filters, mockRole.MERCHANT, 'u1', mockRole.MERCHANT, false);
    expect(result).toEqual({ data: [], total: 0 });
  });

  test('should fetch payins with history for vendor', async () => {
    const filters = { page: '1', limit: '10' };
    getBankaccountDao.mockResolvedValue([{ id: 'b1' }]);
    getPayinsWithHistoryDao.mockResolvedValue({ data: [], total: 0 });
    const result = await payInService.getPayinsBySearchService(filters, mockRole.VENDOR, 'u1', mockRole.VENDOR, true);
    expect(result).toEqual({ data: [], total: 0 });
  });

  test('should throw BadRequestError for invalid pagination', async () => {
    const filters = { page: 'invalid', limit: '-1' };
    await expect(payInService.getPayinsBySearchService(filters, mockRole.MERCHANT, 'u1', mockRole.MERCHANT, false)).rejects.toThrow(BadRequestError);
  });

  test('should return empty for vendor with no banks', async () => {
    const filters = { page: '1', limit: '10' };
    getBankaccountDao.mockResolvedValue([]);
    const result = await payInService.getPayinsBySearchService(filters, mockRole.VENDOR, 'u1', mockRole.VENDOR, false);
    expect(result).toEqual([]);
  });

  test('should throw InternalServerError on error', async () => {
    getUserHierarchysDao.mockRejectedValue(new Error('DB Error'));
    await expect(payInService.getPayinsBySearchService({ page: '1', limit: '10' }, mockRole.MERCHANT, 'u1', mockRole.MERCHANT, false)).rejects.toThrow(InternalServerError);
    expect(logger.error).toHaveBeenCalled();
  });
});

// Tests for getPayinsSummaryService
describe('getPayinsSummaryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return payins summary successfully', async () => {
    getPayinsSumAndCountByStatusDao.mockResolvedValue({ total: 100, count: 10 });
    const result = await payInService.getPayinsSummaryService({ company_id: 'c1' });
    expect(result).toEqual({ total: 100, count: 10 });
  });

  test('should throw InternalServerError on error', async () => {
    getPayinsSumAndCountByStatusDao.mockRejectedValue(new Error('DB Error'));
    await expect(payInService.getPayinsSummaryService({})).rejects.toThrow(InternalServerError);
    expect(logger.error).toHaveBeenCalled();
  });
});

// Tests for processPayInService
describe('processPayInService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should process payIn to SUCCESS', async () => {
    payInService.getPayInUrlService.mockResolvedValue(mockPayIn);
    checkLockEdit.mockResolvedValue();
    getBankaccountDao.mockResolvedValue([mockBank]);
    getVendorsDao.mockResolvedValue([mockVendor]);
    getPayInForCheckDao.mockResolvedValue([]);
    getBankResponseDao.mockResolvedValue(mockBankResponse);
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    updatePayInUrlDao.mockResolvedValue({ ...mockPayIn, status: mockStatus.SUCCESS });
    updateBotResponseDao.mockResolvedValue();
    updateCalculationTable.mockResolvedValue();
    merchantPayinCallback.mockResolvedValue({});
    const payload = { merchantOrderId: 'order123', userSubmittedUtr: 'UTR123', amount: 100 };
    const result = await payInService.processPayInService(mockConn, payload, 'updater1');
    expect(result).toEqual({
      status: mockStatus.SUCCESS,
      merchantOrderId: 'order123',
      payinId: 'payin123',
      amount: 100,
      req_amount: 100,
      utr_id: 'UTR123',
    });
  });

  test('should handle DUPLICATE', async () => {
    payInService.getPayInUrlService.mockResolvedValue(mockPayIn);
    checkLockEdit.mockResolvedValue();
    getPayInForCheckDao.mockResolvedValue([{ id: 'dup1' }]);
    getBankaccountDao.mockResolvedValue([mockBank]);
    getVendorsDao.mockResolvedValue([mockVendor]);
    updatePayInUrlDao.mockResolvedValue({ status: mockStatus.DUPLICATE });
    merchantPayinCallback.mockResolvedValue({});
    const payload = { merchantOrderId: 'order123', userSubmittedUtr: 'UTR123', amount: 100 };
    const result = await payInService.processPayInService(mockConn, payload, 'updater1');
    expect(result).toEqual(expect.objectContaining({ status: mockStatus.DUPLICATE, message: 'Duplicate entry found!' }));
  });

  test('should handle BANK_MISMATCH with telegram', async () => {
    const payload = { ...mockPayload, from_telegram: true };
    payInService.getPayInUrlService.mockResolvedValue(mockPayIn);
    checkLockEdit.mockResolvedValue();
    getPayInForCheckDao.mockResolvedValue([]);
    getBankaccountDao.mockResolvedValueOnce([mockBank]).mockResolvedValueOnce([{ nick_name: 'Mismatch Bank' }]);
    getBankResponseDao.mockResolvedValue({ ...mockBankResponse, bank_id: 'bank2' });
    getVendorsDao.mockResolvedValue([mockVendor]);
    updatePayInUrlDao.mockResolvedValue({ status: mockStatus.BANK_MISMATCH });
    updateBotResponseDao.mockResolvedValue();
    sendBankMismatchMessageTelegramBot.mockResolvedValue();
    merchantPayinCallback.mockResolvedValue({});
    const result = await payInService.processPayInService(mockConn, payload, 'updater1');
    expect(result).toBe(true);
  });

  test('should handle PENDING if no bank response', async () => {
    payInService.getPayInUrlService.mockResolvedValue(mockPayIn);
    checkLockEdit.mockResolvedValue();
    getPayInForCheckDao.mockResolvedValue([]);
    getBankaccountDao.mockResolvedValue([mockBank]);
    getVendorsDao.mockResolvedValue([mockVendor]);
    getBankResponseDao.mockResolvedValue(null);
    updatePayInUrlDao.mockResolvedValue({ status: mockStatus.PENDING });
    merchantPayinCallback.mockResolvedValue({});
    const payload = { merchantOrderId: 'order123', userSubmittedUtr: 'UTR123', amount: 100 };
    const result = await payInService.processPayInService(mockConn, payload, 'updater1');
    expect(result).toEqual(expect.objectContaining({ status: mockStatus.PENDING }));
  });

  test('should handle frozen bank for admin', async () => {
    payInService.getPayInUrlService.mockResolvedValue(mockPayIn);
    checkLockEdit.mockResolvedValue();
    getPayInForCheckDao.mockResolvedValue([]);
    getBankaccountDao.mockResolvedValue([{ ...mockBank, config: { is_freeze: true } }]);
    getBankResponseDao.mockResolvedValue(mockBankResponse);
    updatePayInUrlDao.mockResolvedValue({ status: mockStatus.SUCCESS });
    const payload = { merchantOrderId: 'order123', userSubmittedUtr: 'UTR123', amount: 100 };
    const result = await payInService.processPayInService(mockConn, payload, 'updater1', true, false, mockRole.ADMIN);
    expect(result).toEqual(expect.objectContaining({ status: mockStatus.SUCCESS }));
  });

  test('should return message for frozen bank non-admin', async () => {
    payInService.getPayInUrlService.mockResolvedValue(mockPayIn);
    checkLockEdit.mockResolvedValue();
    getPayInForCheckDao.mockResolvedValue([]);
    getBankaccountDao.mockResolvedValue([{ ...mockBank, config: { is_freeze: true } }]);
    const payload = { merchantOrderId: 'order123', userSubmittedUtr: 'UTR123', amount: 100 };
    const result = await payInService.processPayInService(mockConn, payload, 'updater1', true, false, 'USER');
    expect(result).toEqual({ message: 'Bank Account is freezed. Please contact admin' });
  });

  test('should throw NotFoundError if bank not found', async () => {
    payInService.getPayInUrlService.mockResolvedValue(mockPayIn);
    getBankaccountDao.mockResolvedValue([]);
    const payload = { merchantOrderId: 'order123', userSubmittedUtr: 'UTR123', amount: 100 };
    await expect(payInService.processPayInService(mockConn, payload, 'updater1')).rejects.toThrow(NotFoundError);
  });

  test('should throw BadRequestError for missing telegram params', async () => {
    const payload = { ...mockPayload, from_telegram: true, telegramMessage: null, telegramBotToken: null };
    payInService.getPayInUrlService.mockResolvedValue(mockPayIn);
    checkLockEdit.mockResolvedValue();
    getPayInForCheckDao.mockResolvedValue([]);
    getBankaccountDao.mockResolvedValue([mockBank]);
    await expect(payInService.processPayInService(mockConn, payload, 'updater1')).rejects.toThrow(BadRequestError);
  });

  test('should throw error on exception', async () => {
    payInService.getPayInUrlService.mockRejectedValue(new Error('DB Error'));
    const payload = { merchantOrderId: 'order123', userSubmittedUtr: 'UTR123', amount: 100 };
    await expect(payInService.processPayInService(mockConn, payload, 'updater1')).rejects.toThrow('DB Error');
    expect(logger.error).toHaveBeenCalled();
  });
});

// Tests for telegramResponseService
describe('telegramResponseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should process telegram response successfully', async () => {
    const message = { photo: [{ file_id: 'file1' }], caption: 'order123', chat: { id: 'chat1' }, message_id: 'msg1' };
    getTelegramFilePath.mockResolvedValue('path1');
    getTelegramImageBase64.mockResolvedValue('base64');
    getImageContentFromOCr.mockResolvedValue({ utr: 'UTR123', amount: 100 });
    getPayInForTelegramResponseDao.mockResolvedValue(mockPayIn);
    getBankResponseDao.mockResolvedValue(mockBankResponse);
    getPayInForTelegramResponseArrayDao.mockResolvedValue([]);
    payInService.processPayInService.mockResolvedValue({ status: mockStatus.SUCCESS });
    sendTelegramMessage.mockResolvedValue();
    await payInService.telegramResponseService(mockConn, message);
    expect(payInService.processPayInService).toHaveBeenCalled();
  });

  test('should send error if no photo', async () => {
    const message = { caption: 'order123' };
    await payInService.telegramResponseService(mockConn, message);
    expect(logger.error).toHaveBeenCalledWith('No Telegram Message Photo found!', message);
  });

  test('should send error if no UTR or amount in OCR', async () => {
    const message = { photo: [{ file_id: 'file1' }], caption: 'order123', chat: { id: 'chat1' }, message_id: 'msg1' };
    getTelegramFilePath.mockResolvedValue('path1');
    getTelegramImageBase64.mockResolvedValue('base64');
    getImageContentFromOCr.mockResolvedValue({ utr: null });
    sendErrorMessageUtrOrAmountNotFoundImgTelegramBot.mockResolvedValue();
    sendTelegramMessage.mockResolvedValue();
    await payInService.telegramResponseService(mockConn, message);
    expect(sendErrorMessageUtrOrAmountNotFoundImgTelegramBot).toHaveBeenCalled();
  });

  test('should send error if no caption', async () => {
    const message = { photo: [{ file_id: 'file1' }], chat: { id: 'chat1' }, message_id: 'msg1' };
    getTelegramFilePath.mockResolvedValue('path1');
    getTelegramImageBase64.mockResolvedValue('base64');
    getImageContentFromOCr.mockResolvedValue({ utr: 'UTR123', amount: 100 });
    sendErrorMessageNoMerchantOrderIdFoundTelegramBot.mockResolvedValue();
    await payInService.telegramResponseService(mockConn, message);
    expect(sendErrorMessageNoMerchantOrderIdFoundTelegramBot).toHaveBeenCalled();
  });

  test('should send error if payIn not found', async () => {
    const message = { photo: [{ file_id: 'file1' }], caption: 'invalid', chat: { id: 'chat1' }, message_id: 'msg1' };
    getTelegramFilePath.mockResolvedValue('path1');
    getTelegramImageBase64.mockResolvedValue('base64');
    getImageContentFromOCr.mockResolvedValue({ utr: 'UTR123', amount: 100 });
    getPayInForTelegramResponseDao.mockResolvedValue(null);
    sendErrorMessageTelegram.mockResolvedValue();
    await payInService.telegramResponseService(mockConn, message);
    expect(sendErrorMessageTelegram).toHaveBeenCalled();
  });

  test('should handle already confirmed', async () => {
    const message = { photo: [{ file_id: 'file1' }], caption: 'order123', chat: { id: 'chat1' }, message_id: 'msg1' };
    getTelegramFilePath.mockResolvedValue('path1');
    getTelegramImageBase64.mockResolvedValue('base64');
    getImageContentFromOCr.mockResolvedValue({ utr: 'UTR123', amount: 100 });
    getPayInForTelegramResponseDao.mockResolvedValue({ ...mockPayIn, is_notified: true, status: mockStatus.SUCCESS });
    getPayInForTelegramResponseArrayDao.mockResolvedValue([]);
    sendAlreadyConfirmedMessageTelegramBot.mockResolvedValue();
    await payInService.telegramResponseService(mockConn, message);
    expect(sendAlreadyConfirmedMessageTelegramBot).toHaveBeenCalled();
  });

  test('should throw error on exception', async () => {
    const message = { photo: [{ file_id: 'file1' }] };
    getTelegramFilePath.mockRejectedValue(new Error('File Error'));
    await expect(payInService.telegramResponseService(mockConn, message)).rejects.toThrow('File Error');
    expect(logger.error).toHaveBeenCalled();
  });
});

// Tests for processPayInByImageService
describe('processPayInByImageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should process image to IMG_PENDING if no UTR', async () => {
    const payload = { base64Image: 'base64', merchantOrderId: 'order123', amount: 100, fileKey: 'file1' };
    payInService.getPayInUrlService.mockResolvedValue(mockPayIn);
    getImageContentFromOCr.mockResolvedValue(null);
    updatePayInUrlDao.mockResolvedValue({ config: { urls: { return: 'http://return.url' } } });
    const result = await payInService.processPayInByImageService(mockConn, payload);
    expect(result).toEqual({ status: 'IMG_PENDING', amount: 100, merchant_order_id: 'order123', return_url: 'http://return.url' });
  });

  test('should process image with UTR via processPayInService', async () => {
    const payload = { base64Image: 'base64', merchantOrderId: 'order123', amount: 100, fileKey: 'file1' };
    payInService.getPayInUrlService.mockResolvedValue(mockPayIn);
    getImageContentFromOCr.mockResolvedValue({ utr: 'UTR123' });
    payInService.processPayInService.mockResolvedValue({ status: mockStatus.SUCCESS });
    const result = await payInService.processPayInByImageService(mockConn, payload);
    expect(result).toEqual({ status: mockStatus.SUCCESS });
  });

  test('should return error if payIn already used', async () => {
    const payload = { base64Image: 'base64', merchantOrderId: 'order123', amount: 100, fileKey: 'file1' };
    payInService.getPayInUrlService.mockResolvedValue({ ...mockPayIn, one_time_used: true });
    const result = await payInService.processPayInByImageService(mockConn, payload);
    expect(result).toEqual({ error: 'This payin url is already used', result: { redirect_url: mockPayIn.config.urls.return } });
  });

  test('should throw error on OCR failure', async () => {
    const payload = { base64Image: 'base64', merchantOrderId: 'order123', amount: 100, fileKey: 'file1' };
    getImageContentFromOCr.mockRejectedValue(new Error('OCR Error'));
    await expect(payInService.processPayInByImageService(mockConn, payload)).rejects.toThrow('OCR Error');
    expect(logger.error).toHaveBeenCalled();
  });

  test('should throw error on exception', async () => {
    payInService.getPayInUrlService.mockRejectedValue(new Error('DB Error'));
    const payload = { base64Image: 'base64', merchantOrderId: 'order123', amount: 100, fileKey: 'file1' };
    await expect(payInService.processPayInByImageService(mockConn, payload)).rejects.toThrow('DB Error');
    expect(logger.error).toHaveBeenCalled();
  });
});

// Tests for disputeDuplicateTransactionService
describe('disputeDuplicateTransactionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should resolve dispute to SUCCESS without new entry', async () => {
    getPayInForDisputeServiceDao.mockResolvedValue({ ...mockPayIn, status: mockStatus.DISPUTE, bank_response_id: 'resp123', bank_acc_id: 'b1', amount: 100, created_at: new Date().toISOString() });
    getBankResponseDao.mockResolvedValue(mockBankResponse);
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    getBankaccountDao.mockResolvedValue([mockBank]);
    getVendorsDao.mockResolvedValue([mockVendor]);
    updatePayInUrlDao.mockResolvedValue({ status: mockStatus.SUCCESS });
    updateMerchantBalanceDao.mockResolvedValue();
    updateCalculationTable.mockResolvedValue();
    merchantPayinCallback.mockResolvedValue({});
    sendTelegramDisputeMessage.mockResolvedValue();
    newTableEntry.mockResolvedValue();
    const payload = { payInId: 'payin123', confirmed: true };
    await payInService.disputeDuplicateTransactionService(mockConn, payload, 'c1', 'updater1');
    expect(updatePayInUrlDao).toHaveBeenCalled();
  });

  test('should resolve with new entry for different merchant order', async () => {
    getPayInForDisputeServiceDao.mockResolvedValueOnce({ ...mockPayIn, status: mockStatus.DISPUTE }).mockResolvedValueOnce({ id: 'new_payin', bank_acc_id: 'b1', amount: 100 });
    getBankResponseDao.mockResolvedValue(mockBankResponse);
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    getBankaccountDao.mockResolvedValue([mockBank]);
    getVendorsDao.mockResolvedValue([mockVendor]);
    updatePayInUrlDao.mockResolvedValue({ status: mockStatus.SUCCESS });
    merchantPayinCallback.mockResolvedValue({});
    sendTelegramDisputeMessage.mockResolvedValue();
    newTableEntry.mockResolvedValue();
    const payload = { payInId: 'payin123', merchantOrderId: 'new_order', confirmed: true };
    await payInService.disputeDuplicateTransactionService(mockConn, payload, 'c1', 'updater1');
    expect(updatePayInUrlDao).toHaveBeenCalledTimes(2);
  });

  test('should throw BadRequestError if not DISPUTE', async () => {
    getPayInForDisputeServiceDao.mockResolvedValue({ ...mockPayIn, status: mockStatus.SUCCESS });
    await expect(payInService.disputeDuplicateTransactionService(mockConn, { payInId: 'payin123' }, 'c1', 'updater1')).rejects.toThrow(BadRequestError);
  });

  test('should throw NotFoundError if no bank response', async () => {
    getPayInForDisputeServiceDao.mockResolvedValue({ ...mockPayIn, status: mockStatus.DISPUTE, bank_response_id: null });
    await expect(payInService.disputeDuplicateTransactionService(mockConn, { payInId: 'payin123' }, 'c1', 'updater1')).rejects.toThrow(NotFoundError);
  });

  test('should throw error on exception', async () => {
    getPayInForDisputeServiceDao.mockRejectedValue(new Error('DB Error'));
    await expect(payInService.disputeDuplicateTransactionService(mockConn, { payInId: 'payin123' }, 'c1', 'updater1')).rejects.toThrow('DB Error');
    expect(logger.error).toHaveBeenCalled();
  });
});

// Tests for telegramCheckUTRService
describe('telegramCheckUTRService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should check UTR and process to SUCCESS', async () => {
    getBankResponseDao.mockResolvedValue(mockBankResponse);
    getPayInForTelegramUtrDao.mockResolvedValue(mockPayIn);
    createCheckUtrService.mockResolvedValue();
    payInService.processPayInService.mockResolvedValue({ status: mockStatus.SUCCESS });
    const result = await payInService.telegramCheckUTRService(mockConn, 'UTR123', 'order123', 'c1', 'updater1', mockRole.ADMIN);
    expect(result).toEqual({ status: mockStatus.SUCCESS });
  });

  test('should return message if already SUCCESS', async () => {
    getBankResponseDao.mockResolvedValue(mockBankResponse);
    getPayInForTelegramUtrDao.mockResolvedValue({ ...mockPayIn, status: mockStatus.SUCCESS, user_submitted_utr: 'UTR123' });
    const result = await payInService.telegramCheckUTRService(mockConn, 'UTR123', 'order123', 'c1', 'updater1', mockRole.ADMIN);
    expect(result).toEqual({ message: `${mockPayIn.merchant_order_id} is already confirmed with UTR123` });
  });

  test('should throw NotFoundError if UTR not found', async () => {
    getBankResponseDao.mockResolvedValue(null);
    await expect(payInService.telegramCheckUTRService(mockConn, 'invalid', 'order123', 'c1', 'updater1', mockRole.ADMIN)).rejects.toThrow(NotFoundError);
  });

  test('should throw BadRequestError for UTR mismatch', async () => {
    getBankResponseDao.mockResolvedValue(mockBankResponse);
    getPayInForTelegramUtrDao.mockResolvedValue({ ...mockPayIn, user_submitted_utr: 'different' });
    await expect(payInService.telegramCheckUTRService(mockConn, 'UTR123', 'order123', 'c1', 'updater1', mockRole.ADMIN)).rejects.toThrow(BadRequestError);
  });

  test('should throw error on exception', async () => {
    getBankResponseDao.mockRejectedValue(new Error('DB Error'));
    await expect(payInService.telegramCheckUTRService(mockConn, 'UTR123', 'order123', 'c1', 'updater1', mockRole.ADMIN)).rejects.toThrow('DB Error');
    expect(logger.error).toHaveBeenCalled();
  });
});

// Tests for getPayinsServiceById
describe('getPayinsServiceById', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return payIn by ID', async () => {
    getPayinsForServiccDao.mockResolvedValue(mockPayIn);
    const result = await payInService.getPayinsServiceById('payin123');
    expect(result).toEqual(mockPayIn);
  });

  test('should throw error on exception', async () => {
    getPayinsForServiccDao.mockRejectedValue(new Error('DB Error'));
    await expect(payInService.getPayinsServiceById('payin123')).rejects.toThrow('DB Error');
    expect(logger.error).toHaveBeenCalled();
  });
});

// Tests for updateUtrPayinService
describe('updateUtrPayinService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should update UTR successfully', async () => {
    updatePayInUrlDao.mockResolvedValue({ user_submitted_utr: 'UTR123FAILED' });
    const result = await payInService.updateUtrPayinService(mockConn, 'payin123', 'u1', 'UTR123');
    expect(result).toEqual({ user_submitted_utr: 'UTR123FAILED' });
  });

  test('should handle FAILED suffix', async () => {
    updatePayInUrlDao.mockResolvedValue({ user_submitted_utr: 'UTR123FAILED' });
    const result = await payInService.updateUtrPayinService(mockConn, 'payin123', 'u1', 'UTR123FAILED');
    expect(result).toEqual({ user_submitted_utr: 'UTR123FAILED' });
  });

  test('should throw error on exception', async () => {
    updatePayInUrlDao.mockRejectedValue(new Error('DB Error'));
    await expect(payInService.updateUtrPayinService(mockConn, 'payin123', 'u1', 'UTR123')).rejects.toThrow('DB Error');
    expect(logger.error).toHaveBeenCalled();
  });
});

// Tests for checkPendingPayinStatusService
describe('checkPendingPayinStatusService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should process pending payins to SUCCESS', async () => {
    getPayInPendingDao.mockResolvedValue([mockPayIn]);
    getBankResponsePendingDao.mockResolvedValue(mockBankResponse);
    getBankaccountDao.mockResolvedValue([mockBank]);
    getMerchantsByCodeDao.mockResolvedValue([mockMerchant]);
    getVendorsDao.mockResolvedValue([mockVendor]);
    updatePayInUrlDao.mockResolvedValue({ status: mockStatus.SUCCESS });
    updateBotResponseDao.mockResolvedValue();
    updateCalculationTable.mockResolvedValue();
    merchantPayinCallback.mockResolvedValue({});
    newTableEntry.mockResolvedValue();
    const result = await payInService.checkPendingPayinStatusService(mockConn, 'u1', 'c1', 'Test User');
    expect(result).toEqual(['payin123']);
  });

  test('should handle bank mismatch in pending', async () => {
    getPayInPendingDao.mockResolvedValue([mockPayIn]);
    getBankResponsePendingDao.mockResolvedValue({ ...mockBankResponse, bank_id: 'bank2' });
    getBankaccountDao.mockResolvedValue([mockBank]);
    getMerchantsByCodeDao.mockResolvedValue([mockMerchant]);
    updatePayInUrlDao.mockResolvedValue({ status: mockStatus.BANK_MISMATCH });
    updateBotResponseDao.mockResolvedValue();
    merchantPayinCallback.mockResolvedValue({});
    const result = await payInService.checkPendingPayinStatusService(mockConn, 'u1', 'c1', 'Test User');
    expect(result).toEqual(['payin123']);
    expect(logger.warn).toHaveBeenCalled();
  });

  test('should handle amount dispute in pending', async () => {
    getPayInPendingDao.mockResolvedValue([{ ...mockPayIn, amount: 200 }]);
    getBankResponsePendingDao.mockResolvedValue({ ...mockBankResponse, amount: 100 });
    getBankaccountDao.mockResolvedValue([mockBank]);
    getMerchantsByCodeDao.mockResolvedValue([mockMerchant]);
    getVendorsDao.mockResolvedValue([mockVendor]);
    updatePayInUrlDao.mockResolvedValue({ status: mockStatus.DISPUTE });
    updateBotResponseDao.mockResolvedValue();
    updateCalculationTable.mockResolvedValue();
    merchantPayinCallback.mockResolvedValue({});
    const result = await payInService.checkPendingPayinStatusService(mockConn, 'u1', 'c1', 'Test User');
    expect(result).toEqual(['payin123']);
    expect(logger.warn).toHaveBeenCalled();
  });

  test('should return empty if no pending payins', async () => {
    getPayInPendingDao.mockResolvedValue([]);
    const result = await payInService.checkPendingPayinStatusService(mockConn, 'u1', 'c1', 'Test User');
    expect(result).toEqual([]);
  });

  test('should throw error on exception', async () => {
    getPayInPendingDao.mockRejectedValue(new Error('DB Error'));
    await expect(payInService.checkPendingPayinStatusService(mockConn, 'u1', 'c1', 'Test User')).rejects.toThrow('DB Error');
    expect(logger.error).toHaveBeenCalled();
  });
});

// Tests for verifyPayinsService
describe('verifyPayinsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should verify payIn successfully', async () => {
    getPayinsForServiccDao.mockResolvedValue(mockPayIn);
    getUserByIdDao.mockResolvedValue([{ role: mockRole.USER }]);
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    getMerchantBankDao.mockResolvedValue([mockBank]);
    updatePayInUrlDao.mockResolvedValue({ ...mockPayIn, one_time_used: false });
    const result = await payInService.verifyPayinsService(mockConn, 'order123', { user_ip: '127.0.0.1' }, 'false');
    expect(result).toEqual(expect.objectContaining({ expiryTime: mockPayIn.expiration_date, isAdmin: false }));
    expect(usedTokens.add).toHaveBeenCalledWith('order123');
  });

  test('should return error if already used', async () => {
    getPayinsForServiccDao.mockResolvedValue({ ...mockPayIn, one_time_used: true });
    getUserByIdDao.mockResolvedValue([{ role: mockRole.USER }]);
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    updatePayInUrlDao.mockResolvedValue({ one_time_used: true });
    const result = await payInService.verifyPayinsService(mockConn, 'order123', { user_ip: '127.0.0.1' }, 'false');
    expect(result).toEqual({ error: 'This payin url is already used', result: { redirect_url: mockPayIn.config.urls.return } });
  });

  test('should throw BadRequestError for invalid order ID', async () => {
    getPayinsForServiccDao.mockResolvedValue(null);
    await expect(payInService.verifyPayinsService(mockConn, 'invalid', { user_ip: '127.0.0.1' }, 'false')).rejects.toThrow(BadRequestError);
  });

  test('should throw InternalServerError if update fails', async () => {
    getPayinsForServiccDao.mockResolvedValue(mockPayIn);
    getUserByIdDao.mockResolvedValue([{ role: mockRole.USER }]);
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    updatePayInUrlDao.mockResolvedValue(null);
    await expect(payInService.verifyPayinsService(mockConn, 'order123', { user_ip: '127.0.0.1' }, 'false')).rejects.toThrow(InternalServerError);
  });

  test('should handle oneTimeUsed true', async () => {
    getPayinsForServiccDao.mockResolvedValue(mockPayIn);
    getUserByIdDao.mockResolvedValue([{ role: mockRole.USER }]);
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    updatePayInUrlDao.mockResolvedValue({ one_time_used: true });
    const result = await payInService.verifyPayinsService(mockConn, 'order123', { user_ip: '127.0.0.1' }, 'true');
    expect(result).toEqual({ error: 'This payin url is already used', result: { redirect_url: mockPayIn.config.urls.return } });
  });

  test('should throw error on exception', async () => {
    getPayinsForServiccDao.mockRejectedValue(new Error('DB Error'));
    await expect(payInService.verifyPayinsService(mockConn, 'order123', { user_ip: '127.0.0.1' }, 'false')).rejects.toThrow('DB Error');
    expect(logger.error).toHaveBeenCalled();
  });
});

// Tests for generateUpiUrlService
describe('generateUpiUrlService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should generate UPI URLs successfully', async () => {
    const payload = { amount: 100, payeeVPA: 'test@upi', payeeName: 'Test', transactionNote: 'Payment' };
    const result = await payInService.generateUpiUrlService(payload);
    expect(result).toHaveProperty('phonepeUrl');
    expect(result).toHaveProperty('gpayUrl');
    expect(result).toHaveProperty('paytmUrl');
    expect(result).toHaveProperty('genericUpiUrl');
    expect(result.transactionId).toBeDefined();
  });

  test('should throw BadRequestError for invalid amount', async () => {
    await expect(payInService.generateUpiUrlService({ amount: -10, payeeVPA: 'test@upi' })).rejects.toThrow(BadRequestError);
  });

  test('should throw BadRequestError for invalid VPA', async () => {
    await expect(payInService.generateUpiUrlService({ amount: 100, payeeVPA: 'invalid' })).rejects.toThrow(BadRequestError);
  });

  test('should throw error on exception', async () => {
    generateUUID.mockImplementation(() => { throw new Error('UUID Error'); });
    await expect(payInService.generateUpiUrlService({ amount: 100, payeeVPA: 'test@upi' })).rejects.toThrow('UUID Error');
    expect(logger.error).toHaveBeenCalled();
  });
});

// Tests for updateCalculationTable
describe('updateCalculationTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should update calculation table successfully', async () => {
    getCalculationforCronDao.mockResolvedValue([{ id: 'calc1' }]);
    updateCalculationBalanceDao.mockResolvedValue({ id: 'calc1' });
    trackVendorsNetBalance.mockResolvedValue();
    await payInService.updateCalculationTable('u1', { amount: 100, payinCommission: 20 }, mockConn);
    expect(updateCalculationBalanceDao).toHaveBeenCalled();
  });

  test('should throw BadRequestError for invalid amount', async () => {
    await expect(payInService.updateCalculationTable('u1', { amount: 'invalid', payinCommission: 20 }, mockConn)).rejects.toThrow(BadRequestError);
  });

  test('should throw NotFoundError if calculation not found', async () => {
    getCalculationforCronDao.mockResolvedValue([]);
    await expect(payInService.updateCalculationTable('u1', { amount: 100, payinCommission: 20 }, mockConn)).rejects.toThrow(NotFoundError);
  });

  test('should throw error on exception', async () => {
    getCalculationforCronDao.mockRejectedValue(new Error('DB Error'));
    await expect(payInService.updateCalculationTable('u1', { amount: 100, payinCommission: 20 }, mockConn)).rejects.toThrow('DB Error');
    expect(logger.error).toHaveBeenCalled();
  });
});

// Tests for getOtherSuccessPayIns
describe('getOtherSuccessPayIns', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return success payIns by bank response ID', async () => {
    getSuccessPayInsDao.mockResolvedValueOnce([{ id: 'success1' }]).mockResolvedValueOnce([]);
    const result = await payInService.getOtherSuccessPayIns(mockBankResponse, true);
    expect(result).toEqual([{ id: 'success1' }]);
  });

  test('should fallback to UTR if no bank response payIns', async () => {
    getSuccessPayInsDao.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'success2' }]);
    const result = await payInService.getOtherSuccessPayIns(mockBankResponse, true);
    expect(result).toEqual([{ id: 'success2' }]);
  });

  test('should return empty if none found', async () => {
    getSuccessPayInsDao.mockResolvedValue([]);
    const result = await payInService.getOtherSuccessPayIns(mockBankResponse, true);
    expect(result).toEqual([]);
  });

  test('should throw error on exception', async () => {
    getSuccessPayInsDao.mockRejectedValue(new Error('DB Error'));
    await expect(payInService.getOtherSuccessPayIns(mockBankResponse)).rejects.toThrow('DB Error');
    expect(logger.error).toHaveBeenCalled();
  });
});

// Tests for updatePayInService
describe('updatePayInService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should update amount successfully', async () => {
    getPayInForUpdateDao.mockResolvedValue(mockPayIn);
    getBankResponseDao.mockResolvedValue(mockBankResponse);
    getVendorsDao.mockResolvedValue([mockVendor]);
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    getBankaccountDao.mockResolvedValue([mockBank]);
    getAllCalculationforCronDao.mockResolvedValue([{ id: 'calc1', created_at: new Date().toISOString() }]);
    updateBankResponseDao.mockResolvedValue({ amount: 200 });
    updateBankaccountDao.mockResolvedValue([{ balance: 200 }]);
    updateVendorDao.mockResolvedValue({ balance: 200 });
    updateCalculationBalanceDao.mockResolvedValue({ id: 'calc1' });
    trackVendorsNetBalance.mockResolvedValue();
    getAllUsersDao.mockResolvedValue([{ user_name: 'Updater' }]);
    updatePayInUrlDao.mockResolvedValue({ ...mockPayIn, amount: 200 });
    newTableEntry.mockResolvedValue();
    const payload = { amount: 200 };
    const result = await payInService.updatePayInService(mockConn, payload, 'order123', 'u1', 'c1');
    expect(result).toEqual(expect.objectContaining({ amount: 200 }));
  });

  test('should update UTR successfully', async () => {
    getPayInForUpdateDao.mockResolvedValue(mockPayIn);
    getBankResponseDao.mockResolvedValue(mockBankResponse);
    getAllUsersDao.mockResolvedValue([{ user_name: 'Updater' }]);
    getBankResponseDaoById.mockResolvedValue(mockBankResponse);
    getBankaccountDao.mockResolvedValue([mockBank]);
    updateBankResponseDao.mockResolvedValue({ utr: 'NEW_UTR' });
    updatePayInUrlDao.mockResolvedValue({ user_submitted_utr: null });
    newTableEntry.mockResolvedValue();
    const payload = { utr: 'NEW_UTR' };
    const result = await payInService.updatePayInService(mockConn, payload, 'order123', 'u1', 'c1');
    expect(result).toEqual(expect.objectContaining({ user_submitted_utr: null }));
  });

  test('should update bank_acc_id successfully', async () => {
    getPayInForUpdateDao.mockResolvedValue(mockPayIn);
    getBankResponseDao.mockResolvedValue(mockBankResponse);
    getAllUsersDao.mockResolvedValue([{ user_name: 'Updater' }]);
    getBankResponseDaoById.mockResolvedValue(mockBankResponse);
    getBankaccountDao.mockResolvedValueOnce([mockBank]).mockResolvedValueOnce([{ id: 'new_bank', user_id: 'new_user' }]);
    getVendorsDao.mockResolvedValue([mockVendor]);
    getAllCalculationforCronDao.mockResolvedValue([{ id: 'calc1', created_at: new Date().toISOString() }]);
    updateBankaccountDao.mockResolvedValueOnce([{ balance: 0 }]).mockResolvedValueOnce([{ balance: 100 }]);
    updateCalculationBalanceDao.mockResolvedValue({ id: 'calc1' });
    trackVendorsNetBalance.mockResolvedValue();
    updateBankResponseDao.mockResolvedValue({ bank_id: 'new_bank' });
    updatePayInUrlDao.mockResolvedValue({ bank_acc_id: 'new_bank' });
    newTableEntry.mockResolvedValue();
    const payload = { bank_acc_id: 'new_bank' };
    await payInService.updatePayInService(mockConn, payload, 'order123', 'u1', 'c1');
  });

  test('should throw BadRequestError if no update fields', async () => {
    await expect(payInService.updatePayInService(mockConn, {}, 'order123', 'u1', 'c1')).rejects.toThrow(BadRequestError);
  });

  test('should throw BadRequestError if same bank ID', async () => {
    getPayInForUpdateDao.mockResolvedValue(mockPayIn);
    getBankResponseDao.mockResolvedValue(mockBankResponse);
    getBankaccountDao.mockResolvedValue([mockBank]);
    const payload = { bank_acc_id: mockBank.id };
    await expect(payInService.updatePayInService(mockConn, payload, 'order123', 'u1', 'c1')).rejects.toThrow(BadRequestError);
  });

  test('should throw error on exception', async () => {
    getPayInForUpdateDao.mockRejectedValue(new Error('DB Error'));
    await expect(payInService.updatePayInService(mockConn, { amount: 200 }, 'order123', 'u1', 'c1')).rejects.toThrow('DB Error');
    expect(logger.error).toHaveBeenCalled();
  });
});