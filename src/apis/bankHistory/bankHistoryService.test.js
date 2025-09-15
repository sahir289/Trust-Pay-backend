const { createBankHistoryService } = require('./bankHistorySevice');
const { getBankaccountDashBoardReportDao } = require('../bankAccounts/bankaccountDao');
const { createBankHistoryDao } = require('./bankHistoryDao');
const { logger } = require('../../utils/logger');
const { BadRequestError } = require('../../utils/appErrors');

jest.mock('../bankAccounts/bankaccountDao');
jest.mock('./bankHistoryDao');
jest.mock('../../utils/logger');
jest.mock('../../utils/appErrors', () => ({
  BadRequestError: class extends Error {
    constructor(message) {
      super(message);
      this.name = 'BadRequestError';
    }
  },
}));

describe('Bank History Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create bank history records for valid bank accounts', async () => {
    const mockBanks = [
      { id: 1, today_balance: 1000, balance: 1500, payin_count: 5 },
      { id: 2, today_balance: 2000, balance: 2500, payin_count: 10 },
    ];
    const mockConn = { query: jest.fn() };
    const mockResults = [
      { bank_account_id: 1, today_balance: 1000, today_current_balance: 1500, count: 5 },
      { bank_account_id: 2, today_balance: 2000, today_current_balance: 2500, count: 10 },
    ];

    getBankaccountDashBoardReportDao.mockResolvedValue(mockBanks);
    createBankHistoryDao
      .mockResolvedValueOnce(mockResults[0])
      .mockResolvedValueOnce(mockResults[1]);

    const result = await createBankHistoryService(mockConn);

    expect(getBankaccountDashBoardReportDao).toHaveBeenCalled();
    expect(createBankHistoryDao).toHaveBeenCalledTimes(2);
    expect(createBankHistoryDao).toHaveBeenCalledWith(
      {
        bank_account_id: 1,
        today_balance: 1000,
        today_current_balance: 1500,
        count: 5,
      },
      mockConn
    );
    expect(createBankHistoryDao).toHaveBeenCalledWith(
      {
        bank_account_id: 2,
        today_balance: 2000,
        today_current_balance: 2500,
        count: 10,
      },
      mockConn
    );
    expect(result).toEqual(mockResults);
  });

  it('should throw BadRequestError if getBankaccountDashBoardReportDao does not return an array', async () => {
    const mockConn = { query: jest.fn() };
    getBankaccountDashBoardReportDao.mockResolvedValue({ id: 1 }); // Not an array

    await expect(createBankHistoryService(mockConn)).rejects.toThrow(
      'Expected an array of bank accounts from getBankaccountDashBoardReportDao'
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Error while creating bank history',
      expect.any(Error)
    );
    expect(createBankHistoryDao).not.toHaveBeenCalled();
  });

  it('should handle errors from createBankHistoryDao and log them', async () => {
    const mockBanks = [{ id: 1, today_balance: 1000, balance: 1500, payin_count: 5 }];
    const mockConn = { query: jest.fn() };
    const error = new Error('Database error');
    getBankaccountDashBoardReportDao.mockResolvedValue(mockBanks);
    createBankHistoryDao.mockRejectedValue(error);

    await expect(createBankHistoryService(mockConn)).rejects.toThrow(error);
    expect(logger.error).toHaveBeenCalledWith('Error while creating bank history', error);
    expect(createBankHistoryDao).toHaveBeenCalledWith(
      {
        bank_account_id: 1,
        today_balance: 1000,
        today_current_balance: 1500,
        count: 5,
      },
      mockConn
    );
  });

  it('should handle empty bank accounts array', async () => {
    const mockConn = { query: jest.fn() };
    getBankaccountDashBoardReportDao.mockResolvedValue([]);

    const result = await createBankHistoryService(mockConn);

    expect(getBankaccountDashBoardReportDao).toHaveBeenCalled();
    expect(createBankHistoryDao).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('should correctly map bank account data to payload', async () => {
    const mockBanks = [
      { id: 1, balance: 1500, payin_count: 5 }, // today_balance missing
    ];
    const mockConn = { query: jest.fn() };
    const mockResult = [
      { bank_account_id: 1, today_balance: 0, today_current_balance: 1500, count: 5 },
    ];
    getBankaccountDashBoardReportDao.mockResolvedValue(mockBanks);
    createBankHistoryDao.mockResolvedValue(mockResult[0]);

    const result = await createBankHistoryService(mockConn);

    expect(createBankHistoryDao).toHaveBeenCalledWith(
      {
        bank_account_id: 1,
        today_balance: 0, // Default value
        today_current_balance: 1500,
        count: 5,
      },
      mockConn
    );
    expect(result).toEqual(mockResult);
  });
});