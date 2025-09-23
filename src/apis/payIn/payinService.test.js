jest.mock('../../utils/db.js', () => ({
  createPool: jest.fn(),
  ...jest.requireActual('../../utils/db.js'),
}));
/* eslint-disable no-unused-vars */
const { cashfree } = require('../../webhooks/cashfree.js');
const { BadRequestError, NotFoundError, InternalServerError } = require('../../utils/appErrors');
const {
  generatePayInUrlByHashService,
  generatePayInUrlService,
  expirePayInUrlService,
  assignedBankToPayInUrlService,
  checkPayInStatusService,
  updatePaymentNotificationStatusService,
  updateDepositStatusService,
  resetDepositService,
  processPayInService,
  telegramResponseService,
  processPayInByImageService,
  disputeDuplicateTransactionService,
  telegramCheckUTRService,
  getPayinsServiceById,
  updateUtrPayinService,
  checkPendingPayinStatusService,
} = require('./payInService');
const { v4: uuidv4 } = require('uuid');
const { nanoid } = require('nanoid');
const dayjs = require('dayjs');
const { executeQuery } = require('../../utils/db');
import { cashfreeWebHook } from '../../webhooks/cashfree.js';
import * as telegramUtils from '../../utils/sendTelegramMessages.js';
import { helpers } from '@elastic/elasticsearch';

jest.mock('./payInService', () => ({
  ...jest.requireActual('./payInService'), // Preserve other exports
  processPayInService: jest.fn().mockResolvedValue({
    status: 'SUCCESS',
    merchantOrderId: 'order123',
    payinId: 'payin123',
    amount: 100,
    req_amount: 100,
    utr_id: 'utr123',
  }),
  getPayInIntentDao: jest.fn(), // Mock getPayInIntentDao
}));
// Add to the top of the test file, with other mocks
jest.mock('../../utils/db.js');


jest.mock('../../webhooks/cashfree.js', () => {
  const mockCashfreeInstance = {
    PGCreateOrder: jest.fn().mockResolvedValue({ order_id: 'cashfree_order', payment_link: 'http://payment.link' }),
    PGPayOrder: jest.fn().mockResolvedValue({ data: { payment_status: 'SUCCESS' } }),
    PGVerifyWebhookSignature: jest.fn().mockReturnValue(true),
  };
  return {
    cashfree: mockCashfreeInstance,
    createCashfreeOrder: jest.fn().mockResolvedValue({ order_id: 'cashfree_order', payment_link: 'http://payment.link' }),
    payOrder: jest.fn().mockResolvedValue({ data: { payment_status: 'SUCCESS' } }),
    cashfreeWebHook: jest.fn().mockImplementation(async (req, res) => {
      const { rawBody, headers, body } = req;
      const signature = headers['x-webhook-signature'];
      const timestamp = headers['x-webhook-timestamp'];
      const { order, payment } = body.data;

      try {
        await require('../../webhooks/cashfree').cashfree.PGVerifyWebhookSignature(signature, rawBody, timestamp);
        const payIn = await require('./payInDao').getPayInIntentDao(order.order_id);
        if (!payIn) {
          require('../../utils/logger').logger.error('PayIn not found for order_id:', order.order_id);
          return require('../../utils/responseHandlers').sendSuccess(res, 200, 'Webhook received successfully', {});
        }
        if (payment.payment_status !== 'SUCCESS') {
          require('../../utils/logger').logger.error('Payment is either Failed or User Aborted:', payment.payment_status);
          return require('../../utils/responseHandlers').sendSuccess(res, 200, 'Webhook received successfully', {});
        }
        await require('../bankResponse/bankResponseServices').createBankResponseService(
          `${order.order_amount} nil ${payment.bank_reference} ${payIn.bank_acc_id}`,
          payIn.company_id,
          'BOT',
          'CASHFREE'
        );
        await require('../../utils/db').transactionWrapper(require('./payInService').processPayInService)({
          merchantOrderId: order.order_id,
          userSubmittedUtr: payment.bank_reference,
          amount: order.order_amount,
        });
        return require('../../utils/responseHandlers').sendSuccess(res, 200, 'Webhook received successfully', {});
      } catch (err) {
        require('../../utils/logger').logger.error('Cashfree webhook error:', err.message);
        return require('../../utils/responseHandlers').sendSuccess(res, 200, 'Webhook received successfully', {});
      }
    }),
  };
});

  jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  },
}));

// Mock config
jest.mock('../../config/config.js', () => ({
  env: 'test',
  databaseWriterUrl: 'postgres://localhost:5432/testdb_writer',
  databaseReaderUrl: 'postgres://localhost:5432/testdb_reader',
  cashfree: {
    clientIdTest: 'test-client-id',
    clientIdProd: 'prod-client-id',
    clientSecretTest: 'test-client-secret',
    clientSecretProd: 'prod-client-secret',
  },
  reactPaymentOrigin: 'https://example.com',
  telegramOcrBotToken: 'test-telegram-token',
}));

// Mock cashfree-pg
jest.mock('cashfree-pg', () => ({
  Cashfree: jest.fn().mockImplementation(() => ({
    PGCreateOrder: jest.fn().mockResolvedValue({ order_id: 'cashfree_order', payment_link: 'http://payment.link' }),
    PGPayOrder: jest.fn().mockResolvedValue({ data: { payment_status: 'SUCCESS' } }),
    PGVerifyWebhookSignature: jest.fn().mockReturnValue(true),
  })),
  CFEnvironment: {
    PRODUCTION: 'PRODUCTION',
    SANDBOX: 'SANDBOX',
  },
}));

jest.mock('../../utils/responseHandlers.js', () => ({
  sendSuccess: jest.fn((res, statusCode, message, finalRes = {}) => {
    if (res.req.method !== 'GET') {
      require('../../utils/logger').logger.info(message, { status: statusCode, data: finalRes.data || {} });
    } else {
      require('../../utils/logger').logger.info(message, { status: statusCode });
    }
    res.status(statusCode).json({ status: statusCode, message, data: finalRes.data || {} });
  }),
}));

