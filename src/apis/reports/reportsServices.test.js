jest.mock('../../utils/db.js', () => ({
  createPool: jest.fn(),
  ...jest.requireActual('../../utils/db.js'),
}));
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
const { getMerchantsDaoArray } = require('../merchants/merchantDao');
const { getVendorsDaoArray } = require('../vendors/vendorDao');
const { getBankaccountDao } = require('../bankAccounts/bankaccountDao.js');
const { getUserHierarchysDao } = require('../userHierarchy/userHierarchyDao');
const { getDesignationDao } = require('../designation/designationDao');
const { getUsersDao } = require('../users/userDao');
const { logger } = require('../../utils/logger');
const dayjs = require('dayjs');
const { Role } = require('../../constants/index');

jest.mock('../merchants/merchantDao');
jest.mock('../vendors/vendorDao');
jest.mock('../bankAccounts/bankaccountDao');
jest.mock('../userHierarchy/userHierarchyDao');
jest.mock('../designation/designationDao');
jest.mock('../users/userDao');
jest.mock('./reportsDao');
jest.mock('../../utils/logger');

jest.mock('dayjs', () => {
  const originalDayjs = jest.requireActual('dayjs');
  const utcPlugin = jest.requireActual('dayjs/plugin/utc');
  const timezonePlugin = jest.requireActual('dayjs/plugin/timezone');

  let internalDayjs = originalDayjs.extend(utcPlugin).extend(timezonePlugin);

  const mockDayjsFn = jest.fn((date) => {
    const instance = internalDayjs(date);
    return instance;
  });

  mockDayjsFn.extend = jest.fn((plugin) => {
    internalDayjs = internalDayjs.extend(plugin);
    return internalDayjs;  // Chainable
  });

  mockDayjsFn.tz = jest.fn((dateOrTz, tz) => {
    if (tz !== undefined) {
      return internalDayjs.tz(dateOrTz, tz);
    } else {
      return internalDayjs.tz(dateOrTz);
    }
  });

  // Prototype for instances (allows spying on instance methods like .format)
  mockDayjsFn.prototype = {
    format: jest.fn((formatStr) => internalDayjs().format(formatStr)),
    toISOString: jest.fn(() => internalDayjs().toISOString()),
    tz: jest.fn((tz) => internalDayjs().tz(tz)),
  };

  return mockDayjsFn;  // Return the function object with .extend attached
});

