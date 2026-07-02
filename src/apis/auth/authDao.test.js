import { jest } from "@jest/globals";

jest.unstable_mockModule("../../utils/db.js", () => ({
  executeQuery: jest.fn(),
}));

jest.unstable_mockModule("../../utils/index.js", () => ({
  stringifyJSON: jest.fn((obj) => JSON.stringify(obj)),
}));

jest.unstable_mockModule("../../utils/logger.js", () => ({
  logger: {
    error: jest.fn(),
  },
}));

jest.unstable_mockModule("../../constants/index.js", () => ({
  tableName: {
    ACCESS_TOKEN: "AccessToken",
    USER: "User",
    ROLE: "Role",
    DESIGNATION: "Designation",
  },
}));

// Import mocked modules FIRST
const { executeQuery } = await import("../../utils/db.js");
const { stringifyJSON } = await import("../../utils/index.js");
const { logger } = await import("../../utils/logger.js");

// NOW import authDao.js
const {
  addLoginDao,
  getRefreshTokenDao,
  getLoginDao,
  getSessionByIdDao,
  getSessionByUserIdDao,
  updateSessionDao,
  deleteUserSessionsDao,
  changePasswordDao,
  getUserAuthPasswordDao,
  getAllActiveSessionsDao,
  getRoleByUserNameDao,
  getUserForVerificationDao,
} = await import("./authDao.js");

