import {
  getUsersService,
  getUsersBySearchService,
  getUserByIdService,
  getUsersByUserNameService,
  createUserService,
  userUpdateService,
  sendMailService,
} from './userService'; // Adjust the path to the actual file name if needed

import { InternalServerError, BadRequestError } from '../../utils/appErrors.js';
import { createHash } from '../../utils/bcryptPassword.js';
import { getConnection } from '../../utils/db.js';
import { generateUUID } from '../../utils/generateUUID.js';
import { generatePassword } from '../../utils/generatePassword.js';
import { sendCredentialsEmail } from '../../utils/sendMailer.js';
import { unblocked_countries, columns, merchantColumns, Role, vendorColumns } from '../../constants/index.js';
import {
  createUserDao,
  getUserByIdDao,
  getUsersByUserNameDao,
  getUsersDao,
  updateUserDao,
  getUsersBySearchDao,
  getAllUsersDao,
} from './userDao.js';
import { getDesignationDao } from '../designation/designationDao.js';
import { getRoleDao } from '../roles/rolesDao.js';
import { filterResponse } from '../../helpers/index.js';
import { createMerchantService } from '../merchants/merchantService.js';
import { createVendorService } from '../vendors/vendorService.js';
import { logger } from '../../utils/logger.js';
import {
  createUserHierarchyDao,
  getUserHierarchysDao,
  updateUserHierarchyDao,
} from '../userHierarchy/userHierarchyDao.js';
import { getMerchantByUserIdDao } from '../merchants/merchantDao.js';
import { getVendorByUserDao } from '../vendors/vendorDao.js';
import { getCompanyByIDDao } from '../company/companyDao.js';

jest.mock('../../utils/bcryptPassword.js');
jest.mock('../../utils/db.js');
jest.mock('../../utils/generateUUID.js');
jest.mock('../../utils/generatePassword.js');
jest.mock('../../utils/sendMailer.js');
jest.mock('./userDao.js');
jest.mock('../designation/designationDao.js');
jest.mock('../roles/rolesDao.js');
jest.mock('../../helpers/index.js');
jest.mock('../merchants/merchantService.js');
jest.mock('../vendors/vendorService.js');
jest.mock('../../utils/logger.js');
jest.mock('../userHierarchy/userHierarchyDao.js');
jest.mock('../merchants/merchantDao.js');
jest.mock('../vendors/vendorDao.js');
jest.mock('../company/companyDao.js');

