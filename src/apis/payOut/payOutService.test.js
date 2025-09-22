// src/apis/payOut/__tests__/payOutService.test.js
'use strict';

import { describe, expect, test, beforeEach } from '@jest/globals';

jest.mock('uuid', () => ({ v4: () => 'uuid-v4' }));

// Mock utils / db / daos / helpers / constants / logger / axios / callbacks
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
  Role: {
    MERCHANT: 'MERCHANT',
    SUB_MERCHANT: 'SUB_MERCHANT',
    MERCHANT_OPERATIONS: 'MERCHANT_OPERATIONS',
    VENDOR: 'VENDOR',
    SUB_VENDOR: 'SUB_VENDOR',
    VENDOR_OPERATIONS: 'VENDOR_OPERATIONS',
    ADMIN: 'ADMIN',
  },
}));

jest.mock('../../helpers/index.js', () => ({
  calculateCommission: jest.fn((amount, pct) => Number(((amount * (pct || 0)) / 100).toFixed(2))),
  filterResponse: jest.fn((d) => d),
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
    warn: jest.fn(),
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

// finally require the module under test after mocks
const services = require('./payOutService.js');

// grab mocks for assertions
const dao = require('./payOutDao.js');
const merchantDao = require('../merchants/merchantDao.js');
const vendorDao = require('../vendors/vendorDao.js');
const calcDao = require('../calculation/calculationDao.js');
const bankDao = require('../bankAccounts/bankaccountDao.js');
const axios = require('axios');
const companyDao = require('../company/companyDao.js');
const { merchantPayoutCallback } = require('../../callBacksAndWebHook/merchantCallBacks.js');
const { logger } = require('../../utils/logger.js');
const { checkLockEdit } = require('../../utils/advisoryLock.js');
const { newTableEntry } = require('../../utils/sockets.js');

// reset mocks each test
beforeEach(() => {
  jest.clearAllMocks();
});

// -----------------------------
// Test suites
// -----------------------------
describe('payOutService (unit tests)', () => {
  // walletsPayoutsService
  describe('walletsPayoutsService', () => {
    test('returns 400 when mode missing', async () => {
      const out = await services.walletsPayoutsService(null, { payOutids: [1], company_id: 'c1' }, 'u1');
      expect(out).toEqual({ status: 400, message: 'Amount and TransactionType are required' });
    });

    test('returns 404 when payout not found', async () => {
      dao.getPayoutBankDetailsDao.mockResolvedValue([]);
      const out = await services.walletsPayoutsService(null, { mode: 'c1' }, 'u1');
      expect(out).toEqual({ status: 404, message: 'Payout not found' });
    });

    test('handles axios.post failure and returns rejected object', async () => {
      const info = {
        id: 10,
        user_bank_details: { account_holder_name: 'A', account_no: '123', bank_name: 'B', ifsc_code: 'IFSC' },
        amount: 100,
      };
      dao.getPayoutBankDetailsDao.mockResolvedValue([info]);
      companyDao.getCompanyByIDDao.mockResolvedValue([{ config: { PAY_ASSIST: { walletsPayoutsAgent: 'ag', walletsPayoutsApiKey: 'key', walletsPayoutsUrl: 'https://api', walletsPayoutsAgentCode: 'AC' }, defaultBankId: 1 } }]);
      axios.post.mockRejectedValue(new Error('network error'));

      const res = await services.walletsPayoutsService(null, { payOutids: [10], company_id: 'comp1', mode: 'IMPS' }, 'u1');
      expect(Array.isArray(res)).toBe(true);
      expect(res[0]).toEqual({
        id: 10,
        status: 'REJECTED',
        utr_id: null,
        rejected_reason: 'API Request Failed',
      });
      expect(logger.error).toHaveBeenCalled();
    });

    test('successful flow calls updatePayoutService and returns its response', async () => {
      const info = {
        id: 20,
        user_bank_details: { account_holder_name: 'A', account_no: '123', bank_name: 'B', ifsc_code: 'IFSC' },
        amount: 150,
      };
      dao.getPayoutBankDetailsDao.mockResolvedValue([info]);
      companyDao.getCompanyByIDDao.mockResolvedValue([{ config: { PAY_ASSIST: { walletsPayoutsAgent: 'ag', walletsPayoutsApiKey: 'key', walletsPayoutsUrl: 'https://api', walletsPayoutsAgentCode: 'AC' }, defaultBankId: 1 } }]);
      // axios.post returns success object without ErrorCode
      axios.post.mockResolvedValue({ data: { ErrorCode: null, Response: { refno: 'R123' } } });
      // getBankByIdDao and getVendorsDao used in update handler
      bankDao.getBankByIdDao.mockResolvedValue([{ id: 1, user_id: 'bankUser' }]);
      vendorDao.getVendorsDao.mockResolvedValue([{ id: 'vend-1' }]);
      // patch updatePayoutService on services so it is invoked and returns a value
      // expect(dao.updatePayoutDao).toHaveBeenCalledWith(
      //   { id: 20 },
      //   { status: 'APPROVED' },
      //   null
      // );

      dao.updatePayoutDao.mockResolvedValue({ id: 20, status: 'APPROVED' });
      services.updatePayoutService.mockResolvedValue({ id: 20, status: 'APPROVED' });

      const res = await services.walletsPayoutsService(null, { payOutids: [20], company_id: 'comp1', mode: 'NEFT' }, 'upd-by');
      expect(services.updatePayoutService).toHaveBeenCalled();
      expect(res[0]).toEqual({ id: 20, status: 'APPROVED' });
    });
  });

  // createPayoutService
  describe('createPayoutService', () => {
    const basicMerchant = [{
      id: 'm1',
      company_id: 'comp1',
      config: { keys: { private: 'priv', public: 'pub' }, whitelist_ips: ['1.2.3.4'], urls: {},balanceRestriction:true },
      min_payout: 10,
      max_payout: 1000,
      balance: 1000,
      user_id: 'merchant-user',
    }];

    test('returns 404 when merchant not found', async () => {
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([]);
      const out = await services.createPayoutService(null, {}, { code: 'X', amount: 10 }, null, '1.2.3.4', false);
      expect(out).toEqual({ status: 404, message: 'Merchant is inactive. Contact support for help!' });
    });

    test('rejects non-whitelisted IP for non-admin', async () => {
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([{ ...basicMerchant, config: { ...basicMerchant.config, whitelist_ips: '9.9.9.9' } }]);
      const out = await services.createPayoutService(null, {}, { code: 'X', amount: 50 }, 'MERCHANT', '1.2.3.4', false);
      expect(out).toEqual({ status: 400, message: 'IP not whitelisted' });
    });

    test('rejects when API key missing/invalid', async () => {
      merchantDao.getMerchantsByCodeDao.mockResolvedValue(basicMerchant);
      const out1 = await services.createPayoutService(null, {}, { code: 'X', amount: 50 }, 'MERCHANT', ['1.2.3.4'], false);
      expect(out1).toEqual({ status: 404, message: 'Enter valid Api key' });

      const out2 = await services.createPayoutService(null, {}, { code: 'X', amount: 50, x_api_key: 'bad' }, 'MERCHANT', ['1.2.3.4'], false);
      expect(out2).toEqual({  status: 404, message: 'Enter valid Api key' });
    });

    test('rejects when merchant_order_id already exists', async () => {
      const m = { ...basicMerchant, config: { ...basicMerchant.config, keys: { private: 'priv', public: 'pub' } } };
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([m]);
      dao.getPayoutsDao.mockResolvedValue([{ id: 'exists' }]);
      const payload = { code: 'X', amount: 50, x_api_key: 'pub', merchant_order_id: 'ord1', company_id: 'comp1' };
      const out = await services.createPayoutService(null, { headers: {} }, payload, 'MERCHANT', '1.2.3.4', false);
      expect(out).toEqual({ status: 400, message: 'Merchant Order ID already exists' });
    });

    test('creates payout successfully and calls newTableEntry', async () => {
      const m = { ...basicMerchant, config: { ...basicMerchant.config, keys: { private: 'priv', public: 'pub' } }, id: 'mid' };
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([m]);
      dao.getPayoutsDao.mockResolvedValue([]); // no existing order
      dao.createPayoutDao.mockResolvedValue({ id: 'p1', amount: 100 });

      const out = await services.createPayoutService(null, { headers: { 'x-api-key': 'pub' } }, { code: 'X', amount: 100, x_api_key: 'pub', company_id: 'comp1' }, 'MERCHANT', '1.2.3.4', false);
      expect(dao.createPayoutDao).toHaveBeenCalled();
      expect(newTableEntry).toHaveBeenCalledWith('Payout');
      expect(out).toEqual({ id: 'p1', amount: 100 });
    });

    test('balanceRestriction fails on insufficient calculation balance', async () => {
      const m = { ...basicMerchant, config: { ...basicMerchant.config, keys: { private: 'priv', public: 'pub' }, balanceRestriction: true }, id: 'mid', user_id: 'u1' };
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([m]);
      dao.getPayoutsDao.mockResolvedValue([]);
      dao.createPayoutDao.mockResolvedValue({ id: 'p1', amount: 5000 });
      calcDao.getCalculationDao.mockResolvedValue({ totalNetBalance: 10 });

      const out = await services.createPayoutService(null, { headers: { 'x-api-key': 'pub' } }, { code: 'X', amount: 100, x_api_key: 'pub' }, 'MERCHANT', '1.2.3.4', false);
      expect(out).toEqual({ status: 400, message: 'Insufficient Balance to create Payout' });
    });
  });

  // getPayoutsService
  describe('getPayoutsService', () => {
    test('returns formatted payload from getAllPayoutsDao', async () => {
      dao.getAllPayoutsDao.mockResolvedValue([{ total: 2, id: 'p1' }]);
      const out = await services.getPayoutsService('comp1', 1, 10, 'DESC', {}, 'ROLE', 'u1', 'D');
      expect(dao.getAllPayoutsDao).toHaveBeenCalled();
      expect(out).toEqual({ totalCount: 2, payout: [{ total: 2, id: 'p1' }] });
    });

    test('throws and logs on dao error', async () => {
      dao.getAllPayoutsDao.mockRejectedValue(new Error('db fail'));
      await expect(services.getPayoutsService('comp1', 1, 10, 'DESC', {}, 'ROLE', 'u', 'D')).rejects.toThrow('db fail');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // getPayoutsBySearchService
  describe('getPayoutsBySearchService', () => {
    test('throws BadRequestError on invalid pagination', async () => {
      await expect(services.getPayoutsBySearchService({ company_id: 'c', page: '0', limit: '0' }, 'ROLE', 'u', 'D', false)).rejects.toThrow();
    });

    test('calls dao and returns data', async () => {
      dao.getPayoutsBySearchDao.mockResolvedValue({ totalCount: 1, payout: [] });
      const out = await services.getPayoutsBySearchService({ company_id: 'c', page: 1, limit: 10 }, 'ROLE', 'u', 'D', false);
      expect(dao.getPayoutsBySearchDao).toHaveBeenCalled();
      expect(out).toEqual({ totalCount: 1, payout: [] });
    });

    test('wraps errors into InternalServerError', async () => {
      dao.getPayoutsBySearchDao.mockRejectedValue(new Error('bad'));
      await expect(services.getPayoutsBySearchService({ company_id: 'c', page: 1, limit: 10 }, 'ROLE', 'u', 'D', false)).rejects.toBeInstanceOf(Error);
      expect(logger.error).toHaveBeenCalled();
    });
  });
  // updatePayoutService (selected branches)
  describe('updatePayoutService', () => {
    const ids = { id: 'p1', company_id: 'c1' };

    test('throws NotFoundError when payout not found', async () => {
      dao.getPayoutsDao.mockResolvedValue([]); // singleWithdrawDataArr empty
      await expect(services.updatePayoutService(null, ids, { utr_id: 'xyz' }, 'ROLE')).rejects.toThrow();
      expect(checkLockEdit).toHaveBeenCalled();
    });

    test('throws on UTR uniqueness conflict', async () => {
      // first call: singleWithdrawDataArr (exists)
      dao.getPayoutsDao.mockResolvedValueOnce([{ id: 'p1', status: 'PENDING' }]);
      // utr uniqueness query returns a conflicting row
      dao.getPayoutsDao.mockResolvedValueOnce([{ id: 'other', utr_id: 'UTR1' }]);
      await expect(services.updatePayoutService(null, ids, { utr_id: 'UTR1', updated_by: 'u1' }, 'ROLE')).rejects.toThrow('UTR already exists');
    });

    test('rejects invalid status transition', async () => {
      // current status REJECTED, trying to change to APPROVED
      dao.getPayoutsDao.mockResolvedValueOnce([{ id: 'p1', status: 'REJECTED' }]);
      dao.getPayoutsDao.mockResolvedValueOnce([]); // payoutDetails later
      await expect(services.updatePayoutService(null, ids, { status: 'APPROVED', updated_by: 'u1' }, 'ROLE')).rejects.toThrow();
    });

    test('initiated returns early', async () => {
      // prepare singleWithdrawData
      dao.getPayoutsDao.mockResolvedValueOnce([{ id: 'p1', merchant_id: 'm1', bank_acc_id: 1, amount: 50, status: 'PENDING' }]);
      merchantDao.getMerchantsDao.mockResolvedValue([{ id: 'm1', payout_commission: 2, user_id: 'mUser', config: {} }]);
      // updatePayoutDao returns a payload with status INITIATED
      dao.updatePayoutDao.mockResolvedValue({ id: 'p1', status: 'INITIATED' });
      const out = await services.updatePayoutService(null, ids, { updated_by: 'u1', status: 'INITIATED' }, 'ROLE');
      expect(out.status).toBe('INITIATED');
    });

    test('config-only update returns early (utr_id + updated_by equal)', async () => {
      // prepare singleWithdrawData
      dao.getPayoutsDao.mockResolvedValueOnce([{ id: 'p1', merchant_id: 'm1', bank_acc_id: 1, amount: 50, status: 'PENDING' }]);
      merchantDao.getMerchantsDao.mockResolvedValue([{ id: 'm1', payout_commission: 2, user_id: 'mUser', config: {} }]);
      // updatePayoutDao returns a normal payload but we will call with a payload that only has utr_id + updated_by (so checkPayload matches)
      dao.updatePayoutDao.mockResolvedValue({ id: 'p1', status: 'PENDING', config: {} });
      const payload = { utr_id: 'U1', updated_by: 'u1' };
      // make stringifyJSON return same string for payload and checkPayload by mocking earlier; it's already JSON.stringify
      const out = await services.updatePayoutService(null, ids, payload, 'ROLE');
      expect(out).toBeDefined();
    });

    test('approves payout flow executes commissions, bank update and callbacks', async () => {
      // prepare payout exists
      dao.getPayoutsDao.mockResolvedValueOnce([{ id: 'p1', merchant_id: 'm1', bank_acc_id: 2, amount: 100, status: 'PENDING' }]); // singleWithdrawDataArr
      // merchant and bank
      merchantDao.getMerchantsDao.mockResolvedValue([{ id: 'm1', payout_commission: 2, user_id: 'mUser', config: {} }]);
      bankDao.getBankByIdDao.mockResolvedValue([{ id: 2, user_id: 'bankUser', payin_count: 0, today_balance: 1000, balance: 2000, config: { max_limit: 10000 }, is_obsolete: false, is_blocked: false }]);
      vendorDao.getVendorsDao.mockResolvedValue([{ id: 'v1', payout_commission: 1 }]);
      // updatePayoutDao returns approved data
      dao.updatePayoutDao.mockResolvedValue({ id: 'p1', status: 'APPROVED', amount: 100, merchant_order_id: 'mo1', code: 'C1' });
      // payoutDetails check later returns empty initially to avoid "already" error
      dao.getPayoutsDao.mockResolvedValueOnce([]); // for payoutDetails after
      // calculation and bank update mocks
      calcDao.getCalculationforCronDao.mockResolvedValue([{ id: 'calc1', user_id: 'mUser' }]);
      calcDao.updateCalculationBalanceDao.mockResolvedValue({}); // updateCalculationBalanceDao
      // call service
      const out = await services.updatePayoutService(null, ids, { updated_by: 'u1', bank_acc_id: 2 }, 'ROLE');
      expect(dao.updatePayoutDao).toHaveBeenCalled();
      // since merchantPayoutCallback is called async, ensure it was invoked (we didn't mock to async - it's stub)
      expect(merchantPayoutCallback).toHaveBeenCalled();
      expect(out).toBeDefined();
    });
  });

  // checkPayOutStatusService
  describe('checkPayOutStatusService', () => {
    test('returns 400 when merchant missing', async () => {
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
      merchantDao.getMerchantsDao.mockResolvedValue([{ id: 'm1', config: { keys: { private: 'p', public: 'q' } } }]);
      dao.getPayoutsDao.mockResolvedValue([{ id: 'p1', merchant_id: 'm1', status: 'APPROVED', merchant_order_id: 'mo1', amount: 100, utr_id: 'U1' }]);
      const out = await services.checkPayOutStatusService('p1', 'codeX', 'mo1', 'p');
      expect(out).toEqual({ status: 'APPROVED', merchantOrderId: 'mo1', amount: 100, payoutId: 'p1', utr_id: 'U1' });
    });
  });

  // getWalletsBalanceService
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
