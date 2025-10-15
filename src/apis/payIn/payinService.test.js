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
  updatePayInService,
  verifyPayinsService,
  getPayinsSummaryService,
  getPayinsBySearchService,
  generateUpiUrlService,
  payInIntentGenerateOrderService,
} = require('./payInService');
const { v4: uuidv4 } = require('uuid');
const { nanoid } = require('nanoid');
jest.unmock('dayjs');
const dayjs = require('dayjs');
const { executeQuery } = require('../../utils/db');
import { cashfreeWebHook } from '../../webhooks/cashfree.js';
import * as telegramUtils from '../../utils/sendTelegramMessages.js';
import { helpers } from '@elastic/elasticsearch';

jest.mock('razorpay', () => jest.fn(() => ({
  webhooks: {
    verifySignature: jest.fn().mockReturnValue(true),
  },
  orders: {
    create: jest.fn().mockResolvedValue({ id: 'test_order_id', receipt: 'test_receipt' }),
  },
})));

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

jest.mock('../bankResponse/bankResponseDao', () => {
  const mockBankResponse = {
    id: 'bankResponse123',
    bank_id: 'bank123',
    utr: 'utr123',
    amount: 100,
    status: '/success',
    is_used: false,
  };

  return {
    getBankResponsePayinDao: jest.fn().mockImplementation(async ({ utr, company_id }) => {
      if (utr === 'utr123' && company_id === 'company123') {
        return mockBankResponse;
      }
      return null;
    }),
    getBankResponseDao: jest.fn().mockImplementation(async ({ id }) => {
      if (id === 'bankResponse123') {
        return mockBankResponse;
      }
      return null;
    }),
    getBankResponseDaoById: jest.fn().mockImplementation(async (id) => {
      if (id === 'bankResponse123') {
        return mockBankResponse;
      }
      return null;
    }),
    getBankResponsePendingDao: jest.fn().mockImplementation(async () => mockBankResponse),
    updateBankResponseDao: jest.fn().mockResolvedValue(mockBankResponse),
    updateBotResponseDao: jest.fn().mockResolvedValue(mockBankResponse)
  };
});


