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
      
      expect(db.getConnection).toHaveBeenCalled();
      expect(db.beginTransaction).toHaveBeenCalled();
      expect(db.commit).toHaveBeenCalled();
      expect(mockConn.release).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should rollback on creation error', async () => {
      const mockConn = { release: jest.fn() };
      
      db.getConnection.mockResolvedValue(mockConn);
      db.beginTransaction.mockResolvedValue(undefined);
      db.rollback.mockResolvedValue(undefined);
      vendorDao.createVendorDao.mockRejectedValue(new Error('Insert failed'));
      
      await expect(service.createVendorService({ code: 'VENDOR1' })).rejects.toThrow();
      
      expect(db.rollback).toHaveBeenCalledWith(mockConn);
      expect(mockConn.release).toHaveBeenCalled();
      expect(loggerModule.logger.error).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      db.getConnection.mockRejectedValue(new Error('Connection error'));
      
      await expect(service.createVendorService({})).rejects.toThrow('Connection error');
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
      
      expect(vendorDao.getAllVendorsDao).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should handle pagination parameters', async () => {
      vendorDao.getAllVendorsDao.mockResolvedValue([]);
      
      await service.getVendorsService({ company_id: 1 }, 'ADMIN', '2', '20', 'Admin', 1);
      
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
      
      await expect(
        service.getVendorsService({ company_id: 1 }, 'ADMIN', 1, 10, 'ADMIN', 1),
      ).rejects.toThrow('Fetch failed');
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
      
      expect(vendorDao.getVendorsBySearchDao).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should handle search errors', async () => {
      vendorDao.getVendorsBySearchDao.mockRejectedValue(new Error('Search failed'));
      
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
      
      expect(vendorDao.getVendorsCodeDao).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should support include sub vendors flag', async () => {
      const mockResult = [{ label: 'VENDOR1', subvendors: [] }];
      vendorDao.getVendorsCodeDao.mockResolvedValue(mockResult);
      
      await service.getVendorsCodeService({ company_id: 1 }, 'true');
      
      expect(vendorDao.getVendorsCodeDao).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      vendorDao.getVendorsCodeDao.mockRejectedValue(new Error('Fetch failed'));
      
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
      
      expect(vendorDao.updateVendorDao).toHaveBeenCalledWith({ id: 1 }, mockPayload);
      expect(result).toEqual(mockResult);
    });

    it('should rollback on update error', async () => {
      const mockPayload = { payin_commission: 10 };
      
      vendorDao.updateVendorDao.mockResolvedValue({ id: 1, user_id: 1, code: 'VENDOR1' });
      userDao.getUsersNameDao.mockResolvedValue({ designation: 'VENDOR_ADMIN' });
      
      await expect(service.updateVendorService({ id: 1 }, mockPayload)).rejects.toThrow();
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
      
      expect(db.getConnection).toHaveBeenCalled();
      expect(vendorDao.deleteVendorDao).toHaveBeenCalled();
      expect(db.commit).toHaveBeenCalled();
      expect(mockConn.release).toHaveBeenCalled();
    });

    it('should rollback on delete error', async () => {
      const mockConn = { release: jest.fn() };
      
      db.getConnection.mockResolvedValue(mockConn);
      db.beginTransaction.mockResolvedValue(undefined);
      db.rollback.mockResolvedValue(undefined);
      vendorDao.deleteVendorDao.mockRejectedValue(new Error('Delete failed'));
      
      await expect(service.deleteVendorService({ id: 1 }, 'test_user')).rejects.toThrow();
      
      expect(db.rollback).toHaveBeenCalledWith(mockConn);
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
      
      expect(db.getConnection).toHaveBeenCalled();
      expect(vendorDao.linkVendorDao).toHaveBeenCalled();
      expect(db.commit).toHaveBeenCalled();
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
      
      await expect(service.linkVendorService(1, 2, 5, 1.5, 2.5)).rejects.toThrow();
      
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
      
      expect(db.getConnection).toHaveBeenCalled();
      expect(vendorDao.unlinkVendorDao).toHaveBeenCalled();
      expect(db.commit).toHaveBeenCalled();
      expect(mockConn.release).toHaveBeenCalled();
    });

    it('should rollback on unlink error', async () => {
      const mockConn = { release: jest.fn() };
      
      db.getConnection.mockResolvedValue(mockConn);
      db.beginTransaction.mockResolvedValue(undefined);
      db.rollback.mockResolvedValue(undefined);
      vendorDao.unlinkVendorDao.mockRejectedValue(new Error('Unlink failed'));
      
      await expect(service.unlinkVendorService(1, 2, 5)).rejects.toThrow();
      
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
      
      expect(db.getConnection).toHaveBeenCalled();
      expect(vendorDao.transferVendorDao).toHaveBeenCalled();
      expect(db.commit).toHaveBeenCalled();
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
      
      await expect(
        service.transferVendorService(1, 2, 3, 5),
      ).rejects.toThrow();
      
      expect(db.rollback).toHaveBeenCalledWith(mockConn);
    });
  });
});
