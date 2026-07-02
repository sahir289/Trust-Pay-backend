import { jest } from "@jest/globals";

jest.unstable_mockModule("../../utils/db.js", () => ({
  getConnection: jest.fn(),
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  executeQuery: jest.fn(),

  buildInsertQuery: jest.fn(),
  buildUpdateQuery: jest.fn(),
  buildDeleteQuery: jest.fn(),
  buildSelectQuery: jest.fn(),

  isSafeColumnName: jest.fn(() => true),
  
  insertRecord: jest.fn(),
  updateRecord: jest.fn(),
  deleteRecord: jest.fn(),

  releaseConnection: jest.fn(),
}));

jest.unstable_mockModule("../../utils/bcryptPassword.js", () => ({
  createHash: jest.fn(),
  verifyHash: jest.fn(),
}));

jest.unstable_mockModule("../../utils/auth.js", () => ({
  generateUserToken: jest.fn(),
  generatePreAuthToken: jest.fn(),
  verifyPreAuthToken: jest.fn(),
}));

jest.unstable_mockModule("../../services/twoFactorService.js", () => ({
  generateSetup: jest.fn(),
  verifyTotpToken: jest.fn(),
}));

jest.unstable_mockModule("./authDao.js", () => ({
  addLoginDao: jest.fn(),
  deleteUserSessionsDao: jest.fn(),
  getSessionByIdDao: jest.fn(),
  changePasswordDao: jest.fn(),
  getUserAuthPasswordDao: jest.fn(),
  getRoleByUserNameDao: jest.fn(),
  getUserForVerificationDao: jest.fn(),
}));

jest.unstable_mockModule("../users/userDao.js", () => ({
  getUsersByUserNameDao: jest.fn(),
  updateUserDao: jest.fn(),
  saveTwoFactorSecretDao: jest.fn(),
  enableTwoFactorDao: jest.fn(),
  disableTwoFactorDao: jest.fn(),
}));

jest.unstable_mockModule("../settings/settingsDao.js", () => ({
  get2FAEnforcementDao: jest.fn(),
}));

jest.unstable_mockModule("../userOtp/userOtpDao.js", () => ({
  createUserOtpDao: jest.fn(),
  getUserOtpDao: jest.fn(),
  updateUserOtpDao: jest.fn(),
}));

jest.unstable_mockModule("../../utils/redishashkey.js", () => ({
  AUTH_SESSION_CACHE_TTL_SEC: 3600,

  buildAuthSessionCacheKey: jest.fn(() => "cache-key"),
  generateCacheKey: jest.fn(() => "cache-key"),

  setCachedData: jest.fn(),
  getCachedData: jest.fn(),
  deleteCachedData: jest.fn(),

  clearCache: jest.fn(),
  invalidateCache: jest.fn(),

  AUTH_CACHE_TTL_SEC: 3600,
}));

jest.unstable_mockModule("../../helpers/index.js", () => ({
  filterResponse: jest.fn((user) => user),
}));

jest.unstable_mockModule("../../utils/generateUUID.js", () => ({
  generateUUID: jest.fn(() => "session-123"),
}));

jest.unstable_mockModule("../../utils/generateOtp.js", () => ({
  generateOTP: jest.fn(() => "123456"),
}));

jest.unstable_mockModule("../../utils/sendMailer.js", () => ({
  sendOTP: jest.fn(),
}));
jest.unstable_mockModule("../../utils/sockets.js", () => ({
  forceLogoutUser: jest.fn(),
  logOutUser: jest.fn().mockResolvedValue(),
}));

jest.unstable_mockModule("../../utils/hashUtils.js", () => ({
  compareHash: jest.fn(),
  createHash: jest.fn(() => "hashed-refresh"),
}));

jest.unstable_mockModule("../../utils/logger.js", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
  },
}));

jest.unstable_mockModule("../../constants/index.js", () => ({
  Role: {
    ADMIN: "ADMIN",
    VENDOR: "VENDOR",
  },

  Status: {
    ACTIVE: "ACTIVE",
    INACTIVE: "INACTIVE",
    SUCCESS: "SUCCESS",
    FAILED: "FAILED",
  },

  columns: {
    USER: {},
  },

  tableName: {
    USER: "User",
    ACCESS_TOKEN: "AccessToken",
    ROLE: "Role",
    DESIGNATION: "Designation",
    USER_OTP: "UserOtp",
    SETTINGS: "Settings",
  },
}));

const db = await import("../../utils/db.js");
const bcrypt = await import("../../utils/bcryptPassword.js");
const auth = await import("../../utils/auth.js");
const authDao = await import("./authDao.js");
const userDao = await import("../users/userDao.js");
const redis = await import("../../utils/redishashkey.js");
const helper = await import("../../helpers/index.js");
const uuid = await import("../../utils/generateUUID.js");
const hashUtils = await import("../../utils/hashUtils.js");
const settingsDao = await import("../settings/settingsDao.js");
const sockets = await import("../../utils/sockets.js");
const loggerModule = await import("../../utils/logger.js");
const userOtpDao = await import("../userOtp/userOtpDao.js");
const authServiceModule = await import("./authService.js");

const {
  changePasswordService,
  verificationService,
  loginService,
  logoutService,
  refreshTokenService,
  forgetPasswordService,
  verfyUserService,
  verfyOtpService,
  getUserRoleService,
  verifyLoginOtpService,
  setup2FAService,
  confirm2FAService,
  disable2FAService,
} = authServiceModule;

