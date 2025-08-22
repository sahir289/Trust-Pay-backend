const {
    getCompanyDao,
    getCompanyDetailsByIdDao,
    getCompanyByIDDao,
    createCompanyDao,
    updateCompanyDao,
    updateCompanyConfigDao,
    deleteCompanyDao,
  } = require('./companyDao');
  const { executeQuery, buildSelectQuery, buildInsertQuery, buildUpdateQuery, buildAndExecuteUpdateQuery } = require('../../utils/db');
  const { logger } = require('../../utils/logger');
  const { tableName } = require('../../constants');
  
  jest.mock('../../utils/db');
  jest.mock('../../utils/logger');
  
  describe('Company DAO', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    describe('getCompanyDao', () => {
      const mockFilters = { name: 'Test Corp' };
      const mockPage = 1;
      const mockPageSize = 10;
      const mockSortBy = 'first_name';
      const mockSortOrder = 'ASC';
      const mockRows = [
        { id: 1, first_name: 'Test', last_name: 'Corp', config: { key: 'value' } },
      ];
  
      test('should return rows when data is found', async () => {
        const mockResult = { rows: mockRows };
        buildSelectQuery.mockReturnValue(['SELECT ...', [mockFilters.name]]);
        executeQuery.mockResolvedValue(mockResult);
  
        const result = await getCompanyDao(mockFilters, mockPage, mockPageSize, mockSortBy, mockSortOrder);
  
        expect(buildSelectQuery).toHaveBeenCalledWith(
          expect.any(String),
          mockFilters,
          mockPage,
          mockPageSize,
          mockSortBy,
          mockSortOrder
        );
        expect(executeQuery).toHaveBeenCalled();
        expect(result).toEqual(mockRows);
      });
  
      test('should return array with single row when only one row is found', async () => {
        const mockResult = { rows: [mockRows[0]] };
        buildSelectQuery.mockReturnValue(['SELECT ...', [mockFilters.name]]);
        executeQuery.mockResolvedValue(mockResult);
  
        const result = await getCompanyDao(mockFilters, mockPage, mockPageSize, mockSortBy, mockSortOrder);
  
        expect(result).toEqual([mockRows[0]]);
      });
  
      test('should handle errors and log them', async () => {
        const error = new Error('Database error');
        buildSelectQuery.mockReturnValue(['SELECT ...', [mockFilters.name]]);
        executeQuery.mockRejectedValue(error);
  
        await expect(getCompanyDao(mockFilters, mockPage, mockPageSize, mockSortBy, mockSortOrder))
          .rejects.toThrow('Database error');
        expect(logger.error).toHaveBeenCalledWith('Error fetching company:', error);
      });
  
      test('should handle empty result set', async () => {
        const mockResult = { rows: [] };
        buildSelectQuery.mockReturnValue(['SELECT ...', [mockFilters.name]]);
        executeQuery.mockResolvedValue(mockResult);
  
        const result = await getCompanyDao(mockFilters, mockPage, mockPageSize, mockSortBy, mockSortOrder);
  
        expect(result).toEqual(undefined);
      });
    });
  
    describe('getCompanyDetailsByIdDao', () => {
      const mockId = 1;
      const mockRows = [{ full_name: 'Test Corp', allowPayAssist: 'true' }];
  
      test('should return company details for valid ID', async () => {
        const mockResult = { rows: mockRows };
        buildSelectQuery.mockReturnValue(['SELECT ...', [mockId]]);
        executeQuery.mockResolvedValue(mockResult);
  
        const result = await getCompanyDetailsByIdDao(mockId);
  
        expect(buildSelectQuery).toHaveBeenCalledWith(expect.any(String), mockId);
        expect(executeQuery).toHaveBeenCalled();
        expect(result).toEqual(mockRows);
      });
  
      test('should return array with single row when only one row is found', async () => {
        const mockResult = { rows: [mockRows[0]] };
        buildSelectQuery.mockReturnValue(['SELECT ...', [mockId]]);
        executeQuery.mockResolvedValue(mockResult);
  
        const result = await getCompanyDetailsByIdDao(mockId);
  
        expect(result).toEqual([mockRows[0]]); // Expect array with one row
      });
  
      test('should handle errors and log them', async () => {
        const error = new Error('Database error');
        buildSelectQuery.mockReturnValue(['SELECT ...', [mockId]]);
        executeQuery.mockRejectedValue(error);
  
        await expect(getCompanyDetailsByIdDao(mockId)).rejects.toThrow('Database error');
        expect(logger.error).toHaveBeenCalledWith('Error fetching company details by ID:', error);
      });
    });
  
    describe('getCompanyByIDDao', () => {
      const mockFilters = { id: 1 };
      const mockRows = [{ id: 1, config: { key: 'value' } }];
  
      test('should return company data for valid filters', async () => {
        const mockResult = { rows: mockRows };
        buildSelectQuery.mockReturnValue(['SELECT ...', [mockFilters.id]]);
        executeQuery.mockResolvedValue(mockResult);
  
        const result = await getCompanyByIDDao(mockFilters);
  
        expect(buildSelectQuery).toHaveBeenCalledWith(expect.any(String), mockFilters);
        expect(executeQuery).toHaveBeenCalled();
        expect(result).toEqual(mockRows);
      });
  
      test('should return array with single row when only one row is found', async () => {
        const mockResult = { rows: [mockRows[0]] };
        buildSelectQuery.mockReturnValue(['SELECT ...', [mockFilters.id]]);
        executeQuery.mockResolvedValue(mockResult);
  
        const result = await getCompanyByIDDao(mockFilters);
  
        expect(result).toEqual([mockRows[0]]); // Expect array with one row
      });
  
      test('should handle errors and log them', async () => {
        const error = new Error('Database error');
        buildSelectQuery.mockReturnValue(['SELECT ...', [mockFilters.id]]);
        executeQuery.mockRejectedValue(error);
  
        await expect(getCompanyByIDDao(mockFilters)).rejects.toThrow('Database error');
        expect(logger.error).toHaveBeenCalledWith('Error fetching company:', error);
      });
    });
  
    describe('createCompanyDao', () => {
      const mockPayload = { first_name: 'Test', last_name: 'Corp', config: { key: 'value' } };
      const mockConn = { query: jest.fn() };
      const mockRows = [{ id: 1, ...mockPayload }];
  
      test('should create company with connection', async () => {
        const mockResult = { rows: mockRows };
        buildInsertQuery.mockReturnValue(['INSERT ...', [mockPayload.first_name, mockPayload.last_name, mockPayload.config]]);
        mockConn.query.mockResolvedValue(mockResult);
  
        const result = await createCompanyDao(mockConn, mockPayload);
  
        expect(buildInsertQuery).toHaveBeenCalledWith(tableName.COMPANY, mockPayload);
        expect(mockConn.query).toHaveBeenCalled();
        expect(result).toEqual(mockRows[0]);
      });
  
      test('should create company without connection', async () => {
        const mockResult = { rows: mockRows };
        buildInsertQuery.mockReturnValue(['INSERT ...', [mockPayload.first_name, mockPayload.last_name, mockPayload.config]]);
        executeQuery.mockResolvedValue(mockResult);
  
        const result = await createCompanyDao(null, mockPayload);
  
        expect(buildInsertQuery).toHaveBeenCalledWith(tableName.COMPANY, mockPayload);
        expect(executeQuery).toHaveBeenCalled();
        expect(result).toEqual(mockRows);
      });
  
      test('should handle errors and log them', async () => {
        const error = new Error('Database error');
        buildInsertQuery.mockReturnValue(['INSERT ...', [mockPayload.first_name, mockPayload.last_name, mockPayload.config]]);
        executeQuery.mockRejectedValue(error);
  
        await expect(createCompanyDao(null, mockPayload)).rejects.toThrow('Database error');
        expect(logger.error).toHaveBeenCalledWith('Error fetching company:', error);
      });
    });
  
    describe('updateCompanyDao', () => {
      const mockId = 1;
      const mockData = { first_name: 'Updated' };
      const mockRows = [{ id: 1, first_name: 'Updated' }];
  
      test('should update company successfully', async () => {
        const mockResult = { rows: mockRows };
        buildUpdateQuery.mockReturnValue(['UPDATE ...', [mockData.first_name, mockId]]);
        executeQuery.mockResolvedValue(mockResult);
  
        const result = await updateCompanyDao(mockId, mockData);
  
        expect(buildUpdateQuery).toHaveBeenCalledWith(tableName.COMPANY, mockData, mockId);
        expect(executeQuery).toHaveBeenCalled();
        expect(result).toEqual(mockRows[0]);
      });
  
      test('should handle errors and log them', async () => {
        const error = new Error('Database error');
        buildUpdateQuery.mockReturnValue(['UPDATE ...', [mockData.first_name, mockId]]);
        executeQuery.mockRejectedValue(error);
  
        await expect(updateCompanyDao(mockId, mockData)).rejects.toThrow('Database error');
        expect(logger.error).toHaveBeenCalledWith('Error updating company:', error);
      });
    });
  
    describe('updateCompanyConfigDao', () => {
      const mockId = 1;
      const mockData = { config: { key: 'new_value' } };
      const mockConn = { query: jest.fn() };
      const mockResult = { id: 1, config: { key: 'new_value' } };
  
      test('should update company config successfully', async () => {
        buildAndExecuteUpdateQuery.mockResolvedValue(mockResult);
  
        const result = await updateCompanyConfigDao(mockId, mockData, mockConn);
  
        expect(buildAndExecuteUpdateQuery).toHaveBeenCalledWith(
          tableName.COMPANY,
          mockData,
          mockId,
          {},
          { returnUpdated: true },
          mockConn
        );
        expect(result).toEqual(mockResult);
      });
  
      test('should handle errors', async () => {
        const error = new Error('Database error');
        buildAndExecuteUpdateQuery.mockRejectedValue(error);
  
        await expect(updateCompanyConfigDao(mockId, mockData, mockConn)).rejects.toThrow('Database error');
      });
    });
  
    describe('deleteCompanyDao', () => {
      const mockId = 1;
      const mockData = { is_active: false };
      const mockRows = [{ id: 1, is_active: false }];
  
      test('should delete (soft delete) company successfully', async () => {
        const mockResult = { rows: mockRows };
        buildUpdateQuery.mockReturnValue(['UPDATE ...', [mockData.is_active, mockId]]);
        executeQuery.mockResolvedValue(mockResult);
  
        const result = await deleteCompanyDao(mockId, mockData);
  
        expect(buildUpdateQuery).toHaveBeenCalledWith(tableName.COMPANY, mockData, mockId);
        expect(executeQuery).toHaveBeenCalled();
        expect(result).toEqual(mockRows[0]);
      });
  
      test('should handle errors and log them', async () => {
        const error = new Error('Database error');
        buildUpdateQuery.mockReturnValue(['UPDATE ...', [mockData.is_active, mockId]]);
        executeQuery.mockRejectedValue(error);
  
        await expect(deleteCompanyDao(mockId, mockData)).rejects.toThrow('Database error');
        expect(logger.error).toHaveBeenCalledWith('Error deleting company:', error);
      });
    });
  });