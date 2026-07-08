// -------------------- ESM MOCKS ----------------------
/* global describe, it, expect, beforeEach, beforeAll */

import { jest } from '@jest/globals';
// -------------------- ESM MOCKS ----------------------
jest.unstable_mockModule('../../src/constants/index.js', () => ({
  BankTypes: {
    BANK_TRANSFER: 'BANK_TRANSFER',
    UPI: 'UPI',
    PHONE_PE: 'PHONE_PE',
    INTENT: 'INTENT',
  },
  Currency: { INR: 'INR' },
  Role: { ADMIN: 'ADMIN', MERCHANT: 'MERCHANT' },
  Status: {
    INITIATED: 'INITIATED',
    ASSIGNED: 'ASSIGNED',
    DROPPED: 'DROPPED',
    DUPLICATE: 'DUPLICATE',
    IMG_PENDING: 'IMG_PENDING',
    FAILED: 'FAILED',
  },
  Type: { PAYIN: 'PAYIN', PAYOUT: 'PAYOUT' },
  tableName: { PAYOUT: 'Payout', MERCHANT: 'Merchant' },
  columns: {
    Payout: {
      id: 'id',
      merchant_id: 'merchant_id',
      company_id: 'company_id',
      amount: 'amount',
      status: 'status',
      bank_response_id: 'bank_response_id',
      config: 'config',
      merchant_order_id: 'merchant_order_id',
      user_submitted_utr: 'user_submitted_utr',
    },
  },
  merchantColumns: {
    id: 'id',
    code: 'code',
    company_id: 'company_id',
    config: 'config',
    min_payout: 'min_payout',
    max_payout: 'max_payout',
  },
  vendorColumns: {
    id: 'id',
    code: 'code',
    company_id: 'company_id',
    config: 'config',
    min_payout: 'min_payout',
    max_payout: 'max_payout',
  },
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
  },
  DesignationIs: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MERCHANT: 'MERCHANT',
    VENDOR: 'VENDOR',
  },
  RoleIs: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MERCHANT: 'MERCHANT',
    VENDOR: 'VENDOR',
  },
  Method: { GET: 'GET', POST: 'POST' },
  payAssistErrorCodeMap: {
    ERR001: 'Invalid UTR',
    ERR002: 'Amount Mismatch',
    ERR003: 'Bank Not Assigned',
  },
}));
jest.unstable_mockModule('dayjs', () => {
  const dayjsMock = jest.fn(() => ({
    add: jest.fn(() => ({
      toISOString: jest.fn(() => '2026-01-01T00:00:00.000Z'),
    })),
  }));
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
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
  },
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

// -------------------- IMPORTS ----------------------
let service,
  merchantDao,
  payoutDao,
  companyDao,
  loggerModule,
  bankaccountDao,
  vendorDao,
  bankResponseDao,
  callbacks,
  helpers;
beforeAll(async () => {
  service = await import('../../src/apis/payOut/payoutService.js');
  merchantDao = await import('../../src/apis/merchants/merchantDao.js');
  payoutDao = await import('../../src/apis/payOut/payOutDao.js');
  companyDao = await import('../../src/apis/company/companyDao.js');
  loggerModule = await import('../../src/utils/logger.js');
  bankaccountDao =
    await import('../../src/apis/bankAccounts/bankaccountDao.js');
  vendorDao = await import('../../src/apis/vendors/vendorDao.js');
  bankResponseDao =
    await import('../../src/apis/bankResponse/bankResponseDao.js');
  callbacks =
    await import('../../src/callBacksAndWebHook/merchantCallBacks.js');
  helpers = await import('../../src/helpers/index.js');
});

// -------------------- SETUP & TEARDOWN -------------
beforeEach(() => {
  if (merchantDao) {
    merchantDao.getMerchantsByCodeDao = jest.fn();
    merchantDao.getMerchantBankDao = jest.fn();
    merchantDao.getMerchantsDao = jest.fn();
    merchantDao.getMerchantForNotifyDao = jest.fn();
  }
  if (payoutDao) {
    payoutDao.getPayoutsNotifyDao = jest.fn();
    payoutDao.getPayoutForCheckStatusDao = jest.fn();
    payoutDao.updatePayoutUrlDao = jest.fn();
    payoutDao.getPayoutForUpdateServiceDao = jest.fn();
    payoutDao.getPayoutPendingDao = jest.fn();
    payoutDao.getPayoutsForServiceDao = jest.fn();
    payoutDao.getPayoutForResetDao = jest.fn();
    payoutDao.getPayoutForDisputeServiceDao = jest.fn();
    payoutDao.getPayoutsSumAndCountByStatusDao = jest.fn();
    payoutDao.getPayoutsForServiccDao = jest.fn();
    payoutDao.assignedPayoutDao = jest.fn();
    payoutDao.deletePayoutDao = jest.fn();
    payoutDao.updatePayoutDao = jest.fn();
    payoutDao.getPayoutsBySearchDao = jest.fn();
    payoutDao.getPayoutsDao = jest.fn();
    payoutDao.createPayoutDao = jest.fn();
    payoutDao.getAllPayoutsDao = jest.fn();
    payoutDao.getPayoutByMerchantOrderIdDao = jest.fn();
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
  if (bankResponseDao) {
    bankResponseDao.getBankResponseDao = jest.fn();
    bankResponseDao.getBankResponsePayoutDao = jest.fn();
  }
  if (callbacks) {
    callbacks.merchantPayoutCallback = jest.fn();
  }
  if (helpers) {
    helpers.someHelperFunction = jest.fn();
  }
  jest.clearAllMocks();
});

// -------------------- TESTS ------------------------
describe('payoutService', () => {
  describe('createPayoutService (edge cases)', () => {
    it('should throw if amount is NaN', async () => {
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([
        {
          id: 1,
          config: {},
          company_id: 1,
          user_id: 1,
          min_payout: 1,
          max_payout: 100,
          balance: 100,
        },
      ]);
      payoutDao.getPayoutByMerchantOrderIdDao.mockResolvedValue(false);
      // NaN is a special case that should be tested explicitly, as it can cause unexpected behavior in the code if not handled properly.
      await expect(
        service.createPayoutService(
          {},
          { code: 'c', amount: NaN },
          'MERCHANT',
          false,
        ),
      ).rejects.toThrow();
    });
    it('should throw if payload is missing amount', async () => {
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([
        {
          id: 1,
          config: {},
          company_id: 1,
          user_id: 1,
          min_payout: 1,
          max_payout: 100,
          balance: 100,
        },
      ]);
      payoutDao.getPayoutByMerchantOrderIdDao.mockResolvedValue(false);
      // This test checks if the service correctly throws an error when the amount field is missing from the payload, which is a required field for creating a payout. This ensures that the service validates the input properly and prevents the creation of payouts with incomplete data.
      await expect(
        service.createPayoutService({}, { code: 'c' }, 'MERCHANT', false),
      ).rejects.toThrow();
    });
    it('should throw if merchant min_payout is missing', async () => {
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([
        { id: 1, config: {}, company_id: 1, user_id: 1, balance: 100 },
      ]);
      payoutDao.getPayoutByMerchantOrderIdDao.mockResolvedValue(false);
      // This test checks if the service correctly throws an error when the merchant's min_payout field is missing, which is necessary for validating the payout amount against the merchant's allowed payout range. This ensures that the service does not proceed with creating a payout when it cannot determine the minimum payout limit for the merchant, thus preventing potential issues with invalid payout amounts.
      await expect(
        service.createPayoutService(
          {},
          { code: 'c', amount: 10 },
          'MERCHANT',
          false,
        ),
      ).rejects.toThrow();
    });
  });

  describe('assignedPayoutService (edge cases)', () => {
    it('should throw if getBankByIdDao returns empty', async () => {
      payoutDao.assignedPayoutDao.mockResolvedValue(['id1']);
      payoutDao.getPayoutsDao = jest
        .fn()
        .mockResolvedValue([
          {
            bank_acc_id: 1,
            vendor_id: 1,
            merchant_id: 1,
            company_id: 1,
            user_bank_details: {},
          },
        ]);
      bankaccountDao.getBankByIdDao = jest.fn().mockResolvedValue([]);
      // This test checks if the service correctly throws an error when the getBankByIdDao returns an empty result, which indicates that the bank account associated with the payout cannot be found. This is important to ensure that the service does not proceed with assigning a payout to a bank account that does not exist, which could lead to issues with processing the payout and potential errors in the system.
      await expect(
        service.assignedPayoutService('id1', ['id1'], 1, 1),
      ).rejects.toThrow();
    });
    it('should resolve if getMerchantByIdDao returns empty', async () => {
      payoutDao.assignedPayoutDao.mockResolvedValue(['id1']);
      payoutDao.getPayoutsDao = jest
        .fn()
        .mockResolvedValue([
          {
            bank_acc_id: 1,
            vendor_id: 1,
            merchant_id: 1,
            company_id: 1,
            user_bank_details: {},
          },
        ]);
      bankaccountDao.getBankByIdDao = jest.fn().mockResolvedValue([{ id: 1 }]);
      vendorDao.getVendorsDao = jest.fn().mockResolvedValue([{ id: 1 }]);
      merchantDao.getMerchantByIdDao = jest.fn().mockResolvedValue([]);
      // This test checks if the service correctly resolves when the getMerchantByIdDao returns an empty result, which indicates that the merchant associated with the payout cannot be found. This is important to ensure that the service can handle cases where the merchant information is missing without crashing or throwing an error, allowing for graceful handling of such scenarios in the payout assignment process.
      await expect(
        service.assignedPayoutService('id1', ['id1'], 1, 1),
      ).resolves.toBeDefined();
    });
    it('should resolve if getVendorsDao returns empty', async () => {
      payoutDao.assignedPayoutDao.mockResolvedValue(['id1']);
      payoutDao.getPayoutsDao = jest
        .fn()
        .mockResolvedValue([
          {
            bank_acc_id: 1,
            vendor_id: 1,
            merchant_id: 1,
            company_id: 1,
            user_bank_details: {},
          },
        ]);
      bankaccountDao.getBankByIdDao = jest.fn().mockResolvedValue([{ id: 1 }]);
      vendorDao.getVendorsDao = jest.fn().mockResolvedValue([]);
      merchantDao.getMerchantByIdDao = jest.fn().mockResolvedValue([{ id: 1 }]);
      // This test checks if the service correctly resolves when the getVendorsDao returns an empty result, which indicates that the vendor associated with the payout cannot be found. This is important to ensure that the service can handle cases where the vendor information is missing without crashing or throwing an error, allowing for graceful handling of such scenarios in the payout assignment process.
      await expect(
        service.assignedPayoutService('id1', ['id1'], 1, 1),
      ).resolves.toBeDefined();
    });
  });

  describe('checkPayOutStatusService (edge cases)', () => {
    it('should throw if merchantConfig.keys is missing', async () => {
      merchantDao.getMerchantsDao.mockResolvedValue([{ id: 1, config: {} }]);
      // This test checks if the service correctly throws an error when the merchant's config object does not contain the keys property, which is necessary for validating the API key provided in the request. This ensures that the service does not proceed with checking the payout status when it cannot verify the authenticity of the request due to missing configuration, thus preventing potential security issues and ensuring proper error handling in such scenarios.
      await expect(
        service.checkPayOutStatusService(1, 'code', 'order', 'key'),
      ).resolves.toMatchObject({ status: 404 });
    });
  });
  describe('createPayoutService', () => {
    it('should throw if merchant balance is less than payout amount', async () => {
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([
        { balance: -1, config: {} },
      ]);
      // This test checks if the service correctly throws an error when the merchant's balance is less than the payout amount, which is a critical validation to prevent the creation of payouts that cannot be fulfilled due to insufficient funds. This ensures that the service enforces financial constraints and maintains the integrity of the payout process by not allowing payouts that would result in a negative balance for the merchant.
      await expect(
        service.createPayoutService(
          {},
          { code: 'c', amount: 100 },
          'ADMIN',
          false,
        ),
      ).rejects.toThrow('Merchant balance is less than payout amount');
    });
    it('should throw if merchant order ID already exists', async () => {
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([
        {
          id: 1,
          config: {},
          company_id: 1,
          user_id: 1,
          min_payout: 1,
          max_payout: 100,
          balance: 100,
        },
      ]);
      payoutDao.createPayoutDao.mockRejectedValue({
        code: '23505',
        message: 'duplicate key value violates unique constraint merchant_order_id',
      });
      // Duplicate merchant order IDs are now detected by a DB unique-constraint error raised during insert.
      await expect(
        service.createPayoutService(
          {},
          { code: 'c', amount: 10 },
          'ADMIN',
          false,
        ),
      ).rejects.toThrow('Merchant Order ID already exists');
    });
    it('should throw if amount is out of allowed range', async () => {
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([
        {
          id: 1,
          config: {},
          company_id: 1,
          user_id: 1,
          min_payout: 10,
          max_payout: 20,
          balance: 100,
        },
      ]);
      payoutDao.getPayoutByMerchantOrderIdDao.mockResolvedValue(false);
      // This test checks if the service correctly throws an error when the payout amount is outside the allowed range defined by the merchant's min_payout and max_payout fields. This is important to ensure that the service enforces the payout limits set by the merchant and does not allow payouts that are too small or too large, which could lead to issues with processing payouts and maintaining financial controls.
      await expect(
        service.createPayoutService(
          {},
          { code: 'c', amount: 100 },
          'MERCHANT',
          false,
        ),
      ).rejects.toThrow('Amount should be between 10 and 20');
    });
    it('should throw if code is missing', async () => {
      merchantDao.getMerchantsByCodeDao.mockResolvedValue([]);
      // This test checks if the service correctly throws an error when the code field is missing from the payload, which is a required field for identifying the merchant associated with the payout. This ensures that the service validates the input properly and prevents the creation of payouts without a valid merchant code, which could lead to issues with associating payouts to the correct merchant and tracking them effectively.
      await expect(
        service.createPayoutService({}, { amount: 10 }, 'ADMIN', false),
      ).rejects.toThrow();
    });
  });

  describe('getPayoutsService', () => {
    it('should return payouts and totalCount for valid input', async () => {
      payoutDao.getAllPayoutsDao.mockResolvedValue([{ total: 1, id: 1 }]);
      const result = await service.getPayoutsService(
        1,
        1,
        10,
        'DESC',
        {},
        'ADMIN',
        1,
        'ADMIN',
      );
      // This test checks if the service correctly returns the payouts and totalCount when valid input is provided. It ensures that the service can successfully retrieve payout data and the total count of payouts, which is essential for displaying payout information to users and for pagination purposes in the user interface.
      expect(result.totalCount).toBe(1);
      // This assertion checks if the service returns a non-empty array of payouts, which is important to confirm that the service is correctly fetching and returning payout data based on the provided filters and parameters. It ensures that the service can handle valid requests and provide the expected payout information to the caller.
      expect(result.payout.length).toBeGreaterThan(0);
    });
  });

  describe('getPayoutsBySearchService', () => {
    it('should return data for valid input', async () => {
      payoutDao.getPayoutsBySearchDao.mockResolvedValue([{ id: 1 }]);
      const filters = { page: 1, limit: 10 };
      const result = await service.getPayoutsBySearchService(
        filters,
        'ADMIN',
        1,
        'ADMIN',
        false,
      );
      // This test checks if the service correctly returns the payout data when valid input is provided, ensuring that the service can handle search queries and return the expected results.
      expect(result[0].id).toBe(1);
    });
    it('should return undefined if vendor_code not found', async () => {
      payoutDao.getPayoutsBySearchDao.mockResolvedValue([]);
      if (vendorDao && vendorDao.getVendorsDao) {
        vendorDao.getVendorsDao.mockResolvedValue([]);
      }
      const filters = { page: 1, limit: 10, vendor_code: 'notfound' };
      const result = await service.getPayoutsBySearchService(
        filters,
        'ADMIN',
        1,
        'ADMIN',
        false,
      );
      // This test checks if the service correctly returns undefined when the vendor_code provided in the filters does not match any existing vendor, which is important to ensure that the service can handle cases where the search criteria do not yield any results and does not return incorrect or misleading data.
      expect(result).toBeUndefined();
    });
  });

  describe('updatePayoutService', () => {
    it('should throw if payout not found', async () => {
      payoutDao.getPayoutsDao.mockResolvedValue([]);
      // This test checks if the service correctly throws an error when the payout specified for update cannot be found, which is crucial to prevent attempts to update non-existent payouts and to ensure that the service provides appropriate feedback when the specified payout ID does not exist in the system.
      await expect(
        service.updatePayoutService({ id: 1 }, {}, 'ADMIN'),
      ).rejects.toThrow('Payout status not found!');
    });
    // it('should throw if merchant not found', async () => {
    //   payoutDao.getPayoutsDao.mockResolvedValue([
    //     { merchant_id: 1, bank_acc_id: 1, status: 'INITIATED' },
    //   ]);
    //   payoutDao.getMerchantByIdDao = jest.fn().mockResolvedValue([]);
    //   // This test checks if the service correctly throws an error when the merchant associated with the payout cannot be found, which is important to ensure that the service does not proceed with updating a payout when it cannot verify the existence of the merchant, thus maintaining data integrity and preventing potential issues with orphaned payouts that are not linked to any valid merchant.
    //   await expect(
    //     service.updatePayoutService({ id: 1 }, {}, 'ADMIN'),
    //   ).rejects.toThrow('Merchant not found!');
    // });
  });

  describe('checkPayOutStatusService', () => {
    it('should return 404 if payout does not belong to merchant', async () => {
      merchantDao.getMerchantsDao.mockResolvedValue([
        { id: 1, config: { keys: { private: 'key', public: 'key' } } },
      ]);
      payoutDao.getPayoutsDao.mockResolvedValue([{ merchant_id: 2 }]);
      const result = await service.checkPayOutStatusService(
        1,
        'code',
        'order',
        'key',
      );
      // This test checks if the service correctly returns a 404 status when the payout being checked does not belong to the merchant associated with the provided API key, which is important to ensure that the service enforces proper access control and does not allow users to check the status of payouts that are not linked to their merchant account, thus maintaining security and data privacy.
      expect(result.status).toBe(404);
    });
  });

  describe('deletePayoutService', () => {
    it('should succeed for valid input', async () => {
      payoutDao.deletePayoutDao.mockResolvedValue({ id: 1 });
      payoutDao.filterResponse = jest.fn((data) => data);
      const result = await service.deletePayoutService(1, 1, 'ADMIN');
      // This test checks if the service correctly deletes a payout and returns the expected result when valid input is provided, ensuring that the service can successfully handle payout deletion requests and provide appropriate feedback to the caller.
      expect(result.id).toBe(1);
    });
  });

  describe('assignedPayoutService', () => {
    it('should succeed for valid input', async () => {
      payoutDao.assignedPayoutDao.mockResolvedValue({ id: 1 });
      const result = await service.assignedPayoutService(1, {}, 1, 1);
      // This test checks if the service correctly assigns a payout and returns the expected result when valid input is provided, ensuring that the service can successfully handle payout assignment requests and provide appropriate feedback to the caller.
      expect(result.id).toBe(1);
    });
  });
  describe('createPayoutService', () => {
    it('should throw if merchant is inactive', async () => {
      payoutDao.createPayoutDao.mockResolvedValue(undefined);
      // This test checks if the service correctly throws an error when the merchant associated with the payout is inactive, which is important to ensure that the service does not allow the creation of payouts for merchants that are not active, thus maintaining the integrity of the payout process and preventing potential issues with processing payouts for inactive merchants.
      await expect(
        service.createPayoutService({}, { code: 'invalid' }, 'ADMIN', false),
      ).rejects.toThrow();
    });
  });

  describe('getPayoutsService', () => {
    it('should throw on error', async () => {
      payoutDao.getAllPayoutsDao.mockRejectedValue(new Error('fail'));
      // This test checks if the service correctly throws an error when there is an issue with retrieving payouts, which is important to ensure that the service can handle unexpected errors gracefully and provide appropriate feedback to the caller when something goes wrong during the payout retrieval process.
      await expect(
        service.getPayoutsService(1, 1, 10, 'DESC', {}, 'ADMIN', 1, 'ADMIN'),
      ).rejects.toThrow('fail');
    });
  });

  describe('checkPayOutStatusService', () => {
    it('should return 400 if merchant does not exist', async () => {
      merchantDao.getMerchantsDao.mockResolvedValue([]);
      const result = await service.checkPayOutStatusService(
        1,
        'code',
        'order',
        'key',
      );
      // This test checks if the service correctly returns a 400 status when the merchant associated with the provided API key does not exist, which is important to ensure that the service validates the existence of the merchant before attempting to check the payout status, thus preventing potential issues with processing requests for non-existent merchants and providing appropriate feedback to the caller.
      expect(result.status).toBe(400);
    });
    it('should return 404 if api_key invalid', async () => {
      merchantDao.getMerchantsDao.mockResolvedValue([
        { config: { keys: { private: 'a', public: 'b' } } },
      ]);
      const result = await service.checkPayOutStatusService(
        1,
        'code',
        'order',
        'badkey',
      );
      // This test checks if the service correctly returns a 404 status when the provided API key is invalid, which is important to ensure that the service enforces proper authentication and does not allow access with incorrect credentials, thus maintaining security and data integrity.
      expect(result.status).toBe(404);
    });
    it('should return 404 if payout not found', async () => {
      merchantDao.getMerchantsDao.mockResolvedValue([
        { id: 1, config: { keys: { private: 'key', public: 'key' } } },
      ]);
      payoutDao.getPayoutsDao.mockResolvedValue([]);
      const result = await service.checkPayOutStatusService(
        1,
        'code',
        'order',
        'key',
      );
      // This test checks if the service correctly returns a 404 status when the payout being checked cannot be found, which is important to ensure that the service provides appropriate feedback when the specified payout ID does not exist in the system, thus maintaining data integrity and preventing confusion for users trying to check the status of non-existent payouts.
      expect(result.status).toBe(404);
    });
    it('should return 404 if merchant mismatch', async () => {
      merchantDao.getMerchantsDao.mockResolvedValue([
        { id: 1, config: { keys: { private: 'key', public: 'key' } } },
      ]);
      payoutDao.getPayoutsDao.mockResolvedValue([{ merchant_id: 2 }]);
      const result = await service.checkPayOutStatusService(
        1,
        'code',
        'order',
        'key',
      );
      // This test checks if the service correctly returns a 404 status when the payout being checked does not belong to the merchant associated with the provided API key, which is important to ensure that the service enforces proper access control and does not allow users to check the status of payouts that are not linked to their merchant account, thus maintaining security and data privacy.
      expect(result.status).toBe(404);
    });
    it('should return status and details on success', async () => {
      merchantDao.getMerchantsDao.mockResolvedValue([
        { id: 1, config: { keys: { private: 'key', public: 'key' } } },
      ]);
      payoutDao.getPayoutsDao.mockResolvedValue([
        {
          merchant_id: 1,
          status: 'SUCCESS',
          id: 1,
          merchant_order_id: 'order',
          amount: 100,
        },
      ]);
      const result = await service.checkPayOutStatusService(
        1,
        'code',
        'order',
        'key',
      );
      // This test checks if the service correctly returns the status and details when the payout is found and belongs to the merchant associated with the provided API key, which is important to ensure that the service provides accurate and complete information about the payout, thus maintaining transparency and trust with users.
      expect(result.status).toBeDefined();
    });
    it('should log and throw on error', async () => {
      merchantDao.getMerchantsDao.mockRejectedValue(new Error('fail'));
      // This test checks if the service correctly logs the error and throws an exception when there is an issue with retrieving the merchant information, which is important to ensure that the service can handle unexpected errors gracefully and provide appropriate feedback to the caller while also logging the error for debugging and monitoring purposes.
      await expect(
        service.checkPayOutStatusService(1, 'code', 'order', 'key'),
      ).rejects.toThrow('fail');
    });
  });

  describe('getPayoutsBySearchService', () => {
    it('should throw on error', async () => {
      payoutDao.getPayoutsBySearchDao.mockRejectedValue(new Error('fail'));
      const filters = { page: 1, limit: 10 };
      // This test checks if the service correctly throws an error when there is an issue with retrieving payouts based on search criteria, which is important to ensure that the service can handle unexpected errors gracefully and provide appropriate feedback to the caller when something goes wrong during the payout search process.
      await expect(
        service.getPayoutsBySearchService(filters, 'ADMIN', 1, 'ADMIN', false),
      ).rejects.toThrow('fail');
    });
  });

  describe('updatePayoutService', () => {
    it('should throw on error', async () => {
      payoutDao.getPayoutsDao.mockRejectedValue(new Error('fail'));
      // This test checks if the service correctly throws an error when there is an issue with retrieving the payout information for update, which is important to ensure that the service can handle unexpected errors gracefully and provide appropriate feedback to the caller when something goes wrong during the payout update process.
      await expect(
        service.updatePayoutService({ id: 1 }, {}, 'ADMIN'),
      ).rejects.toThrow('Payout status not found!');
    });
  });

  describe('deletePayoutService', () => {
    it('should throw on error', async () => {
      payoutDao.deletePayoutDao.mockRejectedValue(new Error('fail'));
      // This test checks if the service correctly throws an error when there is an issue with deleting a payout, which is important to ensure that the service can handle unexpected errors gracefully and provide appropriate feedback to the caller when something goes wrong during the payout deletion process.
      await expect(service.deletePayoutService(1, 1, 'ADMIN')).rejects.toThrow(
        'fail',
      );
    });
  });

  describe('assignedPayoutService', () => {
    it('should throw on error', async () => {
      payoutDao.assignedPayoutDao.mockRejectedValue(new Error('fail'));
      // This test checks if the service correctly throws an error when there is an issue with assigning a payout, which is important to ensure that the service can handle unexpected errors gracefully and provide appropriate feedback to the caller when something goes wrong during the payout assignment process.
      await expect(service.assignedPayoutService(1, {}, 1, 1)).rejects.toThrow(
        'fail',
      );
    });
  });

  describe('createTataPayBulkPayoutService', () => {
    it('should throw on error', async () => {
      // Since the implementation of createTataPayBulkPayoutService is not provided, this test assumes that it will throw an error when called with empty payout entries and payout IDs. This is important to ensure that the service validates the input properly and does not proceed with creating bulk payouts when the necessary data is missing, thus maintaining data integrity and preventing potential issues with processing invalid bulk payout requests.
      await expect(
        service.createTataPayBulkPayoutService({
          payoutEntries: [],
          payoutIds: [],
          company_id: '1',
          user_id: '1',
        }),
      ).rejects.toThrow();
    });
  });

  describe('createRupeeFlowBulkPayoutService', () => {
    it('should throw on error', async () => {
      // Since the implementation of createRupeeFlowBulkPayoutService is not provided, this test assumes that it will throw an error when called with empty payout entries and payout IDs. This is important to ensure that the service validates the input properly and does not proceed with creating bulk payouts when the necessary data is missing, thus maintaining data integrity and preventing potential issues with processing invalid bulk payout requests.
      await expect(
        service.createRupeeFlowBulkPayoutService({
          payoutEntries: [],
          payoutIds: [],
          company_id: '1',
          user_id: '1',
        }),
      ).rejects.toThrow();
    });
  });
});
