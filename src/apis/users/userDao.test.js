import { jest } from "@jest/globals";

jest.unstable_mockModule("../../utils/db.js", () => ({
  executeQuery: jest.fn(),
  buildSelectQuery: jest.fn(),
  buildUpdateQuery: jest.fn(),
  buildJoinQuery: jest.fn(),
  buildInsertQuery: jest.fn(),
}));

jest.unstable_mockModule("../../utils/searchBuilder.js", () => ({
  buildSearchFilterObj: jest.fn(),
}));

jest.unstable_mockModule("../../utils/logger.js", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
  },
}));

jest.unstable_mockModule("../../constants/index.js", () => ({
  Role: {
    ADMIN: "ADMIN",
    MERCHANT: "MERCHANT",
    VENDOR: "VENDOR",
  },
  tableName: {
    USER: "User",
    ROLE: "Role",
    DESIGNATION: "Designation",
  },
}));

const db = await import("../../utils/db.js");
const searchBuilder = await import("../../utils/searchBuilder.js");
const loggerModule = await import("../../utils/logger.js");
const constants = await import("../../constants/index.js");

const { executeQuery, buildSelectQuery, buildJoinQuery } = db;
const { buildSearchFilterObj } = searchBuilder;
const { logger } = loggerModule;
const { Role } = constants;

