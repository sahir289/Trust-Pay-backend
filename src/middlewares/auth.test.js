// __tests__/authMiddleware.test.js

// Mock logger before any other imports
jest.mock('../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
  },
}));

// Mock redisClient to prevent real Redis code
jest.mock('../utils/redisClient.js', () => ({}));

jest.mock('../utils/auth.js', () => ({
  verifyToken: jest.fn(),
}));

jest.mock('../apis/auth/authDao.js', () => ({
  getSessionByIdDao: jest.fn(),
}));

describe('Auth middlewares', () => {
  let isAuthenticated, authorized, logoutSet;
  let logger;
  let getSessionByIdDao;
  let verifyToken;

  beforeEach(() => {
    jest.isolateModules(() => {
      const loggerModule = require('../utils/logger.js');
      logger = loggerModule.logger;

      const authModule = require('../middlewares/auth.js');
      isAuthenticated = authModule.isAuthenticated;
      authorized = authModule.authorized;
      logoutSet = authModule.logoutSet;

      const authDao = require('../apis/auth/authDao.js');
      getSessionByIdDao = authDao.getSessionByIdDao;

      const authUtils = require('../utils/auth.js');
      verifyToken = authUtils.verifyToken;
    });

    jest.clearAllMocks();
  });

  describe('isAuthenticated middleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = { header: jest.fn(), user: null, sessionId: null };
      res = {};
      next = jest.fn();
      logoutSet.clear();
    });

    it('throws error when no token provided', async () => {
      req.header.mockReturnValue(null);

      await isAuthenticated(req, res, next);

      expect(logger.error).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('throws error when token is in logoutSet', async () => {
      const token = 'expiredToken123';
      logoutSet.add(token);
      req.header.mockReturnValue(token);

      await isAuthenticated(req, res, next);

      expect(logger.error).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('authenticates successfully with valid session', async () => {
      const token = 'validToken123';
      req.header.mockReturnValue(token);

      const decoded = { user_id: 'u1', company_id: 'c1', designation: 'ADMIN' };
      verifyToken.mockReturnValue(decoded);
      getSessionByIdDao.mockResolvedValue({ session_id: 's1' });

      await isAuthenticated(req, res, next);

      expect(logger.info).toHaveBeenCalled();
      expect(req.user).toEqual(decoded);
      expect(req.sessionId).toBe('s1');
      expect(next).toHaveBeenCalledWith();
    });

    it('throws error if session not found', async () => {
      const token = 'validToken123';
      req.header.mockReturnValue(token);

      verifyToken.mockReturnValue({ user_id: 'u1', company_id: 'c1' });
      getSessionByIdDao.mockResolvedValue(null);

      await isAuthenticated(req, res, next);

      expect(logoutSet.has(token)).toBe(true);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('throws error if DB validation fails', async () => {
      const token = 'validToken123';
      req.header.mockReturnValue(token);

      verifyToken.mockReturnValue({ user_id: 'u1', company_id: 'c1' });
      getSessionByIdDao.mockRejectedValue(new Error('DB error'));

      await isAuthenticated(req, res, next);

      expect(logger.error).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('authorized middleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = { user: { designation: 'ADMIN' } };
      res = {};
      next = jest.fn();
    });

    it('throws error if allowedRoles is not an array', () => {
      const middleware = authorized('ADMIN');

      middleware(req, res, next);

      expect(logger.error).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('calls next when designation is allowed', () => {
      const middleware = authorized(['ADMIN', 'USER']);

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('throws error when designation missing', () => {
      req.user = {};
      const middleware = authorized(['ADMIN']);

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('throws error when designation not allowed', () => {
      req.user = { designation: 'USER' };
      const middleware = authorized(['ADMIN']);

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