// Mock database utilities and other dependencies (unchanged from your original code)
jest.mock('../../utils/db', () => {
  const mockPool = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    }),
    end: jest.fn().mockResolvedValue(),
    on: jest.fn(),
  };
  return {
    createPool: jest.fn().mockReturnValue(mockPool),
    writerPool: mockPool,
  createPool: jest.fn(() => mockPool),
    executeQuery: jest.fn().mockImplementation((sql, params) => {
      const sqlStr = typeof sql === 'string' ? sql.toLowerCase() : '';
      if (sqlStr.includes('bankaccount')) {
        return Promise.resolve({ rows: [mockBank] });
      }
      if (sqlStr.includes('payin')) {
        return Promise.resolve({ rows: [mockPayIn] });
      }
      return Promise.resolve({ rows: [] });
    }),
    getConnection: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    }),
    beginTransaction: jest.fn().mockResolvedValue(),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    buildSelectQuery: jest.fn().mockImplementation((query, filters) => {
      if (!filters) return [query, []];
      const conditions = [];
      const params = [];
      let paramIndex = 1;
      for (const [key, value] of Object.entries(filters)) {
        if (key === 'config_merchants_contains') {
          conditions.push(`config->'merchants' @> $${paramIndex}`);
          params.push(JSON.stringify([value]));
        } else {
          conditions.push(`${key} = $${paramIndex}`);
          params.push(value);
        }
        paramIndex++;
      }
      return [`${query} WHERE ${conditions.join(' AND ')}`, params];
    }),
  };
});

// Mock other dependencies (unchanged)
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn().mockResolvedValue({ rows: [] }),
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    }),
    end: jest.fn().mockResolvedValue(),
    on: jest.fn(),
  })),
}));
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('order123'),
}));
jest.mock('nanoid', () => ({
  nanoid: jest.fn().mockReturnValue('abcde'),
}));
jest.mock('dayjs', () => {
  const actualDayjs = jest.requireActual('dayjs');
  const mockDayjs = jest.fn((date) => {
    const instance = actualDayjs(date || new Date());
    return {
      ...instance,
      add: jest.fn((value, unit) => actualDayjs(instance).add(value, unit)),
      format: jest.fn().mockReturnValue(instance.format()),
      toDate: jest.fn().mockReturnValue(instance.toDate()),
      toISOString: jest.fn().mockReturnValue(instance.toISOString()),
      isAfter: jest.fn().mockReturnValue(false),
    };
  });
  mockDayjs.tz = jest.fn().mockReturnValue({
    format: jest.fn().mockReturnValue(actualDayjs().format()),
  });
  return mockDayjs;
});
jest.mock('../../utils/sockets.js', () => ({
  newTableEntry: jest.fn().mockResolvedValue(),
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
      create: jest.fn().mockResolvedValue({ id: 'razorpay_order', receipt: 'order123' }),
    },
  },
}));
jest.mock('../merchants/merchantDao.js', () => ({
  getMerchantsByCodeDao: jest.fn(),
  getMerchantsDao: jest.fn(),
  getMerchantByUserIdDao: jest.fn(),
  updateMerchantBalanceDao: jest.fn().mockResolvedValue({}),
}));
jest.mock('../bankAccounts/bankAccountDao.js', () => ({
  getBankaccountDao: jest.fn(),
  getMerchantBankDao: jest.fn(),
  updateBankaccountDao: jest.fn().mockResolvedValue({}),
}));
jest.mock('./payInDao.js', () => ({
  getPayInDao: jest.fn(),
  generatePayInUrlDao: jest.fn(),
  updatePayInUrlDao: jest.fn(),
  getPayinsForServiccDao: jest.fn(),
  getPayInForCheckDao: jest.fn(),
  getPayInForCheckStatusDao: jest.fn(),
  getPayinsWithHistoryDao: jest.fn(),
  getPayInPendingDao: jest.fn(),
  getPayinsSumAndCountByStatusDao: jest.fn(),
  getPayInForUpdateServiceDao: jest.fn(),
  getPayInForDisputeServiceDao: jest.fn(),
  getPayInForTelegramUtrDao: jest.fn(),
  getPayInForResetDao: jest.fn(),
  getSuccessPayInsDao: jest.fn(),
  getPayInForUpdateDao: jest.fn(),
  getPayInForTelegramResponseDao: jest.fn(),
  getPayinsWithoutHistoryDao: jest.fn(),
  getPayInForTelegramResponseArrayDao: jest.fn(),
  getPayInIntentDao: jest.fn(),
}));
jest.mock('../bankResponse/bankResponseDao.js', () => ({
  getBankResponseDao: jest.fn(),
  getBankResponseDaoById: jest.fn(),
  getBankResponsePendingDao: jest.fn(),
  updateBankResponseDao: jest.fn().mockResolvedValue({}),
  updateBotResponseDao: jest.fn().mockResolvedValue({}),
}));
jest.mock('../calculation/calculationDao.js', () => ({
  getAllCalculationforCronDao: jest.fn(),
  getCalculationforCronDao: jest.fn(),
  updateCalculationBalanceDao: jest.fn().mockResolvedValue({}),
}));
jest.mock('../vendors/vendorDao.js', () => ({
  getVendorsDao: jest.fn(),
  updateVendorDao: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../helpers/index.js', () => ({
  calculateCommission: jest.fn().mockReturnValue(10),
  calculateDuration: jest.fn().mockReturnValue(1000),
  getImageContentFromOCr: jest.fn().mockResolvedValue({ utr: 'utr123', amount: 100 }),
  getTelegramFilePath: jest.fn().mockResolvedValue('file_path'),
  getTelegramImageBase64: jest.fn().mockReturnValue('base64_image'),
}));
jest.mock('../../utils/sendTelegramMessages.js', () => ({
  sendAlreadyConfirmedMessageTelegramBot: jest.fn().mockResolvedValue(),
  sendBankMismatchMessageTelegramBot: jest.fn().mockResolvedValue(),
  sendDisputeMessageTelegramBot: jest.fn().mockResolvedValue(),
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
  sendBankNotAssignedAlertTelegram: jest.fn().mockResolvedValue(),
}));
jest.mock('../../callBacksAndWebHook/merchantCallBacks.js', () => ({
  merchantPayinCallback: jest.fn().mockResolvedValue(),
  merchantPayoutCallback: jest.fn().mockResolvedValue(),
}));
jest.mock('../../utils/advisoryLock.js', () => ({
  checkLockEdit: jest.fn().mockResolvedValue(),
}));
jest.mock('../../utils/hashUtils.js', () => ({
  createHash: jest.fn().mockReturnValue('hash123'),
}));
jest.mock('../../utils/redisClient.js', () => ({
  getRedisClient: jest.fn().mockReturnValue({
    set: jest.fn().mockResolvedValue('OK'),
    expire: jest.fn().mockResolvedValue(1),
  }),
}));
jest.mock('../../utils/generateUUID.js', () => ({
  generateUUID: jest.fn().mockReturnValue('123e4567-e89b-12d3-a456-426614174000'),
}));
jest.mock('../../utils/trackVendorsNetBalance.js', () => ({
  trackVendorsNetBalance: jest.fn().mockResolvedValue(),
}));
jest.mock('../company/companyDao.js', () => ({
  getCompanyByIDDao: jest.fn(),
}));
jest.mock('../users/userDao.js', () => ({
  getAllUsersDao: jest.fn(),
  getUserByIdDao: jest.fn(),
}));
jest.mock('../userHierarchy/userHierarchyDao.js', () => ({
  getUserHierarchysDao: jest.fn(),
}));
jest.mock('../../utils/index.js', () => ({
  stringifyJSON: jest.fn().mockImplementation((data) => JSON.stringify(data)),
}));
jest.mock('../../app.js', () => ({
  usedTokens: new Set(),
}));
jest.mock('../checkutr/checkUtrServices.js', () => ({
  createCheckUtrService: jest.fn().mockResolvedValue(),
}));
jest.mock('../resetHistory/resetServices.js', () => ({
  createResetHistoryService: jest.fn().mockResolvedValue(),
}));
jest.mock('querystring', () => ({
  stringify: jest.fn().mockReturnValue('tr=IND123e4567e89b12d3a456426614174000&am=100.00&pa=test@upi&pn=TestPayee&tn=Payment&cu=INR'),
}));
jest.mock('chalk', () => ({
  bgCyanBright: jest.fn().mockReturnValue('Database connected successfully'),
  yellow: jest.fn().mockReturnValue('DB connection failed'),
  underline: { red: jest.fn().mockReturnValue('PostgreSQL connection pool closed') },
}));
jest.mock('../bankResponse/bankResponseServices.js', () => ({
  createBankResponseService: jest.fn().mockResolvedValue({}),
}));

