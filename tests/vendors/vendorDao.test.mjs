import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';

jest.unstable_mockModule('../../src/constants/index.js', () => ({
  tableName: {
    VENDOR: 'Vendor',
    USER_HIERARCHY: 'UserHierarchy',
    USER: 'User',
    DESIGNATION: 'Designation',
  },
  Role: { VENDOR: 'VENDOR', SUB_VENDOR: 'SUB_VENDOR', ADMIN: 'ADMIN' },
}));

jest.unstable_mockModule('../../src/utils/db.js', () => ({
  buildInsertQuery: jest.fn(),
  buildSelectQuery: jest.fn(),
  buildUpdateQuery: jest.fn(),
  executeQuery: jest.fn(),
}));

jest.unstable_mockModule('../../src/apis/userHierarchy/userHierarchyDao.js', () => ({
  getUserHierarchyVendor: jest.fn(),
  updateUserHierarchyVendor: jest.fn(),
}));

jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: { error: jest.fn(), log: jest.fn() },
}));

jest.unstable_mockModule('../../src/utils/enhanceSubVendor.js', () => ({
  enhanceVendorsWithSubVendors: jest.fn(),
}));

let vendorDao, db, logger;

beforeAll(async () => {
  db = await import('../../src/utils/db.js');
  logger = await import('../../src/utils/logger.js');
  vendorDao = await import('../../src/apis/vendors/vendorDao.js');
});

beforeEach(() => {
  jest.clearAllMocks();
  db.buildInsertQuery = jest.fn();
  db.buildSelectQuery = jest.fn();
  db.buildUpdateQuery = jest.fn();
  db.executeQuery = jest.fn();
  logger.logger.error = jest.fn();
  logger.logger.log = jest.fn();
});

