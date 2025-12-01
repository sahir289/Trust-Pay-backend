import {
  createVendorDao,
  getVendorCodeDao,
  getVendorsBankReponseDao,
  getVendorsDashBoardReportDao,
  getVendorsCodeDao,
  getVendorsDao,
  getAllVendorsDao,
  getVendorsBySearchDao,
  updateVendorDao,
  deleteVendorDao,
  updateVendorBalanceDao,
  getVendorsDaoArray,
  getBankResponseAccessByIDDao,
  getVendorByCodeDao,
  getVendorByUserDao,
  getDesignationIdDao,
  isNetBalanceZeroForTwoHours,
  linkVendorDao,
  unlinkVendorDao,
  transferVendorDao,
  getVendorByUserId,
} from './vendorDao.js';
import { Role, tableName } from '../../constants/index.js';
import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { enhanceVendorsWithSubVendors } from '../../utils/enhanceSubVendor.js';
import { getUserHierarchyVendor, updateUserHierarchyVendor } from '../userHierarchy/userHierarchyDao.js';

jest.mock('../../utils/db.js');
jest.mock('../../utils/enhanceSubVendor.js');

jest.mock('../../utils/logger.js', () => ({
  logger: {
    error: jest.fn(),
    log: jest.fn(),
  },
}));

jest.mock('../userHierarchy/userHierarchyDao.js');
// Mock the internal functions by mocking executeQuery
// Since getVendorCode, getVendorConfig, buildSubCode, updateVendorConfig are not exported,
// we'll mock executeQuery to handle their calls

