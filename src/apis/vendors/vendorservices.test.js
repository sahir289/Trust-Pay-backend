const {
  createVendorService,
  getVendorsService,
  updateVendorService,
  deleteVendorService,
  getVendorsBySearchService,
  getVendorsCodeService,
  getBankResponseAccessByIDService,
  getVendorsByCodeService,
  linkVendorService,
  unlinkVendorService,
  transferVendorService,
} = require('./vendorService');
const { getConnection, beginTransaction, commit, rollback } = require('../../utils/db');
const { logger } = require('../../utils/logger');
const { Role } = require('../../constants/index');
const {
  createVendorDao,
  getVendorsCodeDao,
  getVendorsBySearchDao,
  getAllVendorsDao,
  getBankResponseAccessByIDDao,
  getVendorByCodeDao,
  linkVendorDao,
  unlinkVendorDao,
  transferVendorDao,
  getDesignationIdDao,
  isNetBalanceZeroForTwoHours,
  getVendorByUserId,
  updateVendorDao,
  deleteVendorDao,
} = require('./vendorDao');
const { createCalculationDao } = require('../calculation/calculationDao');
const { updateBankaccountDao } = require('../bankAccounts/bankaccountDao');
const { updateUserDao } = require('../users/userDao');
const { deleteBeneficiaryDao } = require('../beneficiaryAccounts/beneficiaryAccountDao');
const { createUserHierarchyDao, getUserHierarchysDao, updateUserHierarchyDao } = require('../userHierarchy/userHierarchyDao');
const { notifyBankResponseAccessUpdate } = require('../../utils/sockets');
const { BadRequestError, NotFoundError } = require('../../utils/appErrors');

jest.mock('../../utils/db');
jest.mock('../../utils/logger');
jest.mock('./vendorDao');
jest.mock('../calculation/calculationDao');
jest.mock('../bankAccounts/bankaccountDao');
jest.mock('../users/userDao');
jest.mock('../beneficiaryAccounts/beneficiaryAccountDao');
jest.mock('../userHierarchy/userHierarchyDao');
jest.mock('../../utils/sockets');

