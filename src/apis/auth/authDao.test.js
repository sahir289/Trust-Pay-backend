/* eslint-disable no-useless-escape */

// src/apis/auth/authDao.test.js
import {
  addLoginDao,
  getRefreshTokenDao,
  getLoginDao,
  getSessionByIdDao,
  updateSessionDao,
  deleteUserSessionsDao,
  changePasswordDao,
  getAllActiveSessionsDao,
  getRoleByUserNameDao,
} from './authDao.js';

import { executeQuery } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';

// Mock db.js completely
jest.mock('../../utils/db.js');


// Mock logger
jest.mock('../../utils/logger.js', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('Auth DAO Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addLoginDao', () => {
    it('should mark previous sessions obsolete and add a new session', async () => {
      const mockResult = { rows: [{ id: '123', session_id: 'abc' }] };
      executeQuery.mockResolvedValueOnce({ rows: [] });
      executeQuery.mockResolvedValueOnce(mockResult);

      const result = await addLoginDao('user1', { foo: 'bar' }, 'company1', 'abc');

      expect(executeQuery).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockResult.rows[0]);
    });

    it('should throw error if query fails', async () => {
      executeQuery.mockRejectedValueOnce(new Error('DB error'));

      await expect(addLoginDao('user1', {}, 'company1', 'abc')).rejects.toThrow('DB error');
      expect(logger.error).toHaveBeenCalledWith(
        'Error in adding login details',
        expect.any(Error)
      );
    });
  });

  describe('getRefreshTokenDao', () => {
    it('should return user_id if refresh token exists', async () => {
      const mockResult = { rows: [{ user_id: 'user1' }] };
      executeQuery.mockResolvedValueOnce(mockResult);

      const result = await getRefreshTokenDao('hashedToken', 'company1');
      expect(result).toEqual(mockResult.rows[0]);
    });
  });

  describe('getLoginDao', () => {
    it('should return login config', async () => {
      const mockResult = { rows: [{ config: { foo: 'bar' } }] };
      executeQuery.mockResolvedValueOnce(mockResult);

      const result = await getLoginDao('user1', 'company1');
      expect(result).toEqual(mockResult.rows[0]);
    });
  });

  describe('getSessionByIdDao', () => {
    it('should return session by user_id and company_id', async () => {
      const mockResult = { rows: [{ session_id: 'abc', config: {} }] };
      executeQuery.mockResolvedValueOnce(mockResult);

      const result = await getSessionByIdDao({ user_id: 'user1', company_id: 'company1' });
      expect(result).toEqual(mockResult.rows[0]);
    });
  });

  describe('updateSessionDao', () => {
    it('should update session config', async () => {
      executeQuery.mockResolvedValueOnce({ rows: [] });
      await updateSessionDao('user1', 'company1', 'abc', { foo: 'bar' });
      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        expect.any(Array)
      );
    });
  });

  describe('deleteUserSessionsDao', () => {
    it('should mark sessions obsolete', async () => {
      executeQuery.mockResolvedValueOnce({ rows: [{ session_id: 'abc' }] });
      const result = await deleteUserSessionsDao('user1', 'company1', 'abc');
      expect(result).toEqual([{ session_id: 'abc' }]);
    });
  });

  describe('changePasswordDao', () => {
    it('should update user password', async () => {
      const mockResult = { rows: [{ id: 'user1' }] };
      executeQuery.mockResolvedValueOnce(mockResult);

      const result = await changePasswordDao('user1', 'newpass');
      expect(executeQuery).toHaveBeenCalledWith(
        'UPDATE "User" SET password = $2 WHERE id = $1 RETURNING id',
        ['user1', 'newpass']
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('getAllActiveSessionsDao', () => {
    it('should return all active sessions', async () => {
      const mockResult = { rows: [{ session_id: 'abc', config: {}, created_at: '2025-01-01' }] };
      executeQuery.mockResolvedValueOnce(mockResult);

      const result = await getAllActiveSessionsDao('user1', 'company1');
      expect(result).toEqual(mockResult.rows);
    });
  });

  describe('getRoleByUserNameDao', () => {
    it('should return role by username', async () => {
      const mockResult = { rows: [{ designation: 'Admin' }] };
      executeQuery.mockResolvedValueOnce(mockResult);

      const result = await getRoleByUserNameDao('user1');
      expect(result).toEqual(mockResult.rows[0]);
    });
  });
});
