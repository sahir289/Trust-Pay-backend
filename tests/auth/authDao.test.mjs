/* global describe, it, expect, afterEach, beforeAll, beforeEach */
import { jest } from '@jest/globals';

// ─────────────────────────────────────────────
// MUST: mocks first (before importing tested modules)
// ─────────────────────────────────────────────
jest.unstable_mockModule('../../src/utils/db.js', () => ({
  executeQuery: jest.fn(),
}));

// ─────────────────────────────────────────────
// IMPORTS (after mocks)
// ─────────────────────────────────────────────
let authDao;
let db;

beforeAll(async () => {
  // IMPORTANT: DO NOT use resetModules in ESM mock setup
  authDao = await import('../../src/apis/auth/authDao.js');
  db = await import('../../src/utils/db.js');
});

beforeEach(() => {
  db.executeQuery = jest.fn();
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────
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

  // ─────────────────────────────────────────
  // addLoginDao
  // ─────────────────────────────────────────
  describe('addLoginDao', () => {

    it('should insert and return session', async () => {
      db.executeQuery.mockResolvedValue({
        rows: [{ id: 1, session_id: 'abc' }],
      });

      const result = await authDao.addLoginDao(1, {}, 2, 'abc');

      // Check the returned session data
      expect(result).toEqual({
        id: 1,
        session_id: 'abc',
      });

      // Check that the correct query was executed with expected parameters
      expect(db.executeQuery).toHaveBeenCalled();
    });

    it('should throw on db error', async () => {
      db.executeQuery.mockRejectedValue(new Error('fail'));

      // Call the DAO and expect it to throw an error
      await expect(
        authDao.addLoginDao(1, {}, 2, 'abc'),
      ).rejects.toThrow('fail');
    });
  });
});