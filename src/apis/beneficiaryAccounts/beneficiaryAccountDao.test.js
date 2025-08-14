import {
    getBeneficiaryAccountDao,
    getBeneficiaryAccountDaoAll,
    getBeneficiaryAccountBySearchDao,
    createBeneficiaryAccountDao,
    getBeneficiaryAccountDaoByBankName,
    updateBeneficiaryAccountDao,
    deleteBeneficiaryDao,
    checkBeneficiaryAccountExistsDao,
    updateBanktBalanceDao,
  } from './beneficiaryAccountDao.js';
  import { Role, tableName } from '../../constants/index.js';
  import {
    buildInsertQuery,
    buildUpdateQuery,
    buildAndExecuteUpdateQuery,
    executeQuery,
  } from '../../utils/db.js';
  import { logger } from '../../utils/logger.js';
  
  jest.mock('../../utils/db.js', () => ({
    buildInsertQuery: jest.fn(),
    buildUpdateQuery: jest.fn(),
    buildAndExecuteUpdateQuery: jest.fn(),
    executeQuery: jest.fn(),
  }));
  
  jest.mock('../../utils/logger.js', () => ({
    logger: {
      error: jest.fn(),
    },
  }));
  
  describe('Beneficiary Account DAO', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    describe('getBeneficiaryAccountDao', () => {
      test('should fetch beneficiary accounts with filters for ADMIN role', async () => {
        const filters = { company_id: 1, user_id: 2 };
        const page = 1;
        const limit = 10;
        const role = Role.ADMIN;
        const mockResult = { rows: [{ id: 1, bank_name: 'test_bank' }] };
        executeQuery.mockResolvedValue(mockResult);
  
        const result = await getBeneficiaryAccountDao(filters, page, limit, role);
  
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringMatching(/\s*SELECT[\s\S]*LIMIT \$1 OFFSET \$2;/),
          [10, 0, 1, 2]
        );
        
        expect(result).toEqual(mockResult.rows);
      });
  
      test('should apply pagination and MERCHANT role fields', async () => {
        const filters = { company_id: 1 };
        const page = 2;
        const limit = 5;
        const role = Role.MERCHANT;
        const mockResult = { rows: [{ id: 1, bank_name: 'test_bank' }] };
        executeQuery.mockResolvedValue(mockResult);
      
        const result = await getBeneficiaryAccountDao(filters, page, limit, role);
        const offset = (page - 1) * limit;
      
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringMatching(/SELECT[\s\S]*FROM\s+public\."BeneficiaryAccounts"/),
          [limit, offset, filters.company_id] // match DAO params
        );
      
        expect(result).toEqual(mockResult.rows);
      });
      
  
      test('should handle JSON filters correctly', async () => {
        const filters = { 'config->>is_enabled': 'true', company_id: 1 };
        const role = Role.VENDOR;
        const mockResult = { rows: [{ id: 1, bank_name: 'test_bank' }] };
        executeQuery.mockResolvedValue(mockResult);
  
        const result = await getBeneficiaryAccountDao(filters, null, null, role);
  
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringContaining(`bea.config->>'is_enabled' = $1`),
          ['true', 1]
        );
        expect(result).toEqual(mockResult.rows);
      });
  
      test('should throw error on query failure', async () => {
        const error = new Error('DB error');
        executeQuery.mockRejectedValue(error);
  
        await expect(getBeneficiaryAccountDao({}, null, null, Role.ADMIN))
          .rejects.toEqual(error);
        expect(logger.error).toHaveBeenCalledWith('Error in get BeneficiaryAccount Dao:', error);
      });
    });
  
    describe('checkBeneficiaryAccountExistsDao', () => {
      test('should check if beneficiary account exists', async () => {
        const filters = { acc_no: '123', company_id: 1 };
        const mockResult = { rows: [{ 1: 1 }] };
        executeQuery.mockResolvedValue(mockResult);
      
        const result = await checkBeneficiaryAccountExistsDao(filters);
      
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringMatching(/SELECT 1[\s\S]*FROM\s+public\."BeneficiaryAccounts"/),
          [filters.acc_no, filters.company_id]
        );
      
        expect(result).toBe(true);
      });
      
  
      test('should return false if account does not exist', async () => {
        const filters = { acc_no: '123', company_id: 1 };
        const mockResult = { rows: [] };
        executeQuery.mockResolvedValue(mockResult);
  
        const result = await checkBeneficiaryAccountExistsDao(filters);
  
        expect(result).toBe(false);
      });
  
      test('should throw error if filters are missing', async () => {
        const filters = { acc_no: '123' };
        await expect(checkBeneficiaryAccountExistsDao(filters))
          .rejects.toThrow('Missing acc_no or company_id in filters');
        expect(logger.error).toHaveBeenCalled();
      });
    });
  
    describe('getBeneficiaryAccountDaoAll', () => {
      test('should fetch all beneficiary accounts with array filters', async () => {
        const filters = { user_id: [[1, 2, 3]], company_id: 1 };
        const page = 1;
        const limit = 10;
        const role = Role.ADMIN;
        const mockResult = { rows: [{ id: 1, bank_name: 'test_bank' }] };
        executeQuery.mockResolvedValue(mockResult);
      
        const result = await getBeneficiaryAccountDaoAll(filters, page, limit, role);
      
        const offset = (page - 1) * limit;
      
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringMatching(/SELECT[\s\S]*FROM\s+public\."BeneficiaryAccounts"/),
          [limit, offset, [1, 2, 3], filters.company_id]
        );
      
        expect(result).toEqual(mockResult.rows);
      });
      
  
      test('should handle VENDOR role fields', async () => {
        const filters = { company_id: 1 };
        const role = Role.VENDOR;
        const mockResult = { rows: [{ id: 1, bank_name: 'test_bank' }] };
        executeQuery.mockResolvedValue(mockResult);
      
        const result = await getBeneficiaryAccountDaoAll(filters, null, null, role);
      
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringMatching(/SELECT[\s\S]*FROM\s+public\."BeneficiaryAccounts"/),
          [filters.company_id]
        );
      
        expect(result).toEqual(mockResult.rows);
      });
      
    });
  
    describe('getBeneficiaryAccountBySearchDao', () => {
      test('should fetch accounts with search terms for ADMIN role', async () => {
        const filters = { company_id: 1 };
        const page = 1;
        const limit = 10;
        const role = Role.ADMIN;
        const searchTerms = ['test', 'bank'];
        const mockCountResult = { rows: [{ total: '20' }] };
        const mockSearchResult = { rows: [{ id: 1, bank_name: 'test_bank' }] };
        executeQuery
          .mockResolvedValueOnce(mockCountResult)
          .mockResolvedValueOnce(mockSearchResult);
  
        const result = await getBeneficiaryAccountBySearchDao(filters, page, limit, role, searchTerms);
  
        expect(executeQuery).toHaveBeenCalledTimes(2);
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringContaining('LOWER(bea.id::text) LIKE LOWER($2)'),
          [1, '%test%', '%bank%', 10, 0]
        );
        expect(result).toEqual({
          totalCount: 20,
          totalPages: 2,
          bankAccounts: mockSearchResult.rows,
        });
      });
  
      test('should handle empty search results with pagination fallback', async () => {
        const filters = { company_id: 1 };
        const page = 2;
        const limit = 10;
        const role = Role.ADMIN;
        const searchTerms = ['test'];
        const mockCountResult = { rows: [{ total: '5' }] };
        const mockSearchResult = { rows: [] };
        const mockFallbackResult = { rows: [{ id: 1, bank_name: 'test_bank' }] };
        executeQuery
          .mockResolvedValueOnce(mockCountResult)
          .mockResolvedValueOnce(mockSearchResult)
          .mockResolvedValueOnce(mockFallbackResult);
  
        const result = await getBeneficiaryAccountBySearchDao(filters, page, limit, role, searchTerms);
  
        expect(executeQuery).toHaveBeenCalledTimes(3);
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringContaining('OFFSET $4'),
          [1, '%test%', 10, 0]
        );
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringContaining('SELECT COUNT(*) as total'),
          [1, '%test%']
        );
        expect(result).toEqual({
          totalCount: 5,
          totalPages: 1,
          bankAccounts: mockFallbackResult.rows,
        });
      });
    });
  
    describe('createBeneficiaryAccountDao', () => {
      test('should create beneficiary account', async () => {
        const payload = { acc_no: '123', company_id: 1 };
        const mockResult = { rows: [{ id: 1 }] };
        buildInsertQuery.mockReturnValue(['INSERT INTO BeneficiaryAccounts', [payload.acc_no, payload.company_id]]);
        const conn = { query: jest.fn().mockResolvedValue(mockResult) };
  
        const result = await createBeneficiaryAccountDao(conn, payload);
  
        expect(buildInsertQuery).toHaveBeenCalledWith(tableName.BENEFICIARY_ACCOUNTS, payload);
        expect(conn.query).toHaveBeenCalledWith('INSERT INTO BeneficiaryAccounts', [payload.acc_no, payload.company_id]);
        expect(result).toEqual(mockResult.rows[0]);
      });
  
      test('should throw error on failure', async () => {
        const payload = { acc_no: '123' };
        const error = new Error('DB error');
        buildInsertQuery.mockReturnValue(['INSERT INTO BeneficiaryAccounts', ['123']]);
        const conn = { query: jest.fn().mockRejectedValue(error) };
  
        await expect(createBeneficiaryAccountDao(conn, payload)).rejects.toEqual(error);
        expect(logger.error).toHaveBeenCalledWith(error);
      });
    });
  
    describe('getBeneficiaryAccountDaoByBankName', () => {
      test('should fetch bank names with filters', async () => {
        const company_id = 1;
        const type = 'savings';
        const filters = { user_id: [1] };
        const mockResult = { rowCount: 2, rows: [{ label: 'Bank A', value: 1 }] };
        const conn = { query: jest.fn().mockResolvedValue(mockResult) };
  
        const result = await getBeneficiaryAccountDaoByBankName(conn, company_id, type, filters);
  
        expect(conn.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT bank_name AS label, id AS value'),
          [1]
        );
        expect(result).toEqual({ totalCount: 2, bankNames: mockResult.rows });
      });
  
      test('should handle empty filters', async () => {
        const company_id = 1;
        const type = 'savings';
        const filters = {};
        const mockResult = { rowCount: 0, rows: [] };
        const conn = { query: jest.fn().mockResolvedValue(mockResult) };
  
        const result = await getBeneficiaryAccountDaoByBankName(conn, company_id, type, filters);
  
        expect(conn.query).toHaveBeenCalledWith(
          expect.stringContaining('is_obsolete = false'),
          []
        );
        expect(result).toEqual({ totalCount: 0, bankNames: [] });
      });
    });
  
    describe('updateBeneficiaryAccountDao', () => {
      test('should update beneficiary account', async () => {
        const id = { id: '1', company_id: 1 };
        const payload = { acc_no: '123' };
        const mockResult = { id: 1 };
        buildAndExecuteUpdateQuery.mockResolvedValue(mockResult);
        const conn = {};
  
        const result = await updateBeneficiaryAccountDao(id, payload, conn);
  
        expect(buildAndExecuteUpdateQuery).toHaveBeenCalledWith(
          tableName.BENEFICIARY_ACCOUNTS,
          payload,
          id,
          {},
          { returnUpdated: true },
          conn
        );
        expect(result).toEqual(mockResult);
      });
  
      test('should throw error on failure', async () => {
        const id = { id: '1', company_id: 1 };
        const payload = { acc_no: '123' };
        const error = new Error('DB error');
        buildAndExecuteUpdateQuery.mockRejectedValue(error);
  
        await expect(updateBeneficiaryAccountDao(id, payload, {})).rejects.toEqual(error);
        expect(logger.error).toHaveBeenCalledWith('Error in updateBeneficiaryAccountDao:', error);
      });
    });
  
    describe('deleteBeneficiaryDao', () => {
      test('should delete beneficiary account with connection', async () => {
        const id = { id: '1', company_id: 1 };
        const data = { is_obsolete: true };
        const mockResult = { rows: [{ id: 1 }] };
        buildUpdateQuery.mockReturnValue(['UPDATE BeneficiaryAccounts', ['true', '1', 1]]);
        const conn = { query: jest.fn().mockResolvedValue(mockResult) };
  
        const result = await deleteBeneficiaryDao(conn, id, data);
  
        expect(buildUpdateQuery).toHaveBeenCalledWith(tableName.BENEFICIARY_ACCOUNTS, data, id);
        expect(conn.query).toHaveBeenCalledWith('UPDATE BeneficiaryAccounts', ['true', '1', 1]);
        expect(result).toEqual(mockResult.rows[0]);
      });
  
      test('should use executeQuery without connection', async () => {
        const id = { id: '1', company_id: 1 };
        const data = { is_obsolete: true };
        const mockResult = { rows: [{ id: 1 }] };
        buildUpdateQuery.mockReturnValue(['UPDATE BeneficiaryAccounts', ['true', '1', 1]]);
        executeQuery.mockResolvedValue(mockResult);
  
        const result = await deleteBeneficiaryDao(null, id, data);
  
        expect(executeQuery).toHaveBeenCalledWith('UPDATE BeneficiaryAccounts', ['true', '1', 1]);
        expect(result).toEqual(mockResult.rows[0]);
      });
    });
  
    describe('updateBanktBalanceDao', () => {
      test('should update bank balance with connection', async () => {
        const filters = { id: '1' };
        const amount = 100;
        const updated_by = 1;
        const mockResult = { rows: [{ id: 1 }] };
        buildUpdateQuery.mockReturnValue(['UPDATE BeneficiaryAccounts', [100, 100, 1, '1']]);
        const conn = { query: jest.fn().mockResolvedValue(mockResult) };
  
        const result = await updateBanktBalanceDao(filters, amount, updated_by, conn);
  
        expect(buildUpdateQuery).toHaveBeenCalledWith(
          tableName.BENEFICIARY_ACCOUNTS,
          { balance: 100, today_balance: 100, updated_by: 1 },
          filters,
          { balance: '+', today_balance: '+' }
        );
        expect(conn.query).toHaveBeenCalledWith('UPDATE BeneficiaryAccounts', [100, 100, 1, '1']);
        expect(result).toEqual(mockResult.rows[0]);
      });
  
      test('should use executeQuery without connection', async () => {
        const filters = { id: '1' };
        const amount = 100;
        const updated_by = 1;
        const mockResult = { rows: [{ id: 1 }] };
        buildUpdateQuery.mockReturnValue(['UPDATE BeneficiaryAccounts', [100, 100, 1, '1']]);
        executeQuery.mockResolvedValue(mockResult);
  
        const result = await updateBanktBalanceDao(filters, amount, updated_by, null);
  
        expect(executeQuery).toHaveBeenCalledWith('UPDATE BeneficiaryAccounts', [100, 100, 1, '1']);
        expect(result).toEqual(mockResult.rows[0]);
      });
    });
  });