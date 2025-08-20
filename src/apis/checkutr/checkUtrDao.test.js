const {
    getCheckUtrDao,
    getCheckUtrBySearchDao,
    createCheckUtrDao,
    updateCheckUtrDao,
    deleteCheckUtrDao,
  } = require('./checkUtrDao');
  const { executeQuery, buildInsertQuery, buildUpdateQuery } = require('../../utils/db');
  const { logger } = require('../../utils/logger');
  const dayjs = require('dayjs');
  
  jest.mock('../../utils/db', () => ({
    executeQuery: jest.fn(),
    buildInsertQuery: jest.fn(),
    buildUpdateQuery: jest.fn(),
  }));
  jest.mock('../../utils/logger', () => ({
    logger: {
      error: jest.fn(),
    },
  }));
  jest.mock('dayjs', () => {
    const actualDayjs = jest.requireActual('dayjs');
    return {
      ...actualDayjs,
      tz: jest.fn(() => ({
        toISOString: jest.fn(() => '2023-01-01T00:00:00.000Z'),
      })),
    };
  });
  
  describe('Check UTR DAO', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    describe('getCheckUtrDao', () => {
      test('should fetch check UTR records with pagination and filters', async () => {
        const mockRows = [
          { sno: 1, payin_id: 123, merchant_order_id: 'ORD123' },
        ];
        executeQuery.mockResolvedValue({ rows: mockRows });
  
        const filters = {
          company_id: 'COMP123',
          startDate: '2023-01-01',
          endDate: '2023-01-02',
          search: 'ORD123',
        };
        const result = await getCheckUtrDao(filters, 1, 10, 'sno', 'DESC', ['sno', 'payin_id']);
  
        expect(executeQuery).toHaveBeenCalled();
        expect(result).toEqual({ checkutr: mockRows });
        expect(dayjs.tz).toHaveBeenCalledWith('2023-01-01 00:00:00', 'Asia/Kolkata');
      });
  
      test('should handle errors', async () => {
        const error = new Error('Database error');
        executeQuery.mockRejectedValue(error);
  
        await expect(getCheckUtrDao({ company_id: 'COMP123' })).rejects.toThrow('Database error');
        expect(logger.error).toHaveBeenCalledWith('Error getting all CheckUtr:', error);
      });
    });
  
    describe('getCheckUtrBySearchDao', () => {
      test('should fetch records with search terms', async () => {
        const mockRows = [
          { id: 1, merchant_order_id: 'ORD123', amount: 1000 },
        ];
        executeQuery
          .mockResolvedValueOnce({ rows: [{ total: '5' }] })
          .mockResolvedValueOnce({ rows: mockRows });
  
        const result = await getCheckUtrBySearchDao('COMP123', ['ORD123'], 10, 0);
  
        expect(executeQuery).toHaveBeenCalledTimes(2);
        expect(result).toEqual({
          totalCount: 5,
          totalPages: 1,
          checkUtr: mockRows,
        });
      });
  
      test('should handle boolean search terms', async () => {
        executeQuery
          .mockResolvedValueOnce({ rows: [{ total: '2' }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, is_obsolete: false }] });
  
        await getCheckUtrBySearchDao('COMP123', ['true'], 10, 0);
  
        expect(executeQuery).toHaveBeenCalled();
        expect(executeQuery.mock.calls[0][1]).toContain(true);
      });
  
      test('should reset offset when no results found', async () => {
        executeQuery
          .mockResolvedValueOnce({ rows: [{ total: '5' }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ id: 1 }] });
  
        const result = await getCheckUtrBySearchDao('COMP123', ['ORD123'], 10, 20);
  
        expect(executeQuery).toHaveBeenCalledTimes(3);
        expect(executeQuery.mock.calls[2][1]).toContain(0);
        expect(result.checkUtr).toHaveLength(1);
      });
  
      test('should handle errors', async () => {
        const error = new Error('Database error');
        executeQuery.mockRejectedValue(error);
  
        await expect(getCheckUtrBySearchDao('COMP123', ['ORD123'], 10, 0)).rejects.toThrow('Database error');
        expect(logger.error).toHaveBeenCalledWith(error);
      });
    });
  
    describe('createCheckUtrDao', () => {
      test('should create a new check UTR record', async () => {
        const mockPayload = { payin_id: 123, company_id: 'COMP123' };
        const mockResult = { id: 1, ...mockPayload };
        const mockSql = 'INSERT INTO check_utr_history ...';
        const mockParams = [123, 'COMP123'];
        buildInsertQuery.mockReturnValue([mockSql, mockParams]);
        executeQuery.mockResolvedValue({ rows: [mockResult] });
  
        const result = await createCheckUtrDao(mockPayload);
  
        expect(buildInsertQuery).toHaveBeenCalledWith('CheckUtrHistory', mockPayload);
        expect(executeQuery).toHaveBeenCalledWith(mockSql, mockParams);
        expect(result).toEqual(mockResult);
      });
  
      test('should handle errors', async () => {
        const error = new Error('Database error');
        buildInsertQuery.mockImplementation(() => { throw error; });
  
        await expect(createCheckUtrDao({ payin_id: 123 })).rejects.toThrow('Database error');
        expect(logger.error).toHaveBeenCalledWith('Error creating CheckUtr:', error);
      });
    });
  
    describe('updateCheckUtrDao', () => {
      test('should update an existing check UTR record', async () => {
        const mockData = { status: 'updated' };
        const mockResult = { id: 1, ...mockData };
        const mockSql = 'UPDATE check_utr_history ...';
        const mockParams = ['updated', 1];
        buildUpdateQuery.mockReturnValue([mockSql, mockParams]);
        executeQuery.mockResolvedValue({ rows: [mockResult] });
  
        const result = await updateCheckUtrDao(1, mockData);
  
        expect(buildUpdateQuery).toHaveBeenCalledWith('CheckUtrHistory', mockData, { id: 1 });
        expect(executeQuery).toHaveBeenCalledWith(mockSql, mockParams);
        expect(result).toEqual(mockResult);
      });
  
      test('should handle errors', async () => {
        const error = new Error('Database error');
        buildUpdateQuery.mockImplementation(() => { throw error; });
  
        await expect(updateCheckUtrDao(1, { status: 'updated' })).rejects.toThrow('Database error');
        expect(logger.error).toHaveBeenCalledWith('Error updating CheckUtr:', error);
      });
    });
  
    describe('deleteCheckUtrDao', () => {
      test('should soft delete a check UTR record', async () => {
        const mockData = { is_obsolete: true };
        const mockResult = { id: 1, ...mockData };
        const mockSql = 'UPDATE check_utr_history ...';
        const mockParams = [true, 1];
        buildUpdateQuery.mockReturnValue([mockSql, mockParams]);
        executeQuery.mockResolvedValue({ rows: [mockResult] });
  
        const result = await deleteCheckUtrDao(1, mockData);
  
        expect(buildUpdateQuery).toHaveBeenCalledWith('CheckUtrHistory', mockData, { id: 1 });
        expect(executeQuery).toHaveBeenCalledWith(mockSql, mockParams);
        expect(result).toEqual(mockResult);
      });
  
      test('should handle errors', async () => {
        const error = new Error('Database error');
        buildUpdateQuery.mockImplementation(() => { throw error; });
  
        await expect(deleteCheckUtrDao(1, { is_obsolete: true })).rejects.toThrow('Database error');
        expect(logger.error).toHaveBeenCalledWith('Error deleting CheckUtr:', error);
      });
    });
  });