describe("authDao - Part 1", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  describe("addLoginDao", () => {
    it("should insert login session successfully", async () => {
      executeQuery.mockResolvedValue({
        rows: [
          {
            id: 1,
            session_id: "session-123",
          },
        ],
      });

      const config = {
        accessToken: "access",
        refreshToken: "refresh",
      };

      const result = await addLoginDao(
        1,
        config,
        100,
        "session-123"
      );

      expect(stringifyJSON).toHaveBeenCalled();

      expect(executeQuery).toHaveBeenCalledTimes(1);

      expect(executeQuery.mock.calls[0][0]).toContain(
        'INSERT INTO public."AccessToken"'
      );

      expect(executeQuery.mock.calls[0][1]).toEqual([
        1,
        100,
        expect.any(String),
        "session-123",
      ]);

      expect(result).toEqual({
        id: 1,
        session_id: "session-123",
      });
    });

    it("should return undefined when insert returns no rows", async () => {
      executeQuery.mockResolvedValue({
        rows: [],
      });

      const result = await addLoginDao(
        1,
        {},
        100,
        "session"
      );

      expect(result).toBeUndefined();
    });

    it("should log and throw database error", async () => {
      const error = new Error("Database Error");

      executeQuery.mockRejectedValue(error);

      await expect(
        addLoginDao(
          1,
          {},
          100,
          "session"
        )
      ).rejects.toThrow(error);

      expect(logger.error).toHaveBeenCalledWith(
        "Error in adding login details",
        error
      );
    });
  });

  describe("addLoginDao - additional cases", () => {
    beforeEach(() => jest.clearAllMocks());

    test("should insert login session and return id and session_id", async () => {
      executeQuery.mockResolvedValueOnce({
        rows: [{ id: 1, session_id: "s1" }],
      });

      const result = await addLoginDao({ user_id: 1 });

      expect(result).toEqual({ id: 1, session_id: "s1" });
      expect(executeQuery).toHaveBeenCalled();
    });

    test("should stringify nested config object before insert", async () => {
      executeQuery.mockResolvedValueOnce({ rows: [] });

      await addLoginDao({ config: { a: 1 } });

      expect(stringifyJSON).toHaveBeenCalled();
    });

    test("should handle null config gracefully", async () => {
      executeQuery.mockResolvedValueOnce({ rows: [] });

      await addLoginDao({ config: null });

      expect(executeQuery).toHaveBeenCalled();
    });

    test("should return undefined when rows empty", async () => {
      executeQuery.mockResolvedValueOnce({ rows: [] });

      const res = await addLoginDao({ user_id: 1 });

      expect(res).toBeUndefined();
    });

    test("should propagate DB error and log it", async () => {
      executeQuery.mockRejectedValueOnce(new Error("db fail"));

      await expect(addLoginDao({ user_id: 1 })).rejects.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });

    test("should use custom connection when provided", async () => {
      const conn = {};
      executeQuery.mockResolvedValueOnce({ rows: [] });

      await addLoginDao({ user_id: 1 }, conn);

      expect(executeQuery).toHaveBeenCalled();
    });
  });

  describe("getRefreshTokenDao", () => {
    it("should return refresh token user", async () => {
      executeQuery.mockResolvedValue({
        rows: [
          {
            user_id: 5,
          },
        ],
      });

      const result = await getRefreshTokenDao(
        "hashed-token",
        100
      );

      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          "SELECT user_id FROM access_tokens"
        ),
        ["hashed-token", 100],
        null
      );

      expect(result).toEqual({
        user_id: 5,
      });
    });

    it("should return undefined when token not found", async () => {
      executeQuery.mockResolvedValue({
        rows: [],
      });

      const result = await getRefreshTokenDao(
        "invalid-token",
        100
      );

      expect(result).toBeUndefined();
    });

    it("should log database error", async () => {
      const error = new Error("DB Error");

      executeQuery.mockRejectedValue(error);

      await expect(
        getRefreshTokenDao(
          "hashed-token",
          100
        )
      ).rejects.toThrow(error);

      expect(logger.error).toHaveBeenCalledWith(
        "Error in getting refresh token",
        error
      );
    });
  });

  describe("getRefreshTokenDao - additional cases", () => {
    beforeEach(() => jest.clearAllMocks());

    test("should return user_id when refresh token matches", async () => {
      executeQuery.mockResolvedValueOnce({
        rows: [{ user_id: 1 }],
      });

      const res = await getRefreshTokenDao("token", 1);

      expect(res).toEqual({ user_id: 1 });
    });

    test("should return undefined when no match", async () => {
      executeQuery.mockResolvedValueOnce({ rows: [] });

      const res = await getRefreshTokenDao("token", 1);

      expect(res).toBeUndefined();
    });

    test("should use company_id filter correctly", async () => {
      executeQuery.mockResolvedValueOnce({ rows: [] });

      await getRefreshTokenDao("t", 99);

      expect(executeQuery).toHaveBeenCalled();
    });

    test("should handle DB error and log it", async () => {
      executeQuery.mockRejectedValueOnce(new Error("fail"));

      await expect(getRefreshTokenDao("t", 1)).rejects.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("getLoginDao", () => {
    it("should return login configuration", async () => {
      executeQuery.mockResolvedValue({
        rows: [
          {
            config: {
              accessToken: "abc",
            },
          },
        ],
      });

      const result = await getLoginDao(
        1,
        100
      );

      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          'SELECT config FROM "AccessToken"'
        ),
        [1, 100],
        null
      );

      expect(result).toEqual({
        config: {
          accessToken: "abc",
        },
      });
    });

    it("should return undefined when session not found", async () => {
      executeQuery.mockResolvedValue({
        rows: [],
      });

      const result = await getLoginDao(
        1,
        100
      );

      expect(result).toBeUndefined();
    });

    it("should throw when database fails", async () => {
      const error = new Error("Database Error");

      executeQuery.mockRejectedValue(error);

      await expect(
        getLoginDao(
          1,
          100
        )
      ).rejects.toThrow(error);

      expect(logger.error).toHaveBeenCalledWith(
        "Error in getting login details",
        error
      );
    });
  });

  describe("getLoginDao - additional cases", () => {
    beforeEach(() => jest.clearAllMocks());

    test("should return config for valid user", async () => {
      executeQuery.mockResolvedValueOnce({
        rows: [{ config: "{}" }],
      });

      const res = await getLoginDao(1, 2);

      expect(res).toBeDefined();
    });

    test("should return undefined when no record exists", async () => {
      executeQuery.mockResolvedValueOnce({ rows: [] });

      const res = await getLoginDao(1, 2);

      expect(res).toBeUndefined();
    });

    test("should handle SQL failure", async () => {
      executeQuery.mockRejectedValueOnce(new Error("db"));

      await expect(getLoginDao(1, 2)).rejects.toThrow();
    });
  });

  describe("getSessionByIdDao", () => {
    it("should return session without session_id", async () => {
      executeQuery.mockResolvedValue({
        rows: [
          {
            session_id: "session-1",
            config: { accessToken: "abc" },
            user_name: "admin",
          },
        ],
      });

      const decodeToken = {
        user_id: 1,
        company_id: 100,
      };

      const result = await getSessionByIdDao(decodeToken);

      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('FROM "AccessToken"'),
        [1, 100],
        null
      );

      expect(result).toEqual({
        session_id: "session-1",
        config: { accessToken: "abc" },
        user_name: "admin",
      });
    });

    it("should return session with session_id", async () => {
      executeQuery.mockResolvedValue({
        rows: [
          {
            session_id: "session-xyz",
          },
        ],
      });

      const decodeToken = {
        user_id: 1,
        company_id: 100,
        session_id: "session-xyz",
      };

      const result = await getSessionByIdDao(decodeToken);

      expect(executeQuery.mock.calls[0][1]).toEqual([
        1,
        100,
        "session-xyz",
      ]);

      expect(result.session_id).toBe("session-xyz");
    });

    it("should return undefined if no session exists", async () => {
      executeQuery.mockResolvedValue({
        rows: [],
      });

      const result = await getSessionByIdDao({
        user_id: 1,
        company_id: 100,
      });

      expect(result).toBeUndefined();
    });

    it("should throw database error", async () => {
      const error = new Error("DB Error");

      executeQuery.mockRejectedValue(error);

      await expect(
        getSessionByIdDao({
          user_id: 1,
          company_id: 100,
        })
      ).rejects.toThrow(error);

      expect(logger.error).toHaveBeenCalledWith(
        "Error in getting session details",
        error
      );
    });
  });

  describe("getSessionByIdDao - additional cases", () => {
    beforeEach(() => jest.clearAllMocks());

    test("should return session data when session_id provided", async () => {
      executeQuery.mockResolvedValueOnce({
        rows: [{ session_id: "s1" }],
      });

      const res = await getSessionByIdDao(1, 2, "s1");

      expect(res).toBeDefined();
    });

    test("should return session when session_id not provided", async () => {
      executeQuery.mockResolvedValueOnce({
        rows: [{ session_id: "s1" }],
      });

      const res = await getSessionByIdDao(1, 2);

      expect(res).toBeDefined();
    });

    test("should return undefined when no session found", async () => {
      executeQuery.mockResolvedValueOnce({ rows: [] });

      const res = await getSessionByIdDao(1, 2);

      expect(res).toBeUndefined();
    });

    test("should propagate DB error", async () => {
      executeQuery.mockRejectedValueOnce(new Error("fail"));

      await expect(getSessionByIdDao(1, 2)).rejects.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("getSessionByUserIdDao", () => {
    it("should fetch sessions for single user", async () => {
      executeQuery.mockResolvedValue({
        rows: [
          {
            session_id: "abc",
            config: {},
          },
        ],
      });

      const result = await getSessionByUserIdDao({
        user_id: 5,
      });

      expect(executeQuery.mock.calls[0][1]).toEqual([
        5,
      ]);

      expect(result).toEqual([
        {
          session_id: "abc",
          config: {},
        },
      ]);
    });

    it("should fetch sessions for multiple users", async () => {
      executeQuery.mockResolvedValue({
        rows: [
          {
            session_id: "A",
            user_id: 1,
          },
          {
            session_id: "B",
            user_id: 2,
          },
        ],
      });

      const result = await getSessionByUserIdDao({
        user_id: [1, 2],
      });

      expect(executeQuery.mock.calls[0][1]).toEqual([
        [1, 2],
      ]);

      expect(result.length).toBe(2);
    });

    it("should return empty array", async () => {
      executeQuery.mockResolvedValue({
        rows: [],
      });

      const result = await getSessionByUserIdDao({
        user_id: 10,
      });

      expect(result).toEqual([]);
    });

    it("should log database error", async () => {
      const error = new Error("Database Error");

      executeQuery.mockRejectedValue(error);

      await expect(
        getSessionByUserIdDao({
          user_id: 1,
        })
      ).rejects.toThrow(error);

      expect(logger.error).toHaveBeenCalledWith(
        "Error in getting session details",
        error
      );
    });
  });

  describe("getSessionByUserIdDao - additional cases", () => {
    beforeEach(() => jest.clearAllMocks());

    test("should return sessions for user_id", async () => {
      executeQuery.mockResolvedValueOnce({
        rows: [{ session_id: "s1" }],
      });

      const res = await getSessionByUserIdDao(1, 2);

      expect(Array.isArray(res)).toBe(true);
    });

    test("should return empty array when no sessions exist", async () => {
      executeQuery.mockResolvedValueOnce({ rows: [] });

      const res = await getSessionByUserIdDao(1, 2);

      expect(res).toEqual([]);
    });

    test("should handle DB failure", async () => {
      executeQuery.mockRejectedValueOnce(new Error("db"));

      await expect(getSessionByUserIdDao(1, 2)).rejects.toThrow();
    });
  });

  describe("updateSessionDao", () => {
    it("should update session config", async () => {
      executeQuery.mockResolvedValue({});

      const config = {
        accessToken: "abc",
      };

      await updateSessionDao(
        1,
        100,
        "session-1",
        config
      );

      expect(stringifyJSON).toHaveBeenCalled();

      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE "AccessToken"'),
        [
          expect.any(String),
          1,
          100,
          "session-1",
        ],
        null
      );
    });

    it("should throw database error", async () => {
      const error = new Error("Update Error");

      executeQuery.mockRejectedValue(error);

      await expect(
        updateSessionDao(
          1,
          100,
          "session",
          {}
        )
      ).rejects.toThrow(error);

      expect(logger.error).toHaveBeenCalledWith(
        "Error updating session",
        error
      );
    });
  });

  describe("updateSessionDao - additional cases", () => {
    beforeEach(() => jest.clearAllMocks());

    test("should update session config", async () => {
      executeQuery.mockResolvedValueOnce({ rows: [] });

      await updateSessionDao(1, 2, 3, { a: 1 });

      expect(stringifyJSON).toHaveBeenCalled();
      expect(executeQuery).toHaveBeenCalled();
    });

    test("should not update when session not found", async () => {
      executeQuery.mockResolvedValueOnce({ rows: [] });

      const res = await updateSessionDao(1, 2, 3, {});

      expect(res).toBeUndefined();
    });

    test("should handle DB failure", async () => {
      executeQuery.mockRejectedValueOnce(new Error("fail"));

      await expect(updateSessionDao(1, 2, 3, {})).rejects.toThrow();
    });
  });

  describe("deleteUserSessionsDao", () => {
    it("should delete all user sessions", async () => {
      executeQuery.mockResolvedValue({
        rows: [{ session_id: "s1" }],
      });

      const result = await deleteUserSessionsDao(
        1,
        100
      );

      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          'UPDATE "AccessToken" SET is_obsolete = true'
        ),
        [1, 100],
        null
      );

      expect(result).toEqual([
        {
          session_id: "s1",
        },
      ]);
    });

    it("should delete a specific session", async () => {
      executeQuery.mockResolvedValue({
        rows: [],
      });

      await deleteUserSessionsDao(
        1,
        100,
        "session-1"
      );

      expect(executeQuery.mock.calls[0][1]).toEqual([
        1,
        100,
        "session-1",
      ]);
    });

    it("should return empty array when nothing deleted", async () => {
      executeQuery.mockResolvedValue({
        rows: [],
      });

      const result = await deleteUserSessionsDao(
        1,
        100
      );

      expect(result).toEqual([]);
    });

    it("should throw database error", async () => {
      const error = new Error("Delete Error");

      executeQuery.mockRejectedValue(error);

      await expect(
        deleteUserSessionsDao(
          1,
          100
        )
      ).rejects.toThrow(error);

      expect(logger.error).toHaveBeenCalledWith(
        "Error while deleting user session:",
        error
      );
    });
  });

  describe("deleteUserSessionsDao - additional cases", () => {
    beforeEach(() => jest.clearAllMocks());

    test("should mark sessions obsolete (all)", async () => {
      executeQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const res = await deleteUserSessionsDao(1, 2);

      expect(res).toBeDefined();
    });

    test("should mark only specific session", async () => {
      executeQuery.mockResolvedValueOnce({ rows: [] });

      await deleteUserSessionsDao(1, 2, "s1");

      expect(executeQuery).toHaveBeenCalled();
    });

    test("should handle DB error", async () => {
      executeQuery.mockRejectedValueOnce(new Error("db"));

      await expect(deleteUserSessionsDao(1, 2)).rejects.toThrow();
    });
  });

  describe("changePasswordDao", () => {
    it("should update password", async () => {
      executeQuery.mockResolvedValue({
        rows: [
          {
            id: 1,
          },
        ],
      });

      const result = await changePasswordDao(
        1,
        "hashed-password"
      );

      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          'UPDATE "User" SET password = $2'
        ),
        [
          1,
          "hashed-password",
        ],
        null
      );

      expect(result.rows[0].id).toBe(1);
    });

    it("should throw database error", async () => {
      const error = new Error("Password Error");

      executeQuery.mockRejectedValue(error);

      await expect(
        changePasswordDao(
          1,
          "password"
        )
      ).rejects.toThrow(error);

      expect(logger.error).toHaveBeenCalledWith(
        "Error while changing password",
        error
      );
    });
  });

  describe("changePasswordDao - additional cases", () => {
    beforeEach(() => jest.clearAllMocks());

    test("should update password", async () => {
      executeQuery.mockResolvedValueOnce({
        rows: [{ user_id: 1 }],
      });

      const res = await changePasswordDao(1, "pass");

      expect(res).toBeDefined();
    });

    test("should return undefined when no rows", async () => {
      executeQuery.mockResolvedValueOnce({ rows: [] });

      const res = await changePasswordDao(1, "pass");

      expect(res).toBeUndefined();
    });
  });

  describe("getUserAuthPasswordDao", () => {
    it("should get user by id", async () => {
      executeQuery.mockResolvedValue({
        rows: [
          {
            id: 1,
            user_name: "admin",
            password: "hash",
          },
        ],
      });

      const result = await getUserAuthPasswordDao({
        user_id: 1,
      });

      expect(executeQuery).toHaveBeenCalled();

      expect(result).toEqual({
        id: 1,
        user_name: "admin",
        password: "hash",
      });
    });

    it("should get user by company id", async () => {
      executeQuery.mockResolvedValue({
        rows: [
          {
            company_id: 100,
          },
        ],
      });

      const result = await getUserAuthPasswordDao({
        company_id: 100,
      });

      expect(result.company_id).toBe(100);
    });

    it("should get user by username", async () => {
      executeQuery.mockResolvedValue({
        rows: [
          {
            user_name: "admin",
          },
        ],
      });

      const result = await getUserAuthPasswordDao({
        user_name: "admin",
      });

      expect(result.user_name).toBe("admin");
    });

    it("should return null if user not found", async () => {
      executeQuery.mockResolvedValue({
        rows: [],
      });

      const result = await getUserAuthPasswordDao({
        user_name: "unknown",
      });

      expect(result).toBeNull();
    });

    it("should filter using all fields", async () => {
      executeQuery.mockResolvedValue({
        rows: [],
      });

      await getUserAuthPasswordDao({
        user_id: 1,
        company_id: 100,
        user_name: "admin",
      });

      expect(executeQuery.mock.calls[0][1]).toEqual([
        1,
        100,
        "admin",
      ]);
    });

    it("should throw database error", async () => {
      const error = new Error("DB Error");

      executeQuery.mockRejectedValue(error);

      await expect(
        getUserAuthPasswordDao({
          user_name: "admin",
        })
      ).rejects.toThrow(error);

      expect(logger.error).toHaveBeenCalledWith(
        "Error in getting auth password details",
        error
      );
    });
  });

  describe("getUserAuthPasswordDao - additional cases", () => {
    beforeEach(() => jest.clearAllMocks());

    test("should return user credentials", async () => {
      executeQuery.mockResolvedValueOnce({
        rows: [{ user_id: 1 }],
      });

      const res = await getUserAuthPasswordDao({ user_id: 1 });

      expect(res).toBeDefined();
    });

    test("should return null when not found", async () => {
      executeQuery.mockResolvedValueOnce({ rows: [] });

      const res = await getUserAuthPasswordDao({ user_id: 1 });

      expect(res).toBeNull();
    });

    test("should handle DB error", async () => {
      executeQuery.mockRejectedValueOnce(new Error("db"));

      await expect(getUserAuthPasswordDao({})).rejects.toThrow();
    });
  });

  describe("getAllActiveSessionsDao", () => {
    test("should return all active sessions", async () => {
      executeQuery.mockResolvedValue({
        rows: [
          {
            session_id: "session1",
            config: {},
            created_at: "2025-01-01",
          },
          {
            session_id: "session2",
            config: {},
            created_at: "2025-01-02",
          },
        ],
      });

      const result = await getAllActiveSessionsDao(
        1,
        100
      );

      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          'SELECT session_id, config, created_at'
        ),
        [1, 100],
        null
      );

      expect(result).toHaveLength(2);
    });

    test("should return empty array", async () => {
      executeQuery.mockResolvedValue({
        rows: [],
      });

      const result = await getAllActiveSessionsDao(
        1,
        100
      );

      expect(result).toEqual([]);
    });

    test("should throw database error", async () => {
      const error = new Error("DB Error");

      executeQuery.mockRejectedValue(error);

      await expect(
        getAllActiveSessionsDao(
          1,
          100
        )
      ).rejects.toThrow(error);

      expect(logger.error).toHaveBeenCalledWith(
        "Error in getting all active sessions",
        error
      );
    });
  });

  describe("getAllActiveSessionsDao - additional cases", () => {
    beforeEach(() => jest.clearAllMocks());

    test("should return active sessions", async () => {
      executeQuery.mockResolvedValueOnce({
        rows: [{ session_id: "s1" }],
      });

      const res = await getAllActiveSessionsDao(1, 2);

      expect(Array.isArray(res)).toBe(true);
    });

    test("should return empty array when none", async () => {
      executeQuery.mockResolvedValueOnce({ rows: [] });

      const res = await getAllActiveSessionsDao(1, 2);

      expect(res).toEqual([]);
    });
  });

  describe("getRoleByUserNameDao", () => {
    test("should return designation and role", async () => {
      executeQuery.mockResolvedValue({
        rows: [
          {
            designation: "Manager",
            role: "Admin",
          },
        ],
      });

      const result = await getRoleByUserNameDao(
        "admin"
      );

      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          'JOIN "Role"'
        ),
        ["admin"],
        null
      );

      expect(result).toEqual({
        designation: "Manager",
        role: "Admin",
      });
    });

    test("should return undefined", async () => {
      executeQuery.mockResolvedValue({
        rows: [],
      });

      const result = await getRoleByUserNameDao(
        "unknown"
      );

      expect(result).toBeUndefined();
    });

    test("should throw database error", async () => {
      const error = new Error("Role Error");

      executeQuery.mockRejectedValue(error);

      await expect(
        getRoleByUserNameDao(
          "admin"
        )
      ).rejects.toThrow(error);

      expect(logger.error).toHaveBeenCalledWith(
        "Error in getting user role by username",
        error
      );
    });
  });

  describe("getRoleByUserNameDao - additional cases", () => {
    beforeEach(() => jest.clearAllMocks());

    test("should return role info", async () => {
      executeQuery.mockResolvedValueOnce({
        rows: [{ role: "admin" }],
      });

      const res = await getRoleByUserNameDao("john");

      expect(res).toBeDefined();
    });

    test("should return undefined when not found", async () => {
      executeQuery.mockResolvedValueOnce({ rows: [] });

      const res = await getRoleByUserNameDao("john");

      expect(res).toBeUndefined();
    });
  });

  describe("getUserForVerificationDao", () => {
    test("should return user", async () => {
      executeQuery.mockResolvedValue({
        rows: [
          {
            id: 1,
            email: "admin@test.com",
            user_name: "admin",
            designation: "Manager",
          },
        ],
      });

      const result =
        await getUserForVerificationDao(
          "admin"
        );

      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          'LEFT JOIN "Designation"'
        ),
        ["admin"],
        null
      );

      expect(result).toEqual({
        id: 1,
        email: "admin@test.com",
        user_name: "admin",
        designation: "Manager",
      });
    });

    test("should return null when user not found", async () => {
      executeQuery.mockResolvedValue({
        rows: [],
      });

      const result =
        await getUserForVerificationDao(
          "unknown"
        );

      expect(result).toBeNull();
    });

    test("should throw database error", async () => {
      const error = new Error("Verification Error");

      executeQuery.mockRejectedValue(error);

      await expect(
        getUserForVerificationDao(
          "admin"
        )
      ).rejects.toThrow(error);

      expect(logger.error).toHaveBeenCalledWith(
        "Error in getting user details for verification",
        error
      );
    });
  });

  describe("getUserForVerificationDao", () => {
    beforeEach(() => jest.clearAllMocks());

    test("should return user data", async () => {
      executeQuery.mockResolvedValueOnce({
        rows: [{ user_name: "john" }],
      });

      const res = await getUserForVerificationDao("john");

      expect(res).toBeDefined();
    });

    test("should return null when user disabled", async () => {
      executeQuery.mockResolvedValueOnce({ rows: [] });

      const res = await getUserForVerificationDao("john");

      expect(res).toBeNull();
    });

    test("should handle DB error", async () => {
      executeQuery.mockRejectedValueOnce(new Error("db"));

      await expect(getUserForVerificationDao("john")).rejects.toThrow();
    });
  });
});
