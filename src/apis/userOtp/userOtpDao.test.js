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
        it("should call buildInsertQuery with correct table name and payload", async () => {
            const payload = { user_id: 2, otp: "999999" };

            db.buildInsertQuery.mockReturnValue(["sql", []]);
            db.executeQuery.mockResolvedValue({ rows: [{}] });

            await createUserOtpDao(payload);

            expect(db.buildInsertQuery).toHaveBeenCalledWith(
            "UserOtp",
            payload
            );
        });

        it("should call executeQuery with generated SQL and parameters", async () => {
            const sql = "INSERT SQL";
            const params = [5, "654321"];

            db.buildInsertQuery.mockReturnValue([sql, params]);
            db.executeQuery.mockResolvedValue({ rows: [{}] });

            await createUserOtpDao({
            user_id: 5,
            otp: "654321",
            });

            expect(db.executeQuery).toHaveBeenCalledWith(
            sql,
            params,
            null
            );
        });

        it("should return the first inserted row", async () => {
            const rows = [
            { id: 1 },
            { id: 2 },
            ];

            db.buildInsertQuery.mockReturnValue(["sql", []]);
            db.executeQuery.mockResolvedValue({ rows });

            const result = await createUserOtpDao({ user_id: 1 });

            expect(result).toBe(rows[0]);
        });

        it("should return undefined when no rows are returned", async () => {
            db.buildInsertQuery.mockReturnValue(["sql", []]);
            db.executeQuery.mockResolvedValue({ rows: [] });

            const result = await createUserOtpDao({
            user_id: 1,
            });

            expect(result).toBeUndefined();
        });

        it("should use provided database connection", async () => {
            const conn = {};

            db.buildInsertQuery.mockReturnValue(["sql", []]);
            db.executeQuery.mockResolvedValue({ rows: [{}] });

            await createUserOtpDao(
            { user_id: 1 },
            conn
            );

            expect(db.executeQuery).toHaveBeenCalledWith(
            "sql",
            [],
            conn
            );
        });

        it("should work when connection is null", async () => {
            db.buildInsertQuery.mockReturnValue(["sql", []]);
            db.executeQuery.mockResolvedValue({ rows: [{}] });

            await createUserOtpDao(
            { user_id: 1 },
            null
            );

            expect(db.executeQuery).toHaveBeenCalledWith(
            "sql",
            [],
            null
            );
        });

        it("should log error when buildInsertQuery throws", async () => {
            const payload = { user_id: 77 };
            const error = new Error("build failed");

            db.buildInsertQuery.mockImplementation(() => {
            throw error;
            });

            await expect(
            createUserOtpDao(payload)
            ).rejects.toThrow(error);

            expect(logger.error).toHaveBeenCalledWith(
            "Error creating OTP for user_id: 77",
            error
            );
        });

        it("should log error when executeQuery throws", async () => {
            const payload = { user_id: 55 };
            const error = new Error("db failed");

            db.buildInsertQuery.mockReturnValue(["sql", []]);
            db.executeQuery.mockRejectedValue(error);

            await expect(
            createUserOtpDao(payload)
            ).rejects.toThrow(error);

            expect(logger.error).toHaveBeenCalledWith(
            "Error creating OTP for user_id: 55",
            error
            );
        });

        it("should rethrow database errors after logging", async () => {
            const error = new Error("database");

            db.buildInsertQuery.mockReturnValue(["sql", []]);
            db.executeQuery.mockRejectedValue(error);

            await expect(
            createUserOtpDao({ user_id: 10 })
            ).rejects.toThrow(error);

            expect(logger.error).toHaveBeenCalledTimes(1);
        });

        it("should include user_id in error log message", async () => {
            const error = new Error("failure");

            db.buildInsertQuery.mockImplementation(() => {
            throw error;
            });

            await expect(
            createUserOtpDao({ user_id: 999 })
            ).rejects.toThrow();

            expect(logger.error.mock.calls[0][0]).toContain(
            "999"
            );
        });

        it("should handle empty payload in createUserOtpDao", async () => {
            db.buildInsertQuery.mockReturnValue(["sql", []]);
            db.executeQuery.mockResolvedValue({
            rows: [{}],
            });

            await createUserOtpDao({});

            expect(db.buildInsertQuery).toHaveBeenCalledWith(
            "UserOtp",
            {}
            );
        });

        it("should handle null payload in createUserOtpDao", async () => {
        db.buildInsertQuery.mockImplementation(() => {
            throw new Error("build failed");
        });

        await expect(
            createUserOtpDao(null)
        ).rejects.toThrow();
        });

        it("should preserve parameter order returned by buildInsertQuery", async () => {
            const params = ["otp", 5, true];

            db.buildInsertQuery.mockReturnValue([
            "sql",
            params,
            ]);
            db.executeQuery.mockResolvedValue({
            rows: [{}],
            });

            await createUserOtpDao({
            user_id: 5,
            otp: "otp",
            });

            expect(
            db.executeQuery.mock.calls[0][1]
            ).toBe(params);
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
    describe("getUserOtpDao - new", () => {
        const expectedSql = `
        SELECT 
        id,
        user_id,
        is_used,
        otp,
        expiration_time,
        created_at,
        updated_at
        FROM public."UserOtp"
        WHERE otp = $1
        ORDER BY created_at DESC
        LIMIT 1
        `;

        it("should return latest OTP record for valid OTP", async () => {
            const row = {
            id: 1,
            user_id: 100,
            otp: "123456",
            };

            db.executeQuery.mockResolvedValue({
            rows: [row],
            });

            const result = await getUserOtpDao("123456");

            expect(result).toEqual(row);
        });

        it("should return undefined when OTP does not exist", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            const result = await getUserOtpDao("000000");

            expect(result).toBeUndefined();
        });

        it("should execute query with correct SQL", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            await getUserOtpDao("111111");

            const [sql, params, conn] = db.executeQuery.mock.calls[0];

            expect(sql).toContain('FROM public."UserOtp"');
            expect(sql).toContain("WHERE otp = $1");
            expect(sql).toContain("ORDER BY created_at DESC");
            expect(sql).toContain("LIMIT 1");

            expect(params).toEqual(["111111"]);
            expect(conn).toBeNull();
        });

        it("should pass OTP as query parameter", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            await getUserOtpDao("654321");

            expect(db.executeQuery.mock.calls[0][1]).toEqual([
            "654321",
            ]);
        });

        it("should use provided database connection", async () => {
            const conn = {};

            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            await getUserOtpDao("123456", conn);

            const [sql, params] = db.executeQuery.mock.calls[0];

            expect(sql).toContain('FROM public."UserOtp"');
            expect(sql).toContain("WHERE otp = $1");
            expect(sql).toContain("ORDER BY created_at DESC");
            expect(sql).toContain("LIMIT 1");

            expect(params).toEqual(["123456"]);
            expect(conn).toBe(conn);
        });

        it("should work when connection is null", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            await getUserOtpDao("123456", null);

            const [sql, params, passedConn] = db.executeQuery.mock.calls[0];

            expect(sql).toContain("LIMIT 1");
            expect(params).toEqual(["123456"]);
            expect(passedConn).toBeNull();
        });

        it("should return most recently created OTP because of ORDER BY DESC", async () => {
            const latest = {
            id: 99,
            otp: "222222",
            };

            db.executeQuery.mockResolvedValue({
            rows: [latest],
            });

            const result = await getUserOtpDao("222222");

            expect(result).toBe(latest);
            expect(
            db.executeQuery.mock.calls[0][0]
            ).toContain("ORDER BY created_at DESC");
        });

        it("should apply LIMIT 1 correctly", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [{ id: 5 }],
            });

            await getUserOtpDao("888888");

            expect(
            db.executeQuery.mock.calls[0][0]
            ).toContain("LIMIT 1");
        });

        it("should log error when executeQuery throws", async () => {
            const error = new Error("database error");

            db.executeQuery.mockRejectedValue(error);

            await expect(
            getUserOtpDao("123456")
            ).rejects.toThrow(error);

            expect(logger.error).toHaveBeenCalledWith(
            "Error in getUserOtpDao:",
            error
            );
        });

        it("should rethrow database errors after logging", async () => {
            const error = new Error("query failed");

            db.executeQuery.mockRejectedValue(error);

            await expect(
            getUserOtpDao("777777")
            ).rejects.toThrow(error);

            expect(logger.error).toHaveBeenCalledTimes(1);
        });

        it("should handle invalid OTP value in getUserOtpDao", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            await getUserOtpDao(123456);

            const [sql, params, passedConn] = db.executeQuery.mock.calls[0];

            expect(sql).toContain("WHERE otp = $1");
            expect(params).toEqual([123456]);
            expect(passedConn).toBeNull();
        });

        it("should handle empty OTP string in getUserOtpDao", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            const result = await getUserOtpDao("");

            expect(result).toBeUndefined();

            const [sql, params, passedConn] = db.executeQuery.mock.calls[0];

            expect(sql).toContain("WHERE otp = $1");
            expect(params).toEqual([""]);
            expect(passedConn).toBeNull();
        });

        it("should handle null OTP value in getUserOtpDao", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            const result = await getUserOtpDao(null);

            expect(result).toBeUndefined();

            const [sql, params, passedConn] = db.executeQuery.mock.calls[0];

            expect(sql).toContain("WHERE otp = $1");
            expect(params).toEqual([null]);
            expect(passedConn).toBeNull();
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

    describe("updateUserOtpDao - new", () => {
        it("should update OTP record successfully", async () => {
            const payload = { is_used: true };
            const row = { id: 1, is_used: true };

            db.buildUpdateQuery.mockReturnValue([
            "UPDATE UserOtp",
            [true, 1],
            ]);
            db.executeQuery.mockResolvedValue({
            rows: [row],
            });

            const result = await updateUserOtpDao(1, payload);

            expect(result).toEqual(row);
        });

        it("should call buildUpdateQuery with correct table name", async () => {
            const payload = { is_used: true };

            db.buildUpdateQuery.mockReturnValue(["sql", []]);
            db.executeQuery.mockResolvedValue({
            rows: [{}],
            });

            await updateUserOtpDao(5, payload);

            expect(db.buildUpdateQuery).toHaveBeenCalledWith(
            "UserOtp",
            payload,
            5
            );
        });

        it("should call buildUpdateQuery with correct update payload", async () => {
            const payload = {
            is_used: true,
            updated_by: 100,
            };

            db.buildUpdateQuery.mockReturnValue(["sql", []]);
            db.executeQuery.mockResolvedValue({
            rows: [{}],
            });

            await updateUserOtpDao(8, payload);

            expect(db.buildUpdateQuery.mock.calls[0][1]).toEqual(
            payload
            );
        });

        it("should call buildUpdateQuery with correct user_id condition", async () => {
            db.buildUpdateQuery.mockReturnValue(["sql", []]);
            db.executeQuery.mockResolvedValue({
            rows: [{}],
            });

            await updateUserOtpDao(55, {});

            expect(db.buildUpdateQuery.mock.calls[0][2]).toBe(55);
        });

        it("should call executeQuery with generated SQL and parameters", async () => {
            const sql = "UPDATE SQL";
            const params = [true, 99];

            db.buildUpdateQuery.mockReturnValue([
            sql,
            params,
            ]);
            db.executeQuery.mockResolvedValue({
            rows: [{}],
            });

            await updateUserOtpDao(99, {
            is_used: true,
            });

            expect(db.executeQuery).toHaveBeenCalledWith(
            sql,
            params,
            null
            );
        });

        it("should return updated row", async () => {
            const row = {
            id: 3,
            is_used: true,
            };

            db.buildUpdateQuery.mockReturnValue(["sql", []]);
            db.executeQuery.mockResolvedValue({
            rows: [row],
            });

            const result = await updateUserOtpDao(3, {});

            expect(result).toBe(row);
        });

        it("should return undefined when no rows are updated", async () => {
            db.buildUpdateQuery.mockReturnValue(["sql", []]);
            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            const result = await updateUserOtpDao(10, {});

            expect(result).toBeUndefined();
        });

        it("should use provided database connection", async () => {
            const conn = {};

            db.buildUpdateQuery.mockReturnValue(["sql", []]);
            db.executeQuery.mockResolvedValue({
            rows: [{}],
            });

            await updateUserOtpDao(
            1,
            {},
            conn
            );

            expect(db.executeQuery).toHaveBeenCalledWith(
            "sql",
            [],
            conn
            );
        });

        it("should work when connection is null", async () => {
            db.buildUpdateQuery.mockReturnValue(["sql", []]);
            db.executeQuery.mockResolvedValue({
            rows: [{}],
            });

            await updateUserOtpDao(
            1,
            {},
            null
            );

            expect(db.executeQuery).toHaveBeenCalledWith(
            "sql",
            [],
            null
            );
        });

        it("should log error when buildUpdateQuery throws", async () => {
            const error = new Error("build error");

            db.buildUpdateQuery.mockImplementation(() => {
            throw error;
            });

            await expect(
            updateUserOtpDao(1, {})
            ).rejects.toThrow(error);

            expect(logger.error).toHaveBeenCalledWith(
            "Error in updateUserOtpDao:",
            error
            );
        });

        it("should log error when executeQuery throws", async () => {
            const error = new Error("db error");

            db.buildUpdateQuery.mockReturnValue([
            "sql",
            [],
            ]);
            db.executeQuery.mockRejectedValue(error);

            await expect(
            updateUserOtpDao(1, {})
            ).rejects.toThrow(error);

            expect(logger.error).toHaveBeenCalledWith(
            "Error in updateUserOtpDao:",
            error
            );
        });

        it("should rethrow database errors after logging", async () => {
            const error = new Error("failure");

            db.buildUpdateQuery.mockReturnValue([
            "sql",
            [],
            ]);
            db.executeQuery.mockRejectedValue(error);

            await expect(
            updateUserOtpDao(1, {})
            ).rejects.toThrow(error);

            expect(logger.error).toHaveBeenCalledTimes(1);
        });

        it("should handle empty update payload", async () => {
            db.buildUpdateQuery.mockReturnValue([
            "sql",
            [],
            ]);
            db.executeQuery.mockResolvedValue({
            rows: [{}],
            });

            await updateUserOtpDao(1, {});

            expect(db.buildUpdateQuery).toHaveBeenCalledWith(
            "UserOtp",
            {},
            1
            );
        });

        it("should handle invalid user_id", async () => {
            db.buildUpdateQuery.mockReturnValue([
            "sql",
            [],
            ]);
            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            await updateUserOtpDao(
            null,
            {}
            );

            expect(db.buildUpdateQuery).toHaveBeenCalledWith(
            "UserOtp",
            {},
            null
            );
        });

        it("should preserve parameter order returned by buildUpdateQuery", async () => {
            const params = [
            "otp",
            true,
            999,
            ];

            db.buildUpdateQuery.mockReturnValue([
            "sql",
            params,
            ]);
            db.executeQuery.mockResolvedValue({
            rows: [{}],
            });

            await updateUserOtpDao(999, {
            otp: "otp",
            is_used: true,
            });

            expect(
            db.executeQuery.mock.calls[0][1]
            ).toBe(params);
        });

        it("should propagate unexpected runtime error", async () => {
            const error = new TypeError("runtime");

            db.buildUpdateQuery.mockImplementation(() => {
            throw error;
            });

            await expect(
            updateUserOtpDao(1, {})
            ).rejects.toThrow(error);

            expect(logger.error).toHaveBeenCalledWith(
            "Error in updateUserOtpDao:",
            error
            );
        });
    });
});