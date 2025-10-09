// Import and mock dependencies
jest.mock('../../utils/db.js');

const {
  getBankResponseDao,
  getClaimResponseDao,
  getBankResponsesforFreeze,
  getBankResponsePayinDao,
  getBankResponseDaoById,
  getCheckBankResponseDao,
  getForCreateBankResponseDao,
  getBankResponseBySearchDao,
  getBankResponseForEsDao,
  getBankResponsePendingDao,
  getBankResponseDaoAll,
  getBankResponseByUTR,
  getInternalBankResponseByUTR,
  createBankResponseDao,
  updateBankResponseDao,
  getBankMessageDao,
  resetBankResponseDao,
  updateBotResponseDao,
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

  describe('getBankResponsePayinDao', () => {
    it('should return bank response payin data with no filters', async () => {
      const filters = { company_id: 'comp1' };
      const mockRows = [{ id: 'br1', utr: 'utr1', amount: 1000 }];
      dbMock.executeQuery.mockResolvedValue({ rows: mockRows });

      const result = await getBankResponsePayinDao(filters);

      expect(dbMock.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE ba.company_id = $1'),
        ['comp1']
      );
      expect(result).toEqual(mockRows[0]);
    });

    it('should handle utr filter', async () => {
      const filters = { company_id: 'comp1', utr: 'utr1' };
      const mockRows = [{ id: 'br1', utr: 'utr1' }];
      dbMock.executeQuery.mockResolvedValue({ rows: mockRows });

      const result = await getBankResponsePayinDao(filters);

      expect(dbMock.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND br.utr = $2'),
        ['comp1', 'utr1']
      );
      expect(result).toEqual(mockRows[0]);
    });

    it('should handle status filter as array', async () => {
      const filters = { company_id: 'comp1', status: ['/success', '/failed'] };
      const mockRows = [{ id: 'br1', status: '/success' }];
      dbMock.executeQuery.mockResolvedValue({ rows: mockRows });

      const result = await getBankResponsePayinDao(filters);

      expect(dbMock.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND br.status = ANY($2::text[])'),
        ['comp1', ['/success', '/failed']]
      );
      expect(result).toEqual(mockRows[0]);
    });

    it('should throw error on query failure', async () => {
      const filters = { company_id: 'comp1' };
      const error = new Error('Query failed');
      dbMock.executeQuery.mockRejectedValue(error);

      await expect(getBankResponsePayinDao(filters)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error in getBankResponseDao:', error);
    });
  });

  describe('getBankResponseDaoById', () => {
    it('should return bank response by id', async () => {
      const filters = { id: 'br1', company_id: 'comp1' };
      const mockRows = [{ id: 'br1', utr: 'utr1', nick_name: 'nick1' }];
      dbMock.executeQuery.mockResolvedValue({ rows: mockRows });

      const result = await getBankResponseDaoById(filters);

      expect(dbMock.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE br.id = $1 AND ba.company_id = $2'),
        ['br1', 'comp1']
      );
      expect(result).toEqual(mockRows[0]);
    });

    it('should throw error on query failure', async () => {
      const filters = { id: 'br1', company_id: 'comp1' };
      const error = new Error('Query failed');
      dbMock.executeQuery.mockRejectedValue(error);

      await expect(getBankResponseDaoById(filters)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error in getBankResponseDaoById:', error);
    });
  });

  describe('getCheckBankResponseDao', () => {
    it('should return true if rows exist', async () => {
      const filters = { id: 'br1' };
      const mockRows = [{ id: 'br1' }];
      dbMock.buildSelectQuery.mockReturnValue(['SELECT id FROM "BankResponse" WHERE id = $1', { id: 'br1' }]);
      dbMock.executeQuery.mockResolvedValue({ rows: mockRows });

      const result = await getCheckBankResponseDao(filters);

      expect(result).toBe(true);
    });

    it('should return false if no rows', async () => {
      const filters = { id: 'br2' };
      dbMock.buildSelectQuery.mockReturnValue(['SELECT id FROM "BankResponse" WHERE id = $1', { id: 'br2' }]);
      dbMock.executeQuery.mockResolvedValue({ rows: [] });

      const result = await getCheckBankResponseDao(filters);

      expect(result).toBe(false);
    });

    it('should throw error on query failure', async () => {
      const filters = { id: 'br1' };
      const error = new Error('Query failed');
      dbMock.executeQuery.mockRejectedValue(error);

      await expect(getCheckBankResponseDao(filters)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error fetching bank response data:', error);
    });
  });

  describe('getForCreateBankResponseDao', () => {
    it('should return rows for create', async () => {
      const filters = { utr: 'utr1' };
      const mockRows = [{ id: 'br1', utr: 'utr1' }];
      dbMock.buildSelectQuery.mockReturnValue(['SELECT id, utr, ... FROM "BankResponse" WHERE utr = $1', { utr: 'utr1' }]);
      dbMock.executeQuery.mockResolvedValue({ rows: mockRows });

      const result = await getForCreateBankResponseDao(filters);

      expect(result).toEqual(mockRows);
    });

    it('should return empty array if no rows', async () => {
      const filters = { utr: 'utr2' };
      dbMock.buildSelectQuery.mockReturnValue(['SELECT id, utr, ... FROM "BankResponse" WHERE utr = $1', { utr: 'utr2' }]);
      dbMock.executeQuery.mockResolvedValue({ rows: [] });

      const result = await getForCreateBankResponseDao(filters);

      expect(result).toEqual([]);
    });

    it('should throw error on query failure', async () => {
      const filters = { utr: 'utr1' };
      const error = new Error('Query failed');
      dbMock.executeQuery.mockRejectedValue(error);

      await expect(getForCreateBankResponseDao(filters)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error fetching bank response data:', error);
    });
  });

  describe('getBankResponseBySearchDao', () => {
    it('should return search results with pagination', async () => {
      const filters = { company_id: 'comp1' };
      const mockRows = [{ id: 'br1' }];
      const mockCountRows = [{ total: '1' }];
      dbMock.executeQuery
        .mockResolvedValueOnce({ rows: mockCountRows })
        .mockResolvedValueOnce({ rows: mockRows });

      const result = await getBankResponseBySearchDao(filters, 1, 10);

      expect(dbMock.executeQuery).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ totalCount: 1, totalPages: 1, rows: mockRows });
    });

    it('should throw error on query failure', async () => {
      const filters = { company_id: 'comp1' };
      const error = new Error('Query failed');
      dbMock.executeQuery.mockRejectedValue(error);

      await expect(getBankResponseBySearchDao(filters)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error in getBankResponseBySearchDao:', error);
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

  describe('getBankResponseForEsDao', () => {
    it('should return bank response for ES', async () => {
      const bankId = 'br1';
      const mockRows = [{ utr: 'utr1', amount: 1000 }];
      dbMock.executeQuery.mockResolvedValue({ rows: mockRows });

      const result = await getBankResponseForEsDao(bankId);

      expect(dbMock.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['br1']
      );
      expect(result).toEqual(mockRows[0]);
    });

    it('should return null if no rows', async () => {
      const bankId = 'br2';
      dbMock.executeQuery.mockResolvedValue({ rows: [] });

      const result = await getBankResponseForEsDao(bankId);

      expect(result).toBeNull();
    });

    it('should throw error on query failure', async () => {
      const bankId = 'br1';
      const error = new Error('Query failed');
      dbMock.executeQuery.mockRejectedValue(error);

      await expect(getBankResponseForEsDao(bankId)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error getting bank account nickname:', error);
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

  describe('getBankResponsePendingDao', () => {

    it('should throw error on query failure', async () => {
      const filters = { is_used: false, status: '/success', utr: 'utr1', company_id: 'comp1' };
      const error = new Error('Query failed');
      dbMock.executeQuery.mockRejectedValue(error);

      await expect(getBankResponsePendingDao(filters)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error getting BankResponse:', error);
    });
  });

  describe('getBankResponseDaoAll', () => {
    it('should return all bank responses', async () => {
      const filters = { company_id: 'comp1' };
      const mockRows = [{ id: 'br1' }];
      const mockBankDetails = [{ config: { merchant_added: {} } }];
      require('../bankAccounts/bankaccountDao.js').getBankaccountDao.mockResolvedValue(mockBankDetails);
      dbMock.buildSelectQuery.mockReturnValue(['SELECT ... FROM "BankResponse" ...', { company_id: 'comp1' }]);
      dbMock.executeQuery.mockResolvedValue({ rows: mockRows });

      const result = await getBankResponseDaoAll(filters);

      expect(result).toEqual({ totalCount: mockRows.length, rows: mockRows });
    });

    it('should handle userId filter', async () => {
      const filters = { userId: ['user1'], company_id: 'comp1' };
      const mockRows = [{ id: 'br1' }];
      dbMock.executeQuery.mockResolvedValue({ rows: mockRows });

      const result = await getBankResponseDaoAll(filters);

      expect(dbMock.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE ba.user_id = ANY($1)'),
        [['user1']]
      );
      expect(result).toEqual({ totalCount: mockRows.length, rows: mockRows });
    });

    it('should throw error on query failure', async () => {
      const filters = { company_id: 'comp1' };
      const error = new Error('Query failed');
      dbMock.executeQuery.mockRejectedValue(error);

      await expect(getBankResponseDaoAll(filters)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error getting Bank Response:', error);
    });
  });

  describe('getBankResponseByUTR', () => {
    it('should return bank response by UTR', async () => {
      const utr = 'utr1';
      const mockRows = [{ id: 'br1', utr: 'utr1' }];
      dbMock.executeQuery.mockResolvedValue({ rows: mockRows });

      const result = await getBankResponseByUTR(utr);

      expect(dbMock.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND br.utr = $1'),
        ['utr1']
      );
      expect(result).toEqual(mockRows[0]);
    });

    it('should throw error on query failure', async () => {
      const utr = 'utr1';
      const error = new Error('Query failed');
      dbMock.executeQuery.mockRejectedValue(error);

      await expect(getBankResponseByUTR(utr)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error getting Bank Response by utr', error);
    });
  });

  describe('getInternalBankResponseByUTR', () => {
    it('should throw error on query failure', async () => {
      const utr = 'utr1';
      const error = new Error('Query failed');
      dbMock.executeQuery.mockRejectedValue(error);

      await expect(getInternalBankResponseByUTR(utr)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error getting Bank Response by utr', error);
    });
  });

  describe('createBankResponseDao', () => {
    it('should create bank response without conn', async () => {
      const data = { utr: 'utr1', amount: 1000 };
      const mockRows = [{ id: 'br1', ...data }];
      dbMock.buildInsertQuery.mockReturnValue(['INSERT INTO "BankResponse" ...', Object.values(data)]);
      dbMock.executeQuery.mockResolvedValue({ rows: mockRows });

      const result = await createBankResponseDao(null, data);

      expect(dbMock.buildInsertQuery).toHaveBeenCalledWith('BankResponse', data);
      expect(dbMock.executeQuery).toHaveBeenCalled();
      expect(result).toEqual(mockRows[0]);
    });

    it('should create bank response with conn', async () => {
      const conn = { query: jest.fn() };
      const data = { utr: 'utr1', amount: 1000 };
      const mockRows = [{ id: 'br1', ...data }];
      dbMock.buildInsertQuery.mockReturnValue(['INSERT INTO "BankResponse" ...', Object.values(data)]);
      conn.query.mockResolvedValue({ rows: mockRows });

      const result = await createBankResponseDao(conn, data);

      expect(conn.query).toHaveBeenCalled();
      expect(result).toEqual(mockRows[0]);
    });

    it('should throw error on query failure', async () => {
      const data = { utr: 'utr1' };
      const error = new Error('Insert failed');
      dbMock.executeQuery.mockRejectedValue(error);

      await expect(createBankResponseDao(null, data)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error in createBankResponseDao:', error);
    });
  });

  describe('updateBankResponseDao', () => {
    it('should update bank response without conn', async () => {
      const id = 'br1';
      const data = { status: '/success' };
      const mockRows = [{ id, ...data }];
      dbMock.buildUpdateQuery.mockReturnValue(['UPDATE "BankResponse" SET ... WHERE id = $1', [...Object.values(data), id]]);
      dbMock.executeQuery.mockResolvedValue({ rows: mockRows });

      const result = await updateBankResponseDao(id, data, null);

      expect(dbMock.buildUpdateQuery).toHaveBeenCalledWith('BankResponse', data, id);
      expect(result).toEqual(mockRows[0]);
    });

    it('should update bank response with conn', async () => {
      const id = 'br1';
      const data = { status: '/success' };
      const conn = { query: jest.fn() };
      const mockRows = [{ id, ...data }];
      dbMock.buildUpdateQuery.mockReturnValue(['UPDATE "BankResponse" SET ... WHERE id = $1', [...Object.values(data), id]]);
      conn.query.mockResolvedValue({ rows: mockRows });

      const result = await updateBankResponseDao(id, data, conn);

      expect(conn.query).toHaveBeenCalled();
      expect(result).toEqual(mockRows[0]);
    });

    it('should throw error on query failure', async () => {
      const id = 'br1';
      const data = { status: '/success' };
      const error = new Error('Update failed');
      dbMock.executeQuery.mockRejectedValue(error);

      await expect(updateBankResponseDao(id, data, null)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error in updateBankResponseDao:', error);
    });
  });

  describe('getBankMessageDao', () => {

    it('should throw error on query failure', async () => {
      const bank_id = 'bank1';
      const startDate = mockStartDate;
      const endDate = mockEndDate;
      const company_id = 'comp1';
      const error = new Error('Query failed');
      dbMock.executeQuery.mockRejectedValue(error);

      await expect(getBankMessageDao(bank_id, startDate, endDate, company_id)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error in getBankMessageDao:', error);
    });
  });

  describe('resetBankResponseDao', () => {
    it('should reset bank response', async () => {
      const id = 'br1';
      const data = { is_used: false };
      const mockRows = [{ id, ...data }];
      dbMock.buildUpdateQuery.mockReturnValue(['UPDATE "BankResponse" SET ... WHERE id = $1', [...Object.values(data), id]]);
      dbMock.executeQuery.mockResolvedValue({ rows: mockRows });

      const result = await resetBankResponseDao(id, data);

      expect(dbMock.buildUpdateQuery).toHaveBeenCalledWith('BankResponse', data, { id });
      expect(result).toEqual(mockRows[0]);
    });

    it('should throw error on query failure', async () => {
      const id = 'br1';
      const data = { is_used: false };
      const error = new Error('Update failed');
      dbMock.executeQuery.mockRejectedValue(error);

      await expect(resetBankResponseDao(id, data)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error in resetBankResponseDao:', error);
    });
  });

  describe('updateBotResponseDao', () => {
    it('should update bot response without conn', async () => {
      const id = 'br1';
      const data = { status: '/success' };
      const mockRows = [{ id, ...data }];
      dbMock.buildUpdateQuery.mockReturnValue(['UPDATE "BankResponse" SET ... WHERE id = $1', [...Object.values(data), id]]);
      dbMock.executeQuery.mockResolvedValue({ rows: mockRows });

      const result = await updateBotResponseDao(id, data, null);

      expect(dbMock.buildUpdateQuery).toHaveBeenCalledWith('BankResponse', data, { id });
      expect(result).toEqual(mockRows[0]);
    });

    it('should update bot response with conn', async () => {
      const id = 'br1';
      const data = { status: '/success' };
      const conn = { query: jest.fn() };
      const mockRows = [{ id, ...data }];
      dbMock.buildUpdateQuery.mockReturnValue(['UPDATE "BankResponse" SET ... WHERE id = $1', [...Object.values(data), id]]);
      conn.query.mockResolvedValue({ rows: mockRows });

      const result = await updateBotResponseDao(id, data, conn);

      expect(conn.query).toHaveBeenCalled();
      expect(result).toEqual(mockRows[0]);
    });

    it('should throw error on query failure', async () => {
      const id = 'br1';
      const data = { status: '/success' };
      const error = new Error('Update failed');
      dbMock.executeQuery.mockRejectedValue(error);

      await expect(updateBotResponseDao(id, data, null)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error in updateBotResponseDao:', error);
    });
  });
});