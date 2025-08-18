/* eslint-disable no-useless-escape */
const {
    getBankResponseService,
    getClaimResponseService,
    createBankResponseService,
    updateBankResponseService,
    getBankMessageServices,
    getBankResponseBySearchService,
    resetBankResponseService,
    importBankResponseService,
    updateCalculationBalances,
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
} = require('./bankResponseDao');
const { getBankaccountDao, updateBankaccountDao } = require('../bankAccounts/bankaccountDao');
const { getPayInUrlsDao, updatePayInUrlDao } = require('../payIn/payInDao');
const { getMerchantsDao } = require('../merchants/merchantDao');
const { getVendorsDao, updateVendorDao } = require('../vendors/vendorDao');
const {
    getAllCalculationforCronDao,
    updateCalculationBalanceDao,
} = require('../calculation/calculationDao');
const { merchantPayinCallback } = require('../../callBacksAndWebHook/merchantCallBacks');
const { calculateCommission, filterResponse, calculateDuration } = require('../../helpers/index');
const { newTableEntry } = require('../../utils/sockets');
const { logger } = require('../../utils/logger');
const { beginTransaction, commit, getConnection, rollback } = require('../../utils/db');
const { columns, merchantColumns} = require('../../constants/index');
const PDFParser = require('pdf2json');

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
    actualDayjs.tz = jest.fn().mockReturnValue({
        format: jest.fn().mockReturnValue('2025-08-18'),
    });
    return actualDayjs;
});
jest.mock('../../utils/appErrors', () => ({
    BadRequestError: class BadRequestError extends Error {
      constructor(message) {
        super(message);
        this.name = "BadRequestError";
      }
    },
    NotFoundError: class NotFoundError extends Error{
        constructor(message) {
            super(message);
            this.name = "NotFoundError";
          }
    }
  }));
  