describe('Vendor DAO', () => {
  const mockConn = {
    query: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    buildSelectQuery.mockImplementation((selectClause, filters, page, pageSize, sortField, sortOrder, table) => {
      if (table === 'Vendor') {
        return [
          `SELECT "Vendor".id, ... FROM "Vendor" JOIN "User" AS user_main ON "Vendor".user_id = user_main.id ... WHERE "Vendor".is_obsolete = false AND "Vendor"."company_id" = $1 ...`,
          [filters.company_id]
        ];
      }
      return ['', []];
    });
    enhanceVendorsWithSubVendors.mockResolvedValue([]);
  });

  describe('createVendorDao', () => {
    test('should create a vendor successfully with connection', async () => {
      const data = { name: 'Vendor A', company_id: 'comp1', user_id: 'user1' };
      const mockResult = { rows: [{ id: 'vendor1' }] };
      buildInsertQuery.mockReturnValue(['INSERT INTO "Vendor" (name, company_id, user_id) VALUES ($1, $2, $3) RETURNING *', ['Vendor A', 'comp1', 'user1']]);
      mockConn.query.mockResolvedValue(mockResult);

      const result = await createVendorDao(data, mockConn);

      expect(buildInsertQuery).toHaveBeenCalledWith(tableName.VENDOR, data);
      expect(mockConn.query).toHaveBeenCalledWith(
        'INSERT INTO "Vendor" (name, company_id, user_id) VALUES ($1, $2, $3) RETURNING *',
        ['Vendor A', 'comp1', 'user1']
      );
      expect(result).toEqual({ id: 'vendor1' });
    });

    test('should create a vendor successfully without connection', async () => {
      const data = { name: 'Vendor A', company_id: 'comp1', user_id: 'user1' };
      const mockResult = { rows: [{ id: 'vendor1' }] };
      buildInsertQuery.mockReturnValue(['INSERT INTO "Vendor" (name, company_id, user_id) VALUES ($1, $2, $3) RETURNING *', ['Vendor A', 'comp1', 'user1']]);
      executeQuery.mockResolvedValue(mockResult);

      const result = await createVendorDao(data);

      expect(buildInsertQuery).toHaveBeenCalledWith(tableName.VENDOR, data);
      expect(executeQuery).toHaveBeenCalledWith(
        'INSERT INTO "Vendor" (name, company_id, user_id) VALUES ($1, $2, $3) RETURNING *',
        ['Vendor A', 'comp1', 'user1']
      );
      expect(result).toEqual({ id: 'vendor1' });
    });

    test('should throw error on database failure', async () => {
      const data = { name: 'Vendor A', company_id: 'comp1', user_id: 'user1' };
      const error = new Error('Database error');
      buildInsertQuery.mockReturnValue(['INSERT INTO "Vendor" (name, company_id, user_id) VALUES ($1, $2, $3) RETURNING *', ['Vendor A', 'comp1', 'user1']]);
      executeQuery.mockRejectedValue(error);

      await expect(createVendorDao(data)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error in create Vendor Dao:', error);
    });
  });

  describe('getVendorCodeDao', () => {
    test('should fetch vendor code by id successfully', async () => {
      const id = 'vendor1';
      const mockResult = { rows: [{ code: 'V001' }] };
      executeQuery.mockResolvedValue(mockResult);

      const result = await getVendorCodeDao(id);

      expect(executeQuery).toHaveBeenCalledWith(
        `SELECT code FROM "${tableName.VENDOR}" WHERE id = $1`,
        [id]
      );
      expect(result).toEqual({ code: 'V001' });
    });

    test('should return null if no vendor found', async () => {
      const id = 'vendor1';
      const mockResult = { rows: [] };
      executeQuery.mockResolvedValue(mockResult);

      const result = await getVendorCodeDao(id);

      expect(executeQuery).toHaveBeenCalledWith(
        `SELECT code FROM "${tableName.VENDOR}" WHERE id = $1`,
        [id]
      );
      expect(result).toBeNull();
    });

    test('should throw error on database failure', async () => {
      const id = 'vendor1';
      const error = new Error('Database error');
      executeQuery.mockRejectedValue(error);

      await expect(getVendorCodeDao(id)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error fetching vendor by ID:', error);
    });
  });

  describe('getVendorsBankReponseDao', () => {
    test('should fetch vendors bank response data successfully', async () => {
      const filters = { company_id: 'comp1' };
      const mockResult = { rows: [{ id: 'vendor1', balance: 100 }] };
      executeQuery.mockResolvedValue(mockResult);

      const result = await getVendorsBankReponseDao(filters);
      expect(executeQuery).toHaveBeenCalledWith(expect.stringContaining('FROM "Vendor"'), expect.any(Array));
      expect(result).toEqual([{ id: 'vendor1', balance: 100 }]);
    });

    test('should return empty array if no data', async () => {
      const filters = { company_id: 'comp1' };
      const mockResult = { rows: [] };
      buildSelectQuery.mockReturnValue([
        `SELECT id, user_id, code, balance, payin_commission FROM "${tableName.VENDOR}" WHERE 1=1 AND company_id = $1`,
        [filters.company_id]
      ]);
      executeQuery.mockResolvedValue(mockResult);

      const result = await getVendorsBankReponseDao(filters);

      expect(result).toEqual([]);
    });

    test('should throw error on database failure', async () => {
      const filters = { company_id: 'comp1' };
      const error = new Error('Database error');
      buildSelectQuery.mockReturnValue([
        `SELECT id, user_id, code, balance, payin_commission FROM "${tableName.VENDOR}" WHERE 1=1 AND company_id = $1`,
        [filters.company_id]
      ]);
      executeQuery.mockRejectedValue(error);

      await expect(getVendorsBankReponseDao(filters)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error fetching vendor data:', error);
    });
  });

  describe('getVendorsDashBoardReportDao', () => {
    test('should fetch vendors dashboard report data successfully', async () => {
      const filters = { company_id: 'comp1' };
      const mockResult = { rows: [{ user_id: 'user1', code: 'V001' }] };
      buildSelectQuery.mockReturnValue([
        `SELECT 
user_id,
code
FROM "${tableName.VENDOR}" WHERE 1=1 AND company_id = $1`,
        [filters.company_id]
      ]);
      executeQuery.mockResolvedValue(mockResult);

      const result = await getVendorsDashBoardReportDao(filters);

      expect(buildSelectQuery).toHaveBeenCalledWith(
        expect.stringMatching(/SELECT\s+user_id\s*,\s*code\s+FROM\s+"Vendor"\s+WHERE\s+1=1/),
        filters
      );
      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringMatching(/SELECT\s+user_id\s*,\s*code\s+FROM\s+"Vendor"\s+WHERE\s+1=1\s+AND\s+company_id\s+=\s+\$1/),
        [filters.company_id]
      );
      expect(result).toEqual([{ user_id: 'user1', code: 'V001' }]);
    });

    test('should return empty array if no data', async () => {
      const filters = { company_id: 'comp1' };
      const mockResult = { rows: [] };
      buildSelectQuery.mockReturnValue([
        `SELECT user_id, code FROM "${tableName.VENDOR}" WHERE 1=1 AND company_id = $1`,
        [filters.company_id]
      ]);
      executeQuery.mockResolvedValue(mockResult);

      const result = await getVendorsDashBoardReportDao(filters);

      expect(result).toEqual([]);
    });

    test('should throw error on database failure', async () => {
      const filters = { company_id: 'comp1' };
      const error = new Error('Database error');
      buildSelectQuery.mockReturnValue([
        `SELECT user_id, code FROM "${tableName.VENDOR}" WHERE 1=1 AND company_id = $1`,
        [filters.company_id]
      ]);
      executeQuery.mockRejectedValue(error);

      await expect(getVendorsDashBoardReportDao(filters)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error getting vendor data:', error);
    });
  });

  describe('getVendorsCodeDao', () => {
    test('should fetch vendor codes successfully', async () => {
      const filters = { company_id: 'comp1' };
      const mockResult = { rows: [{ label: 'V001', value: 'user1', vendor_id: 'vendor1' }] };
      mockConn.query.mockResolvedValue(mockResult);

      const result = await getVendorsCodeDao(filters, mockConn);

      expect(mockConn.query).toHaveBeenCalledWith(
        expect.stringMatching(/SELECT\s+v\.code\s+AS\s+label,\s+v\.user_id\s+AS\s+value,\s+v\.id\s+AS\s+vendor_id/),
        ['comp1']
      );
      expect(logger.log).toHaveBeenCalledWith('Fetched Vendors:', 1, 'rows');
      expect(result).toEqual([{ label: 'V001', value: 'user1', vendor_id: 'vendor1' }]);
    });


    test('should throw error on database failure', async () => {
      const filters = { company_id: 'comp1' };
      const error = new Error('Database error');
      buildSelectQuery.mockReturnValue([
        'SELECT code AS label, user_id AS value, id AS vendor_id FROM "Vendor" WHERE is_obsolete = FALSE AND company_id = $1 ORDER BY "code" ASC',
        ['comp1']
      ]);
      mockConn.query.mockRejectedValue(error);

      await expect(getVendorsCodeDao(filters, mockConn)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error executing vendor query:', error);
    });
  });

  describe('getVendorsDao', () => {
    test('should fetch vendors successfully for admin role', async () => {
      const filters = { company_id: 'comp1' };
      const mockResult = [{ id: 'vendor1', full_name: 'Vendor A' }];
      buildSelectQuery.mockReturnValue([
        'SELECT "Vendor".id, ... FROM "Vendor" JOIN "User" AS user_main ON "Vendor".user_id = user_main.id ... WHERE "Vendor".is_obsolete = false AND user_main.designation_id = (SELECT id FROM "Designation" WHERE designation = \'VENDOR\') AND company_id = $1 ORDER BY created_at DESC LIMIT 10 OFFSET 0',
        ['comp1']
      ]);
      executeQuery.mockResolvedValue({ rows: mockResult });
      enhanceVendorsWithSubVendors.mockResolvedValue(mockResult);

      const result = await getVendorsDao(filters, 1, 10, 'created_at', 'DESC', Role.ADMIN);

      expect(buildSelectQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT "Vendor".id,'),
        filters,
        1,
        10,
        'created_at',
        'DESC',
        'Vendor'
      );
      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringMatching(/SELECT\s+"Vendor".id,.*FROM\s+"Vendor"\s+JOIN\s+"User"\s+AS\s+user_main\s+ON\s+"Vendor".user_id\s+=\s+user_main.id.*WHERE\s+"Vendor".is_obsolete\s+=\s+false\s+AND\s+user_main.designation_id\s+=\s+\(SELECT\s+id\s+FROM\s+"Designation"\s+WHERE\s+designation\s+=\s+'VENDOR'\)\s+AND\s+company_id\s+=\s+\$1\s+ORDER\s+BY\s+created_at\s+DESC\s+LIMIT\s+10\s+OFFSET\s+0/),
        ['comp1']
      );
      expect(result).toEqual(mockResult);
    });

    test('should fetch vendors successfully for non-admin role', async () => {
      const filters = { company_id: 'comp1' };
      const mockResult = [{ id: 'vendor1', full_name: 'Vendor A' }];
      buildSelectQuery.mockReturnValue([
        'SELECT "Vendor".id, ... FROM "Vendor" JOIN "User" AS user_main ON "Vendor".user_id = user_main.id ... WHERE "Vendor".is_obsolete = false AND company_id = $1 ORDER BY created_at DESC LIMIT 10 OFFSET 0',
        ['comp1']
      ]);
      executeQuery.mockResolvedValue({ rows: mockResult });
      enhanceVendorsWithSubVendors.mockResolvedValue(mockResult);

      const result = await getVendorsDao(filters, 1, 10, 'created_at', 'DESC', 'user');

      expect(buildSelectQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT "Vendor".id,'),
        filters,
        1,
        10,
        'created_at',
        'DESC',
        'Vendor'
      );
      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringMatching(/SELECT\s+"Vendor".id,.*FROM\s+"Vendor"\s+JOIN\s+"User"\s+AS\s+user_main\s+ON\s+"Vendor".user_id\s+=\s+user_main.id.*WHERE\s+"Vendor".is_obsolete\s+=\s+false\s+AND\s+company_id\s+=\s+\$1\s+ORDER\s+BY\s+created_at\s+DESC\s+LIMIT\s+10\s+OFFSET\s+0/),
        ['comp1']
      );
      expect(result).toEqual(mockResult);
    });

    test('should handle id filter correctly', async () => {
      const filters = { company_id: 'comp1', id: 'vendor1' };
      const mockResult = [{ id: 'vendor1', full_name: 'Vendor A' }];
      buildSelectQuery.mockReturnValue([
        'SELECT "Vendor".id, ... FROM "Vendor" JOIN "User" AS user_main ON "Vendor".user_id = user_main.id ... WHERE "Vendor".is_obsolete = false AND user_main.designation_id = (SELECT id FROM "Designation" WHERE designation = \'VENDOR\') AND "Vendor".id = $1 AND company_id = $2 ORDER BY created_at DESC LIMIT 10 OFFSET 0',
        ['vendor1', 'comp1']
      ]);
      executeQuery.mockResolvedValue({ rows: mockResult });
      enhanceVendorsWithSubVendors.mockResolvedValue(mockResult);

      const result = await getVendorsDao(filters, 1, 10, 'created_at', 'DESC', Role.ADMIN);

      expect(buildSelectQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND "Vendor".id = $1'),
        filters,
        1,
        10,
        'created_at',
        'DESC',
        'Vendor'
      );
      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringMatching(/AND\s+"Vendor".id\s+=\s+\$1/),
        ['vendor1', 'comp1']
      );
      expect(result).toEqual(mockResult);
    });

    test('should throw error on database failure', async () => {
      const filters = { company_id: 'comp1' };
      const error = new Error('Database error');
      buildSelectQuery.mockReturnValue([
        'SELECT "Vendor".id, ... FROM "Vendor" JOIN "User" AS user_main ON "Vendor".user_id = user_main.id ... WHERE "Vendor".is_obsolete = false AND company_id = $1 ORDER BY created_at DESC LIMIT 10 OFFSET 0',
        ['comp1']
      ]);
      executeQuery.mockRejectedValue(error);

      await expect(getVendorsDao(filters, 1, 10, 'created_at', 'DESC', Role.ADMIN)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error in getVendorsDao:', error);
    });
  });

  describe('getAllVendorsDao', () => {
    test('should fetch all vendors successfully for admin role', async () => {
      const filters = { company_id: 'comp1' };
      const mockResult = [{ id: 'vendor1', full_name: 'Vendor A' }];
      buildSelectQuery.mockReturnValue([
        'SELECT "Vendor".id, ... FROM "Vendor" JOIN "User" AS user_main ON "Vendor".user_id = user_main.id ... WHERE "Vendor".is_obsolete = false AND user_main.designation_id = (SELECT id FROM "Designation" WHERE designation = \'VENDOR\') AND company_id = $1 ORDER BY created_at DESC LIMIT 10 OFFSET 0',
        ['comp1']
      ]);
      executeQuery.mockResolvedValue({ rows: mockResult });
      enhanceVendorsWithSubVendors.mockResolvedValue(mockResult);

      const result = await getAllVendorsDao(filters, 1, 10, 'created_at', 'DESC', Role.ADMIN);

      expect(buildSelectQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT "Vendor".id,'),
        filters,
        1,
        10,
        'created_at',
        'DESC',
        'Vendor'
      );
      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringMatching(/SELECT\s+"Vendor".id,.*FROM\s+"Vendor"\s+JOIN\s+"User"\s+AS\s+user_main\s+ON\s+"Vendor".user_id\s+=\s+user_main.id.*WHERE\s+"Vendor".is_obsolete\s+=\s+false\s+AND\s+user_main.designation_id\s+=\s+\(SELECT\s+id\s+FROM\s+"Designation"\s+WHERE\s+designation\s+=\s+'VENDOR'\)\s+AND\s+company_id\s+=\s+\$1\s+ORDER\s+BY\s+created_at\s+DESC\s+LIMIT\s+10\s+OFFSET\s+0/),
        ['comp1']
      );
      expect(result).toEqual(mockResult);
    });

    test('should throw error on database failure', async () => {
      const filters = { company_id: 'comp1' };
      const error = new Error('Database error');
      buildSelectQuery.mockReturnValue([
        'SELECT "Vendor".id, ... FROM "Vendor" JOIN "User" AS user_main ON "Vendor".user_id = user_main.id ... WHERE "Vendor".is_obsolete = false AND company_id = $1 ORDER BY created_at DESC LIMIT 10 OFFSET 0',
        ['comp1']
      ]);
      executeQuery.mockRejectedValue(error);

      await expect(getAllVendorsDao(filters, 1, 10, 'DESC', Role.ADMIN)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error in getVendorsDao:', error);
    });
  });

  describe('getVendorsBySearchDao', () => {

    test('should throw error on database failure', async () => {
      const filters = { company_id: 'comp1', role: Role.ADMIN };
      const searchTerms = ['Vendor A'];
      const error = new Error('Database error');
      executeQuery.mockRejectedValue(error);

      await expect(getVendorsBySearchDao(filters, 1, 10, searchTerms)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith(error.message);
    });
  });

  describe('updateVendorDao', () => {
    test('should update vendor successfully with connection', async () => {
      const id = { id: 'vendor1' };
      const data = { name: 'Vendor B', updated_by: 'user1' };
      const mockResult = { rows: [{ id: 'vendor1', name: 'Vendor B' }] };
      buildUpdateQuery.mockReturnValue([
        'UPDATE "Vendor" SET name = $1, updated_by = $2 WHERE id = $3 RETURNING *',
        ['Vendor B', 'user1', 'vendor1']
      ]);
      mockConn.query.mockResolvedValue(mockResult);

      const result = await updateVendorDao(id, data, mockConn);

      expect(buildUpdateQuery).toHaveBeenCalledWith(tableName.VENDOR, data, id);
      expect(mockConn.query).toHaveBeenCalledWith(
        'UPDATE "Vendor" SET name = $1, updated_by = $2 WHERE id = $3 RETURNING *',
        ['Vendor B', 'user1', 'vendor1']
      );
      expect(result).toEqual({ id: 'vendor1', name: 'Vendor B' });
    });

    test('should update vendor successfully without connection', async () => {
      const id = { id: 'vendor1' };
      const data = { name: 'Vendor B', updated_by: 'user1' };
      const mockResult = { rows: [{ id: 'vendor1', name: 'Vendor B' }] };
      buildUpdateQuery.mockReturnValue([
        'UPDATE "Vendor" SET name = $1, updated_by = $2 WHERE id = $3 RETURNING *',
        ['Vendor B', 'user1', 'vendor1']
      ]);
      executeQuery.mockResolvedValue(mockResult);

      const result = await updateVendorDao(id, data);

      expect(buildUpdateQuery).toHaveBeenCalledWith(tableName.VENDOR, data, id);
      expect(executeQuery).toHaveBeenCalledWith(
        'UPDATE "Vendor" SET name = $1, updated_by = $2 WHERE id = $3 RETURNING *',
        ['Vendor B', 'user1', 'vendor1']
      );
      expect(result).toEqual({ id: 'vendor1', name: 'Vendor B' });
    });

    test('should throw error on database failure', async () => {
      const id = { id: 'vendor1' };
      const data = { name: 'Vendor B', updated_by: 'user1' };
      const error = new Error('Database error');
      buildUpdateQuery.mockReturnValue([
        'UPDATE "Vendor" SET name = $1, updated_by = $2 WHERE id = $3 RETURNING *',
        ['Vendor B', 'user1', 'vendor1']
      ]);
      executeQuery.mockRejectedValue(error);

      await expect(updateVendorDao(id, data)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error in updateVendorDao:', error);
    });
  });

  describe('deleteVendorDao', () => {
    test('should delete vendor successfully', async () => {
      const id = { id: 'vendor1' };
      const data = { is_obsolete: true, deleted_by: 'user1' };
      const mockResult = { rows: [{ id: 'vendor1', is_obsolete: true }] };
      buildUpdateQuery.mockReturnValue([
        'UPDATE "Vendor" SET is_obsolete = $1, deleted_by = $2 WHERE id = $3 RETURNING *',
        [true, 'user1', 'vendor1']
      ]);
      mockConn.query.mockResolvedValue(mockResult);

      const result = await deleteVendorDao(mockConn, id, data);

      expect(buildUpdateQuery).toHaveBeenCalledWith(tableName.VENDOR, data, id);
      expect(mockConn.query).toHaveBeenCalledWith(
        'UPDATE "Vendor" SET is_obsolete = $1, deleted_by = $2 WHERE id = $3 RETURNING *',
        [true, 'user1', 'vendor1']
      );
      expect(result).toEqual({ id: 'vendor1', is_obsolete: true });
    });

    test('should throw error on database failure', async () => {
      const id = { id: 'vendor1' };
      const data = { is_obsolete: true, deleted_by: 'user1' };
      const error = new Error('Database error');
      buildUpdateQuery.mockReturnValue([
        'UPDATE "Vendor" SET is_obsolete = $1, deleted_by = $2 WHERE id = $3 RETURNING *',
        [true, 'user1', 'vendor1']
      ]);
      mockConn.query.mockRejectedValue(error);

      await expect(deleteVendorDao(mockConn, id, data)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error in deleteVendorDao:', error);
    });
  });

  describe('updateVendorBalanceDao', () => {
    test('should update vendor balance successfully with connection', async () => {
      const filters = { id: 'vendor1' };
      const valueToAdd = 100;
      const updated_by = 'user1';
      const mockResult = { rows: [{ id: 'vendor1', balance: 100 }] };
      buildUpdateQuery.mockReturnValue([
        'UPDATE "Vendor" SET balance = balance + $1, updated_by = $2 WHERE id = $3 RETURNING *',
        [100, 'user1', 'vendor1']
      ]);
      mockConn.query.mockResolvedValue(mockResult);

      const result = await updateVendorBalanceDao(filters, valueToAdd, updated_by, mockConn);

      expect(buildUpdateQuery).toHaveBeenCalledWith(tableName.VENDOR, { balance: 100, updated_by: 'user1' }, filters, { balance: '+' });
      expect(mockConn.query).toHaveBeenCalledWith(
        'UPDATE "Vendor" SET balance = balance + $1, updated_by = $2 WHERE id = $3 RETURNING *',
        [100, 'user1', 'vendor1']
      );
      expect(result).toEqual({ id: 'vendor1', balance: 100 });
    });

    test('should throw error on database failure', async () => {
      const filters = { id: 'vendor1' };
      const valueToAdd = 100;
      const updated_by = 'user1';
      const error = new Error('Database error');
      buildUpdateQuery.mockReturnValue([
        'UPDATE "Vendor" SET balance = balance + $1, updated_by = $2 WHERE id = $3 RETURNING *',
        [100, 'user1', 'vendor1']
      ]);
      executeQuery.mockRejectedValue(error);

      await expect(updateVendorBalanceDao(filters, valueToAdd, updated_by)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error in updateVendorBalanceDao:', error);
    });
  });

  describe('getVendorsDaoArray', () => {
    test('should fetch vendors by company_id and code array successfully', async () => {
      const company_id = 'comp1';
      const code = ['user1', 'user2'];
      const mockResult = { rows: [{ id: 'vendor1', user_id: 'user1', full_name: 'Vendor A' }] };
      executeQuery.mockResolvedValue(mockResult);

      const result = await getVendorsDaoArray(company_id, code);

      // Check that executeQuery was called with correct parameters
      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('"Vendor".id'),
        [company_id, code]
      );
      
      // Verify the SQL contains all key components
      const sqlCall = executeQuery.mock.calls[0][0];
      expect(sqlCall).toContain('"Vendor".user_id');
      expect(sqlCall).toContain('full_name');
      expect(sqlCall).toContain('FROM "Vendor"');
      expect(sqlCall).toContain('JOIN "User"');
      expect(sqlCall).toContain('LEFT JOIN "Designation"');
      expect(sqlCall).toContain('WHERE "Vendor".is_obsolete = false');
      expect(sqlCall).toContain('company_id');
      expect(sqlCall).toContain('= $1');
      expect(sqlCall).toContain('user_id = ANY($2)');
      
      expect(result).toEqual([{ id: 'vendor1', user_id: 'user1', full_name: 'Vendor A' }]);
    });

    test('should throw error on database failure', async () => {
      const company_id = 'comp1';
      const code = ['user1', 'user2'];
      const error = new Error('Database error');
      executeQuery.mockRejectedValue(error);

      await expect(getVendorsDaoArray(company_id, code)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error fetching merchant by code and API key:', error);
    });
  });

  describe('getBankResponseAccessByIDDao', () => {
    test('should fetch bank response access by id successfully', async () => {
      const id = 'user1';
      const mockResult = { rows: [{ bank_response_access: 'true' }] };
      executeQuery.mockResolvedValue(mockResult);

      const result = await getBankResponseAccessByIDDao(id);

      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringMatching(/SELECT\s+"Vendor"\.config->>'bank_response_access'\s+as\s+bank_response_access\s+FROM\s+"Vendor"\s+WHERE\s+"Vendor"\.user_id\s+=\s+\$1/),
        [id]
      );
      expect(result).toEqual({ bank_response_access: 'true' });
    });

    test('should return undefined if no data', async () => {
      const id = 'user1';
      const mockResult = { rows: [] };
      executeQuery.mockResolvedValue(mockResult);

      const result = await getBankResponseAccessByIDDao(id);

      expect(result).toBeUndefined();
    });

    test('should throw error on database failure', async () => {
      const id = 'user1';
      const error = new Error('Database error');
      executeQuery.mockRejectedValue(error);

      await expect(getBankResponseAccessByIDDao(id)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error fetching bank response access by ID:', error);
    });
  });

  describe('getVendorByCodeDao', () => {
    test('should fetch vendor by code successfully', async () => {
      const code = 'V001';
      const mockResult = { rows: [{ id: 'vendor1', code: 'V001' }] };
      executeQuery.mockResolvedValue(mockResult);

      const result = await getVendorByCodeDao(code);

      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringMatching(
          /SELECT\s+"Vendor"\.id,\s+"Vendor"\.user_id,\s+"Vendor"\.first_name,\s+"Vendor"\.last_name,\s+"Vendor"\.code,\s+"Vendor"\.payin_commission,\s+"Vendor"\.payout_commission\s+FROM\s+"Vendor"\s+WHERE\s+"Vendor"\.is_obsolete\s+=\s+false\s+AND\s+"Vendor"\.code\s+=\s+\$1\s+ORDER\s+BY\s+"Vendor"\."created_at"\s+ASC/
        ),
        [code]
      );
      expect(result).toEqual([{ id: 'vendor1', code: 'V001' }]);
    });

    test('should return empty array if no vendor found', async () => {
      const code = 'V999';
      const mockResult = { rows: [] };
      executeQuery.mockResolvedValue(mockResult);

      const result = await getVendorByCodeDao(code);

      expect(result).toEqual([]);
    });

    test('should throw error on database failure', async () => {
      const code = 'V001';
      const error = new Error('Database error');
      executeQuery.mockRejectedValue(error);

      await expect(getVendorByCodeDao(code)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error fetching vendor by code:', error);
    });
  });

  describe('getVendorByUserDao', () => {
    test('should fetch vendor by single user id successfully', async () => {
      const userId = 'user1';
      const mockResult = { rows: [{ id: 'vendor1', user_id: 'user1' }] };
      executeQuery.mockResolvedValue(mockResult);

      const result = await getVendorByUserDao(userId);

      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringMatching(
          /SELECT\s+"Vendor"\.id,\s+"Vendor"\.user_id,\s+"Vendor"\.first_name,\s+"Vendor"\.last_name,\s+"Vendor"\.code,\s+"Vendor"\.payin_commission,\s+"Vendor"\.payout_commission,\s+"Vendor"\.balance,\s+"Vendor"\.config,\s+"Vendor"\.created_by,\s+"Vendor"\.updated_by,\s+"Vendor"\.created_at,\s+"Vendor"\.updated_at,\s+"User"\.designation_id,\s+"User"\.first_name\s+\|\|\s+' '\s+\|\|\s+"User"\.last_name\s+AS\s+full_name,\s+"Designation"\.designation\s+AS\s+designation_name\s+FROM\s+"Vendor"\s+JOIN\s+"User"\s+ON\s+"Vendor"\.user_id\s+=\s+"User"\.id\s+LEFT\s+JOIN\s+"Designation"\s+ON\s+"User"\.designation_id\s+=\s+"Designation"\.id\s+WHERE\s+"Vendor"\.is_obsolete\s+=\s+false\s+AND\s+"Vendor"\."user_id"\s+=\s+\$1\s+ORDER\s+BY\s+"Vendor"\."created_at"\s+ASC/
        ),
        [userId]
      );
      expect(result).toEqual([{ id: 'vendor1', user_id: 'user1' }]);
    });

    test('should fetch vendors by user id array successfully', async () => {
      const userId = ['user1', 'user2'];
      const mockResult = { rows: [{ id: 'vendor1', user_id: 'user1' }] };
      executeQuery.mockResolvedValue(mockResult);

      const result = await getVendorByUserDao(userId);

      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringMatching(
          /SELECT\s+"Vendor"\.id,\s+"Vendor"\.user_id,\s+"Vendor"\.first_name,\s+"Vendor"\.last_name,\s+"Vendor"\.code,\s+"Vendor"\.payin_commission,\s+"Vendor"\.payout_commission,\s+"Vendor"\.balance,\s+"Vendor"\.config,\s+"Vendor"\.created_by,\s+"Vendor"\.updated_by,\s+"Vendor"\.created_at,\s+"Vendor"\.updated_at,\s+"User"\.designation_id,\s+"User"\.first_name\s+\|\|\s+' '\s+\|\|\s+"User"\.last_name\s+AS\s+full_name,\s+"Designation"\.designation\s+AS\s+designation_name\s+FROM\s+"Vendor"\s+JOIN\s+"User"\s+ON\s+"Vendor"\.user_id\s+=\s+"User"\.id\s+LEFT\s+JOIN\s+"Designation"\s+ON\s+"User"\.designation_id\s+=\s+"Designation"\.id\s+WHERE\s+"Vendor"\.is_obsolete\s+=\s+false\s+AND\s+"Vendor"\."user_id"\s+=\s+ANY\(\$1\)\s+ORDER\s+BY\s+"Vendor"\."created_at"\s+ASC/
        ),
        [userId]
      );
      expect(result).toEqual([{ id: 'vendor1', user_id: 'user1' }]);
    });

    test('should throw error on database failure', async () => {
      const userId = 'user1';
      const error = new Error('Database error');
      executeQuery.mockRejectedValue(error);

      await expect(getVendorByUserDao(userId)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith(`Error in getVendorByUserDao for user_id ${userId}:`, error);
    });
  });

  describe('getDesignationIdDao', () => {
    test('should fetch designation id with connection successfully', async () => {
      const designation = 'VENDOR';
      const mockResult = { rows: [{ id: 1 }] };
      mockConn.query.mockResolvedValue(mockResult);

      const result = await getDesignationIdDao(designation, mockConn);

      expect(mockConn.query).toHaveBeenCalledWith(
        `SELECT id FROM "${tableName.DESIGNATION}" WHERE designation = $1 LIMIT 1;`,
        [designation]
      );
      expect(result).toBe(1);
    });

    test('should fetch designation id without connection successfully', async () => {
      const designation = 'VENDOR';
      const mockResult = { rows: [{ id: 1 }] };
      executeQuery.mockResolvedValue(mockResult);

      const result = await getDesignationIdDao(designation);

      expect(executeQuery).toHaveBeenCalledWith(
        `SELECT id FROM "${tableName.DESIGNATION}" WHERE designation = $1 LIMIT 1;`,
        [designation]
      );
      expect(result).toBe(1);
    });

    test('should return null if no designation found', async () => {
      const designation = 'INVALID';
      const mockResult = { rows: [] };
      executeQuery.mockResolvedValue(mockResult);

      const result = await getDesignationIdDao(designation);

      expect(result).toBeNull();
    });
  });

  describe('isNetBalanceZeroForTwoHours', () => {
    test('should return true if net balance is zero today', async () => {
      const vendorUserId = 'user1';
      const mockResult = { rows: [{ net_balance: 0, updated_at: new Date() }] };
      executeQuery.mockResolvedValue(mockResult);

      const result = await isNetBalanceZeroForTwoHours(vendorUserId);

      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringMatching(
          /SELECT\s+net_balance,\s+updated_at\s+FROM\s+"Calculation"\s+WHERE\s+user_id\s+=\s+\$1\s+AND\s+net_balance\s+=\s+0\s+AND\s+DATE\(updated_at\)\s+=\s+CURRENT_DATE\s+ORDER\s+BY\s+updated_at\s+DESC\s+LIMIT\s+1/
        ),
        [vendorUserId]
      );
      expect(result).toBe(true);
    });

    test('should return false if no zero balance today', async () => {
      const vendorUserId = 'user1';
      const mockResult = { rows: [] };
      executeQuery.mockResolvedValue(mockResult);

      const result = await isNetBalanceZeroForTwoHours(vendorUserId);

      expect(result).toBe(false);
    });

    test('should throw error on database failure', async () => {
      const vendorUserId = 'user1';
      const error = new Error('Database error');
      executeQuery.mockRejectedValue(error);

      await expect(isNetBalanceZeroForTwoHours(vendorUserId)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error in isNetBalanceZeroForTwoHours:', error);
    });
  });
  describe('linkVendorDao', () => {
    const vendorUserId = 10;
    const subVendorUserId = 20;
    const user_id = 5;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should successfully link vendor and update all configs', async () => {
      // ---- Mock user hierarchy ----
      getUserHierarchyVendor.mockResolvedValueOnce({ parent: null, siblings: { sub_vendors: [] } }); // parent
      getUserHierarchyVendor.mockResolvedValueOnce({ parent: null, siblings: { sub_vendors: [] } }); // child

      updateUserHierarchyVendor.mockResolvedValueOnce({ success: true }); // parent update return
      updateUserHierarchyVendor.mockResolvedValueOnce({ success: true }); // child update return

      // ---- Mock executeQuery for getVendorCode and getVendorConfig ----
      // First call: getVendorCode for parent (SELECT code FROM VENDOR WHERE user_id = $1)
      executeQuery.mockResolvedValueOnce({ rows: [{ code: 'PARENT123' }] });

      // Second call: getVendorConfig for child (SELECT code, config FROM VENDOR WHERE user_id = $1)
      executeQuery.mockResolvedValueOnce({ 
        rows: [{ code: 'CHILD1', config: { old: 'value' } }] 
      });

      // Third call: updateVendorConfig (UPDATE VENDOR SET config = $1, updated_by = $2 WHERE user_id = $3)
      executeQuery.mockResolvedValueOnce({ rows: [{ id: subVendorUserId }] });

      // EXECUTE
      const result = await linkVendorDao(vendorUserId, subVendorUserId, user_id);

      // ASSERTS
      expect(getUserHierarchyVendor).toHaveBeenCalledTimes(2);
      expect(getUserHierarchyVendor).toHaveBeenNthCalledWith(1, vendorUserId);
      expect(getUserHierarchyVendor).toHaveBeenNthCalledWith(2, subVendorUserId);

      expect(updateUserHierarchyVendor).toHaveBeenCalledTimes(2);
      expect(updateUserHierarchyVendor).toHaveBeenNthCalledWith(
        1,
        vendorUserId,
        expect.any(Object),
        user_id
      );
      expect(updateUserHierarchyVendor).toHaveBeenNthCalledWith(
        2,
        subVendorUserId,
        expect.any(Object),
        user_id
      );

      // Verify executeQuery was called for getVendorCode
      expect(executeQuery).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('SELECT code FROM'),
        [vendorUserId]
      );

      // Verify executeQuery was called for getVendorConfig
      expect(executeQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('SELECT code, config FROM'),
        [subVendorUserId]
      );

      // Verify executeQuery was called for updateVendorConfig
      expect(executeQuery).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('UPDATE'),
        [expect.objectContaining({ old: 'value', sub_code: 'PARENT123(CHILD1)' }), user_id, subVendorUserId]
      );

      expect(result).toEqual({ success: true });
    });

    test('should log error and throw when something fails', async () => {
      const error = new Error('mock failure');
      getUserHierarchyVendor.mockRejectedValue(error);

      await expect(
        linkVendorDao(vendorUserId, subVendorUserId, user_id)
      ).rejects.toThrow('mock failure');

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('unlinkVendorDao', () => {
    test('should unlink sub-vendor successfully', async () => {
      const vendorUserId = 'vendor1';
      const subVendorUserId = 'sub1';
      const user_id = 'admin1';
      getUserHierarchyVendor.mockResolvedValueOnce({ siblings: { sub_vendors: ['sub1', 'sub2'] } }); // parent
      getUserHierarchyVendor.mockResolvedValueOnce({}); // child
      updateUserHierarchyVendor.mockResolvedValueOnce({ id: 'vendor1' }); // updated parent
      updateUserHierarchyVendor.mockResolvedValueOnce({ id: 'sub1' }); // updated child

      // Mock getVendorConfig and updateVendorConfig via executeQuery
      executeQuery
        .mockResolvedValueOnce({ rows: [{ config: { sub_code: 'old' } }] }) // getVendorConfig
        .mockResolvedValueOnce({ rows: [{ id: 'vendor1' }] }); // updateVendorConfig

      const result = await unlinkVendorDao(vendorUserId, subVendorUserId, user_id);

      expect(getUserHierarchyVendor).toHaveBeenNthCalledWith(1, vendorUserId);
      expect(getUserHierarchyVendor).toHaveBeenNthCalledWith(2, subVendorUserId);
      expect(updateUserHierarchyVendor).toHaveBeenCalledWith(
        vendorUserId,
        expect.objectContaining({ siblings: { sub_vendors: ['sub2'] } }),
        user_id,
      );
      expect(updateUserHierarchyVendor).toHaveBeenCalledWith(
        subVendorUserId,
        expect.objectContaining({ parent: '' }),
        user_id,
      );
      expect(result).toEqual({ id: 'vendor1' });
    });

    test('should throw error on database failure', async () => {
      const vendorUserId = 'vendor1';
      const subVendorUserId = 'sub1';
      const user_id = 'admin1';
      const error = new Error('Database error');
      executeQuery.mockRejectedValue(error);
      getUserHierarchyVendor.mockResolvedValueOnce({ siblings: { sub_vendors: ['sub1'] } }); // parent
      getUserHierarchyVendor.mockResolvedValueOnce({}); // child

      await expect(unlinkVendorDao(vendorUserId, subVendorUserId, user_id)).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith('Error in unlinkVendorDao:', error);
    });
  });

  describe('transferVendorDao', () => {
    test('should transfer sub-vendor successfully', async () => {
      const vendorUserId = 'sub1';
      const newVendorUserId = 'newVendor1';
      const currentVendorUserId = 'oldVendor1';
      const user_id = 'admin1';
      // mock userHierarchy helper responses
      getUserHierarchyVendor.mockResolvedValueOnce({ siblings: { sub_vendors: ['sub1'] } }); // current parent
      getUserHierarchyVendor.mockResolvedValueOnce({ siblings: { sub_vendors: [] } }); // new parent
      getUserHierarchyVendor.mockResolvedValueOnce({}); // child

      updateUserHierarchyVendor
        .mockResolvedValueOnce({ id: 'oldVendor1' }) // updated current
        .mockResolvedValueOnce({ id: 'newVendor1' }) // updated new
        .mockResolvedValueOnce({ id: 'sub1' }); // updated child

      // Mock vendor code/config queries via executeQuery
      executeQuery
        .mockResolvedValueOnce({ rows: [{ code: 'NV001' }] }) // getVendorCode for new parent
        .mockResolvedValueOnce({ rows: [{ code: 'SV001', config: {} }] }) // getVendorConfig for child
        .mockResolvedValueOnce({ rows: [{ id: 'newVendor1' }] }); // updateVendorConfig

      const result = await transferVendorDao(vendorUserId, newVendorUserId, currentVendorUserId, user_id);

      expect(getUserHierarchyVendor).toHaveBeenNthCalledWith(1, currentVendorUserId);
      expect(getUserHierarchyVendor).toHaveBeenNthCalledWith(2, newVendorUserId);
      expect(getUserHierarchyVendor).toHaveBeenNthCalledWith(3, vendorUserId);
      expect(updateUserHierarchyVendor).toHaveBeenCalledWith(
        currentVendorUserId,
        expect.objectContaining({ siblings: { sub_vendors: [] } }),
        user_id,
      );
      expect(updateUserHierarchyVendor).toHaveBeenCalledWith(
        newVendorUserId,
        expect.objectContaining({ siblings: { sub_vendors: [vendorUserId] } }),
        user_id,
      );
      expect(result).toEqual({ id: 'newVendor1' });
    });

    test('should throw error on database failure', async () => {
      const vendorUserId = 'sub1';
      const newVendorUserId = 'newVendor1';
      const currentVendorUserId = 'oldVendor1';
      const user_id = 'admin1';
      const error = new Error('Database error');
      executeQuery.mockRejectedValue(error);
      getUserHierarchyVendor.mockResolvedValueOnce({ siblings: { sub_vendors: ['sub1'] } }); // current parent
      getUserHierarchyVendor.mockResolvedValueOnce({ siblings: { sub_vendors: [] } }); // new parent
      getUserHierarchyVendor.mockResolvedValueOnce({}); // child

      await expect(transferVendorDao(vendorUserId, newVendorUserId, currentVendorUserId, user_id)).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith('Error in transferVendorDao:', error);
    });
  });

  describe('getVendorByUserId', () => {
    test('should fetch vendor by user id successfully', async () => {
      const user_id = 'user1';
      const mockResult = { rows: [{ id: 'vendor1' }] };
      executeQuery.mockResolvedValue(mockResult);

      const result = await getVendorByUserId(user_id);

      expect(executeQuery).toHaveBeenCalledWith(
        `SELECT * FROM "${tableName.VENDOR}" WHERE user_id = $1 AND is_obsolete = false LIMIT 1;`,
        [user_id]
      );
      expect(result).toEqual({ id: 'vendor1' });
    });

    test('should return null if no vendor found', async () => {
      const user_id = 'user999';
      const mockResult = { rows: [] };
      executeQuery.mockResolvedValue(mockResult);

      const result = await getVendorByUserId(user_id);

      expect(result).toBeNull();
    });

    test('should throw error on database failure', async () => {
      const user_id = 'user1';
      const error = new Error('Database error');
      executeQuery.mockRejectedValue(error);

      await expect(getVendorByUserId(user_id)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error fetching vendor by user_id:', error);
    });
  });
});