const {
  getUsersContactDao,
  getUsersNameDao,
  getUsersDao,
} = await import("./userDao.js");
import * as userDao from "./userDao.js";
describe("userDao - Part 1A", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("getUsersContactDao", () => {
        test("should return true when contact exists", async () => {
        executeQuery.mockResolvedValue({
            rows: [{ id: 1 }],
        });

        const result = await getUsersContactDao(1, "9999999999");

        expect(executeQuery).toHaveBeenCalledTimes(1);
        expect(executeQuery.mock.calls[0][1]).toEqual([
            1,
            "9999999999",
        ]);
        expect(result).toBe(true);
        });

        test("should return false when contact does not exist", async () => {
        executeQuery.mockResolvedValue({
            rows: [],
        });

        const result = await getUsersContactDao(
            1,
            "8888888888",
        );

        expect(result).toBe(false);
        });

        test("should pass connection when provided", async () => {
        const conn = {};

        executeQuery.mockResolvedValue({
            rows: [],
        });

        await getUsersContactDao(
            2,
            "7777777777",
            conn,
        );

        expect(executeQuery).toHaveBeenCalledWith(
            expect.any(String),
            [2, "7777777777"],
            conn,
        );
        });

        test("should throw database error", async () => {
        const error = new Error("DB Error");

        executeQuery.mockRejectedValue(error);

        await expect(
            getUsersContactDao(1, "999")
        ).rejects.toThrow("DB Error");

        expect(logger.error).toHaveBeenCalledWith(
            "Error executing user contact query:",
            error,
        );
        });
    });

    /* ====================================================================== */
    /*                           getUsersNameDao                               */
    /* ====================================================================== */

    describe("getUsersNameDao", () => {
        test("should return user information", async () => {
        const row = {
            user_name: "john",
            code: "EMP01",
            role: "ADMIN",
            designation: "Admin",
        };

        executeQuery.mockResolvedValue({
            rows: [row],
        });

        const result = await getUsersNameDao(5);

        expect(executeQuery).toHaveBeenCalledTimes(1);
        expect(executeQuery.mock.calls[0][1]).toEqual([5]);
        expect(result).toEqual(row);
        });

        test("should return null when user not found", async () => {
        executeQuery.mockResolvedValue({
            rows: [],
        });

        const result = await getUsersNameDao(999);

        expect(result).toBeNull();
        });

        test("should use supplied connection", async () => {
        const conn = {};

        executeQuery.mockResolvedValue({
            rows: [],
        });

        await getUsersNameDao(10, conn);

        expect(executeQuery).toHaveBeenCalledWith(
            expect.any(String),
            [10],
            conn,
        );
        });

        test("should throw when executeQuery fails", async () => {
        const error = new Error("Database Failed");

        executeQuery.mockRejectedValue(error);

        await expect(
            getUsersNameDao(1)
        ).rejects.toThrow("Database Failed");

        expect(logger.error).toHaveBeenCalledWith(
            "Error executing user query:",
            error,
        );
        });
    });

  /* ====================================================================== */
  /*                              getUsersDao                                */
  /* ====================================================================== */

    describe("getUsersDao", () => {
        beforeEach(() => {
        buildJoinQuery.mockReturnValue("BASE_QUERY");
        buildSelectQuery.mockReturnValue([
            "SELECT * FROM User",
            ["param"],
        ]);
        });

        test("should fetch users successfully", async () => {
        executeQuery.mockResolvedValue({
            rows: [
            { id: 1 },
            { id: 2 },
            ],
        });

        const result = await getUsersDao(
            { company_id: 1 },
            1,
            10,
            "id",
            "ASC",
            ["id", "user_name"],
        );

        expect(buildJoinQuery).toHaveBeenCalled();

        expect(buildSelectQuery).toHaveBeenCalledWith(
            "BASE_QUERY",
            { company_id: 1 },
            1,
            10,
            "id",
            "ASC",
            "User",
        );

        expect(executeQuery).toHaveBeenCalledWith(
            "SELECT * FROM User",
            ["param"],
            null,
        );

        expect(result).toEqual([
            { id: 1 },
            { id: 2 },
        ]);
        });

        test("should build search filter when search exists", async () => {
        buildSearchFilterObj.mockReturnValue({
            first_name: "john",
        });

        executeQuery.mockResolvedValue({
            rows: [],
        });

        const filters = {
            company_id: 1,
            search: "john",
        };

        await getUsersDao(
            filters,
            1,
            10,
            null,
            null,
        );

        expect(buildSearchFilterObj).toHaveBeenCalledWith(
            "john",
            "User",
        );

        expect(buildSelectQuery).toHaveBeenCalledWith(
            "BASE_QUERY",
            expect.objectContaining({
            company_id: 1,
            or: {
                first_name: "john",
            },
            }),
            1,
            10,
            null,
            null,
            "User",
        );
        });

        test("should return empty array", async () => {
        executeQuery.mockResolvedValue({
            rows: [],
        });

        const result = await getUsersDao(
            {},
            1,
            10,
        );

        expect(result).toEqual([]);
        });

        test("should pass connection object", async () => {
        const conn = {};

        executeQuery.mockResolvedValue({
            rows: [],
        });

        await getUsersDao(
            {},
            1,
            10,
            null,
            null,
            [],
            conn,
        );

        expect(executeQuery).toHaveBeenCalledWith(
            "SELECT * FROM User",
            ["param"],
            conn,
        );
        });

        test("should throw when buildSelectQuery fails", async () => {
        const error = new Error("Select Error");

        buildSelectQuery.mockImplementation(() => {
            throw error;
        });

        await expect(
            getUsersDao({}, 1, 10)
        ).rejects.toThrow("Select Error");

        expect(logger.error).toHaveBeenCalledWith(
            "Error in get Users Dao:",
            error,
        );
        });

        test("should throw when executeQuery fails", async () => {
        const error = new Error("Database Error");

        executeQuery.mockRejectedValue(error);

        await expect(
            getUsersDao({}, 1, 10)
        ).rejects.toThrow("Database Error");

        expect(logger.error).toHaveBeenCalledWith(
            "Error in get Users Dao:",
            error,
        );
        });
    });
    describe("getUsersDao", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should return users successfully", async () => {
            db.buildJoinQuery.mockReturnValue("BASE_QUERY");
            db.buildSelectQuery.mockReturnValue(["SELECT * FROM User", [1]]);
            db.executeQuery.mockResolvedValue({
            rows: [{ id: 1, user_name: "john" }],
            });

            const result = await userDao.getUsersDao(
            { company_id: 1 },
            1,
            10,
            null,
            null,
            ["id", "user_name"]
            );

            expect(db.buildJoinQuery).toHaveBeenCalled();
            expect(db.buildSelectQuery).toHaveBeenCalled();
            expect(db.executeQuery).toHaveBeenCalledWith(
            "SELECT * FROM User",
            [1],
            null
            );
            expect(result).toEqual([{ id: 1, user_name: "john" }]);
        });

        test("should build search filter when search exists", async () => {
            searchBuilder.buildSearchFilterObj.mockReturnValue({
            first_name: "john",
            });

            db.buildJoinQuery.mockReturnValue("BASE_QUERY");
            db.buildSelectQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockResolvedValue({ rows: [] });

            const filters = {
            company_id: 1,
            search: "john",
            };

            await userDao.getUsersDao(filters, 1, 10);

            expect(searchBuilder.buildSearchFilterObj).toHaveBeenCalledWith(
            "john",
            "User"
            );

            expect(filters.search).toBeUndefined();
            expect(filters.or).toEqual({
            first_name: "john",
            });
        });

        test("should throw when executeQuery fails", async () => {
            db.buildJoinQuery.mockReturnValue("BASE_QUERY");
            db.buildSelectQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockRejectedValue(new Error("DB Error"));

            await expect(
            userDao.getUsersDao({ company_id: 1 }, 1, 10)
            ).rejects.toThrow("DB Error");

            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe("getAllUsersDao", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should return all users", async () => {
            db.buildJoinQuery.mockReturnValue("BASE_QUERY");
            db.buildSelectQuery.mockReturnValue(["SELECT *", []]);

            db.executeQuery.mockResolvedValue({
            rows: [{ id: 5 }],
            });

            const result = await userDao.getAllUsersDao(
            { company_id: 1 },
            1,
            20
            );

            expect(result).toEqual([{ id: 5 }]);
            expect(db.buildJoinQuery).toHaveBeenCalled();
            expect(db.buildSelectQuery).toHaveBeenCalled();
        });

        test("should apply search filter", async () => {
            searchBuilder.buildSearchFilterObj.mockReturnValue({
            email: "abc@test.com",
            });

            db.buildJoinQuery.mockReturnValue("BASE_QUERY");
            db.buildSelectQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            const filters = {
            company_id: 1,
            search: "abc",
            };

            await userDao.getAllUsersDao(filters, 1, 10);

            expect(searchBuilder.buildSearchFilterObj).toHaveBeenCalled();
            expect(filters.search).toBeUndefined();
            expect(filters.or).toBeDefined();
        });

        test("should throw error", async () => {
            db.buildJoinQuery.mockReturnValue("BASE_QUERY");
            db.buildSelectQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockRejectedValue(new Error("failure"));

            await expect(
            userDao.getAllUsersDao({ company_id: 1 }, 1, 10)
            ).rejects.toThrow("failure");

            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe("getAllUsersNameDao", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should return all usernames", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [
                { id: 1, user_name: "john" },
                { id: 2, user_name: "alex" },
            ],
            });

            const result = await userDao.getAllUsersNameDao({
            company_id: 99,
            });

            expect(db.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining("SELECT id, user_name"),
            [99],
            null
            );

            expect(result).toEqual([
            { id: 1, user_name: "john" },
            { id: 2, user_name: "alex" },
            ]);
        });

        test("should return empty array", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            const result = await userDao.getAllUsersNameDao({
            company_id: 1,
            });

            expect(result).toEqual([]);
        });

        test("should throw database error", async () => {
            db.executeQuery.mockRejectedValue(new Error("database failed"));

            await expect(
            userDao.getAllUsersNameDao({
                company_id: 1,
            })
            ).rejects.toThrow("database failed");

            expect(logger.error).toHaveBeenCalled();
        });
    });
    /* -------------------------------------------------------------------------- */
    /*                          getUsersBySearchDao                               */
    /* -------------------------------------------------------------------------- */

    describe("getUsersBySearchDao", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should return paginated users", async () => {
            db.executeQuery
            .mockResolvedValueOnce({
                rows: [{ total: "2" }],
            })
            .mockResolvedValueOnce({
                rows: [
                { id: 1, user_name: "john" },
                { id: 2, user_name: "alex" },
                ],
            });

            const result = await userDao.getUsersBySearchDao(
            { company_id: 1 },
            ["john"],
            1,
            10,
            "USER"
            );

            expect(db.executeQuery).toHaveBeenCalledTimes(2);

            expect(result).toEqual({
            totalCount: 2,
            totalPages: 1,
            Users: [
                { id: 1, user_name: "john" },
                { id: 2, user_name: "alex" },
            ],
            });
        });

        test("should support admin role query", async () => {
            db.executeQuery
            .mockResolvedValueOnce({
                rows: [{ total: "1" }],
            })
            .mockResolvedValueOnce({
                rows: [{ id: 5 }],
            });

            const result = await userDao.getUsersBySearchDao(
            { company_id: 1 },
            [],
            1,
            10,
            Role.ADMIN
            );

            expect(result.totalCount).toBe(1);
            expect(result.Users).toHaveLength(1);
        });

        test("should search by boolean true", async () => {
            db.executeQuery
            .mockResolvedValueOnce({
                rows: [{ total: "0" }],
            })
            .mockResolvedValueOnce({
                rows: [],
            });

            await userDao.getUsersBySearchDao(
            { company_id: 1 },
            ["true"],
            1,
            10,
            Role.USER
            );

            expect(db.executeQuery).toHaveBeenCalledTimes(2);
        });

        test("should search by boolean false", async () => {
            db.executeQuery
            .mockResolvedValueOnce({
                rows: [{ total: "0" }],
            })
            .mockResolvedValueOnce({
                rows: [],
            });

            await userDao.getUsersBySearchDao(
            { company_id: 1 },
            ["false"],
            1,
            10,
            Role.USER
            );

            expect(db.executeQuery).toHaveBeenCalledTimes(2);
        });

        test("should support id array filter", async () => {
            db.executeQuery
            .mockResolvedValueOnce({
                rows: [{ total: "1" }],
            })
            .mockResolvedValueOnce({
                rows: [{ id: 99 }],
            });

            const result = await userDao.getUsersBySearchDao(
            {
                company_id: 1,
                id: [1, 2, 3],
            },
            [],
            1,
            10,
            Role.USER
            );

            expect(result.Users[0].id).toBe(99);
        });

        test("should fallback to first page if page exceeds", async () => {
            db.executeQuery
            .mockResolvedValueOnce({
                rows: [{ total: "5" }],
            })
            .mockResolvedValueOnce({
                rows: [],
            })
            .mockResolvedValueOnce({
                rows: [{ id: 1 }],
            });

            const result = await userDao.getUsersBySearchDao(
            { company_id: 1 },
            [],
            99,
            10,
            Role.USER
            );

            expect(db.executeQuery).toHaveBeenCalledTimes(3);
            expect(result.Users).toEqual([{ id: 1 }]);
        });

        test("should return empty data", async () => {
            db.executeQuery
            .mockResolvedValueOnce({
                rows: [{ total: "0" }],
            })
            .mockResolvedValueOnce({
                rows: [],
            });

            const result = await userDao.getUsersBySearchDao(
            { company_id: 1 },
            [],
            1,
            10,
            Role.USER
            );

            expect(result).toEqual({
            totalCount: 0,
            totalPages: 0,
            Users: [],
            });
        });

        test("should throw database error", async () => {
            db.executeQuery.mockRejectedValue(new Error("DB Error"));

            await expect(
            userDao.getUsersBySearchDao(
                { company_id: 1 },
                [],
                1,
                10,
                Role.USER
            )
            ).rejects.toThrow("DB Error");

            expect(logger.error).toHaveBeenCalled();
        });
    });

    /* -------------------------------------------------------------------------- */
    /*                        getUsersInfoBySearchDao                             */
    /* -------------------------------------------------------------------------- */

    describe("getUsersInfoBySearchDao", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should return user info", async () => {
            db.executeQuery
            .mockResolvedValueOnce({
                rows: [{ total: "1" }],
            })
            .mockResolvedValueOnce({
                rows: [{ id: 10 }],
            });

            const result = await userDao.getUsersInfoBySearchDao(
            { company_id: 1 },
            [],
            1,
            10
            );

            expect(result).toEqual({
            totalCount: 1,
            totalPages: 1,
            userInfo: [{ id: 10 }],
            });
        });

        test("should search by username", async () => {
            db.executeQuery
            .mockResolvedValueOnce({
                rows: [{ total: "0" }],
            })
            .mockResolvedValueOnce({
                rows: [],
            });

            await userDao.getUsersInfoBySearchDao(
            {
                company_id: 1,
                user_name: "1,2",
            },
            ["john"],
            1,
            10
            );

            expect(db.executeQuery).toHaveBeenCalledTimes(2);
        });

        test("should filter by start date", async () => {
            db.executeQuery
            .mockResolvedValueOnce({
                rows: [{ total: "0" }],
            })
            .mockResolvedValueOnce({
                rows: [],
            });

            await userDao.getUsersInfoBySearchDao(
            {},
            [],
            1,
            10,
            "2025-01-01"
            );

            expect(db.executeQuery).toHaveBeenCalledTimes(2);
        });

        test("should filter by end date", async () => {
            db.executeQuery
            .mockResolvedValueOnce({
                rows: [{ total: "0" }],
            })
            .mockResolvedValueOnce({
                rows: [],
            });

            await userDao.getUsersInfoBySearchDao(
            {},
            [],
            1,
            10,
            null,
            "2025-12-31"
            );

            expect(db.executeQuery).toHaveBeenCalledTimes(2);
        });

        test("should filter by date range", async () => {
            db.executeQuery
            .mockResolvedValueOnce({
                rows: [{ total: "0" }],
            })
            .mockResolvedValueOnce({
                rows: [],
            });

            await userDao.getUsersInfoBySearchDao(
            {},
            [],
            1,
            10,
            "2025-01-01",
            "2025-12-31"
            );

            expect(db.executeQuery).toHaveBeenCalledTimes(2);
        });

        test("should apply sorting", async () => {
            db.executeQuery
            .mockResolvedValueOnce({
                rows: [{ total: "1" }],
            })
            .mockResolvedValueOnce({
                rows: [{ id: 1 }],
            });

            const result = await userDao.getUsersInfoBySearchDao(
            {},
            [],
            1,
            10,
            null,
            null,
            "created_at",
            "ASC"
            );

            expect(result.totalCount).toBe(1);
        });

        test("should return empty result", async () => {
            db.executeQuery
            .mockResolvedValueOnce({
                rows: [{ total: "0" }],
            })
            .mockResolvedValueOnce({
                rows: [],
            });

            const result = await userDao.getUsersInfoBySearchDao(
            {},
            [],
            1,
            10
            );

            expect(result.userInfo).toEqual([]);
        });

        test("should throw database error", async () => {
            db.executeQuery.mockRejectedValue(new Error("Database Failed"));

            await expect(
            userDao.getUsersInfoBySearchDao(
                {},
                [],
                1,
                10
            )
            ).rejects.toThrow("Database Failed");

            expect(logger.error).toHaveBeenCalled();
        });
    });
    /* -------------------------------------------------------------------------- */
    /*                             getUserByIdDao                                 */
    /* -------------------------------------------------------------------------- */

    describe("getUserByIdDao", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should return user by id", async () => {
            const rows = [{ id: 1, user_name: "john" }];

            db.executeQuery.mockResolvedValue({
            rowCount: 1,
            rows,
            });

            const result = await userDao.getUserByIdDao({ id: 1 });

            expect(db.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining('FROM public."User"'),
            [1],
            null
            );

            expect(result).toEqual(rows);
        });

        test("should return users for id array", async () => {
            const rows = [
            { id: 1 },
            { id: 2 },
            ];

            db.executeQuery.mockResolvedValue({
            rowCount: 2,
            rows,
            });

            const result = await userDao.getUserByIdDao({
            id: [1, 2],
            });

            expect(result).toEqual(rows);
        });

        test("should filter using role_id", async () => {
            db.executeQuery.mockResolvedValue({
            rowCount: 1,
            rows: [{ id: 5 }],
            });

            const result = await userDao.getUserByIdDao({
            role_id: 2,
            });

            expect(result).toEqual([{ id: 5 }]);
        });

        test("should filter using designation_id", async () => {
            db.executeQuery.mockResolvedValue({
            rowCount: 1,
            rows: [{ id: 8 }],
            });

            const result = await userDao.getUserByIdDao({
            designation_id: 3,
            });

            expect(result).toEqual([{ id: 8 }]);
        });

        test("should filter using company_id", async () => {
            db.executeQuery.mockResolvedValue({
            rowCount: 1,
            rows: [{ id: 9 }],
            });

            const result = await userDao.getUserByIdDao({
            company_id: 100,
            });

            expect(result).toEqual([{ id: 9 }]);
        });

        test("should apply all filters together", async () => {
            db.executeQuery.mockResolvedValue({
            rowCount: 1,
            rows: [{ id: 10 }],
            });

            const result = await userDao.getUserByIdDao({
            id: 10,
            role_id: 1,
            designation_id: 2,
            company_id: 3,
            });

            expect(result[0].id).toBe(10);
        });

        test("should return empty array when no record exists", async () => {
            db.executeQuery.mockResolvedValue({
            rowCount: 0,
            rows: [],
            });

            const result = await userDao.getUserByIdDao({
            id: 999,
            });

            expect(result).toEqual([]);
            expect(logger.error).toHaveBeenCalled();
        });

        test("should throw database error", async () => {
            db.executeQuery.mockRejectedValue(
            new Error("Database Error")
            );

            await expect(
            userDao.getUserByIdDao({
                id: 1,
            })
            ).rejects.toThrow("Database Error");

            expect(logger.error).toHaveBeenCalled();
        });
    });

    /* -------------------------------------------------------------------------- */
    /*                               getUserDao                                   */
    /* -------------------------------------------------------------------------- */

    describe("getUserDao", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should return user role", async () => {
            const rows = [
            {
                role: "ADMIN",
                is_two_factor_enabled: true,
            },
            ];

            db.executeQuery.mockResolvedValue({
            rowCount: 1,
            rows,
            });

            const result = await userDao.getUserDao({
            id: 1,
            });

            expect(db.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining("SELECT r.role"),
            [1],
            null
            );

            expect(result).toEqual(rows);
        });

        test("should return empty array when user not found", async () => {
            db.executeQuery.mockResolvedValue({
            rowCount: 0,
            rows: [],
            });

            const result = await userDao.getUserDao({
            id: 99,
            });

            expect(result).toEqual([]);
            expect(logger.error).toHaveBeenCalled();
        });

        test("should throw database error", async () => {
            db.executeQuery.mockRejectedValue(
            new Error("Query Failed")
            );

            await expect(
            userDao.getUserDao({
                id: 1,
            })
            ).rejects.toThrow("Query Failed");

            expect(logger.error).toHaveBeenCalled();
        });
    });

    /* -------------------------------------------------------------------------- */
    /*                         getUsersByUserNameDao                              */
    /* -------------------------------------------------------------------------- */

    describe("getUsersByUserNameDao", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should return user by username", async () => {
            const row = {
            id: 1,
            user_name: "john",
            };

            db.executeQuery.mockResolvedValue({
            rowCount: 1,
            rows: [row],
            });

            const result = await userDao.getUsersByUserNameDao(
            {},
            "john"
            );

            expect(db.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining("WHERE u.user_name = $1"),
            ["john"],
            null
            );

            expect(result).toEqual(row);
        });

        test("should filter by role_id", async () => {
            db.executeQuery.mockResolvedValue({
            rowCount: 1,
            rows: [{ id: 2 }],
            });

            const result = await userDao.getUsersByUserNameDao(
            {
                role_id: 1,
            },
            "john"
            );

            expect(result.id).toBe(2);
        });

        test("should filter by designation_id", async () => {
            db.executeQuery.mockResolvedValue({
            rowCount: 1,
            rows: [{ id: 3 }],
            });

            const result = await userDao.getUsersByUserNameDao(
            {
                designation_id: 4,
            },
            "john"
            );

            expect(result.id).toBe(3);
        });

        test("should filter by company_id", async () => {
            db.executeQuery.mockResolvedValue({
            rowCount: 1,
            rows: [{ id: 4 }],
            });

            const result = await userDao.getUsersByUserNameDao(
            {
                company_id: 8,
            },
            "john"
            );

            expect(result.id).toBe(4);
        });

        test("should apply all filters", async () => {
            db.executeQuery.mockResolvedValue({
            rowCount: 1,
            rows: [{ id: 7 }],
            });

            const result = await userDao.getUsersByUserNameDao(
            {
                role_id: 1,
                designation_id: 2,
                company_id: 3,
            },
            "john"
            );

            expect(result.id).toBe(7);
        });

        test("should return null when username not found", async () => {
            db.executeQuery.mockResolvedValue({
            rowCount: 0,
            rows: [],
            });

            const result = await userDao.getUsersByUserNameDao(
            {},
            "unknown"
            );

            expect(result).toBeNull();
            expect(logger.info).toHaveBeenCalled();
        });

        test("should throw database error", async () => {
            db.executeQuery.mockRejectedValue(
            new Error("DB Failure")
            );

            await expect(
            userDao.getUsersByUserNameDao(
                {},
                "john"
            )
            ).rejects.toThrow("DB Failure");

            expect(logger.error).toHaveBeenCalled();
        });
    });
    /* -------------------------------------------------------------------------- */
    /*                               createUserDao                                */
    /* -------------------------------------------------------------------------- */

    describe("createUserDao", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should create user successfully", async () => {
            const payload = {
            user_name: "john",
            email: "john@test.com",
            password: "hashedPassword",
            };

            db.buildInsertQuery.mockReturnValue([
            "INSERT_SQL",
            ["john", "john@test.com", "hashedPassword"],
            ]);

            db.executeQuery.mockResolvedValue({
            rows: [
                {
                id: 1,
                user_name: "john",
                email: "john@test.com",
                },
            ],
            });

            const result = await userDao.createUserDao(payload);

            expect(db.buildInsertQuery).toHaveBeenCalledWith(
            tableName.USER,
            payload
            );

            expect(db.executeQuery).toHaveBeenCalledWith(
            "INSERT_SQL",
            ["john", "john@test.com", "hashedPassword"],
            null
            );

            expect(logger.info).toHaveBeenCalledWith(
            "User with username: john created successfully"
            );

            expect(result).toEqual({
            id: 1,
            user_name: "john",
            email: "john@test.com",
            });
        });

        test("should support connection object", async () => {
            const conn = {};

            db.buildInsertQuery.mockReturnValue([
            "INSERT_SQL",
            [],
            ]);

            db.executeQuery.mockResolvedValue({
            rows: [{ id: 5 }],
            });

            const result = await userDao.createUserDao(
            { user_name: "alex" },
            conn
            );

            expect(db.executeQuery).toHaveBeenCalledWith(
            "INSERT_SQL",
            [],
            conn
            );

            expect(result.id).toBe(5);
        });

        test("should throw database error", async () => {
            db.buildInsertQuery.mockReturnValue([
            "INSERT_SQL",
            [],
            ]);

            db.executeQuery.mockRejectedValue(
            new Error("Insert Failed")
            );

            await expect(
            userDao.createUserDao({
                user_name: "john",
            })
            ).rejects.toThrow("Insert Failed");

            expect(logger.error).toHaveBeenCalledWith(
            "Error creating user: john",
            expect.any(Error)
            );
        });
    });

    /* -------------------------------------------------------------------------- */
    /*                             getUsersForCronDao                             */
    /* -------------------------------------------------------------------------- */

    describe("getUsersForCronDao", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should return all users", async () => {
            const rows = [
            { id: 1 },
            { id: 2 },
            { id: 3 },
            ];

            db.executeQuery.mockResolvedValue({
            rows,
            });

            const result = await userDao.getUsersForCronDao();

            expect(db.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining(
                'SELECT id  FROM public."User"'
            ),
            [],
            null
            );

            expect(result).toEqual(rows);
        });

        test("should return empty array when no users found", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            const result = await userDao.getUsersForCronDao();

            expect(result).toEqual([]);

            expect(logger.info).toHaveBeenCalledWith(
            "No users Found"
            );
        });

        test("should support connection parameter", async () => {
            const conn = {};

            db.executeQuery.mockResolvedValue({
            rows: [{ id: 100 }],
            });

            const result = await userDao.getUsersForCronDao(conn);

            expect(db.executeQuery).toHaveBeenCalledWith(
            expect.any(String),
            [],
            conn
            );

            expect(result).toEqual([{ id: 100 }]);
        });

        test("should throw database error", async () => {
            db.executeQuery.mockRejectedValue(
            new Error("Database Failed")
            );

            await expect(
            userDao.getUsersForCronDao()
            ).rejects.toThrow("Database Failed");

            expect(logger.error).toHaveBeenCalledWith(
            "error getting users",
            expect.any(Error)
            );
        });
    });
    /* -------------------------------------------------------------------------- */
    /*                              updateUserDao                                 */
    /* -------------------------------------------------------------------------- */

    describe("updateUserDao", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should update user successfully", async () => {
            const ids = { id: 1 };
            const payload = {
            first_name: "John",
            last_name: "Doe",
            };

            db.buildUpdateQuery.mockReturnValue([
            "UPDATE_SQL",
            ["John", "Doe", 1],
            ]);

            db.executeQuery.mockResolvedValue({
            rows: [
                {
                id: 1,
                first_name: "John",
                last_name: "Doe",
                },
            ],
            });

            const result = await userDao.updateUserDao(ids, payload);

            expect(db.buildUpdateQuery).toHaveBeenCalledWith(
            tableName.USER,
            payload,
            ids
            );

            expect(db.executeQuery).toHaveBeenCalledWith(
            "UPDATE_SQL",
            ["John", "Doe", 1],
            null
            );

            expect(result).toEqual({
            id: 1,
            first_name: "John",
            last_name: "Doe",
            });
        });

        test("should support connection object", async () => {
            const conn = {};

            db.buildUpdateQuery.mockReturnValue([
            "UPDATE_SQL",
            [],
            ]);

            db.executeQuery.mockResolvedValue({
            rows: [{ id: 5 }],
            });

            const result = await userDao.updateUserDao(
            { id: 5 },
            { email: "abc@test.com" },
            conn
            );

            expect(db.executeQuery).toHaveBeenCalledWith(
            "UPDATE_SQL",
            [],
            conn
            );

            expect(result.id).toBe(5);
        });

        test("should throw database error", async () => {
            db.buildUpdateQuery.mockReturnValue([
            "UPDATE_SQL",
            [],
            ]);

            db.executeQuery.mockRejectedValue(
            new Error("Update Failed")
            );

            await expect(
            userDao.updateUserDao(
                { id: 1 },
                { first_name: "John" }
            )
            ).rejects.toThrow("Update Failed");

            expect(logger.error).toHaveBeenCalledWith(
            "Error in updateUserDao:",
            expect.any(Error)
            );
        });
    });

    /* -------------------------------------------------------------------------- */
    /*                              deleteUserDao                                 */
    /* -------------------------------------------------------------------------- */

    describe("deleteUserDao", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should delete(single update) user successfully", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [
                {
                id: 1,
                is_obsolete: true,
                },
            ],
            });

            const result = await userDao.deleteUserDao(
            { id: 1 },
            {
                is_obsolete: true,
            }
            );

            expect(db.executeQuery).toHaveBeenCalled();

            expect(result).toEqual([
            {
                id: 1,
                is_obsolete: true,
            },
            ]);
        });

        test("should update multiple users using id array", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [
                { id: 1 },
                { id: 2 },
            ],
            });

            const result = await userDao.deleteUserDao(
            {
                id: [1, 2],
            },
            {
                is_obsolete: true,
            }
            );

            expect(db.executeQuery).toHaveBeenCalled();

            expect(result).toHaveLength(2);
        });

        test("should update multiple columns", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [
                {
                id: 5,
                is_enabled: false,
                updated_by: 99,
                },
            ],
            });

            const result = await userDao.deleteUserDao(
            { id: 5 },
            {
                is_enabled: false,
                updated_by: 99,
            }
            );

            expect(result[0].updated_by).toBe(99);
        });

        test("should support connection parameter", async () => {
            const conn = {};

            db.executeQuery.mockResolvedValue({
            rows: [{ id: 10 }],
            });

            const result = await userDao.deleteUserDao(
            { id: 10 },
            { is_obsolete: true },
            conn
            );

            expect(db.executeQuery).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(Array),
            conn
            );

            expect(result[0].id).toBe(10);
        });

        test("should throw database error", async () => {
            db.executeQuery.mockRejectedValue(
            new Error("Delete Failed")
            );

            await expect(
            userDao.deleteUserDao(
                { id: 1 },
                {
                is_obsolete: true,
                }
            )
            ).rejects.toThrow("Delete Failed");

            expect(logger.error).toHaveBeenCalledWith(
            "Error in deleteUserDao:",
            expect.any(Error)
            );
        });
    });

    /* -------------------------------------------------------------------------- */
    /*                            updateUserByIDDao                               */
    /* -------------------------------------------------------------------------- */

    describe("updateUserByIDDao", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should call deleteUserDao internally", async () => {
            const spy = jest
            .spyOn(userDao, "deleteUserDao")
            .mockResolvedValue([
                {
                id: 1,
                is_enabled: false,
                },
            ]);

            const result = await userDao.updateUserByIDDao(
            { id: 1 },
            {
                is_enabled: false,
            }
            );

            expect(spy).toHaveBeenCalledWith(
            { id: 1 },
            {
                is_enabled: false,
            },
            null
            );

            expect(result).toEqual([
            {
                id: 1,
                is_enabled: false,
            },
            ]);

            spy.mockRestore();
        });

        test("should pass connection object", async () => {
            const conn = {};

            const spy = jest
            .spyOn(userDao, "deleteUserDao")
            .mockResolvedValue([{ id: 2 }]);

            const result = await userDao.updateUserByIDDao(
            { id: 2 },
            {
                is_enabled: true,
            },
            conn
            );

            expect(spy).toHaveBeenCalledWith(
            { id: 2 },
            {
                is_enabled: true,
            },
            conn
            );

            expect(result).toEqual([{ id: 2 }]);

            spy.mockRestore();
        });

        test("should propagate deleteUserDao error", async () => {
            const spy = jest
            .spyOn(userDao, "deleteUserDao")
            .mockRejectedValue(new Error("Update Failed"));

            await expect(
            userDao.updateUserByIDDao(
                { id: 1 },
                { is_enabled: false }
            )
            ).rejects.toThrow("Update Failed");

            spy.mockRestore();
        });
    });
    /* -------------------------------------------------------------------------- */
    /*                                Part 4B Tests                               */
    /*      getAdminUserIdsDao / getUserByCompanyCreatedAtDao / getUserByRoleDao  */
    /* -------------------------------------------------------------------------- */

    describe("getAdminUserIdsDao", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should return admin user ids", async () => {
            executeQuery.mockResolvedValue({
            rows: [{ id: 1 }, { id: 2 }],
            });

            const result = await getAdminUserIdsDao(10);

            expect(executeQuery).toHaveBeenCalledWith(
            expect.stringContaining('SELECT id'),
            [10],
            null
            );

            expect(result).toEqual([{ id: 1 }, { id: 2 }]);
        });

        test("should return empty array when no admins found", async () => {
            executeQuery.mockResolvedValue({
            rows: [],
            });

            const result = await getAdminUserIdsDao(99);

            expect(result).toEqual([]);
        });

        test("should pass connection object", async () => {
            const conn = {};

            executeQuery.mockResolvedValue({
            rows: [{ id: 5 }],
            });

            await getAdminUserIdsDao(15, conn);

            expect(executeQuery).toHaveBeenCalledWith(
            expect.any(String),
            [15],
            conn
            );
        });

        test("should throw when executeQuery fails", async () => {
            const err = new Error("DB Error");

            executeQuery.mockRejectedValue(err);

            await expect(
            getAdminUserIdsDao(1)
            ).rejects.toThrow("DB Error");

            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe("getUserByCompanyCreatedAtDao", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should return first matching user", async () => {
            executeQuery.mockResolvedValue({
            rows: [
                {
                id: 25,
                created_at: "2025-01-01",
                },
            ],
            });

            const result =
            await getUserByCompanyCreatedAtDao(
                100,
                "ADMIN"
            );

            expect(executeQuery).toHaveBeenCalledWith(
            expect.stringContaining("created_at"),
            [100, "ADMIN"],
            null
            );

            expect(result).toEqual({
            id: 25,
            created_at: "2025-01-01",
            });
        });

        test("should return undefined when no rows found", async () => {
            executeQuery.mockResolvedValue({
            rows: [],
            });

            const result =
            await getUserByCompanyCreatedAtDao(
                10,
                "ADMIN"
            );

            expect(result).toBeUndefined();
        });

        test("should use provided connection", async () => {
            const conn = {};

            executeQuery.mockResolvedValue({
            rows: [{ id: 7 }],
            });

            await getUserByCompanyCreatedAtDao(
            2,
            "MERCHANT",
            conn
            );

            expect(executeQuery).toHaveBeenCalledWith(
            expect.any(String),
            [2, "MERCHANT"],
            conn
            );
        });

        test("should throw database error", async () => {
            const err = new Error("query failed");

            executeQuery.mockRejectedValue(err);

            await expect(
            getUserByCompanyCreatedAtDao(
                1,
                "ADMIN"
            )
            ).rejects.toThrow("query failed");

            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe("getUserByRoleDao", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should return users by role", async () => {
            executeQuery.mockResolvedValue({
            rows: [{ id: 11 }, { id: 12 }],
            });

            const result = await getUserByRoleDao(
            5,
            "MERCHANT"
            );

            expect(executeQuery).toHaveBeenCalledWith(
            expect.stringContaining("LEFT JOIN"),
            [5, "MERCHANT"],
            null
            );

            expect(result).toEqual([
            { id: 11 },
            { id: 12 },
            ]);
        });

        test("should return empty array", async () => {
            executeQuery.mockResolvedValue({
            rows: [],
            });

            const result = await getUserByRoleDao(
            5,
            "ADMIN"
            );

            expect(result).toEqual([]);
        });

        test("should pass connection", async () => {
            const conn = {};

            executeQuery.mockResolvedValue({
            rows: [{ id: 50 }],
            });

            await getUserByRoleDao(
            7,
            "VENDOR",
            conn
            );

            expect(executeQuery).toHaveBeenCalledWith(
            expect.any(String),
            [7, "VENDOR"],
            conn
            );
        });

        test("should throw executeQuery error", async () => {
            const err = new Error("database failure");

            executeQuery.mockRejectedValue(err);

            await expect(
            getUserByRoleDao(
                1,
                "ADMIN"
            )
            ).rejects.toThrow("database failure");

            expect(logger.error).toHaveBeenCalled();
        });
    });
    /* -------------------------------------------------------------------------- */
    /*                                Part 5 Tests                                */
    /*     updateUser2FAStatusDao / updateUser2FAExemptionDao / 2FA DAO APIs      */
    /* -------------------------------------------------------------------------- */

    describe("updateUser2FAStatusDao", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should update 2FA required status", async () => {
            executeQuery.mockResolvedValue({
            rows: [{ id: 1 }],
            });

            const result = await updateUser2FAStatusDao(1, true);

            expect(executeQuery).toHaveBeenCalledWith(
            expect.stringContaining("is_two_factor_required"),
            [true, 1],
            null
            );

            expect(result).toEqual({ id: 1 });
        });

        test("should return null when no record updated", async () => {
            executeQuery.mockResolvedValue({ rows: [] });

            const result = await updateUser2FAStatusDao(99, false);

            expect(result).toBeNull();
        });

        test("should throw database error", async () => {
            const error = new Error("DB Error");
            executeQuery.mockRejectedValue(error);

            await expect(
            updateUser2FAStatusDao(1, true)
            ).rejects.toThrow("DB Error");

            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe("updateUser2FAExemptionDao", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should update exemption status", async () => {
            executeQuery.mockResolvedValue({
            rows: [
                {
                id: 2,
                user_name: "john",
                is_two_factor_exempt: true,
                },
            ],
            });

            const result =
            await updateUser2FAExemptionDao(2, true);

            expect(executeQuery).toHaveBeenCalledWith(
            expect.stringContaining("is_two_factor_exempt"),
            [true, 2],
            null
            );

            expect(result).toEqual({
            id: 2,
            user_name: "john",
            is_two_factor_exempt: true,
            });
        });

        test("should return null when user not found", async () => {
            executeQuery.mockResolvedValue({
            rows: [],
            });

            const result =
            await updateUser2FAExemptionDao(5, false);

            expect(result).toBeNull();
        });

        test("should throw executeQuery error", async () => {
            executeQuery.mockRejectedValue(
            new Error("Database failed")
            );

            await expect(
            updateUser2FAExemptionDao(1, true)
            ).rejects.toThrow("Database failed");

            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe("getTwoFactorByUsernameDao", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should return user 2FA details", async () => {
            executeQuery.mockResolvedValue({
            rows: [
                {
                id: 1,
                user_name: "admin",
                password: "hashed",
                is_two_factor_enabled: true,
                two_factor_secret: "SECRET",
                },
            ],
            });

            const result =
            await getTwoFactorByUsernameDao("admin");

            expect(executeQuery).toHaveBeenCalledWith(
            expect.stringContaining("two_factor_secret"),
            ["admin"],
            null
            );

            expect(result).toEqual({
            id: 1,
            user_name: "admin",
            password: "hashed",
            is_two_factor_enabled: true,
            two_factor_secret: "SECRET",
            });
        });

        test("should return null when username not found", async () => {
            executeQuery.mockResolvedValue({
            rows: [],
            });

            const result =
            await getTwoFactorByUsernameDao("unknown");

            expect(result).toBeNull();
        });

        test("should throw database error", async () => {
            executeQuery.mockRejectedValue(
            new Error("query failed")
            );

            await expect(
            getTwoFactorByUsernameDao("admin")
            ).rejects.toThrow("query failed");

            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe("saveTwoFactorSecretDao", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should save secret successfully", async () => {
            executeQuery.mockResolvedValue({
            rows: [{ id: 7 }],
            });

            const result =
            await saveTwoFactorSecretDao(
                7,
                "NEW_SECRET"
            );

            expect(executeQuery).toHaveBeenCalledWith(
            expect.stringContaining("two_factor_secret"),
            ["NEW_SECRET", 7],
            null
            );

            expect(result).toEqual({ id: 7 });
        });

        test("should return null when no row updated", async () => {
            executeQuery.mockResolvedValue({
            rows: [],
            });

            const result =
            await saveTwoFactorSecretDao(
                99,
                "SECRET"
            );

            expect(result).toBeNull();
        });

        test("should throw error", async () => {
            executeQuery.mockRejectedValue(
            new Error("update failed")
            );

            await expect(
            saveTwoFactorSecretDao(1, "ABC")
            ).rejects.toThrow("update failed");

            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe("enableTwoFactorDao", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should enable 2FA", async () => {
            executeQuery.mockResolvedValue({
            rows: [{ id: 10 }],
            });

            const result =
            await enableTwoFactorDao(10);

            expect(executeQuery).toHaveBeenCalledWith(
            expect.stringContaining(
                "is_two_factor_enabled = true"
            ),
            [10],
            null
            );

            expect(result).toEqual({ id: 10 });
        });

        test("should return null when user missing", async () => {
            executeQuery.mockResolvedValue({
            rows: [],
            });

            const result =
            await enableTwoFactorDao(20);

            expect(result).toBeNull();
        });

        test("should throw error", async () => {
            executeQuery.mockRejectedValue(
            new Error("enable failed")
            );

            await expect(
            enableTwoFactorDao(1)
            ).rejects.toThrow("enable failed");

            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe("disableTwoFactorDao", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should disable 2FA", async () => {
            executeQuery.mockResolvedValue({
            rows: [{ id: 3 }],
            });

            const result =
            await disableTwoFactorDao(3);

            expect(executeQuery).toHaveBeenCalledWith(
            expect.stringContaining(
                "two_factor_secret = NULL"
            ),
            [3],
            null
            );

            expect(result).toEqual({ id: 3 });
        });

        test("should return null when no record updated", async () => {
            executeQuery.mockResolvedValue({
            rows: [],
            });

            const result =
            await disableTwoFactorDao(33);

            expect(result).toBeNull();
        });

        test("should throw executeQuery error", async () => {
            executeQuery.mockRejectedValue(
            new Error("disable failed")
            );

            await expect(
            disableTwoFactorDao(3)
            ).rejects.toThrow("disable failed");

            expect(logger.error).toHaveBeenCalled();
        });
    });
});