describe("Auth Service", () => {
  let conn;
  let user;
  let ua;
  let loginPayload;

  beforeEach(() => {
    jest.clearAllMocks();

    conn = {
      release: jest.fn(),
    };

    db.getConnection.mockResolvedValue(conn);
    db.beginTransaction.mockResolvedValue();
    db.commit.mockResolvedValue();
    db.rollback.mockResolvedValue();

    user = {
      id: 1,
      user_name: "admin",
      company_id: 100,
      password: "hashed-password",
      designation: "ADMIN",
      role: "ADMIN",
      is_enabled: true,
      is_two_factor_enabled: false,
      is_two_factor_exempt: false,
      two_factor_secret: "SECRET",
      config: {
        isLoginFirst: false,
      },
      company_config: {
        unique_admin_id: "ADMIN001",
      },
    };

    loginPayload = {
      username: "admin",
      password: "password123",
      unique_admin_id: "ADMIN001",
      user_location: {
        country: "India",
      },
    };

    ua = {
      browser: {
        name: "Chrome",
        version: "125",
      },
      os: {
        name: "Windows",
        version: "11",
      },
      device: {
        type: "desktop",
      },
    };

    userDao.getUsersByUserNameDao.mockResolvedValue(user);

    bcrypt.verifyHash.mockResolvedValue(true);
    bcrypt.createHash.mockResolvedValue("hashed-password");

    settingsDao.get2FAEnforcementDao.mockResolvedValue(false);

    uuid.generateUUID.mockReturnValue("session-123");

    auth.generateUserToken.mockReturnValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });

    hashUtils.createHash.mockReturnValue("hashed-refresh-token");

    authDao.deleteUserSessionsDao.mockResolvedValue();
    authDao.addLoginDao.mockResolvedValue({
      id: 1,
      session_id: "session-123",
    });

    helper.filterResponse.mockImplementation((u) => ({
      id: u.id,
      user_name: u.user_name,
    }));

    redis.setCachedData.mockResolvedValue();

    sockets.forceLogoutUser.mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("loginService - Success Cases", () => {
    test("should login successfully", async () => {
      const result = await loginService(
        loginPayload,
        "127.0.0.1",
        ua
      );

      expect(userDao.getUsersByUserNameDao).toHaveBeenCalledWith(
        {},
        loginPayload.username
      );

      expect(bcrypt.verifyHash).toHaveBeenCalledWith(
        loginPayload.password,
        user.password
      );

      expect(settingsDao.get2FAEnforcementDao).toHaveBeenCalledWith(
        user.company_id
      );

      expect(db.getConnection).toHaveBeenCalledTimes(1);

      expect(db.beginTransaction).toHaveBeenCalledWith(conn);

      expect(authDao.deleteUserSessionsDao).toHaveBeenCalledWith(
        user.id,
        user.company_id,
        null,
        conn
      );

      expect(authDao.addLoginDao).toHaveBeenCalledTimes(1);

      expect(db.commit).toHaveBeenCalledWith(conn);

      expect(redis.setCachedData).toHaveBeenCalledTimes(1);

      expect(sockets.forceLogoutUser).toHaveBeenCalledWith(
        user.id,
        null,
        "session-123"
      );

      expect(conn.release).toHaveBeenCalled();

      expect(result).toEqual({
        tokenInfo: {
          accessToken: "access-token",
          refreshToken: "refresh-token",
        },
        refreshToken: "refresh-token",
        sessionId: "session-123",
        user: {
          id: 1,
          user_name: "admin",
        },
        two_factor_enforcement: false,
        must_setup_2fa: false,
      });
    });

    test("should create login session once", async () => {
      await loginService(
        loginPayload,
        "127.0.0.1",
        ua
      );

      expect(auth.generateUserToken).toHaveBeenCalledTimes(1);

      expect(uuid.generateUUID).toHaveBeenCalledTimes(1);

      expect(hashUtils.createHash).toHaveBeenCalledWith(
        "refresh-token"
      );

      expect(authDao.addLoginDao).toHaveBeenCalledTimes(1);

      expect(db.commit).toHaveBeenCalledTimes(1);

      expect(db.rollback).not.toHaveBeenCalled();
    });

    test("should cache session after login", async () => {
      await loginService(
        loginPayload,
        "127.0.0.1",
        ua
      );

      expect(redis.buildAuthSessionCacheKey).toHaveBeenCalledWith({
        user_id: 1,
        company_id: 100,
        session_id: "session-123",
      });

      expect(redis.setCachedData).toHaveBeenCalledWith(
        "cache-key",
        {
          session_id: "session-123",
          is_two_factor_enabled: false,
          is_two_factor_exempt: false,
        },
        3600,
        "Auth session cache"
      );
    });

    test("should filter user before returning", async () => {
      await loginService(
        loginPayload,
        "127.0.0.1",
        ua
      );

      expect(helper.filterResponse).toHaveBeenCalledWith(
        user,
        expect.any(Object),
        {
          stripSensitive: true,
        }
      );
    });

    test("should return first login response", async () => {
      user.config.isLoginFirst = true;

      userDao.getUsersByUserNameDao.mockResolvedValue(user);

      const result = await loginService(
        loginPayload,
        "127.0.0.1",
        ua
      );

      expect(result).toEqual({
        id: 1,
        isLoginFirst: true,
      });

      expect(db.getConnection).not.toHaveBeenCalled();

      expect(authDao.addLoginDao).not.toHaveBeenCalled();

      expect(redis.setCachedData).not.toHaveBeenCalled();
    });

    test("should release connection after successful login", async () => {
      await loginService(
        loginPayload,
        "127.0.0.1",
        ua
      );

      expect(conn.release).toHaveBeenCalledTimes(1);
    });

    test("should commit transaction once", async () => {
      await loginService(
        loginPayload,
        "127.0.0.1",
        ua
      );

      expect(db.commit).toHaveBeenCalledTimes(1);

      expect(db.rollback).not.toHaveBeenCalled();
    });
  });

  describe("loginService - additional cases", () => {
    beforeEach(() => jest.clearAllMocks());

    test("should throw NotFoundError when user does not exist", async () => {
      userDao.getUsersByUserNameDao.mockResolvedValueOnce(null);

      await expect(
        loginService({ user_name: "x", password: "p" })
      ).rejects.toThrow();
    });

    test("should throw NotFoundError when user is disabled", async () => {
      userDao.getUsersByUserNameDao.mockResolvedValueOnce({
        is_enabled: false,
      });

      await expect(
        loginService({ user_name: "x", password: "p" })
      ).rejects.toThrow();
    });

    test("should return first login response when isLoginFirst is true", async () => {
      userDao.getUsersByUserNameDao.mockResolvedValueOnce({
        user_id: 1,
        isLoginFirst: true,
      });

      const res = await loginService({
        user_name: "x",
        password: "p",
      });

      expect(res.isLoginFirst).toBe(true);
    });

    test("should return preAuthToken when 2FA enabled", async () => {
      userDao.getUsersByUserNameDao.mockResolvedValueOnce({
        user_id: 1,
        two_factor_enabled: true,
      });

      const res = await loginService({
        user_name: "x",
        password: "p",
      });

      expect(res).toHaveProperty("preAuthToken");
    });

    test("should create session on success", async () => {
      userDao.getUsersByUserNameDao.mockResolvedValueOnce({
        user_id: 1,
        is_enabled: true,
        password: "hashed",
      });

      bcrypt.verifyHash.mockReturnValueOnce(true);

      authDao.addLoginDao.mockResolvedValueOnce({
        session_id: "s1",
      });

      const res = await loginService({
        user_name: "x",
        password: "p",
      });

      expect(res).toBeDefined();
    });
  });
  
  describe("loginService - Password Change & 2FA", () => {
    beforeEach(() => {
      jest.clearAllMocks();

      userDao.getUsersByUserNameDao.mockResolvedValue(user);

      bcrypt.verifyHash.mockResolvedValue(true);
      bcrypt.createHash.mockResolvedValue("new-hashed-password");

      settingsDao.get2FAEnforcementDao.mockResolvedValue(false);

      auth.generateUserToken.mockReturnValue({
        accessToken: "access-token",
        refreshToken: "refresh-token",
      });

      uuid.generateUUID.mockReturnValue("session-123");

      hashUtils.createHash.mockReturnValue("hashed-refresh-token");

      helper.filterResponse.mockImplementation((u) => ({
        id: u.id,
        user_name: u.user_name,
      }));

      db.getConnection.mockResolvedValue(conn);
      db.beginTransaction.mockResolvedValue();
      db.commit.mockResolvedValue();

      authDao.deleteUserSessionsDao.mockResolvedValue();

      authDao.addLoginDao.mockResolvedValue({
        id: 1,
        session_id: "session-123",
      });

      redis.setCachedData.mockResolvedValue();
    });

    test("should login successfully after password change", async () => {
      loginPayload.newPassword = "NewPassword@123";

      user.config.isLoginFirst = true;

      userDao.updateUserDao.mockResolvedValue(true);

      const result = await loginService(
        loginPayload,
        "127.0.0.1",
        ua
      );

      expect(bcrypt.verifyHash).toHaveBeenCalledWith(
        loginPayload.password,
        user.password
      );

      expect(bcrypt.createHash).toHaveBeenCalledWith(
        loginPayload.newPassword
      );

      expect(userDao.updateUserDao).toHaveBeenCalledWith(
        { id: user.id },
        {
          password: "new-hashed-password",
          config: {
            ...user.config,
            isLoginFirst: false,
          },
        },
        conn
      );

      expect(authDao.deleteUserSessionsDao).toHaveBeenCalled();

      expect(authDao.addLoginDao).toHaveBeenCalled();

      expect(db.commit).toHaveBeenCalled();

      expect(result.tokenInfo.accessToken).toBe("access-token");

      expect(result.refreshToken).toBe("refresh-token");

      expect(result.sessionId).toBe("session-123");
    });

    test("should hash new password once", async () => {
      loginPayload.newPassword = "new-password";

      user.config.isLoginFirst = true;

      userDao.updateUserDao.mockResolvedValue(true);

      await loginService(
        loginPayload,
        "127.0.0.1",
        ua
      );

      expect(bcrypt.createHash).toHaveBeenCalledTimes(1);
    });

    test("should update user password only once", async () => {
      loginPayload.newPassword = "Password123";

      user.config.isLoginFirst = true;

      userDao.updateUserDao.mockResolvedValue(true);

      await loginService(
        loginPayload,
        "127.0.0.1",
        ua
      );

      expect(userDao.updateUserDao).toHaveBeenCalledTimes(1);
    });

    test("should return preAuthToken when user has 2FA enabled", async () => {
      user.is_two_factor_enabled = true;

      auth.generatePreAuthToken.mockReturnValue("pre-auth-token");

      const result = await loginService(
        loginPayload,
        "127.0.0.1",
        ua
      );

      expect(auth.generatePreAuthToken).toHaveBeenCalledWith({
        user_id: user.id,
        user_name: user.user_name,
      });

      expect(result).toEqual({
        twoFactorRequired: true,
        preAuthToken: "pre-auth-token",
        two_factor_enforcement: false,
      });

      expect(db.getConnection).not.toHaveBeenCalled();

      expect(authDao.addLoginDao).not.toHaveBeenCalled();

      expect(redis.setCachedData).not.toHaveBeenCalled();
    });

    test("should generate preAuthToken only once", async () => {
      user.is_two_factor_enabled = true;

      auth.generatePreAuthToken.mockReturnValue("jwt-pre-auth");

      await loginService(
        loginPayload,
        "127.0.0.1",
        ua
      );

      expect(auth.generatePreAuthToken).toHaveBeenCalledTimes(1);
    });

    test("should not create session when 2FA is enabled", async () => {
      user.is_two_factor_enabled = true;

      auth.generatePreAuthToken.mockReturnValue("jwt");

      await loginService(
        loginPayload,
        "127.0.0.1",
        ua
      );

      expect(authDao.deleteUserSessionsDao).not.toHaveBeenCalled();

      expect(authDao.addLoginDao).not.toHaveBeenCalled();

      expect(redis.setCachedData).not.toHaveBeenCalled();

      expect(sockets.forceLogoutUser).not.toHaveBeenCalled();
    });

    test("should not commit transaction for pre-auth flow", async () => {
      user.is_two_factor_enabled = true;

      auth.generatePreAuthToken.mockReturnValue("jwt");

      await loginService(
        loginPayload,
        "127.0.0.1",
        ua
      );

      expect(db.beginTransaction).not.toHaveBeenCalled();

      expect(db.commit).not.toHaveBeenCalled();

      expect(db.rollback).not.toHaveBeenCalled();
    });
  });

  describe("loginService - Company Enforced 2FA", () => {
    beforeEach(() => {
      jest.clearAllMocks();

      userDao.getUsersByUserNameDao.mockResolvedValue(user);

      bcrypt.verifyHash.mockResolvedValue(true);

      settingsDao.get2FAEnforcementDao.mockResolvedValue(true);

      auth.generateUserToken.mockReturnValue({
        accessToken: "access-token",
        refreshToken: "refresh-token",
      });

      uuid.generateUUID.mockReturnValue("session-123");

      hashUtils.createHash.mockReturnValue("hashed-refresh-token");

      helper.filterResponse.mockImplementation((u) => ({
        id: u.id,
        user_name: u.user_name,
      }));

      db.getConnection.mockResolvedValue(conn);

      db.beginTransaction.mockResolvedValue();

      db.commit.mockResolvedValue();

      authDao.deleteUserSessionsDao.mockResolvedValue();

      authDao.addLoginDao.mockResolvedValue({
        id: 1,
        session_id: "session-123",
      });

      redis.setCachedData.mockResolvedValue();
    });

    test("should create limited session when company enforces 2FA", async () => {
      user.is_two_factor_enabled = false;
      user.is_two_factor_exempt = false;

      const result = await loginService(
        loginPayload,
        "127.0.0.1",
        ua
      );

      expect(db.beginTransaction).toHaveBeenCalledWith(conn);

      expect(authDao.deleteUserSessionsDao).toHaveBeenCalledWith(
        user.id,
        user.company_id,
        null,
        conn
      );

      expect(authDao.addLoginDao).toHaveBeenCalled();

      expect(db.commit).toHaveBeenCalledWith(conn);

      expect(redis.setCachedData).toHaveBeenCalled();

      expect(sockets.forceLogoutUser).toHaveBeenCalledWith(
        user.id,
        null,
        "session-123"
      );

      expect(result.must_setup_2fa).toBe(true);

      expect(result.two_factor_enforcement).toBe(true);

      expect(result.sessionId).toBe("session-123");

      expect(result.refreshToken).toBe("refresh-token");
    });

    test("should cache limited auth session", async () => {
      user.is_two_factor_enabled = false;
      user.is_two_factor_exempt = false;

      await loginService(
        loginPayload,
        "127.0.0.1",
        ua
      );

      expect(redis.buildAuthSessionCacheKey).toHaveBeenCalledWith({
        user_id: user.id,
        company_id: user.company_id,
        session_id: "session-123",
      });

      expect(redis.setCachedData).toHaveBeenCalledWith(
        "cache-key",
        {
          session_id: "session-123",
          is_two_factor_enabled: false,
          is_two_factor_exempt: false,
        },
        redis.AUTH_SESSION_CACHE_TTL_SEC,
        "Auth session cache"
      );
    });

    test("should generate access token for limited session", async () => {
      user.is_two_factor_enabled = false;
      user.is_two_factor_exempt = false;

      await loginService(
        loginPayload,
        "127.0.0.1",
        ua
      );

      expect(auth.generateUserToken).toHaveBeenCalledWith(
        user,
        "session-123"
      );
    });

    test("should hash refresh token before saving session", async () => {
      user.is_two_factor_enabled = false;
      user.is_two_factor_exempt = false;

      await loginService(
        loginPayload,
        "127.0.0.1",
        ua
      );

      expect(hashUtils.createHash).toHaveBeenCalledWith(
        "refresh-token"
      );
    });

    test("should commit transaction only once", async () => {
      user.is_two_factor_enabled = false;
      user.is_two_factor_exempt = false;

      await loginService(
        loginPayload,
        "127.0.0.1",
        ua
      );

      expect(db.commit).toHaveBeenCalledTimes(1);

      expect(db.rollback).not.toHaveBeenCalled();
    });

    test("should release connection after success", async () => {
      user.is_two_factor_enabled = false;
      user.is_two_factor_exempt = false;

      await loginService(
        loginPayload,
        "127.0.0.1",
        ua
      );

      expect(conn.release).toHaveBeenCalled();
    });

    test("should skip must_setup_2fa when user is exempt", async () => {
      user.is_two_factor_enabled = false;
      user.is_two_factor_exempt = true;

      const result = await loginService(
        loginPayload,
        "127.0.0.1",
        ua
      );

      expect(result.must_setup_2fa).toBe(false);

      expect(authDao.addLoginDao).toHaveBeenCalled();

      expect(redis.setCachedData).toHaveBeenCalled();
    });

    test("should skip must_setup_2fa when user already enabled 2FA", async () => {
      user.is_two_factor_enabled = true;
      user.is_two_factor_exempt = false;

      auth.generatePreAuthToken.mockReturnValue("pre-auth");

      const result = await loginService(
        loginPayload,
        "127.0.0.1",
        ua
      );

      expect(result.twoFactorRequired).toBe(true);

      expect(result.preAuthToken).toBe("pre-auth");

      expect(authDao.addLoginDao).not.toHaveBeenCalled();
    });

    test("should build filtered user response", async () => {
      user.is_two_factor_enabled = false;
      user.is_two_factor_exempt = false;

      const result = await loginService(
        loginPayload,
        "127.0.0.1",
        ua
      );

      expect(helper.filterResponse).toHaveBeenCalled();

      expect(result.user).toEqual({
        id: user.id,
        user_name: user.user_name,
      });
    });
  });

  describe("loginService - Error Cases", () => {
    beforeEach(() => {
      jest.clearAllMocks();

      db.getConnection.mockResolvedValue(conn);
      db.beginTransaction.mockResolvedValue();
      db.commit.mockResolvedValue();
      db.rollback.mockResolvedValue();

      conn.release = jest.fn();

      bcrypt.verifyHash.mockResolvedValue(true);

      settingsDao.get2FAEnforcementDao.mockResolvedValue(false);

      uuid.generateUUID.mockReturnValue("session-123");

      auth.generateUserToken.mockReturnValue({
        accessToken: "access-token",
        refreshToken: "refresh-token",
      });

      hashUtils.createHash.mockReturnValue("hashed-refresh-token");

      helper.filterResponse.mockReturnValue({
        id: user.id,
      });

      authDao.deleteUserSessionsDao.mockResolvedValue();

      authDao.addLoginDao.mockResolvedValue({
        session_id: "session-123",
      });

      redis.setCachedData.mockResolvedValue();
    });

    test("should throw when user is not found", async () => {
      userDao.getUsersByUserNameDao.mockResolvedValue(null);

      await expect(
        loginService(loginPayload, "127.0.0.1", ua)
      ).rejects.toThrow("User Not Found.");

      expect(userDao.getUsersByUserNameDao).toHaveBeenCalled();
    });

    test("should throw when user is disabled", async () => {
      userDao.getUsersByUserNameDao.mockResolvedValue({
        ...user,
        is_enabled: false,
      });

      await expect(
        loginService(loginPayload, "127.0.0.1", ua)
      ).rejects.toThrow("User not active");

      expect(db.getConnection).not.toHaveBeenCalled();
    });

    test("should throw when password is incorrect", async () => {
      userDao.getUsersByUserNameDao.mockResolvedValue(user);

      bcrypt.verifyHash.mockResolvedValue(false);

      await expect(
        loginService(loginPayload, "127.0.0.1", ua)
      ).rejects.toThrow();

      expect(bcrypt.verifyHash).toHaveBeenCalled();
    });

    test("should reject admin login when unique_admin_id missing", async () => {
      user.designation = "ADMIN";

      user.company_config.unique_admin_id = "ADMIN001";

      delete loginPayload.unique_admin_id;

      userDao.getUsersByUserNameDao.mockResolvedValue(user);

      await expect(
        loginService(loginPayload, "127.0.0.1", ua)
      ).rejects.toThrow(
        "Unique admin ID is required for admin login."
      );
    });

    test("should reject admin when unique_admin_id mismatches", async () => {
      user.designation = "ADMIN";

      user.company_config.unique_admin_id = "ADMIN001";

      loginPayload.unique_admin_id = "WRONG";

      userDao.getUsersByUserNameDao.mockResolvedValue(user);

      await expect(
        loginService(loginPayload, "127.0.0.1", ua)
      ).rejects.toThrow(
        "You are not authorized to access this account."
      );
    });

    test("should rollback when updateUserDao fails", async () => {
      loginPayload.newPassword = "newPassword";

      user.config.isLoginFirst = true;

      userDao.getUsersByUserNameDao.mockResolvedValue(user);

      bcrypt.createHash.mockResolvedValue("hashed");

      userDao.updateUserDao.mockRejectedValue(
        new Error("update failed")
      );

      await expect(
        loginService(loginPayload, "127.0.0.1", ua)
      ).rejects.toThrow("update failed");

      expect(db.rollback).toHaveBeenCalled();

      expect(conn.release).toHaveBeenCalled();
    });

    test("should rollback when deleteUserSessionsDao fails", async () => {
      userDao.getUsersByUserNameDao.mockResolvedValue(user);

      authDao.deleteUserSessionsDao.mockRejectedValue(
        new Error("delete failed")
      );

      await expect(
        loginService(loginPayload, "127.0.0.1", ua)
      ).rejects.toThrow("delete failed");

      expect(db.rollback).toHaveBeenCalled();

      expect(conn.release).toHaveBeenCalled();
    });

    test("should rollback when addLoginDao fails", async () => {
      userDao.getUsersByUserNameDao.mockResolvedValue(user);

      authDao.addLoginDao.mockRejectedValue(
        new Error("insert failed")
      );

      await expect(
        loginService(loginPayload, "127.0.0.1", ua)
      ).rejects.toThrow("insert failed");

      expect(db.rollback).toHaveBeenCalled();

      expect(conn.release).toHaveBeenCalled();
    });

    test("should rollback when commit fails", async () => {
      userDao.getUsersByUserNameDao.mockResolvedValue(user);

      db.commit.mockRejectedValue(
        new Error("commit failed")
      );

      await expect(
        loginService(loginPayload, "127.0.0.1", ua)
      ).rejects.toThrow("commit failed");

      expect(db.rollback).toHaveBeenCalled();

      expect(conn.release).toHaveBeenCalled();
    });

    test("should throw when cache update fails", async () => {
      userDao.getUsersByUserNameDao.mockResolvedValue(user);

      redis.setCachedData.mockRejectedValue(
        new Error("redis error")
      );

      await expect(
        loginService(loginPayload, "127.0.0.1", ua)
      ).rejects.toThrow("redis error");

      expect(conn.release).toHaveBeenCalled();
    });

    test("should log login errors", async () => {
      userDao.getUsersByUserNameDao.mockRejectedValue(
        new Error("database error")
      );

      await expect(
        loginService(loginPayload, "127.0.0.1", ua)
      ).rejects.toThrow("database error");

      expect(loggerModule.logger.error).toHaveBeenCalled();
    });

    test("should always release db connection", async () => {
      userDao.getUsersByUserNameDao.mockResolvedValue(user);

      await loginService(loginPayload, "127.0.0.1", ua);

      expect(conn.release).toHaveBeenCalledTimes(1);
    });
  });

  describe("refreshTokenService", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test("should return session when refresh token is valid", async () => {
      const session = {
        session_id: "session-123",
        config: JSON.stringify({
          token: {
            refresh_token: "hashed-refresh-token",
          },
        }),
      };

      authDao.getSessionByIdDao.mockResolvedValue(session);

      hashUtils.compareHash.mockReturnValue(true);

      const result = await refreshTokenService(
        1,
        10,
        "refresh-token"
      );

      expect(authDao.getSessionByIdDao).toHaveBeenCalledWith({
        user_id: 1,
        company_id: 10,
      });

      expect(hashUtils.compareHash).toHaveBeenCalledWith(
        "refresh-token",
        "hashed-refresh-token"
      );

      expect(result).toEqual(session);
    });

    test("should throw AuthenticationError when session not found", async () => {
      authDao.getSessionByIdDao.mockResolvedValue(undefined);

      await expect(
        refreshTokenService(1, 10, "refresh-token")
      ).rejects.toThrow("No active session found");

      expect(authDao.getSessionByIdDao).toHaveBeenCalledTimes(1);
    });

    test("should throw AuthenticationError when refresh token is invalid", async () => {
      authDao.getSessionByIdDao.mockResolvedValue({
        config: JSON.stringify({
          token: {
            refresh_token: "hashed-token",
          },
        }),
      });

      hashUtils.compareHash.mockReturnValue(false);

      await expect(
        refreshTokenService(1, 10, "wrong-token")
      ).rejects.toThrow("Invalid refresh token");

      expect(hashUtils.compareHash).toHaveBeenCalled();
    });

    test("should parse session config correctly", async () => {
      const session = {
        config: JSON.stringify({
          token: {
            refresh_token: "hash123",
          },
        }),
      };

      authDao.getSessionByIdDao.mockResolvedValue(session);

      hashUtils.compareHash.mockReturnValue(true);

      await refreshTokenService(
        5,
        20,
        "refresh"
      );

      expect(hashUtils.compareHash).toHaveBeenCalledWith(
        "refresh",
        "hash123"
      );
    });

    test("should propagate DAO errors", async () => {
      authDao.getSessionByIdDao.mockRejectedValue(
        new Error("Database Error")
      );

      await expect(
        refreshTokenService(1, 1, "token")
      ).rejects.toThrow("Database Error");
    });

    test("should propagate compareHash errors", async () => {
      authDao.getSessionByIdDao.mockResolvedValue({
        config: JSON.stringify({
          token: {
            refresh_token: "hash",
          },
        }),
      });

      hashUtils.compareHash.mockImplementation(() => {
        throw new Error("Hash Error");
      });

      await expect(
        refreshTokenService(1, 1, "token")
      ).rejects.toThrow("Hash Error");
    });

    test("should call logger when error occurs", async () => {
      authDao.getSessionByIdDao.mockRejectedValue(
        new Error("DB Failed")
      );

      await expect(
        refreshTokenService(1, 1, "token")
      ).rejects.toThrow();

      expect(loggerModule.logger.log).toHaveBeenCalled();
    });

    test("should call compareHash exactly once", async () => {
      authDao.getSessionByIdDao.mockResolvedValue({
        config: JSON.stringify({
          token: {
            refresh_token: "hash",
          },
        }),
      });

      hashUtils.compareHash.mockReturnValue(true);

      await refreshTokenService(
        1,
        1,
        "refresh-token"
      );

      expect(hashUtils.compareHash).toHaveBeenCalledTimes(1);
    });

    test("should call getSessionByIdDao exactly once", async () => {
      authDao.getSessionByIdDao.mockResolvedValue({
        config: JSON.stringify({
          token: {
            refresh_token: "hash",
          },
        }),
      });

      hashUtils.compareHash.mockReturnValue(true);

      await refreshTokenService(
        99,
        88,
        "refresh"
      );

      expect(authDao.getSessionByIdDao).toHaveBeenCalledTimes(1);
    });

    test("should return original session object", async () => {
      const session = {
        session_id: "abc",
        config: JSON.stringify({
          token: {
            refresh_token: "hash",
          },
        }),
        custom: "value",
      };

      authDao.getSessionByIdDao.mockResolvedValue(session);

      hashUtils.compareHash.mockReturnValue(true);

      const result = await refreshTokenService(
        1,
        2,
        "refresh"
      );

      expect(result).toBe(session);
    });
  });

  describe("refreshTokenService - additional cases", () => {
    beforeEach(() => jest.clearAllMocks());

    test("should throw AuthenticationError when session not found", async () => {
      authDao.getSessionByIdDao.mockResolvedValueOnce(null);

      await expect(refreshTokenService(1, 2, "t")).rejects.toThrow();
    });

    test("should handle invalid JSON config", async () => {
      authDao.getSessionByIdDao.mockResolvedValueOnce({
        config: "invalid-json",
      });

      await expect(refreshTokenService(1, 2, "t")).rejects.toThrow();
    });

    test("should return session object on success", async () => {
      authDao.getSessionByIdDao.mockResolvedValueOnce({
        config: JSON.stringify({ token: {} }),
      });

      const res = await refreshTokenService(1, 2, "t");

      expect(res).toBeDefined();
    });
  });

  describe("logoutService", () => {
    beforeEach(() => {
      jest.clearAllMocks();

      authDao.deleteUserSessionsDao.mockResolvedValue([
        { session_id: "session-123" },
      ]);

      redis.buildAuthSessionCacheKey.mockReturnValue("auth-cache-key");

      redis.deleteCachedData.mockResolvedValue(true);

      sockets.logOutUser.mockResolvedValue(true);
    });

    const decodeToken = {
      user_id: 1,
      company_id: 10,
      session_id: "session-123",
    };

    test("should logout successfully with session_id", async () => {
      const result = await logoutService(
        decodeToken,
        "session-123"
      );

      expect(authDao.deleteUserSessionsDao).toHaveBeenCalledWith(
        1,
        10,
        "session-123"
      );

      expect(redis.buildAuthSessionCacheKey).toHaveBeenCalledWith({
        user_id: 1,
        company_id: 10,
        session_id: "session-123",
      });

      expect(redis.deleteCachedData).toHaveBeenCalledWith(
        "auth-cache-key",
        "Auth session cache"
      );

      expect(sockets.logOutUser).toHaveBeenCalledWith(
        1,
        "session-123"
      );

      expect(result).toEqual([
        {
          session_id: "session-123",
        },
      ]);
    });

    test("should logout using decoded session when session_id is null", async () => {
      await logoutService(decodeToken);

      expect(redis.buildAuthSessionCacheKey).toHaveBeenCalledWith({
        user_id: 1,
        company_id: 10,
        session_id: "session-123",
      });
    });

    test("should delete all sessions when session_id is null", async () => {
      await logoutService(decodeToken, null);

      expect(authDao.deleteUserSessionsDao).toHaveBeenCalledWith(
        1,
        10,
        null
      );
    });

    test("should delete cache exactly once", async () => {
      await logoutService(decodeToken, "session-123");

      expect(redis.deleteCachedData).toHaveBeenCalledTimes(1);
    });

    test("should emit logout socket event", async () => {
      await logoutService(decodeToken, "session-123");

      expect(sockets.logOutUser).toHaveBeenCalledTimes(1);
    });

    test("should return dao response", async () => {
      const response = [
        {
          id: 1,
        },
      ];

      authDao.deleteUserSessionsDao.mockResolvedValue(response);

      const result = await logoutService(
        decodeToken,
        "session-123"
      );

      expect(result).toBe(response);
    });

    test("should continue even if socket logout rejects", async () => {
      sockets.logOutUser.mockRejectedValue(
        new Error("Socket Error")
      );

      const result = await logoutService(
        decodeToken,
        "session-123"
      );

      expect(result).toEqual([
        {
          session_id: "session-123",
        },
      ]);

      expect(loggerModule.logger.warn).toHaveBeenCalled();
    });

    test("should throw when deleteUserSessionsDao fails", async () => {
      authDao.deleteUserSessionsDao.mockRejectedValue(
        new Error("DAO Error")
      );

      await expect(
        logoutService(decodeToken, "session-123")
      ).rejects.toThrow("DAO Error");

      expect(loggerModule.logger.error).toHaveBeenCalled();
    });

    test("should throw when deleteCachedData fails", async () => {
      redis.deleteCachedData.mockRejectedValue(
        new Error("Redis Error")
      );

      await expect(
        logoutService(decodeToken, "session-123")
      ).rejects.toThrow("Redis Error");

      expect(loggerModule.logger.error).toHaveBeenCalled();
    });

    test("should build cache key correctly", async () => {
      await logoutService(decodeToken, "ABC");

      expect(redis.buildAuthSessionCacheKey).toHaveBeenCalledWith({
        user_id: 1,
        company_id: 10,
        session_id: "ABC",
      });
    });

    test("should call deleteUserSessionsDao only once", async () => {
      await logoutService(decodeToken, "session-123");

      expect(authDao.deleteUserSessionsDao).toHaveBeenCalledTimes(1);
    });

    test("should call deleteCachedData only once", async () => {
      await logoutService(decodeToken, "session-123");

      expect(redis.deleteCachedData).toHaveBeenCalledTimes(1);
    });

    test("should call logOutUser only once", async () => {
      await logoutService(decodeToken, "session-123");

      expect(sockets.logOutUser).toHaveBeenCalledTimes(1);
    });
  });

  describe("logoutService - additional cases", () => {
    beforeEach(() => jest.clearAllMocks());

    test("should delete session by session_id", async () => {
      authDao.deleteUserSessionsDao.mockResolvedValueOnce(true);

      await logoutService({ user_id: 1 }, "s1");

      expect(authDao.deleteUserSessionsDao).toHaveBeenCalled();
    });

    test("should delete all sessions when session_id null", async () => {
      authDao.deleteUserSessionsDao.mockResolvedValueOnce(true);

      await logoutService({ user_id: 1 }, null);

      expect(authDao.deleteUserSessionsDao).toHaveBeenCalled();
    });

    test("should not block if socket fails", async () => {
      sockets.logOutUser.mockRejectedValueOnce(new Error("socket fail"));

      authDao.deleteUserSessionsDao.mockResolvedValueOnce(true);

      await expect(
        logoutService({ user_id: 1 }, "s1")
      ).resolves.not.toThrow();
    });
  });

  describe("changePasswordService", () => {

    beforeEach(() => {
      jest.clearAllMocks();

      bcrypt.createHash.mockResolvedValue("hashed-password");

      authDao.changePasswordDao.mockResolvedValue({ id: 1 });

      authDao.getUserAuthPasswordDao.mockResolvedValue({
        user_id: 1,
        user_name: "admin",
        password: "hashed-password",
      });

      bcrypt.verifyHash.mockReturnValue(true);
    });

    const payload = {
      user_id: 1,
      user_name: "admin",
      oldPassword: "OldPassword123",
      password: "NewPassword123",
    };

    test("should change password successfully", async () => {

      const result = await changePasswordService(payload);

      expect(bcrypt.createHash).toHaveBeenCalledWith(payload.password);

      expect(authDao.changePasswordDao).toHaveBeenCalledWith(
        payload.user_id,
        "hashed-password"
      );

      expect(result).toEqual({ id: 1 });
    });

    test("should hash new password once", async () => {

      await changePasswordService(payload);

      expect(bcrypt.createHash).toHaveBeenCalledTimes(1);
    });

    test("should call verificationService once", async () => {

      await changePasswordService(payload);

      // ❗ cannot spy on internal function in ESM
      expect(authDao.getUserAuthPasswordDao).toHaveBeenCalledTimes(1);
    });

    test("should call changePasswordDao once", async () => {

      await changePasswordService(payload);

      expect(authDao.changePasswordDao).toHaveBeenCalledTimes(1);
    });

    test("should throw AuthenticationError when verification fails", async () => {

      bcrypt.verifyHash.mockReturnValue(false);

      await expect(
        changePasswordService(payload)
      ).rejects.toThrow("Invalid password");

      expect(authDao.changePasswordDao).not.toHaveBeenCalled();
    });

    test("should propagate verificationService error", async () => {

      authDao.getUserAuthPasswordDao.mockRejectedValue(
        new Error("Verification Failed")
      );

      await expect(
        changePasswordService(payload)
      ).rejects.toThrow("Verification Failed");

      expect(authDao.changePasswordDao).not.toHaveBeenCalled();
    });

    test("should propagate createHash error", async () => {

      bcrypt.createHash.mockRejectedValue(
        new Error("Hash Error")
      );

      await expect(
        changePasswordService(payload)
      ).rejects.toThrow("Hash Error");

      expect(authDao.changePasswordDao).not.toHaveBeenCalled();
    });

    test("should propagate dao error", async () => {

      authDao.changePasswordDao.mockRejectedValue(
        new Error("Database Error")
      );

      await expect(
        changePasswordService(payload)
      ).rejects.toThrow("Database Error");

      expect(loggerModule.logger.error).toHaveBeenCalled();
    });

    test("should log errors", async () => {

      authDao.getUserAuthPasswordDao.mockRejectedValue(
        new Error("Unexpected Error")
      );

      await expect(
        changePasswordService(payload)
      ).rejects.toThrow();

      expect(loggerModule.logger.error).toHaveBeenCalledTimes(2);
    });

    test("should return dao response", async () => {

      const daoResponse = {
        id: 99,
        updated: true,
      };

      authDao.changePasswordDao.mockResolvedValue(daoResponse);

      const result = await changePasswordService(payload);

      expect(result).toBe(daoResponse);
    });

    test("should verify old password before hashing", async () => {

      let order = [];

      authDao.getUserAuthPasswordDao.mockImplementation(async () => {
        order.push("verify");
        return {
          user_id: 1,
          user_name: "admin",
          password: "hashed-password",
        };
      });

      bcrypt.createHash.mockImplementation(async () => {
        order.push("hash");
        return "hashed-password";
      });

      await changePasswordService(payload);

      expect(order).toEqual(["verify", "hash"]);
    });

    test("should hash password before updating database", async () => {

      await changePasswordService(payload);

      expect(bcrypt.createHash).toHaveBeenCalled();

      expect(authDao.changePasswordDao).toHaveBeenCalledWith(
        payload.user_id,
        "hashed-password"
      );
    });
  });

  describe("changePasswordService - additional cases", () => {
    beforeEach(() => jest.clearAllMocks());

    test("should verify old password first", async () => {
      bcrypt.verifyHash.mockReturnValueOnce(true);
      authDao.changePasswordDao.mockResolvedValueOnce({ user_id: 1 });

      const res = await changePasswordService({
        user_id: 1,
        oldPassword: "a",
        password: "b",
      });

      expect(res).toBeDefined();
    });

    test("should throw when old password invalid", async () => {
      bcrypt.verifyHash.mockReturnValueOnce(false);

      await expect(
        changePasswordService({
          user_id: 1,
          oldPassword: "a",
          password: "b",
        })
      ).rejects.toThrow();
    });
  });

  describe("verificationService - additional cases", () => {
    beforeEach(() => jest.clearAllMocks());

    test("should throw when user not found", async () => {
      authDao.getUserAuthPasswordDao.mockResolvedValueOnce(null);

      await expect(
        verificationService({ user_id: 1 }, { password: "x" })
      ).rejects.toThrow();
    });

    test("should return user details on success", async () => {
      authDao.getUserAuthPasswordDao.mockResolvedValueOnce({
        user_id: 1,
        password: "hashed",
      });

      bcrypt.verifyHash.mockReturnValueOnce(true);

      const res = await verificationService(
        { user_id: 1 },
        { password: "x" }
      );

      expect(res).toBeDefined();
    });
  });

  describe("forgetPasswordService - additional cases", () => {
    beforeEach(() => jest.clearAllMocks());

    test("should hash password before update", async () => {
      bcrypt.createHash.mockReturnValueOnce("hashed");

      userDao.updateUserDao.mockResolvedValueOnce({ user_id: 1 });

      const res = await forgetPasswordService({
        user_id: 1,
        password: "new",
      });

      expect(res).toBeDefined();
    });

    test("should handle DAO failure", async () => {
      userDao.updateUserDao.mockRejectedValueOnce(new Error("db"));

      await expect(
        forgetPasswordService({ user_id: 1, password: "x" })
      ).rejects.toThrow();
    });
  });

  describe("verfyUserService - additional cases", () => {
    beforeEach(() => jest.clearAllMocks());

    test("should generate OTP", async () => {
      userDao.getUsersByUserNameDao.mockResolvedValueOnce({
        user_id: 1,
        email: "a@b.com",
      });

      const res = await verfyUserService("john");

      expect(res).toBeDefined();
      expect(hashUtils.createHash).toBeDefined();
    });

    test("should throw when user not found", async () => {
      userDao.getUsersByUserNameDao.mockResolvedValueOnce(null);

      await expect(verfyUserService("john")).rejects.toThrow();
    });
  });

  describe("verfyOtpService - additional cases", () => {
    beforeEach(() => jest.clearAllMocks());

    test("should throw when OTP not found", async () => {
      userOtpDao.getUserOtpDao.mockResolvedValueOnce(null);

      await expect(verfyOtpService("123")).rejects.toThrow();
    });

    test("should mark OTP as used", async () => {
      userOtpDao.getUserOtpDao.mockResolvedValueOnce({
        otp: "123",
        is_used: false,
      });

      const res = await verfyOtpService("123");

      expect(res).toBeDefined();
    });
  });

  describe("getUserRoleService - additional cases", () => {
    beforeEach(() => jest.clearAllMocks());

    test("should return admin flag", async () => {
      authDao.getRoleByUserNameDao.mockResolvedValueOnce({
        role: "ADMIN",
      });

      const res = await getUserRoleService("john");

      expect(res).toBeDefined();
    });

    test("should return vendor flag", async () => {
      authDao.getRoleByUserNameDao.mockResolvedValueOnce({
        role: "VENDOR",
      });

      const res = await getUserRoleService("john");

      expect(res).toBeDefined();
    });
  });

  describe("verifyLoginOtpService - additional cases", () => {
    beforeEach(() => jest.clearAllMocks());

    test("should throw when preAuthToken invalid", async () => {
      auth.verifyPreAuthToken.mockReturnValueOnce(null);

      await expect(
        verifyLoginOtpService("bad", "123")
      ).rejects.toThrow();
    });

    test("should verify OTP using TOTP", async () => {
      auth.verifyPreAuthToken.mockReturnValueOnce({
        user_id: 1,
        secret: "sec",
      });

      sockets.forceLogoutUser.mockResolvedValueOnce();

      const res = await verifyLoginOtpService("token", "123");

      expect(res).toBeDefined();
    });
  });

  describe("setup2FAService", () => {
    test("should generate QR and secret", async () => {
      auth.generatePreAuthToken.mockReturnValueOnce("sec");

      const res = await setup2FAService(1, "john");

      expect(res).toBeDefined();
    });
  });

  describe("disable2FAService", () => {
    test("should disable 2FA successfully", async () => {
      userDao.disableTwoFactorDao.mockResolvedValueOnce(true);

      const res = await disable2FAService(1, "123456");

      expect(res).toBeDefined();
    });

    test("should throw when OTP invalid", async () => {
      await expect(
        disable2FAService(1, "000000")
      ).rejects.toThrow();
    });
  });

});