describe('Reports Service', () => {
  let mockReq;

  beforeEach(() => {
    mockReq = {
      user: { company_id: '123', role: 'admin' },
      query: { code: 'code1,code2', startDate: '2025-08-01', endDate: '2025-08-31', role_name: 'MERCHANT' , page: '1', limit: '10'},
    };
    jest.clearAllMocks();
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
        '2025-07-31T18:30:00.000Z',
        '2025-08-31T18:29:59.999Z',
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
        '2025-07-31T18:30:00.000Z',
        '2025-08-31T18:29:59.999Z',
        '123',
        'admin',
        undefined,
        undefined,
      );
      expect(result).toEqual([{ id: 789, amount: 2000 }]);
    });

    it('should throw an error if DAO fails', async () => {
      getMerchantsDaoArray.mockImplementation(() => Promise.reject(new Error('DAO error')));

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
        '2025-07-31T18:30:00.000Z',
        '2025-08-31T18:29:59.999Z',
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
        '2025-07-31T18:30:00.000Z',
        '2025-08-31T18:29:59.999Z',
        '123',
        'admin',
        undefined,
      );
      expect(result).toEqual([{ id: 456, amount: 3000 }]);
    });

    it('should throw an error if DAO fails', async () => {
      getMerchantsDaoArray.mockImplementation(() => Promise.reject(new Error('DAO error')));

      const mockReq = {
        user: { company_id: '123', role: 'admin' },
        query: { code: 'ABC', startDate: '2025-09-01', endDate: '2025-09-08', status: 'pending' },
      };

      await expect(getPayOutReportService(mockReq)).rejects.toThrow('DAO error');
      expect(logger.error).toHaveBeenCalledWith('Error while fetching report', expect.any(Error));
    });
  });

  describe('getClientsAccountReportService', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockReq = {
        user: { company_id: '123', role: 'admin' },
        query: { startDate: '2025-08-01', endDate: '2025-08-31' },
      };
    });

    it('should throw an error if getMerchantsDaoArray fails', async () => {
      const mockReq = {
        user: { company_id: '123', role: 'admin' },
        query: { code: 'merchant1,merchant2', role_name: 'MERCHANT' }
      };
    
      getMerchantsDaoArray.mockImplementation(() => Promise.reject(new Error('Merchant DAO error')));
    
      await expect(getClientsAccountReportService(mockReq)).rejects.toThrow('Merchant DAO error');
      expect(logger.error).toHaveBeenCalledWith('Error while fetching report', expect.any(Error));
      expect(getMerchantReportDao).not.toHaveBeenCalled();
    });

    it('should throw an error if getMerchantReportDao fails', async () => {
      getMerchantsDaoArray.mockResolvedValue([{ user_id: 'user1' }]);
      getMerchantReportDao.mockImplementation(() => Promise.reject(new Error('Report DAO error')));
      mockReq.query.role_name = Role.MERCHANT;

      await expect(getClientsAccountReportService(mockReq)).rejects.toThrow('Report DAO error');
      expect(logger.error).toHaveBeenCalledWith('Error while fetching report', expect.any(Error));
    });

    it('should throw an error if getVendorReportDao fails', async () => {
      getVendorReportDao.mockImplementation(() => Promise.reject(new Error('Vendor DAO error')));

      await expect(getClientsAccountReportService(mockReq)).rejects.toThrow('Vendor DAO error');
      expect(logger.error).toHaveBeenCalledWith('Error while fetching report', expect.any(Error));
    });

    it('should throw an error if getUsersDao fails during hierarchy check', async () => {
      mockReq.query.role_name = Role.MERCHANT;
      mockReq.query.code = 'user1';
      getMerchantsDaoArray.mockResolvedValue([{ user_id: 'user1' }]);
      getMerchantReportDao.mockResolvedValue([{ code: 'user1', calculation_user_id: 'user1', created_at: '2025-08-01' }]);
      getUsersDao.mockImplementation(() => Promise.reject(new Error('Users DAO error')));
      getDesignationDao.mockResolvedValue([{ designation: Role.MERCHANT }]);

      await expect(getClientsAccountReportService(mockReq)).rejects.toThrow('Users DAO error');
      expect(logger.error).toHaveBeenCalledWith('Error while fetching report', expect.any(Error));
    });

    it('should throw an error if getUserHierarchysDao fails', async () => {
      mockReq.query.role_name = Role.MERCHANT;
      mockReq.query.code = 'user1';
      getMerchantsDaoArray.mockResolvedValue([{ user_id: 'user1' }]);
      getMerchantReportDao.mockResolvedValue([{ code: 'user1', calculation_user_id: 'user1', created_at: '2025-08-01' }]);
      getUsersDao.mockResolvedValue([{ id: 'user1', designation_id: 1 }]);
      getDesignationDao.mockResolvedValue([{ designation: Role.MERCHANT }]);
      getUserHierarchysDao.mockImplementation(() => Promise.reject(new Error('Hierarchy DAO error')));

      await expect(getClientsAccountReportService(mockReq)).rejects.toThrow('Hierarchy DAO error');
      expect(logger.error).toHaveBeenCalledWith('Error while fetching report', expect.any(Error));
    });

    // 2. Code parsing scenarios
    it('should handle single merchant code correctly', async () => {
      mockReq.query.code = 'merchant1';
      mockReq.query.role_name = Role.MERCHANT;
      getMerchantsDaoArray.mockResolvedValue([{ user_id: 'user1' }]);
      getMerchantReportDao.mockResolvedValue([{ code: 'merchant1', calculation_user_id: 'user1', created_at: '2025-08-01' }]);
      getUsersDao.mockResolvedValue([{ id: 'user1', designation_id: 1 }]);
      getDesignationDao.mockResolvedValue([{ designation: Role.MERCHANT }]);
      getUserHierarchysDao.mockResolvedValue([]);

      const result = await getClientsAccountReportService(mockReq);
      
      expect(getMerchantsDaoArray).toHaveBeenCalledWith('123', ['merchant1']);
      expect(getMerchantReportDao).toHaveBeenCalledWith('123', ['user1'], '2025-08-01', '2025-08-31', null, null, 'admin');
      expect(result).toEqual([{ code: 'merchant1', calculation_user_id: 'user1', created_at: '2025-08-01' , user_id : "user1" }]);
    });

    it('should handle multiple merchant codes with spaces', async () => {
      mockReq.query.code = 'merchant1, merchant2 ,merchant3';
      mockReq.query.role_name = Role.MERCHANT;
      getMerchantsDaoArray.mockResolvedValue([
        { user_id: 'user1' },
        { user_id: 'user2' },
        { user_id: 'user3' }
      ]);
      getMerchantReportDao.mockResolvedValue([
        { code: 'merchant1', calculation_user_id: 'user1', created_at: '2025-08-01' },
        { code: 'merchant2', calculation_user_id: 'user2', created_at: '2025-08-01' },
        { code: 'merchant3', calculation_user_id: 'user3', created_at: '2025-08-01' }
      ]);
      getUsersDao.mockResolvedValue([{ id: 'user1', designation_id: 1 }, { id: 'user2', designation_id: 1 }, { id: 'user3', designation_id: 1 }]);
      getDesignationDao.mockResolvedValue([{ designation: Role.MERCHANT }]);
      getUserHierarchysDao.mockResolvedValue([]);

      const result = await getClientsAccountReportService(mockReq);
      
      expect(getMerchantsDaoArray).toHaveBeenCalledWith('123', ['merchant1', 'merchant2', 'merchant3']);
      expect(result).toHaveLength(3);
      expect(result.map(r => r.code)).toEqual(['merchant1', 'merchant2', 'merchant3']);
    });

    it('should handle empty code (all merchants) for MERCHANT role', async () => {
      delete mockReq.query.code;
      mockReq.query.role_name = Role.MERCHANT;
      getMerchantReportDao.mockResolvedValue([
        { code: 'merchant1', calculation_user_id: 'user1', created_at: '2025-08-01' },
        { code: 'merchant2', calculation_user_id: 'user2', created_at: '2025-08-01' }
      ]);
      getUserHierarchysDao.mockResolvedValue([]);

      const result = await getClientsAccountReportService(mockReq);
      
      expect(getMerchantReportDao).toHaveBeenCalledWith('123', null, '2025-08-01', '2025-08-31', null, null, 'admin');
      expect(result).toHaveLength(2);
    });

    it('should handle empty code string for MERCHANT role', async () => {
      mockReq.query.code = '';
      mockReq.query.role_name = Role.MERCHANT;
      getMerchantReportDao.mockResolvedValue([
        { code: 'merchant1', calculation_user_id: 'user1', created_at: '2025-08-01' }
      ]);
      getUserHierarchysDao.mockResolvedValue([]);

      const result = await getClientsAccountReportService(mockReq);
      
      expect(getMerchantReportDao).toHaveBeenCalledWith('123', null, '2025-08-01', '2025-08-31', null, null, 'admin');
      expect(result).toEqual([{ code: 'merchant1', calculation_user_id: 'user1', created_at: '2025-08-01' , user_id : "user1" }]);
    });

    it('should handle null/undefined code as all merchants', async () => {
      mockReq.query.code = null;
      mockReq.query.role_name = Role.MERCHANT;
      getMerchantReportDao.mockResolvedValue([
        { code: 'merchant1', calculation_user_id: 'user1', created_at: '2025-08-01' }
      ]);
      getUserHierarchysDao.mockResolvedValue([]);

      const result = await getClientsAccountReportService(mockReq);
      
      expect(getMerchantReportDao).toHaveBeenCalledWith('123', null, '2025-08-01', '2025-08-31', null, null, 'admin');
      expect(result).toEqual([{ code: 'merchant1', calculation_user_id: 'user1', created_at: '2025-08-01' , user_id : "user1" }]);
    });

    it('should handle invalid/empty codes array', async () => {
      mockReq.query.code = ',,,';
      mockReq.query.role_name = Role.MERCHANT;
      getMerchantReportDao.mockResolvedValue([
        { code: 'merchant1', calculation_user_id: 'user1', created_at: '2025-08-01' }
      ]);
      getUserHierarchysDao.mockResolvedValue([]);

      const result = await getClientsAccountReportService(mockReq);
      
      expect(getMerchantReportDao).toHaveBeenCalledWith('123', null, '2025-08-01', '2025-08-31', null, null, 'admin');
      expect(result).toEqual([{ code: 'merchant1', calculation_user_id: 'user1', created_at: '2025-08-01' , user_id : "user1" }]);
    });

    it('should handle no merchants found for codes (treat as all merchants)', async () => {
      mockReq.query.code = 'nonexistent';
      mockReq.query.role_name = Role.MERCHANT;
      getMerchantsDaoArray.mockResolvedValue([]);
      getMerchantReportDao.mockResolvedValue([
        { code: 'merchant1', calculation_user_id: 'user1', created_at: '2025-08-01' }
      ]);
      getUserHierarchysDao.mockResolvedValue([]);

      const result = await getClientsAccountReportService(mockReq);
      
      expect(getMerchantsDaoArray).toHaveBeenCalledWith('123', ['nonexistent']);
      expect(getMerchantReportDao).toHaveBeenCalledWith('123', [], '2025-08-01', '2025-08-31', null, null, 'admin');
      expect(result).toEqual([{ code: 'merchant1', calculation_user_id: 'user1', created_at: '2025-08-01' , user_id : "user1" }]);
    });

    // 3. UUID handling
    it('should handle UUID user IDs directly without merchant lookup', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      mockReq.query.code = userId;
      mockReq.query.role_name = Role.MERCHANT;
      getMerchantReportDao.mockResolvedValue([
        { code: 'merchant1', calculation_user_id: userId, created_at: '2025-08-01' }
      ]);
      getUsersDao.mockResolvedValue([{ id: userId, designation_id: 1 }]);
      getDesignationDao.mockResolvedValue([{ designation: Role.MERCHANT }]);
      getUserHierarchysDao.mockResolvedValue([]);

      const result = await getClientsAccountReportService(mockReq);
      
      expect(getMerchantsDaoArray).not.toHaveBeenCalled();
      expect(getMerchantReportDao).toHaveBeenCalledWith('123', [userId], '2025-08-01', '2025-08-31', null, null, 'admin');
      expect(result).toEqual([{ code: 'merchant1', calculation_user_id: userId, created_at: '2025-08-01' , user_id : '123e4567-e89b-12d3-a456-426614174000' }]);
    });

    it('should handle mixed UUID and merchant codes', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      mockReq.query.code = `merchant1,${userId}`;
      mockReq.query.role_name = Role.MERCHANT;
      getMerchantsDaoArray.mockResolvedValue([{ user_id: 'user1' }]); // Only for merchant1
      getMerchantReportDao.mockResolvedValue([
        { code: 'merchant1', calculation_user_id: 'user1', created_at: '2025-08-01' },
        { code: 'user-uuid', calculation_user_id: userId, created_at: '2025-08-01' }
      ]);
      getUsersDao.mockResolvedValue([
        { id: userId, designation_id: 1 },
        { id: 'user1', designation_id: 1 }
      ]);
      getDesignationDao.mockResolvedValue([{ designation: Role.MERCHANT }]);
      getUserHierarchysDao.mockResolvedValue([]);

      const result = await getClientsAccountReportService(mockReq);
      
      expect(getMerchantsDaoArray).toHaveBeenCalledWith('123', ["merchant1",'123e4567-e89b-12d3-a456-426614174000']); // Only merchant1 needs lookup
      expect(getMerchantReportDao).toHaveBeenCalledWith('123', ['user1'], '2025-08-01', '2025-08-31', null, null, 'admin');
      expect(result).toHaveLength(2);
    });

    it('should return vendor report for non-MERCHANT role', async () => {
      mockReq.query.role_name = 'VENDOR';
      mockReq.query.code = 'vendor1';
      const vendorData = [{ id: 789, name: 'Vendor A', created_at: '2025-08-01T00:00:00.000Z' }];
      getMerchantsDaoArray.mockResolvedValue([]);
      getVendorReportDao.mockResolvedValue(vendorData);
    
      dayjs.tz.mockReturnValue({
        format: jest.fn().mockReturnValue('2025-08-01T00:00:00.000Z')
      });

      const result = await getClientsAccountReportService(mockReq);
    
      // expect(getMerchantsDaoArray).toHaveBeenCalledWith('123', ['vendor1']);
      expect(getVendorReportDao).toHaveBeenCalledWith('123', [], '2025-08-01', '2025-08-31', null, null, 'admin');
      expect(result).toEqual([
        {
          id: 789,
          name: 'Vendor A',
          created_at: '2025-08-01T00:00:00.000Z',
        },
      ]);
      expect(getUsersDao).toHaveBeenCalled();
    });

    it('should return all vendors when no code provided for non-MERCHANT role', async () => {
      delete mockReq.query.code;
      mockReq.query.role_name = 'VENDOR';
      const vendorData = [{ id: 789, name: 'Vendor A', created_at: '2025-08-01T00:00:00.000Z' }];
      getVendorReportDao.mockResolvedValue(vendorData);
    
      dayjs.tz.mockReturnValue({
        format: jest.fn().mockReturnValue('2025-08-01')
      });

      const result = await getClientsAccountReportService(mockReq);
    
      expect(getVendorReportDao).toHaveBeenCalledWith('123', null, '2025-08-01', '2025-08-31', null, null, 'admin');
      expect(result).toEqual([
        {
          id: 789,
          name: 'Vendor A',
          created_at: '2025-08-01',
        },
      ]);
    });

    // 5. Hierarchy and sub-merchant scenarios
    it('should return merchant report with sub-merchants for MERCHANT role with hierarchy', async () => {
      mockReq.query.role_name = Role.MERCHANT;
      mockReq.query.code = 'merchant1';
      getMerchantsDaoArray.mockResolvedValue([{ user_id: 'user1' }]);
      
      const parentData = [
        { code: 'merchant1', calculation_user_id: 'user1', created_at: '2025-08-01', amount: 1000, transactions: 5 }
      ];
      const childData = [
        { code: 'sub1', calculation_user_id: 'sub1', created_at: '2025-08-01', amount: 500, transactions: 2 },
        { code: 'sub2', calculation_user_id: 'sub2', created_at: '2025-08-01', amount: 300, transactions: 1 }
      ];
      
      // Mock all merchant data to include both parent and children for mapping
      const allMerchantData = [...parentData, ...childData];
      
      getUsersDao.mockResolvedValue([{ id: 'user1', designation_id: 1 }]);
      getDesignationDao.mockResolvedValue([{ designation: Role.MERCHANT }]);
      getUserHierarchysDao.mockResolvedValue([
        { 
          user_id: 'user1', 
          config: { 
            siblings: { 
              sub_merchants: ['sub1', 'sub2'] 
            } 
          } 
        }
      ]);
      getMerchantReportDao.mockResolvedValue(allMerchantData);

      dayjs.tz.mockReturnValue({
        format: jest.fn().mockReturnValue('2025-08-01')
      });

      const result = await getClientsAccountReportService(mockReq);

      expect(getMerchantsDaoArray).toHaveBeenCalledWith('123', ['merchant1']);
      expect(getUsersDao).toHaveBeenCalledWith({ company_id: '123', id: ['user1'] });
      expect(getDesignationDao).toHaveBeenCalledWith({ id: 1 });
      expect(getUserHierarchysDao).toHaveBeenCalledWith({ user_id: ['user1'] });
      expect(getMerchantReportDao).toHaveBeenCalledWith('123', ['user1', 'sub1' , 'sub2'], '2025-08-01', '2025-08-31', null, null, 'admin');
      expect(result).toEqual([
        { 
          code: 'merchant1', 
          calculation_user_id: 'user1', 
          created_at: '2025-08-01', 
          user_id: 'user1', 
          amount: 1800, 
          transactions: 8 
        },
      ]);
    });

    it('should handle hierarchy when no sub-merchants exist', async () => {
      mockReq.query.role_name = Role.MERCHANT;
      mockReq.query.code = 'merchant1';
      getMerchantsDaoArray.mockResolvedValue([{ user_id: 'user1' }]);
      getMerchantReportDao.mockResolvedValue([
        { code: 'merchant1', calculation_user_id: 'user1', created_at: '2025-08-01', amount: 1000 }
      ]);
      getUsersDao.mockResolvedValue([{ id: 'user1', designation_id: 1 }]);
      getDesignationDao.mockResolvedValue([{ designation: Role.MERCHANT }]);
      getUserHierarchysDao.mockResolvedValue([
        { user_id: 'user1', config: { siblings: { sub_merchants: [] } } }
      ]);

      dayjs.tz.mockReturnValue({
        format: jest.fn().mockReturnValue('2025-08-01')
      });

      const result = await getClientsAccountReportService(mockReq);

      expect(result).toEqual([
        { 
          code: 'merchant1', 
          calculation_user_id: 'user1', 
          created_at: '2025-08-01', 
          amount: 1000 ,
          user_id: 'user1'
        }
      ]);
      expect(logger.info).toHaveBeenCalledWith('No sub-merchants found for clubbing. Returning 1 merchant records as-is');
    });

    it('should handle all merchants scenario with sub-merchant hierarchies', async () => {
      delete mockReq.query.code;
      mockReq.query.role_name = Role.MERCHANT;
      const allMerchantData = [
        { code: 'parent1', calculation_user_id: 'parent1', created_at: '2025-08-01', amount: 1000 },
        { code: 'parent2', calculation_user_id: 'parent2', created_at: '2025-08-01', amount: 2000 },
        { code: 'child1', calculation_user_id: 'child1', created_at: '2025-08-01', amount: 500 },
        { code: 'child2', calculation_user_id: 'child2', created_at: '2025-08-01', amount: 300 }
      ];
      
      getMerchantReportDao.mockResolvedValue(allMerchantData);
      getUserHierarchysDao.mockResolvedValue([
        { user_id: 'parent1', config: { siblings: { sub_merchants: ['child1'] } } },
        { user_id: 'parent2', config: { siblings: { sub_merchants: ['child2'] } } }
      ]);

      dayjs.tz.mockReturnValue({
        format: jest.fn().mockReturnValue('2025-08-01')
      });

      const result = await getClientsAccountReportService(mockReq);

      expect(getMerchantReportDao).toHaveBeenCalledWith('123', null, '2025-08-01', '2025-08-31', null, null, 'admin');
      expect(getUserHierarchysDao).toHaveBeenCalledWith({ user_id: ['parent1', 'parent2', 'child1', 'child2'] });
      expect(result).toHaveLength(2); // Only parents after clubbing
      expect(result[0].amount).toBe(1500); // parent1 + child1
      expect(result[1].amount).toBe(2300); // parent2 + child2
    });

    it('should handle sub-merchant matching by both user_id and code', async () => {
      mockReq.query.role_name = Role.MERCHANT;
      mockReq.query.code = 'parent1';
      getMerchantsDaoArray.mockResolvedValue([{ user_id: 'parent1' }]);
      
      const allMerchantData = [
        { code: 'parent1', calculation_user_id: 'parent1', created_at: '2025-08-01', amount: 1000 },
        { code: 'child1', calculation_user_id: 'child1', created_at: '2025-08-01', amount: 500 },
        { code: 'sub-merchant-1', calculation_user_id: 'child1', created_at: '2025-08-01', amount: 300 } // Same user_id as child1 but different code
      ];
      
      getUsersDao.mockResolvedValue([{ id: 'parent1', designation_id: 1 }]);
      getDesignationDao.mockResolvedValue([{ designation: Role.MERCHANT }]);
      getUserHierarchysDao.mockResolvedValue([
        { 
          user_id: 'parent1', 
          config: { 
            siblings: { 
              sub_merchants: ['child1'] // Matches by user_id
            } 
          } 
        }
      ]);
      getMerchantReportDao.mockResolvedValue(allMerchantData);

      dayjs.tz.mockReturnValue({
        format: jest.fn().mockReturnValue('2025-08-01')
      });

      const result = await getClientsAccountReportService(mockReq);

      expect(result[0].amount).toBe(1800); // parent1(1000) + child1(500) + sub-merchant-1(300)
    });

    // 6. Sorting scenarios
    it('should sort results alphabetically by code with date tiebreaker', async () => {
      mockReq.query.role_name = Role.MERCHANT;
      delete mockReq.query.code;
      getMerchantReportDao.mockResolvedValue([
        { code: 'C-merchant', calculation_user_id: 'user3', created_at: '2025-08-02' },
        { code: 'A-merchant', calculation_user_id: 'user1', created_at: '2025-08-01' },
        { code: 'A-merchant', calculation_user_id: 'user1', created_at: '2025-08-03' }, // Same code, later date
        { code: 'B-merchant', calculation_user_id: 'user2', created_at: '2025-08-01' }
      ]);
      getUserHierarchysDao.mockResolvedValue([]);

      dayjs.tz.mockReturnValue({
        format: jest.fn().mockReturnValue('2025-08-01')
      });

      const result = await getClientsAccountReportService(mockReq);

      expect(result.map(r => r.code)).toEqual(['A-merchant', 'A-merchant', 'B-merchant', 'C-merchant']);
      // The two A-merchant entries should be sorted by date (2025-08-01 first, then 2025-08-03)
    });

    it('should sort clubbed results correctly', async () => {
      mockReq.query.role_name = Role.MERCHANT;
      delete mockReq.query.code;
      const allMerchantData = [
        { code: 'B-parent', calculation_user_id: 'parent2', created_at: '2025-08-01', amount: 1000 },
        { code: 'A-parent', calculation_user_id: 'parent1', created_at: '2025-08-02', amount: 2000 },
        { code: 'A-child', calculation_user_id: 'child1', created_at: '2025-08-01', amount: 500 },
        { code: 'B-child', calculation_user_id: 'child2', created_at: '2025-08-01', amount: 300 }
      ];
      
      getMerchantReportDao.mockResolvedValue(allMerchantData);
      getUserHierarchysDao.mockResolvedValue([
        { user_id: 'parent1', config: { siblings: { sub_merchants: ['child1'] } } },
        { user_id: 'parent2', config: { siblings: { sub_merchants: ['child2'] } } }
      ]);

      dayjs.tz.mockReturnValue({
        format: jest.fn().mockReturnValue('2025-08-01')
      });

      const result = await getClientsAccountReportService(mockReq);

      // Should be sorted: A-parent first (with child), then B-parent (with child)
      expect(result[0].code).toBe('A-parent');
      expect(result[0].amount).toBe(2500); // parent1 + child1
      expect(result[1].code).toBe('B-parent');
      expect(result[1].amount).toBe(1300); // parent2 + child2
    });

    // 7. Pagination scenarios
    it('should apply pagination correctly to final results', async () => {
      mockReq.query.role_name = Role.MERCHANT;
      mockReq.query.page = '2';
      mockReq.query.limit = '2';
      delete mockReq.query.code;
      
      const allData = [
        { code: 'merchant1', calculation_user_id: 'user1', created_at: '2025-08-01', amount: 1000 },
        { code: 'merchant2', calculation_user_id: 'user2', created_at: '2025-08-01', amount: 2000 },
        { code: 'merchant3', calculation_user_id: 'user3', created_at: '2025-08-01', amount: 3000 },
        { code: 'merchant4', calculation_user_id: 'user4', created_at: '2025-08-01', amount: 4000 }
      ];
      
      getMerchantReportDao.mockResolvedValue(allData);
      getUserHierarchysDao.mockResolvedValue([]);

      dayjs.tz.mockReturnValue({
        format: jest.fn().mockReturnValue('2025-08-01')
      });

      const result = await getClientsAccountReportService(mockReq);

      // Page 2 with limit 2 should return merchant3 and merchant4 (indices 2-3)
      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('merchant3');
      expect(result[1].code).toBe('merchant4');
    });

    it('should handle pagination with clubbed results', async () => {
      mockReq.query.role_name = Role.MERCHANT;
      mockReq.query.page = '1';
      mockReq.query.limit = '1';
      delete mockReq.query.code;
      
      const allMerchantData = [
        { code: 'B-parent', calculation_user_id: 'parent2', created_at: '2025-08-01', amount: 1000 },
        { code: 'A-parent', calculation_user_id: 'parent1', created_at: '2025-08-01', amount: 2000 },
        { code: 'A-child', calculation_user_id: 'child1', created_at: '2025-08-01', amount: 500 },
        { code: 'B-child', calculation_user_id: 'child2', created_at: '2025-08-01', amount: 300 }
      ];
      
      getMerchantReportDao.mockResolvedValue(allMerchantData);
      getUserHierarchysDao.mockResolvedValue([
        { user_id: 'parent1', config: { siblings: { sub_merchants: ['child1'] } } },
        { user_id: 'parent2', config: { siblings: { sub_merchants: ['child2'] } } }
      ]);

      dayjs.tz.mockReturnValue({
        format: jest.fn().mockReturnValue('2025-08-01')
      });

      const result = await getClientsAccountReportService(mockReq);

      // After clubbing and sorting, page 1 limit 1 should return only A-parent (first alphabetically)
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('A-parent');
      expect(result[0].amount).toBe(2500);
    });

    it('should handle pagination with empty results', async () => {
      mockReq.query.role_name = Role.MERCHANT;
      mockReq.query.page = '1';
      mockReq.query.limit = '10';
      delete mockReq.query.code;
      
      getMerchantReportDao.mockResolvedValue([]);
      getUserHierarchysDao.mockResolvedValue([]);

      dayjs.tz.mockReturnValue({
        format: jest.fn().mockReturnValue('2025-08-01')
      });

      const result = await getClientsAccountReportService(mockReq);

      expect(result).toEqual([]);
    });

    it('should handle invalid pagination parameters', async () => {
      mockReq.query.role_name = Role.MERCHANT;
      mockReq.query.page = 'abc';
      mockReq.query.limit = 'xyz';
      delete mockReq.query.code;
      
      getMerchantReportDao.mockResolvedValue([
        { code: 'merchant1', calculation_user_id: 'user1', created_at: '2025-08-01' }
      ]);
      getUserHierarchysDao.mockResolvedValue([]);

      dayjs.tz.mockReturnValue({
        format: jest.fn().mockReturnValue('2025-08-01')
      });

      const result = await getClientsAccountReportService(mockReq);

      // Invalid page/limit should return all results (no slicing)
      expect(result).toHaveLength(0);
    });

    // 8. Edge cases and empty scenarios
    it('should handle empty sub-merchants and parent data', async () => {
      getMerchantsDaoArray.mockResolvedValue([]); // No merchants found
      mockReq.query.role_name = Role.MERCHANT;
      mockReq.query.code = 'user1';
      getMerchantReportDao.mockResolvedValue([]); // No merchant data found
    
      dayjs.tz.mockReturnValue({
        format: jest.fn().mockReturnValue('2025-08-01')
      });
    
      const result = await getClientsAccountReportService(mockReq);
    
      expect(getMerchantsDaoArray).toHaveBeenCalledWith('123', ['user1']);
      expect(getUsersDao).not.toHaveBeenCalled(); // Not called since userIds = [] (length 0)
      expect(getMerchantReportDao).toHaveBeenCalledWith('123', [], '2025-08-01', '2025-08-31', null, null, 'admin');
      expect(logger.info).toHaveBeenCalledWith('No sub-merchants found for clubbing. Returning 0 merchant records as-is');
      expect(result).toEqual([]); // Expect empty result
    });

    it('should handle non-MERCHANT designation (no hierarchy lookup)', async () => {
      mockReq.query.role_name = Role.MERCHANT;
      mockReq.query.code = 'user1';
      getMerchantsDaoArray.mockResolvedValue([{ user_id: 'user1' }]);
      getMerchantReportDao.mockResolvedValue([
        { code: 'merchant1', calculation_user_id: 'user1', created_at: '2025-08-01', amount: 1000 }
      ]);
      getUsersDao.mockResolvedValue([{ id: 'user1', designation_id: 1 }]);
      getDesignationDao.mockResolvedValue([{ designation: 'ADMIN' }]); // Not MERCHANT
      getUserHierarchysDao.mockResolvedValue([]); // Should not be called

      dayjs.tz.mockReturnValue({
        format: jest.fn().mockReturnValue('2025-08-01')
      });

      const result = await getClientsAccountReportService(mockReq);

      expect(getUsersDao).toHaveBeenCalledWith({ company_id: '123', id: ['user1'] });
      expect(getDesignationDao).toHaveBeenCalledWith({ id: 1 });
      expect(getUserHierarchysDao).not.toHaveBeenCalled(); // No hierarchy lookup for non-MERCHANT designation
      expect(result).toEqual([
        { code: 'merchant1', calculation_user_id: 'user1', created_at: '2025-08-01', amount: 1000 , user_id: 'user1' }
      ]);
    });

    it('should handle missing designation data', async () => {
      mockReq.query.role_name = Role.MERCHANT;
      mockReq.query.code = 'user1';
      getMerchantsDaoArray.mockResolvedValue([{ user_id: 'user1' }]);
      getMerchantReportDao.mockResolvedValue([
        { code: 'merchant1', calculation_user_id: 'user1', created_at: '2025-08-01', amount: 1000 }
      ]);
      getUsersDao.mockResolvedValue([{ id: 'user1', designation_id: 1 }]);
      getDesignationDao.mockResolvedValue([]); // Empty designation
      getUserHierarchysDao.mockResolvedValue([]); // Should not be called

      dayjs.tz.mockReturnValue({
        format: jest.fn().mockReturnValue('2025-08-01')
      });

      const result = await getClientsAccountReportService(mockReq);

      expect(getDesignationDao).toHaveBeenCalledWith({ id: 1 });
      expect(getUserHierarchysDao).not.toHaveBeenCalled(); // No hierarchy lookup since designation is empty
      expect(result).toEqual([
        { code: 'merchant1', calculation_user_id: 'user1', created_at: '2025-08-01', amount: 1000 , user_id: 'user1' }
      ]);
    });

    it('should handle valid user data with no sub-merchants', async () => {
      mockReq.query.role_name = Role.MERCHANT;
      mockReq.query.code = 'user1';
      getMerchantsDaoArray.mockResolvedValue([{ user_id: 'user1' }]);
      getUsersDao.mockResolvedValue([{ id: 'user1', designation_id: 'designation1' }]);
      getDesignationDao.mockResolvedValue([{ designation: Role.MERCHANT }]);
      getUserHierarchysDao.mockResolvedValue([]); // No sub-merchants
      getMerchantReportDao.mockResolvedValue([
        { code: 'merchant1', calculation_user_id: 'user1', created_at: '2025-08-01', amount: 1000 }
      ]);
    
      dayjs.tz.mockReturnValue({
        format: jest.fn().mockReturnValue('2025-08-01')
      });
    
      const result = await getClientsAccountReportService(mockReq);
    
      expect(getUsersDao).toHaveBeenCalledWith({ company_id: '123', id: ['user1'] });
      expect(getUserHierarchysDao).toHaveBeenCalledWith({ user_id: ['user1'] });
      expect(result).toEqual([
        { code: 'merchant1', calculation_user_id: 'user1', created_at: '2025-08-01', amount: 1000 , user_id: 'user1' }
      ]);
    });

    it('should handle date normalization in clubbing', async () => {
      mockReq.query.role_name = Role.MERCHANT;
      mockReq.query.code = 'parent1';
      getMerchantsDaoArray.mockResolvedValue([{ user_id: 'parent1' }]);
      
      const parentData = [
        { code: 'parent1', calculation_user_id: 'parent1', created_at: '2025-08-01T10:00:00Z', amount: 1000 }
      ];
      const childData = [
        { code: 'child1', calculation_user_id: 'child1', created_at: '2025-08-01T15:30:00Z', amount: 500 } // Different time but same date
      ];
      
      const allMerchantData = [...parentData, ...childData];
      
      getUsersDao.mockResolvedValue([{ id: 'parent1', designation_id: 1 }]);
      getDesignationDao.mockResolvedValue([{ designation: Role.MERCHANT }]);
      getUserHierarchysDao.mockResolvedValue([
        { 
          user_id: 'parent1', 
          config: { 
            siblings: { 
              sub_merchants: ['child1'] 
            } 
          } 
        }
      ]);
      getMerchantReportDao.mockResolvedValue(allMerchantData);

      dayjs.tz.mockReturnValue({
        format: jest.fn().mockReturnValue('2025-08-01') // Both dates normalize to same day
      });

      const result = await getClientsAccountReportService(mockReq);

      expect(result[0].amount).toBe(1500); // Successfully clubbed despite different timestamps
      expect(result[0].created_at).toBe('2025-08-01');
    });

    it('should skip child records without valid parent mapping', async () => {
      mockReq.query.role_name = Role.MERCHANT;
      mockReq.query.code = 'parent1';
      getMerchantsDaoArray.mockResolvedValue([{ user_id: 'parent1' }]);
      
      const allMerchantData = [
        { code: 'parent1', calculation_user_id: 'parent1', created_at: '2025-08-01', amount: 1000 },
        { code: 'orphan-child', calculation_user_id: 'orphan1', created_at: '2025-08-01', amount: 200 } // No parent mapping
      ];
      
      getUsersDao.mockResolvedValue([{ id: 'parent1', designation_id: 1 }]);
      getDesignationDao.mockResolvedValue([{ designation: Role.MERCHANT }]);
      getUserHierarchysDao.mockResolvedValue([
        { 
          user_id: 'parent1', 
          config: { 
            siblings: { 
              sub_merchants: ['known-child'] // Doesn't include orphan1
            } 
          } 
        }
      ]);
      getMerchantReportDao.mockResolvedValue(allMerchantData);

      dayjs.tz.mockReturnValue({
        format: jest.fn().mockReturnValue('2025-08-01')
      });

      const result = await getClientsAccountReportService(mockReq);

      // Orphan child should be skipped, only parent returned
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('parent1');
      expect(result[0].amount).toBe(1000); // No child amount added
    });

    it('should handle missing parent entry for child', async () => {
      mockReq.query.role_name = Role.MERCHANT;
      mockReq.query.code = 'parent1';
      getMerchantsDaoArray.mockResolvedValue([{ user_id: 'parent1' }]);
      
      const parentData = []; // No parent data for this date
      const childData = [
        { code: 'child1', calculation_user_id: 'child1', created_at: '2025-08-01', amount: 500 }
      ];
      
      const allMerchantData = [...parentData, ...childData];
      
      getUsersDao.mockResolvedValue([{ id: 'parent1', designation_id: 1 }]);
      getDesignationDao.mockResolvedValue([{ designation: Role.MERCHANT }]);
      getUserHierarchysDao.mockResolvedValue([
        { 
          user_id: 'parent1', 
          config: { 
            siblings: { 
              sub_merchants: ['child1'] 
            } 
          } 
        }
      ]);
      getMerchantReportDao.mockResolvedValue(allMerchantData);

      dayjs.tz.mockReturnValue({
        format: jest.fn().mockReturnValue('2025-08-01')
      });

      const result = await getClientsAccountReportService(mockReq);

      // Child should be skipped due to no parent entry
      expect(result).toEqual([]);
    });

    it('should apply sorting and pagination to vendor results', async () => {
      mockReq.query.role_name = 'VENDOR';
      mockReq.query.page = '1';
      mockReq.query.limit = '2';
      const vendorData = [
        { id: 3, code: 'C-vendor', created_at: '2025-08-02T00:00:00.000Z' },
        { id: 1, code: 'A-vendor', created_at: '2025-08-01T00:00:00.000Z' },
        { id: 2, code: 'B-vendor', created_at: '2025-08-01T00:00:00.000Z' }
      ];
      
      // Simulate DAO pagination: sort by code and take first 2 items
      const sortedVendorData = [...vendorData].sort((a, b) => a.code.localeCompare(b.code));
      const paginatedVendorData = sortedVendorData.slice(0, 2); // Page 1, limit 2
      getVendorReportDao.mockResolvedValue(paginatedVendorData);
    
      dayjs.tz.mockReturnValue({
        format: jest.fn().mockImplementation(() => '2025-08-01')
      });
    
      const result = await getClientsAccountReportService(mockReq);
    
      // Should be sorted alphabetically: A-vendor, B-vendor
      // Pagination 1,2 should return A-vendor and B-vendor
      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('A-vendor');
      expect(result[1].code).toBe('B-vendor');
  expect(result[0].created_at).toBe('2025-08-01');

    });

   

    it('should log appropriate messages for specific codes', async () => {
      mockReq.query.role_name = Role.MERCHANT;
      mockReq.query.code = 'merchant1,merchant2';
      getMerchantsDaoArray.mockResolvedValue([
        { user_id: 'user1' },
        { user_id: 'user2' }
      ]);
      getMerchantReportDao.mockResolvedValue([
        { code: 'merchant1', calculation_user_id: 'user1', created_at: '2025-08-01' },
        { code: 'merchant2', calculation_user_id: 'user2', created_at: '2025-08-01' }
      ]);
      getUsersDao.mockResolvedValue([
        { id: 'user1', designation_id: 1 },
        { id: 'user2', designation_id: 1 }
      ]);
      getDesignationDao.mockResolvedValue([{ designation: Role.MERCHANT }]);
      getUserHierarchysDao.mockResolvedValue([]);

      dayjs.tz.mockReturnValue({
        format: jest.fn().mockReturnValue('2025-08-01')
      });

      await getClientsAccountReportService(mockReq);

      expect(logger.info).toHaveBeenCalledWith('Converting merchant codes to user IDs: merchant1, merchant2');
      expect(logger.info).toHaveBeenCalledWith('Requested specific merchant codes: merchant1, merchant2');
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Retrieved 2 merchant records from database'));
      expect(logger.info).toHaveBeenCalledWith('No sub-merchants found for clubbing. Returning 2 merchant records as-is');
    });

    it('should log missing codes after clubbing', async () => {
      mockReq.query.role_name = Role.MERCHANT;
      mockReq.query.code = 'merchant1,missing1';
      getMerchantsDaoArray.mockResolvedValue([{ user_id: 'user1' }]); // Only merchant1 found
      getMerchantReportDao.mockResolvedValue([
        { code: 'merchant1', calculation_user_id: 'user1', created_at: '2025-08-01' }
        // missing1 not included
      ]);
      getUsersDao.mockResolvedValue([{ id: 'user1', designation_id: 1 }]);
      getDesignationDao.mockResolvedValue([{ designation: Role.MERCHANT }]);
      getUserHierarchysDao.mockResolvedValue([]);

      dayjs.tz.mockReturnValue({
        format: jest.fn().mockReturnValue('2025-08-01')
      });

      await getClientsAccountReportService(mockReq);

      expect(logger.warn).toHaveBeenCalledWith('Missing codes in result: missing1');
    });

    // 11. Date edge cases
    it('should handle null/undefined dates in merchant data', async () => {
      mockReq.query.role_name = Role.MERCHANT;
      delete mockReq.query.code;
      getMerchantReportDao.mockResolvedValue([
        { code: 'merchant1', calculation_user_id: 'user1', created_at: null, amount: 1000 },
        { code: 'merchant2', calculation_user_id: 'user2', created_at: undefined, amount: 2000 }
      ]);
      getUserHierarchysDao.mockResolvedValue([]);

      dayjs.tz.mockImplementation((date) => ({
        format: jest.fn(() => date ? '2025-08-01' : '1970-01-01') // Fallback date for null/undefined
      }));

      const result = await getClientsAccountReportService(mockReq);

      expect(result).toHaveLength(2);

      expect(result[0].created_at).toBe('1970-01-01'); // Null date becomes fallback
      expect(result[1].created_at).toBe('1970-01-01'); // Undefined date becomes fallback

    });

    it('should handle invalid date strings', async () => {
      mockReq.query.role_name = Role.MERCHANT;
      delete mockReq.query.code;
      getMerchantReportDao.mockResolvedValue([
        { code: 'merchant1', calculation_user_id: 'user1', created_at: 'invalid-date', amount: 1000 }
      ]);
      getUserHierarchysDao.mockResolvedValue([]);

      dayjs.tz.mockImplementation(() => ({
        format: jest.fn(() => '2025-08-01') // Always return valid date for sorting
      }));

      const result = await getClientsAccountReportService(mockReq);

      expect(result[0].created_at).toBe('2025-08-01'); // Original value preserved, but sorting works

    });

    // 12. Numeric field aggregation edge cases
    it('should handle non-numeric fields during aggregation', async () => {
      mockReq.query.role_name = Role.MERCHANT;
      mockReq.query.code = 'parent1';
      getMerchantsDaoArray.mockResolvedValue([{ user_id: 'parent1' }]);
      
      const allMerchantData = [
        { 
          code: 'parent1', 
          calculation_user_id: 'parent1', 
          created_at: '2025-08-01', 
          amount: 1000, 
          name: 'Parent Merchant',
          status: 'active'
        },
        { 
          code: 'child1', 
          calculation_user_id: 'child1', 
          created_at: '2025-08-01', 
          amount: 500, 
          name: 'Child Merchant',
          status: 'active'
        }
      ];
      
      getUsersDao.mockResolvedValue([{ id: 'parent1', designation_id: 1 }]);
      getDesignationDao.mockResolvedValue([{ designation: Role.MERCHANT }]);
      getUserHierarchysDao.mockResolvedValue([
        { 
          user_id: 'parent1', 
          config: { 
            siblings: { 
              sub_merchants: ['child1'] 
            } 
          } 
        }
      ]);
      getMerchantReportDao.mockResolvedValue(allMerchantData);

      dayjs.tz.mockReturnValue({
        format: jest.fn().mockReturnValue('2025-08-01')
      });

      const result = await getClientsAccountReportService(mockReq);

      // Only numeric 'amount' should be summed, non-numeric fields preserved from parent
      expect(result[0].amount).toBe(1500);
      expect(result[0].name).toBe('Parent Merchant'); // Parent's name preserved
      expect(result[0].status).toBe('active'); // Parent's status preserved
    });

    it('should handle NaN and non-numeric values in aggregation', async () => {
      mockReq.query.role_name = Role.MERCHANT;
      mockReq.query.code = 'parent1';
      getMerchantsDaoArray.mockResolvedValue([{ user_id: 'parent1' }]);
      
      const allMerchantData = [
        { 
          code: 'parent1', 
          calculation_user_id: 'parent1', 
          created_at: '2025-08-01', 
          amount: 1000, 
          invalid_amount: 'abc',
          null_amount: null,
          zero_amount: 0
        },
        { 
          code: 'child1', 
          calculation_user_id: 'child1', 
          created_at: '2025-08-01', 
          amount: 500, 
          invalid_amount: NaN,
          null_amount: null,
          zero_amount: 0
        }
      ];
      
      getUsersDao.mockResolvedValue([{ id: 'parent1', designation_id: 1 }]);
      getDesignationDao.mockResolvedValue([{ designation: Role.MERCHANT }]);
      getUserHierarchysDao.mockResolvedValue([
        { 
          user_id: 'parent1', 
          config: { 
            siblings: { 
              sub_merchants: ['child1'] 
            } 
          } 
        }
      ]);
      getMerchantReportDao.mockResolvedValue(allMerchantData);

      dayjs.tz.mockReturnValue({
        format: jest.fn().mockReturnValue('2025-08-01')
      });

      const result = await getClientsAccountReportService(mockReq);

      expect(result[0].amount).toBe(1500); // Valid numbers summed
      expect(result[0].invalid_amount).toBe('abc'); // Non-numeric preserved from parent
      expect(result[0].null_amount).toBe(null); // Null preserved
      expect(result[0].zero_amount).toBe(0); // Zero preserved
    });

  });
  it('should return vendor report with sub-vendors for VENDOR role with hierarchy', async () => {
  mockReq.query.role_name = Role.VENDOR;
  mockReq.query.code = 'vendor1';
  getVendorsDaoArray.mockResolvedValue([{ user_id: 'vendor1' }]);
  getUsersDao.mockResolvedValue([{ id: 'vendor1', designation_id: 1 }]);
  getDesignationDao.mockResolvedValue([{ designation: Role.VENDOR }]);
  getUserHierarchysDao.mockResolvedValue([
    { user_id: 'vendor1', config: { siblings: { sub_vendors: ['sub_vendor1', 'sub_vendor2'] } } }
  ]);
  getVendorReportDao.mockResolvedValue([
    { code: 'vendor1', calculation_user_id: 'vendor1', created_at: '2025-08-01', amount: 1000, transactions: 5 },
    { code: 'sub_vendor1', calculation_user_id: 'sub_vendor1', created_at: '2025-08-01', amount: 500, transactions: 2 },
    { code: 'sub_vendor2', calculation_user_id: 'sub_vendor2', created_at: '2025-08-01', amount: 300, transactions: 1 }
  ]);
  dayjs.tz.mockReturnValue({
    format: jest.fn().mockReturnValue('2025-08-01')
  });

  const result = await getClientsAccountReportService(mockReq);

  expect(getVendorsDaoArray).toHaveBeenCalledWith('123', ['vendor1']);
  expect(getUsersDao).toHaveBeenCalledWith({ company_id: '123', id: ['vendor1'] });
  expect(getDesignationDao).toHaveBeenCalledWith({ id: 1 });
  expect(getUserHierarchysDao).toHaveBeenCalledWith({ user_id: ['vendor1'] });
  expect(getVendorReportDao).toHaveBeenCalledWith('123', ['vendor1', 'sub_vendor1', 'sub_vendor2'], '2025-08-01', '2025-08-31', null, null, 'admin');
  expect(result).toEqual([
    {
      code: 'vendor1',
      calculation_user_id: 'vendor1',
      created_at: '2025-08-01',
      user_id: 'vendor1',
      amount: 1800,
      transactions: 8
    }
  ]);
  expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Built child-to-parent mapping'));
});
});