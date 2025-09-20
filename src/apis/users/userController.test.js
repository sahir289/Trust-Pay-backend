import {describe, expect, it, beforeEach} from '@jest/globals';

import {
  getUsers,
  getUsersBySearch,
  getUsersByUserName,
  getUserById,
  createUser,
  updateUser,
  sendMail,
} from './userController.js'; // adjust path if needed

// Mock modules that usercontroller imports
jest.mock('../../utils/responseHandlers.js', () => ({
  sendSuccess: jest.fn(),
}));
jest.mock('../../utils/appErrors.js', () => {
  class BadRequestError extends Error {
    constructor(message) {
      super(message);
      this.name = 'BadRequestError';
    }
  }
  class ValidationError extends Error {
    constructor(message) {
      super(message);
      this.name = 'ValidationError';
    }
  }
  return { BadRequestError, ValidationError };
});
jest.mock('./userService.js', () => ({
  createUserService: jest.fn(),
  getUserByIdService: jest.fn(),
  getUsersByUserNameService: jest.fn(),
  getUsersService: jest.fn(),
  userUpdateService: jest.fn(),
  getUsersBySearchService: jest.fn(),
  sendMailService: jest.fn(),
}));
jest.mock('../../schemas/userSchema.js', () => ({
  CREATE_USER_SCHEMA: {
    validate: jest.fn(),
  },
}));
jest.mock('../../utils/db.js', () => ({
  transactionWrapper: jest.fn(),
}));
jest.mock('./userDao.js', () => ({
  getUsersContactDao: jest.fn(),
}));
jest.mock('../../utils/logger.js', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    log: jest.fn(),
  },
}));

// Import the mocked functions for assertions
import { sendSuccess } from '../../utils/responseHandlers.js';
import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
import {
  createUserService,
  getUserByIdService,
  getUsersByUserNameService,
  getUsersService,
  userUpdateService,
  getUsersBySearchService,
  sendMailService,
} from './userService.js';
import { CREATE_USER_SCHEMA } from '../../schemas/userSchema.js';
import { transactionWrapper } from '../../utils/db.js';
import { getUsersContactDao } from './userDao.js';

