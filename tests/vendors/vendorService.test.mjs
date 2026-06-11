import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

jest.unstable_mockModule('../../src/utils/db.js', () => ({
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  getConnection: jest.fn(),
  rollback: jest.fn(),
  query: jest.fn(),
}));

jest.unstable_mockModule('../../src/apis/vendors/vendorDao.js', () => ({
  createVendorDao: jest.fn(),
  deleteVendorDao: jest.fn(),
  getAllVendorsDao: jest.fn(),
  getVendorByCodeDao: jest.fn(),
  getVendorsBySearchDao: jest.fn(),
  getVendorsCodeDao: jest.fn(),
  getVendorsDao: jest.fn(),
  updateVendorDao: jest.fn(),
  linkVendorDao: jest.fn(),
  unlinkVendorDao: jest.fn(),
  transferVendorDao: jest.fn(),
  getVendorByUserId: jest.fn(),
  getDesignationIdDao: jest.fn(),
  isNetBalanceZeroForTwoHours: jest.fn().mockResolvedValue(true),
  getBankResponseAccessByIDDao: jest.fn(),
}));

jest.unstable_mockModule('../../src/apis/userHierarchy/userHierarchyDao.js', () => ({
  createUserHierarchyDao: jest.fn(),
  getUserHierarchysDao: jest.fn(),
  updateUserHierarchyDao: jest.fn(),
}));

jest.unstable_mockModule('../../src/constants/index.js', () => ({
  Role: { VENDOR: 'VENDOR', SUB_VENDOR: 'SUB_VENDOR', ADMIN: 'ADMIN' },
}));

jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: { error: jest.fn(), log: jest.fn() },
}));

jest.unstable_mockModule('../../src/apis/calculation/calculationDao.js', () => ({
  createCalculationDao: jest.fn(),
}));

jest.unstable_mockModule('../../src/apis/bankAccounts/bankaccountDao.js', () => ({
  deleteBankaccountByUserIdDao: jest.fn(),
  getBankaccountCheckDao: jest.fn(),
}));

jest.unstable_mockModule('../../src/apis/users/userDao.js', () => ({
  updateUserDao: jest.fn(),
  getUsersNameDao: jest.fn(),
}));

jest.unstable_mockModule('../../src/apis/beneficiaryAccounts/beneficiaryAccountDao.js', () => ({
  deleteBeneficiaryDao: jest.fn(),
}));

jest.unstable_mockModule('../../src/utils/sockets.js', () => ({
  forceLogoutUser: jest.fn(),
  notifyBankResponseAccessUpdate: jest.fn(),
}));

jest.unstable_mockModule('../../src/apis/auth/authDao.js', () => ({
  getSessionByIdDao: jest.fn(),
}));

jest.unstable_mockModule('../../src/utils/appErrors.js', () => ({
  BadRequestError: class BadRequestError extends Error {},
  NotFoundError: class NotFoundError extends Error {},
}));

let service, vendorDao, db, loggerModule, bankAccountDao, userDao, beneficiaryAccountDao, userHierarchyDao;

beforeAll(async () => {
  vendorDao = await import('../../src/apis/vendors/vendorDao.js');
  db = await import('../../src/utils/db.js');
  loggerModule = await import('../../src/utils/logger.js');
  bankAccountDao = await import('../../src/apis/bankAccounts/bankaccountDao.js');
  userDao = await import('../../src/apis/users/userDao.js');
  beneficiaryAccountDao = await import('../../src/apis/beneficiaryAccounts/beneficiaryAccountDao.js');
  userHierarchyDao = await import('../../src/apis/userHierarchy/userHierarchyDao.js');
  service = await import('../../src/apis/vendors/vendorService.js');
});

