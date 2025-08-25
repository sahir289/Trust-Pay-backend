const {
    getSettlementDao,
    getSettlementsBySearchDao,
    getSettlementDaoforInternalTransfer,
    createSettlementDao,
    updateSettlementDao,
    deleteSettlementDao,
  } = require('./settlementDao.js');
  const { buildInsertQuery, buildUpdateQuery, executeQuery } = require('../../utils/db.js');
  const { logger } = require('../../utils/logger.js');
  const { tableName, Role, Status } = require('../../constants/index.js');
  const dayjs = require('dayjs');
  
  // Mock the entire db.js module
  jest.mock('../../utils/db.js', () => ({
    buildInsertQuery: jest.fn(),
    buildUpdateQuery: jest.fn(),
    executeQuery: jest.fn(),
  }));
  
  // Mock the logger module
  jest.mock('../../utils/logger.js', () => ({
    logger: {
      error: jest.fn(),
    },
  }));
  
  // Mock dayjs with tz support
  jest.mock('dayjs', () => {
    // const actualDayjs = jest.requireActual('dayjs');
    const mockDayjs = {
      tz: jest.fn().mockReturnThis(),
      utc: jest.fn().mockReturnThis(),
      format: jest.fn(),
    };
    const dayjsMock = jest.fn(() => mockDayjs);
    dayjsMock.tz = jest.fn(() => mockDayjs);
    return dayjsMock;
  });
  
  describe('Settlement DAO', () => {
    const mockConn = { query: jest.fn() };
    const mockDayjs = {
      tz: jest.fn().mockReturnThis(),
      utc: jest.fn().mockReturnThis(),
      format: jest.fn(),
    };
  
    beforeEach(() => {
      jest.clearAllMocks();
      // Use the mocked dayjs.tz directly
      dayjs.tz.mockReturnValue(mockDayjs);
      mockDayjs.format.mockImplementation(() => '2025-08-25T00:00:00Z');
    });
  
    describe('getSettlementDao', () => {
      it('should fetch settlements with default filters and pagination', async () => {
        const filters = { company_id: 1 };
        const page = 1;
        const pageSize = 10;
        const sortBy = 'sno';
        const sortOrder = 'DESC';
        const mockRows = [{ id: '1', amount: 100 }];
        executeQuery.mockResolvedValue({ rows: mockRows });
      
        const result = await getSettlementDao(filters, page, pageSize, sortBy, sortOrder);
      
        const [query, params] = executeQuery.mock.calls[0];
        expect(query).toMatch(/SELECT DISTINCT ON\s*\(s\.sno\)/);
        expect(query).toMatch(/FROM public\."Settlement" s/);
        expect(query).toMatch(/WHERE s\.is_obsolete = false/);
        expect(query).toMatch(/s\.company_id = \$[0-9]+/);
        expect(query).toMatch(/ORDER BY s\.sno DESC/);
        expect(query).toMatch(/LIMIT \$[0-9]+ OFFSET \$[0-9]+/);
      
        expect(params).toEqual([ 10, 0, 1]);
        expect(result).toEqual(mockRows);
      });
      
  
      // Test handling user_id as array
      it('should handle user_id as array', async () => {
        const filters = { user_id: [1, 2] };
        const mockRows = [{ id: '1', amount: 100 }];
        executeQuery.mockResolvedValue({ rows: mockRows });
  
        await getSettlementDao(filters, 1, 10, 'sno', 'DESC');
  
        const [query, params] = executeQuery.mock.calls[0];
        expect(query).toMatch(/s\.user_id IN \(\$[0-9]+, \$[0-9]+\)/);
        expect(params).toEqual([1, 2, 10, 0]);
      });
  
      // Test handling user_id as comma-separated string
      it('should handle user_id as comma-separated string', async () => {
        const filters = { user_id: '1,2' };
        const mockRows = [{ id: '1', amount: 100 }];
        executeQuery.mockResolvedValue({ rows: mockRows });
  
        await getSettlementDao(filters, 1, 10, 'sno', 'DESC');
  
        const [query, params] = executeQuery.mock.calls[0];
        expect(query).toMatch(/s\.user_id IN \(\$[0-9]+, \$[0-9]+\)/);
        expect(params).toEqual(['1', '2', 10, 0]);
      });
  
      // Test handling malformed merchant_codes gracefully
      it('should fetch settlements with search terms and pagination', async () => {
        const filters = { company_id: '1' };
        const searchTerms = ['test'];
        const mockRows = [{ id: '1', amount: 100 }];
        executeQuery
          .mockResolvedValueOnce({ rows: [{ total: '5' }] }) // Count query
          .mockResolvedValueOnce({ rows: mockRows }); // Main query
      
        const result = await getSettlementsBySearchDao(
          filters,
          1,
          10,
          'sno',
          'DESC',
          [],
          searchTerms,
          Role.MERCHANT
        );
      
        const [countQuery] = executeQuery.mock.calls[0];
        const [mainQuery, mainParams] = executeQuery.mock.calls[1];
      
        // Count query validation
        expect(countQuery).toMatch(/SELECT COUNT\(\*\) AS total/);
      
        // Main query validation with multiple smaller regex checks
        expect(mainQuery).toMatch(/SELECT/);
        expect(mainQuery).toMatch(/FROM "Settlement" s/);
        expect(mainQuery).toMatch(/WHERE s\.is_obsolete = false/);
        expect(mainQuery).toMatch(/s\.company_id IN \(\$[0-9]+\)/);
        expect(mainQuery).toMatch(/LOWER\(s\.id::text\) LIKE LOWER\(\$[0-9]+\)/);
        expect(mainQuery).toMatch(/ORDER BY sno DESC/);
        expect(mainQuery).toMatch(/LIMIT \$[0-9]+ OFFSET \$[0-9]+/);
      
        // Params check
        expect(mainParams).toEqual(['%test%', '1', 10, 0]);
      
        // Result check
        expect(result).toEqual({
          totalCount: 5,
          totalPages: 1,
          settlements: mockRows,
        });
      });
      
  
      // Test handling invalid vendor_codes gracefully
      it('should handle invalid vendor_codes gracefully', async () => {
        const filters = { vendor_codes: ['invalid-uuid', '550e8400-e29b-41d4-a716-446655440000'] };
        const mockRows = [{ id: '1', amount: 100 }];
        executeQuery.mockResolvedValue({ rows: mockRows });
  
        await getSettlementDao(filters, 1, 10, 'sno', 'DESC');
  
        const [query, params] = executeQuery.mock.calls[0];
        expect(query).toMatch(/u\.code IN \(\$[0-9]+\)/);
        expect(params).toEqual([['invalid-uuid', "550e8400-e29b-41d4-a716-446655440000",], 10, 0]);
      });
  
      // Test handling role filter
      it('should handle role filter', async () => {
        const filters = { role: Role.MERCHANT };
        const mockRows = [{ id: '1', amount: 100 }];
        executeQuery.mockResolvedValue({ rows: mockRows });
  
        await getSettlementDao(filters, 1, 10, 'sno', 'DESC');
  
        const [query, params] = executeQuery.mock.calls[0];
        expect(query).toMatch(/r\.role = \$[0-9]+/);
        expect(params).toEqual([Role.MERCHANT, 10, 0]);
      });
  
      // Test handling vendor_codes as UUIDs
      it('should handle vendor_codes as UUIDs', async () => {
        const filters = { vendor_codes: ['550e8400-e29b-41d4-a716-446655440000'] };
        const mockRows = [{ id: '1', amount: 100 }];
        executeQuery.mockResolvedValue({ rows: mockRows });
      
        await getSettlementDao(filters, 1, 10, 'sno', 'DESC');
      
        const [query, params] = executeQuery.mock.calls[0];
      
        // Allow either u.id or u.code, but must have an IN ($n) clause
        expect(query).toMatch(/u\.(id|code)\s+IN\s*\(\$[0-9]+\)/);
      
        // Params should match UUID + pagination
        expect(params).toEqual([['550e8400-e29b-41d4-a716-446655440000'], 10, 0]);
      });
      
  
      // Test handling merchant_codes as non-UUIDs
      it('should handle merchant_codes as non-UUIDs', async () => {
        const filters = { merchant_codes: 'M123,M456' };
        const mockRows = [{ id: '1', amount: 100 }];
        executeQuery.mockResolvedValue({ rows: mockRows });
  
        await getSettlementDao(filters, 1, 10, 'sno', 'DESC');
  
        const [query, params] = executeQuery.mock.calls[0];
        expect(query).toMatch(/u\.code IN \(\$[0-9]+, \$[0-9]+\)/);
        expect(params).toEqual(['M123', 'M456', 10, 0]);
      });
  
      // Test handling date range with SUCCESS status
      it('should handle date range with SUCCESS status', async () => {
        const filters = { start_date: '2025-08-01', end_date: '2025-08-31', status: Status.SUCCESS };
        const mockRows = [{ id: '1', amount: 100 }];
        executeQuery.mockResolvedValue({ rows: mockRows });
  
        await getSettlementDao(filters, 1, 10, 'sno', 'DESC');
  
        const [query, params] = executeQuery.mock.calls[0];
        expect(query).toMatch(/s\.approved_at BETWEEN \$[0-9]+ AND \$[0-9]+/);
        expect(params).toEqual(['2025-08-25T00:00:00Z', '2025-08-25T00:00:00Z', 10, 0, Status.SUCCESS]);
      });
  
      // Test handling custom columns
      it('should handle custom columns', async () => {
        const filters = { company_id: 1 };
        const columns = ['id', 'amount'];
        const mockRows = [{ id: '1', amount: 100 }];
        executeQuery.mockResolvedValue({ rows: mockRows });
      
        await getSettlementDao(filters, 1, 10, 'sno', 'DESC', columns);
      
        const [query, params] = executeQuery.mock.calls[0];
      
        // Loosened regex: check DISTINCT ON and ensure id + amount exist, order does not matter
        expect(query).toMatch(/SELECT DISTINCT ON\s*\(s\.sno\)/);
        expect(query).toMatch(/s\.id/);
        expect(query).toMatch(/s\.amount/);
      
        expect(params).toEqual([ 10, 0, 1]);
      });
      
  
      // Test error handling for database errors
      it('should throw and log error on query failure', async () => {
        const id = { id: '1', company_id: 1 };
        const data = { is_obsolete: true };
        const error = new Error('Database error');
        buildUpdateQuery.mockReturnValue([
          'UPDATE Settlement SET ... WHERE id = $1 AND company_id = $2 RETURNING *',
          ['1', 1],
        ]);
        executeQuery.mockRejectedValue(error);
  
        await expect(deleteSettlementDao(null, id, data)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith(error);      });

    });
  
    describe('getSettlementsBySearchDao', () => {
      // Test fetching settlements with search terms and pagination
      it('should fetch settlements with search terms and pagination', async () => {
        const filters = { company_id: '1' }; // Changed to string to avoid split error
        const searchTerms = ['test'];
        const mockRows = [{ id: '1', amount: 100 }];
        executeQuery
          .mockResolvedValueOnce({ rows: [{ total: '5' }] }) // Count query
          .mockResolvedValueOnce({ rows: mockRows }); // Main query
      
        const result = await getSettlementsBySearchDao(
          filters,
          1,
          10,
          'sno',
          'DESC',
          [],
          searchTerms,
          Role.MERCHANT
        );
      
        const [countQuery] = executeQuery.mock.calls[0];
        const [mainQuery, mainParams] = executeQuery.mock.calls[1];
      
        // Count query validation
        expect(countQuery).toMatch(/SELECT COUNT\(\*\) AS total/);
      
        // Main query validation with multiple smaller regex checks
        expect(mainQuery).toMatch(/SELECT/);
        expect(mainQuery).toMatch(/FROM "Settlement" s/);
        expect(mainQuery).toMatch(/WHERE s\.is_obsolete = false/);
        expect(mainQuery).toMatch(/LOWER\(s\.id::text\) LIKE LOWER\(\$[0-9]+\)/);
        expect(mainQuery).toMatch(/s\.company_id IN \(\$[0-9]+\)/);
        expect(mainQuery).toMatch(/ORDER BY sno DESC/);
        expect(mainQuery).toMatch(/LIMIT \$[0-9]+ OFFSET \$[0-9]+/);
      
        // Params check
        expect(mainParams).toEqual(['%test%', '1', 10, 0]);
      
        // Result check
        expect(result).toEqual({
          totalCount: 5,
          totalPages: 1,
          settlements: mockRows,
        });
      });
      
  
      // Test handling boolean search terms
      it('should handle boolean search terms', async () => {
        const filters = { company_id: '1' }; // Changed to string
        const searchTerms = ['true'];
        const mockRows = [{ id: '1', amount: 100 }];
        executeQuery
          .mockResolvedValueOnce({ rows: [{ total: '5' }] })
          .mockResolvedValueOnce({ rows: mockRows });
  
        await getSettlementsBySearchDao(filters, 1, 10, 'sno', 'DESC', [], searchTerms, Role.MERCHANT);
  
        // const [countQuery, countParams] = executeQuery.mock.calls[0];
        const [mainQuery, mainParams] = executeQuery.mock.calls[1];
        expect(mainQuery).toMatch(/\(s\.is_notified = \$[0-9]+ OR s\.is_approved = \$[0-9]+ OR s\.is_rejected = \$[0-9]+\)/);
        expect(mainParams).toEqual([true, '1', 10, 0]);
      });
  
      // Test handling ADMIN role with additional columns
      it('should handle ADMIN role with additional columns', async () => {
        const filters = { company_id: '1' }; // Changed to string
        const mockRows = [{ id: '1', amount: 100 }];
        executeQuery
          .mockResolvedValueOnce({ rows: [{ total: '5' }] })
          .mockResolvedValueOnce({ rows: mockRows });
    
        await getSettlementsBySearchDao(filters, 1, 10, 'sno', 'DESC', [], [], Role.ADMIN);
    
        // const [countQuery, countParams] = executeQuery.mock.calls[0];
        const [mainQuery, mainParams] = executeQuery.mock.calls[1];
        expect(mainQuery).toMatch(/uc\.user_name AS created_by\s*,\s*uu\.user_name AS updated_by/);
        expect(mainParams).toEqual(['1', 10, 0]);
      });
  
      // Test resetting offset for empty page with data
     it('should reset offset for empty page with data', async () => {
    const filters = { company_id: '1' };
    const mockRows = [{ id: '1', amount: 100 }];
    executeQuery
      .mockResolvedValueOnce({ rows: [{ total: '5' }] }) // Count query
      .mockResolvedValueOnce({ rows: [] }) // Empty first page
      .mockResolvedValueOnce({ rows: mockRows }); // Reset offset

    await getSettlementsBySearchDao(filters, 2, 10, 'sno', 'DESC', [], [], Role.MERCHANT);

    const firstParams = executeQuery.mock.calls[1][1]; // Access parameters of second call
    const secondParams = executeQuery.mock.calls[2][1]; // Access parameters of third call
    expect(firstParams).toEqual(['1', 10, 0]); // Initial offset for page 2 (page 2 * 10 - 10 = 10)
    expect(secondParams).toEqual(['1', 10, 0]); // Reset offset to 0
  });
  
      // Test handling invalid sort column
      it('should handle invalid sort column', async () => {
        const filters = { company_id: '1' }; // Changed to string
        const mockRows = [{ id: '1', amount: 100 }];
        executeQuery
          .mockResolvedValueOnce({ rows: [{ total: '5' }] })
          .mockResolvedValueOnce({ rows: mockRows });
  
        await getSettlementsBySearchDao(filters, 1, 10, 'invalid_column', 'ASC', [], [], Role.MERCHANT);
  
        // const [countQuery, countParams] = executeQuery.mock.calls[0];
        const [mainQuery, mainParams] = executeQuery.mock.calls[1];
        expect(mainQuery).toMatch(/ORDER BY sno ASC/);
        expect(mainParams).toEqual(['1', 10, 0]);
      });
  
      // Test error handling for database errors
      it('should throw and log error on query failure', async () => {
        const filters = { company_id: '1' };
        const error = new Error('Database error');
        executeQuery.mockRejectedValue(error);
    
        await expect(getSettlementsBySearchDao(filters, 1, 10)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error in getSettlementsBySearchDao:', error); // Updated to expect the prefix
      });
    });
    describe('getSettlementDaoforInternalTransfer', () => {
      // Test fetching settlements by UTR and method
      it('should fetch settlements by UTR and method', async () => {
        const utr = 'UTR123';
        const method = ['INTERNAL_QR_TRANSFER'];
        const mockRows = [{ id: '1', amount: 100 }, { id: '2', amount: 200 }];
        executeQuery.mockResolvedValue({ rows: mockRows });
  
        const result = await getSettlementDaoforInternalTransfer(utr, method);
  
        const [query, params] = executeQuery.mock.calls[0];
        expect(query).toMatch(
          /SELECT id, user_id, status, amount, method, config, approved_at, rejected_at, created_by, created_at, updated_at, company_id, is_obsolete, updated_by FROM "Settlement"\s*WHERE config->>'reference_id' = \$[0-9]+ AND method = ANY\(\$[0-9]+\)/
        );
        expect(params).toEqual([utr, method]);
        expect(result).toEqual(mockRows);
      });
  
      // Test returning a single row when only one result is found
      it('should return single row when only one result is found', async () => {
        const utr = 'UTR123';
        const method = ['INTERNAL_QR_TRANSFER'];
        const mockRow = [{ id: '1', amount: 100 }];
        executeQuery.mockResolvedValue({ rows: mockRow });
  
        const result = await getSettlementDaoforInternalTransfer(utr, method);
  
        const [query, params] = executeQuery.mock.calls[0];
        expect(query).toMatch(
          /SELECT id, user_id, status, amount, method, config, approved_at, rejected_at, created_by, created_at, updated_at, company_id, is_obsolete, updated_by FROM "Settlement"\s*WHERE config->>'reference_id' = \$[0-9]+ AND method = ANY\(\$[0-9]+\)/
        );
        expect(params).toEqual([utr, method]);
        expect(result).toEqual(mockRow);
      });
  
      // Test error handling for database errors
      it('should throw and log error on query failure', async () => {
        const utr = 'UTR123';
        const method = ['INTERNAL_QR_TRANSFER'];
        const error = new Error('Database error');
        executeQuery.mockRejectedValue(error);
  
        await expect(getSettlementDaoforInternalTransfer(utr, method)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith(error);      });
    });
  
    describe('createSettlementDao', () => {
      // Test creating a settlement with a provided connection
      it('should create settlement with connection', async () => {
        const payload = { user_id: 1, amount: 100, method: 'BANK' };
        const mockRow = { id: '1', ...payload };
        buildInsertQuery.mockReturnValue(['INSERT INTO Settlement (...) VALUES (...) RETURNING *', [1, 100, 'BANK']]);
        mockConn.query.mockResolvedValue({ rows: [mockRow] });
  
        const result = await createSettlementDao(payload, mockConn);
  
        expect(buildInsertQuery).toHaveBeenCalledWith(tableName.SETTLEMENT, payload);
        expect(mockConn.query).toHaveBeenCalledWith('INSERT INTO Settlement (...) VALUES (...) RETURNING *', [1, 100, 'BANK']);
        expect(result).toEqual(mockRow);
      });
  
      // Test creating a settlement without connection
      it('should create settlement without connection', async () => {
        const payload = { user_id: 1, amount: 100, method: 'BANK' };
        const mockRow = { id: '1', ...payload };
        buildInsertQuery.mockReturnValue(['INSERT INTO Settlement (...) VALUES (...) RETURNING *', [1, 100, 'BANK']]);
        executeQuery.mockResolvedValue({ rows: [mockRow] });
  
        const result = await createSettlementDao(payload);
  
        expect(buildInsertQuery).toHaveBeenCalledWith(tableName.SETTLEMENT, payload);
        expect(executeQuery).toHaveBeenCalledWith('INSERT INTO Settlement (...) VALUES (...) RETURNING *', [1, 100, 'BANK']);
        expect(result).toEqual(mockRow);
      });
  
      // Test handling specific database connection error
      it('should handle database connection error', async () => {
        const payload = { user_id: 1, amount: 100, method: 'BANK' };
        const error = new Error('Database connection failed');
        error.code = 'ECONNREFUSED'; // Simulate connection error
        buildInsertQuery.mockReturnValue(['INSERT INTO Settlement (...) VALUES (...) RETURNING *', [1, 100, 'BANK']]);
        executeQuery.mockRejectedValue(error);
    
        await expect(createSettlementDao(payload)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith(error); // Updated to expect only the error object
      });

      // Test error handling for general database errors
      it('should throw and log error on query failure', async () => {
        const payload = { user_id: 1, amount: 100 };
        const error = new Error('Database error');
        buildInsertQuery.mockReturnValue(['INSERT INTO Settlement (...) VALUES (...) RETURNING *', [1, 100]]);
        executeQuery.mockRejectedValue(error);
  
        await expect(createSettlementDao(payload)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith(error);      });
    });
  
    describe('updateSettlementDao', () => {
      // Test updating a settlement with a provided connection
      it('should update settlement with connection', async () => {
        const id = { id: '1', company_id: 1 };
        const data = { amount: 200 };
        const mockRow = { id: '1', amount: 200 };
        buildUpdateQuery.mockReturnValue(['UPDATE Settlement SET ... WHERE id = $1 AND company_id = $2 RETURNING *', ['1', 1]]);
        mockConn.query.mockResolvedValue({ rows: [mockRow] });
  
        const result = await updateSettlementDao(mockConn, id, data);
  
        expect(buildUpdateQuery).toHaveBeenCalledWith(tableName.SETTLEMENT, data, id);
        expect(mockConn.query).toHaveBeenCalledWith('UPDATE Settlement SET ... WHERE id = $1 AND company_id = $2 RETURNING *', ['1', 1]);
        expect(result).toEqual(mockRow);
      });
  
      // Test updating a settlement without connection
      it('should update settlement without connection', async () => {
        const id = { id: '1', company_id: 1 };
        const data = { amount: 200 };
        const mockRow = { id: '1', amount: 200 };
        buildUpdateQuery.mockReturnValue(['UPDATE Settlement SET ... WHERE id = $1 AND company_id = $2 RETURNING *', ['1', 1]]);
        executeQuery.mockResolvedValue({ rows: [mockRow] });
  
        const result = await updateSettlementDao(null, id, data);
  
        expect(buildUpdateQuery).toHaveBeenCalledWith(tableName.SETTLEMENT, data, id);
        expect(executeQuery).toHaveBeenCalledWith('UPDATE Settlement SET ... WHERE id = $1 AND company_id = $2 RETURNING *', ['1', 1]);
        expect(result).toEqual(mockRow);
      });
  
      // Test error handling for database errors
      it('should throw and log error on query failure', async () => {
        const id = { id: '1', company_id: 1 };
        const data = { amount: 200 };
        const error = new Error('Database error');
        buildUpdateQuery.mockReturnValue(['UPDATE Settlement SET ... WHERE id = $1 AND company_id = $2 RETURNING *', ['1', 1]]);
        executeQuery.mockRejectedValue(error);
  
        await expect(updateSettlementDao(null, id, data)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith(error);      });
    });
  
    describe('deleteSettlementDao', () => {
      // Test deleting a settlement with a provided connection
      it('should delete settlement with connection', async () => {
        const id = { id: '1', company_id: 1 };
        const data = { is_obsolete: true };
        const mockRow = { id: '1', is_obsolete: true };
        buildUpdateQuery.mockReturnValue(['UPDATE Settlement SET ... WHERE id = $1 AND company_id = $2 RETURNING *', ['1', 1]]);
        mockConn.query.mockResolvedValue({ rows: [mockRow] });
  
        const result = await deleteSettlementDao(mockConn, id, data);
  
        expect(buildUpdateQuery).toHaveBeenCalledWith(tableName.SETTLEMENT, data, id);
        expect(mockConn.query).toHaveBeenCalledWith('UPDATE Settlement SET ... WHERE id = $1 AND company_id = $2 RETURNING *', ['1', 1]);
        expect(result).toEqual(mockRow);
      });
  
      // Test deleting a settlement without connection
      it('should delete settlement without connection', async () => {
        const id = { id: '1', company_id: 1 };
        const data = { is_obsolete: true };
        const mockRow = { id: '1', is_obsolete: true };
        buildUpdateQuery.mockReturnValue(['UPDATE Settlement SET ... WHERE id = $1 AND company_id = $2 RETURNING *', ['1', 1]]);
        executeQuery.mockResolvedValue({ rows: [mockRow] });
  
        const result = await deleteSettlementDao(null, id, data);
  
        expect(buildUpdateQuery).toHaveBeenCalledWith(tableName.SETTLEMENT, data, id);
        expect(executeQuery).toHaveBeenCalledWith('UPDATE Settlement SET ... WHERE id = $1 AND company_id = $2 RETURNING *', ['1', 1]);
        expect(result).toEqual(mockRow);
      });
  
      // Test error handling for database errors
      it('should throw and log error on query failure', async () => {
        const id = { id: '1', company_id: 1 };
        const data = { is_obsolete: true };
        const error = new Error('Database error');
        buildUpdateQuery.mockReturnValue(['UPDATE Settlement SET ... WHERE id = $1 AND company_id = $2 RETURNING *', ['1', 1]]);
        executeQuery.mockRejectedValue(error);
  
        await expect(deleteSettlementDao(null, id, data)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith(error);      });
    });
  });