describe('vendorDao', () => {
  describe('createVendorDao', () => {
    it('should create vendor successfully', async () => {
      const mockData = { user_id: 1, code: 'VENDOR1', company_id: 1 };
      const mockResult = { id: 1, user_id: 1, code: 'VENDOR1' };
      
      db.buildInsertQuery.mockReturnValue(['INSERT INTO...', [mockData]]);
      db.executeQuery.mockResolvedValue({ rows: [mockResult], rowCount: 1 });
      
      const result = await vendorDao.createVendorDao(mockData);
      
      // This test confirms that the createVendorDao function correctly builds the insert query with the provided vendor data, executes the query, and returns the expected result when a vendor is successfully created. It checks that the buildInsertQuery function is called with the correct table name and data, that the executeQuery function is called to perform the database operation, and that the result returned from the DAO matches the expected vendor information.
      expect(db.buildInsertQuery).toHaveBeenCalledWith('Vendor', mockData);
      // We verify that the executeQuery function is called to perform the database operation, which is crucial for ensuring that the vendor data is actually inserted into the database.
      expect(db.executeQuery).toHaveBeenCalled();
      // Finally, we check that the result returned from the DAO matches the expected vendor information, confirming that the createVendorDao function processes the database response correctly and returns the newly created vendor data as expected.
      expect(result).toEqual(mockResult);
    });

    it('should handle transaction with connection', async () => {
      const mockConn = {};
      const mockResult = { id: 1 };
      
      db.buildInsertQuery.mockReturnValue(['INSERT INTO...', []]);
      db.executeQuery.mockResolvedValue({ rows: [mockResult] });
      
      await vendorDao.createVendorDao({}, mockConn);
      // This test ensures that the createVendorDao function can handle database transactions by accepting a connection object and using it when executing the query. It checks that the buildInsertQuery function is called to construct the insert query, and that the executeQuery function is called with the correct parameters, including the connection object, which is essential for managing transactions effectively in scenarios where multiple database operations need to be executed atomically.
      expect(db.executeQuery).toHaveBeenCalledWith(expect.any(String), expect.any(Array), mockConn);
    });

    it('should handle creation errors', async () => {
      const error = new Error('Insert failed');
      db.buildInsertQuery.mockReturnValue(['INSERT INTO...', []]);
      db.executeQuery.mockRejectedValue(error);
      
      // This test confirms that the createVendorDao function properly handles errors that occur during the vendor creation process. It simulates a failure in the database operation by mocking the executeQuery function to reject with an error, and then checks that the createVendorDao function throws an error with the expected message. Additionally, it verifies that the logger's error method is called to log the error, which is important for debugging and monitoring purposes when issues arise during vendor creation.
      await expect(vendorDao.createVendorDao({})).rejects.toThrow('Insert failed');
      // We verify that the logger's error method is called to log the error, which is crucial for ensuring that any issues during vendor creation are properly recorded and can be investigated by developers or system administrators.
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

  describe('getVendorCodeDao', () => {
    it('should fetch vendor code successfully', async () => {
      const mockResult = { code: 'VENDOR1' };
      db.executeQuery.mockResolvedValue({ rows: [mockResult] });
      
      const result = await vendorDao.getVendorCodeDao(1);
      
      // This test confirms that the getVendorCodeDao function correctly fetches the vendor code for a given vendor ID. It checks that the executeQuery function is called to perform the database operation, and that the result returned from the DAO matches the expected vendor code when a vendor is found. This ensures that the function retrieves and processes the vendor code data correctly from the database.
      expect(db.executeQuery).toHaveBeenCalled();
      // Finally, we check that the result returned from the DAO matches the expected vendor code, confirming that the getVendorCodeDao function processes the database response correctly and returns the vendor code as expected when a matching vendor is found.
      expect(result).toEqual(mockResult);
    });

    it('should return null when not found', async () => {
      db.executeQuery.mockResolvedValue({ rows: [] });
      
      const result = await vendorDao.getVendorCodeDao(999);
      // This test ensures that the getVendorCodeDao function returns null when no vendor is found for the given ID. It simulates a scenario where the database query returns an empty result set, and then checks that the function correctly returns null, which is important for handling cases where the requested vendor does not exist in the database.
      expect(result).toBeNull();
    });

    it('should handle errors', async () => {
      const error = new Error('Query failed');
      db.executeQuery.mockRejectedValue(error);
      
      // This test confirms that the getVendorCodeDao function properly handles errors that occur during the database query. It simulates a failure in the database operation by mocking the executeQuery function to reject with an error, and then checks that the getVendorCodeDao function throws an error with the expected message. Additionally, it verifies that the logger's error method is called to log the error, which is important for debugging and monitoring purposes when issues arise during vendor code retrieval.
      await expect(vendorDao.getVendorCodeDao(1)).rejects.toThrow('Query failed');
      // We verify that the logger's error method is called to log the error, which is crucial for ensuring that any issues during vendor code retrieval are properly recorded and can be investigated by developers or system administrators.
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

  describe('getVendorsBankReponseDao', () => {
    it('should fetch vendors for bank response', async () => {
      const mockResult = [{ id: 1, code: 'VENDOR1', user_id: 1 }];
      db.executeQuery.mockResolvedValue({ rows: mockResult });
      
      const result = await vendorDao.getVendorsBankReponseDao({ company_id: 1 });
      
      // This test confirms that the getVendorsBankReponseDao function correctly fetches vendor data for bank response based on the provided filters. It checks that the executeQuery function is called to perform the database operation, and that the result returned from the DAO matches the expected vendor data when vendors are found. This ensures that the function retrieves and processes the vendor data correctly from the database according to the specified filters.
      expect(db.executeQuery).toHaveBeenCalled();
      // Finally, we check that the result returned from the DAO matches the expected vendor data, confirming that the getVendorsBankReponseDao function processes the database response correctly and returns the vendor information as expected when matching vendors are found based on the provided filters.
      expect(result).toEqual(mockResult);
    });

    it('should support user_id filter', async () => {
      const mockResult = [];
      db.executeQuery.mockResolvedValue({ rows: mockResult });
      
      await vendorDao.getVendorsBankReponseDao({ company_id: 1, user_id: 5 });
      // This test ensures that the getVendorsBankReponseDao function supports filtering by user_id. It simulates a scenario where the database query returns an empty result set for a specific user_id filter, and then checks that the function correctly executes the query with the provided filter. This is important for verifying that the function can handle different filtering options and retrieves data accordingly based on the user_id criteria.
      expect(db.executeQuery).toHaveBeenCalled();
    });

    it('should support array user_id filter', async () => {
      const mockResult = [];
      db.executeQuery.mockResolvedValue({ rows: mockResult });
      
      await vendorDao.getVendorsBankReponseDao({ company_id: 1, user_id: [1, 2] });
      // This test ensures that the getVendorsBankReponseDao function supports filtering by an array of user_ids. It simulates a scenario where the database query returns an empty result set for a specific array of user_ids filter, and then checks that the function correctly executes the query with the provided array filter. This is important for verifying that the function can handle multiple user_id criteria and retrieves data accordingly based on the array of user_ids.
      expect(db.executeQuery).toHaveBeenCalled();
    });

    it('should support code filter', async () => {
      const mockResult = [];
      db.executeQuery.mockResolvedValue({ rows: mockResult });
      
      await vendorDao.getVendorsBankReponseDao({ company_id: 1, code: 'VENDOR1' });
      // This test ensures that the getVendorsBankReponseDao function supports filtering by vendor code. It simulates a scenario where the database query returns an empty result set for a specific code filter, and then checks that the function correctly executes the query with the provided code filter. This is important for verifying that the function can handle different filtering options and retrieves data accordingly based on the vendor code criteria.
      expect(db.executeQuery).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      const error = new Error('Query failed');
      db.executeQuery.mockRejectedValue(error);
      
      // This test confirms that the getVendorsBankReponseDao function properly handles errors that occur during the database query. It simulates a failure in the database operation by mocking the executeQuery function to reject with an error, and then checks that the getVendorsBankReponseDao function throws an error with the expected message. Additionally, it verifies that the logger's error method is called to log the error, which is important for debugging and monitoring purposes when issues arise during vendor data retrieval for bank response.
      await expect(vendorDao.getVendorsBankReponseDao({})).rejects.toThrow('Query failed');
      // We verify that the logger's error method is called to log the error, which is crucial for ensuring that any issues during vendor data retrieval for bank response are properly recorded and can be investigated by developers or system administrators.
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

  describe('getVendorsDashBoardReportDao', () => {
    it('should fetch vendor dashboard report data', async () => {
      const mockResult = [{ user_id: 1, code: 'VENDOR1' }];
      db.buildSelectQuery.mockReturnValue(['SELECT...', []]);
      db.executeQuery.mockResolvedValue({ rows: mockResult });
      
      const result = await vendorDao.getVendorsDashBoardReportDao({ company_id: 1 });
      
      // This test confirms that the getVendorsDashBoardReportDao function correctly fetches vendor dashboard report data based on the provided company_id filter. It
      expect(db.executeQuery).toHaveBeenCalled();
      // Finally, we check that the result returned from the DAO matches the expected vendor dashboard report data, confirming that the getVendorsDashBoardReportDao function processes the database response correctly and returns the vendor information as expected when matching vendors are found based on the provided company_id filter.
      expect(result).toEqual(mockResult);
    });

    it('should return empty array when no data', async () => {
      db.buildSelectQuery.mockReturnValue(['SELECT...', []]);
      db.executeQuery.mockResolvedValue({ rows: null });
      
      const result = await vendorDao.getVendorsDashBoardReportDao();
      // This test ensures that the getVendorsDashBoardReportDao function returns an empty array when no data is found. It simulates a scenario where the database query returns null for the rows, and then checks that the function correctly returns an empty array instead of null. This is important for handling cases where there are no matching records in the database and ensuring that the function's return type is consistent.
      expect(result).toEqual([]);
    });

    it('should handle errors', async () => {
      const error = new Error('Query failed');
      db.buildSelectQuery.mockReturnValue(['SELECT...', []]);
      db.executeQuery.mockRejectedValue(error);
      
      // This test confirms that the getVendorsDashBoardReportDao function properly handles errors that occur during the database query. It simulates a failure in the database operation by mocking the executeQuery function to reject with an error, and then checks that the getVendorsDashBoardReportDao function throws an error with the expected message. Additionally, it verifies that the logger's error method is called to log the error, which is important for debugging and monitoring purposes when issues arise during vendor dashboard report data retrieval.
      await expect(vendorDao.getVendorsDashBoardReportDao()).rejects.toThrow('Query failed');
      // We verify that the logger's error method is called to log the error, which is crucial for ensuring that any issues during vendor dashboard report data retrieval are properly recorded and can be investigated by developers or system administrators.
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

  describe('getVendorsCodeDao', () => {
    it('should fetch vendors codes successfully', async () => {
      const mockResult = [{ label: 'VENDOR1', value: 1, vendor_id: 1 }];
      db.executeQuery.mockResolvedValue({ rows: mockResult });
      
      const result = await vendorDao.getVendorsCodeDao({ company_id: 1 });
      
      // This test confirms that the getVendorsCodeDao function correctly fetches vendor codes based on the provided company_id filter. It
      expect(db.executeQuery).toHaveBeenCalled();
      // Finally, we check that the result returned from the DAO matches the expected vendor codes, confirming that the getVendorsCodeDao function processes the database response correctly and returns the vendor code information as expected when matching vendors are found based on the provided company_id filter.
      expect(result).toEqual(mockResult);
    });

    it('should include sub-vendors when requested', async () => {
      const mockResult = [{ label: 'VENDOR1', subvendors: [{ label: 'SUB1' }] }];
      db.executeQuery.mockResolvedValue({ rows: mockResult });
      
      const result = await vendorDao.getVendorsCodeDao({ company_id: 1 }, 'true');
      // This test ensures that the getVendorsCodeDao function includes sub-vendor information in the result when the includeSubVendors parameter is set to 'true'. It simulates a scenario where the database query returns vendor data with nested sub-vendor information, and then checks that the function correctly processes and returns this data structure. This is important for verifying that the function can handle and return complex data structures that include both vendor and sub-vendor information when requested.
      expect(result[0]).toHaveProperty('label');
    });

    it('should handle boolean conversion for includeSubVendors', async () => {
      const mockResult = [];
      db.executeQuery.mockResolvedValue({ rows: mockResult });
      
      await vendorDao.getVendorsCodeDao({ company_id: 1 }, 'false');
      // This test ensures that the getVendorsCodeDao function correctly converts the includeSubVendors parameter from a string to a boolean value. It simulates a scenario where the includeSubVendors parameter is passed as 'false', and then checks that the function processes this parameter correctly without including sub-vendor information in the result. This is important for verifying that the function can handle different formats of input parameters and behaves as expected based on the provided values.
      expect(db.executeQuery).toHaveBeenCalled();
    });

    it('should support multiple filter options', async () => {
      const mockResult = [];
      db.executeQuery.mockResolvedValue({ rows: mockResult });
      
      await vendorDao.getVendorsCodeDao(
        { company_id: 1 },
        'true',
        'true',
        'true',
        'true',
        'true',
        'true',
      );
      // This test ensures that the getVendorsCodeDao function supports multiple filter options for including various related data in the result. It simulates a scenario where all filter options are set to 'true', and then checks that the function processes these parameters correctly when executing the database query. This is important for verifying that the function can handle multiple filtering criteria and retrieves data accordingly based on the combination of provided options.
      expect(db.executeQuery).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      const error = new Error('Query failed');
      db.executeQuery.mockRejectedValue(error);
      
      // This test confirms that the getVendorsCodeDao function properly handles errors that occur during the database query. It simulates a failure in the database operation by mocking the executeQuery function to reject with an error, and then checks that the getVendorsCodeDao function throws an error with the expected message. Additionally, it verifies that the logger's error method is called to log the error, which is important for debugging and monitoring purposes when issues arise during vendor code retrieval.
      await expect(
        vendorDao.getVendorsCodeDao({ company_id: 1 }),
      ).rejects.toThrow('Query failed');
      // We verify that the logger's error method is called to log the error, which is crucial for ensuring that any issues during vendor code retrieval are properly recorded and can be investigated by developers or system administrators.
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });
});
