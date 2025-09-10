const {
  generatePayInUrlDao,
  getPayInsForCronDao, // Changed from getPayInCronDao
  getPayInwithMerchantDao,
  getPayInPendingDao,
  getPayInDaoByCode,
  updatePayInUrlDao,
  getPayinDetailsByMerchantOrderId,
} = require('./payinDao');

const { tableName } = require('../../constants/index.js');
const { BadRequestError } = require('../../utils/appErrors.js');
const { executeQuery } = require('../../utils/db.js');
const { logger } = require('../../utils/logger.js');


// Mock dayjs for tests
jest.mock('dayjs', () => {
  const originalDayjs = jest.requireActual('dayjs');
  originalDayjs.extend(require('dayjs/plugin/utc'));
  originalDayjs.extend(require('dayjs/plugin/timezone'));
  return originalDayjs;
});
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

  describe('getPayInsForCronDao', () => {
    it('should get PayIn data with filters and date range', async () => {
      const filters = { status: 'pending' };
      const startDate = '2023-01-01';
      const endDate = '2023-01-31';
      const mockResult = { rows: [{ id: 'payin123', status: 'pending' }] };

      require('../../utils/db.js').executeQuery.mockResolvedValue(mockResult);
      tableName.PAYIN = 'Payin';

      // Merge date range into filters
      const updatedFilters = {
        ...filters,
        created_at: { startDate, endDate }, // Assumes buildSelectQuery handles this format
      };

      const result = await getPayInsForCronDao(updatedFilters);

      expect(require('../../utils/db.js').buildSelectQuery).toHaveBeenCalled();
      expect(result).toEqual(mockResult.rows);
    });

    test('should get PayIn data without date range', async () => {
      const filters = { status: 'pending' };
      const mockResult = { rows: [{ id: 'payin123', status: 'pending' }] };

      executeQuery.mockResolvedValue(mockResult);
      tableName.PAYIN = 'Payin';

      const result = await getPayInsForCronDao(filters);

      expect(executeQuery).toHaveBeenCalled();
      expect(result).toEqual(mockResult.rows);
    });

    test('should handle database errors', async () => {
      const filters = { status: 'pending' };
      const mockError = new Error('Database error');

      executeQuery.mockRejectedValue(mockError);

      await expect(getPayInsForCronDao(filters)).rejects.toThrow(mockError);
      expect(logger.error).toHaveBeenCalledWith('Error getting PayIns for cron:', mockError);
    });

    test('should return empty array when no PayIn records found', async () => {
      const filters = { status: 'pending' };
      const mockResult = { rows: [] };

      executeQuery.mockResolvedValue(mockResult);
      tableName.PAYIN = 'Payin';

      const result = await getPayInsForCronDao(filters);

      expect(result).toEqual([]);
    });
  });

  describe('getPayInwithMerchantDao', () => {
    test('should get PayIn data with merchant and company details', async () => {
      const filters = 'order123';
      const mockResult = {
        rows: [
          {
            merchant_order_id: 'order123',
            status: 'completed',
            merchant_id: 'merchant123',
          },
        ],
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

      expect(executeQuery).toHaveBeenCalledWith(expect.any(String), ['order123', 'order456']);
    });

    test('should handle database errors', async () => {
      const filters = 'order123';
      const mockError = new Error('Database error');

      executeQuery.mockRejectedValue(mockError);

      await expect(getPayInwithMerchantDao(filters)).rejects.toThrow(mockError);
      expect(logger.error).toHaveBeenCalledWith(
        'Error getting PayIn URL with merchant and company config:',
        mockError,
      );
    });
  });

  describe('getPayInPendingDao', () => {
    test('should get pending PayIn data for a company', async () => {
      const company_id = 'company123';
      const status = 'pending';
      const mockResult = {
        rows: [
          {
            id: 'payin123',
            company_id: 'company123',
            status: 'pending',
          },
        ],
      };

      executeQuery.mockResolvedValue(mockResult);
      tableName.PAYIN = 'Payin';
      tableName.MERCHANT = 'Merchant';

      const result = await getPayInPendingDao({ company_id, status });

      expect(executeQuery).toHaveBeenCalledWith(expect.stringContaining('SELECT'), [
        company_id,
        status,
      ]);
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
        ['payin123', 'company123'],
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
      jest.spyOn(require('../../utils/db.js'), 'getConnection').mockResolvedValue(mockConn);
    });
    const mockConn = { query: jest.fn().mockResolvedValue({ rows: [{}] }) };

    it('should get PayIn details by merchant order ID', async () => {
      const merchantOrderId = 'order123';
      const mockResult = {
        rows: [{ payin_id: 'payin123', merchant_id: 'merchant123' }],
      };
      mockConn.query.mockResolvedValue(mockResult);

      const result = await getPayinDetailsByMerchantOrderId(merchantOrderId);

      expect(mockConn.query).toHaveBeenCalledWith(expect.any(String), [merchantOrderId]);
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
        release: jest.fn(),
      };

      jest.spyOn(require('../../utils/db.js'), 'getConnection').mockResolvedValue(mockConn);

      await expect(getPayinDetailsByMerchantOrderId(merchantOrderId)).rejects.toThrow(mockError);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Error fetching payin details for merchantOrderId ${merchantOrderId}`),
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
        }),
      };

      jest.spyOn(require('../../utils/db.js'), 'getConnection').mockResolvedValue(mockConn);

      const result = await getPayinDetailsByMerchantOrderId(merchantOrderId);

      expect(result).toEqual(mockResult.rows);
      expect(logger.error).toHaveBeenCalledWith('Error releasing connection:', releaseError);
    });
  });
});