describe('Bank Response Services', () => {
    let mockConnection;

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
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createBankResponseService', () => {
        it('should create a bank response with valid payload and no UTR or amount code conflict', async () => {
            const payload = '1000.00 nil utr123 bank_1 true';
            const companyId = '123';
            const role = 'MERCHANT';
            const name = 'test_user';
            
            getBankResponseDao.mockResolvedValue(null);
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
            getVendorsDao.mockResolvedValue([{ id: 'vendor_1', balance: 10000, payin_commission: 0.01 }]);
            updateBankaccountDao.mockResolvedValue({ today_balance: 3000 });
            updateVendorDao.mockResolvedValue({});
            getPayInUrlsDao.mockResolvedValue([]);
            newTableEntry.mockResolvedValue();
            updateCalculationBalanceDao.mockResolvedValue({});
        
            const result = await createBankResponseService(payload, companyId, role, name);
        
            expect(getBankResponseDao).toHaveBeenCalledWith(
                { utr: 'utr123', company_id: '123' },
                null,
                null,
                null,
                null,
                [
                  "id",
                  "sno",
                  "status",
                  "bank_id",
                  "amount",
                  "upi_short_code",
                  "utr",
                  "is_used",
                  "config"
                ]
              );
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

        it('should handle repeated UTR', async () => {
            const payload = '1000.00 nil utr123 bank_1 true';
            getBankResponseDao.mockResolvedValue({ id: 'existing' });
            createBankResponseDao.mockResolvedValue({ id: '1', status: '/repeated', utr: 'utr123' });

            const result = await createBankResponseService(payload, '123', 'MERCHANT', 'test_user');

            expect(createBankResponseDao).toHaveBeenCalled();
            expect(result).toEqual({ message: 'Entry with REPEATED UTR Added utr123' });
        });

        it('should handle repeated Amount Code', async () => {
            const payload = '1000.00 amt12 utr123 bank_1 true';
            getBankResponseDao.mockResolvedValue({ id: 'existing' });
            createBankResponseDao.mockResolvedValue({ id: '1', status: '/repeated', upi_short_code: 'amt12' });

            const result = await createBankResponseService(payload, '123', 'MERCHANT', 'test_user');

            expect(createBankResponseDao).toHaveBeenCalled();
            expect(result).toEqual({ message: 'Entry with REPEATED AMOUNT CODE Added amt12' });
        })

        it('should throw error for invalid amount', async () => {
            await expect(
              createBankResponseService('510000 nil utr12387 bank_1 true', '123', 'MERCHANT', 'test_user')
            ).rejects.toThrow('amount must be between 1 and 500000');
          });
          
        it('should throw error for invalid UTR format', async () => {
            const payload = '1000.00 nil utr@123 bank_1 true';
            const result = await createBankResponseService(payload, '123', 'MERCHANT', 'test_user');
            expect(result).toEqual({ message: 'UTRs can only contain alphanumeric characters.' });
        });

        it('should handle successful pay-in with matching UTR', async () => {
            const payload = '1000.00 nil utr123 bank_1 true';

            getBankResponseDao.mockResolvedValue(null);
            createBankResponseDao.mockResolvedValue({
                id: '1',
                status: '/success',
                amount: 1000,
                utr: 'utr123',
                bank_id: 'bank_1',
                is_used: 'false',
            });
            getBankaccountDao.mockResolvedValue([
                {
                    balance: 5000,
                    today_balance: 2000,
                    payin_count: 1,
                    user_id: 'user_1',
                    config: {},
                },
            ]);
            getVendorsDao.mockResolvedValue([
                { id: 'vendor_1', balance: 10000, payin_commission: 0.01 },
            ]);
            getPayInUrlsDao.mockResolvedValue([
                {
                    id: 'payin_1',
                    amount: 1000,
                    user_submitted_utr: 'utr123',
                    bank_acc_id: 'bank_1',
                    merchant_id: 'merchant_1',
                    config: { urls: { notify: 'url' } },
                },
            ]);
            getMerchantsDao.mockResolvedValue([
                { balance: 5000, payin_commission: 0.02 },
            ]);
            updatePayInUrlDao.mockResolvedValue({
                id: 'payin_1',
                status: 'SUCCESS',
                merchant_order_id: 'order_1',
                amount: 1000,
                config: { urls: { notify: 'url' } },
            });
            updateBotResponseDao.mockResolvedValue({});
            newTableEntry.mockResolvedValue();
            merchantPayinCallback.mockResolvedValue();
            updateCalculationBalanceDao.mockResolvedValue({});

            const result = await createBankResponseService(payload, '123', 'MERCHANT', 'test_user');

            expect(createBankResponseDao).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                  utr: 'utr123',
                  bank_id: 'bank_1',
                })
              );
              
            expect(updatePayInUrlDao).toHaveBeenCalledWith(expect.objectContaining({
                id: 'payin_1',
                status: 'SUCCESS',
            }));
            expect(merchantPayinCallback).toHaveBeenCalled();
            expect(result).toEqual({
                message: 'UTR utr123 matches the User Submitted UTR: utr123 and the payment was successful.',
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
            it('should retrieve bank responses successfully', async () => {
                const payload = { company_id: '123', sno: '1', amount: '1000' };
                const role = 'MERCHANT';
                const page = '1';
                const limit = '10';
                const search = 'test';
                const updated = '2025-08-18';
                const sortBy = 'sno';
                const sortOrder = 'ASC';
                const mockData = { rows: [], count: 0 };
                getBankResponseDaoAll.mockResolvedValue(mockData);

                const result = await getBankResponseService(payload, role, page, limit, search, updated, sortBy, sortOrder);

                expect(getBankResponseDaoAll).toHaveBeenCalledWith(
                    { sno: 1, amount: 1000, company_id: '123', search: 'test' },
                    '1',
                    '10',
                    merchantColumns.BANK_RESPONSE, 
                    '2025-08-18',
                    'sno',
                    'ASC',
                    undefined,
                    undefined,
                );
                expect(result).toEqual(mockData);
            });

            it('should throw error on DAO failure', async () => {
                getBankResponseDaoAll.mockRejectedValue(new Error('DAO error'));
                await expect(getBankResponseService({ company_id: '123' }, 'MERCHANT')).rejects.toThrow('DAO error');
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
                    { sno: 1, company_id: '123', upi_short_code: 'code123', search: 'test' },
                    '1',
                    '10',
                    columns.BANK_RESPONSE,
                    '2025-08-18',
                    'sno',
                    'ASC',
                    undefined,
                    undefined,
                );
                expect(result).toEqual(mockData);
            });

            it('should throw error on DAO failure', async () => {
                getBankResponseBySearchDao.mockRejectedValue(new Error('DAO error'));
                await expect(getBankResponseBySearchService({ company_id: '123' }, "MERCHANT")).rejects.toThrow('DAO error');
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
            
                const result = await getBankMessageServices(
                    bank_id,
                    startDate,
                    endDate,
                    company_id,
                    role,
                    page,
                    limit
                );
            
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
                        "id",
                        "sno",
                        "status",
                        "bank_id",
                        "amount",
                        "upi_short_code",
                        "utr",
                        "is_used",
                        "config"
                    ]
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
                getPayInUrlsDao.mockResolvedValue([]);
                resetBankResponseDao.mockResolvedValue({});
                newTableEntry.mockResolvedValue();

                const result = await resetBankResponseService(mockConnection, id, userData);

                expect(resetBankResponseDao).toHaveBeenCalledWith(id, { is_used: false, updated_by: 'test_user', config: {} });
                expect(result.message).toEqual('Bot response reset successful');
            });

            it('should handle amount update', async () => {
                const id = '1';
                const userData = { company_id: '123', user_name: 'test_user', user_id: 'user_1', role: 'MERCHANT', amount: 2000 };
                getBankResponseDao.mockResolvedValue({
                    id: '1',
                    utr: 'utr123',
                    amount: 1000,
                    bank_id: 'bank_1',
                    config: {},
                    updated_by: 'old_user',
                });
                getBankaccountDao.mockResolvedValue([
                    { id: 'bank_1', balance: 5000, today_balance: 2000, user_id: 'vendor_1', is_enabled: true },
                ]);
                getVendorsDao.mockResolvedValue([{ user_id: 'vendor_1', payin_commission: 0.01 }]);
                getAllCalculationforCronDao.mockResolvedValue([{ id: 'calc_1', created_at: new Date('2025-08-18') }]);
                updateBankaccountDao.mockResolvedValue({ today_balance: 3000, company_id: '123', is_enabled: true });
                updateBotResponseDao.mockResolvedValue({});
                updateCalculationBalanceDao.mockResolvedValue({});
                newTableEntry.mockResolvedValue();

                const result = await resetBankResponseService(mockConnection, id, userData);

                expect(updateBankaccountDao).toHaveBeenCalled();
                expect(result.message).toEqual('Bot response reset successful. Previous Amount: 1000');
            });

            it('should throw error for existing UTR', async () => {
                const id = '1';
                const userData = { company_id: '123', user_name: 'test_user', user_id: 'user_1', role: 'MERCHANT', utr: 'utr123' };
                getBankResponseDao
                    .mockResolvedValueOnce({ id: '1', utr: 'old_utr', amount: 1000, bank_id: 'bank_1', config: {} })
                    .mockResolvedValueOnce({ id: 'existing', utr: 'utr123' });

                await expect(resetBankResponseService(mockConnection, id, userData)).rejects.toThrow(
                    'This UTR has already been used. Please provide a new one.',
                );
            });
        });

        describe('importBankResponseService', () => {
            it('should import bank responses from PDF successfully', async () => {
                const payload = { pdfBuffer: Buffer.from('pdf content'), bank_id: 'bank_1', fileType: 'PDF' };
                const companyId = '123';
                const role = 'MERCHANT';
                const name = 'test_user';
                PDFParser.prototype.parseBuffer = jest.fn().mockImplementation((buffer, callback) => {
                    process.nextTick(() =>
                        callback(null, {
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
                        }),
                    );
                });
                getBankResponseDao.mockResolvedValue(null);
                createBankResponseDao.mockResolvedValue({ id: '1', status: '/success' });
                getBankaccountDao.mockResolvedValue([{ balance: 5000, today_balance: 2000, user_id: 'user_1', config: {} }]);
                getVendorsDao.mockResolvedValue([{ balance: 10000, payin_commission: 0.01 }]);
                newTableEntry.mockResolvedValue();

                const result = await importBankResponseService(mockConnection, payload, companyId, role, name);

                expect(createBankResponseService).toHaveBeenCalledWith(mockConnection, '1000.00 undefined utr123 bank_1 true', companyId, role, name);
                expect(result).toEqual({ message: 'PDF imported successfully' });
            });

            it('should throw error for invalid PDF buffer', async () => {
                const payload = { pdfBuffer: null };
                await expect(importBankResponseService(mockConnection, payload, '123', 'MERCHANT', 'test_user')).rejects.toThrow(
                    'No valid PDF buffer provided in payload',
                );

                const payload2 = { pdfBuffer: 'not a buffer' };
                await expect(importBankResponseService(mockConnection, payload2, '123', 'MERCHANT', 'test_user')).rejects.toThrow(
                    'No valid PDF buffer provided in payload',
                );
            });
        });

        describe('updateCalculationBalances', () => {
            it('should update calculation balances successfully', async () => {
                const currentCalculation = [{ id: 'calc_1', created_at: new Date('2025-08-18') }];
                const nextCalculations = [{ id: 'calc_2', created_at: new Date('2025-08-19') }];
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
            });

            it('should skip if no current calculation', async () => {
                await updateCalculationBalances([], [], 1000, 10, mockConnection, 1);
                expect(updateCalculationBalanceDao).not.toHaveBeenCalled();
            });
        });
    });
})