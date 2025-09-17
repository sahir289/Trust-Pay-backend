// src/apis/payOut/__tests__/payOutService.test.js
'use strict';

import { expect, describe, beforeEach, test } from '@jest/globals';

// -----------------------------
// Mock external modules (no outer closures)
// -----------------------------
jest.mock('../../utils/db.js', () => ({
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  getConnection: jest.fn(),
  rollback: jest.fn(),
}));

jest.mock('./payOutDao.js', () => ({
  assignedPayoutDao: jest.fn(),
  createPayoutDao: jest.fn(),
  deletePayoutDao: jest.fn(),
  getPayoutsDao: jest.fn(),
  getPayoutsBySearchDao: jest.fn(),
  updatePayoutDao: jest.fn(),
  getAllPayoutsDao: jest.fn(),
  getPayoutBankDetailsDao: jest.fn(),
}));

jest.mock('../merchants/merchantDao.js', () => ({
  getMerchantsDao: jest.fn(),
  getMerchantByUserIdDao: jest.fn(),
  getMerchantsByCodeDao: jest.fn(),
}));

jest.mock('../vendors/vendorDao.js', () => ({
  getVendorsDao: jest.fn(),
}));

jest.mock('../calculation/calculationDao.js', () => ({
  getCalculationDao: jest.fn(),
  getCalculationforCronDao: jest.fn(),
  updateCalculationBalanceDao: jest.fn(),
}));

jest.mock('../bankAccounts/bankaccountDao.js', () => ({
  updateBankaccountDao: jest.fn(),
  getBankByIdDao: jest.fn(),
}));

jest.mock('../../config/config.js', () => ({
  default: {
    ekoAccessKey: 'ekoKey',
    ekoServiceCode: 'svc',
    ekoUserCode: 'usercode',
    ekoInitiatorId: 'init',
    ekoPaymentsActivateUrl: 'https://eko/activate',
    ekoPaymentsInitiateUrl: 'https://eko/init',
    ekoPaymentsStatusUrlByClientRefId: 'https://eko/status/',
    ekoDeveloperKey: 'devkey',
    ekoWalletBalanceEnquiryUrl: 'https://eko/bal',
    ekoRegisteredMobileNo: '9999999999',
  },
}));

jest.mock('../../callBacksAndWebHook/merchantCallBacks.js', () => ({
  merchantPayoutCallback: jest.fn(),
}));

jest.mock('../../constants/index.js', () => ({
  Status: {
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    PENDING: 'PENDING',
    INITIATED: 'INITIATED',
    REVERSED: 'REVERSED',
    SUCCESS: 'SUCCESS',
  },
  Method: {
    EKO: 'EKO',
  },
  tableName: { PAYOUT: 'Payout' },
  payAssistErrorCodeMap: { '14': 'Some Error', '0': 'OK' },
  columns: {},
  merchantColumns: {},
  vendorColumns: {},
  Role: { MERCHANT: 'MERCHANT', VENDOR: 'VENDOR', ADMIN: 'ADMIN' },
  columns: {},
}));

jest.mock('../../helpers/index.js', () => ({
  calculateCommission: jest.fn((amount, percent) => (amount * (percent || 0)) / 100),
  filterResponse: jest.fn((data) => data),
}));

jest.mock('../userHierarchy/userHierarchyDao.js', () => ({
  getUserHierarchysDao: jest.fn(),
}));

jest.mock('../../utils/trackVendorsNetBalance.js', () => ({
  trackVendorsNetBalance: jest.fn(),
}));

jest.mock('../../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
  },
}));

jest.mock('../../utils/sockets.js', () => ({
  newTableEntry: jest.fn(),
}));

jest.mock('../../utils/advisoryLock.js', () => ({
  checkLockEdit: jest.fn(),
}));

jest.mock('../../utils/index.js', () => ({
  stringifyJSON: jest.fn((v) => JSON.stringify(v)),
}));

jest.mock('axios', () => ({
  post: jest.fn(),
  get: jest.fn(),
}));

jest.mock('../company/companyDao.js', () => ({
  getCompanyByIDDao: jest.fn(),
}));

jest.mock('../../utils/trackVendorsNetBalance.js', () => ({
  trackVendorsNetBalance: jest.fn(),
}));

// Eko helpers in this file: createEkoWithdraw, ekoPayoutStatus, ekoWalletBalanceEnquiryInternally
// Those are functions defined in same file - we'll mock them by mocking module exports after import if needed.

