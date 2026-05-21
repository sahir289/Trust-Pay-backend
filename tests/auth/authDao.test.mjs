
jest.unstable_mockModule('../../src/utils/db.js', () => ({
  executeQuery: jest.fn(),
}));
/* global describe, it, expect, afterEach, beforeAll, beforeEach */
import { jest } from '@jest/globals';

let authDao, db;

beforeAll(async () => {
  jest.resetModules();
  authDao = await import('../../src/apis/auth/authDao.js');
  db = await import('../../src/utils/db.js');
});

beforeEach(() => {
  if (db) db.executeQuery = jest.fn();
});

afterEach(() => { jest.clearAllMocks(); });

describe('authDao', () => {
  const daoNames = [
    'addLoginDao',
    'getRefreshTokenDao',
    'getLoginDao',
    'getSessionByIdDao',
    'updateSessionDao',
    'deleteUserSessionsDao',
    'changePasswordDao',
    'getUserAuthPasswordDao',
    'getAllActiveSessionsDao',
    'getRoleByUserNameDao',
    'getUserForVerificationDao',
    'getSessionByUserIdDao',
  ];

  daoNames.forEach((name) => {
    it(`${name} should be defined`, () => {
      expect(authDao[name]).toBeDefined();
      expect(typeof authDao[name]).toBe('function');
    });
  });

  describe('addLoginDao', () => {
    it('should insert and return session', async () => {
      db.executeQuery.mockResolvedValue({ rows: [{ id: 1, session_id: 'abc' }] });
      const result = await authDao.addLoginDao(1, {}, 2, 'abc');
      expect(result).toEqual({ id: 1, session_id: 'abc' });
      expect(db.executeQuery).toHaveBeenCalled();
    });
    it('should throw on db error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));
      await expect(authDao.addLoginDao(1, {}, 2, 'abc')).rejects.toThrow('fail');
    });
  });
});
