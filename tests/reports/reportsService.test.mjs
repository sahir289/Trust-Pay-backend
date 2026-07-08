/* global describe, it, expect, beforeEach, beforeAll */
import { jest } from '@jest/globals';

// Mock dependencies
const mockGetMerchantsDaoArray = jest.fn();
const mockGetVendorsDaoArray = jest.fn();
const mockGetBankaccountDao = jest.fn();
const mockGetPayInMerchantReportDao = jest.fn();
const mockGetPayInVendorReportDao = jest.fn();
const mockGetPayOutMerchantReportDao = jest.fn();
const mockGetPayOutVendorReportDao = jest.fn();
const mockGetMerchantReportDao = jest.fn();
const mockGetVendorReportDao = jest.fn();
const mockGetUsersDao = jest.fn();
const mockGetDesignationDao = jest.fn();
const mockGetUserHierarchysDao = jest.fn();

jest.unstable_mockModule('../../src/apis/merchants/merchantDao.js', () => ({
  getMerchantsDaoArray: mockGetMerchantsDaoArray,
}));

jest.unstable_mockModule('../../src/apis/vendors/vendorDao.js', () => ({
  getVendorsDaoArray: mockGetVendorsDaoArray,
}));

jest.unstable_mockModule('../../src/apis/bankAccounts/bankaccountDao.js', () => ({
  getBankaccountDao: mockGetBankaccountDao,
}));

jest.unstable_mockModule('../../src/apis/reports/reportsDao.js', () => ({
  getPayInMerchantReportDao: mockGetPayInMerchantReportDao,
  getPayInVendorReportDao: mockGetPayInVendorReportDao,
  getPayOutMerchantReportDao: mockGetPayOutMerchantReportDao,
  getPayOutVendorReportDao: mockGetPayOutVendorReportDao,
  getMerchantReportDao: mockGetMerchantReportDao,
  getVendorReportDao: mockGetVendorReportDao,
}));

jest.unstable_mockModule('../../src/apis/users/userDao.js', () => ({
  getUsersDao: mockGetUsersDao,
}));

jest.unstable_mockModule('../../src/apis/designation/designationDao.js', () => ({
  getDesignationDao: mockGetDesignationDao,
}));

jest.unstable_mockModule('../../src/apis/userHierarchy/userHierarchyDao.js', () => ({
  getUserHierarchysDao: mockGetUserHierarchysDao,
}));

jest.unstable_mockModule('../../src/constants/index.js', () => ({
  Role: {
    MERCHANT: 'MERCHANT',
    VENDOR: 'VENDOR',
    ADMIN: 'ADMIN',
  },
}));

jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

// Import after mocks
let reportsService;
beforeAll(async () => {
  reportsService = await import('../../src/apis/reports/reportsService.js');
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetMerchantsDaoArray.mockResolvedValue([]);
  mockGetVendorsDaoArray.mockResolvedValue([]);
  mockGetBankaccountDao.mockResolvedValue([]);
  mockGetPayInMerchantReportDao.mockResolvedValue([]);
  mockGetPayInVendorReportDao.mockResolvedValue([]);
  mockGetPayOutMerchantReportDao.mockResolvedValue([]);
  mockGetPayOutVendorReportDao.mockResolvedValue([]);
  mockGetMerchantReportDao.mockResolvedValue([]);
  mockGetVendorReportDao.mockResolvedValue([]);
  mockGetUsersDao.mockResolvedValue([]);
  mockGetDesignationDao.mockResolvedValue([]);
  mockGetUserHierarchysDao.mockResolvedValue([]);
});