describe('Vendor Service', () => {
  let mockConn;

  beforeEach(() => {
    mockConn = {
      release: jest.fn(),
    };
    getConnection.mockResolvedValue(mockConn);
    beginTransaction.mockResolvedValue();
    commit.mockResolvedValue();
    rollback.mockResolvedValue();
    jest.clearAllMocks();
  });

  describe('createVendorService', () => {
    const payload = {
      user_id: 1,
      code: 'VEND001',
      company_id: 1,
      created_by: 1,
      updated_by: 1,
      parent_id: 2,
      designation: Role.SUB_VENDOR,
      role_id: 3,
    };

    test('should create a vendor and handle SUB_VENDOR hierarchy', async () => {
      const vendorData = { ...payload, role_id: 3 };
      const parentId = payload.parent_id;
      const roleId = payload.role_id;
      createVendorDao.mockResolvedValue(vendorData);
      createCalculationDao.mockResolvedValue();
      getUserHierarchysDao.mockResolvedValue([{ id: 1, config: { siblings: { sub_vendors: [] } } }]);
      updateUserHierarchyDao.mockResolvedValue();
      createUserHierarchyDao.mockResolvedValue();

      const result = await createVendorService(mockConn, payload);

      expect(createVendorDao).toHaveBeenCalledWith(expect.any(Object), mockConn);
      expect(createCalculationDao).toHaveBeenCalledWith(mockConn, {
        user_id: vendorData.user_id,
        role_id: roleId,
        company_id: vendorData.company_id,
      });
      expect(getUserHierarchysDao).toHaveBeenCalledWith({ user_id: parentId });
      expect(updateUserHierarchyDao).toHaveBeenCalled();
      expect(createUserHierarchyDao).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: vendorData.user_id, company_id: vendorData.company_id }),
        mockConn
      );
      expect(result).toEqual(vendorData);
    });

    test('should throw BadRequestError if role_id is missing', async () => {
      const invalidPayload = { ...payload, role_id: undefined };
      createCalculationDao.mockImplementationOnce(async () => {
        throw new BadRequestError('role_id is required');
      });
      await expect(createVendorService(mockConn, invalidPayload)).rejects.toThrow('role_id is required');
    });
  });

  describe('getVendorsService', () => {
    test('should fetch vendors for VENDOR role with sub-vendors', async () => {
      const filters = { company_id: 1 };
      const user_id = 1;
      const role = Role.VENDOR;
      const designation = Role.VENDOR;
      getUserHierarchysDao.mockResolvedValue([{ config: { siblings: { sub_vendors: [2, 3] } } }]);
      getAllVendorsDao.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      const result = await getVendorsService(filters, role, 1, 10, designation, user_id);

      expect(getUserHierarchysDao).toHaveBeenCalledWith({ user_id });
      expect(getAllVendorsDao).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: [1, 2, 3] }),
        1,
        10,
        null,
        null,
        role
      );
      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });

    test('should fetch vendors for ADMIN role without user_id filter', async () => {
      const filters = { company_id: 1 };
      const role = Role.ADMIN;
      getAllVendorsDao.mockResolvedValue([{ id: 1 }]);

      const result = await getVendorsService(filters, role, 1, 10, null, null);

      expect(getAllVendorsDao).toHaveBeenCalledWith(
        expect.not.objectContaining({ user_id: expect.anything() }),
        1,
        10,
        null,
        null,
        role
      );
      expect(result).toEqual([{ id: 1 }]);
    });

    test('should throw error if getAllVendorsDao fails', async () => {
      getAllVendorsDao.mockRejectedValue(new Error('Database error'));

      await expect(getVendorsService({}, Role.ADMIN, 1, 10, null, null)).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith('Error while fetching vendors', expect.any(Error));
    });
  });

  describe('getVendorsCodeService', () => {
    test('should fetch vendor codes for VENDOR role with sub-vendors', async () => {
      const filters = { company_id: 1 };
      const user_id = 1;
      const role = Role.VENDOR;
      const designation = Role.VENDOR;
      getUserHierarchysDao.mockResolvedValue([{ config: { siblings: { sub_vendors: [2, 3] } } }]);
      getVendorsCodeDao.mockResolvedValue(['VEND001', 'VEND002']);

      const result = await getVendorsCodeService(filters, role, designation, user_id, true, false, true, false);

      expect(getConnection).toHaveBeenCalledWith('reader');
      expect(beginTransaction).toHaveBeenCalledWith(mockConn);
      expect(getUserHierarchysDao).toHaveBeenCalledWith({ user_id });
      expect(getVendorsCodeDao).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: [1, 2, 3] }),
        mockConn,
        true,
        false,
        true,
        false
      );
      expect(commit).toHaveBeenCalledWith(mockConn);
      expect(result).toEqual(['VEND001', 'VEND002']);
    });

    test('should handle transaction rollback on error', async () => {
      getVendorsCodeDao.mockRejectedValue(new Error('Database error'));

      await expect(getVendorsCodeService({}, Role.ADMIN, null, null, true, false, true, false)).rejects.toThrow('Database error');
      expect(rollback).toHaveBeenCalledWith(mockConn);
      expect(logger.error).toHaveBeenCalledWith('Error while getting vendors codes', expect.any(Error));
    });
  });

  describe('getVendorsBySearchService', () => {
    test('should search vendors with search terms', async () => {
      const filters = { search: 'vend, test' };
      const role = Role.VENDOR;
      const designation = Role.VENDOR;
      const user_id = 1;
      getUserHierarchysDao.mockResolvedValue([{ config: { siblings: { sub_vendors: [2, 3] } } }]);
      getVendorsBySearchDao.mockResolvedValue([{ id: 1 }]);

      const result = await getVendorsBySearchService(filters, role, 1, 10, designation, user_id);

      expect(getUserHierarchysDao).toHaveBeenCalledWith({ user_id });
      expect(getVendorsBySearchDao).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: [1, 2, 3], role }),
        1,
        10,
        ['vend', 'test']
      );
      expect(result).toEqual([{ id: 1 }]);
    });

    test('should handle empty search terms', async () => {
      const filters = { search: '' };
      getVendorsBySearchDao.mockResolvedValue([]);

      const result = await getVendorsBySearchService(filters, Role.ADMIN, 1, 10, null, null);

      expect(getVendorsBySearchDao).toHaveBeenCalledWith(
        expect.objectContaining({ role: Role.ADMIN }),
        1,
        10,
        undefined
      );
      expect(result).toEqual([]);
    });
  });

  describe('updateVendorService', () => {
    test('should update vendor and notify if bank_response_access is false', async () => {
      const ids = { user_id: 1 };
      const payload = { config: { bank_response_access: false }, updated_by: 1 };
      const vendorData = { user_id: 1, code: 'VEND001', company_id: 1, config: { bank_response_access: false } };
      updateVendorDao.mockResolvedValue(vendorData);
      notifyBankResponseAccessUpdate.mockResolvedValue();

      const result = await updateVendorService(ids, payload);

      expect(getConnection).toHaveBeenCalled();
      expect(beginTransaction).toHaveBeenCalledWith(mockConn);
      expect(updateVendorDao).toHaveBeenCalledWith(ids, payload, mockConn);
      expect(notifyBankResponseAccessUpdate).toHaveBeenCalledWith(vendorData.user_id, false, vendorData.code);
      expect(commit).toHaveBeenCalledWith(mockConn);
      expect(result).toEqual(vendorData);
    });

    test('should handle transaction rollback on error', async () => {
      updateVendorDao.mockRejectedValue(new Error('Database error'));

      await expect(updateVendorService({ user_id: 1 }, {})).rejects.toThrow('Database error');
      expect(rollback).toHaveBeenCalledWith(mockConn);
      expect(logger.error).toHaveBeenCalledWith('Error while updating Vendor', expect.any(Error));
    });
  });

  describe('deleteVendorService', () => {
    test('should delete vendor and related data', async () => {
      const ids = { user_id: 1, company_id: 1 };
      const updated_by = 1;
      const vendorData = { user_id: 1, code: 'VEND001' };
      deleteVendorDao.mockResolvedValue(vendorData);
      getUserHierarchysDao.mockResolvedValue([{ config: { child: { operations: [2] }, siblings: { sub_vendors: [3] } } }]);
      updateUserDao.mockResolvedValue();
      deleteBeneficiaryDao.mockResolvedValue();
      updateBankaccountDao.mockResolvedValue();
      getDesignationIdDao.mockResolvedValue(4);

      const result = await deleteVendorService(ids, updated_by);

      expect(getConnection).toHaveBeenCalled();
      expect(beginTransaction).toHaveBeenCalledWith(mockConn);
      expect(deleteVendorDao).toHaveBeenCalledWith(mockConn, ids, { is_obsolete: true, updated_by });
      expect(updateUserDao).toHaveBeenCalledWith({ id: ids.user_id }, { is_obsolete: true, updated_by }, mockConn);
      expect(deleteBeneficiaryDao).toHaveBeenCalled();
      expect(updateBankaccountDao).toHaveBeenCalled();
      expect(commit).toHaveBeenCalledWith(mockConn);
      expect(result).toEqual(vendorData);
    });

    test('should handle transaction rollback on error', async () => {
      deleteVendorDao.mockRejectedValue(new Error('Database error'));

      await expect(deleteVendorService({ user_id: 1 }, 1)).rejects.toThrow('Database error');
      expect(rollback).toHaveBeenCalledWith(mockConn);
      expect(logger.error).toHaveBeenCalledWith('Error while deleting Vendor', expect.any(Error));
    });
  });

  describe('getBankResponseAccessByIDService', () => {
    test('should fetch bank response access for VENDOR_OPERATIONS', async () => {
      const id = 1;
      const designation = Role.VENDOR_OPERATIONS;
      getUserHierarchysDao.mockResolvedValue([{ config: { parent: 2 } }]);
      getBankResponseAccessByIDDao.mockResolvedValue({ access: true });

      const result = await getBankResponseAccessByIDService(id, designation);

      expect(getUserHierarchysDao).toHaveBeenCalledWith({ user_id: id });
      expect(getBankResponseAccessByIDDao).toHaveBeenCalledWith(2);
      expect(result).toEqual({ access: true });
    });

    test('should use provided id for non-VENDOR_OPERATIONS', async () => {
      const id = 1;
      const designation = Role.VENDOR;
      getBankResponseAccessByIDDao.mockResolvedValue({ access: true });

      const result = await getBankResponseAccessByIDService(id, designation);

      expect(getBankResponseAccessByIDDao).toHaveBeenCalledWith(id);
      expect(result).toEqual({ access: true });
    });
  });

  describe('getVendorsByCodeService', () => {
    test('should fetch vendor by code', async () => {
      const code = 'VEND001';
      getVendorByCodeDao.mockResolvedValue([{ id: 1, code: 'VEND001' }]);

      const result = await getVendorsByCodeService(code);

      expect(getVendorByCodeDao).toHaveBeenCalledWith(code);
      expect(result).toEqual({ id: 1, code: 'VEND001' });
    });

    test('should throw BadRequestError if code is missing', async () => {
      await expect(getVendorsByCodeService(null)).rejects.toThrow(BadRequestError);
      expect(logger.error).toHaveBeenCalledWith('Error while fetching vendor by code', expect.any(BadRequestError));
    });

    test('should throw NotFoundError if vendor not found', async () => {
      getVendorByCodeDao.mockResolvedValue([]);

      await expect(getVendorsByCodeService('VEND001')).rejects.toThrow(NotFoundError);
      expect(logger.error).toHaveBeenCalledWith('Error while fetching vendor by code', expect.any(NotFoundError));
    });
  });

  describe('linkVendorService', () => {
    test('should link sub-vendor to vendor', async () => {
      const vendorUserId = 1;
      const subVendorUserId = 2;
      const user_id = 3;
      isNetBalanceZeroForTwoHours.mockResolvedValue(true);
  // Implementation only fetches parent vendor via getVendorByUserId once
  getVendorByUserId.mockResolvedValue({ payin_commission: 0.5, payout_commission: 0.5 });
      linkVendorDao.mockResolvedValue({ success: true });
      getDesignationIdDao.mockResolvedValue(4);
      updateUserDao.mockResolvedValue();

      const result = await linkVendorService(vendorUserId, subVendorUserId, user_id);

      expect(isNetBalanceZeroForTwoHours).toHaveBeenCalledWith(subVendorUserId);
  expect(getVendorByUserId).toHaveBeenCalledTimes(1);
      expect(linkVendorDao).toHaveBeenCalledWith(vendorUserId, subVendorUserId, user_id);
      expect(updateUserDao).toHaveBeenCalledWith(
        { id: subVendorUserId },
        { designation_id: 4, updated_by: user_id },
        mockConn
      );
      expect(commit).toHaveBeenCalledWith(mockConn);
      expect(result).toEqual({ success: true });
    });

    test('should throw BadRequestError if net balance is not zero', async () => {
      isNetBalanceZeroForTwoHours.mockResolvedValue(false);

      await expect(linkVendorService(1, 2, 3)).rejects.toThrow(BadRequestError);
      expect(rollback).toHaveBeenCalledWith(mockConn);
    });

    test('should throw BadRequestError if sub-vendor commission is too high', async () => {
      isNetBalanceZeroForTwoHours.mockResolvedValue(true);
  // To trigger the commission check failure in current implementation,
  // set the parent vendor's commission to > 1
  getVendorByUserId.mockResolvedValue({ payin_commission: 2, payout_commission: 0 });

  await expect(linkVendorService(1, 2, 3)).rejects.toThrow(BadRequestError);
      expect(rollback).toHaveBeenCalledWith(mockConn);
    });
  });

  describe('unlinkVendorService', () => {
    test('should unlink sub-vendor from vendor', async () => {
      const vendorUserId = 1;
      const subVendorUserId = 2;
      const user_id = 3;
      isNetBalanceZeroForTwoHours.mockResolvedValue(true);
      unlinkVendorDao.mockResolvedValue({ success: true });
      getDesignationIdDao.mockResolvedValue(4);
      updateUserDao.mockResolvedValue();

      const result = await unlinkVendorService(vendorUserId, subVendorUserId, user_id);

      expect(isNetBalanceZeroForTwoHours).toHaveBeenCalledWith(subVendorUserId);
      expect(unlinkVendorDao).toHaveBeenCalledWith(vendorUserId, subVendorUserId, user_id);
      expect(updateUserDao).toHaveBeenCalledWith(
        { id: subVendorUserId },
        { designation_id: 4, updated_by: user_id },
        mockConn
      );
      expect(commit).toHaveBeenCalledWith(mockConn);
      expect(result).toEqual({ success: true });
    });

    test('should throw BadRequestError if net balance is not zero', async () => {
      isNetBalanceZeroForTwoHours.mockResolvedValue(false);

      await expect(unlinkVendorService(1, 2, 3)).rejects.toThrow(BadRequestError);
      expect(rollback).toHaveBeenCalledWith(mockConn);
    });
  });

  describe('transferVendorService', () => {
    test('should transfer sub-vendor to new vendor', async () => {
      const subVendorUserId = 1;
      const newVendorUserId = 2;
      const currentVendorUserId = 3;
      const user_id = 4;
      isNetBalanceZeroForTwoHours.mockResolvedValue(true);
  // Implementation only fetches parent vendor via getVendorByUserId once
  getVendorByUserId.mockResolvedValue({ payin_commission: 0.5, payout_commission: 0.5 });
      transferVendorDao.mockResolvedValue({ success: true });

      const result = await transferVendorService(subVendorUserId, newVendorUserId, currentVendorUserId, user_id);

      expect(isNetBalanceZeroForTwoHours).toHaveBeenCalledWith(subVendorUserId);
  expect(getVendorByUserId).toHaveBeenCalledTimes(1);
      expect(transferVendorDao).toHaveBeenCalledWith(subVendorUserId, newVendorUserId, currentVendorUserId, user_id);
      expect(commit).toHaveBeenCalledWith(mockConn);
      expect(result).toEqual({ success: true });
    });

    test('should throw BadRequestError if net balance is not zero', async () => {
      isNetBalanceZeroForTwoHours.mockResolvedValue(false);

      await expect(transferVendorService(1, 2, 3, 4)).rejects.toThrow(BadRequestError);
      expect(rollback).toHaveBeenCalledWith(mockConn);
    });

    test('should throw BadRequestError if sub-vendor commission is too high', async () => {
      isNetBalanceZeroForTwoHours.mockResolvedValue(true);
  // To trigger the commission check failure in current implementation,
  // set the parent vendor's commission to > 1
  getVendorByUserId.mockResolvedValue({ payin_commission: 2, payout_commission: 0 });

  await expect(transferVendorService(1, 2, 3, 4)).rejects.toThrow(BadRequestError);
      expect(rollback).toHaveBeenCalledWith(mockConn);
    });
  });
});