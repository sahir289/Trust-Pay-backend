const { getTotalCountDao } = require('./commonDao.js');
const { executeQuery } = require('../../utils/db');
const { BadRequestError } = require('../../utils/appErrors');
const { logger } = require('../../utils/logger');
const { Role, tableName } = require('../../constants');

jest.mock('../../utils/logger');
jest.mock('../../utils/db.js');

describe('getTotalCountDao', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw BadRequestError for invalid table name', async () => {
    const invalidTableName = 'invalid-table-name!';

    await expect(
      getTotalCountDao(invalidTableName, 'Merchant', {})
    ).rejects.toThrow(BadRequestError);
    await expect(
      getTotalCountDao(invalidTableName, 'Merchant', {})
    ).rejects.toThrow(`Invalid table name: ${invalidTableName}`);
  });

  it('should construct query for BENEFICIARY_ACCOUNTS table with non-merchant role', async () => {
    const mockResult = { rows: [{ count: '10' }] };
    executeQuery.mockResolvedValue(mockResult);

    const result = await getTotalCountDao(
      'BeneficiaryAccounts',
      Role.ADMIN,
      {}
    );

    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringMatching(/SELECT COUNT\(DISTINCT "BeneficiaryAccounts"\.acc_no\) AS count/),
      [Role.ADMIN]
    );
    expect(result).toBe(10);
  });

  it('should construct query for MERCHANT table with ADMIN role', async () => {
    const mockResult = { rows: [{ count: '5' }] };
    executeQuery.mockResolvedValue(mockResult);

    const filters = { company_id: '123' };
    const result = await getTotalCountDao(
      tableName.MERCHANT,
      'Merchant',
      filters,
      Role.ADMIN
    );

    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringMatching(/JOIN "User" ON "Merchant"\.user_id = "User"\.id/),
      ['123', 'Merchant']
    );
    expect(result).toBe(5);
  });

  it('should handle user_ids filter with joins', async () => {
    const mockResult = { rows: [{ count: '8' }] };
    executeQuery.mockResolvedValue(mockResult);
  
    const filters = { user_ids: ['user1', 'user2'] };
    const result = await getTotalCountDao(
      'BeneficiaryAccounts',
      'Merchant',
      filters
    );
  
    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringMatching(
        /LEFT JOIN "BankAccount" ON "BeneficiaryAccounts"\.bank_acc_id = "BankAccount"\.id[\s\S]*LEFT JOIN "Vendor" ON "BankAccount"\.user_id = "Vendor"\.user_id[\s\S]*AND "Vendor"\.user_id = ANY\(\$1\)/
      ),
      [['user1', 'user2'], 'Merchant']
    );
    expect(result).toBe(8);
  });

  it('should handle updated filter', async () => {
    const mockResult = { rows: [{ count: '3' }] };
    executeQuery.mockResolvedValue(mockResult);

    const result = await getTotalCountDao(
      'BeneficiaryAccounts',
      'Merchant',
      {},
      null,
      true
    );

    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringMatching(/AND "BeneficiaryAccounts"\.updated_at IS NOT NULL/),
      ['Merchant']
    );
    expect(result).toBe(3);
  });

  it('should handle updatedPayin filter', async () => {
    const mockResult = { rows: [{ count: '4' }] };
    executeQuery.mockResolvedValue(mockResult);

    const result = await getTotalCountDao(
      'BeneficiaryAccounts',
      'Merchant',
      {},
      null,
      false,
      true
    );

    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringMatching(/AND "BeneficiaryAccounts"\.config->>'history' IS NOT NULL/),
      ['Merchant']
    );
    expect(result).toBe(4);
  });

  it('should handle date range filter', async () => {
    const mockResult = { rows: [{ count: '6' }] };
    executeQuery.mockResolvedValue(mockResult);

    const filters = {
      startDate: '2023-01-01',
      endDate: '2023-12-31'
    };
    const result = await getTotalCountDao(
      'BeneficiaryAccounts',
      'Merchant',
      filters
    );

    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('AND created_at BETWEEN $2 AND $3'),
      ['Merchant', '2023-01-01', '2023-12-31']
    );
    expect(result).toBe(6);
  });

  it('should handle user_id array filter', async () => {
    const mockResult = { rows: [{ count: '7' }] };
    executeQuery.mockResolvedValue(mockResult);

    const filters = { user_id: ['user1', 'user2'] };
    const result = await getTotalCountDao(
      'BeneficiaryAccounts',
      'Merchant',
      filters
    );

    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringMatching(/AND "BeneficiaryAccounts"\.user_id = ANY\(\$2\)/),
      ['Merchant', ['user1', 'user2']]
    );
    expect(result).toBe(7);
  });

  it('should handle dynamic filters with array values', async () => {
    const mockResult = { rows: [{ count: '9' }] };
    executeQuery.mockResolvedValue(mockResult);

    const filters = { status: ['active', 'pending'] };
    const result = await getTotalCountDao(
      'BeneficiaryAccounts',
      'Merchant',
      filters
    );

    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringMatching(/AND "BeneficiaryAccounts"\."status" IN \(\$2,\$3\)/),
      ['Merchant', 'active', 'pending']
    );
    expect(result).toBe(9);
  });

  it('should handle JSON field filter', async () => {
    const mockResult = { rows: [{ count: '2' }] };
    executeQuery.mockResolvedValue(mockResult);
  
    const filters = { 'config->>key': 'value' };
    const result = await getTotalCountDao(
      'BeneficiaryAccounts',
      'Merchant',
      filters
    );
  
    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringMatching(/AND "BeneficiaryAccounts"\.config->>'key' = \$2/),
      ['Merchant', 'value']
    );
    expect(result).toBe(2);
  });

  it('should log and throw error for non-existent table', async () => {
    const error = { code: '42P01' };
    executeQuery.mockRejectedValue(error);

    await expect(getTotalCountDao('BeneficiaryAccounts', 'Merchant', {})).rejects.toMatchObject({
      code: '42P01',
    });
    expect(logger.error).toHaveBeenCalledWith(
      `Table "BeneficiaryAccounts" does not exist in the database.`
    );
  });

  it('should log and throw error for non-existent column', async () => {
    const error = { code: '42703' };
    executeQuery.mockRejectedValue(error);

    await expect(getTotalCountDao('BeneficiaryAccounts', 'Merchant', {})).rejects.toMatchObject({
      code: '42703',
    });
    expect(logger.error).toHaveBeenCalledWith(
      `Column updated_at or created_at does not exist in table "BeneficiaryAccounts".`
    );
  });

  it('should log and throw generic error', async () => {
    const error = new Error('Database error');
    executeQuery.mockRejectedValue(error);

    await expect(
      getTotalCountDao('BeneficiaryAccounts', 'Merchant', {})
    ).rejects.toThrow(error);
    expect(logger.error).toHaveBeenCalledWith(
      `Error fetching total count for table ${'BeneficiaryAccounts'}:`,
      error
    );
  });
});