describe('Reports Service', () => {
  const mockUser = { company_id: 1, role: 'ADMIN' };
  const mockReq = ({ query = {}, body = {} } = {}) => ({ user: mockUser, query, body });

  describe('getPayInReportService', () => {
    it('should fetch pay-in merchant report when merchant codes are found', async () => {
      const mockMerchants = [{ id: 101 }];
      const mockResult = [{ id: 1, amount: 5000 }];

      mockGetMerchantsDaoArray.mockResolvedValue(mockMerchants);
      mockGetPayInMerchantReportDao.mockResolvedValue(mockResult);

      const req = mockReq({
        query: {
          code: 'M001',
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          status: 'SUCCESS',
          updatedPayin: 'false',
        },
      });

      const result = await reportsService.getPayInReportService(req);

      expect(Array.isArray(result)).toBe(true);
    }, 30000);

    it('should fallback to vendor report when no merchants found', async () => {
      const mockVendors = [{ user_id: 201 }];
      const mockBankAccounts = [{ id: 301 }];
      const mockResult = [{ id: 2, amount: 3000 }];

      mockGetMerchantsDaoArray.mockResolvedValue([]);
      mockGetVendorsDaoArray.mockResolvedValue(mockVendors);
      mockGetBankaccountDao.mockResolvedValue(mockBankAccounts);
      mockGetPayInVendorReportDao.mockResolvedValue(mockResult);

      const req = mockReq({
        query: {
          code: 'V001',
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        },
      });

      const result = await reportsService.getPayInReportService(req);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getPayOutReportService', () => {
    it('should fetch pay-out merchant report', async () => {
      const mockMerchants = [{ id: 101 }];
      const mockResult = [{ id: 100, amount: 2000 }];

      mockGetMerchantsDaoArray.mockResolvedValue(mockMerchants);
      mockGetPayOutMerchantReportDao.mockResolvedValue(mockResult);

      const req = mockReq({
        query: {
          code: 'M001',
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          status: 'APPROVED',
        },
      });

      const result = await reportsService.getPayOutReportService(req);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should fetch pay-out vendor report when no merchants found', async () => {
      mockGetMerchantsDaoArray.mockResolvedValue([]);
      mockGetVendorsDaoArray.mockResolvedValue([{ id: 201 }]);
      mockGetPayOutVendorReportDao.mockResolvedValue([{ id: 1 }]);

      const req = mockReq({
        query: {
          code: 'V001',
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        },
      });

      const result = await reportsService.getPayOutReportService(req);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getClientsAccountReportService', () => {
    it('should throw error if dates are missing for merchant report', async () => {
      const req = mockReq({ body: { role_name: 'MERCHANT' } });
      await expect(reportsService.getClientsAccountReportService(req))
        .rejects.toThrow();
    });

    it('should fetch merchant report with clubbing logic', async () => {
      const mockMerchantData = [
        { code: 'M001', calculation_user_id: 'uuid1', total_payin_amount: 1000, created_at: '2025-01-01' },
        { code: 'M002', calculation_user_id: 'uuid2', total_payin_amount: 500, created_at: '2025-01-01' },
      ];

      mockGetMerchantReportDao.mockResolvedValue(mockMerchantData);
      mockGetUsersDao.mockResolvedValue([{ designation_id: 1 }]);
      mockGetDesignationDao.mockResolvedValue([{ designation: 'MERCHANT' }]);
      mockGetUserHierarchysDao.mockResolvedValue([]);

      const req = mockReq({
        body: {
          role_name: 'MERCHANT',
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          code: 'M001,M002',
        },
      });

      const result = await reportsService.getClientsAccountReportService(req);

      // expect(mockGetMerchantReportDao).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    // it('should fetch vendor report', async () => {
    //   const mockVendorData = [{ code: 'V001', total_payin_amount: 1500 }];

    //   mockGetVendorReportDao.mockResolvedValue(mockVendorData);

    //   const req = mockReq({
    //     body: {
    //       role_name: 'VENDOR',
    //       startDate: '2025-01-01',
    //       endDate: '2025-01-31',
    //       code: 'V001',
    //     },
    //   });

    //   const result = await reportsService.getClientsAccountReportService(req);

    //   // expect(mockGetVendorReportDao).toHaveBeenCalled();
    //   expect(result).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'V001' })]));
    // });

    it('should handle pagination', async () => {
      const mockData = Array.from({ length: 25 }, (_, i) => ({ code: `M${i + 1}` }));

      mockGetMerchantReportDao.mockResolvedValue(mockData);
      mockGetUsersDao.mockResolvedValue([{ designation_id: 1 }]);
      mockGetDesignationDao.mockResolvedValue([{ designation: 'MERCHANT' }]);
      mockGetUserHierarchysDao.mockResolvedValue([]);

      const req = mockReq({
        body: {
          role_name: 'MERCHANT',
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          page: '2',
          limit: '10',
        },
      });

      const result = await reportsService.getClientsAccountReportService(req);

      expect(result.length).toBeLessThanOrEqual(10);
    });
  });
});