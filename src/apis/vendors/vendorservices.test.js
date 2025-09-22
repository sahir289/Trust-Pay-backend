import {
  createVendorService,
  getVendorsService,
  getVendorsCodeService,
  getVendorsBySearchService,
  updateVendorService,
  deleteVendorService,
} from './vendorService.js';
import { Role } from '../../constants/index.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import {
  createVendorDao,
  deleteVendorDao,
  getVendorsCodeDao,
  getVendorsBySearchDao,
  getAllVendorsDao,
  updateVendorDao,
} from './vendorDao.js';
import { createCalculationDao } from '../calculation/calculationDao.js';
import { updateBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { updateUserDao } from '../users/userDao.js';
import { deleteBeneficiaryDao } from '../beneficiaryAccounts/beneficiaryAccountDao.js';
import { createUserHierarchyDao, getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';

jest.mock('../../utils/db.js', () => ({
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  getConnection: jest.fn(),
  rollback: jest.fn(),
}));

jest.mock('../../utils/logger.js', () => ({
  logger: {
    error: jest.fn(),
    log: jest.fn(),
  },
}));

jest.mock('./vendorDao.js', () => ({
  createVendorDao: jest.fn(),
  deleteVendorDao: jest.fn(),
  getVendorsCodeDao: jest.fn(),
  getVendorsBySearchDao: jest.fn(),
  getAllVendorsDao: jest.fn(),
  updateVendorDao: jest.fn(),
}));

jest.mock('../calculation/calculationDao.js', () => ({
  createCalculationDao: jest.fn(),
}));

jest.mock('../bankAccounts/bankaccountDao.js', () => ({
  updateBankaccountDao: jest.fn(),
}));

jest.mock('../users/userDao.js', () => ({
  updateUserDao: jest.fn(),
}));

jest.mock('../beneficiaryAccounts/beneficiaryAccountDao.js', () => ({
  deleteBeneficiaryDao: jest.fn(),
}));

jest.mock('../userHierarchy/userHierarchyDao.js', () => ({
  createUserHierarchyDao: jest.fn(), // Added missing mock
  getUserHierarchysDao: jest.fn(),
}));

describe('Vendor Service', () => {
  let mockConn;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConn = {
      query: jest.fn(),
      release: jest.fn(),
    };
    getConnection.mockResolvedValue(mockConn);
    beginTransaction.mockResolvedValue();
    commit.mockResolvedValue();
    rollback.mockResolvedValue();
  });

  describe('createVendorService', () => {
    test('should create a vendor successfully', async () => {
      const payload = {
        name: 'Vendor A',
        company_id: 'comp1',
        user_id: 'user1',
        created_by: 'user1',
        updated_by: 'user1',
        role_id: 'role1',
      };
      const vendorData = { id: 'vendor1', user_id: 'user1', company_id: 'comp1', code: 'V001' };
      createVendorDao.mockResolvedValue(vendorData);
      createCalculationDao.mockResolvedValue({});
      createUserHierarchyDao.mockResolvedValue({});

      const result = await createVendorService(mockConn, payload);

      expect(createVendorDao).toHaveBeenCalledWith(
        {
          name: 'Vendor A',
          company_id: 'comp1',
          user_id: 'user1',
          created_by: 'user1',
          updated_by: 'user1',
        },
        mockConn
      );
      expect(createCalculationDao).toHaveBeenCalledWith(mockConn, {
        user_id: 'user1',
        role_id: 'role1',
        company_id: 'comp1',
      });
      // expect(createUserHierarchyDao).toHaveBeenCalledWith(
      //   {
      //     user_id: 'user1',
      //     created_by: 'undefined',
      //     updated_by: 'undefined',
      //     company_id: 'comp1',
      //   },
      //   mockConn
      // );
      expect(result).toEqual(vendorData);
    });

    test('should throw error and not rollback if no connection', async () => {
      const payload = { name: 'Vendor A', company_id: 'comp1', user_id: 'user1', role_id: 'role1' };
      const error = new Error('Database error');
      createVendorDao.mockRejectedValue(error);

      await expect(createVendorService(mockConn, payload)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error while creating Vendor', error);
      expect(rollback).not.toHaveBeenCalled();
    });
  });

  describe('getVendorsService', () => {
    test('should fetch vendors successfully for admin role', async () => {
      const filters = { company_id: 'comp1' };
      const mockResult = [{ id: 'vendor1', full_name: 'Vendor A' }];
      getAllVendorsDao.mockResolvedValue(mockResult);

      const result = await getVendorsService(filters, Role.ADMIN, '1', '10', 'user1', 'OPERATIONS');

      expect(getAllVendorsDao).toHaveBeenCalledWith(filters, 1, 10, null, null, Role.ADMIN);
      expect(result).toEqual(mockResult);
    });

    test('should fetch vendors successfully for VENDOR role with VENDOR_OPERATIONS designation', async () => {
      const filters = { company_id: 'comp1' };
      const user_id = 'user1';
      const mockHierarchy = [{ config: { parent: 'parent1' } }];
      const mockParentHierarchy = [{ config: { siblings: { sub_vendors: [] } } }]; 
      const mockResult = [{ id: 'vendor1', full_name: 'Vendor A' }];
    
      getUserHierarchysDao
        .mockResolvedValueOnce(mockHierarchy)
        .mockResolvedValueOnce(mockParentHierarchy); // Second call with user_id: 'parent1'
      getAllVendorsDao.mockResolvedValue(mockResult);
    
      const result = await getVendorsService(filters, Role.VENDOR, '1', '10', Role.VENDOR_OPERATIONS, user_id);
    
      expect(getUserHierarchysDao).toHaveBeenCalledTimes(2);
      expect(getUserHierarchysDao).toHaveBeenNthCalledWith(1, { user_id: 'user1' });
      expect(getUserHierarchysDao).toHaveBeenNthCalledWith(2, { user_id: 'parent1' });
      expect(getAllVendorsDao).toHaveBeenCalledWith(
        { ...filters, user_id: ['user1', 'parent1'] },
        1,
        10,
        null,
        null,
        Role.VENDOR
      );
      expect(result).toEqual(mockResult);
    });

    test('should fetch vendors successfully for VENDOR role without VENDOR_OPERATIONS designation', async () => {
      const filters = { company_id: 'comp1' };
      const user_id = 'user1';
      const mockResult = [{ id: 'vendor1', full_name: 'Vendor A' }];
    
      getUserHierarchysDao.mockResolvedValue([]);   // ✅ mock as empty array
      getAllVendorsDao.mockResolvedValue(mockResult);
    
      const result = await getVendorsService(filters, Role.VENDOR, '1', '10', 'other', user_id);
    
      expect(getUserHierarchysDao).toHaveBeenCalledWith({ user_id });   // ✅ should be called
      expect(getAllVendorsDao).toHaveBeenCalledWith(
        { ...filters, user_id: 'user1' },
        1,
        10,
        null,
        null,
        Role.VENDOR
      );
      expect(result).toEqual(mockResult);
    });
    

    test('should throw error on database failure', async () => {
      const filters = { company_id: 'comp1' };
      const error = new Error('Database error');
      getAllVendorsDao.mockRejectedValue(error);

      await expect(getVendorsService(filters, Role.ADMIN, '1', '10', 'user1', 'OPERATIONS')).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error while fetching vendors', error);
    });
  });

  describe('getVendorsCodeService', () => {
    test('should fetch vendor codes successfully for admin role', async () => {
      const filters = { company_id: 'comp1' };
      const mockResult = [{ label: 'V001', value: 'user1', vendor_id: 'vendor1' }];
      getVendorsCodeDao.mockResolvedValue(mockResult);

      const result = await getVendorsCodeService(filters, Role.ADMIN, 'user1', 'OPERATIONS');

      expect(getConnection).toHaveBeenCalled();
      expect(beginTransaction).toHaveBeenCalledWith(mockConn);
      expect(getVendorsCodeDao).toHaveBeenCalledWith(filters, mockConn, undefined, undefined, undefined, undefined);
      expect(commit).toHaveBeenCalledWith(mockConn);
      expect(mockConn.release).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    test('should fetch vendor codes successfully for VENDOR role with VENDOR_OPERATIONS designation', async () => {
      const filters = { company_id: 'comp1' };
      const user_id = 'user1';
      const mockHierarchy = [{ config: { parent: 'parent1' } }];
      const mockResult = [{ label: 'V001', value: 'user1', vendor_id: 'vendor1' }];
      getUserHierarchysDao.mockResolvedValue(mockHierarchy);
      getVendorsCodeDao.mockResolvedValue(mockResult);

      const result = await getVendorsCodeService(filters, Role.VENDOR, Role.VENDOR_OPERATIONS , user_id);

      expect(getUserHierarchysDao).toHaveBeenCalledWith({ user_id });
      expect(getVendorsCodeDao).toHaveBeenCalledWith({ ...filters, user_id: ['user1', 'parent1'] }, mockConn , undefined,undefined ,undefined, undefined);
      expect(commit).toHaveBeenCalledWith(mockConn);
      expect(mockConn.release).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    test('should rollback and throw error on database failure', async () => {
      const filters = { company_id: 'comp1' };
      const error = new Error('Database error');
      getVendorsCodeDao.mockRejectedValue(error);

      await expect(getVendorsCodeService(filters, Role.ADMIN, 'user1', 'OPERATIONS')).rejects.toThrow(error);
      expect(rollback).toHaveBeenCalledWith(mockConn);
      expect(mockConn.release).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('Error while getting vendors codes', error);
    });

    test('should handle rollback error gracefully', async () => {
      const filters = { company_id: 'comp1' };
      const error = new Error('Database error');
      const rollbackError = new Error('Rollback error');
      getVendorsCodeDao.mockRejectedValue(error);
      rollback.mockRejectedValue(rollbackError);

      await expect(getVendorsCodeService(filters, Role.ADMIN, 'user1', 'OPERATIONS')).rejects.toThrow(error);
      expect(mockConn.release).toHaveBeenCalled();
    });
  });

  describe('getVendorsBySearchService', () => {
    test('should fetch vendors by search successfully with search terms', async () => {
      const filters = { company_id: 'comp1', search: 'Vendor A,true' };
      const mockResult = { totalCount: 1, totalPages: 1, Vendors: [{ id: 'vendor1', full_name: 'Vendor A' }] };
      getVendorsBySearchDao.mockResolvedValue(mockResult);

      const result = await getVendorsBySearchService(filters, Role.ADMIN, '1', '10', 'user1', 'OPERATIONS');

      expect(getVendorsBySearchDao).toHaveBeenCalledWith(
        { ...filters, role: Role.ADMIN },
        1,
        10,
        ['Vendor A', 'true']
      );
      expect(result).toEqual(mockResult);
    });

    test('should fetch vendors by search for VENDOR role with VENDOR_OPERATIONS designation', async () => {
      const filters = { company_id: 'comp1', search: 'Vendor A' };
      const user_id = 'user1';
      const mockHierarchy = [{ config: { parent: 'parent1' } }];
      const mockResult = { totalCount: 1, totalPages: 1, Vendors: [{ id: 'vendor1', full_name: 'Vendor A' }] };
      getUserHierarchysDao.mockResolvedValue(mockHierarchy);
      getVendorsBySearchDao.mockResolvedValue(mockResult);

      const result = await getVendorsBySearchService(filters, Role.VENDOR, '1', '10', Role.VENDOR_OPERATIONS, user_id);

      expect(getUserHierarchysDao).toHaveBeenCalledWith({ user_id });
      expect(getVendorsBySearchDao).toHaveBeenCalledWith(
        { ...filters, user_id: ['user1', 'parent1'], role: Role.VENDOR },
        1,
        10,
        ['Vendor A']
      );
      expect(result).toEqual(mockResult);
    });

    test('should throw error on database failure', async () => {
      const filters = { company_id: 'comp1', search: 'Vendor A' };
      const error = new Error('Database error');
      getVendorsBySearchDao.mockRejectedValue(error);

      await expect(getVendorsBySearchService(filters, Role.ADMIN, '1', '10', 'user1', 'OPERATIONS')).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error while fetching vendors by search', error);
    });
  });

  describe('updateVendorService', () => {
    test('should handle rollback error gracefully', async () => {
      const id = { id: 'vendor1' };
      const payload = { name: 'Vendor B', updated_by: 'user1' };
      const error = new Error('Database error');
      const DatabaseError = new Error('Database error');
    
      // Ensure mocks are set up correctly
      updateVendorDao.mockRejectedValue(error);
      rollback.mockRejectedValue(DatabaseError);
      logger.error.mockClear(); // Clear previous logger calls to avoid interference
    
      await expect(updateVendorService(mockConn, id, payload)).rejects.toThrow(error);
    
      expect(logger.error).toHaveBeenCalledWith('Error while updating Vendor', DatabaseError);
      expect(logger.error).toHaveBeenCalledWith('Error while updating Vendor', error);
    });

    test('should rollback and throw error on database failure', async () => {
      const id = { id: 'vendor1' };
      const payload = { name: 'Vendor B', updated_by: 'user1' };
      const error = new Error('Database error');
      updateVendorDao.mockRejectedValue(error);

      await expect(updateVendorService(id, payload)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error while updating Vendor', error);
    });

    test('should handle rollback error gracefully', async () => {
      const id = { id: 'vendor1' };
      const payload = { name: 'Vendor B', updated_by: 'user1' };
      const error = new Error('Database error');
      const DatabaseError = new Error('Database error');
      updateVendorDao.mockRejectedValue(error);
      rollback.mockRejectedValue(DatabaseError);

      await expect(updateVendorService(id, payload)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error while updating Vendor', DatabaseError);
    });
  });

  describe('deleteVendorService', () => {
    test('should delete vendor successfully with child operations', async () => {
      const ids = { user_id: 'user1', company_id: 'comp1' };
      const user_id = 'admin1';
      const mockVendor = { id: 'vendor1', user_id: 'user1', company_id: 'comp1', code: 'V001' };
      const mockHierarchy = [{ config: { child: { operations: ['child1', 'child2'] } } }];
      deleteVendorDao.mockResolvedValue(mockVendor);
      getUserHierarchysDao.mockResolvedValue(mockHierarchy);
      updateUserDao.mockResolvedValue({});
      deleteBeneficiaryDao.mockResolvedValue({});
      updateBankaccountDao.mockResolvedValue({});

      const result = await deleteVendorService(ids, user_id);

      expect(getConnection).toHaveBeenCalled();
      expect(beginTransaction).toHaveBeenCalledWith(mockConn);
      expect(deleteVendorDao).toHaveBeenCalledWith(mockConn, ids, { is_obsolete: true, updated_by: user_id });
      expect(updateUserDao).toHaveBeenCalledWith({ id: 'user1' }, { is_obsolete: true, updated_by: user_id }, mockConn);
      expect(deleteBeneficiaryDao).toHaveBeenCalledWith(mockConn, { user_id: 'user1' }, { is_obsolete: true });
      expect(updateBankaccountDao).toHaveBeenCalledWith(
        { user_id: 'user1' },
        { config: { is_freeze: true, isFromDeletedParent: true }, is_qr: false, is_bank: false, is_enabled: false, updated_by: user_id },
        mockConn,
        true
      );
      expect(updateUserDao).toHaveBeenCalledWith({ id: 'child1' }, { is_obsolete: true, updated_by: user_id }, mockConn);
      expect(updateUserDao).toHaveBeenCalledWith({ id: 'child2' }, { is_obsolete: true, updated_by: user_id }, mockConn);
      expect(commit).toHaveBeenCalledWith(mockConn);
      expect(mockConn.release).toHaveBeenCalled();
      expect(result).toEqual(mockVendor);
    });

    test('should delete vendor successfully without child operations', async () => {
      const ids = { user_id: 'user1', company_id: 'comp1' };
      const user_id = 'admin1';
      const mockVendor = { id: 'vendor1', user_id: 'user1', company_id: 'comp1', code: 'V001' };
      const mockHierarchy = [{}];
      deleteVendorDao.mockResolvedValue(mockVendor);
      getUserHierarchysDao.mockResolvedValue(mockHierarchy);
      updateUserDao.mockResolvedValue({});
      deleteBeneficiaryDao.mockResolvedValue({});
      updateBankaccountDao.mockResolvedValue({});

      const result = await deleteVendorService(ids, user_id);

      expect(updateUserDao).toHaveBeenCalledWith({ id: 'user1' }, { is_obsolete: true, updated_by: user_id }, mockConn);
      expect(updateUserDao).toHaveBeenCalledTimes(1); // Only called for the main user
      expect(result).toEqual(mockVendor);
    });

    test('should rollback and throw error on database failure', async () => {
      const ids = { user_id: 'user1', company_id: 'comp1' };
      const user_id = 'admin1';
      const error = new Error('Database error');
      deleteVendorDao.mockRejectedValue(error);

      await expect(deleteVendorService(ids, user_id)).rejects.toThrow(error);
      expect(rollback).toHaveBeenCalledWith(mockConn);
      expect(mockConn.release).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('Error while deleting Vendor', error);
    });

    test('should handle rollback error gracefully', async () => {
      const ids = { user_id: 'user1', company_id: 'comp1' };
      const user_id = 'admin1';
      const error = new Error('Database error');
      const rollbackError = new Error('Rollback error');
      deleteVendorDao.mockRejectedValue(error);
      rollback.mockRejectedValue(rollbackError);

      await expect(deleteVendorService(ids, user_id)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Error during transaction rollback', 'error', rollbackError);
      expect(mockConn.release).toHaveBeenCalled();
    });
  });
});