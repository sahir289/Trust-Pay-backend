// Import and mock dependencies
jest.mock('../../utils/db.js');

const {
  getBankResponseDao,
  getClaimResponseDao,
  getBankResponsesforFreeze,
} = require('./bankResponseDao.js');

const dbMock = jest.requireMock('../../utils/db.js');
const { logger } = require('../../utils/logger.js');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc.js');
const timezone = require('dayjs/plugin/timezone.js');

// Mock dayjs properly to avoid Invalid time value
jest.mock('dayjs', () => {
  const actualDayjs = jest.requireActual('dayjs');
  const mockDayjs = jest.fn((...args) => {
    const instance = actualDayjs(...args);

    // stub tz, startOf, endOf, utc
    instance.tz = jest.fn(() => ({
      utc: () => ({ format: () => '2025-08-18T12:00:00Z' }),
      startOf: () => ({ format: () => '2025-08-18T00:00:00Z' }),
      endOf: () => ({ format: () => '2025-08-18T23:59:59.999Z' }),
    }));

    instance.utc = () => ({ format: () => '2025-08-18T12:00:00Z' });
    instance.startOf = () => ({ format: () => '2025-08-18T00:00:00Z' });
    instance.endOf = () => ({ format: () => '2025-08-18T23:59:59.999Z' });

    return instance;
  });

  // stub top-level tz
  mockDayjs.tz = jest.fn(() => ({
    utc: () => ({ format: () => '2025-08-18T12:00:00Z' }),
    startOf: () => ({ format: () => '2025-08-18T00:00:00Z' }),
    endOf: () => ({ format: () => '2025-08-18T23:59:59.999Z' }),
  }));

  mockDayjs.extend = jest.fn((plugin) => {
    actualDayjs.extend(plugin);
    return mockDayjs;
  });

  return mockDayjs;
});

// Apply dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

// Mock dependencies
jest.mock('../bankAccounts/bankaccountDao.js', () => ({
  getBankaccountDao: jest.fn(),
}));
jest.mock('../../utils/logger.js', () => ({
  logger: {
    error: jest.fn(),
  },
}));
jest.mock('../../utils/searchBuilder.js', () => ({
  buildSearchFilterObj: jest.fn(),
}));

describe('BankResponseDao', () => {
  const mockStartDate = '2025-08-18T00:00:00Z';
  const mockEndDate = '2025-08-18T23:59:59.999Z';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBankResponseDao', () => {
    it('should return bank response with default parameters', async () => {
      const filters = { company_id: 'comp1' };
      const mockRows = [{ id: 'br1', amount: 1000 }];
      const mockQuery = 'SELECT * FROM "BankResponse" WHERE company_id = $1';
      dbMock.buildSelectQuery.mockReturnValue([mockQuery, { company_id: 'comp1' }]);
      dbMock.executeQuery.mockResolvedValue({ rows: mockRows });

      const result = await getBankResponseDao(filters);

      expect(dbMock.buildSelectQuery).toHaveBeenCalledWith(
        'SELECT * FROM "BankResponse" WHERE 1=1',
        filters,
        0,
        10
      );
      expect(dbMock.executeQuery).toHaveBeenCalledWith(mockQuery, expect.objectContaining({ company_id: 'comp1' }));
      expect(result).toEqual(mockRows[0]);
    });

    it('should handle date range filtering', async () => {
      const startDate = new Date('2025-08-18');
      const endDate = new Date('2025-08-19');
      const filters = {
        company_id: 'comp1',
        created_at_start: startDate,
        created_at_end: endDate
      };
      const mockRows = [{ id: 'br1', amount: 1000 }];
      const mockQuery = 'SELECT * FROM "BankResponse" WHERE company_id = $1 AND created_at BETWEEN $2 AND $3';
      dbMock.buildSelectQuery.mockReturnValue([mockQuery, { ...filters }]);
      dbMock.executeQuery.mockResolvedValue({ rows: mockRows });

      const result = await getBankResponseDao(filters, startDate, endDate);

      expect(dbMock.buildSelectQuery).toHaveBeenCalledWith(
        'SELECT * FROM "BankResponse" WHERE 1=1',
        filters,
        0,
        10
      );
      expect(result).toEqual(mockRows[0]);
    });

    it('should throw error on query failure', async () => {
      const filters = { company_id: 'comp1' };
      const error = new Error('Query failed');
      dbMock.executeQuery.mockRejectedValue(error);

      await expect(getBankResponseDao(filters)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error in getBankResponseDao:', error);
    });
  });

  describe('getClaimResponseDao', () => {
    it('should return claim response data', async () => {
      const filters = { company_id: 'comp1', banks: ['bank1'], vendors: ['vendor1'] };
      const mockRows = [
        {
          claimed_amount: '1000',
          claimed_count: '2',
          total_unclaimed_amount: '1500',
          total_unclaimed_count: '3',
          bank_name: 'Test Bank',
          nick_name: 'Test Nick',
          amount: '0',
          count: '0',
        },
      ];
      dbMock.executeQuery.mockResolvedValue({ rows: mockRows });

      const result = await getClaimResponseDao(filters);

      expect(dbMock.executeQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([mockStartDate, mockEndDate, 'comp1', ['bank1'], ['vendor1']])
      );
      expect(result).toEqual({
        claimed24h: { amount: 1000, count: 2 },
        unclaimed24h: { amount: 0, count: 0 },
        totalUnclaimed: { amount: 1500, count: 3 },
        banks_unclaims_amount: [{ bank_name: 'Test Bank', nick_name: 'Test Nick', amount: 0, count: 0 }],
      });
    });

    it('should return zero values when no data', async () => {
      const filters = { company_id: 'comp1' };
      dbMock.executeQuery.mockResolvedValue({ rows: [] });

      const result = await getClaimResponseDao(filters);

      expect(result).toEqual({
        claimed24h: { amount: 0, count: 0 },
        unclaimed24h: { amount: 0, count: 0 },
        totalUnclaimed: { amount: 0, count: 0 },
        banks_unclaims_amount: [],
      });
    });

    it('should throw error on query failure', async () => {
      const filters = { company_id: 'comp1' };
      const error = new Error('Query failed');
      dbMock.executeQuery.mockRejectedValue(error);

      await expect(getClaimResponseDao(filters)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error getting claim response:', error);
    });
  });

  describe('getBankResponsesforFreeze', () => {
    it('should return bank responses with filters', async () => {
      const filters = { bank_id: 'bank1', status: '/success', is_used: false };
      const mockRows = [{ id: 'br1', status: '/success', bank_id: 'bank1', is_used: false }];
      dbMock.executeQuery.mockResolvedValue({ rows: mockRows });

      const result = await getBankResponsesforFreeze(filters);

      expect(dbMock.executeQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['bank1', '/success', false]
      );
      expect(result).toEqual(mockRows);
    });

    it('should throw error on query failure', async () => {
      const filters = { bank_id: 'bank1' };
      const error = new Error('Query failed');
      dbMock.executeQuery.mockRejectedValue(error);

      await expect(getBankResponsesforFreeze(filters)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error in getBankResponsesDao:', error);
    });
  });
});