import { jest } from "@jest/globals";

jest.unstable_mockModule("../../utils/responseHandlers.js", () => ({
  sendSuccess: jest.fn(),
}));

jest.unstable_mockModule("./userService.js", () => ({
  getUsersService: jest.fn(),
  getUsersNameService: jest.fn(),
  getUsersBySearchService: jest.fn(),
  getUsersInfoBySearchService: jest.fn(),
  getUserByIdService: jest.fn(),
  getUsersByUserNameService: jest.fn(),
  createUserService: jest.fn(),
  userUpdateService: jest.fn(),
  sendMailService: jest.fn(),
  updateUser2FAService: jest.fn(),
  toggleUser2FAExemptionService: jest.fn(),
  resetUser2FAService: jest.fn(),
}));

jest.unstable_mockModule("./userDao.js", () => ({
  getUsersContactDao: jest.fn(),
}));

jest.unstable_mockModule("../../schemas/userSchema.js", () => ({
  CREATE_USER_SCHEMA: {
    validate: jest.fn(),
  },
}));

jest.unstable_mockModule("../../utils/appErrors.js", () => ({
  BadRequestError: class BadRequestError extends Error {},
  ValidationError: class ValidationError extends Error {},
}));

jest.unstable_mockModule("../../utils/logger.js", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
  },
}));

jest.unstable_mockModule("../../utils/redishashkey.js", () => ({
  generateCacheKey: jest.fn(() => "cache-key"),
}));

jest.unstable_mockModule("../../utils/controllerCache.js", () => ({
  normalizeQueryForCache: jest.fn((q) => q),
  readJsonCache: jest.fn(),
  shouldServeCachedResponse: jest.fn(),
  writeJsonCache: jest.fn(),
  invalidateCompanyCacheByPrefix: jest.fn(),
}));

jest.unstable_mockModule("../../config/config.js", () => ({
  default: {
    controllerCacheTtls: {
      users: {
        list: 60,
        search: 60,
        byId: 60,
        byUsername: 60,
      },
    },
  },
}));

jest.unstable_mockModule("../../constants/index.js", () => ({
  Role: {
    ADMIN: "ADMIN",
    SUPER_ADMIN: "SUPER_ADMIN",
    MERCHANT: "MERCHANT",
  },
}));

const responseHandlers = await import(
  "../../utils/responseHandlers.js"
);

const userService = await import("./userService.js");

const cache = await import(
  "../../utils/controllerCache.js"
);

const redis = await import(
  "../../utils/redishashkey.js"
);

const loggerModule = await import(
  "../../utils/logger.js"
);

const userDao = await import("./userDao.js");

const schema = await import(
  "../../schemas/userSchema.js"
);

const { Role } = await import(
  "../../constants/index.js"
);

const {
  getUsers,
  getUsersnames,
  getUsersBySearch,
  getUsersInfoBySearch,
  getUsersByUserName,
  getUserById,
  createUser,
  updateUser,
  sendMail,
  toggleUser2FA,
  toggleUser2FAExemption,
  resetUser2FA,
} = await import("./userController.js");

const mockRes = {};

