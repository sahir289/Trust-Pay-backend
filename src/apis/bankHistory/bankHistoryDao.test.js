const { getBankHistoryDao, createBankHistoryDao } = require('./bankHistoryDao');
const { executeQuery } = require('../../utils/db');
const { logger } = require('../../utils/logger');
const { BadRequestError } = require('../../utils/appErrors');

jest.mock('../../utils/db');
jest.mock('../../utils/logger');
jest.mock('../../utils/appErrors');
jest.mock('../../constants/index', () => ({
  tableName: {
    BANK_HISTORY: 'bank_history',
  },
}));
jest.mock('../../utils/appErrors', () => ({
    BadRequestError: class extends Error {
      constructor(message) {
        super(message);
        this.name = 'BadRequestError';
      }
    },
  }));

describe('Bank History DAO', () => {
  describe('getBankHistoryDao', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should throw BadRequestError if bank_account_id is missing', async () => {
      const filters = { date: '2023-10-01' };
      await expect(getBankHistoryDao(filters)).rejects.toThrow(BadRequestError);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error in getBankHistoryDao'),
        expect.any(Object)
      );
    });

    it('should throw BadRequestError if date is missing', async () => {
      const filters = { bank_account_id: 123 };
      await expect(getBankHistoryDao(filters)).rejects.toThrow(BadRequestError);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error in getBankHistoryDao'),
        expect.any(Object)
      );
    });

    it('should execute correct SQL query with parameters', async () => {
      const filters = { bank_account_id: 123, date: '2023-10-01' };
      const mockRows = [{ count: 10, today_balance: 1000 }];
      executeQuery.mockResolvedValue({ rows: mockRows });

      const result = await getBankHistoryDao(filters);

      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringMatching(
          /SELECT count , today_balance FROM "bank_history"\s+WHERE DATE\(created_at\) = \$1\s+AND bank_account_id = \$2\s+AND is_obsolete = false\s+ORDER BY created_at DESC/
        ),
        ['2023-10-01', 123]
      );
      expect(result).toEqual(mockRows);
    });

    it('should handle database errors and log them', async () => {
      const filters = { bank_account_id: 123, date: '2023-10-01' };
      const error = new Error('Database error');
      executeQuery.mockRejectedValue(error);

      await expect(getBankHistoryDao(filters)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith(
        `Error in getBankHistoryDao: ${error.message}`,
        { errorMetadata: error }
      );
    });
  });

  describe('createBankHistoryDao', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should execute insert query with connection when provided', async () => {
      const data = { bank_account_id: 123, count: 10, today_balance: 1000 };
      const mockConn = { query: jest.fn().mockResolvedValue({ rows: [data] }) };
      const mockSql = `INSERT INTO "bank_history" (bank_account_id, count, today_balance) VALUES ($1, $2, $3) RETURNING *`;
      require('../../utils/db').buildInsertQuery.mockReturnValue([mockSql, [123, 10, 1000]]);

      const result = await createBankHistoryDao(data, mockConn);

      expect(mockConn.query).toHaveBeenCalledWith(
        expect.stringMatching(
          /INSERT INTO "bank_history"\s*\(bank_account_id, count, today_balance\)\s*VALUES\s*\(\$1, \$2, \$3\)\s*RETURNING \*/
        ),
        [123, 10, 1000]
      );
      expect(result).toEqual(data);
    });

    it('should execute insert query without connection when not provided', async () => {
      const data = { bank_account_id: 123, count: 10, today_balance: 1000 };
      const mockSql = `INSERT INTO "bank_history" (bank_account_id, count, today_balance) VALUES ($1, $2, $3) RETURNING *`;
      require('../../utils/db').buildInsertQuery.mockReturnValue([mockSql, [123, 10, 1000]]);
      executeQuery.mockResolvedValue({ rows: [data] });

      const result = await createBankHistoryDao(data);

      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringMatching(
          /INSERT INTO "bank_history"\s*\(bank_account_id, count, today_balance\)\s*VALUES\s*\(\$1, \$2, \$3\)\s*RETURNING \*/
        ),
        [123, 10, 1000]
      );
      expect(result).toEqual(data);
    });

    it('should handle and log database errors', async () => {
      const data = { bank_account_id: 123, count: 10, today_balance: 1000 };
      const error = new Error('Database error');
      require('../../utils/db').buildInsertQuery.mockReturnValue([
        `INSERT INTO "bank_history" (bank_account_id, count, today_balance) VALUES ($1, $2, $3) RETURNING *`,
        [123, 10, 1000],
      ]);
      executeQuery.mockRejectedValue(error);

      await expect(createBankHistoryDao(data)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error in createBankHistoryDao:', error);
    });
  });
});