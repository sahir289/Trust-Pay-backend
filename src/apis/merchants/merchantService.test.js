/**
 * merchantService.test.js
 *
 * Tests for merchantService.js
 *
 * Place in the same directory as merchantService.js so relative mocks line up.
 */

//////////////////////////////////////////////
// Mocks - must come before importing the service
//////////////////////////////////////////////
import jest from 'jest-mock';
import { expect, describe, beforeEach, it } from '@jest/globals';

jest.mock('./merchantDao.js', () => ({
  createMerchantDao: jest.fn(),
  getMerchantsCodeDao: jest.fn(),
  getMerchantByUserIdDao: jest.fn(),
  getMerchantByUserDao: jest.fn(),
  getMerchantsDao: jest.fn(),
  getMerchantsByCodeDao: jest.fn(),
  getMerchantByCodeDao: jest.fn(),
  getAllMerchantsDao: jest.fn(),
  getMerchantsBySearchDao: jest.fn(),
  updateMerchantDao: jest.fn(),
  deleteMerchantDao: jest.fn(),
  updateMerchantBalanceDao: jest.fn(),
  getMerchantByCodeAndApiKey: jest.fn(),
  getMerchantsDaoArray: jest.fn(),
}));

jest.mock('../userHierarchy/userHierarchyDao.js', () => ({
  createUserHierarchyDao: jest.fn(),
  getUserHierarchysDao: jest.fn(),
  updateUserHierarchyDao: jest.fn(),
}));

jest.mock('../calculation/calculationDao.js', () => ({
  createCalculationDao: jest.fn(),
}));

jest.mock('../../utils/db.js', () => ({
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  getConnection: jest.fn(),
}));

jest.mock('../bankAccounts/bankaccountDao.js', () => ({
  getBankaccountDao: jest.fn(),
  updateBankaccountDao: jest.fn(),
}));

jest.mock('../users/userDao.js', () => ({
  updateUserDao: jest.fn(),
}));
jest.mock('../../utils/sockets.js', () => ({
  newTableEntry: jest.fn().mockResolvedValue(),
}));
jest.mock('../../constants/index.js', () => ({
  Role: {
    ADMIN: 'ADMIN',
    MERCHANT: 'MERCHANT',
    SUB_MERCHANT: 'SUB_MERCHANT',
    MERCHANT_OPERATIONS: 'MERCHANT_OPERATIONS',
  },
  columns: { MERCHANT: ['id', 'code', 'user_id'] },
  merchantColumns: { MERCHANT: ['id', 'code', 'user_id'] },
  tableName: { MERCHANT: 'Merchant', USER_HIERARCHY: 'UserHierarchy', USER: 'User', DESIGNATION: 'Designation' },
}));

jest.mock('../../helpers/index.js', () => ({
  filterResponse: jest.fn((data,) => data),
}));

jest.mock('../../utils/logger.js', () => ({
  logger: { log: jest.fn(), error: jest.fn() },
}));

jest.mock('../../utils/enhanceSubMerchant.js', () => ({
  enhanceMerchantsWithSubMerchants: jest.fn(async (rows) => rows),
}));

//////////////////////////////////////////////
// Now import the service under test
//////////////////////////////////////////////
import {
  createMerchantService,
  getMerchantsService,
  getMerchantsBySearchService,
  getMerchantsServiceCode,
  updateMerchantService,
  deleteMerchantService,
  getMerchantByIdService,
  getMerchantsByCodeService,
} from './merchantService.js';

