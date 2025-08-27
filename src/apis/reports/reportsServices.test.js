import { getMerchantsDaoArray } from '../merchants/merchantDao.js';
import { getVendorsDaoArray } from '../vendors/vendorDao.js';
import { getBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
import { getDesignationDao } from '../designation/designationDao.js';
import { getUsersDao } from '../users/userDao.js';

const {
  getPayInReportService,
  getPayOutReportService,
  getClientsAccountReportService,
} = require('./reportsService');
const {
  getMerchantReportDao,
  getPayInMerchantReportDao,
  getPayInVendorReportDao,
  getPayOutMerchantReportDao,
  getPayOutVendorReportDao,
  getVendorReportDao,
} = require('./reportsDao');

const { logger } = require('../../utils/logger');
const dayjs = require('dayjs');
const { Role } = require('../../constants/index');

jest.mock('../merchants/merchantDao.js');
jest.mock('../vendors/vendorDao.js');
jest.mock('../bankAccounts/bankaccountDao.js');
jest.mock('./reportsDao');
jest.mock('../../utils/logger');
jest.mock('../bankAccounts/bankaccountDao');
jest.mock('../merchants/merchantDao');
jest.mock('../vendors/vendorDao');
jest.mock('../userHierarchy/userHierarchyDao');
jest.mock('../designation/designationDao');
jest.mock('../users/userDao');
jest.mock('dayjs', () => {
  const actualDayjs = jest.requireActual('dayjs');
  const utc = require('dayjs/plugin/utc');
  const timezone = require('dayjs/plugin/timezone');

  actualDayjs.extend(utc);
  actualDayjs.extend(timezone);

  // Create a mock for dayjs.tz that preserves the original dayjs behavior
  const mockTz = jest.fn((date, tz) => {
    const instance = actualDayjs(date).tz(tz);
    instance.format = jest.fn().mockImplementation((formatString) =>
      actualDayjs(date).tz(tz).format(formatString)
    );
    instance.toISOString = jest.fn().mockImplementation(() =>
      actualDayjs(date).tz(tz).toISOString()
    );
    return instance;
  });

  return {
    ...actualDayjs,
    tz: mockTz,
  };
});

describe('Reports Service', () => {
  let mockReq;

  beforeEach(() => {
    mockReq = {
      user: { company_id: '123', role: 'admin' },
      query: { code: 'code1,code2', startDate: '2025-08-01', endDate: '2025-08-31' },
    };
    jest.clearAllMocks();
    // Remove or adjust the dayjs.tz mock to avoid overriding the format method
    // If you need specific toISOString behavior, set it per test case instead
  });

  describe('getPayInReportService', () => {
    it('should return merchant report when merchant IDs are found', async () => {
      getMerchantsDaoArray.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      getPayInMerchantReportDao.mockResolvedValue([{ id: 456, amount: 1000 }]);
      getVendorsDaoArray.mockResolvedValue([]);
      getBankaccountDao.mockResolvedValue([]);

      const result = await getPayInReportService(mockReq);

      expect(getMerchantsDaoArray).toHaveBeenCalledWith('123', ['code1', 'code2']);
      expect(getPayInMerchantReportDao).toHaveBeenCalledWith(
        [1, 2],
        '2025-07-31T20:00:00.000Z',
        '2025-08-31T19:59:59.999Z',
        '123',
        'admin',
        undefined,
        undefined,
      );
      expect(result).toEqual([{ id: 456, amount: 1000 }]);
      expect(getVendorsDaoArray).not.toHaveBeenCalled();
    });

    it('should return vendor report when no merchant IDs are found', async () => {
      getMerchantsDaoArray.mockResolvedValue([]);
      getVendorsDaoArray.mockResolvedValue([{ user_id: 3 }, { user_id: 4 }]);
      getBankaccountDao.mockResolvedValue([{ id: 5 }, { id: 6 }]);
      getPayInVendorReportDao.mockResolvedValue([{ id: 789, amount: 2000 }]);

      const result = await getPayInReportService(mockReq);

      expect(getMerchantsDaoArray).toHaveBeenCalledWith('123', ['code1', 'code2']);
      expect(getVendorsDaoArray).toHaveBeenCalledWith('123', ['code1', 'code2']);
      expect(getBankaccountDao).toHaveBeenCalledWith({ user_id: [3, 4] });
      expect(getPayInVendorReportDao).toHaveBeenCalledWith(
        [5, 6],
        '2025-07-31T20:00:00.000Z',
        '2025-08-31T19:59:59.999Z',
        '123',
        'admin',
        undefined,
        undefined,
      );
      expect(result).toEqual([{ id: 789, amount: 2000 }]);
    });

    it('should throw an error if DAO fails', async () => {
      getMerchantsDaoArray.mockRejectedValue(new Error('DAO error'));

      await expect(getPayInReportService(mockReq)).rejects.toThrow('DAO error');
      expect(logger.error).toHaveBeenCalledWith('Error while fetching report', expect.any(Error));
    });
  });

  describe('getPayOutReportService', () => {
    it('should return merchant report when merchant IDs are found', async () => {
      getMerchantsDaoArray.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      getPayOutMerchantReportDao.mockResolvedValue([{ id: 123, amount: 5000.5 }]);
      getVendorsDaoArray.mockResolvedValue([]);

      const result = await getPayOutReportService(mockReq);

      expect(getMerchantsDaoArray).toHaveBeenCalledWith('123', ['code1', 'code2']);
      expect(getPayOutMerchantReportDao).toHaveBeenCalledWith(
        [1, 2],
        '2025-07-31T20:00:00.000Z',
        '2025-08-31T19:59:59.999Z',
        '123',
        'admin',
        undefined,
      );
      expect(result).toEqual([{ id: 123, amount: 5000.5 }]);
      expect(getVendorsDaoArray).not.toHaveBeenCalled();
    });

    it('should return vendor report when no merchant IDs are found', async () => {
      getMerchantsDaoArray.mockResolvedValue([]);
      getVendorsDaoArray.mockResolvedValue([{ id: 3 }, { id: 4 }]);
      getPayOutVendorReportDao.mockResolvedValue([{ id: 456, amount: 3000 }]);

      const result = await getPayOutReportService(mockReq);

      expect(getMerchantsDaoArray).toHaveBeenCalledWith('123', ['code1', 'code2']);
      expect(getVendorsDaoArray).toHaveBeenCalledWith('123', ['code1', 'code2']);
      expect(getPayOutVendorReportDao).toHaveBeenCalledWith(
        [3, 4],
        '2025-07-31T20:00:00.000Z',
        '2025-08-31T19:59:59.999Z',
        '123',
        'admin',
        undefined,
      );
      expect(result).toEqual([{ id: 456, amount: 3000 }]);
    });

    it('should throw an error if DAO fails', async () => {
      getMerchantsDaoArray.mockRejectedValue(new Error('DAO error'));

      await expect(getPayOutReportService(mockReq)).rejects.toThrow('DAO error');
      expect(logger.error).toHaveBeenCalledWith('Error while fetching report', expect.any(Error));
    });
  });

  describe('getClientsAccountReportService', () => {
    it('should return merchant report with sub-merchants for MERCHANT role', async () => {
      mockReq.query.role_name = Role.MERCHANT;
      mockReq.query.code = 'user1';
      mockReq.query.page = '1';
      mockReq.query.limit = '2';
      const parentData = [
        { code: 'user1', calculation_user_id: 'user1', created_at: '2025-08-01', amount: 1000 },
      ];
      const childData = [
        { code: 'sub1', calculation_user_id: 'sub1', parent_code: 'user1', created_at: '2025-08-01', amount: 500 },
      ];
      getUsersDao.mockResolvedValue([{ id: 'user1', designation_id: 1 }]);
      getDesignationDao.mockResolvedValue([{ designation: Role.MERCHANT }]);
      getUserHierarchysDao.mockResolvedValue([{ user_id: 'user1', config: { siblings: { sub_merchants: ['sub1'] } } }]);
      getMerchantReportDao
        .mockResolvedValueOnce(parentData)
        .mockResolvedValueOnce(childData);

      // Mock the format method result for a specific dayjs.tz call
      dayjs.tz.mockReturnValue({
        format: jest.fn().mockReturnValue('2025-08-01'),
        toISOString: jest.fn().mockReturnValue('2025-08-01T00:00:00.000Z'),
      });

      const result = await getClientsAccountReportService(mockReq);

      expect(getUsersDao).toHaveBeenCalledWith({ company_id: '123', id: ['user1'] });
      expect(getDesignationDao).toHaveBeenCalledWith({ id: 1 });
      expect(getUserHierarchysDao).toHaveBeenCalledWith({ user_id: ['user1'] });
      expect(getMerchantReportDao).toHaveBeenCalledTimes(2);
      expect(getMerchantReportDao).toHaveBeenCalledWith('123', ['user1'], '2025-08-01', '2025-08-31', null, null, 'admin');
      expect(dayjs.tz).toHaveBeenCalledWith(expect.any(String), 'Asia/Kolkata');
      expect(result).toEqual([
        { code: 'user1', calculation_user_id: "user1", created_at: '2025-08-01', user_id: 'user1', amount: 1500 },
      ]);
    });

    it('should return vendor report for non-MERCHANT role', async () => {
      mockReq.query.role_name = 'VENDOR';
      mockReq.query.code = 'vendor1';
      const vendorData = [{ id: 789, name: 'Vendor A' }];
      getVendorReportDao.mockResolvedValue(vendorData);

      const result = await getClientsAccountReportService(mockReq);

      expect(getVendorReportDao).toHaveBeenCalledWith('123', ['vendor1'], '2025-08-01', '2025-08-31', undefined, undefined, 'admin');
      expect(result).toEqual(vendorData);
      expect(getUsersDao).not.toHaveBeenCalled();
    });

    it('should apply pagination correctly', async () => {
      mockReq.query.role_name = Role.MERCHANT;
      mockReq.query.code = 'user1';
      mockReq.query.page = '2';
      mockReq.query.limit = '1';
      const parentData = [
        { code: 'user1', calculation_user_id: 'user1', created_at: '2025-08-01', amount: 1000 },
        { code: 'user1', calculation_user_id: 'user1', created_at: '2025-08-02', amount: 2000 },
      ];
      getUsersDao.mockResolvedValue([{ id: 'user1', designation_id: 1 }]);
      getDesignationDao.mockResolvedValue([{ designation: Role.MERCHANT }]);
      getUserHierarchysDao.mockResolvedValue([]);
      getMerchantReportDao.mockResolvedValue(parentData);

      // Mock the format method result for pagination test
      dayjs.tz.mockReturnValue({
        format: jest.fn().mockReturnValue('2025-08-02'),
        toISOString: jest.fn().mockReturnValue('2025-08-02T00:00:00.000Z'),
      });

      const result = await getClientsAccountReportService(mockReq);

      expect(result).toEqual([
        // { code: 'user1', created_at: '2025-08-02', user_id: 'user1', amount: 2000 },
      ]);
    });

    it('should throw an error if DAO fails', async () => {
      mockReq.query.role_name = Role.MERCHANT;
      getUsersDao.mockRejectedValue(new Error('DAO error'));

      await expect(getClientsAccountReportService(mockReq)).rejects.toThrow('DAO error');
      expect(logger.error).toHaveBeenCalledWith('Error while fetching report', expect.any(Error));
    });

    it('should handle empty sub-merchants and parent data', async () => {
      mockReq.query.role_name = Role.MERCHANT;
      mockReq.query.code = 'user1';
      getUsersDao.mockResolvedValue([{ id: 'user1', designation_id: 1 }]);
      getDesignationDao.mockResolvedValue([{ designation: Role.MERCHANT }]);
      getUserHierarchysDao.mockResolvedValue([]);
      getMerchantReportDao.mockResolvedValue([]);

      // Mock the format method result for empty data test
      dayjs.tz.mockReturnValue({
        format: jest.fn().mockReturnValue('2025-08-01'),
        toISOString: jest.fn().mockReturnValue('2025-08-01T00:00:00.000Z'),
      });

      const result = await getClientsAccountReportService(mockReq);

      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith('childData or userHierarchy is empty or not an array:', { childData: [], userHierarchy: [] });
    });
  });
});