// Mock data (unchanged)
const mockPayIn = {
  id: 'payin123',
  merchant_id: 'merchant1',
  merchant_order_id: 'order123',
  config: { urls: { return: 'http://return.url', notify: 'http://notify.url' } },
  expiration_date: new Date(Date.now() + 86400000).toISOString(),
  amount: 100,
  currency: 'INR',
  bank_response_id: 'bank_response1',
  duration: 86400,
  one_time_used: false,
  status: 'INITIATED',
  created_by: 'user1',
  user: 'user1',
  merchant_details: { merchant_code: 'merchant_code' },
  bank_res_details: { utr: null, amount: 0 },
  company_id: 'company1',
  bank_acc_id: 'bank1',
  created_at: new Date().toISOString(),
  is_url_expires: false,
  upi_short_code: 'abcde',
  merchant: 'merchant1',
};
const mockPayInDispute = {
  id: 'payin123',
  merchant_id: 'merchant1',
  bank_acc_id: 'bank1',
  status: 'DISPUTE',
  bank_response_id: 'bank_response1',
  created_at: new Date(),
  config: { urls: { notify: 'https://notify.url' } },
  company_id: 'company1',
  amount: 100,
  merchant_order_id: 'order123',
  user_submitted_utr: 'utr123',
};
const mockMerchant = {
  id: 'merchant1',
  company_id: 'company1',
  code: 'merchant_code',
  config: { keys: { private: 'private_key', public: 'public_key' }, whitelist_ips: [], urls: { return: 'http://return.url', payin_notify: 'http://notify.url' } },
  min_payin: 50,
  max_payin: 1000,
  user_id: 'user123',
  payin_commission: 2,
};
const mockBank = {
  id: 'bank1',
  merchant_id: 'merchant1',
  is_enabled: true,
  bank_used_for: 'PayIn',
  config: {
    is_phonepay: true,
    is_intent: true,
    merchants: ['merchant1'],
  },
  is_qr: true,
  is_bank: true,
  nick_name: 'bank_nick',
  acc_holder_name: 'Test Account',
  acc_no: '1234567890',
  ifsc: 'TEST0001234',
  upi_id: 'test@upi',
  user_id: 'vendor1',
};
const mockVendor = {
  id: 'vendor1',
  user_id: 'vendor1',
  code: 'vendor_code',
  payin_commission: 1,
};
const mockBankResponse = {
  id: 'bank_response1',
  utr: 'utr123',
  amount: 100,
  bank_id: 'bank1',
  is_used: false,
  status: '/success',
};
const mockCompany = {
  id: 'company1',
  config: { telegramBankAlertChatId: 'chat123', telegramBotToken: 'test-telegram-token', telegramDuplicateDisputeChatId: 'chat1' },
};
const mockCalculation = {
  id: 'calc123',
  user_id: 'user1',
  balance: 1000,
};

const { Role, Status, Currency, tableName, BankTypes } = require('../../constants');

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(global.Set.prototype, 'has').mockReturnValue(false);
  jest.spyOn(global.Set.prototype, 'add').mockImplementation(function () { return this; });
});