jest.mock('../../webhooks/cashfree.js', () => {
  const mockCashfreeInstance = {
    PGCreateOrder: jest.fn().mockResolvedValue({ order_id: 'cashfree_order', payment_link: 'http://payment.link' }),
    PGPayOrder: jest.fn().mockResolvedValue({ data: { payment_status: 'SUCCESS' } }),
    PGVerifyWebhookSignature: jest.fn().mockImplementation((signature, rawBody, timestamp) => true),
  };
  return {
    cashfree: mockCashfreeInstance,
    cashfreeWebHook: jest.fn().mockImplementation(async (req, res) => {
      try {
        await mockCashfreeInstance.PGVerifyWebhookSignature(req.headers['x-webhook-signature'], req.rawBody, req.headers['x-webhook-timestamp']);
        const payIn = await require('./payInDao').getPayInIntentDao(req.body.data.order.order_id);
        if (!payIn) {
          require('../../utils/logger').logger.error('PayIn not found for order_id:', req.body.data.order.order_id);
          return require('../../utils/responseHandlers').sendSuccess(res, 200, 'Webhook received successfully', {});
        }
        if (req.body.data.payment.payment_status !== 'SUCCESS') {
          require('../../utils/logger').logger.error('Payment is either Failed or User Aborted:', req.body.data.payment.payment_status);
          return require('../../utils/responseHandlers').sendSuccess(res, 200, 'Webhook received successfully', {});
        }
        await require('../bankResponse/bankResponseServices').createBankResponseService(
          `${req.body.data.order.order_amount} nil ${req.body.data.payment.bank_reference} ${payIn.bank_acc_id}`,
          payIn.company_id,
          'BOT',
          'CASHFREE'
        );
        await require('./payInService').processPayInService({}, {
          merchantOrderId: req.body.data.order.order_id,
          userSubmittedUtr: req.body.data.payment.bank_reference,
          amount: req.body.data.order.order_amount,
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

jest.mock('../../zentechind/zentechInd', () => ({
  createZenTechIndTransaction: jest.fn(),
}));

jest.mock('../../cashfree/cashfree', () => ({
  createCashfreeOrder: jest.fn(),
}));
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
  zentechind: {
    collectionId: 'test_collection',
    salt: 'test_salt',
    url: 'https://api.test.zentechind.com',
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
  
  // Load and extend plugins in the factory
  const utcPlugin = require('dayjs/plugin/utc');
  const timezonePlugin = require('dayjs/plugin/timezone');
  actualDayjs.extend(utcPlugin);
  actualDayjs.extend(timezonePlugin);
  
  const mockDayjs = jest.fn((date) => {
    const realInstance = actualDayjs(date || new Date());
    
    // Helper to create a mocked instance (for chaining, e.g., tz returns this)
    const createMockInstance = (baseInstance) => ({
      ...baseInstance,  // Copy data properties
      add: jest.fn((value, unit) => createMockInstance(actualDayjs(baseInstance).add(value, unit))),
      format: jest.fn().mockImplementation((formatStr) => baseInstance.format(formatStr || 'YYYY-MM-DD')),
      toDate: jest.fn().mockImplementation(() => baseInstance.toDate()),
      toISOString: jest.fn().mockImplementation(() => baseInstance.toISOString()),
      isAfter: jest.fn().mockImplementation(() => false),
      tz: jest.fn((timezone) => createMockInstance(actualDayjs(baseInstance).tz(timezone))),
    });
    
    return createMockInstance(realInstance);
  });
  
  // Preserve static methods
  mockDayjs.extend = actualDayjs.extend;
  mockDayjs.tz = actualDayjs.tz;
  
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
jest.mock('../../webhooks/razorPay.js', () => {
  const mockRazorpayInstance = {
    webhooks: {
      verifySignature: jest.fn().mockReturnValue(true),
    },
    orders: {
      create: jest.fn().mockResolvedValue({ id: 'razorpay_order', receipt: 'order123' }),
    },
  };
  return {
    razorpay: mockRazorpayInstance,
    razorPayWebHook: jest.fn().mockImplementation(async (req) => {
      try {
        const signature = req.headers['x-razorpay-signature'];
        const isValidSignature = mockRazorpayInstance.webhooks.verifySignature(
          JSON.stringify(req.body),
          signature,
          'test-webhook-secret'
        );

        if (!isValidSignature) {
          return { status: 200, message: 'Webhook received' };
        }

        if (req.body.payment.status === 'captured') {
          require('../../utils/logger').logger.info('RazorPay payment captured:', {
            orderId: req.body.order.id,
            paymentId: req.body.payment.id,
            amount: req.body.payment.amount,
          });
        }

        return { status: 200, message: 'Webhook processed successfully' };
      } catch (err) {
        require('../../utils/logger').logger.error('Error processing RazorPay webhook:', err);
        return { status: 200, message: 'Webhook received' };
      }
    }),
  };
});
jest.mock('../merchants/merchantDao.js', () => ({
  getMerchantsByCodeDao: jest.fn(),
  getMerchantsDao: jest.fn(),
  getMerchantByUserIdDao: jest.fn(),
  updateMerchantBalanceDao: jest.fn().mockResolvedValue({}),
}));
jest.mock('../bankAccounts/bankaccountDao.js', () => {
  const mockBankAccount = {
    id: 'bank1',
    nick_name: 'bank_nick',
    acc_holder_name: 'Test Account',
    acc_no: '1234567890',
    ifsc: 'TEST0001234',
    upi_id: 'test@upi',
    is_enabled: true,
    is_bank: true,
    is_qr: true,
    config: { is_phonepay: true, is_intent: true }
  };

  return {
    getBankaccountDao: jest.fn().mockResolvedValue([mockBankAccount]),
    getMerchantBankDao: jest.fn().mockResolvedValue([mockBankAccount]),
    updateBankaccountDao: jest.fn().mockResolvedValue(mockBankAccount)
  };
});
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
  getPayInForDuplicate: jest.fn(),
  getPayinsWithoutHistoryDao: jest.fn(),
  getPayInForTelegramResponseArrayDao: jest.fn(),
  getPayInIntentDao: jest.fn(),
}));
// BankResponseDao mock is defined in the jest.mock block above

// Mock is already defined above with full implementation
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
jest.mock('../company/companyDao.js', () => ({
  getCompanyByIDDao: jest.fn(),
  getCashfreeAllowByCompanyIdDao: jest.fn(),
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
        upi_short_code: 'abcde',
      });

      const result = await assignedBankToPayInUrlService('order123', 100, BankTypes.UPI, 'MERCHANT');

      expect(result.bank).toEqual({
        upi_id: 'upi@bank',
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
      await expect(updateDepositStatusService({}, 'order123', 'bank_nick', 'company1', 'user1')).rejects.toThrow('Bank not found!');
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
      require('./payInDao').getPayInForDuplicate.mockResolvedValue([]);
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
    test('returns message for UTR that exists', async () => {
      require('../bankResponse/bankResponseDao').getBankResponseDao.mockImplementation(({ utr, company_id }) => {
        if (utr === 'utr123' && company_id === 'company123') {
          return Promise.resolve({ ...mockBankResponse, status: '/success' });
        }
        return Promise.resolve(null);
      });
      require('./payInDao').getPayInForTelegramUtrDao.mockResolvedValue(mockPayIn);
      require('../checkutr/checkUtrServices').createCheckUtrService.mockResolvedValue();
      const result = await telegramCheckUTRService({}, 'utr123', 'order123', 'company123', 'user1', 'MERCHANT');
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

  describe('payInIntentGenerateOrderService', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      require('./payInDao').getPayInIntentDao.mockResolvedValue(mockPayIn);
    });

    test('generates ZenTechInd order successfully', async () => {
      const { createZenTechIndTransaction } = require('../../zentechind/zentechInd');
      createZenTechIndTransaction.mockResolvedValueOnce({ payment_url: 'https://zentechind.payment.url' });
      const result = await payInIntentGenerateOrderService('order123', 100, 'ZenTechInd');
      expect(result).toEqual({ id: 'payin123', session_id: 'https://zentechind.payment.url' });
      expect(createZenTechIndTransaction).toHaveBeenCalledWith(mockPayIn, 100);
    });

    test('generates Cashfree order successfully', async () => {
      const { createCashfreeOrder } = require('../../cashfree/cashfree');
      createCashfreeOrder.mockResolvedValueOnce({ payment_session_id: 'cashfree_session_123' });
      const result = await payInIntentGenerateOrderService('order123', 100, 'Cashfree');
      expect(result).toEqual({ id: 'payin123', session_id: 'cashfree_session_123' });
      expect(createCashfreeOrder).toHaveBeenCalledWith(mockPayIn, 100);
    });

    test('throws error for unsupported provider', async () => {
      await expect(payInIntentGenerateOrderService('order123', 100, 'Unsupported')).rejects.toThrow('Unsupported provider: Unsupported');
    });

    test('generates order even if payIn expired', async () => {
      const expiredPayIn = { ...mockPayIn, expiration_date: new Date(Date.now() - 86400000).toISOString() };
      require('./payInDao').getPayInIntentDao.mockResolvedValue(expiredPayIn);
      const { createZenTechIndTransaction } = require('../../zentechind/zentechInd');
      createZenTechIndTransaction.mockResolvedValueOnce({ payment_url: 'expired_url' });
      const result = await payInIntentGenerateOrderService('order123', 100, 'ZenTechInd');
      expect(result).toEqual({ id: 'payin123', session_id: 'expired_url' });
      expect(createZenTechIndTransaction).toHaveBeenCalledWith(expiredPayIn, 100);
    });
  });

  describe('getPayinsBySearchService', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      require('../userHierarchy/userHierarchyDao').getUserHierarchysDao.mockResolvedValue([{ config: { siblings: { sub_merchants: [] } } }]);
      require('../merchants/merchantDao').getMerchantByUserIdDao.mockResolvedValue([{ id: 'merchant1' }]);
      require('../bankAccounts/bankaccountDao').getBankaccountDao.mockResolvedValue([{ id: 'bank1' }]);
      require('./payInDao').getPayinsWithoutHistoryDao.mockResolvedValue({ data: [], total: 0 });
    });

    test('fetches payins without history for merchant role', async () => {
      const filters = { page: '1', limit: '10', search: 'test' };
      const result = await getPayinsBySearchService(filters, Role.MERCHANT, 'user1', Role.MERCHANT, false);
      expect(result).toEqual({ data: [], total: 0 });
      expect(require('../merchants/merchantDao').getMerchantByUserIdDao).toHaveBeenCalledWith(['user1']);
    });

    test('fetches payins with history for vendor role', async () => {
      require('./payInDao').getPayinsWithHistoryDao.mockResolvedValue({ data: [{ ...mockPayIn }], total: 1 });
      const filters = { page: '1', limit: '10' };
      const result = await getPayinsBySearchService(filters, Role.VENDOR, 'user1', Role.VENDOR, true);
      expect(result).toEqual({ data: [{ ...mockPayIn }], total: 1 });
      expect(require('../bankAccounts/bankaccountDao').getBankaccountDao).toHaveBeenCalledWith({ user_id: 'user1', bank_used_for: 'PayIn' });
    });

    test('throws BadRequestError for invalid pagination', async () => {
      const filters = { page: 'invalid', limit: '10' };
      await expect(getPayinsBySearchService(filters, Role.MERCHANT, 'user1', Role.MERCHANT, false)).rejects.toThrow('Invalid pagination parameters');
    });

    test('returns empty array if no banks for vendor', async () => {
      require('../bankAccounts/bankaccountDao').getBankaccountDao.mockResolvedValue([]);
      const filters = { page: '1', limit: '10' };
      const result = await getPayinsBySearchService(filters, Role.VENDOR, 'user1', Role.VENDOR, false);
      expect(result).toEqual([]);
    });
  });

  describe('getPayinsSummaryService', () => {
    test('returns payins summary successfully', async () => {
      require('./payInDao').getPayinsSumAndCountByStatusDao.mockResolvedValue({ total_success: 1000, count_success: 10 });
      const filters = { status: 'SUCCESS' };
      const result = await getPayinsSummaryService(filters);
      expect(result).toEqual({ total_success: 1000, count_success: 10 });
    });

    test('throws InternalServerError on error', async () => {
      const error = new Error('DB error');
      require('./payInDao').getPayinsSumAndCountByStatusDao.mockRejectedValue(error);
      await expect(getPayinsSummaryService({})).rejects.toThrow(InternalServerError);
      expect(require('../../utils/logger').logger.error).toHaveBeenCalledWith('Error while fetching Payin SUM', error);
    });
  });

  describe('verifyPayinsService', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      require('./payInService').getPayInUrlService.mockResolvedValue(mockPayIn);
      require('../users/userDao').getUserByIdDao.mockResolvedValue([{ role: Role.MERCHANT }]);
      require('../merchants/merchantDao').getMerchantsDao.mockResolvedValue([mockMerchant]);
      require('../bankAccounts/bankaccountDao').getMerchantBankDao.mockResolvedValue([mockBank]);
      require('./payInDao').updatePayInUrlDao.mockResolvedValue({ ...mockPayIn, one_time_used: false });
      require('../company/companyDao').getCashfreeAllowByCompanyIdDao.mockResolvedValue({ allow_cashfree: true, allow_zentechind: true });
      global.Set.prototype.has = jest.fn().mockReturnValue(false);
      global.Set.prototype.add = jest.fn().mockImplementation(() => { });
    });

    test('verifies payIn successfully for new URL', async () => {
      const result = await verifyPayinsService({}, 'order123', 'user_location', false);
      expect(result).toEqual({
        expiryTime: expect.any(String),
        amount: 100,
        one_time_used: false,
        allowCashfree: false,
        allowZenTechInd: false,
        status: 'INITIATED',
        min_amount: 50,
        max_amount: 1000,
        is_qr: true,
        is_phonepay: true,
        is_bank: true,
        redirect_url: 'http://return.url',
        isAdmin: false,
      });
      expect(global.Set.prototype.add).toHaveBeenCalledWith('order123');
    });

    test('returns error if already used', async () => {
      global.Set.prototype.has = jest.fn().mockReturnValue(true);
      require('../bankAccounts/bankaccountDao').getBankaccountDao.mockResolvedValueOnce([mockBank]);
      require('../vendors/vendorDao').getVendorsDao.mockResolvedValueOnce([mockVendor]);
      require('../merchants/merchantDao').getMerchantsDao.mockResolvedValueOnce([mockMerchant]);
      const result = await verifyPayinsService({}, 'order123', 'user_location', true);
      expect(result).toEqual({
        error: 'This payin url is already used',
        result: { redirect_url: 'http://return.url' },
      });
    });

    test('updates config with user location', async () => {
      await verifyPayinsService({}, 'order123', 'user_location', false);
      expect(require('./payInDao').updatePayInUrlDao).toHaveBeenCalledWith('payin123', expect.objectContaining({ config: expect.any(String) }));
    });

    test('throws InternalServerError if updatePayInUrlDao fails', async () => {
      require('./payInDao').updatePayInUrlDao.mockResolvedValueOnce(null);
      await expect(verifyPayinsService({}, 'order123', 'user_location', false)).rejects.toThrow('Failed to update payin URL');
    });

  });

  describe('generateUpiUrlService', () => {
    test('generates UPI URLs successfully', async () => {
      const payload = {
        amount: 100,
        payeeVPA: 'test@upi',
        payeeName: 'Test Payee',
        transactionNote: 'Payment',
        merchantCode: 'mc123',
        businessName: 'Business',
        mode: 'pay',
        purpose: 'payment',
      };
      const result = await generateUpiUrlService(payload);
      expect(result).toHaveProperty('phonepeUrl');
      expect(result).toHaveProperty('gpayUrl');
      expect(result).toHaveProperty('paytmUrl');
      expect(result).toHaveProperty('genericUpiUrl');
      expect(result).toHaveProperty('transactionId');
      expect(result.transactionId).toMatch('IND123e4567e89b12d3a456426614174');
    });

    test('returns BadRequestError for invalid amount', async () => {
      const payload = { amount: -10, payeeVPA: 'test@upi' };
      const result = await generateUpiUrlService(payload);
      expect(result).toBeInstanceOf(BadRequestError);
      expect(result.message).toBe('Invalid amount');
    });

    test('returns BadRequestError for invalid VPA format', async () => {
      const payload = { amount: 100, payeeVPA: 'invalid_vpa' };
      const result = await generateUpiUrlService(payload);
      expect(result).toBeInstanceOf(BadRequestError);
      expect(result.message).toBe('Invalid VPA format');
    });
  });

describe('updatePayInService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    require('./payInDao').getPayInForUpdateDao.mockResolvedValue(mockPayIn);
    require('../bankResponse/bankResponseDao').getBankResponseDao.mockResolvedValue(mockBankResponse);
    require('../users/userDao').getAllUsersDao.mockResolvedValue([{ user_name: 'test_user' }]);
    require('../vendors/vendorDao').getVendorsDao.mockResolvedValue([mockVendor]);
    require('../merchants/merchantDao').getMerchantsDao.mockResolvedValue([mockMerchant]);
    require('../bankAccounts/bankaccountDao').getBankaccountDao.mockResolvedValue([mockBank]);
    require('../calculation/calculationDao').getAllCalculationforCronDao.mockResolvedValue([{ ...mockCalculation, created_at: new Date() }]);
    require('../bankAccounts/bankaccountDao').updateBankaccountDao.mockResolvedValue({ ...mockBank, balance: 1150 });
    require('../vendors/vendorDao').updateVendorDao.mockResolvedValue({ ...mockVendor, balance: 1100 });
    require('../calculation/calculationDao').updateCalculationBalanceDao.mockResolvedValue(mockCalculation);
    require('./payInDao').getPayInForUpdateServiceDao.mockResolvedValue(mockPayIn);
    require('../bankResponse/bankResponseDao').getBankResponseDaoById.mockResolvedValue(mockBankResponse);
    require('../../helpers/index').getDateWithoutTime = jest.fn().mockReturnValue('2025-10-12');
  });

  test('updates payIn amount successfully', async () => {
    const today = new Date();

    // Mock calculation data (used by calculationDao)
    const mockCalcData = [
      { ...mockCalculation, created_at: today },
      { ...mockCalculation, created_at: today },
    ];

    // Step 1: Mock DAO responses before calling the service
    const mockGetAllCalculationforCronDao = require('../calculation/calculationDao').getAllCalculationforCronDao;
    const mockGetPayInForUpdateDao = require('../payIn/payInDao').getPayInForUpdateDao;

    // The order matters — these mocks should be set *before* calling the service.
    mockGetAllCalculationforCronDao
      .mockResolvedValueOnce(mockCalcData)
      .mockResolvedValueOnce(mockCalcData);

    const mockPayInWithNick = { ...mockPayIn, nick_name: 'bank_nick' };
    mockGetPayInForUpdateDao.mockResolvedValue({
      ...mockPayInWithNick,
      id: 'payin123',
      merchant_id: 'merchant1',
      bank_response_id: 'bank_response1',
      bank_acc_id: 'bank1',
      approved_at: today,
      amount: 100,
      config: {},
      payin_vendor_commission: 0,
      payin_merchant_commission: 0,
    });

    require('./payInDao').updatePayInUrlDao.mockResolvedValue({ ...mockPayInWithNick, amount: 150 });
    require('../bankResponse/bankResponseDao').updateBankResponseDao.mockResolvedValue({ ...mockBankResponse, amount: 150 });

    // Step 2: Payload and call
    const payload = { amount: 150 };
    const result = await updatePayInService({}, payload, 'order123', 'user1', 'company1');

    // Step 3: Assertions
    expect(result).toEqual(expect.objectContaining({
      amount: 150,
      nick_name: 'bank_nick',
      bank_res_details: expect.objectContaining({
        utr: 'utr123',
        amount: 150,
      }),
      company_id: 'company1',
    }));

    // Optional: Verify DAOs were called correctly
    expect(mockGetAllCalculationforCronDao).toHaveBeenCalledTimes(2);
    expect(mockGetPayInForUpdateDao).toHaveBeenCalledTimes(1);
  });

  test('updates payIn UTR successfully', async () => {
    const payload = { utr: 'new_utr123' };
    const mockPayInWithUtrAndNick = {
      ...mockPayIn,
      user_submitted_utr: 'old_utr',  // Truthy to trigger setting new UTR
      nick_name: 'bank_nick',
    };
    require('./payInDao').getPayInForUpdateDao.mockResolvedValue(mockPayInWithUtrAndNick);
    require('../bankResponse/bankResponseDao').getBankResponseDao
      .mockResolvedValueOnce(mockBankResponse) // for existing
      .mockResolvedValueOnce(null); // for new utr check
    require('../bankResponse/bankResponseDao').updateBankResponseDao.mockResolvedValueOnce({ ...mockBankResponse, utr: 'new_utr123' });
    require('./payInDao').updatePayInUrlDao.mockResolvedValue({ ...mockPayInWithUtrAndNick, user_submitted_utr: 'new_utr123' });
    const result = await updatePayInService({}, payload, 'order123', 'user1', 'company1');
    expect(result).toEqual(expect.objectContaining({
      user_submitted_utr: 'new_utr123',
      nick_name: 'bank_nick',
      bank_res_details: { utr: 'new_utr123', amount: 100 },
    }));
  });

  test('updates payIn bank account successfully', async () => {
    const payload = { bank_acc_id: 'bank2' };
    const mockNewBank = { ...mockBank, id: 'bank2', user_id: 'vendor2', balance: 900, nick_name: 'new_bank_nick' };
    const mockNewVendor = { ...mockVendor, user_id: 'vendor2', balance: 900 };
    const mockNewCalc = { ...mockCalculation, user_id: 'vendor2' };
    const mockPayInWithNick = { ...mockPayIn, nick_name: 'bank_nick' };
    require('./payInDao').getPayInForUpdateDao.mockResolvedValue(mockPayInWithNick);
    require('../bankAccounts/bankaccountDao').getBankaccountDao
      .mockResolvedValueOnce([mockBank]) // prev
      .mockResolvedValueOnce([mockNewBank]); // new
    require('../vendors/vendorDao').getVendorsDao
      .mockResolvedValueOnce([mockVendor]) // prev
      .mockResolvedValueOnce([mockNewVendor]); // new
    require('../calculation/calculationDao').getAllCalculationforCronDao
      .mockResolvedValueOnce([{ ...mockCalculation, created_at: new Date('2025-10-12') }]) // prev
      .mockResolvedValueOnce([{ ...mockNewCalc, created_at: new Date('2025-10-12') }]); // new
    require('../bankAccounts/bankaccountDao').updateBankaccountDao
      .mockResolvedValueOnce({ ...mockBank, balance: 900 }) // prev bank update
      .mockResolvedValueOnce({ ...mockNewBank, balance: 1100 }); // new bank update
    require('../bankResponse/bankResponseDao').updateBankResponseDao.mockResolvedValueOnce({ ...mockBankResponse, bank_id: 'bank2' });
    require('./payInDao').updatePayInUrlDao.mockResolvedValue({ ...mockPayInWithNick, bank_acc_id: 'bank2', nick_name: 'new_bank_nick' });
    const result = await updatePayInService({}, payload, 'order123', 'user1', 'company1');
    expect(result).toEqual(expect.objectContaining({
      bank_acc_id: 'bank2',
      nick_name: 'new_bank_nick',
      bank_res_details: { utr: 'utr123', amount: 100 },
    }));
  });

  test('does not throw for empty payload', async () => {
    const mockPayInWithNick = { ...mockPayIn, nick_name: 'bank_nick' };
    require('./payInDao').getPayInForUpdateDao.mockResolvedValue(mockPayInWithNick);
    require('./payInDao').updatePayInUrlDao.mockResolvedValue(mockPayInWithNick);
    const result = await updatePayInService({}, {}, 'order123', 'user1', 'company1');
    expect(result).toBeDefined();
    expect(result.nick_name).toBe('bank_nick');
  });

  test('throws NotFoundError if bankResponse not found', async () => {
    require('../bankResponse/bankResponseDao').getBankResponseDao.mockResolvedValueOnce(null);
    await expect(updatePayInService({}, { amount: 150 }, 'order123', 'user1', 'company1')).rejects.toThrow('Bank Response not found');
  });

  test('throws NotFoundError if UTR already used', async () => {
    const payload = { utr: 'existing_utr' };
    require('../bankResponse/bankResponseDao').getBankResponseDao
      .mockResolvedValueOnce(mockBankResponse) // existing
      .mockResolvedValueOnce(mockBankResponse); // for utr
    await expect(updatePayInService({}, payload, 'order123', 'user1', 'company1')).rejects.toThrow('This UTR has already been used. Please provide a new one.');
  });

  test('throws BadRequestError if same bank_acc_id provided', async () => {
    const payload = { bank_acc_id: 'bank1' }; // same as current
    await expect(updatePayInService({}, payload, 'order123', 'user1', 'company1')).rejects.toThrow('Please provide a different bank account ID');
  });

  test('throws NotFoundError if calculation data not found for amount update', async () => {
    require('../calculation/calculationDao').getAllCalculationforCronDao.mockResolvedValueOnce([]);
    const payload = { amount: 150 };
    await expect(updatePayInService({}, payload, 'order123', 'user1', 'company1')).rejects.toThrow('Calculation data not found');
  });

  test('throws NotFoundError if matching calculation not found for amount update', async () => {
    const mockCalcData = [{ ...mockCalculation, created_at: new Date('2025-10-13') }]; // non-matching date
    require('../calculation/calculationDao').getAllCalculationforCronDao
      .mockResolvedValueOnce(mockCalcData)
      .mockResolvedValueOnce(mockCalcData);
    const payload = { amount: 150 };
    await expect(updatePayInService({}, payload, 'order123', 'user1', 'company1')).rejects.toThrow('Matching calculation not found');
  });

  test('throws NotFoundError if vendor not found for bank update', async () => {
    const payload = { bank_acc_id: 'bank2' };
    require('../bankAccounts/bankaccountDao').getBankaccountDao
      .mockResolvedValueOnce([mockBank])
      .mockResolvedValueOnce([{ ...mockBank, id: 'bank2', user_id: 'vendor2' }]);
    require('../vendors/vendorDao').getVendorsDao
      .mockResolvedValueOnce([mockVendor])
      .mockResolvedValueOnce([]); // new vendor not found
    await expect(updatePayInService({}, payload, 'order123', 'user1', 'company1')).rejects.toThrow('Vendor not found');
  });

  test('throws NotFoundError if calculation data not found for bank update', async () => {
    const payload = { bank_acc_id: 'bank2' };
    require('../bankAccounts/bankaccountDao').getBankaccountDao
      .mockResolvedValueOnce([mockBank])
      .mockResolvedValueOnce([{ ...mockBank, id: 'bank2', user_id: 'vendor2' }]);
    require('../vendors/vendorDao').getVendorsDao
      .mockResolvedValueOnce([mockVendor])
      .mockResolvedValueOnce([{ ...mockVendor, user_id: 'vendor2' }]);
    require('../calculation/calculationDao').getAllCalculationforCronDao
      .mockResolvedValueOnce([{ ...mockCalculation }])
      .mockResolvedValueOnce([]); // new calc not found
    await expect(updatePayInService({}, payload, 'order123', 'user1', 'company1')).rejects.toThrow('Calculation data not found');
  });

  test('throws NotFoundError if matching calculation not found for bank update', async () => {
    const payload = { bank_acc_id: 'bank2' };
    require('../bankAccounts/bankaccountDao').getBankaccountDao
      .mockResolvedValueOnce([mockBank])
      .mockResolvedValueOnce([{ ...mockBank, id: 'bank2', user_id: 'vendor2' }]);
    require('../vendors/vendorDao').getVendorsDao
      .mockResolvedValueOnce([mockVendor])
      .mockResolvedValueOnce([{ ...mockVendor, user_id: 'vendor2' }]);
    const mockCalcData = [{ ...mockCalculation, created_at: new Date('2025-10-13') }]; // non-matching
    require('../calculation/calculationDao').getAllCalculationforCronDao
      .mockResolvedValueOnce(mockCalcData)
      .mockResolvedValueOnce(mockCalcData);
    await expect(updatePayInService({}, payload, 'order123', 'user1', 'company1')).rejects.toThrow('Matching calculation not found');
  });
});
});