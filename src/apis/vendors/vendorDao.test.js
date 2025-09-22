import {
  createVendorDao,
  getVendorsCodeDao,
  getVendorsDao,
  getAllVendorsDao,
  getVendorsBySearchDao,
  updateVendorDao,
  deleteVendorDao,
  updateVendorBalanceDao,
  getVendorsDaoArray,
} from './vendorDao.js';
import { Role, tableName } from '../../constants/index.js';
import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';

jest.mock('../../utils/db.js', () => ({
  buildInsertQuery: jest.fn(),
  buildSelectQuery: jest.fn(),
  buildUpdateQuery: jest.fn(),
  executeQuery: jest.fn(),
}));

jest.mock('../../utils/logger.js', () => ({
  logger: {
    error: jest.fn(),
    log: jest.fn(),
  },
}));

describe('Vendor DAO', () => {
  const mockConn = {
    query: jest.fn(),
  };

  // beforeEach(() => {
  //   jest.clearAllMocks();
  // });
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
    // test('should fetch vendors by search successfully with search terms', async () => {
    //   const filters = { company_id: 'comp1', role: Role.ADMIN };
    //   const searchTerms = ['Vendor A', 'true'];
    //   const pageNumber = 1;
    //   const pageSize = 10;
    //   const mockSearchResult = { rows: [{ id: 'vendor1', full_name: 'Vendor A' }] };
    //   const mockCountResult = { rows: [{ total: '1' }] };
  
    //   executeQuery
    //     .mockResolvedValueOnce(mockCountResult)
    //     .mockResolvedValueOnce(mockSearchResult);
  
    //   const result = await getVendorsBySearchDao(filters, pageNumber, pageSize, searchTerms);
  
    //   // Expectation for the COUNT query (includes pagination parameters)
    //   expect(executeQuery).toHaveBeenCalledWith(
    //     expect.stringMatching(
    //       /SELECT\s+COUNT\(\*\)\s+as\s+total\s+FROM\s+\(.*WHERE\s+"Vendor".is_obsolete\s+=\s+false\s+AND\s+"Vendor"."company_id"\s+=\s+\$1.*AND\s+\(\s*\(\s*LOWER\("Vendor".id::text\)\s+LIKE\s+LOWER\(\$2\)\s+OR.*\s+OR\s+\("Vendor".config->>'is_enabled'\)::boolean\s+=\s+\$3\s*\)\s*\)/
    //     ),
    //     ['comp1', '%Vendor A%', true, 10, 0] // Include pagination parameters
    //   );
  
    //   // Expectation for the SELECT query with pagination
    //   expect(executeQuery).toHaveBeenCalledWith(
    //     expect.stringMatching(
    //       /SELECT\s+"Vendor".id,.*FROM\s+"Vendor"\s+JOIN\s+"User"\s+AS\s+user_main\s+ON\s+"Vendor".user_id\s+=\s+user_main.id.*WHERE\s+"Vendor".is_obsolete\s+=\s+false\s+AND\s+"Vendor"."company_id"\s+=\s+\$1\s+AND\s+\(\s*\(\s*LOWER\("Vendor".id::text\)\s+LIKE\s+LOWER\(\$2\)\s+OR.*\s+OR\s+\("Vendor".config->>'is_enabled'\)::boolean\s+=\s+\$3\s*\)\s*\)\s+ORDER\s+BY\s+"Vendor"."updated_at"\s+DESC\s+LIMIT\s+\$4\s+OFFSET\s+\$5/
    //     ),
    //     ['comp1', '%Vendor A%', true, 10, 0]
    //   );
  
    //   expect(result).toEqual({
    //     totalCount: 1,
    //     totalPages: 1,
    //     Vendors: [{ id: 'vendor1', full_name: 'Vendor A' }],
    //   });
    // });
    
    // test('should handle empty search results with pagination correction', async () => {
    //   const filters = { company_id: 'comp1', role: Role.ADMIN };
    //   const searchTerms = ['Vendor A'];
    //   const pageNumber = 2;
    //   const pageSize = 10;
    //   const mockCountResult = { rows: [{ total: '5' }] };
    //   const mockSearchResultEmpty = { rows: [] };
    //   const mockSearchResult = { rows: [{ id: 'vendor1', full_name: 'Vendor A' }] };
  
    //   executeQuery
    //     .mockResolvedValueOnce(mockCountResult) // Count query
    //     .mockResolvedValueOnce(mockSearchResultEmpty) // Empty results for page 2
    //     .mockResolvedValueOnce(mockSearchResult); // Fallback query for page 1
  
    //   const result = await getVendorsBySearchDao(filters, pageNumber, pageSize, searchTerms);
  
    //   expect(executeQuery).toHaveBeenCalledTimes(3);
    //   // Count query
    //   expect(executeQuery).toHaveBeenCalledWith(
    //     expect.stringMatching(/SELECT\s+COUNT\(\*\)\s+as\s+total\s+FROM\s+\(.*WHERE\s+"Vendor".is_obsolete\s+=\s+false\s+AND\s+"Vendor"."company_id"\s+=\s+\$1.*AND\s+\(\s*LOWER\("Vendor".id::text\)\s+LIKE\s+LOWER\(\$2\)\s+OR.*\)/),
    //     ['comp1', '%Vendor A%', 10, 0] // Corrected parameters
    //   );
    //   // Initial search query for page 2
    //   expect(executeQuery).toHaveBeenCalledWith(
    //     expect.stringMatching(/SELECT\s+"Vendor".id,.*FROM\s+"Vendor"\s+JOIN\s+"User"\s+AS\s+user_main\s+ON\s+"Vendor".user_id\s+=\s+user_main.id.*WHERE\s+"Vendor".is_obsolete\s+=\s+false\s+AND\s+"Vendor"."company_id"\s+=\s+\$1\s+AND\s+\(\s*LOWER\("Vendor".id::text\)\s+LIKE\s+LOWER\(\$2\)\s+OR.*\)\s+ORDER\s+BY\s+"Vendor"."updated_at"\s+DESC\s+LIMIT\s+\$3\s+OFFSET\s+\$4/),
    //     ['comp1', '%Vendor A%', 10, 10]
    //   );
    //   // Fallback search query for page 1
    //   expect(executeQuery).toHaveBeenCalledWith(
    //     expect.stringMatching(/SELECT\s+"Vendor".id,.*FROM\s+"Vendor"\s+JOIN\s+"User"\s+AS\s+user_main\s+ON\s+"Vendor".user_id\s+=\s+user_main.id.*WHERE\s+"Vendor".is_obsolete\s+=\s+false\s+AND\s+"Vendor"."company_id"\s+=\s+\$1\s+AND\s+\(\s*LOWER\("Vendor".id::text\)\s+LIKE\s+LOWER\(\$2\)\s+OR.*\)\s+ORDER\s+BY\s+"Vendor"."updated_at"\s+DESC\s+LIMIT\s+\$3\s+OFFSET\s+\$4/),
    //     ['comp1', '%Vendor A%', 10, 0]
    //   );
    //   expect(result).toEqual({
    //     totalCount: 5,
    //     totalPages: 1,
    //     Vendors: [{ id: 'vendor1', full_name: 'Vendor A' }],
    //   });
    // });

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
    
      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringMatching(
          /SELECT\s+"Vendor"\.id,\s+"Vendor"\.user_id,\s+"Vendor"\.first_name,\s+"Vendor"\.last_name,\s+"Vendor"\.code,\s+"Vendor"\.payin_commission,\s+"Vendor"\.payout_commission,\s+"Vendor"\.config,\s+"Vendor"\.created_by,\s+"Vendor"\.updated_by,\s+"Vendor"\.created_at,\s+"Vendor"\.updated_at,\s+"User"\.designation_id,\s+"User"\.first_name\s+\|\|\s+' '\s+\|\|\s+"User"\.last_name\s+AS\s+full_name,\s+"Designation"\.designation\s+AS\s+designation_name,\s+\(\s*SELECT\s+net_balance\s+FROM\s+"Calculation"\s+WHERE\s+"Calculation"\.user_id\s+=\s+"Vendor"\.user_id\s+ORDER\s+BY\s+"Calculation"\.updated_at\s+DESC\s+LIMIT\s+1\s*\)\s+AS\s+balance\s+FROM\s+"Vendor"\s+JOIN\s+"User"\s+ON\s+"Vendor"\.user_id\s+=\s+"User"\.id\s+LEFT\s+JOIN\s+"Designation"\s+ON\s+"User"\.designation_id\s+=\s+"Designation"\.id\s+WHERE\s+"Vendor"\.is_obsolete\s+=\s+false\s+AND\s+"Vendor"\."company_id"\s+=\s+\$1\s+AND\s+"Vendor"\.user_id\s+=\s+ANY\(\$2\)/
        ),
        [company_id, code]
      );
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
});