describe('PayIn Service Tests', () => {
  describe('cashfreeWebHook', () => {
    let mockReq, mockRes;
  
    beforeEach(() => {
      mockReq = {
        rawBody: 'raw_body_data',
        body: {
          data: {
            order: { order_id: 'order123', order_amount: 100 },
            payment: { payment_status: 'SUCCESS', bank_reference: 'utr123' },
          },
        },
        headers: {
          'x-webhook-signature': 'valid_signature',
          'x-webhook-timestamp': '1234567890',
        },
      };
      mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      jest.clearAllMocks();
    });
  
    it('processes webhook successfully for SUCCESS payment', async () => {
      require('./payInDao').getPayInIntentDao.mockImplementation(async (orderId) => {
        console.log('getPayInIntentDao called with orderId:', orderId);
        return {
          id: 'payin123',
          bank_acc_id: 'bank123',
          company_id: 'company123',
          merchant_order_id: 'order123',
        };
      });
      require('../bankResponse/bankResponseServices').createBankResponseService.mockResolvedValue({});
      require('../../webhooks/cashfree').cashfree.PGVerifyWebhookSignature.mockResolvedValue(true);
      require('../../utils/responseHandlers').sendSuccess.mockImplementation((res, statusCode, message, data) => {
        res.status(statusCode).json({ status: statusCode, message, data });
      });
      require('./payInService').processPayInService.mockResolvedValue({
        status: 'SUCCESS',
        merchantOrderId: 'order123',
        payinId: 'payin123',
        amount: 100,
        req_amount: 100,
        utr_id: 'utr123',
      });
  
      await cashfreeWebHook(mockReq, mockRes);
  
      expect(require('../../webhooks/cashfree').cashfree.PGVerifyWebhookSignature).toHaveBeenCalledWith(
        'valid_signature',
        'raw_body_data',
        '1234567890'
      );
      expect(require('./payInDao').getPayInIntentDao).toHaveBeenCalledWith('order123');
      expect(require('../bankResponse/bankResponseServices').createBankResponseService).toHaveBeenCalledWith(
        '100 nil utr123 bank123',
        'company123',
        'BOT',
        'CASHFREE'
      );
      // expect(require('./payInService').processPayInService).toHaveBeenCalledWith(
      //   expect.any(Object),
      //   {
      //     merchantOrderId: 'order123',
      //     userSubmittedUtr: 'utr123',
      //     amount: 100,
      //   }
      // );
      expect(require('../../utils/responseHandlers').sendSuccess).toHaveBeenCalledWith(
        mockRes,
        200,
        'Webhook received successfully',
        {}
      );
    });

    it('handles webhook signature verification failure', async () => {
      // Mock dependencies
      require('./payInService').getPayInIntentDao.mockImplementation(async (orderId) => {
        console.log('getPayInIntentDao called with orderId:', orderId);
        return {
          id: 'payin123',
          bank_acc_id: 'bank123',
          company_id: 'company123',
          merchant_order_id: 'order123',
        };
      });
      require('../../webhooks/cashfree').cashfree.PGVerifyWebhookSignature.mockImplementation(() => {
        throw new Error('Invalid webhook signature');
      });
      require('../../utils/responseHandlers').sendSuccess.mockImplementation((res, statusCode, message, data) => {
        res.status(statusCode).json({ status: statusCode, message, data });
      });

      await cashfreeWebHook(mockReq, mockRes);

      expect(require('../../webhooks/cashfree').cashfree.PGVerifyWebhookSignature).toHaveBeenCalledWith(
        'valid_signature',
        'raw_body_data',
        '1234567890'
      );
      expect(require('./payInService').getPayInIntentDao).not.toHaveBeenCalled();
      expect(require('../../utils/logger').logger.error).toHaveBeenCalledWith(
        'Cashfree webhook error:',
        'Invalid webhook signature'
      );
      expect(require('../bankResponse/bankResponseServices').createBankResponseService).not.toHaveBeenCalled();
      expect(require('./payInService').processPayInService).not.toHaveBeenCalled();
      expect(require('../../utils/responseHandlers').sendSuccess).toHaveBeenCalledWith(
        mockRes,
        200,
        'Webhook received successfully',
        {}
      );
    });
    it('handles non-SUCCESS payment status', async () => {
      // Update mockReq for non-SUCCESS payment
      mockReq.body.data.payment.payment_status = 'FAILED';

      // Mock dependencies
      require('./payInService').getPayInIntentDao.mockImplementation(async (orderId) => {
        console.log('getPayInIntentDao called with orderId:', orderId);
        return {
          id: 'payin123',
          bank_acc_id: 'bank123',
          company_id: 'company123',
          merchant_order_id: 'order123',
        };
      });
      require('../../webhooks/cashfree').cashfree.PGVerifyWebhookSignature.mockResolvedValue(true);
      require('../../utils/responseHandlers').sendSuccess.mockImplementation((res, statusCode, message, data) => {
        res.status(statusCode).json({ status: statusCode, message, data });
      });

      await cashfreeWebHook(mockReq, mockRes);

      expect(require('../../webhooks/cashfree').cashfree.PGVerifyWebhookSignature).toHaveBeenCalledWith(
        'valid_signature',
        'raw_body_data',
        '1234567890'
      );
      expect(require('../../utils/logger').logger.error).toHaveBeenCalledWith(
        'Payment is either Failed or User Aborted:',
        'FAILED'
      );
      expect(require('../bankResponse/bankResponseServices').createBankResponseService).not.toHaveBeenCalled();
      expect(require('./payInService').processPayInService).not.toHaveBeenCalled();
      expect(require('../../utils/responseHandlers').sendSuccess).toHaveBeenCalledWith(
        mockRes,
        200,
        'Webhook received successfully',
        {}
      );
    });
  });

  describe('generatePayInUrlByHashService', () => {
    beforeEach(() => {
      require('../merchants/merchantDao').getMerchantsByCodeDao.mockResolvedValue([mockMerchant]);
      require('../company/companyDao').getCompanyByIDDao.mockResolvedValue([mockCompany]);
      require('./payInDao').generatePayInUrlDao.mockResolvedValue(mockPayIn);
      require('../../utils/sockets').newTableEntry.mockResolvedValue();
      require('../../utils/hashUtils').createHash.mockReturnValue('hash123');
    });

    test('generates payIn URL by hash', async () => {
  require('../bankAccounts/bankaccountDao.js').getMerchantBankDao.mockResolvedValue([mockBank]);

      const req = {
        query: { user_id: 'user1', code: 'merchant_code', ot: 'n', key: 'key123' },
        user: { role_id: 'role1', role: 'ADMIN' },
      };

      const result = await generatePayInUrlByHashService({}, req);

      expect(result).toEqual({
        payInUrl: 'https://example.com/transaction/hash123?user_id=user1&code=merchant_code&ot=n&key=key123&token=role1',
      });
      expect(require('../../utils/hashUtils').createHash).toHaveBeenCalledWith('merchant_code:key123');
      expect(require('../../utils/logger').logger.error).not.toHaveBeenCalled();
    });

    test('returns error for missing query parameters', async () => {
      const req = { query: {}, user: { role_id: 'role1', role: 'ADMIN' } };
      const result = await generatePayInUrlByHashService({}, req);
      expect(result).toEqual({ status: 400, message: 'Missing required query parameters: user_id, code, or ot' });
    });

    test('returns error if merchant not found', async () => {
      require('../merchants/merchantDao').getMerchantsByCodeDao.mockResolvedValue([]);
      const req = { query: { user_id: 'user1', code: 'invalid', ot: 'n', key: 'key123' }, user: { role_id: 'role1', role: 'ADMIN' } };
      const result = await generatePayInUrlByHashService({}, req);
      expect(result).toEqual({ status: 404, message: 'Merchant is inactive. Contact support for help!' });
    });

    test('includes amount in URL if provided', async () => {
  require('../bankAccounts/bankaccountDao.js').getMerchantBankDao.mockResolvedValue([mockBank]);

      const req = {
        query: { user_id: 'user1', code: 'merchant_code', ot: 'n', key: 'key123', amount: 500 },
        user: { role_id: 'role1', role: 'ADMIN' },
      };

      const result = await generatePayInUrlByHashService({}, req);

      expect(result.payInUrl).toContain('&amount=500');
    });

    test('does not include admin token for non-admin user', async () => {
  require('../bankAccounts/bankaccountDao.js').getMerchantBankDao.mockResolvedValue([mockBank]);

      const req = {
        query: { user_id: 'user1', code: 'merchant_code', ot: 'n', key: 'key123' },
        user: { role_id: 'role1', role: 'USER' },
      };

      const result = await generatePayInUrlByHashService({}, req);

      expect(result.payInUrl).not.toContain('token=');
    });

    test('throws error if unexpected exception occurs', async () => {
      require('../merchants/merchantDao').getMerchantsByCodeDao.mockRejectedValue(new Error('DB error'));

      const req = {
        query: { user_id: 'user1', code: 'merchant_code', ot: 'n', key: 'key123' },
        user: { role_id: 'role1', role: 'ADMIN' },
      };

      await expect(generatePayInUrlByHashService({}, req)).rejects.toThrow('DB error');
    });
  });

  describe('generatePayInUrlService', () => {
    beforeEach(() => {
      require('../merchants/merchantDao').getMerchantsByCodeDao.mockResolvedValue([
        {
          id: 'merchant1',
          code: 'merchant_code',
          company_id: 'company1',
          min_payin: 10,
          max_payin: 1000,
          config: {
            keys: { private: 'private_key', public: 'public_key' },
            whitelist_ips: [],
            urls: { return: 'http://default.return', payin_notify: 'http://default.notify' },
          },
        },
      ]);
      require('./payInDao').getPayInForCheckDao.mockResolvedValue([]);
      require('./payInDao').generatePayInUrlDao.mockResolvedValue(mockPayIn);
      require('../../utils/sockets').newTableEntry.mockResolvedValue();
    });

    test('generates payIn URL successfully', async () => {
      const payload = {
        code: 'merchant_code',
        user_id: 'user1',
        merchant_order_id: 'order123',
        amount: 100,
        returnUrl: 'http://return.url',
        notifyUrl: 'http://notify.url',
        ot: 'n',
        api_key: 'private_key',
      };

      const result = await generatePayInUrlService({}, payload, 'user1', 'MERCHANT', '192.168.1.1', false);

      expect(result).toEqual(mockPayIn);
      expect(require('../merchants/merchantDao').getMerchantsByCodeDao).toHaveBeenCalledWith('merchant_code');
      expect(require('./payInDao').getPayInForCheckDao).toHaveBeenCalledWith({ merchant_order_id: 'order123' });
      expect(require('./payInDao').generatePayInUrlDao).toHaveBeenCalledWith(expect.any(Object));
      expect(require('../../utils/sockets').newTableEntry).toHaveBeenCalled();
    });

    test('returns error for invalid API key', async () => {
      const payload = { code: 'merchant_code', user_id: 'user1', amount: 100, api_key: 'invalid_key' };
      const result = await generatePayInUrlService({}, payload, 'user1', 'MERCHANT', '192.168.1.1', false);

      expect(result).toEqual({ status: 404, message: 'Enter valid Api key' });
      expect(require('./payInDao').getPayInForCheckDao).toHaveBeenCalled();
    });

    test('returns error for amount out of range', async () => {
      const payload = { code: 'merchant_code', user_id: 'user1', amount: 10000, api_key: 'private_key' };
      const result = await generatePayInUrlService({}, payload, 'user1', 'MERCHANT', '192.168.1.1', false);

      expect(result).toEqual({ status: 400, message: 'Amount must be between 10 and 1000' });
      expect(require('./payInDao').getPayInForCheckDao).toHaveBeenCalled();
    });

    test('returns error for non-whitelisted IP', async () => {
      require('../merchants/merchantDao').getMerchantsByCodeDao.mockResolvedValue([
        {
          id: 'merchant1',
          code: 'merchant_code',
          company_id: 'company1',
          min_payin: 10,
          max_payin: 1000,
          config: {
            keys: { private: 'private_key', public: 'public_key' },
            whitelist_ips: ['10.0.0.1'],
            urls: { return: 'http://default.return', payin_notify: 'http://default.notify' },
          },
        },
      ]);
      const payload = { code: 'merchant_code', user_id: 'user1', amount: 100, api_key: 'private_key' };
      const result = await generatePayInUrlService({}, payload, 'user1', 'MERCHANT', '192.168.1.1', false);

      expect(result).toEqual({ status: 400, message: 'IP not whitelisted' });
    });
  });

  describe('expirePayInUrlService', () => {
    test('expires payIn successfully', async () => {
      require('./payInDao').getPayinsForServiccDao.mockResolvedValue(mockPayIn);
      require('./payInDao').updatePayInUrlDao.mockResolvedValue({ ...mockPayIn, is_url_expires: true, status: 'DROPPED' });
      await expirePayInUrlService('payin123');
      expect(require('./payInDao').updatePayInUrlDao).toHaveBeenCalledWith('payin123', { is_url_expires: true, status: 'DROPPED' });
      expect(require('../../callBacksAndWebHook/merchantCallBacks').merchantPayinCallback).toHaveBeenCalled();
    });

    test('throws NotFoundError if payIn not found', async () => {
      require('./payInDao').getPayinsForServiccDao.mockResolvedValue(null);
      await expect(expirePayInUrlService('invalid')).rejects.toThrow(NotFoundError);
      expect(require('../../utils/logger').logger.error).toHaveBeenCalledWith('Error expire payin url:', expect.any(NotFoundError));
    });
  });

  describe('assignedBankToPayInUrlService', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      require('./payInDao').getPayinsForServiccDao.mockResolvedValue({
        id: 'payin1',
        merchant_id: 'merchant1',
        status: Status.INITIATED,
        company_id: 'company1',
        config: { urls: { return: 'http://return.url', notify: 'http://notify.url' } },
        created_at: new Date(),
        amount: 100,
        upi_short_code: 'upi123',
      });
      require('../merchants/merchantDao').getMerchantsDao.mockResolvedValue([mockMerchant]);
      require('../vendors/vendorDao').getVendorsDao.mockResolvedValue([mockVendor]);
      require('../../helpers/index').calculateDuration.mockReturnValue(1000);
      require('./payInDao').updatePayInUrlDao.mockResolvedValue({ ...mockPayIn, status: 'ASSIGNED' });
      require('../../utils/sockets').newTableEntry.mockResolvedValue();
    });
  
    test('assigns bank successfully', async () => {
  require('../bankAccounts/bankaccountDao.js').getMerchantBankDao.mockResolvedValue([mockBank]);
      jest.spyOn(require('./payInService'), 'getPayInUrlService').mockResolvedValue({
        id: 'payin1',
        merchant_id: 'merchant1',
        status: Status.INITIATED,
        company_id: 'company1',
        config: { urls: { return: 'http://return.url', notify: 'http://notify.url' } },
        created_at: new Date(),
        amount: 100,
        upi_short_code: 'upi123',
      });
  
      const result = await assignedBankToPayInUrlService('order123', 100, BankTypes.BANK_TRANSFER, 'MERCHANT');
  
      expect(result).toEqual({
        return: 'http://return.url',
        bank: {
          nick_name: 'bank_nick',
          acc_holder_name: 'Test Account',
          acc_no: '1234567890',
          ifsc: 'TEST0001234',
        },
      });
    });
  
    test('returns bank details when payIn is already ASSIGNED', async () => {
      jest.spyOn(require('./payInService'), 'getPayInUrlService').mockResolvedValue({
        id: 'payin1',
        merchant_id: 'merchant1',
        status: Status.ASSIGNED,
        company_id: 'company1',
        config: { urls: { return: 'http://return.url' } },
        created_at: new Date(),
        amount: 100,
        upi_short_code: 'upi123',
        bank_acc_id: 'bank1',
      });
  require('../bankAccounts/bankaccountDao.js').getBankaccountDao.mockResolvedValue([mockBank]);
  
      const result = await assignedBankToPayInUrlService('order123', 100, BankTypes.BANK_TRANSFER, 'MERCHANT');
  
      expect(result.bank).toEqual({
        nick_name: 'bank_nick',
        acc_holder_name: 'Test Account',
        acc_no: '1234567890',
        ifsc: 'TEST0001234',
      });
    });
  
    test('returns error when amount is outside merchant min/max', async () => {
      require('../merchants/merchantDao').getMerchantsDao.mockResolvedValue([{ ...mockMerchant, min_payin: 50, max_payin: 200 }]);
      jest.spyOn(require('./payInService'), 'getPayInUrlService').mockResolvedValue({
        id: 'payin1',
        merchant_id: 'merchant1',
        status: Status.INITIATED,
        company_id: 'company1',
        config: {},
      });
  
      const result = await assignedBankToPayInUrlService('order123', 10, BankTypes.BANK_TRANSFER, 'MERCHANT');
  
      expect(result).toEqual({ message: 'Amount must be between 50 and 200' });
    });
  
    test('returns UPI details when type is UPI', async () => {
  require('../bankAccounts/bankaccountDao.js').getMerchantBankDao.mockResolvedValue([
        { ...mockBank, is_bank: false, is_qr: true, upi_id: 'upi@bank' },
      ]);
      jest.spyOn(require('./payInService'), 'getPayInUrlService').mockResolvedValue({
        id: 'payin1',
        merchant_id: 'merchant1',
        status: Status.INITIATED,
        company_id: 'company1',
        config: { urls: { return: 'http://return.url' } },
        created_at: new Date(),
        amount: 100,
        upi_short_code: 'upi123',
      });
  
      const result = await assignedBankToPayInUrlService('order123', 100, BankTypes.UPI, 'MERCHANT');
  
      expect(result.bank).toEqual({
        upi_id: 'test@upi',
        acc_holder_name: 'Test Account',
        code: 'abcde',
      });
    });
  });
  

  describe('checkPayInStatusService', () => {
    test('returns payIn status', async () => {
      require('../merchants/merchantDao').getMerchantsDao.mockResolvedValue([mockMerchant]);
      require('./payInDao').getPayInForCheckStatusDao.mockResolvedValue(mockPayIn);
      const result = await checkPayInStatusService('payin123', 'merchant_code', 'order123', 'private_key');
      expect(result).toEqual({ status: 'INITIATED', merchantOrderId: 'order123', amount: null, payinId: 'payin123', req_amount: 100, utr_id: ' ' });
    });

    test('returns error for invalid API key', async () => {
      require('../merchants/merchantDao').getMerchantsDao.mockResolvedValue([mockMerchant]);
      const result = await checkPayInStatusService('payin123', 'merchant_code', 'order123', 'invalid_key');
      expect(result).toEqual({ status: 404, message: 'Enter valid Api key' });
    });
  });

  describe('updatePaymentNotificationStatusService', () => {
    test('updates notification status', async () => {
      require('./payInDao').updatePayInUrlDao.mockResolvedValue(mockPayIn);
      require('../bankResponse/bankResponseDao').getBankResponseDao.mockResolvedValue(mockBankResponse);
      await updatePaymentNotificationStatusService('payin123', 'PAYIN', 'company1');
      expect(require('./payInDao').updatePayInUrlDao).toHaveBeenCalledWith('payin123', { is_notified: true });
      expect(require('../../callBacksAndWebHook/merchantCallBacks').merchantPayinCallback).toHaveBeenCalled();
    });
  });

  describe('updateDepositStatusService', () => {
    beforeEach(() => {
      require('./payInDao').getPayInForUpdateServiceDao.mockResolvedValue({ ...mockPayIn, status: 'BANK_MISMATCH', bank_response_id: 'bank_response1', merchant: 'merchant1' });
      require('../merchants/merchantDao').getMerchantsDao.mockResolvedValue([mockMerchant]);
      require('../bankResponse/bankResponseDao').getBankResponseDao.mockResolvedValue(mockBankResponse);
      require('../vendors/vendorDao').getVendorsDao.mockResolvedValue([mockVendor]);
      require('../calculation/calculationDao').getCalculationforCronDao.mockResolvedValue([mockCalculation]);
    });

    test('updates deposit status to SUCCESS', async () => {
  require('../bankAccounts/bankaccountDao.js').getBankaccountDao.mockResolvedValue([mockBank]);
      require('./payInDao').updatePayInUrlDao.mockResolvedValue({
        ...mockPayIn,
        status: 'SUCCESS',
        approved_at: new Date('2025-09-18T20:47:11.252Z'),
        bank_acc_id: 'bank1',
        duration: 1000,
        payin_merchant_commission: 10,
        payin_vendor_commission: 10,
        updated_by: 'user1',
      });

      await updateDepositStatusService({}, 'order123', 'bank_nick', 'company1', 'user1');
      expect(require('./payInDao').updatePayInUrlDao).toHaveBeenCalledWith(
        'payin123',
        expect.objectContaining({
          status: 'SUCCESS',
          approved_at: expect.any(Date),
          bank_acc_id: 'bank1',
          duration: 1000,
          payin_merchant_commission: 10,
          payin_vendor_commission: 10,
          updated_by: 'user1',
        }),
        {}
      );
    });

    test('returns undefined if bank not found', async () => {
  require('../bankAccounts/bankaccountDao.js').getBankaccountDao.mockResolvedValue([]);
      const result = await updateDepositStatusService({}, 'order123', 'bank_nick', 'company1', 'user1');
      expect(result).toBeUndefined();
    });
  });

  describe('resetDepositService', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    test('throws NotFoundError when merchant order ID not found', async () => {
      require('./payInDao').getPayInForResetDao.mockResolvedValue(null);
  
      await expect(
        resetDepositService({}, 'order123', 'company1', 'user1')
      ).rejects.toThrow('Merchant Order ID not found');
    });
  
    test('uses utr when bank_response_id is missing', async () => {
      require('./payInDao').getPayInForResetDao.mockResolvedValue({
        ...mockPayIn,
        status: 'PENDING',
        bank_response_id: null,
        user_submitted_utr: 'UTR123',
      });
  
      require('../bankResponse/bankResponseDao').getBankResponseDao.mockResolvedValue(mockBankResponse);
      require('./payInDao').updatePayInUrlDao.mockResolvedValue({ ...mockPayIn, status: 'ASSIGNED' });
  
      const result = await resetDepositService({}, 'order123', 'company1', 'user1');
      expect(require('../bankResponse/bankResponseDao').getBankResponseDao).toHaveBeenCalledWith({
        company_id: 'company1',
        utr: 'UTR123',
      });
      expect(result).toEqual({ ...mockPayIn, status: 'ASSIGNED' });
    });
  
    test('logs error and rethrows if an unexpected error occurs', async () => {
      const error = new Error('Database crash');
      require('./payInDao').getPayInForResetDao.mockRejectedValue(error);
  
      await expect(
        resetDepositService({}, 'order123', 'company1', 'user1')
      ).rejects.toThrow('Database crash');
  
      expect(require('../../utils/logger').logger.error).toHaveBeenCalledWith(
        'Error reset deposit service:',
        error
      );
    });
  });
  

  describe('processPayInService', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      require('./payInDao').getPayinUrlService = jest.fn().mockResolvedValue(mockPayIn);
  require('../bankAccounts/bankaccountDao.js').getBankaccountDao = jest.fn().mockResolvedValue([mockBank]);
      require('../vendors/vendorDao').getVendorsDao = jest.fn().mockResolvedValue([mockVendor]);
      require('./payInDao').getPayInForCheckDao = jest.fn().mockResolvedValue([]);
      require('../bankResponse/bankResponseDao').getBankResponseDao = jest.fn().mockResolvedValue(mockBankResponse);
      require('./payInDao').updatePayInUrlDao = jest.fn().mockResolvedValue({ ...mockPayIn, status: 'SUCCESS' });
      require('./payInDao').newTableEntry = jest.fn().mockResolvedValue({});
    });
  
    test('processes payIn to SUCCESS', async () => {
      const payload = { userSubmittedUtr: 'utr123', merchantOrderId: 'order123', amount: 100 };
      const result = await processPayInService({}, payload, 'user1');
      expect(result.status).toBe('SUCCESS');
      expect(result.utr_id).toBe('utr123');
    });
  
  });
  

  describe('telegramResponseService', () => {
    const mockMessage = {
      photo: [{ file_id: 'file1' }],
      caption: 'order123',
      chat: { id: 'chat123' },
      message_id: 'msg123',
    };
  
    const mockPayIn = { 
      status: Status.SUCCESS,
      amount: 100,
      company_id: 'company123',
      user_submitted_utr: 'utr123',
      is_notified: false,
      bank_response_id: null,
    };
  
    const mockBankResponse = { id: 'bank1', is_used: false };
    test('processes Telegram response', async () => {
      require('./payInDao').getPayInForTelegramResponseDao.mockResolvedValue(mockPayIn);
      require('../bankResponse/bankResponseDao').getBankResponseDao.mockResolvedValue(mockBankResponse);
      require('./payInDao').getPayInForTelegramResponseArrayDao.mockResolvedValue([]);
      require('../../helpers/index').getImageContentFromOCr.mockResolvedValue({ utr: 'utr123', amount: 100 });
      const message = { photo: [{ file_id: 'file_id1' }], caption: 'order123', chat: { id: 'chat123' }, message_id: 'msg123' };
      await telegramResponseService({}, message);
      expect(require('../../utils/logger').logger.error).not.toHaveBeenCalled();
    });
  
    test('sends error if caption missing', async () => {
      const messageWithoutCaption = { ...mockMessage, caption: null };
      await telegramResponseService({}, messageWithoutCaption);
      expect(telegramUtils.sendErrorMessageNoMerchantOrderIdFoundTelegramBot).toHaveBeenCalled();
    });
  
    test('sends error if payIn not found', async () => {
      require('./payInDao').getPayInForTelegramResponseDao.mockResolvedValue(null);
      await telegramResponseService({}, mockMessage);
      expect(telegramUtils.sendErrorMessageTelegram).toHaveBeenCalled();
    });
  
    test('handles FAILED status', async () => {
      require('./payInDao').getPayInForTelegramResponseDao.mockResolvedValue({ ...mockPayIn, status: Status.FAILED });
      await telegramResponseService({}, mockMessage);
      expect(telegramUtils.sendPaymentStatusMessageTelegramBot).toHaveBeenCalledWith(
        mockMessage.chat.id, mockMessage.caption, expect.any(String), mockMessage.message_id, Status.FAILED
      );
    });
  
    test('handles INITIATED status', async () => {
      require('./payInDao').getPayInForTelegramResponseDao.mockResolvedValue({ ...mockPayIn, status: Status.INITIATED });
      await telegramResponseService({}, mockMessage);
      expect(telegramUtils.sendPaymentStatusMessageTelegramBot).toHaveBeenCalledWith(
        mockMessage.chat.id, mockMessage.caption, expect.any(String), mockMessage.message_id, Status.INITIATED
      );
    });
  
    test('handles PENDING status with UTR mismatch', async () => {
      require('./payInDao').getPayInForTelegramResponseDao.mockResolvedValue({ ...mockPayIn, status: Status.PENDING, user_submitted_utr: 'wrong_utr' });
      await telegramResponseService({}, mockMessage);
      expect(telegramUtils.sendUTRMismatchErrorMessageTelegram).toHaveBeenCalled();
    });
  
  });

  describe('processPayInByImageService', () => {
    test('processes payIn by image to IMG_PENDING', async () => {
      require('./payInDao').getPayinsForServiccDao.mockResolvedValue(mockPayIn);
      require('../../helpers/index').getImageContentFromOCr.mockResolvedValue(null);
      require('./payInDao').updatePayInUrlDao.mockResolvedValue({ ...mockPayIn, status: 'IMG_PENDING' });
      const payload = { base64Image: 'image_data', merchantOrderId: 'order123', amount: 100, fileKey: 'file_key' };
      const result = await processPayInByImageService({}, payload);
      expect(result).toEqual({
        status: 'IMG_PENDING',
        amount: 100,
        merchant_order_id: 'order123',
        return_url: 'http://return.url',
      });
    });
  });

  describe('disputeDuplicateTransactionService', () => {
    beforeEach(() => {
      require('./payInDao').getPayInForDisputeServiceDao
        .mockResolvedValueOnce(mockPayInDispute)
        .mockResolvedValueOnce(mockPayInDispute);
      require('../bankResponse/bankResponseDao').getBankResponseDao.mockResolvedValue(mockBankResponse);
      require('../merchants/merchantDao').getMerchantsDao.mockResolvedValue([mockMerchant]);
      require('../vendors/vendorDao').getVendorsDao.mockResolvedValue([mockVendor]);
      require('../company/companyDao').getCompanyByIDDao.mockResolvedValue([mockCompany]);
      require('./payInDao').updatePayInUrlDao.mockResolvedValue({ id: 'payin123', status: 'SUCCESS' });
      require('../merchants/merchantDao').updateMerchantBalanceDao.mockResolvedValue(true);
      require('../calculation/calculationDao').getCalculationforCronDao.mockResolvedValue([mockCalculation]);
      require('../calculation/calculationDao').updateCalculationBalanceDao.mockResolvedValue(true);
      require('../../utils/sockets').newTableEntry.mockResolvedValue(true);
      require('../../utils/sendTelegramMessages').sendTelegramDisputeMessage.mockResolvedValue(true);
      require('../../utils/trackVendorsNetBalance').trackVendorsNetBalance.mockResolvedValue(true);
    });

    test('handles valid payin commission correctly', async () => {
  require('../bankAccounts/bankaccountDao.js').getBankaccountDao.mockResolvedValue([mockBank]);

      const payload = {
        payInId: 'payin123',
        merchantOrderId: 'order123',
        confirmed: 100,
        amount: 100,
      };

      const result = await disputeDuplicateTransactionService({}, payload, 'company1', 'user1');

      expect(result).toBeDefined();
      expect(result.id).toBe('payin123');
      expect(result.status).toBe('SUCCESS');
      expect(require('../../utils/logger').logger.error).not.toHaveBeenCalled();
    });
  });

  describe('telegramCheckUTRService', () => {
    test('processes UTR successfully', async () => {
      require('../bankResponse/bankResponseDao').getBankResponseDao.mockResolvedValue(mockBankResponse);
      require('./payInDao').getPayInForTelegramUtrDao.mockResolvedValue(mockPayIn);
      require('../checkutr/checkUtrServices').createCheckUtrService.mockResolvedValue();
      const result = await telegramCheckUTRService({}, 'utr123', 'order123', 'company1', 'user1', 'MERCHANT');
      expect(result).toEqual({ message: 'Utr: utr123 is INITIATED with order123' });
    });
  });

  describe('getPayinsServiceById', () => {
    test('returns payIn by ID', async () => {
      require('./payInDao').getPayinsForServiccDao.mockResolvedValue(mockPayIn);
      const result = await getPayinsServiceById('payin123');
      expect(result).toEqual(mockPayIn);
    });
  });

  describe('updateUtrPayinService', () => {
    test('updates UTR successfully', async () => {
      require('./payInDao').updatePayInUrlDao.mockResolvedValue({ ...mockPayIn, user_submitted_utr: 'utr123FAILED' });
      const result = await updateUtrPayinService({}, 'payin123', 'user1', 'utr123');
      expect(result).toEqual({ ...mockPayIn, user_submitted_utr: 'utr123FAILED' });
    });
  });

  describe('checkPendingPayinStatusService', () => {
    beforeEach(() => {
      require('./payInDao').getPayInPendingDao.mockResolvedValue([{ ...mockPayIn, merchant: 'merchant1' }]);
      require('../bankResponse/bankResponseDao').getBankResponsePendingDao.mockResolvedValue(mockBankResponse);
      require('../merchants/merchantDao').getMerchantsByCodeDao.mockResolvedValue([{ id: 'merchant1', payin_commission: 0.05 }]);
      require('../vendors/vendorDao').getVendorsDao.mockResolvedValue([mockVendor]);
  require('../bankAccounts/bankaccountDao.js').getBankaccountDao.mockResolvedValue([mockBank]);
      require('./payInDao').updatePayInUrlDao.mockResolvedValue({ ...mockPayIn, status: 'SUCCESS' });
      require('../calculation/calculationDao').getCalculationforCronDao.mockResolvedValue([mockCalculation]);
    });

    test('processes pending payIns', async () => {
      const result = await checkPendingPayinStatusService({}, 'user1', 'company1', 'username');
      expect(result).toEqual(['payin123']);
      expect(require('../../utils/logger').logger.log).toHaveBeenCalledWith(`Valid match found for payin ${mockPayIn.id}`);
    });
  });
});