import { jest } from "@jest/globals";

jest.unstable_mockModule("../../utils/db.js", () => ({
  buildInsertQuery: jest.fn(),
  buildUpdateQuery: jest.fn(),
  executeQuery: jest.fn(),
}));

jest.unstable_mockModule("../../utils/logger.js", () => ({
  logger: {
    error: jest.fn(),
  },
}));

jest.unstable_mockModule("../../constants/index.js", () => ({
  tableName: {
    USER_OTP: "UserOtp",
  },
}));

const db = await import("../../utils/db.js");
const { logger } = await import("../../utils/logger.js");

const {
  createUserOtpDao,
  getUserOtpDao,
  updateUserOtpDao,
} = await import("./userOtpDao.js");

describe("userOtpDao", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createUserOtpDao", () => {
    it("should create user OTP successfully", async () => {
      const payload = {
        user_id: 10,
        otp: "123456",
      };

      const row = {
        id: 1,
        ...payload,
      };

      db.buildInsertQuery.mockReturnValue([
        "INSERT SQL",
        ["params"],
      ]);

      db.executeQuery.mockResolvedValue({
        rows: [row],
      });

      const result = await createUserOtpDao(payload);

      expect(db.buildInsertQuery).toHaveBeenCalledWith(
        "UserOtp",
        payload
      );

      expect(db.executeQuery).toHaveBeenCalledWith(
        "INSERT SQL",
        ["params"],
        null
      );

      expect(result).toEqual(row);
    });

    it("should create user OTP using connection", async () => {
      const conn = {};

      db.buildInsertQuery.mockReturnValue([
        "INSERT SQL",
        [],
      ]);

      db.executeQuery.mockResolvedValue({
        rows: [{ id: 5 }],
      });

      await createUserOtpDao(
        {
          user_id: 5,
        },
        conn
      );

      expect(db.executeQuery).toHaveBeenCalledWith(
        "INSERT SQL",
        [],
        conn
      );
    });

    it("should throw when insert fails", async () => {
      const error = new Error("insert failed");

      db.buildInsertQuery.mockReturnValue([
        "INSERT SQL",
        [],
      ]);

      db.executeQuery.mockRejectedValue(error);

      await expect(
        createUserOtpDao({
          user_id: 11,
        })
      ).rejects.toThrow(error);

      expect(logger.error).toHaveBeenCalledWith(
        "Error creating OTP for user_id: 11",
        error
      );
    });
  });

  describe("getUserOtpDao", () => {
    it("should return OTP record", async () => {
      const row = {
        id: 1,
        otp: "999999",
      };

      db.executeQuery.mockResolvedValue({
        rows: [row],
      });

      const result = await getUserOtpDao("999999");

      expect(db.executeQuery).toHaveBeenCalled();

      expect(result).toEqual(row);
    });

    it("should return undefined when OTP not found", async () => {
      db.executeQuery.mockResolvedValue({
        rows: [],
      });

      const result = await getUserOtpDao("111111");

      expect(result).toBeUndefined();
    });

    it("should pass connection object", async () => {
      const conn = {};

      db.executeQuery.mockResolvedValue({
        rows: [{ id: 2 }],
      });

      await getUserOtpDao("123456", conn);

      expect(db.executeQuery).toHaveBeenCalledWith(
        expect.any(String),
        ["123456"],
        conn
      );
    });

    it("should throw when query fails", async () => {
      const error = new Error("db error");

      db.executeQuery.mockRejectedValue(error);

      await expect(
        getUserOtpDao("123456")
      ).rejects.toThrow(error);

      expect(logger.error).toHaveBeenCalledWith(
        "Error in getUserOtpDao:",
        error
      );
    });
  });

  describe("updateUserOtpDao", () => {
    it("should update OTP successfully", async () => {
      const payload = {
        is_used: true,
      };

      const row = {
        id: 10,
      };

      db.buildUpdateQuery.mockReturnValue([
        "UPDATE SQL",
        ["params"],
      ]);

      db.executeQuery.mockResolvedValue({
        rows: [row],
      });

      const result = await updateUserOtpDao(
        10,
        payload
      );

      expect(db.buildUpdateQuery).toHaveBeenCalledWith(
        "UserOtp",
        payload,
        10
      );

      expect(db.executeQuery).toHaveBeenCalledWith(
        "UPDATE SQL",
        ["params"],
        null
      );

      expect(result).toEqual(row);
    });

    it("should update using connection", async () => {
      const conn = {};

      db.buildUpdateQuery.mockReturnValue([
        "UPDATE SQL",
        [],
      ]);

      db.executeQuery.mockResolvedValue({
        rows: [{ id: 1 }],
      });

      await updateUserOtpDao(
        1,
        {},
        conn
      );

      expect(db.executeQuery).toHaveBeenCalledWith(
        "UPDATE SQL",
        [],
        conn
      );
    });

    it("should throw when update fails", async () => {
      const error = new Error("update failed");

      db.buildUpdateQuery.mockReturnValue([
        "UPDATE SQL",
        [],
      ]);

      db.executeQuery.mockRejectedValue(error);

      await expect(
        updateUserOtpDao(
          1,
          {}
        )
      ).rejects.toThrow(error);

      expect(logger.error).toHaveBeenCalledWith(
        "Error in updateUserOtpDao:",
        error
      );
    });
  });
});