const mockUser = {
  company_id: 10,
  user_id: 1,
  user_name: "admin",
  role: Role.ADMIN,
  designation: Role.ADMIN,
  role_id: 1,
  designation_id: 1,
};
describe("User Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    cache.readJsonCache.mockResolvedValue(null);
    cache.shouldServeCachedResponse.mockReturnValue(false);
    cache.writeJsonCache.mockResolvedValue();

    responseHandlers.sendSuccess.mockReturnValue("success");
  });

  describe("getUsers", () => {
    it("should return cached users when cache exists", async () => {
      const cached = {
        rows: [{ id: 1 }],
        count: 1,
      };

      cache.readJsonCache.mockResolvedValue(cached);
      cache.shouldServeCachedResponse.mockReturnValue(true);

      const req = {
        user: mockUser,
        query: {
          page: 1,
          limit: 10,
        },
      };

      await getUsers(req, mockRes);

      expect(redis.generateCacheKey).toHaveBeenCalled();

      expect(cache.readJsonCache).toHaveBeenCalled();

      expect(userService.getUsersService).not.toHaveBeenCalled();

      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        cached,
        "getUsers successfully"
      );
    });

    it("should fetch users when cache misses", async () => {
      const users = {
        rows: [{ id: 10 }],
        count: 1,
      };

      userService.getUsersService.mockResolvedValue(users);

      const req = {
        user: mockUser,
        query: {
          page: 2,
          limit: 20,
          search: "john",
        },
      };

      await getUsers(req, mockRes);

      expect(userService.getUsersService).toHaveBeenCalledWith(
        {
          company_id: 10,
          page: 2,
          limit: 20,
          search: "john",
        },
        Role.ADMIN,
        2,
        20,
        Role.ADMIN,
        1
      );

      expect(cache.writeJsonCache).toHaveBeenCalledWith(
        expect.any(String),
        users,
        60
      );

      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        users,
        "getUsers successfully"
      );
    });

    it("should propagate service error", async () => {
      const error = new Error("Database failed");

      userService.getUsersService.mockRejectedValue(error);

      const req = {
        user: mockUser,
        query: {},
      };

      await expect(getUsers(req, mockRes)).rejects.toThrow(
        "Database failed"
      );
    });

    it("should generate cache key", async () => {
      userService.getUsersService.mockResolvedValue({});

      const req = {
        user: mockUser,
        query: {},
      };

      await getUsers(req, mockRes);

      expect(redis.generateCacheKey).toHaveBeenCalledTimes(1);

      expect(cache.normalizeQueryForCache).toHaveBeenCalled();
    });
  });

  describe("getUsersnames", () => {
    it("should return cached usernames", async () => {
      const cached = [
        {
          id: 1,
          user_name: "admin",
        },
      ];

      cache.readJsonCache.mockResolvedValue(cached);
      cache.shouldServeCachedResponse.mockReturnValue(true);

      const req = {
        user: mockUser,
        query: {},
      };

      await getUsersnames(req, mockRes);

      expect(userService.getUsersNameService).not.toHaveBeenCalled();

      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        cached,
        "getUsersName successfully"
      );
    });

    it("should fetch usernames when cache misses", async () => {
      const data = [
        {
          id: 1,
          user_name: "admin",
        },
      ];

      userService.getUsersNameService.mockResolvedValue(data);

      const req = {
        user: mockUser,
        query: {},
      };

      await getUsersnames(req, mockRes);

      expect(userService.getUsersNameService).toHaveBeenCalledWith({
        company_id: 10,
      });

      expect(cache.writeJsonCache).toHaveBeenCalledWith(
        expect.any(String),
        data,
        60
      );

      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        data,
        "getUsersname successfully"
      );
    });

    it("should propagate username service error", async () => {
      userService.getUsersNameService.mockRejectedValue(
        new Error("service failed")
      );

      const req = {
        user: mockUser,
        query: {},
      };

      await expect(getUsersnames(req, mockRes)).rejects.toThrow(
        "service failed"
      );
    });
  });

  describe("getUsersBySearch", () => {
    it("should return cached search result", async () => {
      const cached = {
        rows: [{ id: 1 }],
        count: 1,
      };

      cache.readJsonCache.mockResolvedValue(cached);
      cache.shouldServeCachedResponse.mockReturnValue(true);

      const req = {
        user: mockUser,
        query: {
          search: "john",
          page: 1,
          limit: 10,
        },
      };

      await getUsersBySearch(req, mockRes);

      expect(userService.getUsersBySearchService).not.toHaveBeenCalled();

      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        cached,
        "getUsers successfully"
      );
    });

    it("should fetch users by search when cache misses", async () => {
      const result = {
        rows: [{ id: 10 }],
        count: 1,
      };

      userService.getUsersBySearchService.mockResolvedValue(result);

      const req = {
        user: mockUser,
        query: {
          search: "admin",
          page: 2,
          limit: 20,
        },
      };

      await getUsersBySearch(req, mockRes);

      expect(userService.getUsersBySearchService).toHaveBeenCalledWith(
        {
          company_id: 10,
          search: "admin",
          page: 2,
          limit: 20,
        },
        Role.ADMIN,
        2,
        20,
        Role.ADMIN,
        1
      );

      expect(cache.writeJsonCache).toHaveBeenCalledWith(
        expect.any(String),
        result,
        60
      );

      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        result,
        "getUsers successfully"
      );
    });

    it("should generate cache key", async () => {
      userService.getUsersBySearchService.mockResolvedValue({});

      const req = {
        user: mockUser,
        query: {},
      };

      await getUsersBySearch(req, mockRes);

      expect(redis.generateCacheKey).toHaveBeenCalledTimes(1);
      expect(cache.normalizeQueryForCache).toHaveBeenCalled();
    });

    it("should propagate service error", async () => {
      userService.getUsersBySearchService.mockRejectedValue(
        new Error("search failed")
      );

      const req = {
        user: mockUser,
        query: {},
      };

      await expect(getUsersBySearch(req, mockRes)).rejects.toThrow(
        "search failed"
      );
    });
  });

  describe("getUsersInfoBySearch", () => {
    it("should return cached result", async () => {
      const cached = {
        rows: [{ id: 1 }],
      };

      cache.readJsonCache.mockResolvedValue(cached);
      cache.shouldServeCachedResponse.mockReturnValue(true);

      const req = {
        user: mockUser,
        query: {
          startDate: "2025-01-01",
          endDate: "2025-01-31",
        },
      };

      await getUsersInfoBySearch(req, mockRes);

      expect(userService.getUsersInfoBySearchService).not.toHaveBeenCalled();

      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        cached,
        "getUsersInfo successfully"
      );
    });

    it("should fetch user info when cache misses", async () => {
      const result = {
        rows: [{ id: 100 }],
      };

      userService.getUsersInfoBySearchService.mockResolvedValue(result);

      const req = {
        user: mockUser,
        query: {
          page: 1,
          limit: 10,
          startDate: "2025-01-01",
          endDate: "2025-01-31",
        },
      };

      await getUsersInfoBySearch(req, mockRes);

      expect(userService.getUsersInfoBySearchService).toHaveBeenCalledWith(
        {
          company_id: 10,
          page: 1,
          limit: 10,
          startDate: "2025-01-01",
          endDate: "2025-01-31",
        },
        Role.ADMIN,
        1,
        10,
        "2025-01-01",
        "2025-01-31"
      );

      expect(cache.writeJsonCache).toHaveBeenCalledWith(
        expect.any(String),
        result,
        60
      );

      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        result,
        "getUsers successfully"
      );
    });

    it("should normalize query before generating cache key", async () => {
      userService.getUsersInfoBySearchService.mockResolvedValue({});

      const req = {
        user: mockUser,
        query: {},
      };

      await getUsersInfoBySearch(req, mockRes);

      expect(cache.normalizeQueryForCache).toHaveBeenCalled();
      expect(redis.generateCacheKey).toHaveBeenCalled();
    });

    it("should propagate service error", async () => {
      userService.getUsersInfoBySearchService.mockRejectedValue(
        new Error("info failed")
      );

      const req = {
        user: mockUser,
        query: {},
      };

      await expect(getUsersInfoBySearch(req, mockRes)).rejects.toThrow(
        "info failed"
      );
    });
  });

  describe("getUsersByUserName", () => {
    it("should return cached user", async () => {
      const cached = {
        id: 1,
        user_name: "admin",
      };

      cache.readJsonCache.mockResolvedValue(cached);
      cache.shouldServeCachedResponse.mockReturnValue(true);

      const req = {
        user: mockUser,
        body: {
          username: "admin",
        },
        query: {},
      };

      await getUsersByUserName(req, mockRes);

      expect(userService.getUsersByUserNameService).not.toHaveBeenCalled();

      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        cached,
        "getUsers successfully"
      );
    });

    it("should fetch user by username", async () => {
      const result = {
        id: 1,
        user_name: "admin",
      };

      userService.getUsersByUserNameService.mockResolvedValue(result);

      const req = {
        user: mockUser,
        body: {
          username: "admin",
        },
        query: {},
      };

      await getUsersByUserName(req, mockRes);

      expect(userService.getUsersByUserNameService).toHaveBeenCalledWith(
        "admin",
        {
          company_id: 10,
        },
        Role.ADMIN
      );

      expect(cache.writeJsonCache).toHaveBeenCalledWith(
        expect.any(String),
        result,
        60
      );

      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        result,
        "getUsers successfully"
      );
    });

    it("should throw when username is missing", async () => {
      const req = {
        user: mockUser,
        body: {},
        query: {},
      };

      await expect(
        getUsersByUserName(req, mockRes)
      ).rejects.toThrow("Username is required");

      expect(loggerModule.logger.error).toHaveBeenCalledWith(
        "Username is required"
      );
    });

    it("should generate cache key", async () => {
      userService.getUsersByUserNameService.mockResolvedValue({});

      const req = {
        user: mockUser,
        body: {
          username: "john",
        },
        query: {},
      };

      await getUsersByUserName(req, mockRes);

      expect(redis.generateCacheKey).toHaveBeenCalled();
    });

    it("should propagate service error", async () => {
      userService.getUsersByUserNameService.mockRejectedValue(
        new Error("lookup failed")
      );

      const req = {
        user: mockUser,
        body: {
          username: "admin",
        },
        query: {},
      };

      await expect(
        getUsersByUserName(req, mockRes)
      ).rejects.toThrow("lookup failed");
    });
  });

  describe("getUserById", () => {
    it("should return cached user", async () => {
      const cached = {
        id: 11,
        user_name: "admin",
      };

      cache.readJsonCache.mockResolvedValue(cached);
      cache.shouldServeCachedResponse.mockReturnValue(true);

      const req = {
        user: mockUser,
        params: {
          id: 11,
        },
        query: {},
      };

      await getUserById(req, mockRes);

      expect(userService.getUserByIdService).not.toHaveBeenCalled();

      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        cached,
        "getting User by id successfully"
      );
    });

    it("should fetch user by id when cache misses", async () => {
      const result = {
        id: 11,
        user_name: "admin",
      };

      userService.getUserByIdService.mockResolvedValue(result);

      const req = {
        user: mockUser,
        params: {
          id: 11,
        },
        query: {},
      };

      await getUserById(req, mockRes);

      expect(userService.getUserByIdService).toHaveBeenCalledWith(
        {
          role_id: 1,
          designation_id: 1,
          company_id: 10,
          id: 11,
        },
        Role.ADMIN
      );

      expect(cache.writeJsonCache).toHaveBeenCalledWith(
        expect.any(String),
        result,
        60
      );

      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        result,
        "getting User by id successfully"
      );
    });

    it("should generate cache key", async () => {
      userService.getUserByIdService.mockResolvedValue({});

      const req = {
        user: mockUser,
        params: {
          id: 5,
        },
        query: {},
      };

      await getUserById(req, mockRes);

      expect(cache.readJsonCache).toHaveBeenCalled();
      expect(cache.writeJsonCache).toHaveBeenCalled();
    });

    it("should propagate service error", async () => {
      userService.getUserByIdService.mockRejectedValue(
        new Error("user lookup failed")
      );

      const req = {
        user: mockUser,
        params: {
          id: 1,
        },
        query: {},
      };

      await expect(getUserById(req, mockRes)).rejects.toThrow(
        "user lookup failed"
      );
    });
  });

  describe("createUser", () => {
    beforeEach(() => {
      schema.CREATE_USER_SCHEMA.validate.mockReturnValue({
        error: null,
      });

      userDao.getUsersContactDao.mockResolvedValue(null);

      cache.invalidateCompanyCacheByPrefix.mockResolvedValue();
    });

    it("should create user successfully", async () => {
      userService.createUserService.mockResolvedValue({
        id: 100,
      });

      const req = {
        user: mockUser,
        body: {
          user_name: "  john  ",
          contact_no: "9999999999",
        },
      };

      await createUser(req, mockRes);

      expect(userDao.getUsersContactDao).toHaveBeenCalledWith(
        10,
        "9999999999"
      );

      expect(userService.createUserService).toHaveBeenCalledWith(
        expect.objectContaining({
          user_name: "john",
          company_id: 10,
          created_by: 1,
          updated_by: 1,
          is_enabled: true,
        })
      );

      expect(cache.invalidateCompanyCacheByPrefix).toHaveBeenCalledWith(
        10,
        "users:read:",
        "Users cache"
      );

      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        {
          id: 100,
          created_by: "admin",
        },
        "Create user successfully"
      );
    });

    it("should throw validation error", async () => {
      schema.CREATE_USER_SCHEMA.validate.mockReturnValue({
        error: new Error("validation failed"),
      });

      const req = {
        user: mockUser,
        body: {},
      };

      await expect(createUser(req, mockRes)).rejects.toThrow();
    });

    it("should throw when contact already exists", async () => {
      userDao.getUsersContactDao.mockResolvedValue({
        id: 20,
      });

      const req = {
        user: mockUser,
        body: {
          user_name: "john",
          contact_no: "8888888888",
        },
      };

      await expect(createUser(req, mockRes)).rejects.toThrow(
        "Contact number already exists"
      );

      expect(userService.createUserService).not.toHaveBeenCalled();
    });

    it("should trim username before creating user", async () => {
      userService.createUserService.mockResolvedValue({
        id: 55,
      });

      const req = {
        user: mockUser,
        body: {
          user_name: "   alice   ",
          contact_no: "123456789",
        },
      };

      await createUser(req, mockRes);

      expect(userService.createUserService).toHaveBeenCalledWith(
        expect.objectContaining({
          user_name: "alice",
        })
      );
    });

    it("should propagate create service error", async () => {
      userService.createUserService.mockRejectedValue(
        new Error("create failed")
      );

      const req = {
        user: mockUser,
        body: {
          user_name: "john",
          contact_no: "1111111111",
        },
      };

      await expect(createUser(req, mockRes)).rejects.toThrow(
        "create failed"
      );
    });
  });

  describe("updateUser", () => {
    beforeEach(() => {
      cache.invalidateCompanyCacheByPrefix.mockResolvedValue();
    });

    it("should update user successfully", async () => {
      userService.userUpdateService.mockResolvedValue({
        id: 200,
      });

      const req = {
        user: mockUser,
        params: {
          id: 200,
        },
        body: {
          first_name: "John",
        },
      };

      await updateUser(req, mockRes);

      expect(userService.userUpdateService).toHaveBeenCalledWith(
        {
          id: 200,
          company_id: 10,
        },
        expect.objectContaining({
          first_name: "John",
          updated_by: 1,
        })
      );

      expect(cache.invalidateCompanyCacheByPrefix).toHaveBeenCalledWith(
        10,
        "users:read:",
        "Users cache"
      );

      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        {
          id: 200,
          updated_by: "admin",
        },
        "Update user successfully"
      );
    });

    it("should remove immutable fields from payload", async () => {
      userService.userUpdateService.mockResolvedValue({
        id: 5,
      });

      const req = {
        user: mockUser,
        params: {
          id: 5,
        },
        body: {
          password: "secret",
          balance: 500,
          created_at: "today",
          first_name: "Updated",
        },
      };

      await updateUser(req, mockRes);

      const payload =
        userService.userUpdateService.mock.calls[0][1];

      expect(payload.password).toBeUndefined();
      expect(payload.balance).toBeUndefined();
      expect(payload.created_at).toBeUndefined();
      expect(payload.first_name).toBe("Updated");
    });

    it("should allow admin to update privileged fields", async () => {
      userService.userUpdateService.mockResolvedValue({
        id: 6,
      });

      const req = {
        user: mockUser,
        params: {
          id: 6,
        },
        body: {
          role: "MERCHANT",
          designation: "MERCHANT",
          role_id: 2,
          designation_id: 2,
        },
      };

      await updateUser(req, mockRes);

      const payload =
        userService.userUpdateService.mock.calls[0][1];

      expect(payload.role).toBe("MERCHANT");
      expect(payload.designation).toBe("MERCHANT");
      expect(payload.role_id).toBe(2);
      expect(payload.designation_id).toBe(2);
    });

    it("should strip privileged fields for non-admin user", async () => {
      userService.userUpdateService.mockResolvedValue({
        id: 7,
      });

      const req = {
        user: {
          ...mockUser,
          designation: "MERCHANT",
        },
        params: {
          id: 7,
        },
        body: {
          role: "ADMIN",
          designation: "ADMIN",
          role_id: 99,
          designation_id: 99,
          first_name: "Merchant",
        },
      };

      await updateUser(req, mockRes);

      const payload =
        userService.userUpdateService.mock.calls[0][1];

      expect(payload.role).toBeUndefined();
      expect(payload.designation).toBeUndefined();
      expect(payload.role_id).toBeUndefined();
      expect(payload.designation_id).toBeUndefined();
      expect(payload.first_name).toBe("Merchant");
    });

    it("should propagate update service error", async () => {
      userService.userUpdateService.mockRejectedValue(
        new Error("update failed")
      );

      const req = {
        user: mockUser,
        params: {
          id: 99,
        },
        body: {},
      };

      await expect(updateUser(req, mockRes)).rejects.toThrow(
        "update failed"
      );
    });
  });

  describe("sendMail", () => {
    it("should send mail successfully", async () => {
      userService.sendMailService.mockResolvedValue();

      const req = {
        user: mockUser,
        body: {
          to: "test@example.com",
          subject: "Test",
          message: "Hello",
        },
      };

      await sendMail(req, mockRes);

      expect(userService.sendMailService).toHaveBeenCalledWith(req.body);

      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        {
          mail_sent_by: "admin",
        },
        "Mail send successfully"
      );
    });

    it("should pass payload unchanged to service", async () => {
      userService.sendMailService.mockResolvedValue();

      const payload = {
        to: "abc@test.com",
        cc: "cc@test.com",
        subject: "Subject",
        message: "Testing",
      };

      const req = {
        user: mockUser,
        body: payload,
      };

      await sendMail(req, mockRes);

      expect(userService.sendMailService).toHaveBeenCalledWith(payload);
    });

    it("should propagate service error", async () => {
      userService.sendMailService.mockRejectedValue(
        new Error("mail failed")
      );

      const req = {
        user: mockUser,
        body: {},
      };

      await expect(sendMail(req, mockRes)).rejects.toThrow(
        "mail failed"
      );
    });
  });

  describe("toggleUser2FA", () => {
    beforeEach(() => {
      cache.invalidateCompanyCacheByPrefix.mockResolvedValue();
    });

    it("should enable 2FA successfully", async () => {
      userService.updateUser2FAService.mockResolvedValue();

      const req = {
        user: mockUser,
        params: {
          id: 15,
        },
        body: {
          isTwoFactorRequired: true,
        },
      };

      await toggleUser2FA(req, mockRes);

      expect(userService.updateUser2FAService).toHaveBeenCalledWith(
        15,
        true
      );

      expect(cache.invalidateCompanyCacheByPrefix).toHaveBeenCalledWith(
        10,
        "users:read:",
        "Users cache"
      );

      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        {
          id: 15,
          isTwoFactorRequired: true,
        },
        "User 2FA requirement updated successfully"
      );
    });

    it("should disable 2FA successfully", async () => {
      userService.updateUser2FAService.mockResolvedValue();

      const req = {
        user: mockUser,
        params: {
          id: 20,
        },
        body: {
          isTwoFactorRequired: false,
        },
      };

      await toggleUser2FA(req, mockRes);

      expect(userService.updateUser2FAService).toHaveBeenCalledWith(
        20,
        false
      );
    });

    it("should throw when value is not boolean", async () => {
      const req = {
        user: mockUser,
        params: {
          id: 1,
        },
        body: {
          isTwoFactorRequired: "true",
        },
      };

      await expect(
        toggleUser2FA(req, mockRes)
      ).rejects.toThrow(
        "isTwoFactorRequired must be a boolean"
      );

      expect(
        userService.updateUser2FAService
      ).not.toHaveBeenCalled();
    });

    it("should propagate service error", async () => {
      userService.updateUser2FAService.mockRejectedValue(
        new Error("2FA update failed")
      );

      const req = {
        user: mockUser,
        params: {
          id: 30,
        },
        body: {
          isTwoFactorRequired: true,
        },
      };

      await expect(
        toggleUser2FA(req, mockRes)
      ).rejects.toThrow("2FA update failed");
    });
  });

  describe("toggleUser2FAExemption", () => {
    beforeEach(() => {
      cache.invalidateCompanyCacheByPrefix.mockResolvedValue();
    });

    it("should grant exemption successfully", async () => {
      const serviceResult = {
        id: 40,
        user_name: "john",
        is_two_factor_exempt: true,
      };

      userService.toggleUser2FAExemptionService.mockResolvedValue(
        serviceResult
      );

      const req = {
        user: mockUser,
        params: {
          id: 40,
        },
        body: {
          exempt: true,
        },
      };

      await toggleUser2FAExemption(req, mockRes);

      expect(
        userService.toggleUser2FAExemptionService
      ).toHaveBeenCalledWith(40, true);

      expect(cache.invalidateCompanyCacheByPrefix).toHaveBeenCalledWith(
        10,
        "users:read:",
        "Users cache"
      );

      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        {
          id: 40,
          user_name: "john",
          is_two_factor_exempt: true,
        },
        "User 2FA exemption granted successfully"
      );
    });

    it("should revoke exemption successfully", async () => {
      const serviceResult = {
        id: 50,
        user_name: "smith",
        is_two_factor_exempt: false,
      };

      userService.toggleUser2FAExemptionService.mockResolvedValue(
        serviceResult
      );

      const req = {
        user: mockUser,
        params: {
          id: 50,
        },
        body: {
          exempt: false,
        },
      };

      await toggleUser2FAExemption(req, mockRes);

      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        serviceResult,
        "User 2FA exemption revoked successfully"
      );
    });

    it("should throw when exempt is not boolean", async () => {
      const req = {
        user: mockUser,
        params: {
          id: 60,
        },
        body: {
          exempt: "true",
        },
      };

      await expect(
        toggleUser2FAExemption(req, mockRes)
      ).rejects.toThrow("exempt must be a boolean");

      expect(
        userService.toggleUser2FAExemptionService
      ).not.toHaveBeenCalled();
    });

    it("should throw when service returns null", async () => {
      userService.toggleUser2FAExemptionService.mockResolvedValue(
        null
      );

      const req = {
        user: mockUser,
        params: {
          id: 70,
        },
        body: {
          exempt: true,
        },
      };

      await expect(
        toggleUser2FAExemption(req, mockRes)
      ).rejects.toThrow(
        "User not found or update failed"
      );
    });

    it("should propagate service error", async () => {
      userService.toggleUser2FAExemptionService.mockRejectedValue(
        new Error("toggle failed")
      );

      const req = {
        user: mockUser,
        params: {
          id: 80,
        },
        body: {
          exempt: true,
        },
      };

      await expect(
        toggleUser2FAExemption(req, mockRes)
      ).rejects.toThrow("toggle failed");
    });
  });

  describe("resetUser2FA", () => {
    beforeEach(() => {
      cache.invalidateCompanyCacheByPrefix.mockResolvedValue();
    });

    it("should reset user 2FA successfully", async () => {
      userService.resetUser2FAService.mockResolvedValue();

      const req = {
        user: mockUser,
        params: {
          id: 90,
        },
      };

      await resetUser2FA(req, mockRes);

      expect(userService.resetUser2FAService).toHaveBeenCalledWith(
        90,
        1,
        "admin"
      );

      expect(cache.invalidateCompanyCacheByPrefix).toHaveBeenCalledWith(
        10,
        "users:read:",
        "Users cache"
      );

      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        {},
        "2FA has been reset. User must re-enroll on next login."
      );
    });

    it("should propagate reset service error", async () => {
      userService.resetUser2FAService.mockRejectedValue(
        new Error("reset failed")
      );

      const req = {
        user: mockUser,
        params: {
          id: 91,
        },
      };

      await expect(
        resetUser2FA(req, mockRes)
      ).rejects.toThrow("reset failed");
    });
  });
});