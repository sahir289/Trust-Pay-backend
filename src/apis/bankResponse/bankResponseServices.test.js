/* eslint-disable no-useless-escape */

jest.mock('../../utils/db');

const {
    getBankResponseService,
    getClaimResponseService,
    createBankResponseService,
    updateBankResponseService,
    getBankMessageServices,
    getBankResponseBySearchService,
    resetBankResponseService,
    updateCalculationBalances,
    createBankResponseWebHookService,
    // updateCalculationTable,
    importBankResponseService,
} = require('./bankResponseServices.js');
const {
    getBankResponseDao,
    createBankResponseDao,
    getBankMessageDao,
    updateBotResponseDao,
    getBankResponseDaoAll,
    updateBankResponseDao,
    getClaimResponseDao,
    getBankResponseBySearchDao,
    resetBankResponseDao,
    getCheckBankResponseDao,
    getForCreateBankResponseDao
} = require('./bankResponseDao');
const { getBankaccountDao, updateBankaccountDao, getBankaccountCheckDao, getBankaccountDashBoardReportDao } = require('../bankAccounts/bankaccountDao.js');
const { updatePayInUrlDao, getPayInsBankResDao, getPayInsForResetBankResDao } = require('../payIn/payInDao');
const { getMerchantsDao, getMerchantsBankResponseDao } = require('../merchants/merchantDao');
const { getVendorsDao, updateVendorDao, getVendorsBankReponseDao } = require('../vendors/vendorDao');
const {
    // getAllCalculationforCronDao,
    updateCalculationBalanceDao,
    getCalculationforCronDao,
} = require('../calculation/calculationDao');
const { merchantPayinCallback } = require('../../callBacksAndWebHook/merchantCallBacks');
const { calculateCommission, filterResponse, calculateDuration } = require('../../helpers/index');
const { newTableEntry } = require('../../utils/sockets');
const { logger } = require('../../utils/logger');
const dbMock = jest.requireMock('../../utils/db.js');
const beginTransaction = dbMock.beginTransaction;
const commit = dbMock.commit;
const getConnection = dbMock.getConnection;
const rollback = dbMock.rollback;
const { columns, merchantColumns, vendorColumns, Role, Status } = require('../../constants/index');
// const { default: PDFParser } = require('pdf2json');
  
  jest.mock('./bankResponseDao');
  jest.mock('../bankAccounts/bankaccountDao');
  jest.mock('../payIn/payInDao');
  jest.mock('../merchants/merchantDao');
  jest.mock('../vendors/vendorDao');
  jest.mock('../calculation/calculationDao');
  jest.mock('../bankAccounts/bankaccountServices');
  jest.mock('../../callBacksAndWebHook/merchantCallBacks');
  jest.mock('../../helpers/index');
  jest.mock('../../utils/sockets');
  jest.mock('../../utils/logger');
  jest.mock('../../utils/appErrors');
  jest.mock('../../utils/db');
  jest.mock('pdf2json');
  jest.mock('dayjs', () => {
    const actualDayjs = jest.requireActual('dayjs');
    const mockDayjs = (...args) => {
      const instance = args.length ? actualDayjs(...args) : actualDayjs('2025-08-18');
      instance.tz = jest.fn(() => ({
        ...instance,
        format: jest.fn().mockReturnValue('2025-08-18'),
      }));
      return instance;
    };
    mockDayjs.extend = actualDayjs.extend;
    return mockDayjs;
  });
  
  jest.mock('../../utils/appErrors', () => ({
    BadRequestError: class BadRequestError extends Error {
      constructor(message) {
        super(message);
        this.name = 'BadRequestError';
      }
    },
    NotFoundError: class NotFoundError extends Error {
      constructor(message) {
        super(message);
        this.name = 'NotFoundError';
      }
    },
  }));
  
  // jest.mock('./bankResponseServices.js', () => ({
  //   ...jest.requireActual('./bankResponseServices.js'),
  //   updateCalculationBalances: jest.fn().mockResolvedValue({}),
  // }));
  jest.mock('pdf2json', () => {
  return jest.fn().mockImplementation(() => {
    return {
      on: jest.fn((event, callback) => {
        if (event === 'pdfParser_dataReady') {
          callback({
            Pages: [
              {
                Texts: [
                  { R: [{ T: '01/08/2025' }] },
                  { R: [{ T: 'Credit UPI/123456789012' }] },
                  { R: [{ T: '1000.00' }] },
                  { R: [{ T: '5000.00' }] },
                ],
              },
            ],
          });
        } else if (event === 'pdfParser_dataError') {
          callback(null); // Ensure error event doesn't hang the Promise
        }
      }),
      parseBuffer: jest.fn(),
    };
  });
});
  
  describe('Bank Response Services', () => {
    let mockConnection;
  
    it('should calculate commission correctly', () => {
      expect(calculateCommission(1000, 0.02)).toBe(20);
      expect(calculateCommission(1000, 0.01)).toBe(10);
    });
  
    beforeEach(() => {
      mockConnection = {
        query: jest.fn(),
        release: jest.fn(),
      };
      getConnection.mockResolvedValue(mockConnection);
      beginTransaction.mockResolvedValue();
      commit.mockResolvedValue();
      rollback.mockResolvedValue();
      logger.error = jest.fn();
      calculateCommission.mockImplementation((amount, rate) => amount * rate);
      calculateDuration.mockReturnValue('00:05:00');
      filterResponse.mockImplementation((data) => data);
      getVendorsDao.mockResolvedValue([{ id: 'vendor_1', balance: 10000, payin_commission: 0.01, user_id: 'vendor_1', code: 'VEND123' }]);
      getVendorsBankReponseDao.mockResolvedValue([{ id: 'vendor_1', balance: 10000, payin_commission: 0.01, user_id: 'vendor_1', code: 'VEND123' }]);
      
    });
  
    afterEach(() => {
      jest.clearAllMocks();
    });
  
    describe('createBankResponseService', () => {
      beforeEach(() => {
        mockConnection = {
          query: jest.fn(),
          release: jest.fn(),
        };
        getVendorsDao.mockResolvedValue([{ id: 'vendor_1', balance: 10000, payin_commission: 0.01, user_id: 'vendor_1', code: 'VEND123' }]);
        getVendorsBankReponseDao.mockResolvedValue([{ id: 'vendor_1', balance: 10000, payin_commission: 0.01, user_id: 'vendor_1', code: 'VEND123' }]);

        getConnection.mockResolvedValue(mockConnection);
        beginTransaction.mockResolvedValue();
        commit.mockResolvedValue();
        rollback.mockResolvedValue();
        logger.error = jest.fn();
        calculateCommission.mockImplementation((amount, rate) => amount * rate);
        calculateDuration.mockReturnValue('00:05:00');
        filterResponse.mockImplementation((data) => data);
      
        // Add mock for getBankaccountDashBoardReportDao
        getBankaccountDashBoardReportDao.mockResolvedValue([
          {
            id: 'bank_1',
            balance: 5000,
            today_balance: 2000,
            payin_count: 1,
            user_id: 'user_1',
            config: {},
            nick_name: 'Bank A',
          },
        ]);
      });
      it('should create a bank response with valid payload and no UTR or amount code conflict', async () => {
        const payload = '1000.00 nil utr123 bank_1 true';
        const companyId = '123';
        const role = 'MERCHANT';
        const name = 'test_user';
      
        // Mock getBankaccountCheckDao
        getBankaccountCheckDao.mockResolvedValue({
          id: 'bank_1',
          company_id: '123',
          bank_used_for: 'PayIn',
        });
      
        getBankResponseDao.mockResolvedValue(null);
        getCheckBankResponseDao.mockResolvedValue(null); // Mock for no existing UTR/amount code
        getForCreateBankResponseDao.mockResolvedValue({ rows: [] }); // Mock for no existing used UTR
        createBankResponseDao.mockResolvedValue({
          id: '1',
          status: '/success',
          amount: 1000,
          utr: 'utr123',
          bank_id: 'bank_1',
          is_used: 'false',
          created_by: 'test_user',
          updated_by: 'test_user',
          company_id: '123',
        });
        getBankaccountDao.mockResolvedValue([
          { balance: 5000, today_balance: 2000, payin_count: 1, user_id: 'user_1', config: {}, nick_name: 'Bank A' },
        ]);
        getVendorsDao.mockResolvedValue([{ id: 'vendor_1', balance: 10000, payin_commission: 0.01, user_id: 'vendor_1', code: 'VEND123' }]);
        getVendorsBankReponseDao.mockResolvedValue([{ id: 'vendor_1', balance: 10000, payin_commission: 0.01, user_id: 'vendor_1', code: 'VEND123' }]);
        getCalculationforCronDao.mockResolvedValue([{ id: 'calc_1', created_at: new Date('2025-08-18') }]); // Mock for calculation data
        updateBankaccountDao.mockResolvedValue({ today_balance: 3000 });
        updateVendorDao.mockResolvedValue({});
        newTableEntry.mockResolvedValue();
        updateCalculationBalanceDao.mockResolvedValue({});
      
        const result = await createBankResponseService(payload, companyId, role, name);
      
        expect(getBankaccountCheckDao).toHaveBeenCalledWith({
          id: 'bank_1',
          company_id: '123',
          bank_used_for: 'PayIn',
        });
        expect(createBankResponseDao).toHaveBeenCalledWith(mockConnection, {
          status: '/success',
          amount: 1000,
          utr: 'utr123',
          bank_id: 'bank_1',
          is_used: 'false',
          created_by: 'test_user',
          updated_by: 'test_user',
          company_id: '123',
        });
        expect(commit).toHaveBeenCalled();
        expect(result).toEqual({ message: 'Entry created successfully', data: expect.any(Object) });
      });
  
      it('should throw error if bank account not found for repeated UTR', async () => {
        const payload = '1000.00 nil utr123 bank_1 true';
        getBankaccountCheckDao.mockResolvedValue(null);
        await expect(
          createBankResponseService(payload, '123', 'MERCHANT', 'test_user')
        ).rejects.toThrow('Bank account does not exist for this company');
        expect(getBankaccountCheckDao).toHaveBeenCalledWith({
          id: 'bank_1',
          company_id: '123',
          bank_used_for: 'PayIn',
        });
        expect(getBankResponseDao).not.toHaveBeenCalled();
        expect(createBankResponseDao).not.toHaveBeenCalled();
      });
      it('should throw error if vendor not found for successful UTR', async () => {
        const payload = '1000.00 nil utr123 bank_1 true';
        getBankResponseDao.mockResolvedValue(null);
        getBankaccountCheckDao.mockResolvedValue({
          id: 'bank_1',
          company_id: '123',
          bank_used_for: 'PayIn',
        });
        getBankaccountDashBoardReportDao.mockResolvedValue([
          { balance: 5000, today_balance: 2000, payin_count: 1, user_id: 'user_1', config: {}, nick_name: 'Bank A' },
        ]);
        getVendorsBankReponseDao.mockResolvedValue([]);
        await expect(
          createBankResponseService(payload, '123', 'MERCHANT', 'test_user')
        ).rejects.toThrow('Cannot read properties of undefined (reading \'balance\')');
      });
      it('should handle repeated Amount Code', async () => {
        const payload = '1000.00 amt12 utr123 bank_1 true';
        getBankaccountCheckDao.mockResolvedValue({
          id: 'bank_1',
          company_id: '123',
          bank_used_for: 'PayIn',
        });
        getCheckBankResponseDao.mockResolvedValue({ id: 'existing' }); // Mock for repeated amount code
        createBankResponseDao.mockResolvedValue({ id: '1', status: '/repeated', upi_short_code: 'amt12' });
        getBankaccountDao.mockResolvedValue([
          { balance: 5000, today_balance: 2000, payin_count: 1, user_id: 'user_1', config: {}, nick_name: 'Bank A' },
        ]);
        getVendorsDao.mockResolvedValue([{ id: 'vendor_1', balance: 10000, payin_commission: 0.01, user_id: 'vendor_1', code: 'VEND123' }]);
        getVendorsBankReponseDao.mockResolvedValue([{ id: 'vendor_1', balance: 10000, payin_commission: 0.01, user_id: 'vendor_1', code: 'VEND123' }]);
      
        const result = await createBankResponseService(payload, '123', 'MERCHANT', 'test_user');
      
        expect(createBankResponseDao).toHaveBeenCalled();
        expect(result).toEqual({ message: 'Entry with REPEATED AMOUNT CODE: amt12 Added' });
      });
  
      it('should throw error for invalid amount', async () => {
        await expect(
          createBankResponseService('510000 nil utr12387 bank_1 true', '123', 'MERCHANT', 'test_user'),
        ).rejects.toThrow('amount must be between 1 and 500000');
      });
  
      it('should throw error for invalid UTR format', async () => {
        const payload = '1000.00 nil utr@123 bank_1 true';
        const result = await createBankResponseService(payload, '123', 'MERCHANT', 'test_user');
        expect(result).toEqual({ message: 'UTRs can only contain alphanumeric characters.' });
      });
  
      it('should handle successful pay-in with matching UTR', async () => {
        const payload = '1000.00 nil utr123 bank_1 true';
        const companyId = '123';
        const role = 'MERCHANT';
        const name = 'test_user';
      
        // Mock getBankaccountCheckDao to pass bank account validation
        getBankaccountCheckDao.mockResolvedValue({
          id: 'bank_1',
          company_id: '123',
          bank_used_for: 'PayIn',
        });
      
        // Mock getCheckBankResponseDao to simulate no existing UTR
        getCheckBankResponseDao.mockResolvedValue(null);
      
        // Mock getForCreateBankResponseDao to simulate no used UTRs
        getForCreateBankResponseDao.mockResolvedValue([]);
      
        // Mock getBankResponseDao to simulate no existing bank response
        getBankResponseDao.mockResolvedValue(null);
      
        // Mock createBankResponseDao
        createBankResponseDao.mockResolvedValue({
          id: '1',
          status: '/success',
          amount: 1000,
          utr: 'utr123',
          bank_id: 'bank_1',
          is_used: 'false',
        });
      
        // Mock getBankaccountDao for bank details
        getBankaccountDao.mockResolvedValue([
          {
            balance: 5000,
            today_balance: 2000,
            payin_count: 1,
            user_id: 'user_1',
            config: {},
          },
        ]);
      
        // Mock getVendorsDao for vendor data
        getVendorsDao.mockResolvedValue([
          { id: 'vendor_1', balance: 10000, payin_commission: 0.01, user_id: 'vendor_1', code: 'VEND123' },
        ]);
      
        // Mock getVendorsBankReponseDao for vendor data
        getVendorsBankReponseDao.mockResolvedValue([
          { id: 'vendor_1', balance: 10000, payin_commission: 0.01, user_id: 'vendor_1', code: 'VEND123' },
        ]);
      
        // Mock getPayInsBankResDao to return a matching pay-in
        getPayInsBankResDao.mockResolvedValue([
          {
            id: 'payin_1',
            amount: 1000,
            user_submitted_utr: 'utr123',
            bank_acc_id: 'bank_1',
            merchant_id: 'merchant_1',
            config: { urls: { notify: 'url' } },
            created_at: new Date('2025-08-18'),
          },
        ]);
      
        // Mock getMerchantsBankResponseDao for merchant data
        getMerchantsBankResponseDao.mockResolvedValue([
          { id: 'merchant_1', balance: 5000, payin_commission: 0.02, user_id: 'merchant_1', code: 'MERCH123' },
        ]);
      
        // Mock getMerchantsDao for merchant data
        getMerchantsDao.mockResolvedValue([
          { id: 'merchant_1', balance: 5000, payin_commission: 0.02, user_id: 'merchant_1', code: 'MERCH123' },
        ]);
      
        // Mock getCalculationforCronDao for calculation data
        getCalculationforCronDao.mockResolvedValue([
          { id: 'calc_1', created_at: new Date('2025-08-18') },
        ]);
      
        // Mock updatePayInUrlDao
        updatePayInUrlDao.mockResolvedValue({
          id: 'payin_1',
          status: 'SUCCESS',
          merchant_order_id: 'order_1',
          amount: 1000,
          config: { urls: { notify: 'url' } },
        });
      
        // Mock other dependencies
        updateBotResponseDao.mockResolvedValue({});
        newTableEntry.mockResolvedValue();
        merchantPayinCallback.mockResolvedValue();
        updateCalculationBalanceDao.mockResolvedValue({});
        updateBankaccountDao.mockResolvedValue({ today_balance: 3000 });
      
        // Mock Date for approved_at
        const mockDate = new Date('2025-08-19T09:22:00.000Z');
        jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
      
        // Mock getBankaccountDashBoardReportDao to ensure bank is not frozen
        getBankaccountDashBoardReportDao.mockResolvedValue([
          {
            id: 'bank_1',
            balance: 5000,
            today_balance: 2000,
            payin_count: 1,
            user_id: 'user_1',
            config: { is_freeze: false },
            nick_name: 'Bank A',
            freezed: 'false',
          },
        ]);
      
        const result = await createBankResponseService(payload, companyId, role, name);
      
        expect(createBankResponseDao).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            utr: 'utr123',
            bank_id: 'bank_1',
          }),
        );
        expect(updatePayInUrlDao).toHaveBeenCalledWith(
          'payin_1',
          expect.objectContaining({
            status: 'SUCCESS',
            is_notified: true,
            user_submitted_utr: 'utr123',
            bank_response_id: '1',
            duration: '00:05:00',
            payin_merchant_commission: 0.2,
            payin_vendor_commission: 0.1,
            approved_at: mockDate,
          }),
          expect.any(Object),
          expect.objectContaining({
            utr: 'utr123',
            amount: 1000
          })
        );
        expect(merchantPayinCallback).toHaveBeenCalled();
        expect(result).toEqual({
          message: 'UTR utr123 matches the User Submitted UTR: utr123 and the payment was successful.',
        });
      
        jest.spyOn(global, 'Date').mockRestore();
      });

      it('should handle bank mismatch scenario', async () => {
        const payload = '1000.00 nil utr123 bank_2 true';
        const companyId = '123';
        const role = 'MERCHANT';
        const name = 'test_user';

        getBankaccountCheckDao.mockResolvedValue({
          id: 'bank_2',
          company_id: '123',
          bank_used_for: 'PayIn',
        });

        getCheckBankResponseDao.mockResolvedValue(null);
        getForCreateBankResponseDao.mockResolvedValue({ rows: [] });
        createBankResponseDao.mockResolvedValue({
          id: '1',
          status: '/success',
          amount: 1000,
          utr: 'utr123',
          bank_id: 'bank_2',
          is_used: 'false',
        });

        getPayInsBankResDao.mockResolvedValue([
          {
            id: 'payin_1',
            amount: 1000,
            user_submitted_utr: 'utr123',
            bank_acc_id: 'bank_1', // Different bank
            merchant_id: 'merchant_1',
            config: { urls: { notify: 'url' } },
            status: 'PENDING',
            created_at: new Date('2025-08-18'),
          },
        ]);

        getMerchantsBankResponseDao.mockResolvedValue([
          { id: 'merchant_1', balance: 5000, payin_commission: 0.02, user_id: 'merchant_1', code: 'MERCH123' },
        ]);

        updatePayInUrlDao.mockResolvedValue({
          id: 'payin_1',
          status: Status.BANK_MISMATCH,
          merchant_order_id: 'order_1',
          amount: 1000,
          config: { urls: { notify: 'url' } },
        });

        updateBotResponseDao.mockResolvedValue({});
        newTableEntry.mockResolvedValue();
        merchantPayinCallback.mockResolvedValue();

        getBankaccountDashBoardReportDao.mockResolvedValue([
          {
            id: 'bank_2',
            balance: 5000,
            today_balance: 2000,
            payin_count: 1,
            user_id: 'user_1',
            config: { is_freeze: false },
            nick_name: 'Bank B',
            freezed: 'false',
          },
        ]);

        const result = await createBankResponseService(payload, companyId, role, name);

        expect(updatePayInUrlDao).toHaveBeenCalledWith(
          'payin_1',
          expect.objectContaining({
            status: Status.BANK_MISMATCH,
            is_notified: true,
            user_submitted_utr: 'utr123',
            bank_response_id: '1',
            duration: '00:05:00',
          }),
          expect.any(Object),
          expect.objectContaining({ utr: 'utr123', amount: 1000 })
        );
        expect(result).toEqual({
          message: 'Bank Mismatch with order_1',
        });
      });

      it('should handle frozen bank account for non-admin', async () => {
        const payload = '1000.00 nil utr123 bank_1 true';
        const companyId = '123';
        const role = 'MERCHANT'; // Non-admin
        const name = 'test_user';

        getBankaccountCheckDao.mockResolvedValue({
          id: 'bank_1',
          company_id: '123',
          bank_used_for: 'PayIn',
        });

        getCheckBankResponseDao.mockResolvedValue(null);
        getForCreateBankResponseDao.mockResolvedValue({ rows: [] });
        createBankResponseDao.mockResolvedValue({
          id: '1',
          status: '/success',
          amount: 1000,
          utr: 'utr123',
          bank_id: 'bank_1',
          is_used: 'false',
        });

        getPayInsBankResDao.mockResolvedValue([
          {
            id: 'payin_1',
            amount: 1000,
            user_submitted_utr: 'utr123',
            bank_acc_id: 'bank_1',
            merchant_id: 'merchant_1',
            config: { urls: { notify: 'url' } },
            status: 'PENDING',
            created_at: new Date('2025-08-18'),
          },
        ]);

        getBankaccountDashBoardReportDao.mockResolvedValue([
          {
            id: 'bank_1',
            balance: 5000,
            today_balance: 2000,
            payin_count: 1,
            user_id: 'user_1',
            config: { is_freeze: true },
            nick_name: 'Bank A',
            freezed: 'true',
          },
        ]);

        const result = await createBankResponseService(payload, companyId, role, name);

        expect(result).toEqual({
          message: 'Entry Created Successfully. But as Bank Account is freezed entry is not paired. Please contact admin',
        });
      });

      it('should handle amount code mismatch', async () => {
        const payload = '1000.00 amt12 utr123 bank_1 true';
        const companyId = '123';
        const role = 'MERCHANT';
        const name = 'test_user';

        getBankaccountCheckDao.mockResolvedValue({
          id: 'bank_1',
          company_id: '123',
          bank_used_for: 'PayIn',
        });

        getCheckBankResponseDao.mockResolvedValue(null);
        getForCreateBankResponseDao.mockResolvedValue({ rows: [] });
        createBankResponseDao.mockResolvedValue({
          id: '1',
          status: '/success',
          amount: 1000,
          utr: 'utr123',
          bank_id: 'bank_1',
          upi_short_code: 'amt12',
          is_used: 'false',
        });

        getPayInsBankResDao.mockResolvedValue([
          {
            id: 'payin_1',
            amount: 1000,
            user_submitted_utr: 'utr123',
            bank_acc_id: 'bank_1',
            upi_short_code: 'amt99', // Mismatch
            merchant_id: 'merchant_1',
            config: { urls: { notify: 'url' } },
            status: 'PENDING',
            created_at: new Date('2025-08-18'),
          },
        ]);

        const result = await createBankResponseService(payload, companyId, role, name);

        expect(result).toEqual({
          message: '⛔ Amount Code: amt12 does not match with User Submitted Amount Code: amt99',
        });
      });

      it('should handle existing used UTR', async () => {
        const payload = '1000.00 nil utr123 bank_1 true';
        const companyId = '123';
        const role = 'MERCHANT';
        const name = 'test_user';

        getBankaccountCheckDao.mockResolvedValue({
          id: 'bank_1',
          company_id: '123',
          bank_used_for: 'PayIn',
        });

        getCheckBankResponseDao.mockResolvedValue(null);
        getForCreateBankResponseDao.mockResolvedValue([{ length: 1 }]); // Existing used UTR
        createBankResponseDao.mockResolvedValue({
          id: '1',
          status: '/success',
          amount: 1000,
          utr: 'utr123',
          bank_id: 'bank_1',
          is_used: 'false',
        });

        getPayInsBankResDao.mockResolvedValue([
          {
            id: 'payin_1',
            amount: 1000,
            user_submitted_utr: 'utr123',
            bank_acc_id: 'bank_1',
            merchant_id: 'merchant_1',
            config: { urls: { notify: 'url' } },
            status: 'PENDING',
            created_at: new Date('2025-08-18'),
          },
        ]);

        const result = await createBankResponseService(payload, companyId, role, name);

        expect(result).toEqual({ message: 'The UTR already exists' });
      });

      it('should rollback transaction on error', async () => {
        const payload = '1000.00 nil utr123 bank_1 true';
        const companyId = '123';
        const role = 'MERCHANT';
        const name = 'test_user';

        getBankaccountCheckDao.mockResolvedValue({
          id: 'bank_1',
          company_id: '123',
          bank_used_for: 'PayIn',
        });

        getCheckBankResponseDao.mockResolvedValue(null);
        createBankResponseDao.mockRejectedValue(new Error('DAO error'));

        await expect(createBankResponseService(payload, companyId, role, name)).rejects.toThrow('DAO error');
        expect(rollback).toHaveBeenCalled();
      });
    });

    describe('createBankResponseWebHookService', () => {
      beforeEach(() => {
        mockConnection = {
          query: jest.fn(),
          release: jest.fn(),
        };
        getConnection.mockResolvedValue(mockConnection);
        beginTransaction.mockResolvedValue();
        commit.mockResolvedValue();
        rollback.mockResolvedValue();
        calculateCommission.mockImplementation((amount, rate) => amount * rate);
        filterResponse.mockImplementation((data) => data);
      });

      it('should create a bank response via webhook with valid payload and no conflicts', async () => {
        const payload = '1000.00 nil utr123 bank_1 true';
        const companyId = '123';
        const role = 'MERCHANT';
        const name = 'test_user';

        getBankaccountCheckDao.mockResolvedValue({
          id: 'bank_1',
          company_id: '123',
          bank_used_for: 'PayIn',
        });

        getCheckBankResponseDao.mockResolvedValue(null);
        createBankResponseDao.mockResolvedValue({
          id: '1',
          status: '/success',
          amount: 1000,
          utr: 'utr123',
          bank_id: 'bank_1',
          is_used: 'true',
        });

        getBankaccountDashBoardReportDao.mockResolvedValue([
          {
            id: 'bank_1',
            balance: 5000,
            today_balance: 2000,
            payin_count: 1,
            user_id: 'user_1',
            config: {},
            nick_name: 'Bank A',
          },
        ]);

        getVendorsBankReponseDao.mockResolvedValue([{ id: 'vendor_1', balance: 10000, payin_commission: 0.01, user_id: 'vendor_1', code: 'VEND123' }]);
        updateBankaccountDao.mockResolvedValue({ today_balance: 3000 });
        updateVendorDao.mockResolvedValue({});
        getCalculationforCronDao.mockResolvedValue([{ id: 'calc_1' }]);
        updateCalculationBalanceDao.mockResolvedValue({});

        const result = await createBankResponseWebHookService(payload, companyId, role, name);

        expect(createBankResponseDao).toHaveBeenCalledWith(mockConnection, expect.objectContaining({
          status: '/success',
          is_used: 'true',
        }));
        expect(result).toEqual({ message: 'Entry created successfully', data: expect.any(Object) });
      });

      it('should handle repeated UTR in webhook', async () => {
        const payload = '1000.00 nil utr123 bank_1 true';
        const companyId = '123';
        const role = 'MERCHANT';
        const name = 'test_user';

        getBankaccountCheckDao.mockResolvedValue({
          id: 'bank_1',
          company_id: '123',
          bank_used_for: 'PayIn',
        });

        getCheckBankResponseDao.mockResolvedValue({ id: 'existing' });
        createBankResponseDao.mockResolvedValue({ id: '1', status: '/repeated' });

        const result = await createBankResponseWebHookService(payload, companyId, role, name);

        expect(result).toEqual({ message: 'Entry with REPEATED UTR: utr123 Added' });
      });

      it('should throw error for invalid amount in webhook', async () => {
        await expect(
          createBankResponseWebHookService('510000 nil utr123 bank_1 true', '123', 'MERCHANT', 'test_user')
        ).rejects.toThrow('amount must be between 1 and 500000');
      });

      it('should rollback on error in webhook', async () => {
        const payload = '1000.00 nil utr123 bank_1 true';
        const companyId = '123';
        const role = 'MERCHANT';
        const name = 'test_user';

        getBankaccountCheckDao.mockResolvedValue({
          id: 'bank_1',
          company_id: '123',
          bank_used_for: 'PayIn',
        });

        createBankResponseDao.mockRejectedValue(new Error('DAO error'));

        await expect(createBankResponseWebHookService(payload, companyId, role, name)).rejects.toThrow('DAO error');
        expect(rollback).toHaveBeenCalled();
      });
    });


    describe('getClaimResponseService', () => {
      it('should retrieve claim responses successfully', async () => {
        const payload = { company_id: '123', date: '2025-08-18' };
        const mockData = [{ id: 'claim_1' }];
        getClaimResponseDao.mockResolvedValue(mockData);
  
        const result = await getClaimResponseService(payload);
  
        expect(getClaimResponseDao).toHaveBeenCalledWith({ date: '2025-08-18', company_id: '123' });
        expect(result).toEqual(mockData);
      });
  
      it('should throw error on DAO failure', async () => {
        getClaimResponseDao.mockRejectedValue(new Error('DAO error'));
        await expect(getClaimResponseService({ company_id: '123' })).rejects.toThrow('DAO error');
      });
    });
  
    describe('getBankResponseService', () => {
      it('should retrieve bank responses with Merchant role and no filters', async () => {
        const payload = { company_id: '123' };
        const role = 'MERCHANT';
        const page = '1';
        const limit = '10';
        const mockData = { rows: [], count: 0 };
        getBankResponseDaoAll.mockResolvedValue(mockData);
  
        const result = await getBankResponseService(payload, role, page, limit);
  
        expect(getBankResponseDaoAll).toHaveBeenCalledWith(
          { company_id: '123' },
          '1',
          '10',
          merchantColumns.BANK_RESPONSE,
          undefined,
          'sno',
          'DESC',
          undefined,
          undefined,
        );
        expect(result).toEqual(mockData);
      });

      it('should handle SUB_VENDOR role', async () => {
        const payload = { company_id: '123' };
        const role = Role.SUB_VENDOR;
        const page = '1';
        const limit = '10';
        const designation = Role.SUB_VENDOR;
        const user_id = 'sub_vendor_user_1';
        const mockData = { rows: [], count: 0 };
        getBankResponseDaoAll.mockResolvedValue(mockData);

        const mockBanks = [{ id: 'bank1' }];
        getBankaccountDao.mockResolvedValue(mockBanks);

        await getBankResponseService(payload, role, page, limit, undefined, undefined, undefined, undefined, designation, user_id);

        expect(getBankaccountDao).toHaveBeenCalledWith({
          user_id: 'sub_vendor_user_1',
          bank_used_for: 'PayIn',
        });
        expect(getBankResponseDaoAll).toHaveBeenCalledWith(
          { company_id: '123', bank_id: ['bank1'] },
          '1',
          '10',
          vendorColumns.BANK_RESPONSE,
          undefined,
          'sno',
          'DESC',
          undefined,
          undefined,
        );
      });
  
      it('should retrieve bank responses with Vendor role and specific filters', async () => {
        const payload = { company_id: '123', sno: '1', amount: '1000', status: 'SUCCESS' };
        const role = 'VENDOR';
        const page = '2';
        const limit = '20';
        const mockData = { rows: [{ id: '1' }], count: 1 };
        getBankResponseDaoAll.mockResolvedValue(mockData);
  
        const result = await getBankResponseService(payload, role, page, limit);
  
        expect(getBankResponseDaoAll).toHaveBeenCalledWith(
          { sno: 1, amount: 1000, status: 'SUCCESS', company_id: '123' },
          '2',
          '20',
          vendorColumns.BANK_RESPONSE,
          undefined,
          'sno',
          'DESC',
          undefined,
          undefined,
        );
        expect(result).toEqual(mockData);
      });
  
      it('should retrieve bank responses with Admin role and full filters', async () => {
        const payload = {
          company_id: '123',
          sno: '1',
          amount: '1000',
          status: 'SUCCESS',
          utr: 'utr123',
          bank_id: 'bank_1',
          is_used: 'true',
          userId: 'user_1',
        };
        const role = 'ADMIN';
        const page = '1';
        const limit = '10';
        const mockData = { rows: [{ id: '1' }], count: 1 };
        getBankResponseDaoAll.mockResolvedValue(mockData);
  
        const result = await getBankResponseService(payload, role, page, limit);
  
        expect(getBankResponseDaoAll).toHaveBeenCalledWith(
          {
            sno: 1,
            amount: 1000,
            status: 'SUCCESS',
            utr: 'utr123',
            bank_id: 'bank_1',
            is_used: 'true',
            company_id: '123',
            userId: 'user_1',
          },
          '1',
          '10',
          columns.BANK_RESPONSE,
          undefined,
          'sno',
          'DESC',
          undefined,
          undefined,
        );
        expect(result).toEqual(mockData);
      });
  
      it('should retrieve bank responses with search parameter', async () => {
        const payload = { company_id: '123' };
        const role = 'MERCHANT';
        const page = '1';
        const limit = '10';
        const search = 'test_search';
        const mockData = { rows: [], count: 0 };
        getBankResponseDaoAll.mockResolvedValue(mockData);
  
        const result = await getBankResponseService(payload, role, page, limit, search);
  
        expect(getBankResponseDaoAll).toHaveBeenCalledWith(
          { company_id: '123', search: 'test_search' },
          '1',
          '10',
          merchantColumns.BANK_RESPONSE,
          undefined,
          'sno',
          'DESC',
          undefined,
          undefined,
        );
        expect(result).toEqual(mockData);
      });
  
      it('should retrieve bank responses with date range', async () => {
        const payload = { company_id: '123', startDate: '2025-08-01', endDate: '2025-08-18' };
        const role = 'MERCHANT';
        const page = '1';
        const limit = '10';
        const mockData = { rows: [], count: 0 };
        getBankResponseDaoAll.mockResolvedValue(mockData);
  
        const result = await getBankResponseService(payload, role, page, limit);
  
        expect(getBankResponseDaoAll).toHaveBeenCalledWith(
          { company_id: '123' },
          '1',
          '10',
          merchantColumns.BANK_RESPONSE,
          undefined,
          'sno',
          'DESC',
          '2025-08-01',
          '2025-08-18',
        );
        expect(result).toEqual(mockData);
      });
  
      it('should sort by updated_at when updated parameter is provided', async () => {
        const payload = { company_id: '123' };
        const role = 'MERCHANT';
        const page = '1';
        const limit = '10';
        const updated = '2025-08-18';
        const mockData = { rows: [], count: 0 };
        getBankResponseDaoAll.mockResolvedValue(mockData);
  
        const result = await getBankResponseService(payload, role, page, limit, undefined, updated);
  
        expect(getBankResponseDaoAll).toHaveBeenCalledWith(
          { company_id: '123' },
          '1',
          '10',
          merchantColumns.BANK_RESPONSE,
          '2025-08-18',
          'updated_at',
          'DESC',
          undefined,
          undefined,
        );
        expect(result).toEqual(mockData);
      });
  
      it('should handle invalid pagination parameters', async () => {
        const payload = { company_id: '123' };
        const role = 'MERCHANT';
        const page = 'invalid';
        const limit = '-10';
        const mockData = { rows: [], count: 0 };
        getBankResponseDaoAll.mockResolvedValue(mockData);
  
        const result = await getBankResponseService(payload, role, page, limit);
  
        expect(getBankResponseDaoAll).toHaveBeenCalledWith(
          { company_id: '123' },
          '1',
          '10',
          merchantColumns.BANK_RESPONSE,
          undefined,
          'sno',
          'DESC',
          undefined,
          undefined,
        );
        expect(result).toEqual(mockData);
      });
  
      it('should throw error on DAO failure', async () => {
        const payload = { company_id: '123' };
        const role = 'MERCHANT';
        getBankResponseDaoAll.mockRejectedValue(new Error('DAO error'));
  
        await expect(getBankResponseService(payload, role)).rejects.toThrow('DAO error');
      });
  
      it('should handle empty results', async () => {
        const payload = { company_id: '123' };
        const role = 'MERCHANT';
        const mockData = { rows: [], count: 0 };
        getBankResponseDaoAll.mockResolvedValue(mockData);
  
        const result = await getBankResponseService(payload, role);
  
        expect(result).toEqual(mockData);
      });
    });
  
    describe('getBankResponseBySearchService', () => {
      it('should retrieve bank responses by search successfully', async () => {
        const payload = { company_id: '123', sno: '1', upi_short_code: 'code123' };
        const role = 'MERCHANT';
        const page = '1';
        const limit = '10';
        const search = 'test';
        const updated = '2025-08-18';
        const sortBy = 'sno';
        const sortOrder = 'ASC';
        const mockData = { rows: [], count: 0 };
        getBankResponseBySearchDao.mockResolvedValue(mockData);
  
        const result = await getBankResponseBySearchService(payload, role, page, limit, search, updated, sortBy, sortOrder);
  
        expect(getBankResponseBySearchDao).toHaveBeenCalledWith(
          { sno: 1, company_id: '123', upi_short_code: 'code123' },
          '1',
          '10',
          [
            'id',
            'sno',
            'status',
            'bank_id',
            'amount',
            'upi_short_code',
            'utr',
            'is_used',
            'config',
          ],
          'test',
          '2025-08-18',
          'sno',
          undefined,
          undefined,
          'MERCHANT',
        );
        expect(result).toEqual(mockData);
      });
  
      it('should throw error on DAO failure', async () => {
        getBankResponseBySearchDao.mockRejectedValue(new Error('DAO error'));
        await expect(getBankResponseBySearchService({ company_id: '123' }, 'MERCHANT')).rejects.toThrow('DAO error');
      });
    });
  
    describe('updateBankResponseService', () => {
      it('should update bank response successfully', async () => {
        const id = { id: '1', company_id: '123' };
        const payload = { amount: 2000 };
        const role = 'MERCHANT';
        updateBankResponseDao.mockResolvedValue({ id: '1', amount: 2000 });
  
        const result = await updateBankResponseService(id, payload, role);
  
        expect(updateBankResponseDao).toHaveBeenCalledWith(id, payload, mockConnection);
        expect(commit).toHaveBeenCalled();
        expect(result).toEqual({ id: '1', amount: 2000 });
      });
  
      it('should rollback on error', async () => {
        updateBankResponseDao.mockRejectedValue(new Error('DAO error'));
        await expect(updateBankResponseService({ id: '1', company_id: '123' }, {}, 'MERCHANT')).rejects.toThrow('DAO error');
        expect(rollback).toHaveBeenCalled();
      });
    });
  
    describe('getBankMessageServices', () => {
      it('should retrieve bank messages successfully', async () => {
        const bank_id = 'bank_1';
        const startDate = '2025-08-01';
        const endDate = '2025-08-18';
        const company_id = '123';
        const role = 'MERCHANT';
        const page = '1';
        const limit = '10';
        const mockData = { messages: [] };
        getBankMessageDao.mockResolvedValue(mockData);
  
        const result = await getBankMessageServices(bank_id, startDate, endDate, company_id, role, page, limit);
  
        expect(getBankMessageDao).toHaveBeenCalledWith(
          bank_id,
          startDate,
          endDate,
          company_id,
          1,
          10,
          null,
          null,
          [
            'id',
            'sno',
            'status',
            'bank_id',
            'amount',
            'upi_short_code',
            'utr',
            'is_used',
            'config',
          ],
        );
        expect(result).toEqual(mockData);
      });
  
      it('should throw error on DAO failure', async () => {
        getBankMessageDao.mockRejectedValue(new Error('DAO error'));
        await expect(getBankMessageServices('bank_1', '2025-08-01', '2025-08-18', '123', 'MERCHANT', '1', '10')).rejects.toThrow('DAO error');
      });
    });
  
    describe('resetBankResponseService', () => {
      it('should reset bank response successfully with no updates', async () => {
        const id = '1';
        const userData = {
          company_id: '123',
          user_name: 'test_user',
          user_id: 'user_1',
          role: 'MERCHANT',
          amount: undefined,
          utr: undefined,
          bank_id: undefined,
        };
        getBankResponseDao.mockResolvedValue({ id: '1', utr: 'utr123', amount: 1000, bank_id: 'bank_1', config: {} });
        getPayInsForResetBankResDao.mockResolvedValue([
          { id: 'payin_1', status: 'PENDING', merchant_order_id: 'order_1' }
        ]); // Mock pay-in data
        resetBankResponseDao.mockResolvedValue({});
        newTableEntry.mockResolvedValue();
  
        const result = await resetBankResponseService(mockConnection, id, userData);
  
        expect(resetBankResponseDao).toHaveBeenCalledWith(id, { is_used: false, updated_by: 'test_user', config: {} }, mockConnection);
        expect(result.message).toEqual('Bot response reset successful');
      });

      it('should throw BadRequestError if UTR already confirmed', async () => {
        const id = '1';
        const userData = {
          company_id: '123',
          user_name: 'test_user',
          user_id: 'user_1',
          role: 'MERCHANT',
          amount: undefined,
          utr: undefined,
          bank_id: undefined,
        };
        getBankResponseDao.mockResolvedValue({ id: '1', utr: 'utr123', amount: 1000, bank_id: 'bank_1', config: {} });
        getPayInsForResetBankResDao
          .mockResolvedValueOnce([{ status: Status.SUCCESS, merchant_order_id: 'order_1' }]) // Has success
          .mockResolvedValueOnce([{ status: Status.SUCCESS, merchant_order_id: 'order_1' }]);

        await expect(resetBankResponseService(mockConnection, id, userData)).rejects.toThrow(
          'UTR is already confirmed with Merchant Order ID order_1. No changes applied. Previous Amount: 1000'
        );
      });
  
    });
  
    describe('importBankResponseService', () => {
      beforeEach(() => {
        jest.setTimeout(10000);
      });

      it('should throw BadRequestError if no PDF buffer', async () => {
        const payload = { bank_id: 'bank_1', fileType: 'PDF' };
        const companyId = '123';
        const role = 'MERCHANT';
        const name = 'test_user';
        const conn = mockConnection;

        await expect(importBankResponseService(conn, payload, companyId, role, name)).rejects.toThrow('No valid PDF buffer provided in payload');
      });
    });
  
    describe('updateCalculationBalances', () => {
      it('should update calculation balances successfully', async () => {
        const currentCalculation = [{ id: 'calc_1', created_at: new Date('2025-08-18'), user_id: 'user_1' }];
        const nextCalculations = [{ id: 'calc_2', created_at: new Date('2025-08-19'), user_id: 'user_2' }]; 
        const amountDiff = 1000;
        const commission = 10;
        updateCalculationBalanceDao.mockResolvedValue({});

        await updateCalculationBalances(currentCalculation, nextCalculations, amountDiff, commission, mockConnection, 1);

        expect(updateCalculationBalanceDao).toHaveBeenCalledTimes(2);
        expect(updateCalculationBalanceDao).toHaveBeenCalledWith(
          { id: 'calc_1' },
          {
            total_payin_count: 1,
            total_payin_commission: 10,
            total_payin_amount: 1000,
            current_balance: 990,
            net_balance: 990,
          },
          mockConnection,
        );
        expect(updateCalculationBalanceDao).toHaveBeenCalledWith(
          { id: 'calc_2' },
          {
            net_balance: 990,
            total_adjustment_amount: 1000,
            total_adjustment_commission: 10,
            total_adjustment_count: 1,
          },
          mockConnection,
        );
      });
  
      it('should skip if no current calculation', async () => {
        await updateCalculationBalances(null, [], 1000, 10, mockConnection, 1);
        expect(updateCalculationBalanceDao).not.toHaveBeenCalled();
      });

      it('should handle no next calculations', async () => {
        const currentCalculation = [{ id: 'calc_1', created_at: new Date('2025-08-18'), user_id: 'user_1' }];
        const nextCalculations = [];
        const amountDiff = 1000;
        const commission = 10;
        updateCalculationBalanceDao.mockResolvedValue({});

        await updateCalculationBalances(currentCalculation, nextCalculations, amountDiff, commission, mockConnection, 1);

        expect(updateCalculationBalanceDao).toHaveBeenCalledTimes(1);
      });

      it('should throw error on updateCalculationBalanceDao failure', async () => {
        const currentCalculation = [{ id: 'calc_1', created_at: new Date('2025-08-18'), user_id: 'user_1' }];
        const nextCalculations = [];
        const amountDiff = 1000;
        const commission = 10;
        updateCalculationBalanceDao.mockRejectedValue(new Error('Update error'));

        await expect(updateCalculationBalances(currentCalculation, nextCalculations, amountDiff, commission, mockConnection, 1)).rejects.toThrow('Update error');
      });
    });
  });