describe('userController', () => {
  // reusable mock req/res
  let res;
  beforeEach(() => {
    jest.clearAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe('getUsers', () => {
    it('should call getUsersService with correct params and return sendSuccess', async () => {
      const mockData = { users: [{ id: 1 }] };
      getUsersService.mockResolvedValue(mockData);

      const req = {
        user: {
          role: 'ROLE_X',
          company_id: 'comp-1',
          user_id: 'u-1',
          designation: 'desig-1',
        },
        query: { page: 2, limit: 5, foo: 'bar' },
      };

      await getUsers(req, res);

      expect(getUsersService).toHaveBeenCalledWith(
        { company_id: 'comp-1', ...req.query },
        'ROLE_X',
        2,
        5,
        'desig-1',
        'u-1',
      );

      expect(sendSuccess).toHaveBeenCalledWith(res, mockData, 'getUsers successfully');
    });

    it('should propagate errors from getUsersService', async () => {
      const error = new Error('db error');
      getUsersService.mockRejectedValue(error);
      const req = { user: { role: 'R', company_id: 'c', user_id: 'u', designation: 'd' }, query: {} };

      await expect(getUsers(req, res)).rejects.toThrow('db error');
    });
  });

  describe('getUsersBySearch', () => {
    it('should call getUsersBySearchService and send success', async () => {
      const mockData = { totalCount: 0, Users: [] };
      getUsersBySearchService.mockResolvedValue(mockData);

      const req = {
        user: { role: 'R', company_id: 'c', user_id: 'u', designation: 'd' },
        query: { q: 'x', page: 1, limit: 10 },
      };

      await getUsersBySearch(req, res);

      expect(getUsersBySearchService).toHaveBeenCalledWith(
        { company_id: 'c', ...req.query },
        'R',
        1,
        10,
        'd',
        'u',
      );
      expect(sendSuccess).toHaveBeenCalledWith(res, mockData, 'getUsers successfully');
    });

    it('should propagate service errors', async () => {
      getUsersBySearchService.mockRejectedValue(new Error('search fail'));
      const req = { user: { role: 'R', company_id: 'c', user_id: 'u', designation: 'd' }, query: {} };

      await expect(getUsersBySearch(req, res)).rejects.toThrow('search fail');
    });
  });

  describe('getUsersByUserName', () => {
    it('should throw BadRequestError when username missing', async () => {
      const req = { user: { role: 'R', company_id: 'c' }, body: {} };
      await expect(getUsersByUserName(req, res)).rejects.toThrow(BadRequestError);
    });

    it('should call getUsersByUserNameService and send success', async () => {
      const returned = [{ id: 1, user_name: 'john' }];
      getUsersByUserNameService.mockResolvedValue(returned);

      const req = { user: { role: 'R', company_id: 'comp' }, body: { username: 'john' } };

      await getUsersByUserName(req, res);

      expect(getUsersByUserNameService).toHaveBeenCalledWith('john', { company_id: 'comp' }, 'R');
      expect(sendSuccess).toHaveBeenCalledWith(res, returned, 'getUsers successfully');
    });
  });

  describe('getUserById', () => {
    it('should call getUserByIdService and send success', async () => {
      const userRow = { id: 'u1' };
      getUserByIdService.mockResolvedValue(userRow);

      const req = {
        user: { role: 'R', role_id: 'rid', designation_id: 'did', company_id: 'cid' },
        params: { id: 'u1' },
      };

      await getUserById(req, res);

      expect(getUserByIdService).toHaveBeenCalledWith(
        { role_id: 'rid', designation_id: 'did', company_id: 'cid', id: 'u1' },
        'R',
      );
      expect(sendSuccess).toHaveBeenCalledWith(res, userRow, 'getting User by id successfully');
    });

    it('should propagate errors from getUserByIdService', async () => {
      getUserByIdService.mockRejectedValue(new Error('oops'));
      const req = { user: { role: 'R', role_id: 'rid', designation_id: 'did', company_id: 'cid' }, params: { id: 'u1' } };
      await expect(getUserById(req, res)).rejects.toThrow('oops');
    });
  });

  describe('createUser', () => {
    it('should throw ValidationError when Joi validation returns error', async () => {
      CREATE_USER_SCHEMA.validate.mockReturnValue({ error: 'bad' });
      const req = { user: { role: 'R', company_id: 'c', user_id: 'u', designation: 'd', user_name: 'creator' }, body: {} };

      await expect(createUser(req, res)).rejects.toThrow(ValidationError);
      expect(CREATE_USER_SCHEMA.validate).toHaveBeenCalledWith(req.body);
    });

    it('should throw BadRequestError when contact exists', async () => {
      CREATE_USER_SCHEMA.validate.mockReturnValue({ error: null });
      getUsersContactDao.mockResolvedValue(true);
      const req = {
        user: { role: 'R', company_id: 'c', user_id: 'u', designation: 'd', user_name: 'creator' },
        body: { contact_no: '999', user_name: ' new ' },
      };

      await expect(createUser(req, res)).rejects.toThrow(BadRequestError);
      // ensure contact check performed
      expect(getUsersContactDao).toHaveBeenCalledWith('c', '999');
    });

    it('should create user successfully and call sendSuccess', async () => {
      CREATE_USER_SCHEMA.validate.mockReturnValue({ error: undefined, value: {} });
      getUsersContactDao.mockResolvedValue(false);

      // mock transactionWrapper to return a fn that resolves to created user
      const createdUser = { id: 'created-1' };
      const innerFn = jest.fn().mockResolvedValue(createdUser);
      transactionWrapper.mockReturnValue(innerFn);

      const req = {
        user: { role: 'R', company_id: 'c', user_id: 'u', designation: 'd', user_name: 'creator' },
        body: { user_name: ' newuser ', contact_no: '123' },
      };

      await createUser(req, res);

      // transaction wrapper used with createUserService
      expect(transactionWrapper).toHaveBeenCalled(); // we don't assert args, just that it's used
      expect(innerFn).toHaveBeenCalledWith(
        expect.objectContaining({
          user_name: 'newuser', // trimmed in controller
          is_enabled: true,
          company_id: 'c',
          created_by: 'u',
          updated_by: 'u',
        }),
        'R',
        'd',
      );

      expect(sendSuccess).toHaveBeenCalledWith(
        res,
        { id: createdUser.id, created_by: 'creator' },
        'Create user successfully',
      );
    });

    it('should propagate errors from create flow', async () => {
      CREATE_USER_SCHEMA.validate.mockReturnValue({ error: undefined });
      getUsersContactDao.mockResolvedValue(false);
      const innerFn = jest.fn().mockRejectedValue(new Error('create fail'));
      transactionWrapper.mockReturnValue(innerFn);

      const req = { user: { role: 'R', company_id: 'c', user_id: 'u', designation: 'd', user_name: 'creator' }, body: { user_name: 'x', contact_no: '1' } };
      await expect(createUser(req, res)).rejects.toThrow('create fail');
    });
  });

  describe('updateUser', () => {
    it('should update user and call sendSuccess', async () => {
      const updatedUser = { id: 'u-123' };
      const innerFn = jest.fn().mockResolvedValue(updatedUser);
      transactionWrapper.mockReturnValue(innerFn);

      const req = {
        user: { company_id: 'c', user_id: 'updater', user_name: 'up_name' },
        body: { first_name: 'John' },
        params: { id: 'u-123' },
      };

      await updateUser(req, res);

      expect(transactionWrapper).toHaveBeenCalled();
      expect(innerFn).toHaveBeenCalledWith({ id: 'u-123', company_id: 'c' }, expect.objectContaining({ first_name: 'John', updated_by: 'updater' }));
      expect(sendSuccess).toHaveBeenCalledWith(res, { id: updatedUser.id, updated_by: 'up_name' }, 'Update user successfully');
    });

    it('should propagate errors from update service', async () => {
      const innerFn = jest.fn().mockRejectedValue(new Error('update err'));
      transactionWrapper.mockReturnValue(innerFn);

      const req = { user: { company_id: 'c', user_id: 'updater', user_name: 'u' }, body: {}, params: { id: 'x' } };
      await expect(updateUser(req, res)).rejects.toThrow('update err');
    });
  });

  describe('sendMail', () => {
    it('should call sendMailService and sendSuccess', async () => {
      sendMailService.mockResolvedValue(true);
      const req = { user: { user_name: 'mailer' }, body: { user_id: 'u' } };

      await sendMail(req, res);

      expect(sendMailService).toHaveBeenCalledWith(req.body);
      expect(sendSuccess).toHaveBeenCalledWith(res, { mail_sent_by: 'mailer' }, 'Mail send successfully');
    });

    it('should propagate errors from sendMailService', async () => {
      sendMailService.mockRejectedValue(new Error('mail fail'));
      const req = { user: { user_name: 'mailer' }, body: { user_id: 'u' } };
      await expect(sendMail(req, res)).rejects.toThrow('mail fail');
    });
  });
});