describe('User Service', () => {
  let mockConn;

  beforeEach(() => {
    mockConn = { release: jest.fn() };
    getConnection.mockResolvedValue(mockConn);
    logger.error = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUsersService', () => {
    it('should fetch users for admin role without hierarchy', async () => {
      const ids = { id: 1 };
      const role = Role.ADMIN;
      const page = 1;
      const limit = 10;
      const designation = 'admin';
      const user_id = 1;

      getAllUsersDao.mockResolvedValue([{ id: 1, name: 'test' }]);

      const result = await getUsersService(ids, role, page, limit, designation, user_id);
      expect(result).toEqual([{ id: 1, name: 'test' }]);
      expect(getAllUsersDao).toHaveBeenCalledWith(ids, 1, 10, null, null, columns.USER);
    });

    it('should fetch users for merchant role with hierarchy', async () => {
      const ids = {};
      const role = Role.MERCHANT;
      const page = 1;
      const limit = 10;
      const designation = Role.MERCHANT_OPERATIONS;
      const user_id = 1;

      getUserHierarchysDao.mockResolvedValueOnce([{ config: { parent: 2 } }]);
      getUserHierarchysDao.mockResolvedValueOnce([{ config: { child: { operations: [3] }, siblings: { sub_merchants: [4] } } }]);
      getUserHierarchysDao.mockResolvedValueOnce([{ config: { child: { operations: [5] } } }]);
      getAllUsersDao.mockResolvedValue([{ id: 1, name: 'test' }]);

      const result = await getUsersService(ids, role, page, limit, designation, user_id);
      expect(result).toEqual([{ id: 1, name: 'test' }]);
      expect(ids.id).toEqual([2,4,5,3]);
      expect(getAllUsersDao).toHaveBeenCalledWith(ids, 1, 10, null, null, merchantColumns.USER);
    });

    it('should handle errors', async () => {
      const ids = {};
      const role = Role.MERCHANT;
      const page = 1;
      const limit = 10;
      const designation = Role.MERCHANT_OPERATIONS;
      const user_id = 1;

      getUserHierarchysDao.mockRejectedValue(new Error('DB Error'));

      await expect(getUsersService(ids, role, page, limit, designation, user_id)).rejects.toThrow(Error);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getUsersBySearchService', () => {
    it('should fetch users by search for vendor role with hierarchy', async () => {
      const ids = { search: 'test,user' };
      const role = Role.VENDOR;
      const page = 1;
      const limit = 10;
      const designation = Role.VENDOR;
      const user_id = 1;

      getUserHierarchysDao.mockResolvedValueOnce([{ config: { siblings: { sub_merchants: [2], sub_vendors: [3] }, child: { operations: [4] } } }]);
      getUserHierarchysDao.mockResolvedValueOnce([{ config: { child: { operations: [5] } } }]);
      getUserHierarchysDao.mockResolvedValueOnce([{ config: { child: { operations: [6] } } }]);
      getUsersBySearchDao.mockResolvedValue([{ id: 1, name: 'test' }]);

      const result = await getUsersBySearchService(ids, role, page, limit, designation, user_id);
      expect(result).toEqual([{ id: 1, name: 'test' }]);
      expect(getUsersBySearchDao).toHaveBeenCalledWith(ids, ['test', 'user'], 1, 10, vendorColumns.USER, role);
    });

    it('should handle errors', async () => {
      const ids = { search: 'test' };
      const role = Role.VENDOR;
      const page = 1;
      const limit = 10;
      const designation = Role.VENDOR;
      const user_id = 1;

      getUserHierarchysDao.mockRejectedValue(new Error('DB Error'));

      await expect(getUsersBySearchService(ids, role, page, limit, designation, user_id)).rejects.toThrow(InternalServerError);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getUserByIdService', () => {
    it('should fetch user by id for merchant role', async () => {
      const ids = { id: 1 };
      const role = Role.MERCHANT;

      getUserByIdDao.mockResolvedValue([{ id: 1, name: 'test' }]);
      filterResponse.mockReturnValue([{ id: 1, name: 'filtered' }]);

      const result = await getUserByIdService(ids, role);
      expect(result).toEqual([{ id: 1, name: 'filtered' }]);
      expect(getUserByIdDao).toHaveBeenCalledWith(mockConn, ids);
      expect(filterResponse).toHaveBeenCalledWith([{ id: 1, name: 'test' }], merchantColumns.USER);
    });

    it('should handle errors and release connection', async () => {
      const ids = { id: 1 };
      const role = Role.MERCHANT;

      getUserByIdDao.mockRejectedValue(new Error('DB Error'));

      await expect(getUserByIdService(ids, role)).rejects.toThrow(Error);
      expect(mockConn.release).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getUsersByUserNameService', () => {
    it('should fetch users by username for vendor role', async () => {
      const username = 'testuser';
      const ids = { company_id: 1 };
      const role = Role.VENDOR;

      getUsersByUserNameDao.mockResolvedValue([{ id: 1, name: 'test' }]);
      filterResponse.mockReturnValue([{ id: 1, name: 'filtered' }]);

      const result = await getUsersByUserNameService(username, ids, role);
      expect(result).toEqual([{ id: 1, name: 'filtered' }]);
      expect(getUsersByUserNameDao).toHaveBeenCalledWith(ids, username, mockConn);
      expect(filterResponse).toHaveBeenCalledWith([{ id: 1, name: 'test' }], vendorColumns.USER);
    });

    it('should handle errors and release connection', async () => {
      const username = 'testuser';
      const ids = { company_id: 1 };
      const role = Role.VENDOR;

      getUsersByUserNameDao.mockRejectedValue(new Error('DB Error'));

      await expect(getUsersByUserNameService(username, ids, role)).rejects.toThrow(Error);
      expect(mockConn.release).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('createUserService', () => {
    it('should create a new merchant user', async () => {
      const payload = {
        user_name: 'newuser',
        company_id: 1,
        role_id: 1,
        designation_id: 1,
        first_name: 'First',
        last_name: 'Last',
        email: 'test@example.com',
        contact_no: '123456',
        is_enabled: true,
        created_by: 1,
        updated_by: 1,
        code: 'M001',
        min_payin: 100,
        max_payin: 1000,
        payin_commission: 1,
        min_payout: 100,
        max_payout: 1000,
        payout_commission: 1,
        payin_notify: 'url1',
        payout_notify: 'url2',
        return: 'url3',
        site: 'url4',
        whitelist_ips: ['ip1'],
      };

      getUsersByUserNameDao.mockResolvedValue(null);
      generatePassword.mockReturnValue('pass123');
      createHash.mockResolvedValue('hashedpass');
      createUserDao.mockResolvedValue({ id: 2, email: 'test@example.com', user_name: 'newuser' });
      getDesignationDao.mockResolvedValue([{ designation: Role.MERCHANT }]);
      getRoleDao.mockResolvedValue([{ role: Role.MERCHANT }]);
      generateUUID.mockReturnValueOnce('privatekey').mockReturnValueOnce('publickey');
      createMerchantService.mockResolvedValue({ code: 'M001', config: { keys: { private: 'privatekey', public: 'publickey' } } });
      sendCredentialsEmail.mockResolvedValue(true);

      const result = await createUserService(mockConn, payload);
      expect(result).toEqual({ id: 2, email: 'test@example.com', user_name: 'newuser' });
      expect(createUserDao).toHaveBeenCalled();
      expect(createMerchantService).toHaveBeenCalled();
      expect(sendCredentialsEmail).toHaveBeenCalled();
    });

    it('should throw error if user already exists', async () => {
      const payload = { user_name: 'existing', company_id: 1 };

      getUsersByUserNameDao.mockResolvedValue({ user_name: 'existing' });

      await expect(createUserService(mockConn, payload)).rejects.toThrow(BadRequestError);
    });

    it('should handle email sending failure', async () => {
      const payload = { user_name: 'newuser', company_id: 1, role_id: 1, designation_id: 1, email: 'test@example.com' };

      getUsersByUserNameDao.mockResolvedValue(null);
      generatePassword.mockReturnValue('pass123');
      createHash.mockResolvedValue('hashedpass');
      createUserDao.mockResolvedValue({ id: 2, email: 'test@example.com', user_name: 'newuser' });
      getDesignationDao.mockResolvedValue([{ designation: Role.ADMIN }]);
      getRoleDao.mockResolvedValue([{ role: Role.ADMIN }]);
      getCompanyByIDDao.mockResolvedValue([{ config: { unique_admin_id: 'admin123' } }]);
      sendCredentialsEmail.mockRejectedValue(new Error('Email Error'));

      await expect(createUserService(mockConn, payload)).rejects.toThrow(InternalServerError);
    });

    it('should create operations user with hierarchy', async () => {
      const payload = {
        user_name: 'opsuser',
        company_id: 1,
        role_id: 1,
        designation_id: 1,
        parent_id: 3,
        created_by: 1,
        updated_by: 1,
      };

      getUsersByUserNameDao.mockResolvedValue(null);
      generatePassword.mockReturnValue('pass123');
      createHash.mockResolvedValue('hashedpass');
      createUserDao.mockResolvedValue({ id: 4, email: 'ops@example.com', user_name: 'opsuser' });
      getDesignationDao.mockResolvedValue([{ designation: Role.MERCHANT_OPERATIONS }]);
      getRoleDao.mockResolvedValue([{ role: Role.MERCHANT }]);
      getUserHierarchysDao.mockResolvedValue([{ id: 5, config: { child: { operations: [] } } }]);
      updateUserHierarchyDao.mockResolvedValue();
      createUserHierarchyDao.mockResolvedValue();
      sendCredentialsEmail.mockResolvedValue(true);

      const result = await createUserService(mockConn, payload);
      expect(result).toEqual({ id: 4, email: 'ops@example.com', user_name: 'opsuser' });
      expect(updateUserHierarchyDao).toHaveBeenCalled();
      expect(createUserHierarchyDao).toHaveBeenCalled();
    });
  });

  describe('userUpdateService', () => {
    it('should update user', async () => {
      const ids = { id: 1, company_id: 1 };
      const payload = { first_name: 'Updated', updated_by: 1 };

      updateUserDao.mockResolvedValue({ id: 1, user_name: 'updateduser' });

      const result = await userUpdateService(mockConn, ids, payload);
      expect(result).toEqual({ id: 1, user_name: 'updateduser' });
      expect(updateUserDao).toHaveBeenCalledWith(ids, payload, mockConn);
    });

    it('should handle errors', async () => {
      const ids = { id: 1 };
      const payload = { first_name: 'Updated' };

      updateUserDao.mockRejectedValue(new Error('Update Error'));

      await expect(userUpdateService(mockConn, ids, payload)).rejects.toThrow(Error);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('sendMailService', () => {
    it('should send credentials email for merchant', async () => {
      const payload = { user_id: 1 };

      getUsersDao.mockResolvedValue([{ id: 1, role_id: 2, designation_id: 3, email: 'test@example.com', user_name: 'testuser', code: 'M001' }]);
      getRoleDao.mockResolvedValue([{ role: Role.MERCHANT }]);
      getDesignationDao.mockResolvedValue([{ designation: Role.MERCHANT }]);
      getMerchantByUserIdDao.mockResolvedValue([{ config: { keys: { private: 'priv', public: 'pub' } } }]);
      sendCredentialsEmail.mockResolvedValue(true);

      const result = await sendMailService(payload);
      expect(result).toBe(true);
      expect(sendCredentialsEmail).toHaveBeenCalledWith({
        email: 'test@example.com',
        username: 'testuser',
        code: 'M001',
        secretKey: 'priv',
        publicKey: 'pub',
        designation: Role.MERCHANT,
      });
    });

    it('should handle errors', async () => {
      const payload = { user_id: 1 };

      getUsersDao.mockRejectedValue(new Error('DB Error'));

      await expect(sendMailService(payload)).rejects.toThrow(Error);
      expect(logger.error).toHaveBeenCalled();
    });
  });
});