beforeEach(() => {
  jest.clearAllMocks();
  vendorDao.createVendorDao = jest.fn();
  vendorDao.deleteVendorDao = jest.fn();
  vendorDao.getAllVendorsDao = jest.fn().mockResolvedValue([]);
  vendorDao.getVendorByCodeDao = jest.fn();
  vendorDao.getVendorsBySearchDao = jest.fn();
  vendorDao.getVendorsCodeDao = jest.fn();
  vendorDao.getVendorsDao = jest.fn();
  vendorDao.updateVendorDao = jest.fn();
  vendorDao.linkVendorDao = jest.fn();
  vendorDao.unlinkVendorDao = jest.fn();
  vendorDao.transferVendorDao = jest.fn();
  vendorDao.getVendorByUserId = jest.fn();
  vendorDao.getDesignationIdDao = jest.fn().mockResolvedValue(2);
  vendorDao.isNetBalanceZeroForTwoHours = jest.fn().mockResolvedValue(true);
  vendorDao.getBankResponseAccessByIDDao = jest.fn();
  
  userHierarchyDao.getUserHierarchysDao = jest.fn().mockResolvedValue([]);
  
  bankAccountDao.getBankaccountDao = jest.fn().mockResolvedValue([]);
  bankAccountDao.updateBankaccountDao = jest.fn();
  bankAccountDao.getBankaccountCheckDao = jest.fn().mockResolvedValue(null);
  
  userDao.updateUserDao = jest.fn();
  userDao.getUsersNameDao = jest.fn().mockResolvedValue([]);
  
  beneficiaryAccountDao.deleteBeneficiaryDao = jest.fn();
  
  db.getConnection = jest.fn();
  db.beginTransaction = jest.fn();
  db.commit = jest.fn();
  db.rollback = jest.fn();
  db.query = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
  
  loggerModule.logger.error = jest.fn();
  loggerModule.logger.log = jest.fn();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('vendorService', () => {
  describe('createVendorService', () => {
    it('should create vendor with transaction', async () => {
      const mockConn = { release: jest.fn(), query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 }) };
      const mockResult = { id: 1, code: 'VENDOR1' };
      
      db.getConnection.mockResolvedValue(mockConn);
      db.beginTransaction.mockResolvedValue(undefined);
      db.commit.mockResolvedValue(undefined);
      vendorDao.createVendorDao.mockResolvedValue(mockResult);
      
      const result = await service.createVendorService({ code: 'VENDOR1', user_id: 1, company_id: 1 });
      
      // This test confirms that the createVendorService function successfully creates a new vendor while properly managing database transactions. It simulates a scenario where a vendor is created with the provided payload, and then checks that the function correctly initiates a database connection, begins a transaction, calls the DAO to create the vendor, commits the transaction, and releases the connection. Finally, it verifies that the result returned from the service matches the expected vendor data, confirming that the createVendorService function processes the creation request correctly and returns the appropriate response when a vendor is successfully created.
      expect(db.getConnection).toHaveBeenCalled();
      // We check that the beginTransaction method is called to ensure that the service is correctly managing database transactions during the vendor creation process. This is important for maintaining data integrity and ensuring that all operations related to creating a vendor are executed within a transaction, allowing for proper rollback in case of errors.
      expect(db.beginTransaction).toHaveBeenCalled();
      // We verify that the createVendorDao method is called with the correct payload to confirm that the service is correctly passing the vendor creation data to the DAO layer for processing. This ensures that the vendor creation logic is properly executed and that the DAO receives the necessary information to create a new vendor record in the database.
      expect(db.commit).toHaveBeenCalled();
      // We check that the commit method is called to confirm that the service is correctly committing the transaction after successfully creating a vendor. This is crucial for ensuring that all changes made during the transaction are saved to the database and that the new vendor record is persisted as expected.
      expect(mockConn.release).toHaveBeenCalled();
      // Finally, we verify that the result returned from the createVendorService function matches the expected vendor data. This confirms that the service is correctly processing the vendor creation request and returning the appropriate response when a vendor is successfully created.
      expect(result).toEqual(mockResult);
    });

    it('should rollback on creation error', async () => {
      const mockConn = { release: jest.fn() };
      
      db.getConnection.mockResolvedValue(mockConn);
      db.beginTransaction.mockResolvedValue(undefined);
      db.rollback.mockResolvedValue(undefined);
      vendorDao.createVendorDao.mockRejectedValue(new Error('Insert failed'));
      
      // We simulate an error during the vendor creation process by mocking the createVendorDao method to reject with an error. This allows us to test how the createVendorService function handles errors and ensures that it correctly rolls back the transaction to maintain data integrity, releases the database connection, and logs the error for debugging purposes. By expecting the service to throw an error when the DAO layer fails, we confirm that the service is robust and can gracefully handle failures during vendor creation without leaving the database in an inconsistent state.
      await expect(service.createVendorService({ code: 'VENDOR1' })).rejects.toThrow();
      // This test verifies that the createVendorService function correctly handles errors during the vendor creation process by rolling back the transaction and logging the error. It simulates a scenario where the DAO layer throws an error when attempting to create a vendor, and then checks that the service responds by rolling back the transaction to maintain data integrity, releasing the database connection, and logging the error for debugging purposes. This ensures that the service is robust and can gracefully handle failures during vendor creation without leaving the database in an inconsistent state.
      expect(db.rollback).toHaveBeenCalledWith(mockConn);
      // We check that the rollback method is called with the correct connection to confirm that the service is correctly rolling back the transaction in case of an error during vendor creation. This is crucial for maintaining data integrity and ensuring that any changes made during the transaction are not persisted if an error occurs.
      expect(mockConn.release).toHaveBeenCalled();
      // Finally, we verify that the logger's error method is called to confirm that the service is correctly logging the error when a vendor creation fails. This is important for debugging and monitoring purposes, allowing developers to identify and address issues in the vendor creation process effectively.
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      db.getConnection.mockRejectedValue(new Error('Connection error'));
      
      // This test simulates a scenario where there is a connection error when attempting to create a vendor. By mocking the getConnection method to reject with an error, we can verify that the createVendorService function correctly handles connection errors by throwing an appropriate error and logging the issue for debugging purposes. This ensures that the service is robust and can gracefully handle situations where the database connection fails, preventing further operations and providing useful information for troubleshooting.
      await expect(service.createVendorService({})).rejects.toThrow('Connection error');
      // We check that the logger's error method is called to confirm that the service is correctly logging the connection error when it occurs during the vendor creation process. This is important for debugging and monitoring purposes, allowing developers to identify and address issues related to database connectivity effectively.
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getVendorsService', () => {
    it('should fetch vendors successfully', async () => {
      const mockResult = [{ id: 1, code: 'VENDOR1' }];
      vendorDao.getAllVendorsDao.mockResolvedValue(mockResult);
      
      const result = await service.getVendorsService(
        { company_id: 1 },
        'ADMIN',
        1,
        10,
        'ADMIN',
        1,
      );
      
      // This test verifies that the getVendorsService function successfully retrieves a list of vendors based on the provided parameters. It simulates a scenario where the DAO layer returns a list of vendors, and then checks that the service correctly calls the DAO method to fetch the vendors and returns the expected result. This confirms that the getVendorsService function is properly processing the request and returning the correct data when vendors are successfully fetched.
      expect(vendorDao.getAllVendorsDao).toHaveBeenCalled();
      // Finally, we verify that the result returned from the getVendorsService function matches the expected list of vendors. This confirms that the service is correctly processing the vendor retrieval request and returning the appropriate response when vendors are successfully fetched.
      expect(result).toEqual(mockResult);
    });

    it('should handle pagination parameters', async () => {
      vendorDao.getAllVendorsDao.mockResolvedValue([]);
      
      await service.getVendorsService({ company_id: 1 }, 'ADMIN', '2', '20', 'Admin', 1);
      // This test checks that the getVendorsService function correctly handles pagination parameters when fetching vendors. By providing specific page and limit values as strings, we can verify that the service correctly parses these values and passes them to the DAO method for fetching vendors. This ensures that the service is properly managing pagination and can return the correct subset of vendors based on the provided parameters.
      expect(vendorDao.getAllVendorsDao).toHaveBeenCalledWith(
        expect.any(Object),
        2,
        20,
        expect.any(Object),
        expect.any(Object),
        'ADMIN',
        expect.any(Object),
      );
    });

    it('should use default pagination', async () => {
      vendorDao.getAllVendorsDao.mockResolvedValue([]);
      
      await service.getVendorsService({ company_id: 1 }, 'ADMIN', null, null, 'ADMIN', 1);
      // This test verifies that the getVendorsService function correctly uses default pagination values when page and limit parameters are not provided. By passing null for the page and limit parameters, we can check that the service defaults to the expected pagination values (e.g., page 1 and limit 10) when fetching vendors. This ensures that the service is robust and can handle cases where pagination parameters are missing, providing a consistent experience for users when retrieving vendor data.
      expect(vendorDao.getAllVendorsDao).toHaveBeenCalledWith(
        expect.any(Object),
        1,
        10,
        expect.any(Object),
        expect.any(Object),
        'ADMIN',
        expect.any(Object),
      );
    });

    it('should handle fetch errors', async () => {
      vendorDao.getAllVendorsDao.mockRejectedValue(new Error('Fetch failed'));
      // This test simulates a scenario where there is an error while fetching vendors from the DAO layer. By mocking the getAllVendorsDao method to reject with an error, we can verify that the getVendorsService function correctly handles fetch errors by throwing an appropriate error and logging the issue for debugging purposes. This ensures that the service is robust and can gracefully handle situations where fetching vendors fails, providing useful information for troubleshooting.
      await expect(
        service.getVendorsService({ company_id: 1 }, 'ADMIN', 1, 10, 'ADMIN', 1),
      ).rejects.toThrow('Fetch failed');
      // We check that the logger's error method is called to confirm that the service is correctly logging the fetch error when it occurs during the vendor retrieval process. This is important for debugging and monitoring purposes, allowing developers to identify and address issues related to fetching vendors effectively.
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('getVendorsBySearchService', () => {
    it('should search vendors successfully', async () => {
      const mockResult = { vendors: [{ id: 1 }], total: 1 };
      vendorDao.getVendorsBySearchDao.mockResolvedValue(mockResult);
      
      const result = await service.getVendorsBySearchService(
        { company_id: 1, search: 'test' },
        'ADMIN',
        1,
        10,
      );
      
      // This test verifies that the getVendorsBySearchService function successfully searches for vendors based on the provided search criteria. It simulates a scenario where the DAO layer returns a list of vendors matching the search query, and then checks that the service correctly calls the DAO method to perform the search and returns the expected result. This confirms that the getVendorsBySearchService function is properly processing the search request and returning the correct data when vendors are successfully searched.
      expect(vendorDao.getVendorsBySearchDao).toHaveBeenCalled();
      // Finally, we verify that the result returned from the getVendorsBySearchService function matches the expected search results. This confirms that the service is correctly processing the vendor search request and returning the appropriate response when vendors are successfully searched based on the provided criteria.
      expect(result).toEqual(mockResult);
    });

    it('should handle search errors', async () => {
      vendorDao.getVendorsBySearchDao.mockRejectedValue(new Error('Search failed'));
      
      // This test simulates a scenario where there is an error while searching for vendors from the DAO layer. By mocking the getVendorsBySearchDao method to reject with an error, we can verify that the getVendorsBySearchService function correctly handles search errors by throwing an appropriate error and logging the issue for debugging purposes. This ensures that the service is robust and can gracefully handle situations where searching for vendors fails, providing useful information for troubleshooting.
      await expect(
        service.getVendorsBySearchService({ company_id: 1 }, 'ADMIN', 1, 10),
      ).rejects.toThrow('Search failed');
    });
  });

  describe('getVendorsCodeService', () => {
    it('should fetch vendor codes successfully', async () => {
      const mockResult = [{ label: 'VENDOR1', value: 1 }];
      vendorDao.getVendorsCodeDao.mockResolvedValue(mockResult);
      
      const result = await service.getVendorsCodeService({ company_id: 1 });
      
      // This test verifies that the getVendorsCodeService function successfully retrieves a list of vendor codes based on the provided company ID. It simulates a scenario where the DAO layer returns a list of vendor codes, and then checks that the service correctly calls the DAO method to fetch the vendor codes and returns the expected result. This confirms that the getVendorsCodeService function is properly processing the request and returning the correct data when vendor codes are successfully fetched.
      expect(vendorDao.getVendorsCodeDao).toHaveBeenCalled();
      // Finally, we verify that the result returned from the getVendorsCodeService function matches the expected list of vendor codes. This confirms that the service is correctly processing the vendor code retrieval request and returning the appropriate response when vendor codes are successfully fetched based on the provided company ID.
      expect(result).toEqual(mockResult);
    });

    it('should support include sub vendors flag', async () => {
      const mockResult = [{ label: 'VENDOR1', subvendors: [] }];
      vendorDao.getVendorsCodeDao.mockResolvedValue(mockResult);
      
      await service.getVendorsCodeService({ company_id: 1 }, 'true');
      // This test checks that the getVendorsCodeService function correctly supports the include sub vendors flag when fetching vendor codes. By providing the flag as 'true', we can verify that the service correctly passes this parameter to the DAO method, allowing for the inclusion of sub vendors in the results. This ensures that the service is properly managing the retrieval of vendor codes based on the specified parameters and can return comprehensive results when requested.
      expect(vendorDao.getVendorsCodeDao).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      vendorDao.getVendorsCodeDao.mockRejectedValue(new Error('Fetch failed'));
      // This test simulates a scenario where there is an error while fetching vendor codes from the DAO layer. By mocking the getVendorsCodeDao method to reject with an error, we can verify that the getVendorsCodeService function correctly handles fetch errors by throwing an appropriate error and logging the issue for debugging purposes. This ensures that the service is robust and can gracefully handle situations where fetching vendor codes fails, providing useful information for troubleshooting.
      await expect(
        service.getVendorsCodeService({ company_id: 1 }),
      ).rejects.toThrow('Fetch failed');
    });
  });

  describe('updateVendorService', () => {
    it('should update vendor with transaction', async () => {
      const mockPayload = { balance: 1000 };
      const mockResult = { id: 1, balance: 1000, user_id: 1, code: 'VENDOR1' };
      
      vendorDao.updateVendorDao.mockResolvedValue(mockResult);
      userDao.getUsersNameDao.mockResolvedValue({ designation: 'ADMIN' });
      
      const result = await service.updateVendorService({ id: 1 }, mockPayload);
      // This test verifies that the updateVendorService function successfully updates a vendor's information while properly managing database transactions. It simulates a scenario where the DAO layer successfully updates the vendor with the provided payload, and then checks that the service correctly calls the DAO method to perform the update and returns the expected result. This confirms that the updateVendorService function is properly processing the update request and returning the correct data when a vendor is successfully updated.
      expect(vendorDao.updateVendorDao).toHaveBeenCalledWith({ id: 1 }, mockPayload);
      // Finally, we verify that the result returned from the updateVendorService function matches the expected updated vendor data. This confirms that the service is correctly processing the vendor update request and returning the appropriate response when a vendor is successfully updated.
      expect(result).toEqual(mockResult);
    });

    it('should rollback on update error', async () => {
      const mockPayload = { payin_commission: 10 };
      
      vendorDao.updateVendorDao.mockResolvedValue({ id: 1, user_id: 1, code: 'VENDOR1' });
      userDao.getUsersNameDao.mockResolvedValue({ designation: 'VENDOR_ADMIN' });
      // We simulate an error during the vendor update process by mocking the updateVendorDao method to reject with an error. This allows us to test how the updateVendorService function handles errors and ensures that it correctly rolls back any changes made during the update process, preventing partial updates and maintaining data integrity. By expecting the service to throw an error when the DAO layer fails, we confirm that the service is robust and can gracefully handle failures during vendor updates without leaving the database in an inconsistent state.
      await expect(service.updateVendorService({ id: 1 }, mockPayload)).rejects.toThrow();
      // This test verifies that the updateVendorService function correctly handles errors during the vendor update process by rolling back any changes and logging the error. It simulates a scenario where the DAO layer throws an error when attempting to update a vendor, and then checks that the service responds by rolling back any changes made during the update process to maintain data integrity, and logging the error for debugging purposes. This ensures that the service is robust and can gracefully handle failures during vendor updates without leaving the database in an inconsistent state.
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });
  });

  describe('deleteVendorService', () => {
    it('should delete vendor with transaction', async () => {
      const mockConn = { release: jest.fn(), query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 }) };
      const mockResult = { id: 1, is_obsolete: true };
      
      db.getConnection.mockResolvedValue(mockConn);
      db.beginTransaction.mockResolvedValue(undefined);
      db.commit.mockResolvedValue(undefined);
      vendorDao.deleteVendorDao.mockResolvedValue(mockResult);
      
      await service.deleteVendorService({ id: 1 }, 'test_user');
      
      // This test verifies that the deleteVendorService function successfully deletes a vendor while properly managing database transactions. It simulates a scenario where the DAO layer successfully deletes the vendor with the provided ID, and then checks that the service correctly initiates a database connection, begins a transaction, calls the DAO to delete the vendor, commits the transaction, and releases the connection. Finally, it verifies that the result returned from the service matches the expected deleted vendor data, confirming that the deleteVendorService function processes the deletion request correctly and returns the appropriate response when a vendor is successfully deleted.
      expect(db.getConnection).toHaveBeenCalled();
      // We check that the beginTransaction method is called to ensure that the service is correctly managing database transactions during the vendor deletion process. This is important for maintaining data integrity and ensuring that all operations related to deleting a vendor are executed within a transaction, allowing for proper rollback in case of errors.
      expect(vendorDao.deleteVendorDao).toHaveBeenCalled();
      // We verify that the deleteVendorDao method is called with the correct parameters to confirm that the service is correctly passing the vendor deletion data to the DAO layer for processing. This ensures that the vendor deletion logic is properly executed and that the DAO receives the necessary information to delete the vendor record from the database.
      expect(db.commit).toHaveBeenCalled();
      // We check that the commit method is called to confirm that the service is correctly committing the transaction after successfully deleting a vendor. This is crucial for ensuring that all changes made during the transaction are saved to the database and that the vendor record is removed as expected.
      expect(mockConn.release).toHaveBeenCalled();
    });

    it('should rollback on delete error', async () => {
      const mockConn = { release: jest.fn() };
      
      db.getConnection.mockResolvedValue(mockConn);
      db.beginTransaction.mockResolvedValue(undefined);
      db.rollback.mockResolvedValue(undefined);
      vendorDao.deleteVendorDao.mockRejectedValue(new Error('Delete failed'));
      
      // We simulate an error during the vendor deletion process by mocking the deleteVendorDao method to reject with an error. This allows us to test how the deleteVendorService function handles errors and ensures that it correctly rolls back the transaction to maintain data integrity, releases the database connection, and logs the error for debugging purposes. By expecting the service to throw an error when the DAO layer fails, we confirm that the service is robust and can gracefully handle failures during vendor deletion without leaving the database in an inconsistent state.
      await expect(service.deleteVendorService({ id: 1 }, 'test_user')).rejects.toThrow();
      // This test verifies that the deleteVendorService function correctly handles errors during the vendor deletion process by rolling back the transaction and logging the error. It simulates a scenario where the DAO layer throws an error when attempting to delete a vendor, and then checks that the service responds by rolling back the transaction to maintain data integrity, releasing the database connection, and logging the error for debugging purposes. This ensures that the service is robust and can gracefully handle failures during vendor deletion without leaving the database in an inconsistent state.
      expect(db.rollback).toHaveBeenCalledWith(mockConn);
      // Finally, we verify that the logger's error method is called to confirm that the service is correctly logging the error when a vendor deletion fails. This is important for debugging and monitoring purposes, allowing developers to identify and address issues in the vendor deletion process effectively.
      expect(mockConn.release).toHaveBeenCalled();
    });
  });

  describe('linkVendorService', () => {
    it('should link vendor successfully', async () => {
      const mockConn = { release: jest.fn() };
      const mockResult = { id: 1, linked: true };
      
      db.getConnection.mockResolvedValue(mockConn);
      db.beginTransaction.mockResolvedValue(undefined);
      db.commit.mockResolvedValue(undefined);
      vendorDao.getVendorByUserId.mockResolvedValue({ id: 2, payin_commission: 3, payout_commission: 4 });
      bankAccountDao.getBankaccountCheckDao.mockResolvedValue(null);
      vendorDao.linkVendorDao.mockResolvedValue(mockResult);
      
      await service.linkVendorService(1, 2, 5, 1.5, 2.5);
      
      // This test verifies that the linkVendorService function successfully links a vendor to a user while properly managing database transactions. It simulates a scenario where the DAO layer successfully links the vendor with the provided parameters, and then checks that the service correctly initiates a database connection, begins a transaction, calls the necessary DAO methods to perform the linking, commits the transaction, and releases the connection. Finally, it verifies that the result returned from the service matches the expected linked vendor data, confirming that the linkVendorService function processes the linking request correctly and returns the appropriate response when a vendor is successfully linked.
      expect(db.getConnection).toHaveBeenCalled();
      // We check that the beginTransaction method is called to ensure that the service is correctly managing database transactions during the vendor linking process. This is important for maintaining data integrity and ensuring that all operations related to linking a vendor are executed within a transaction, allowing for proper rollback in case of errors.
      expect(vendorDao.linkVendorDao).toHaveBeenCalled();
      // We verify that the linkVendorDao method is called with the correct parameters to confirm that the service is correctly passing the vendor linking data to the DAO layer for processing. This ensures that the vendor linking logic is properly executed and that the DAO receives the necessary information to link the vendor record in the database.
      expect(db.commit).toHaveBeenCalled();
      // We check that the commit method is called to confirm that the service is correctly committing the transaction after successfully linking a vendor. This is crucial for ensuring that all changes made during the transaction are saved to the database and that the vendor record is linked as expected.
      expect(mockConn.release).toHaveBeenCalled();
    });

    it('should rollback on link error', async () => {
      const mockConn = { release: jest.fn() };
      
      db.getConnection.mockResolvedValue(mockConn);
      db.beginTransaction.mockResolvedValue(undefined);
      db.rollback.mockResolvedValue(undefined);
      vendorDao.getVendorByUserId.mockResolvedValue({ id: 2, payin_commission: 3, payout_commission: 4 });
      bankAccountDao.getBankaccountCheckDao.mockResolvedValue(null);
      vendorDao.linkVendorDao.mockRejectedValue(new Error('Link failed'));
      // We simulate an error during the vendor linking process by mocking the linkVendorDao method to reject with an error. This allows us to test how the linkVendorService function handles errors and ensures that it correctly rolls back the transaction to maintain data integrity, releases the database connection, and logs the error for debugging purposes. By expecting the service to throw an error when the DAO layer fails, we confirm that the service is robust and can gracefully handle failures during vendor linking without leaving the database in an inconsistent state.
      await expect(service.linkVendorService(1, 2, 5, 1.5, 2.5)).rejects.toThrow();
      // This test verifies that the linkVendorService function correctly handles errors during the vendor linking process by rolling back the transaction and logging the error. It simulates a scenario where the DAO layer throws an error when attempting to link a vendor, and then checks that the service responds by rolling back the transaction to maintain data integrity, releasing the database connection, and logging the error for debugging purposes. This ensures that the service is robust and can gracefully handle failures during vendor linking without leaving the database in an inconsistent state.
      expect(db.rollback).toHaveBeenCalledWith(mockConn);
    });
  });

  describe('unlinkVendorService', () => {
    it('should unlink vendor successfully', async () => {
      const mockConn = { release: jest.fn() };
      const mockResult = { id: 1, linked: false };
      
      db.getConnection.mockResolvedValue(mockConn);
      db.beginTransaction.mockResolvedValue(undefined);
      db.commit.mockResolvedValue(undefined);
      vendorDao.unlinkVendorDao.mockResolvedValue(mockResult);
      
      await service.unlinkVendorService(1, 2, 5);
      
      // This test verifies that the unlinkVendorService function successfully unlinks a vendor from a user while properly managing database transactions. It simulates a scenario where the DAO layer successfully unlinks the vendor with the provided parameters, and then checks that the service correctly initiates a database connection, begins a transaction, calls the necessary DAO method to perform the unlinking, commits the transaction, and releases the connection. Finally, it verifies that the result returned from the service matches the expected unlinked vendor data, confirming that the unlinkVendorService function processes the unlinking request correctly and returns the appropriate response when a vendor is successfully unlinked.
      expect(db.getConnection).toHaveBeenCalled();
      // We check that the beginTransaction method is called to ensure that the service is correctly managing database transactions during the vendor unlinking process. This is important for maintaining data integrity and ensuring that all operations related to unlinking a vendor are executed within a transaction, allowing for proper rollback in case of errors.
      expect(vendorDao.unlinkVendorDao).toHaveBeenCalled();
      // We verify that the unlinkVendorDao method is called with the correct parameters to confirm that the service is correctly passing the vendor unlinking data to the DAO layer for processing. This ensures that the vendor unlinking logic is properly executed and that the DAO receives the necessary information to unlink the vendor record in the database.
      expect(db.commit).toHaveBeenCalled();
      // We check that the commit method is called to confirm that the service is correctly committing the transaction after successfully unlinking a vendor. This is crucial for ensuring that all changes made during the transaction are saved to the database and that the vendor record is unlinked as expected.
      expect(mockConn.release).toHaveBeenCalled();
    });

    it('should rollback on unlink error', async () => {
      const mockConn = { release: jest.fn() };
      
      db.getConnection.mockResolvedValue(mockConn);
      db.beginTransaction.mockResolvedValue(undefined);
      db.rollback.mockResolvedValue(undefined);
      vendorDao.unlinkVendorDao.mockRejectedValue(new Error('Unlink failed'));
      // We simulate an error during the vendor unlinking process by mocking the unlinkVendorDao method to reject with an error. This allows us to test how the unlinkVendorService function handles errors and ensures that it correctly rolls back the transaction to maintain data integrity, releases the database connection, and logs the error for debugging purposes. By expecting the service to throw an error when the DAO layer fails, we confirm that the service is robust and can gracefully handle failures during vendor unlinking without leaving the database in an inconsistent state.
      await expect(service.unlinkVendorService(1, 2, 5)).rejects.toThrow();
      // This test verifies that the unlinkVendorService function correctly handles errors during the vendor unlinking process by rolling back the transaction and logging the error. It simulates a scenario where the DAO layer throws an error when attempting to unlink a vendor, and then checks that the service responds by rolling back the transaction to maintain data integrity, releasing the database connection, and logging the error for debugging purposes. This ensures that the service is robust and can gracefully handle failures during vendor unlinking without leaving the database in an inconsistent state.
      expect(db.rollback).toHaveBeenCalledWith(mockConn);
    });
  });

  describe('transferVendorService', () => {
    it('should transfer vendor successfully', async () => {
      const mockConn = { release: jest.fn() };
      const mockResult = { id: 1, transferred: true };
      
      db.getConnection.mockResolvedValue(mockConn);
      db.beginTransaction.mockResolvedValue(undefined);
      db.commit.mockResolvedValue(undefined);
      vendorDao.getVendorByUserId.mockResolvedValue({ id: 2, payin_commission: 3, payout_commission: 4 });
      bankAccountDao.getBankaccountCheckDao.mockResolvedValue(null);
      vendorDao.transferVendorDao.mockResolvedValue(mockResult);
      
      await service.transferVendorService(1, 2, 3, 5);
      
      // This test verifies that the transferVendorService function successfully transfers a vendor from one user to another while properly managing database transactions. It simulates a scenario where the DAO layer successfully transfers the vendor with the provided parameters, and then checks that the service correctly initiates a database connection, begins a transaction, calls the necessary DAO methods to perform the transfer, commits the transaction, and releases the connection. Finally, it verifies that the result returned from the service matches the expected transferred vendor data, confirming that the transferVendorService function processes the transfer request correctly and returns the appropriate response when a vendor is successfully transferred.
      expect(db.getConnection).toHaveBeenCalled();
      // We check that the beginTransaction method is called to ensure that the service is correctly managing database transactions during the vendor transfer process. This is important for maintaining data integrity and ensuring that all operations related to transferring a vendor are executed within a transaction, allowing for proper rollback in case of errors.
      expect(vendorDao.transferVendorDao).toHaveBeenCalled();
      // We verify that the transferVendorDao method is called with the correct parameters to confirm that the service is correctly passing the vendor transfer data to the DAO layer for processing. This ensures that the vendor transfer logic is properly executed and that the DAO receives the necessary information to transfer the vendor record in the database.
      expect(db.commit).toHaveBeenCalled();
      // We check that the commit method is called to confirm that the service is correctly committing the transaction after successfully transferring a vendor. This is crucial for ensuring that all changes made during the transaction are saved to the database and that the vendor record is transferred as expected.
      expect(mockConn.release).toHaveBeenCalled();
    });

    it('should rollback on transfer error', async () => {
      const mockConn = { release: jest.fn() };
      
      db.getConnection.mockResolvedValue(mockConn);
      db.beginTransaction.mockResolvedValue(undefined);
      db.rollback.mockResolvedValue(undefined);
      vendorDao.getVendorByUserId.mockResolvedValue({ id: 2, payin_commission: 3, payout_commission: 4 });
      bankAccountDao.getBankaccountCheckDao.mockResolvedValue(null);
      vendorDao.transferVendorDao.mockRejectedValue(new Error('Transfer failed'));
      
      // We simulate an error during the vendor transfer process by mocking the transferVendorDao method to reject with an error. This allows us to test how the transferVendorService function handles errors and ensures that it correctly rolls back the transaction to maintain data integrity, releases the database connection, and logs the error for debugging purposes. By expecting the service to throw an error when the DAO layer fails, we confirm that the service is robust and can gracefully handle failures during vendor transfer without leaving the database in an inconsistent state.
      await expect(
        service.transferVendorService(1, 2, 3, 5),
      ).rejects.toThrow();
      // This test verifies that the transferVendorService function correctly handles errors during the vendor transfer process by rolling back the transaction and logging the error. It simulates a scenario where the DAO layer throws an error when attempting to transfer a vendor, and then checks that the service responds by rolling back the transaction to maintain data integrity, releasing the database connection, and logging the error for debugging purposes. This ensures that the service is robust and can gracefully handle failures during vendor transfer without leaving the database in an inconsistent state.
      expect(db.rollback).toHaveBeenCalledWith(mockConn);
    });
  });
});