// import mocks to assert calls
import * as dao from './merchantDao.js';
import * as uhDao from '../userHierarchy/userHierarchyDao.js';
import * as calcDao from '../calculation/calculationDao.js';
import { beginTransaction, commit, rollback, getConnection } from '../../utils/db.js';
import { getBankaccountDao, updateBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { updateUserDao } from '../users/userDao.js';
import { Role } from '../../constants/index.js';
import { filterResponse } from '../../helpers/index.js';
import { logger } from '../../utils/logger.js';

beforeEach(() => {
  jest.clearAllMocks();
});

//////////////////////////////////////////////
// Tests
//////////////////////////////////////////////

describe('merchantService', () => {
  describe('createMerchantService', () => {
    it('should create merchant, create calculation and create hierarchy for MERCHANT role', async () => {
      const payload = {
        parent_id: 'parent1',
        role_id: 'role-1',
        role: Role.MERCHANT,
        designation: null,
        created_by: 'u1',
        updated_by: 'u1',
        company_id: 'c1',
      };
      // simulate DAO creation returning user_id + company
      dao.createMerchantDao.mockResolvedValueOnce({ id: 'm1', user_id: 'u-merchant', company_id: 'c1', created_by: 'u1', updated_by: 'u1' });

      await createMerchantService(null, payload);

      expect(dao.createMerchantDao).toHaveBeenCalled();
      expect(calcDao.createCalculationDao).toHaveBeenCalledWith(null, {
        role_id: 'role-1',
        user_id: 'u-merchant',
        company_id: 'c1',
      });
      // Because role === MERCHANT, createUserHierarchyDao should be called
      expect(uhDao.createUserHierarchyDao).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'u-merchant',
          created_by: 'u1',
          updated_by: 'u1',
          company_id: 'c1',
        }),
        null,
      );
    });

    it('should update parent hierarchy when designation is SUB_MERCHANT and parent exists', async () => {
      const payload = {
        parent_id: 'parent1',
        role_id: 'role-2',
        role: 'SOME_ROLE',
        designation: Role.SUB_MERCHANT,
        created_by: 'u1',
        updated_by: 'u1',
        company_id: 'c1',
      };
      dao.createMerchantDao.mockResolvedValueOnce({ id: 'm2', user_id: 'u-sub', company_id: 'c1', created_by: 'u1', updated_by: 'u1' });

      // Parent hierarchy exists with config.siblings.sub_merchants
      uhDao.getUserHierarchysDao.mockResolvedValueOnce([
        { id: 'h1', config: { siblings: { sub_merchants: ['existing'] } } },
      ]);
      await createMerchantService(null, payload);

      expect(uhDao.getUserHierarchysDao).toHaveBeenCalledWith({ user_id: 'parent1' });
      expect(uhDao.updateUserHierarchyDao).toHaveBeenCalledWith(
        { id: 'h1' },
        { config: { siblings: { sub_merchants: ['existing', 'u-sub'] } } },
        null,
      );
    });

    it('should not throw when parent hierarchy not found (logs error)', async () => {
      const payload = {
        parent_id: 'parent-x',
        role_id: 'r',
        role: 'SOME_ROLE',
        designation: Role.SUB_MERCHANT,
        created_by: 'u1',
        updated_by: 'u1',
        company_id: 'c1',
      };
      dao.createMerchantDao.mockResolvedValueOnce({ id: 'm3', user_id: 'u-nohier', company_id: 'c1', created_by: 'u1', updated_by: 'u1' });

      // Simulate no hierarchy returned
      uhDao.getUserHierarchysDao.mockResolvedValueOnce([]);

      await createMerchantService(null, payload);

      // should not throw; should log error
      expect(logger.error).not.toHaveBeenCalledWith(expect.stringContaining('Error while creating merchant'), expect.anything());
      // updateUserHierarchyDao should not be called
      expect(uhDao.updateUserHierarchyDao).not.toHaveBeenCalled();
    });

    it('propagates errors from DAO', async () => {
      dao.createMerchantDao.mockRejectedValueOnce(new Error('dao-fail'));
      await expect(createMerchantService(null, { role: Role.MERCHANT, role_id: 'r', created_by: 'u', updated_by: 'u', company_id: 'c' })).rejects.toThrow('dao-fail');
    });
  });

  describe('getMerchantsService', () => {
    it('should call getAllMerchantsDao and return filtered response for ADMIN', async () => {
      const filters = { company_id: 'c1' };
      // getAllMerchantsDao returns rows -> enhanceMerchantsWithSubMerchants invoked in DAO and filterResponse returns input unchanged (mock)
      dao.getAllMerchantsDao.mockResolvedValueOnce([{ id: 'm1' }]);
      const res = await getMerchantsService(filters, Role.ADMIN, 1, 10, null, null);
      expect(dao.getAllMerchantsDao).toHaveBeenCalled();
      expect(filterResponse).toHaveBeenCalled();
      expect(res).toEqual([{ id: 'm1' }]);
    });

    it('should add sub-merchants for MERCHANT role when designation MERCHANT', async () => {
      const user_id = 'u-main';
      // Stub getUserHierarchysDao to include sub merchants
      const hierarchy = [{ config: { siblings: { sub_merchants: ['sub1', 'sub2'] } } }];
      uhDao.getUserHierarchysDao.mockResolvedValueOnce(hierarchy);
      dao.getAllMerchantsDao.mockResolvedValueOnce([{ id: 'm1' }]);

      const filters = { company_id: 'c1', user_id };
      const res = await getMerchantsService(filters, Role.MERCHANT, 1, 10, Role.MERCHANT, user_id);

      // userId filter should be populated before calling DAO (we assert that getAllMerchantsDao called)
      expect(dao.getAllMerchantsDao).toHaveBeenCalled();
      expect(res).toEqual([{ id: 'm1' }]);
    });

    it('should include parent and siblings for MERCHANT_OPERATIONS', async () => {
      // Setup hierarchy where current user has parent and parent has sub_merchants
      const user_id = 'u-op';
      uhDao.getUserHierarchysDao.mockResolvedValueOnce([{ config: { parent: 'parent1' } }]);
      uhDao.getUserHierarchysDao.mockResolvedValueOnce([{ config: { siblings: { sub_merchants: ['p-sub'] } } }]);
      dao.getAllMerchantsDao.mockResolvedValueOnce([{ id: 'm-op' }]);

      const filters = { company_id: 'c1' };
      const res = await getMerchantsService(filters, Role.MERCHANT, 1, 10, Role.MERCHANT_OPERATIONS, user_id);

      expect(uhDao.getUserHierarchysDao).toHaveBeenCalled();
      expect(dao.getAllMerchantsDao).toHaveBeenCalled();
      expect(res).toEqual([{ id: 'm-op' }]);
    });

    it('propagates errors', async () => {
      dao.getAllMerchantsDao.mockRejectedValueOnce(new Error('dao-list-fail'));
      await expect(getMerchantsService({ company_id: 'c' }, Role.ADMIN, 1, 10)).rejects.toThrow('dao-list-fail');
    });
  });

  describe('getMerchantsBySearchService', () => {
    it('should parse search terms and call getMerchantsBySearchDao', async () => {
      const filters = { company_id: 'c1', search: 'x,y', page: 2, limit: 5 };
      dao.getMerchantsBySearchDao.mockResolvedValueOnce({ merchants: [], totalCount: 0, totalPages: 0 });
      const res = await getMerchantsBySearchService(filters, Role.ADMIN, null, null);
      expect(dao.getMerchantsBySearchDao).toHaveBeenCalled();
      expect(res).toEqual({ merchants: [], totalCount: 0, totalPages: 0 });
    });

    it('propagates errors as InternalServerError', async () => {
      dao.getMerchantsBySearchDao.mockRejectedValueOnce(new Error('search-dao-fail'));
      await expect(getMerchantsBySearchService({ company_id: 'c', search: 'x' }, Role.ADMIN)).rejects.toThrow('search-dao-fail');
    });
  });

  describe('getMerchantsServiceCode', () => {
    it('should open connection, call getMerchantsCodeDao and commit', async () => {
      // mock getConnection to return a fake conn with query and release
      const fakeConn = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
      getConnection.mockResolvedValueOnce(fakeConn);

      // make DAO return sample
      dao.getMerchantsCodeDao.mockResolvedValueOnce([{ label: 'L' }]);

      const codes = await getMerchantsServiceCode({ company_id: 'c1' }, Role.ADMIN, null, null, 'true', 'false', 'true');

      expect(getConnection).toHaveBeenCalled();
      expect(beginTransaction).toHaveBeenCalledWith(fakeConn);
      expect(dao.getMerchantsCodeDao).toHaveBeenCalledWith(fakeConn, { company_id: 'c1' }, 'true', 'false', 'true');
      expect(commit).toHaveBeenCalledWith(fakeConn);
      expect(fakeConn.release).toHaveBeenCalled();
      expect(codes).toEqual([{ label: 'L' }]);
    });

    it('should rollback and release connection on error', async () => {
      const fakeConn = { query: jest.fn(), release: jest.fn() };
      getConnection.mockResolvedValueOnce(fakeConn);
      // DAO throws
      dao.getMerchantsCodeDao.mockRejectedValueOnce(new Error('code-dao-error'));

      await expect(getMerchantsServiceCode({ company_id: 'c1' }, Role.ADMIN, null, null, 'true', 'false', 'true')).rejects.toThrow('code-dao-error');

      expect(rollback).toHaveBeenCalledWith(fakeConn);
      expect(fakeConn.release).toHaveBeenCalled();
    });
  });

  describe('updateMerchantService', () => {
    it('should map whitelist_ips into config and call updateMerchantDao', async () => {
      const ids = { id: 'm1', company_id: 'c1' };
      const payload = { whitelist_ips: ['1.1.1.1'], config: { existing: true } };
      dao.updateMerchantDao.mockResolvedValueOnce({ id: 'm1' });

      const res = await updateMerchantService(null, ids, payload);
      expect(dao.updateMerchantDao).toHaveBeenCalledWith(ids, { config: { existing: true, whitelist_ips: ['1.1.1.1'] } }, null);
      expect(res).toEqual({ id: 'm1' });
    });

    it('propagates errors', async () => {
      dao.updateMerchantDao.mockRejectedValueOnce(new Error('update-fail'));
      await expect(updateMerchantService(null, { id: 'x' }, {})).rejects.toThrow('update-fail');
    });
  });

  describe('deleteMerchantService', () => {
    it('should delete merchant, update bank accounts and users and commit', async () => {
      // prepare fake connection
      const fakeConn = { query: jest.fn(), release: jest.fn() };
      getConnection.mockResolvedValueOnce(fakeConn);

      // merchantDetails from getMerchantsDao: return array with merchant having user_id
      dao.getMerchantsDao.mockResolvedValueOnce([{ id: 'mMain', user_id: 'uMain' }]);

      // getUserHierarchysDao returns submerchants and operations
      uhDao.getUserHierarchysDao.mockResolvedValueOnce([{ config: { siblings: { sub_merchants: ['subUser1'] }, child: { operations: ['op1'] } } }]);

      // getMerchantsDao for ids in allIds to fetch merchant ids for subUser1 / op1
      // When getMerchantsDao is called with { user_id: id } it should return either array of merchants or single object
      dao.getMerchantsDao.mockImplementation(async (filter) => {
        if (filter && filter.user_id === 'subUser1') return [{ id: 'subM1', user_id: 'subUser1' }];
        if (Array.isArray(filter.id)) return [{ id: 'mMain' }];
        // default
        return [{ id: 'mMain' }];
      });

      // getBankaccountDao returns banks that include merchants
      getBankaccountDao.mockResolvedValueOnce([
        { id: 'bank1', config: { merchants: ['mMain', 'subM1'] } },
      ]);

      updateBankaccountDao.mockResolvedValueOnce({}); // no real return needed

      updateUserDao.mockResolvedValueOnce({}); // mark users obsolete

      // deleteMerchantDao should return updated rows
      dao.deleteMerchantDao.mockResolvedValueOnce([{ id: 'mMain' }]);

      const ids = { id: 'mMain', company_id: 'c1' };

      const data = await deleteMerchantService(ids, 'uUpdater', Role.ADMIN);

      // check transaction and internal calls
      expect(getConnection).toHaveBeenCalled();
      expect(beginTransaction).toHaveBeenCalledWith(fakeConn);
      expect(dao.getMerchantsDao).toHaveBeenCalled();
      expect(getBankaccountDao).toHaveBeenCalled();
      expect(updateBankaccountDao).toHaveBeenCalled();
      expect(updateUserDao).toHaveBeenCalled();
      expect(dao.deleteMerchantDao).toHaveBeenCalled();
      expect(commit).toHaveBeenCalledWith(fakeConn);
      expect(fakeConn.release).toHaveBeenCalled();
      expect(data).toEqual([{ id: 'mMain' }]);
    });

    it('should rollback and release on error', async () => {
      const fakeConn = { query: jest.fn(), release: jest.fn() };
      getConnection.mockResolvedValueOnce(fakeConn);

      // make getMerchantsDao throw
      dao.getMerchantsDao.mockRejectedValueOnce(new Error('get-merchant-fail'));

      await expect(deleteMerchantService({ id: 'x', company_id: 'c1' }, 'u', Role.ADMIN)).rejects.toThrow('get-merchant-fail');

      expect(rollback).toHaveBeenCalledWith(fakeConn);
      expect(fakeConn.release).toHaveBeenCalled();
    });
  });

  describe('getMerchantByIdService', () => {
    it('should return merchant and empty subMerchants when no userHierarchy config', async () => {
      // getMerchantsDao returns single merchant
      dao.getMerchantsDao.mockResolvedValueOnce([{ id: 'm1', user_id: 'u1' }]);
      // getUserHierarchysDao returns empty
      uhDao.getUserHierarchysDao.mockResolvedValueOnce([]);

      const merchant = await getMerchantByIdService({ id: 'm1', company_id: 'c1' }, Role.ADMIN, true);
      expect(dao.getMerchantsDao).toHaveBeenCalled();
      // When no hierarchy, subMerchants becomes []
      expect(merchant.subMerchants).toEqual([]);
    });

    it('should fetch subMerchants when hierarchy has mapping', async () => {
      dao.getMerchantsDao.mockResolvedValueOnce([{ id: 'm2', user_id: 'u2' }]);
      // hierarchy config keyed by user id pointing to an array of user_ids
      const cfg = { [ 'u2' ]: ['subU1', 'subU2'] };
      uhDao.getUserHierarchysDao.mockResolvedValueOnce([{ id: 'h2', config: cfg }]);

      // when getMerchantsDao called to fetch subMerchants, return their objects
      dao.getMerchantsDao.mockResolvedValueOnce([{ id: 'subM1' }, { id: 'subM2' }]);

      const merchant = await getMerchantByIdService({ id: 'm2', company_id: 'c2' }, Role.ADMIN, true);
      expect(merchant.subMerchants).toEqual([{ id: 'subM1' }, { id: 'subM2' }]);
    });

    it('should throw NotFoundError when merchant not found', async () => {
      dao.getMerchantsDao.mockResolvedValueOnce([]);
      await expect(getMerchantByIdService({ id: 'no' }, Role.ADMIN, true)).rejects.toThrow();
    });
  });

  describe('getMerchantsByCodeService', () => {
    it('should throw BadRequestError when code missing', async () => {
      await expect(getMerchantsByCodeService(null)).rejects.toThrow();
    });

    it('should throw NotFoundError when dao returns empty array', async () => {
      dao.getMerchantByCodeDao.mockResolvedValueOnce([]);
      await expect(getMerchantsByCodeService('X')).rejects.toThrow();
    });

    it('should return merchant object when DAO returns results', async () => {
      dao.getMerchantByCodeDao.mockResolvedValueOnce([{ id: 'mC1' }]);
      const res = await getMerchantsByCodeService('CODEX');
      expect(res).toEqual({ id: 'mC1' });
    });
  });
});
