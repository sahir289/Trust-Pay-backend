import * as dbUtils from '../../utils/db.js';
import actualDayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

actualDayjs.extend(utc);
actualDayjs.extend(timezone);

export default actualDayjs;

const {
    generatePayInUrlDao,
    getPayInCronDao,
    getPayInwithMerchantDao,
    getPayInUrlDao,
    getPayInPendingDao,
    getPayInDaoByCode,
    getPayInsDao,
    getAllPayInsDao,
    getPayinsBySearchDao,
    getPayInUrlsDao,
    updatePayInUrlDao,
    getPayinDetailsByMerchantOrderId,
  } = require('./payinDao'); 

  const { tableName } = require('../../constants/index.js');
  const { BadRequestError } = require('../../utils/appErrors.js');
  const { buildSelectQuery, executeQuery } = require('../../utils/db.js');
  const { logger } = require('../../utils/logger.js');
 

  jest.mock('../../utils/db.js', () => ({
    ...jest.requireActual('../../utils/db.js'),
    executeQuery: jest.fn(),
    getConnection: jest.fn(),
    buildInsertQuery: jest.fn().mockReturnValue(['SQL_QUERY', []]),
    buildSelectQuery: jest.fn().mockReturnValue(['SQL_QUERY', []]),
    buildUpdateQuery: jest.fn().mockReturnValue(['SQL_QUERY', []]),
  }));
  jest.mock('../../utils/logger.js');
  jest.mock('../../constants/index.js');

  describe('PayIn DAO', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    describe('generatePayInUrlDao', () => {
        it('should successfully generate a PayIn URL', async () => {
            const mockData = { amount: 100, merchant_id: '123' };
            const mockResult = { rows: [{ id: 'payin123', ...mockData }] };
            
            require('../../utils/db.js').executeQuery.mockResolvedValue(mockResult);
            tableName.PAYIN = 'Payin';
        
            const result = await generatePayInUrlDao(mockData);
            
            expect(require('../../utils/db.js').buildInsertQuery).toHaveBeenCalledWith('Payin', mockData);
            expect(result).toEqual(mockResult.rows[0]);
          });
        
          it('should throw an error when database query fails', async () => {
            const mockData = { amount: 100, merchant_id: '123' };
            const mockError = new Error('Database error');
            
            require('../../utils/db.js').executeQuery.mockRejectedValue(mockError);
        
            await expect(generatePayInUrlDao(mockData)).rejects.toThrow(mockError);
            expect(logger.error).toHaveBeenCalledWith('Error generating PayIn URL:', mockError);
          });
    });
  
    describe('getPayInCronDao', () => {
        it('should get PayIn data with filters and date range', async () => {
            const filters = { status: 'pending' };
            const startDate = new Date('2023-01-01');
            const endDate = new Date('2023-01-31');
            const mockResult = { rows: [{ id: 'payin123', status: 'pending' }] };
            
            require('../../utils/db.js').executeQuery.mockResolvedValue(mockResult);
            tableName.PAYIN = 'Payin';
        
            const result = await getPayInCronDao(filters, startDate, endDate);
            
            expect(require('../../utils/db.js').buildSelectQuery).toHaveBeenCalled();
            expect(result).toEqual(mockResult.rows[0]);
          });
  
      test('should get PayIn data without date range', async () => {
        const filters = { status: 'pending' };
        const mockResult = { rows: [{ id: 'payin123', status: 'pending' }] };
        
        executeQuery.mockResolvedValue(mockResult);
        tableName.PAYIN = 'Payin';
  
        const result = await getPayInCronDao(filters);
        
        expect(executeQuery).toHaveBeenCalled();
        expect(result).toEqual(mockResult.rows[0]);
      });
  
      test('should handle database errors', async () => {
        const filters = { status: 'pending' };
        const mockError = new Error('Database error');
        
        executeQuery.mockRejectedValue(mockError);
  
        await expect(getPayInCronDao(filters)).rejects.toThrow(mockError);
        expect(logger.error).toHaveBeenCalledWith('Error getting PayIn data:', mockError);
      });
    });
  
    describe('getPayInwithMerchantDao', () => {
      test('should get PayIn data with merchant and company details', async () => {
        const filters = 'order123';
        const mockResult = { 
          rows: [{ 
            merchant_order_id: 'order123', 
            status: 'completed',
            merchant_id: 'merchant123'
          }] 
        };
        
        executeQuery.mockResolvedValue(mockResult);
        tableName.PAYIN = 'Payin';
        tableName.MERCHANT = 'Merchant';
        tableName.COMPANY = 'Company';
      
        const result = await getPayInwithMerchantDao(filters);
        
        const calledQuery = executeQuery.mock.calls[0][0];
        expect(calledQuery).toMatch(/SELECT\s+p\.merchant_order_id/);
        expect(calledQuery).toMatch(/FROM\s+"Payin"\s+p/);
        expect(calledQuery).toMatch(/INNER JOIN\s+"Merchant"\s+m\s*ON\s+p\.merchant_id\s*=\s*m\.id/);
        expect(calledQuery).toMatch(/INNER JOIN\s+"Company"\s+c\s*ON\s+p\.company_id\s*=\s*c\.id/);
        expect(calledQuery).toMatch(/WHERE\s+p\.merchant_order_id\s*=\s*\$1/);
        expect(executeQuery).toHaveBeenCalledWith(expect.any(String), ['order123']);
        expect(result).toEqual(mockResult.rows[0]);
      });
  
      test('should handle array filters', async () => {
        const filters = ['order123', 'order456'];
        const mockResult = { rows: [{}] };
        
        executeQuery.mockResolvedValue(mockResult);
  
        await getPayInwithMerchantDao(filters);
        
        expect(executeQuery).toHaveBeenCalledWith(
          expect.any(String),
          ['order123', 'order456']
        );
      });
  
      test('should handle database errors', async () => {
        const filters = 'order123';
        const mockError = new Error('Database error');
        
        executeQuery.mockRejectedValue(mockError);
  
        await expect(getPayInwithMerchantDao(filters)).rejects.toThrow(mockError);
        expect(logger.error).toHaveBeenCalledWith(
          'Error getting PayIn URL with merchant and company config:',
          mockError
        );
      });
    });
  
    describe('getPayInUrlDao', () => {
      test('should get PayIn URL data with filters', async () => {
        const filters = { id: 'payin123' };
        const mockResult = { rows: [{ id: 'payin123', status: 'pending' }] };
        
        executeQuery.mockResolvedValue(mockResult);
        tableName.PAYIN = 'Payin';
  
        const result = await getPayInUrlDao(filters);
        
        expect(executeQuery).toHaveBeenCalled();
        expect(result).toEqual(mockResult.rows[0]);
      });
  
      test('should handle empty filters for getPayInUrlDao', async () => {
        const mockResult = { rows: [{}] };
      
        buildSelectQuery.mockReturnValue([
          'SELECT * FROM "Payin" WHERE 1=1',
          []
        ]);
      
        executeQuery.mockResolvedValue(mockResult);
      
        await getPayInUrlDao({});
      
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM "Payin" WHERE 1=1'),
          []
        );
      });
      
      test('should handle database errors', async () => {
        const filters = { id: 'payin123' };
        const mockError = new Error('Database error');
        
        executeQuery.mockRejectedValue(mockError);
  
        await expect(getPayInUrlDao(filters)).rejects.toThrow(mockError);
        expect(logger.error).toHaveBeenCalledWith('Error getting PayIn URL:', mockError);
      });
    });
  
    describe('getPayInPendingDao', () => {
      test('should get pending PayIn data for a company', async () => {
        const company_id = 'company123';
        const status = 'pending';
        const mockResult = { 
          rows: [{ 
            id: 'payin123', 
            company_id: 'company123',
            status: 'pending'
          }] 
        };
        
        executeQuery.mockResolvedValue(mockResult);
        tableName.PAYIN = 'Payin';
        tableName.MERCHANT = 'Merchant';
  
        const result = await getPayInPendingDao({ company_id, status });
        
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringContaining('SELECT'),
          [company_id, status]
        );
        expect(result).toEqual(mockResult.rows);
      });
  
      test('should handle database errors', async () => {
        const company_id = 'company123';
        const status = 'pending';
        const mockError = new Error('Database error');
        
        executeQuery.mockRejectedValue(mockError);
  
        await expect(getPayInPendingDao({ company_id, status })).rejects.toThrow(mockError);
        expect(logger.error).toHaveBeenCalledWith('Error getting PayIn URL:', mockError);
      });
    });
  
    describe('getPayInDaoByCode', () => {
      test('should get PayIn data by code', async () => {
        const filters = { id: 'payin123', company_id: 'company123' };
        const mockResult = { rows: [{ code: 'MERCHANT123', merchant_id: 'merchant123' }] };
        
        executeQuery.mockResolvedValue(mockResult);
        tableName.PAYIN = 'Payin';
  
        const result = await getPayInDaoByCode(filters);
        
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringContaining('SELECT r.code'),
          ['payin123', 'company123']
        );
        expect(result).toEqual(mockResult.rows);
      });
  
      test('should handle database errors', async () => {
        const filters = { id: 'payin123', company_id: 'company123' };
        const mockError = new Error('Database error');
        
        executeQuery.mockRejectedValue(mockError);
  
        await expect(getPayInDaoByCode(filters)).rejects.toThrow(mockError);
        expect(logger.error).toHaveBeenCalledWith('Error getting PayIn URL:', mockError);
      });
    });
  
    describe('getPayInsDao', () => {
      test('should get PayIns with filters for ADMIN role', async () => {
        const filters = { status: 'completed' };
        const company_id = 'company123';
        const page = 1;
        const limit = 10;
        const role = 'ADMIN';
        const mockResult = { rows: [{ id: 'payin123', status: 'completed' }] };
        
        executeQuery.mockResolvedValue(mockResult);
        tableName.PAYIN = 'Payin';
  
        const result = await getPayInsDao(filters, company_id, page, limit, role);
        
        expect(executeQuery).toHaveBeenCalled();
        expect(result).toEqual({ payins: mockResult.rows });
      });
  
      test('should get PayIns with search filter', async () => {
        const filters = { search: 'payin123' };
        const company_id = 'company123';
        const mockResult = { rows: [{ id: 'payin123' }] };
        
        executeQuery.mockResolvedValue(mockResult);
  
        await getPayInsDao(filters, company_id);
        
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringContaining('SELECT DISTINCT ON (p.id)'),
          expect.arrayContaining([company_id])
        );
      });
  
      test('should get PayIns with date range filter', async () => {
        const filters = { startDate: '2023-01-01', endDate: '2023-01-31' };
        const company_id = 'company123';
        const mockResult = { rows: [{}] };
        
        executeQuery.mockResolvedValue(mockResult);
  
        await getPayInsDao(filters, company_id);
        
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringContaining('BETWEEN'),
          expect.arrayContaining([filters.startDate, filters.endDate])
        );
      });
  
      test('should handle database errors', async () => {
        const filters = {};
        const company_id = 'company123';
        const mockError = new Error('Database error');
        
        executeQuery.mockRejectedValue(mockError);
  
        await expect(getPayInsDao(filters, company_id)).rejects.toThrow(mockError);
        expect(logger.error).toHaveBeenCalledWith('Error getting PayIn URL:', mockError);
      });
    });
  
    describe('getAllPayInsDao', () => {
      test('should get all PayIns with filters for MERCHANT role', async () => {
        const filters = { status: 'completed' };
        const company_id = 'company123';
        const page = 1;
        const limit = 10;
        const role = 'MERCHANT';
        const mockResult = { rows: [{ id: 'payin123', status: 'completed' }] };
        
        executeQuery.mockResolvedValue(mockResult);
        tableName.PAYIN = 'Payin';
  
        const result = await getAllPayInsDao(filters, company_id, page, limit, role);
        
        expect(executeQuery).toHaveBeenCalled();
        expect(result).toEqual({ payins: mockResult.rows });
      });
  
      test('should handle updatedPayin filter', async () => {
        const filters = { updatedPayin: true };
        const company_id = 'company123';
        const mockResult = { rows: [{}] };
        
        executeQuery.mockResolvedValue(mockResult);
  
        await getAllPayInsDao(filters, company_id);
        
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringContaining("p.config::jsonb ? 'history'"),
          expect.any(Array)
        );
      });
  
      test('should handle database errors', async () => {
        const filters = {};
        const company_id = 'company123';
        const mockError = new Error('Database error');
        
        executeQuery.mockRejectedValue(mockError);
  
        await expect(getAllPayInsDao(filters, company_id)).rejects.toThrow(mockError);
        expect(logger.error).toHaveBeenCalledWith('Error getting PayIn URL:', mockError);
      });
    });
  
    describe('getPayinsBySearchDao', () => {
      test('should search PayIns with multiple terms', async () => {
        const filters = { company_id: 'company123' };
        const searchTerms = ['payin123', '100'];
        const limitNum = 10;
        const offset = 0;
        const role = 'ADMIN';
        const mockCountResult = { rows: [{ total: 1 }] };
        const mockSearchResult = { rows: [{ id: 'payin123', amount: 100 }] };
        
        executeQuery.mockResolvedValueOnce(mockCountResult)
                    .mockResolvedValueOnce(mockSearchResult);
        tableName.PAYIN = 'Payin';
  
        const result = await getPayinsBySearchDao(filters, searchTerms, limitNum, offset, role);
        
        expect(executeQuery).toHaveBeenCalledTimes(2);
        expect(result).toEqual({
          totalCount: 1,
          totalPages: 1,
          payins: mockSearchResult.rows
        });
      });
  
      test('should handle status filter', async () => {
        const filters = { company_id: 'company123', status: 'completed,pending' };
        const searchTerms = [];
        const mockCountResult = { rows: [{ total: 2 }] };
        const mockSearchResult = { rows: [{}, {}] };
        
        executeQuery.mockResolvedValueOnce(mockCountResult)
                    .mockResolvedValueOnce(mockSearchResult);
  
        await getPayinsBySearchDao(filters, searchTerms);
        
        expect(executeQuery.mock.calls[0][0]).toContain('p.status IN');
      });
  
      test('should handle updated_at date filter', async () => {
        const filters = { company_id: 'company123', updated_at: '01-01-2023' };
        const searchTerms = [];
        const mockCountResult = { rows: [{ total: 1 }] };
        const mockSearchResult = { rows: [{}] };
        
        executeQuery.mockResolvedValueOnce(mockCountResult)
                    .mockResolvedValueOnce(mockSearchResult);
  
        await getPayinsBySearchDao(filters, searchTerms);
        
        expect(executeQuery.mock.calls[0][0]).toContain('p.updated_at BETWEEN');
      });
  
      test('should handle invalid updated_at date format', async () => {
        const filters = { company_id: 'company123', updated_at: 'invalid-date' };
        const searchTerms = [];
        
        await expect(getPayinsBySearchDao(filters, searchTerms)).rejects.toThrow(
          'Invalid date format for updated_at'
        );
      });
  
      test('should handle database errors', async () => {
        const filters = { company_id: 'company123' };
        const searchTerms = ['payin123'];
        const mockError = new Error('Database error');
        
        executeQuery.mockRejectedValue(mockError);
  
        await expect(getPayinsBySearchDao(filters, searchTerms)).rejects.toThrow(mockError);
        expect(logger.error).toHaveBeenCalledWith('Error in getPayinSearch:', mockError);
      });
    });
  
    describe('getPayInUrlsDao', () => {
      test('should get multiple PayIn URLs with filters', async () => {
        const filters = { merchant_id: 'merchant123' };
        const mockResult = { rows: [{ id: 'payin1' }, { id: 'payin2' }] };
        
        executeQuery.mockResolvedValue(mockResult);
        tableName.PAYIN = 'Payin';
  
        const result = await getPayInUrlsDao(filters);
        
        expect(executeQuery).toHaveBeenCalled();
        expect(result).toEqual(mockResult.rows);
      });
  
      test('should handle empty filters for getPayInUrlsDao', async () => {
        const mockResult = { rows: [{}] };
        
        executeQuery.mockResolvedValue(mockResult);
  
        await getPayInUrlsDao();
        
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM "Payin" WHERE 1=1'),
          []
        );
      });
  
      test('should handle database errors', async () => {
        const filters = { merchant_id: 'merchant123' };
        const mockError = new Error('Database error');
        
        executeQuery.mockRejectedValue(mockError);
  
        await expect(getPayInUrlsDao(filters)).rejects.toThrow(mockError);
        expect(logger.error).toHaveBeenCalledWith('Error getting PayIn URLs:', mockError);
      });
    });
  
    describe('updatePayInUrlDao', () => {
      test('should update PayIn URL with connection', async () => {
        const id = 'payin123';
        const data = { status: 'completed' };
        const mockConn = { query: jest.fn().mockResolvedValue({ rows: [{}] }) };
        tableName.PAYIN = 'Payin';
  
        await updatePayInUrlDao(id, data, mockConn);
        
        expect(mockConn.query).toHaveBeenCalled();
      });
  
      test('should update PayIn URL without connection', async () => {
        const id = 'payin123';
        const data = { status: 'completed' };
        const mockResult = { rows: [{}] };
        
        executeQuery.mockResolvedValue(mockResult);
        tableName.PAYIN = 'Payin';
  
        await updatePayInUrlDao(id, data);
        
        expect(executeQuery).toHaveBeenCalled();
      });
  
      test('should handle database errors', async () => {
        const id = 'payin123';
        const data = { status: 'completed' };
        const mockError = new Error('Database error');
        
        executeQuery.mockRejectedValue(mockError);
  
        await expect(updatePayInUrlDao(id, data)).rejects.toThrow(mockError);
        expect(logger.error).toHaveBeenCalledWith('Error updating PayIn URL:', mockError);
      });
    });
  
    describe('getPayinDetailsByMerchantOrderId', () => {
        beforeEach(() => {
            jest.clearAllMocks();
            jest.spyOn(dbUtils, 'getConnection').mockResolvedValue(mockConn);
          });
        const mockConn = { query: jest.fn().mockResolvedValue({ rows: [{}] }) };
        it('should get PayIn details by merchant order ID', async () => {
            const merchantOrderId = 'order123';
            const mockResult = {
              rows: [{ payin_id: 'payin123', merchant_id: 'merchant123' }],
            };
            mockConn.query.mockResolvedValue(mockResult);
          
            const result = await getPayinDetailsByMerchantOrderId(merchantOrderId);
          
            expect(mockConn.query).toHaveBeenCalledWith(
              expect.any(String),
              [merchantOrderId]
            );
            expect(result).toEqual(mockResult.rows);
          });
  
      test('should throw BadRequestError for invalid merchantOrderId', async () => {
        await expect(getPayinDetailsByMerchantOrderId(null)).rejects.toThrow(BadRequestError);
        await expect(getPayinDetailsByMerchantOrderId(123)).rejects.toThrow(BadRequestError);
      });
  
      test('should handle database errors while fetching payin details of merchant', async () => {
        const merchantOrderId = 'order123';
        const mockError = new Error('Database error');
        const mockConn = { 
          query: jest.fn().mockRejectedValue(mockError),
          release: jest.fn() 
        };
        
        jest.spyOn(require('../../utils/db.js'), 'getConnection').mockResolvedValue(mockConn);
  
        await expect(getPayinDetailsByMerchantOrderId(merchantOrderId)).rejects.toThrow(mockError);
        expect(logger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Error fetching payin details for merchantOrderId ${merchantOrderId}`)
          );
          
      });
  
      test('should handle connection release errors', async () => {
        const merchantOrderId = 'order123';
        const mockResult = { rows: [{}] };
        const releaseError = new Error('Release failed');
        const mockConn = { 
          query: jest.fn().mockResolvedValue(mockResult),
          release: jest.fn().mockImplementation(() => {
            throw releaseError;
          }) 
        };
        
        jest.spyOn(require('../../utils/db.js'), 'getConnection').mockResolvedValue(mockConn);
      
        const result = await getPayinDetailsByMerchantOrderId(merchantOrderId);
        
        expect(result).toEqual(mockResult.rows);
        expect(logger.error).toHaveBeenCalledWith('Error releasing connection:', releaseError);
      });
    });
  });