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
      
      expect(db.buildInsertQuery).toHaveBeenCalledWith('Vendor', mockData);
      expect(db.executeQuery).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should handle transaction with connection', async () => {
      const mockConn = {};
      const mockResult = { id: 1 };
      
      db.buildInsertQuery.mockReturnValue(['INSERT INTO...', []]);
      db.executeQuery.mockResolvedValue({ rows: [mockResult] });
      
      await vendorDao.createVendorDao({}, mockConn);
      
      expect(db.executeQuery).toHaveBeenCalledWith(expect.any(String), expect.any(Array), mockConn);
    });

    it('should handle creation errors', async () => {
      const error = new Error('Insert failed');
      db.buildInsertQuery.mockReturnValue(['INSERT INTO...', []]);
      db.executeQuery.mockRejectedValue(error);
      
      await expect(vendorDao.createVendorDao({})).rejects.toThrow('Insert failed');
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

  describe('getVendorCodeDao', () => {
    it('should fetch vendor code successfully', async () => {
      const mockResult = { code: 'VENDOR1' };
      db.executeQuery.mockResolvedValue({ rows: [mockResult] });
      
      const result = await vendorDao.getVendorCodeDao(1);
      
      expect(db.executeQuery).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should return null when not found', async () => {
      db.executeQuery.mockResolvedValue({ rows: [] });
      
      const result = await vendorDao.getVendorCodeDao(999);
      
      expect(result).toBeNull();
    });

    it('should handle errors', async () => {
      const error = new Error('Query failed');
      db.executeQuery.mockRejectedValue(error);
      
      await expect(vendorDao.getVendorCodeDao(1)).rejects.toThrow('Query failed');
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

  describe('getVendorsBankReponseDao', () => {
    it('should fetch vendors for bank response', async () => {
      const mockResult = [{ id: 1, code: 'VENDOR1', user_id: 1 }];
      db.executeQuery.mockResolvedValue({ rows: mockResult });
      
      const result = await vendorDao.getVendorsBankReponseDao({ company_id: 1 });
      
      expect(db.executeQuery).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should support user_id filter', async () => {
      const mockResult = [];
      db.executeQuery.mockResolvedValue({ rows: mockResult });
      
      await vendorDao.getVendorsBankReponseDao({ company_id: 1, user_id: 5 });
      
      expect(db.executeQuery).toHaveBeenCalled();
    });

    it('should support array user_id filter', async () => {
      const mockResult = [];
      db.executeQuery.mockResolvedValue({ rows: mockResult });
      
      await vendorDao.getVendorsBankReponseDao({ company_id: 1, user_id: [1, 2] });
      
      expect(db.executeQuery).toHaveBeenCalled();
    });

    it('should support code filter', async () => {
      const mockResult = [];
      db.executeQuery.mockResolvedValue({ rows: mockResult });
      
      await vendorDao.getVendorsBankReponseDao({ company_id: 1, code: 'VENDOR1' });
      
      expect(db.executeQuery).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      const error = new Error('Query failed');
      db.executeQuery.mockRejectedValue(error);
      
      await expect(vendorDao.getVendorsBankReponseDao({})).rejects.toThrow('Query failed');
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

  describe('getVendorsDashBoardReportDao', () => {
    it('should fetch vendor dashboard report data', async () => {
      const mockResult = [{ user_id: 1, code: 'VENDOR1' }];
      db.buildSelectQuery.mockReturnValue(['SELECT...', []]);
      db.executeQuery.mockResolvedValue({ rows: mockResult });
      
      const result = await vendorDao.getVendorsDashBoardReportDao({ company_id: 1 });
      
      expect(db.executeQuery).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should return empty array when no data', async () => {
      db.buildSelectQuery.mockReturnValue(['SELECT...', []]);
      db.executeQuery.mockResolvedValue({ rows: null });
      
      const result = await vendorDao.getVendorsDashBoardReportDao();
      
      expect(result).toEqual([]);
    });

    it('should handle errors', async () => {
      const error = new Error('Query failed');
      db.buildSelectQuery.mockReturnValue(['SELECT...', []]);
      db.executeQuery.mockRejectedValue(error);
      
      await expect(vendorDao.getVendorsDashBoardReportDao()).rejects.toThrow('Query failed');
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

  describe('getVendorsCodeDao', () => {
    it('should fetch vendors codes successfully', async () => {
      const mockResult = [{ label: 'VENDOR1', value: 1, vendor_id: 1 }];
      db.executeQuery.mockResolvedValue({ rows: mockResult });
      
      const result = await vendorDao.getVendorsCodeDao({ company_id: 1 });
      
      expect(db.executeQuery).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should include sub-vendors when requested', async () => {
      const mockResult = [{ label: 'VENDOR1', subvendors: [{ label: 'SUB1' }] }];
      db.executeQuery.mockResolvedValue({ rows: mockResult });
      
      const result = await vendorDao.getVendorsCodeDao({ company_id: 1 }, 'true');
      
      expect(result[0]).toHaveProperty('label');
    });

    it('should handle boolean conversion for includeSubVendors', async () => {
      const mockResult = [];
      db.executeQuery.mockResolvedValue({ rows: mockResult });
      
      await vendorDao.getVendorsCodeDao({ company_id: 1 }, 'false');
      
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
      
      expect(db.executeQuery).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      const error = new Error('Query failed');
      db.executeQuery.mockRejectedValue(error);
      
      await expect(
        vendorDao.getVendorsCodeDao({ company_id: 1 }),
      ).rejects.toThrow('Query failed');
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });
});