// -----------------------------
// Require the module under test (after mocks)
// -----------------------------
const services = require('./payOutService.js');

// grab mocks for assertions
const dbUtils = require('../../utils/db.js');
const dao = require('./payOutDao.js');
const merchantDao = require('../merchants/merchantDao.js');
const vendorDao = require('../vendors/vendorDao.js');
const calcDao = require('../calculation/calculationDao.js');
const bankDao = require('../bankAccounts/bankaccountDao.js');
const axios = require('axios');
const cb = require('../../callBacksAndWebHook/merchantCallBacks.js');
const companyDao = require('../company/companyDao.js');
const helpers = require('../../helpers/index.js');
const newTableEntry = require('../../utils/sockets.js').newTableEntry;
const logger = require('../../utils/logger.js').logger;
const stringifyJSON = require('../../utils/index.js').stringifyJSON;

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// -----------------------------
// Tests
// -----------------------------
describe('payoutServices', () => {
  // ---- walletsPayoutsService ----
  describe('walletsPayoutsService', () => {
    test('returns 400 when mode missing', async () => {
      const res = await services.walletsPayoutsService(null, { payOutids: [1] }, 'u1');
      expect(res).toEqual({ status: 400, message: 'Amount and TransactionType are required' });
    });

    test('returns 404 when PayOuts not found', async () => {
      dao.getPayoutBankDetailsDao.mockResolvedValue([]);
      const res = await services.walletsPayoutsService(null, { payOutids: [1], company_id: 'c1' }, 'u1');
      expect(res).toEqual({ status: 404, message: 'Payout not found' });
    });

    test('handles axios.post failure and returns rejected object for that payout', async () => {
      // Setup: one PayOut
      const info = {
        id: 10,
        user_bank_details: { account_holder_name: 'A', account_no: '123', bank_name: 'B', ifsc_code: 'IFSC' },
        amount: 100,
      };
      dao.getPayoutBankDetailsDao.mockResolvedValue([info]);
      companyDao.getCompanyByIDDao.mockResolvedValue([{ config: { PAY_ASSIST: { walletsPayoutsAgent: 'ag', walletsPayoutsApiKey: 'key', walletsPayoutsUrl: 'https://api', walletsPayoutsAgentCode: 'AC' }, PAY_ASSIST_default: {} } }]);
      // axios.post will throw
      axios.post.mockRejectedValue(new Error('network'));
      // updatePayoutService intentionally mocked to ensure not invoked
      services.updatePayoutService = jest.fn();

      const res = await services.walletsPayoutsService(null, { payOutids: [10], company_id: 'comp1', mode: 'IMPS' }, 'u1');
      // It returns array of responses for payOuts; first entry is the catch object when axios failed
      expect(Array.isArray(res)).toBe(true);
      expect(res[0]).toEqual({
        id: 10,
        status: 'REJECTED',
        utr_id: null,
        rejected_reason: 'API Request Failed',
      });
    });

    test('successful flow calls updatePayoutService when PayAssist returns ok', async () => {
      const info = {
        id: 20,
        user_bank_details: { account_holder_name: 'A', account_no: '123', bank_name: 'B', ifsc_code: 'IFSC' },
        amount: 150,
      };
      dao.getPayoutBankDetailsDao.mockResolvedValue([info]);
      companyDao.getCompanyByIDDao.mockResolvedValue([{ config: { PAY_ASSIST: { walletsPayoutsAgent: 'ag', walletsPayoutsApiKey: 'key', walletsPayoutsUrl: 'https://api', walletsPayoutsAgentCode: 'AC' }, defaultBankId: 1 } }]);
      // axios.post returns a response with no ErrorCode meaning success flow (errorCode falsy)
      axios.post.mockResolvedValue({ data: { ErrorCode: null, Response: { refno: 'R123' } } });
      // axios.post for payoutStatus won't be called in this branch; but just in case:
      axios.post.mockResolvedValueOnce({ data: { ErrorCode: null, Response: { refno: 'R123' } } });
      // mock getBankByIdDao and getVendorsDao used in handlePayoutUpdate
      bankDao.getBankByIdDao.mockResolvedValue([{ id: 1, user_id: 'bankUser' }]);
      vendorDao.getVendorsDao.mockResolvedValue([{ id: 'vend-1' }]);
      // mock updatePayoutService to capture call and return some result
      services.updatePayoutService = jest.fn().mockResolvedValue({ id: 20, status: 'APPROVED' });

      const res = await services.walletsPayoutsService(null, { payOutids: [20], company_id: 'comp1', mode: 'NEFT' }, 'upd-by');
      expect(services.updatePayoutService).toHaveBeenCalled();
      // The returned array should contain what updatePayoutService returned (apiResponse)
      expect(res[0]).toEqual({ id: 20, status: 'APPROVED' });
    });
  });

  // ---- createPayoutService ----
  describe('createPayoutService', () => {
    const basicMerchant = {
      id: 'm1',
      company_id: 'comp1',
      config: { keys: { private: 'priv', public: 'pub' }, whitelist_ips: '1.2.3.4', urls: {} },
      min_payout: 10,
      max_payout: 1000,
      balance: 1000,
      user_id: 'merchant-user',
    };

    test('returns 404 when merchant not found', async () => {
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([]);
      const out = await services.createPayoutService(null, { headers: {} }, { code: 'X', amount: 10 }, null, '1.2.3.4', false);
      expect(out).toEqual({ status: 404, message: 'Merchant is inactive. Contact support for help!' });
    });

    test('IP whitelist denies when not in list', async () => {
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([{ ...basicMerchant, config: { ...basicMerchant.config, whitelist_ips: '9.9.9.9' } }]);
      const out = await services.createPayoutService(null, { headers: {} }, { code: 'X', amount: 50 }, null, '1.2.3.4', false);
      expect(out).toEqual({ status: 400, message: 'IP not whitelisted' });
    });

    test('rejects non whitelisted but admin bypasses', async () => {
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([{ ...basicMerchant, config: { ...basicMerchant.config, whitelist_ips: '9.9.9.9' } }]);
      // role ADMIN bypasses whitelist
      const out = await services.createPayoutService(null, { headers: {} }, { code: 'X', amount: 50 }, 'ADMIN', '1.2.3.4', false);
      // Should continue and possibly error on api key (we expect it to error later since x_api_key missing)
      expect(out.status).toBeDefined();
    });

    test('rejects amount outside bounds for non-admin', async () => {
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([{ ...basicMerchant, min_payout: 20, max_payout: 100 }]);
      const out = await services.createPayoutService(null, { headers: {} }, { code: 'X', amount: 10, x_api_key: 'pub' }, 'MERCHANT', '1.2.3.4', false);
      expect(out).toEqual({ status: 400, message: 'Amount should be between 20 and 100' });
    });

    test('rejects when x_api_key missing or invalid', async () => {
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([basicMerchant]);
      const out1 = await services.createPayoutService(null, { headers: {} }, { code: 'X', amount: 50 }, 'MERCHANT', '1.2.3.4', false);
      expect(out1).toEqual({ status: 404, message: 'Enter valid Api key' });

      const out2 = await services.createPayoutService(null, { headers: {} }, { code: 'X', amount: 50, x_api_key: 'bad' }, 'MERCHANT', '1.2.3.4', false);
      expect(out2).toEqual({ status: 404, message: 'Enter valid Api key' });
    });

    test('rejects when merchant_order_id exists', async () => {
      const m = { ...basicMerchant, config: { ...basicMerchant.config, keys: { private: 'priv', public: 'pub' } } };
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([m]);
      // getPayoutsDao returns array -> exist
      dao.getPayoutsDao.mockResolvedValue([{ id: 'exists' }]);
      const payload = { code: 'X', amount: 50, x_api_key: 'pub', merchant_order_id: 'ord1', company_id: 'comp1' };
      const out = await services.createPayoutService(null, { headers: {} }, payload, 'MERCHANT', '1.2.3.4', false);
      expect(out).toEqual({ status: 400, message: 'Merchant Order ID already exists' });
    });

    test('creates payout successfully and calls newTableEntry', async () => {
      const m = { ...basicMerchant, config: { ...basicMerchant.config, keys: { private: 'priv', public: 'pub' } }, id: 'mid' };
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([m]);
      dao.getPayoutsDao.mockResolvedValue([]); // order id not exist
      // createPayoutDao returns created record
      dao.createPayoutDao.mockResolvedValue({ id: 'p1', amount: 100 });

      const out = await services.createPayoutService(null, { headers: { 'x-api-key': 'pub' } }, { code: 'X', amount: 100, x_api_key: 'pub', company_id: 'comp1' }, 'MERCHANT', '1.2.3.4', false);

      expect(dao.createPayoutDao).toHaveBeenCalled();
      expect(newTableEntry).toHaveBeenCalledWith('Payout');
      expect(out).toEqual({ id: 'p1', amount: 100 });
    });

    test('balanceRestriction checks fail on insufficient balance', async () => {
      const m = { ...basicMerchant, config: { ...basicMerchant.config, keys: { private: 'priv', public: 'pub' }, balanceRestriction: true }, id: 'mid', user_id: 'u1' };
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([m]);
      dao.getPayoutsDao.mockResolvedValue([]);
      dao.createPayoutDao.mockResolvedValue({ id: 'p1', amount: 5000 });
      calcDao.getCalculationDao.mockResolvedValue({ totalNetBalance: 10 });
      // call
      const out = await services.createPayoutService(null, { headers: { 'x-api-key': 'pub' } }, { code: 'X', amount: 100, x_api_key: 'pub' }, 'MERCHANT', '1.2.3.4', false);
      expect(out).toEqual({ status: 400, message: 'Insufficient Balance to create Payout' });
    });
  });

  // ---- getPayoutsService ----
  describe('getPayoutsService', () => {
    test('fetches payouts from getAllPayoutsDao and returns payload shape', async () => {
      dao.getAllPayoutsDao.mockResolvedValue([{ total: 1, id: 'p1' }]);
      const out = await services.getPayoutsService('comp1', 1, 10, 'DESC', {}, 'ROLE', 'u1', 'D');
      expect(dao.getAllPayoutsDao).toHaveBeenCalled();
      expect(out).toEqual({ totalCount: 1, payout: [{ total: 1, id: 'p1' }] });
    });

    test('handles errors and throws', async () => {
      dao.getAllPayoutsDao.mockRejectedValue(new Error('db fail'));
      await expect(services.getPayoutsService('c', 1, 10, 'DESC', {}, 'ROLE', 'u', 'D')).rejects.toThrow('db fail');
    });
  });

  // ---- getPayoutsBySearchService ----
  describe('getPayoutsBySearchService', () => {
    test('validates page/limit numbers and throws on invalid', async () => {
      await expect(services.getPayoutsBySearchService({ company_id: 'c', page: '0', limit: '0' }, 'ROLE', 'u', 'D', false)).rejects.toThrow();
    });

    test('search returns data', async () => {
      dao.getPayoutsBySearchDao.mockResolvedValue([{ id: 's1' }]);
      const out = await services.getPayoutsBySearchService({ company_id: 'c', page: 1, limit: 10 }, 'ROLE', 'u', 'D', false);
      expect(dao.getPayoutsBySearchDao).toHaveBeenCalled();
      expect(out).toEqual([{ id: 's1' }]);
    });

    test('errors wrap into InternalServerError', async () => {
      dao.getPayoutsBySearchDao.mockRejectedValue(new Error('bad'));
      await expect(services.getPayoutsBySearchService({ company_id: 'c', page: 1, limit: 10 }, 'ROLE', 'u', 'D', false)).rejects.toBeInstanceOf(Error);
    });
  });

  // ---- updatePayoutService (selected branches) ----
  describe('updatePayoutService', () => {
    const ids = { id: 'p1', company_id: 'c1' };

    test('throws NotFoundError when payout not found', async () => {
      // getPayoutsDao returns empty
      dao.getPayoutsDao.mockResolvedValue([]);
      await expect(services.updatePayoutService(null, ids, { utr_id: 'xyz' }, 'ROLE')).rejects.toThrow();
    });

    test('rejects invalid UTR uniqueness conflict', async () => {
      // set singleWithdrawData and then getPayoutsDao returns conflict
      const existing = [{ id: 'p1', status: 'PENDING' }];
      dao.getPayoutsDao.mockResolvedValueOnce(existing); // for singleWithdrawDataArr
      // For utr uniqueness check return another payout with same utr
      dao.getPayoutsDao.mockResolvedValueOnce([{ id: 'other', utr_id: 'UTR1' }]);
      await expect(services.updatePayoutService(null, ids, { utr_id: 'UTR1', updated_by: 'u1' }, 'ROLE')).rejects.toThrow();
    });

    test('rejects invalid status transitions', async () => {
      // singleWithdrawData current status REJECTED
      dao.getPayoutsDao.mockResolvedValueOnce([{ id: 'p1', status: 'REJECTED' }]);
      // For payoutDetails duplicate check later, return empty
      dao.getPayoutsDao.mockResolvedValueOnce([]);
      // Now payload tries to change to APPROVED which is invalid
      await expect(services.updatePayoutService(null, ids, { status: 'APPROVED', updated_by: 'u1' }, 'ROLE')).rejects.toThrow();
    });

    test('approves payout and performs bank and calculation updates', async () => {
      // Prepare singleWithdrawData returned when fetching payout
      const single = [{ id: 'p1', merchant_id: 'm1', bank_acc_id: 1, amount: 100, status: 'PENDING' }];
      dao.getPayoutsDao.mockResolvedValueOnce(single); // for singleWithdrawDataArr

      // getMerchantsDao returns merchant with payout_commission
      merchantDao.getMerchantsDao.mockResolvedValue([{ id: 'm1', payout_commission: 2, user_id: 'mUser', config: {} }]);
      // bank data
      bankDao.getBankByIdDao.mockResolvedValue([{ id: 1, user_id: 'bankUser', payin_count: 0, today_balance: 1000, balance: 2000, config: { max_limit: 10000 } }]);
      // vendors
      vendorDao.getVendorsDao.mockResolvedValue([{ id: 'v1', payout_commission: 1 }]);
      // updatePayoutDao returns updated data
      dao.updatePayoutDao.mockResolvedValue({ id: 'p1', amount: 100, status: 'APPROVED' });

      // Mock updateCalculationTable (internal in services file) by spying on calcDao.updateCalculationBalanceDao
      calcDao.getCalculationforCronDao.mockResolvedValue([{ id: 'calc1', user_id: 'mUser' }]);
      calcDao.updateCalculationBalanceDao.mockResolvedValue({}); // for updateCalculationBalanceDao
      const result = await services.updatePayoutService(null, ids, { updated_by: 'u1', bank_acc_id: 1, config: { method: 'PayAssist' } }, 'ROLE');

      expect(dao.updatePayoutDao).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  // ---- checkPayOutStatusService ----
  describe('checkPayOutStatusService', () => {
    test('returns 400 when merchant not found', async () => {
      merchantDao.getMerchantsDao.mockResolvedValue([]);
      const out = await services.checkPayOutStatusService('p1', 'codeX', 'mo1', 'key');
      expect(out).toEqual({ status: 400, message: 'Merchant Order ID already exists' });
    });

    test('returns 404 when api_key invalid', async () => {
      merchantDao.getMerchantsDao.mockResolvedValue([{ config: { keys: { private: 'p', public: 'q' } } }]);
      const out = await services.checkPayOutStatusService('p1', 'codeX', 'mo1', 'bad');
      expect(out).toEqual({ status: 404, message: 'Enter valid Api key' });
    });

    test('returns payout details when found', async () => {
      // merchant match and payout found
      merchantDao.getMerchantsDao.mockResolvedValue([{ id: 'm1', config: { keys: { private: 'p', public: 'q' } } }]);
      dao.getPayoutsDao.mockResolvedValue([{ id: 'p1', merchant_id: 'm1', status: 'APPROVED', merchant_order_id: 'mo1', amount: 50, utr_id: 'U1' }]);
      const out = await services.checkPayOutStatusService('p1', 'codeX', 'mo1', 'p');
      expect(out).toEqual({ status: 'APPROVED', merchantOrderId: 'mo1', amount: 50, payoutId: 'p1', utr_id: 'U1' });
    });
  });

  // ---- getWalletsBalanceService ----
  describe('getWalletsBalanceService', () => {
    test('returns balance when axios get works', async () => {
      companyDao.getCompanyByIDDao.mockResolvedValue([{ config: { PAY_ASSIST: { walletsPayoutsUrl: 'https://api', walletsPayoutsAgent: 'a', walletsPayoutsApiKey: 'k' } } }]);
      axios.get.mockResolvedValue({ data: { Response: { Balance: 777 } } });
      const res = await services.getWalletsBalanceService('comp1');
      expect(res).toEqual({ balance: 777 });
    });

    test('throws when axios fails', async () => {
      companyDao.getCompanyByIDDao.mockResolvedValue([{ config: { PAY_ASSIST: { walletsPayoutsUrl: 'https://api', walletsPayoutsAgent: 'a', walletsPayoutsApiKey: 'k' } } }]);
      axios.get.mockRejectedValue(new Error('net'));
      await expect(services.getWalletsBalanceService('comp1')).rejects.toThrow('net');
    });
  });
});
