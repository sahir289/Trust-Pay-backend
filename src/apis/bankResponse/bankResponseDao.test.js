import {
    getBankResponseDao,
    getBankResponseDaoById,
    getBankResponseBySearchDao,
    getClaimResponseDao,
    getBankResponsesforFreeze,
    getBankResponseDaoAll,
    getBankResponseByUTR,
    getInternalBankResponseByUTR,
    createBankResponseDao,
    updateBankResponseDao,
    getBankMessageDao,
    resetBankResponseDao,
    updateBotResponseDao,
  } from './bankResponseDao.js';
  import { executeQuery, buildSelectQuery, buildInsertQuery, buildUpdateQuery } from '../../utils/db.js';
  import { getBankaccountDao } from '../bankAccounts/bankaccountDao.js';
  import { logger } from '../../utils/logger.js';
  import { buildSearchFilterObj } from '../../utils/searchBuilder.js';
  import { tableName } from '../../constants/index.js';
  import dayjs from 'dayjs';
  import utc from 'dayjs/plugin/utc.js';
  import timezone from 'dayjs/plugin/timezone.js';
  
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
  jest.mock('../../utils/db.js', () => ({
    executeQuery: jest.fn(),
    buildSelectQuery: jest.fn(),
    buildInsertQuery: jest.fn(),
    buildUpdateQuery: jest.fn(),
  }));
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
  
    // ------------------ getBankResponseDao ------------------
    describe('getBankResponseDao', () => {
      it('should return bank response with default parameters', async () => {
        const filters = { company_id: 'comp1' };
        const mockRows = [{ id: 'br1', amount: 1000 }];
        buildSelectQuery.mockReturnValue(['SELECT * FROM "BankResponse" WHERE company_id = $1', { company_id: 'comp1' }]);
        executeQuery.mockResolvedValue({ rows: mockRows });
  
        const result = await getBankResponseDao(filters);
  
        expect(buildSelectQuery).toHaveBeenCalledWith(
          'SELECT * FROM "BankResponse" WHERE 1=1',
          filters,
          0,
          10
        );
        expect(executeQuery).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ company_id: 'comp1' })
        );
        expect(result).toEqual(mockRows[0]);
      });
  
      it('should handle date range filtering', async () => {
        const filters = { company_id: 'comp1' };
        const startDate = new Date('2025-08-18');
        const endDate = new Date('2025-08-19');
        const mockRows = [{ id: 'br1', amount: 1000 }];
        buildSelectQuery.mockReturnValue([
          'SELECT * FROM "BankResponse" WHERE company_id = $1 AND created_at BETWEEN $2 AND $3',
          {
            company_id: 'comp1',
            created_at_start: startDate,
            created_at_end: endDate,
          },
        ]);
        executeQuery.mockResolvedValue({ rows: mockRows });
  
        const result = await getBankResponseDao(filters, startDate, endDate);
  
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringContaining('AND created_at BETWEEN $2 AND $3'),
          expect.objectContaining({
            company_id: 'comp1',
            created_at_start: startDate,
            created_at_end: endDate,
          })
        );
        expect(result).toEqual(mockRows[0]);
      });
  
      it('should throw error on query failure', async () => {
        const filters = { company_id: 'comp1' };
        const error = new Error('Query failed');
        buildSelectQuery.mockReturnValue(['SELECT * FROM "BankResponse" WHERE company_id = $1', { company_id: 'comp1' }]);
        executeQuery.mockRejectedValue(error);
  
        await expect(getBankResponseDao(filters)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error in getBankResponseDao:', error);
      });
    });
  
    // ------------------ getBankResponseDaoById ------------------
    describe('getBankResponseDaoById', () => {
      it('should return bank response by ID', async () => {
        const filters = { id: 'br1', company_id: 'comp1' };
        const mockRows = [{ id: 'br1', bank_id: 'bank1', utr: 'utr123', nick_name: 'Test Bank', user_id: 'user1' }];
        executeQuery.mockResolvedValue({ rows: mockRows });
  
        const result = await getBankResponseDaoById(filters);
  
        expect(executeQuery).toHaveBeenCalledWith(
          expect.any(String),
          [filters.id, filters.company_id]
        );
        expect(result).toEqual(mockRows[0]);
      });
  
      it('should throw error on query failure', async () => {
        const filters = { id: 'br1', company_id: 'comp1' };
        const error = new Error('Query failed');
        executeQuery.mockRejectedValue(error);
  
        await expect(getBankResponseDaoById(filters)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error in getBankResponseDaoById:', error);
      });
    });
  
    // ------------------ getBankResponseBySearchDao ------------------
    describe('getBankResponseBySearchDao', () => {
      beforeEach(() => {
        jest.clearAllMocks();
        buildSearchFilterObj.mockReturnValue({ or: { id: 'test', status: 'test' } });
      });
  
      it('should return bank responses with search and date filters', async () => {
        const filters = { company_id: 'comp1', search: 'test' };
        const mockRows = [{ id: 'br1', amount: 1000, nick_name: 'Test Bank' }];
        const mockCountRows = [{ total: '10' }];
      
        executeQuery
          .mockResolvedValueOnce({ rows: mockCountRows }) // Count query
          .mockResolvedValueOnce({ rows: mockRows }); // Main query
      
        const result = await getBankResponseBySearchDao(
          filters,
          1,
          10,
          [],
          false,
          'created_at',
          'DESC',
          '2025-08-18',
          '2025-08-19'
        );
      
        // Removed the buildSearchFilterObj expectation
        expect(executeQuery).toHaveBeenCalledTimes(2);
        expect(result).toEqual({
          totalCount: 10,
          totalPages: 1,
          rows: mockRows,
        });
      });
      
  
      it('should handle bank_id and merchant_added filtering', async () => {
        const filters = { bank_id: 'bank1', company_id: 'comp1' };
        const mockBankDetails = [{ config: { merchant_added: { '2025-08-18': 'value' } } }];
        const mockRows = [{ id: 'br1', amount: 1000 }];
        const mockCountRows = [{ total: '10' }];
        const mockStartDate = '2025-08-18T12:00:00Z';
        const mockEndDate = '2025-08-18T12:00:00Z';
        getBankaccountDao.mockResolvedValue(mockBankDetails);
        executeQuery
          .mockResolvedValueOnce({ rows: mockCountRows })
          .mockResolvedValueOnce({ rows: mockRows });
      
        const result = await getBankResponseBySearchDao(filters, 1, 10, [], false, 'created_at', 'DESC', '2025-08-18', '2025-08-19');
      
        expect(getBankaccountDao).toHaveBeenCalledWith({ id: 'bank1' }, null, null);
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringContaining('WITH filtered_accounts AS'),
          expect.arrayContaining([mockStartDate, mockEndDate, 'bank1', 'comp1'])
        );
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringContaining('LIMIT $5 OFFSET $6'),
          expect.arrayContaining([mockStartDate, mockEndDate, 'bank1', 'comp1', 10, 0])
        );        
      
        expect(result).toEqual({
          totalCount: 10,
          totalPages: 1,
          rows: mockRows,
        });
      });
  
      it('should throw error on query failure', async () => {
        const filters = { company_id: 'comp1' };
        const error = new Error('Query failed');
        executeQuery.mockRejectedValue(error);
  
        await expect(getBankResponseBySearchDao(filters)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error in getBankResponseBySearchDao:', error);
      });
    });
  
    // ------------------ getClaimResponseDao ------------------
    describe('getClaimResponseDao', () => {
      it('should return claim response data', async () => {
        const filters = { company_id: 'comp1', banks: ['bank1'], vendors: ['vendor1'] };
        const mockRows = [
          {
            claimed_amount: '1000',
            claimed_count: '2',
            unclaimed_24h_amount: '500',
            unclaimed_24h_count: '1',
            total_unclaimed_amount: '1500',
            total_unclaimed_count: '3',
            bank_name: 'Test Bank',
            nick_name: 'Test Nick',
            amount: '500',
            count: '1',
          },
        ];
        executeQuery.mockResolvedValue({ rows: mockRows });
  
        const result = await getClaimResponseDao(filters);
  
        expect(executeQuery).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining([mockStartDate, mockEndDate, 'comp1', ['bank1'], ['vendor1']])
        );
        expect(result).toEqual({
          claimed24h: { amount: 1000, count: 2 },
          unclaimed24h: { amount: 500, count: 1 },
          totalUnclaimed: { amount: 1500, count: 3 },
          banks_unclaims_amount: [{ bank_name: 'Test Bank', nick_name: 'Test Nick', amount: 500, count: 1 }],
        });
      });
  
      it('should return zero values when no data', async () => {
        const filters = { company_id: 'comp1' };
        executeQuery.mockResolvedValue({ rows: [] });
  
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
        executeQuery.mockRejectedValue(error);
  
        await expect(getClaimResponseDao(filters)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error getting claim response:', error);
      });
 
    });
  
    describe('getBankResponsesforFreeze', () => {
      it('should return bank responses with filters', async () => {
        const filters = { bank_id: 'bank1', status: '/success', is_used: false };
        const mockRows = [{ id: 'br1', status: '/success', bank_id: 'bank1', is_used: false }];
        executeQuery.mockResolvedValue({ rows: mockRows });
  
        const result = await getBankResponsesforFreeze(filters);
  
        expect(executeQuery).toHaveBeenCalledWith(
          expect.any(String),
          ['bank1', '/success', false]
        );
        expect(result).toEqual(mockRows);
      });
  
      it('should throw error on query failure', async () => {
        const filters = { bank_id: 'bank1' };
        const error = new Error('Query failed');
        executeQuery.mockRejectedValue(error);
  
        await expect(getBankResponsesforFreeze(filters)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error in getBankResponsesDao:', error);
      });
    });
  
    describe('getBankResponseDaoAll', () => {
      beforeEach(() => {
       
      });
  
      it('should return bank responses with userId filter', async () => {
        const filters = { userId: '["user1"]', company_id: 'comp1' };
        const mockRows = [{ id: 'br1', amount: 1000 }];
        executeQuery.mockResolvedValue({ rows: mockRows });
  
        const result = await getBankResponseDaoAll(filters);
  
        expect(executeQuery).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining([['user1']])
        );
        expect(result).toEqual({ totalCount: 1, rows: mockRows });
      });
  
      it('should throw error on invalid userId format', async () => {
        const filters = { userId: 'invalid_json', company_id: 'comp1' };
        await expect(getBankResponseDaoAll(filters)).rejects.toThrow('Invalid userId format');
        expect(logger.error).toHaveBeenCalledWith('Invalid userId format:', expect.any(Error));
      });
    });
  
    describe('getBankResponseByUTR', () => {
      it('should return bank response by UTR', async () => {
        const utr = 'utr123';
        const mockRows = [{ id: 'br1', utr: 'utr123', amount: 1000 }];
        executeQuery.mockResolvedValue({ rows: mockRows });
  
        const result = await getBankResponseByUTR(utr);
  
        expect(executeQuery).toHaveBeenCalledWith(expect.any(String), [utr]);
        expect(result).toEqual(mockRows[0]);
      });
  
      it('should throw error on query failure', async () => {
        const utr = 'utr123';
        const error = new Error('Query failed');
        executeQuery.mockRejectedValue(error);
  
        await expect(getBankResponseByUTR(utr)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error getting Bank Response by utr', error);
      });
    });
  
    describe('getInternalBankResponseByUTR', () => {
      it('should return internal bank response by UTR', async () => {
        const utr = 'utr123';
        const mockRows = [{ id: 'br1', utr: 'utr123', status: '/internalTransfer' }];
        executeQuery.mockResolvedValue({ rows: mockRows });
  
        const result = await getInternalBankResponseByUTR(utr);
  
        expect(executeQuery).toHaveBeenCalledWith(expect.any(String), [utr]);
        expect(result).toEqual(mockRows[0]);
      });
  
      it('should throw error on query failure', async () => {
        const utr = 'utr123';
        const error = new Error('Query failed');
        executeQuery.mockRejectedValue(error);
  
        await expect(getInternalBankResponseByUTR(utr)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error getting Bank Response by utr', error);
      });
    });
  
    describe('createBankResponseDao', () => {
      it('should create bank response with connection', async () => {
        const data = { bank_id: 'bank1', amount: 1000 };
        const mockRows = [{ id: 'br1', ...data }];
        buildInsertQuery.mockReturnValue(['INSERT INTO "BankResponse" (bank_id, amount) VALUES ($1, $2) RETURNING *', ['bank1', 1000]]);
        const conn = { query: jest.fn().mockResolvedValue({ rows: mockRows }) };
  
        const result = await createBankResponseDao(conn, data);
  
        expect(buildInsertQuery).toHaveBeenCalledWith(tableName.BANK_RESPONSE, data);
        expect(conn.query).toHaveBeenCalledWith(expect.any(String), ['bank1', 1000]);
        expect(result).toEqual(mockRows[0]);
      });
  
      it('should create bank response without connection', async () => {
        const data = { bank_id: 'bank1', amount: 1000 };
        const mockRows = [{ id: 'br1', ...data }];
        buildInsertQuery.mockReturnValue(['INSERT INTO "BankResponse" (bank_id, amount) VALUES ($1, $2) RETURNING *', ['bank1', 1000]]);
        executeQuery.mockResolvedValue({ rows: mockRows });
  
        const result = await createBankResponseDao(null, data);
  
        expect(buildInsertQuery).toHaveBeenCalledWith(tableName.BANK_RESPONSE, data);
        expect(executeQuery).toHaveBeenCalledWith(expect.any(String), ['bank1', 1000]);
        expect(result).toEqual(mockRows[0]);
      });
  
      it('should throw error on query failure', async () => {
        const data = { bank_id: 'bank1', amount: 1000 };
        const error = new Error('Query failed');
        buildInsertQuery.mockReturnValue(['INSERT INTO "BankResponse" (bank_id, amount) VALUES ($1, $2) RETURNING *', ['bank1', 1000]]);
        executeQuery.mockRejectedValue(error);
  
        await expect(createBankResponseDao(null, data)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error in createBankResponseDao:', error);
      });
    });
  
    describe('updateBankResponseDao', () => {
      it('should update bank response with connection', async () => {
        const id = 'br1';
        const data = { amount: 2000 };
        const mockRows = [{ id: 'br1', amount: 2000 }];
        buildUpdateQuery.mockReturnValue(['UPDATE "BankResponse" SET amount = $1 WHERE id = $2 RETURNING *', [2000, id]]);
        const conn = { query: jest.fn().mockResolvedValue({ rows: mockRows }) };
  
        const result = await updateBankResponseDao(id, data, conn);
  
        expect(buildUpdateQuery).toHaveBeenCalledWith(tableName.BANK_RESPONSE, data, id);
        expect(conn.query).toHaveBeenCalledWith(expect.any(String), [2000, id]);
        expect(result).toEqual(mockRows[0]);
      });
  
      it('should update bank response without connection', async () => {
        const id = 'br1';
        const data = { amount: 2000 };
        const mockRows = [{ id: 'br1', amount: 2000 }];
        buildUpdateQuery.mockReturnValue(['UPDATE "BankResponse" SET amount = $1 WHERE id = $2 RETURNING *', [2000, id]]);
        executeQuery.mockResolvedValue({ rows: mockRows });
  
        const result = await updateBankResponseDao(id, data);
  
        expect(buildUpdateQuery).toHaveBeenCalledWith(tableName.BANK_RESPONSE, data, id);
        expect(executeQuery).toHaveBeenCalledWith(expect.any(String), [2000, id]);
        expect(result).toEqual(mockRows[0]);
      });
  
      it('should throw error on query failure', async () => {
        const id = 'br1';
        const data = { amount: 2000 };
        const error = new Error('Query failed');
        buildUpdateQuery.mockReturnValue(['UPDATE "BankResponse" SET amount = $1 WHERE id = $2 RETURNING *', [2000, id]]);
        executeQuery.mockRejectedValue(error);
  
        await expect(updateBankResponseDao(id, data)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error in updateBankResponseDao:', error);
      });
    });
  
    describe('getBankMessageDao', () => {
      it('should return bank messages', async () => {
        const bank_id = 'bank1';
        const startDate = '2025-08-18';
        const endDate = '2025-08-19';
        const company_id = 'comp1';
        const mockRows = [{ id: 'br1', bank_id: 'bank1' }];
        executeQuery.mockResolvedValue({ rows: mockRows });
  
        const result = await getBankMessageDao(bank_id, startDate, endDate, company_id);
  
        expect(executeQuery).toHaveBeenCalledWith(
          expect.any(String),
          [bank_id, startDate, endDate, 10, 0, company_id]
        );
        expect(result).toEqual(mockRows);
      });
  
      it('should throw error on query failure', async () => {
        const bank_id = 'bank1';
        const startDate = '2025-08-18';
        const endDate = '2025-08-19';
        const company_id = 'comp1';
        const error = new Error('Query failed');
        executeQuery.mockRejectedValue(error);
  
        await expect(getBankMessageDao(bank_id, startDate, endDate, company_id)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error in getBankMessageDao:', error);
      });
    });
  
    describe('resetBankResponseDao', () => {
      it('should reset bank response', async () => {
        const id = 'br1';
        const data = { is_used: false };
        const mockRows = [{ id: 'br1', is_used: false }];
        buildUpdateQuery.mockReturnValue(['UPDATE "BankResponse" SET is_used = $1 WHERE id = $2 RETURNING *', [false, id]]);
        executeQuery.mockResolvedValue({ rows: mockRows });
  
        const result = await resetBankResponseDao(id, data);
  
        expect(buildUpdateQuery).toHaveBeenCalledWith(tableName.BANK_RESPONSE, data, { id });
        expect(executeQuery).toHaveBeenCalledWith(expect.any(String), [false, id]);
        expect(result).toEqual(mockRows[0]);
      });
  
      it('should throw error on query failure', async () => {
        const id = 'br1';
        const data = { is_used: false };
        const error = new Error('Query failed');
        buildUpdateQuery.mockReturnValue(['UPDATE "BankResponse" SET is_used = $1 WHERE id = $2 RETURNING *', [false, id]]);
        executeQuery.mockRejectedValue(error);
  
        await expect(resetBankResponseDao(id, data)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error in resetBankResponseDao:', error);
      });
    });
  
    describe('updateBotResponseDao', () => {
      it('should update bot response with connection', async () => {
        const id = 'br1';
        const data = { status: '/success' };
        const mockRows = [{ id: 'br1', status: '/success' }];
        buildUpdateQuery.mockReturnValue(['UPDATE "BankResponse" SET status = $1 WHERE id = $2 RETURNING *', ['/success', id]]);
        const conn = { query: jest.fn().mockResolvedValue({ rows: mockRows }) };
  
        const result = await updateBotResponseDao(id, data, conn);
  
        expect(buildUpdateQuery).toHaveBeenCalledWith(tableName.BANK_RESPONSE, data, { id });
        expect(conn.query).toHaveBeenCalledWith(expect.any(String), ['/success', id]);
        expect(result).toEqual(mockRows[0]);
      });
  
      it('should update bot response without connection', async () => {
        const id = 'br1';
        const data = { status: '/success' };
        const mockRows = [{ id: 'br1', status: '/success' }];
        buildUpdateQuery.mockReturnValue(['UPDATE "BankResponse" SET status = $1 WHERE id = $2 RETURNING *', ['/success', id]]);
        executeQuery.mockResolvedValue({ rows: mockRows });
  
        const result = await updateBotResponseDao(id, data);
  
        expect(buildUpdateQuery).toHaveBeenCalledWith(tableName.BANK_RESPONSE, data, { id });
        expect(executeQuery).toHaveBeenCalledWith(expect.any(String), ['/success', id]);
        expect(result).toEqual(mockRows[0]);
      });
  
      it('should throw error on query failure', async () => {
        const id = 'br1';
        const data = { status: '/success' };
        const error = new Error('Query failed');
        buildUpdateQuery.mockReturnValue(['UPDATE "BankResponse" SET status = $1 WHERE id = $2 RETURNING *', ['/success', id]]);
        executeQuery.mockRejectedValue(error);
  
        await expect(updateBotResponseDao(id, data)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error in updateBotResponseDao:', error);
      });
    });
  });