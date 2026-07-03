import { jest } from "@jest/globals";

jest.unstable_mockModule("../../utils/db.js", () => ({
  buildInsertQuery: jest.fn(),
  buildUpdateQuery: jest.fn(),
  buildAndExecuteUpdateQuery: jest.fn(),
  executeQuery: jest.fn(),
  isSafeColumnName: jest.fn(),
}));

jest.unstable_mockModule("../../utils/logger.js", () => ({
  logger: {
    error: jest.fn(),
  },
}));

jest.unstable_mockModule("../../constants/index.js", () => ({
  Role: {
    ADMIN: "ADMIN",
    MERCHANT: "MERCHANT",
    VENDOR: "VENDOR",
  },
  tableName: {
    BENEFICIARY_ACCOUNTS: "BeneficiaryAccounts",
  },
}));


const db = await import("../../utils/db.js");

const { logger } = await import("../../utils/logger.js");

const { Role, tableName } = await import("../../constants/index.js");

const {
  getBeneficiaryAccountDao,
  checkBeneficiaryAccountExistsDao,
  getBeneficiaryAccountDaoAll,
  getBeneficiaryAccountBySearchDao,
  createBeneficiaryAccountDao,
  getBeneficiaryAccountDaoByBankName,
  updateBeneficiaryAccountDao,
  deleteBeneficiaryDao,
  updateBanktBalanceDao,
} = await import("./beneficiaryAccountDao.js");

let conn;

describe("BeneficiaryAccountDao", () => {
    beforeEach(() => {
    jest.clearAllMocks();

    conn = {};

    db.buildInsertQuery.mockReset();
    db.buildUpdateQuery.mockReset();
    db.buildAndExecuteUpdateQuery.mockReset();
    db.executeQuery.mockReset();
    db.isSafeColumnName.mockReset();

    // Treat every column as valid unless overridden inside a test
    db.isSafeColumnName.mockReturnValue(true);
    });
    describe("getBeneficiaryAccountDao", () => {
        const rows = [{ id: 1, bank_name: "HDFC" }];

        beforeEach(() => {
            db.executeQuery.mockResolvedValue({ rows });
            db.isSafeColumnName.mockReturnValue(true);
        });

        it("should return beneficiary accounts successfully", async () => {
            const result = await getBeneficiaryAccountDao(
            {},
            1,
            10,
            Role.ADMIN
            );

            expect(result).toEqual(rows);
            expect(db.executeQuery).toHaveBeenCalledTimes(1);
        });

        it("should build ADMIN query", async () => {
            await getBeneficiaryAccountDao({}, 1, 10, Role.ADMIN);

            const sql = db.executeQuery.mock.calls[0][0];

            expect(sql).toContain("creator.user_name");
            expect(sql).toContain("updater.user_name");
            expect(sql).toContain("bea.config");
            expect(sql).toContain("bea.created_at");
        });

        it("should build MERCHANT query", async () => {
            await getBeneficiaryAccountDao({}, 1, 10, Role.MERCHANT);

            const sql = db.executeQuery.mock.calls[0][0];

            expect(sql).toContain("bea.ifsc AS ifsc");
            expect(sql).not.toContain("creator.user_name");
        });

        it("should build VENDOR query", async () => {
            await getBeneficiaryAccountDao({}, 1, 10, Role.VENDOR);

            const sql = db.executeQuery.mock.calls[0][0];

            expect(sql).toContain("bea.ifsc AS ifsc");
            expect(sql).toContain("bea.config");
            expect(sql).not.toContain("creator.user_name");
        });

        it("should apply pagination", async () => {
            await getBeneficiaryAccountDao({}, 2, 20, Role.ADMIN);

            const sql = db.executeQuery.mock.calls[0][0];
            const params = db.executeQuery.mock.calls[0][1];

            expect(sql).toContain("LIMIT $1 OFFSET $2");
            expect(params).toEqual([20, 20]);
        });

        it("should not apply pagination when page and limit are missing", async () => {
            await getBeneficiaryAccountDao({}, null, null, Role.ADMIN);

            const sql = db.executeQuery.mock.calls[0][0];

            expect(sql).not.toContain("LIMIT");
            expect(db.executeQuery.mock.calls[0][1]).toEqual([]);
        });

        it("should apply normal filters", async () => {
            await getBeneficiaryAccountDao(
            {
                company_id: 5,
            },
            1,
            10,
            Role.ADMIN
            );

            const sql = db.executeQuery.mock.calls[0][0];
            const params = db.executeQuery.mock.calls[0][1];

            expect(sql).toContain('bea."company_id"');
            expect(params).toContain(5);
        });

        it("should apply ANY filter for arrays", async () => {
            await getBeneficiaryAccountDao(
            {
                user_id: [1, 2, 3],
            },
            1,
            10,
            Role.ADMIN
            );

            const sql = db.executeQuery.mock.calls[0][0];

            expect(sql).toContain('bea."user_id" = ANY');
            expect(db.executeQuery.mock.calls[0][1]).toContainEqual([1, 2, 3]);
        });

        it("should apply JSON filter", async () => {
            await getBeneficiaryAccountDao(
            {
                "config->>type": "Personal",
            },
            1,
            10,
            Role.ADMIN
            );

            const sql = db.executeQuery.mock.calls[0][0];

            expect(sql).toContain("bea.config->>'type'");
            expect(db.executeQuery.mock.calls[0][1]).toContain("Personal");
        });

        it("should ignore invalid column names", async () => {
            db.isSafeColumnName.mockImplementation(
            (col) => col === "company_id"
            );

            await getBeneficiaryAccountDao(
            {
                company_id: 10,
                invalid_column: "abc",
            },
            1,
            10,
            Role.ADMIN
            );

            const sql = db.executeQuery.mock.calls[0][0];

            expect(sql).toContain("company_id");
            expect(sql).not.toContain("invalid_column");
        });

        it("should handle empty filters", async () => {
            await getBeneficiaryAccountDao({}, 1, 10, Role.ADMIN);

            expect(db.executeQuery).toHaveBeenCalled();
        });

        it("should ignore null values", async () => {
            await getBeneficiaryAccountDao(
            {
                company_id: null,
                user_id: undefined,
                bank_name: "",
            },
            1,
            10,
            Role.ADMIN
            );

            expect(db.executeQuery.mock.calls[0][1]).toEqual([10, 0]);
        });

        it("should execute query with provided connection", async () => {
            await getBeneficiaryAccountDao({}, 1, 10, Role.ADMIN, conn);

            expect(db.executeQuery).toHaveBeenCalledWith(
            expect.any(String),
            [10, 0],
            conn
            );
        });

        it("should log executeQuery error", async () => {
            const error = new Error("db failed");

            db.executeQuery.mockRejectedValue(error);

            await expect(
            getBeneficiaryAccountDao({}, 1, 10, Role.ADMIN)
            ).rejects.toThrow(error);

            expect(logger.error).toHaveBeenCalledWith(
            "Error in get BeneficiaryAccount Dao:",
            error
            );
        });

        it("should rethrow executeQuery error", async () => {
            const error = new Error("query error");

            db.executeQuery.mockRejectedValue(error);

            await expect(
            getBeneficiaryAccountDao({}, 1, 10, Role.ADMIN)
            ).rejects.toThrow(error);
        });
    });

    describe("getBeneficiaryAccountDao - Additional Tests ", () => {
        beforeEach(() => {
            jest.clearAllMocks();

            db.isSafeColumnName.mockReturnValue(true);
            db.executeQuery.mockResolvedValue({
            rows: [],
            });
        });

        it("should build query when filters is undefined", async () => {
            await getBeneficiaryAccountDao(
            undefined,
            1,
            10,
            Role.ADMIN
            );

            expect(db.executeQuery).toHaveBeenCalledTimes(1);

            const [sql, params] = db.executeQuery.mock.calls[0];

            expect(sql).toContain("bea.is_obsolete = false");
            expect(params).toEqual([10, 0]);
        });

        it("should build query when filters is null", async () => {
            await getBeneficiaryAccountDao(
            null,
            1,
            20,
            Role.ADMIN
            );

            const [, params] = db.executeQuery.mock.calls[0];

            expect(params).toEqual([20, 0]);
        });

        it("should ignore non safe column names", async () => {
            db.isSafeColumnName.mockImplementation((column) => {
            return column !== "invalid_column";
            });

            await getBeneficiaryAccountDao(
            {
                invalid_column: "abc",
            },
            1,
            10,
            Role.ADMIN
            );

            const [sql, params] = db.executeQuery.mock.calls[0];

            expect(sql).not.toContain('"invalid_column"');
            expect(params).toEqual([10, 0]);
        });

        it("should ignore undefined filter values", async () => {
            await getBeneficiaryAccountDao(
            {
                bank_name: undefined,
                acc_no: "123456",
            },
            1,
            10,
            Role.ADMIN
            );

            const [sql, params] = db.executeQuery.mock.calls[0];

            expect(sql).toContain('bea."acc_no"');

            expect(sql).not.toContain('bea."bank_name"');

            expect(params).toEqual([10, 0, "123456"]);
        });

        it("should ignore empty string filter values", async () => {
            await getBeneficiaryAccountDao(
            {
                bank_name: "",
                acc_no: "111222333",
            },
            1,
            10,
            Role.ADMIN
            );

            const [sql] = db.executeQuery.mock.calls[0];

            expect(sql).not.toContain('bea."bank_name"');

            expect(sql).toContain('bea."acc_no"');
        });
        describe("getBeneficiaryAccountDao - Additional Tests", () => {
        beforeEach(() => {
            jest.clearAllMocks();

            db.isSafeColumnName.mockReturnValue(true);

            db.executeQuery.mockResolvedValue({
            rows: [],
            });
        });

        it("should build JSON filter query", async () => {
            await getBeneficiaryAccountDao(
            {
                "config->>type": "CURRENT",
            },
            1,
            10,
            Role.ADMIN
            );

            const [sql, params] = db.executeQuery.mock.calls[0];

            expect(sql).toContain(
            `bea.config->>'type' = $3`
            );

            expect(params).toEqual([
            10,
            0,
            "CURRENT",
            ]);
        });

        it("should ignore JSON filter when json field is unsafe", async () => {
            db.isSafeColumnName.mockImplementation((column) => {
            return column !== "config";
            });

            await getBeneficiaryAccountDao(
            {
                "config->>type": "CURRENT",
            },
            1,
            10,
            Role.ADMIN
            );

            const [sql, params] = db.executeQuery.mock.calls[0];

            expect(sql).not.toContain("config->>'type'");

            expect(params).toEqual([
            10,
            0,
            ]);
        });

        it("should ignore JSON filter when json key is unsafe", async () => {
            db.isSafeColumnName.mockImplementation((column) => {
            return column !== "type";
            });

            await getBeneficiaryAccountDao(
            {
                "config->>type": "CURRENT",
            },
            1,
            10,
            Role.ADMIN
            );

            const [sql] = db.executeQuery.mock.calls[0];

            expect(sql).not.toContain("config->>'type'");
        });

        it("should build ANY clause for array filter", async () => {
            await getBeneficiaryAccountDao(
            {
                user_id: [11, 22, 33],
            },
            1,
            10,
            Role.ADMIN
            );

            const [sql, params] = db.executeQuery.mock.calls[0];

            expect(sql).toContain(
            `bea."user_id" = ANY($3)`
            );

            expect(params).toEqual([
            10,
            0,
            [11, 22, 33],
            ]);
        });

        it("should build equality clause for normal string filter", async () => {
            await getBeneficiaryAccountDao(
            {
                bank_name: "HDFC",
            },
            1,
            10,
            Role.ADMIN
            );

            const [sql, params] = db.executeQuery.mock.calls[0];

            expect(sql).toContain(
            `bea."bank_name" = $3`
            );

            expect(params).toEqual([
            10,
            0,
            "HDFC",
            ]);
        });
        });
        describe("getBeneficiaryAccountDao - Additional Tests", () => {
        beforeEach(() => {
            jest.clearAllMocks();

            db.isSafeColumnName.mockReturnValue(true);

            db.executeQuery.mockResolvedValue({
            rows: [{ id: 1 }],
            });
        });

        it("should support multiple array filters", async () => {
            await getBeneficiaryAccountDao(
            {
                user_id: [1, 2],
                company_id: [10, 20],
            },
            1,
            10,
            Role.ADMIN
            );

            const [sql, params] = db.executeQuery.mock.calls[0];

            expect(sql).toContain(`bea."user_id" = ANY($3)`);
            expect(sql).toContain(`bea."company_id" = ANY($4)`);

            expect(params).toEqual([
            10,
            0,
            [1, 2],
            [10, 20],
            ]);
        });

        it("should support multiple JSON filters", async () => {
            await getBeneficiaryAccountDao(
            {
                "config->>type": "CURRENT",
                "config->>status": "ACTIVE",
            },
            1,
            10,
            Role.ADMIN
            );

            const [sql, params] = db.executeQuery.mock.calls[0];

            expect(sql).toContain(`bea.config->>'type' = $3`);
            expect(sql).toContain(`bea.config->>'status' = $4`);

            expect(params).toEqual([
            10,
            0,
            "CURRENT",
            "ACTIVE",
            ]);
        });

        it("should support mixed JSON and normal filters", async () => {
            await getBeneficiaryAccountDao(
            {
                bank_name: "HDFC",
                "config->>type": "CURRENT",
                user_id: [15],
            },
            1,
            10,
            Role.ADMIN
            );

            const [sql, params] = db.executeQuery.mock.calls[0];

            expect(sql).toContain(`bea."bank_name" = $3`);
            expect(sql).toContain(`bea.config->>'type' = $4`);
            expect(sql).toContain(`bea."user_id" = ANY($5)`);

            expect(params).toEqual([
            10,
            0,
            "HDFC",
            "CURRENT",
            [15],
            ]);
        });

        it("should generate pagination offset correctly for page two", async () => {
            await getBeneficiaryAccountDao(
            {},
            2,
            25,
            Role.ADMIN
            );

            const [, params] = db.executeQuery.mock.calls[0];

            expect(params).toEqual([
            25,
            25,
            ]);
        });

        it("should generate pagination offset correctly for page five", async () => {
            await getBeneficiaryAccountDao(
            {},
            5,
            20,
            Role.ADMIN
            );

            const [, params] = db.executeQuery.mock.calls[0];

            expect(params).toEqual([
            20,
            80,
            ]);
        });
        });
        describe("getBeneficiaryAccountDao - Additional Tests", () => {
        beforeEach(() => {
            jest.clearAllMocks();

            db.isSafeColumnName.mockReturnValue(true);

            db.executeQuery.mockResolvedValue({
            rows: [{ id: 1 }],
            });
        });

        it("should not include LIMIT clause when page is undefined", async () => {
            await getBeneficiaryAccountDao(
            {},
            undefined,
            10,
            Role.ADMIN
            );

            const [sql, params] = db.executeQuery.mock.calls[0];

            expect(sql).not.toContain("LIMIT");
            expect(sql).not.toContain("OFFSET");
            expect(params).toEqual([]);
        });

        it("should return empty rows when executeQuery returns empty result", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            const result = await getBeneficiaryAccountDao(
            {},
            1,
            10,
            Role.ADMIN
            );

            expect(result).toEqual([]);
        });

        it("should execute query using provided transaction connection", async () => {
            const conn = {
            release: jest.fn(),
            };

            await getBeneficiaryAccountDao(
            {},
            1,
            10,
            Role.ADMIN,
            conn
            );

            expect(db.executeQuery).toHaveBeenCalledWith(
            expect.any(String),
            [10, 0],
            conn
            );
        });

        it("should preserve parameter ordering with multiple filters", async () => {
            await getBeneficiaryAccountDao(
            {
                bank_name: "HDFC",
                user_id: [10],
                acc_no: "1234567890",
            },
            1,
            10,
            Role.ADMIN
            );

            const [sql, params] = db.executeQuery.mock.calls[0];

            expect(sql).toContain(`bea."bank_name" = $3`);
            expect(sql).toContain(`bea."user_id" = ANY($4)`);
            expect(sql).toContain(`bea."acc_no" = $5`);

            expect(params).toEqual([
            10,
            0,
            "HDFC",
            [10],
            "1234567890",
            ]);
        });

        it("should log and rethrow executeQuery error", async () => {
            const error = new Error("Database Error");

            db.executeQuery.mockRejectedValue(error);

            await expect(
            getBeneficiaryAccountDao(
                {},
                1,
                10,
                Role.ADMIN
            )
            ).rejects.toThrow("Database Error");

            expect(logger.error).toHaveBeenCalledWith(
            "Error in get BeneficiaryAccount Dao:",
            error
            );
        });
        });
    });

    describe("checkBeneficiaryAccountExistsDao", () => {
        const conn = {};

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should return true when beneficiary account exists", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [{ 1: 1 }],
            });

            const result = await checkBeneficiaryAccountExistsDao(
            {
                acc_no: "1234567890",
                company_id: 10,
            },
            conn
            );

            expect(result).toBe(true);
        });

        it("should return false when beneficiary account does not exist", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            const result = await checkBeneficiaryAccountExistsDao(
            {
                acc_no: "1234567890",
                company_id: 10,
            },
            conn
            );

            expect(result).toBe(false);
        });

        it("should throw when acc_no is missing", async () => {
            await expect(
            checkBeneficiaryAccountExistsDao(
                {
                company_id: 10,
                },
                conn
            )
            ).rejects.toThrow("Missing acc_no or company_id in filters");

            expect(db.executeQuery).not.toHaveBeenCalled();

            expect(logger.error).toHaveBeenCalled();
        });

        it("should throw when company_id is missing", async () => {
            await expect(
            checkBeneficiaryAccountExistsDao(
                {
                acc_no: "1234567890",
                },
                conn
            )
            ).rejects.toThrow("Missing acc_no or company_id in filters");

            expect(db.executeQuery).not.toHaveBeenCalled();

            expect(logger.error).toHaveBeenCalled();
        });

        it("should call executeQuery with correct SQL and parameters", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            await checkBeneficiaryAccountExistsDao(
            {
                acc_no: "ACC001",
                company_id: 77,
            },
            conn
            );

            expect(db.executeQuery).toHaveBeenCalledTimes(1);

            const [sql, params, passedConn] = db.executeQuery.mock.calls[0];

            expect(sql).toContain('FROM public."BeneficiaryAccounts"');
            expect(sql).toContain("bea.is_obsolete = false");
            expect(sql).toContain("bea.acc_no = $1");
            expect(sql).toContain("bea.company_id = $2");
            expect(sql).toContain("LIMIT 1");

            expect(params).toEqual(["ACC001", 77]);
            expect(passedConn).toBe(conn);
        });

        it("should work with null connection", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            await checkBeneficiaryAccountExistsDao(
            {
                acc_no: "ACC001",
                company_id: 1,
            },
            null
            );

            expect(db.executeQuery).toHaveBeenCalledWith(
            expect.any(String),
            ["ACC001", 1],
            null
            );
        });

        it("should log executeQuery error", async () => {
            const error = new Error("DB Error");

            db.executeQuery.mockRejectedValue(error);

            await expect(
            checkBeneficiaryAccountExistsDao(
                {
                acc_no: "ACC001",
                company_id: 5,
                },
                conn
            )
            ).rejects.toThrow(error);

            expect(logger.error).toHaveBeenCalledWith(
            "Error in checkBeneficiaryAccountExistsDao:",
            error
            );
        });

        it("should rethrow executeQuery error", async () => {
            const error = new Error("Database failed");

            db.executeQuery.mockRejectedValue(error);

            await expect(
            checkBeneficiaryAccountExistsDao(
                {
                acc_no: "ACC001",
                company_id: 1,
                },
                conn
            )
            ).rejects.toThrow(error);
        });
    });

    describe("checkBeneficiaryAccountExistsDao (Part 2)", () => {
        const conn = {};

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should return false when executeQuery returns undefined rows", async () => {
            db.executeQuery.mockResolvedValue({ rows: undefined });

            const result = await checkBeneficiaryAccountExistsDao(
            { acc_no: "123", company_id: "1" },
            conn
            );

            expect(result).toBe(false);
        });

        it("should return false when executeQuery returns null rows", async () => {
            db.executeQuery.mockResolvedValue({ rows: null });

            const result = await checkBeneficiaryAccountExistsDao(
            { acc_no: "123", company_id: "1" },
            conn
            );

            expect(result).toBe(false);
        });

        it("should execute query with provided connection", async () => {
            db.executeQuery.mockResolvedValue({ rows: [] });

            await checkBeneficiaryAccountExistsDao(
            { acc_no: "123", company_id: "1" },
            conn
            );

            expect(db.executeQuery).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(Array),
            conn
            );
        });

        it("should pass correct parameter order", async () => {
            db.executeQuery.mockResolvedValue({ rows: [] });

            await checkBeneficiaryAccountExistsDao(
            { acc_no: "ACC123", company_id: "COMP1" },
            conn
            );

            expect(db.executeQuery).toHaveBeenCalledWith(
            expect.any(String),
            ["ACC123", "COMP1"],
            conn
            );
        });

        it("should throw when filters is undefined", async () => {
            await expect(
            checkBeneficiaryAccountExistsDao(undefined, conn)
            ).rejects.toThrow("Missing acc_no or company_id in filters");
        });

        it("should throw when filters is null", async () => {
            await expect(
            checkBeneficiaryAccountExistsDao(null, conn)
            ).rejects.toThrow("Missing acc_no or company_id in filters");
        });

        it("should log validation error", async () => {
            await expect(
            checkBeneficiaryAccountExistsDao({}, conn)
            ).rejects.toThrow();

            expect(logger.error).toHaveBeenCalled();
        });

        it("should log database error", async () => {
            db.executeQuery.mockRejectedValue(new Error("DB failed"));

            await expect(
            checkBeneficiaryAccountExistsDao(
                { acc_no: "123", company_id: "1" },
                conn
            )
            ).rejects.toThrow("DB failed");

            expect(logger.error).toHaveBeenCalled();
        });

        it("should rethrow executeQuery error", async () => {
            db.executeQuery.mockRejectedValue(new Error("executeQuery crash"));

            await expect(
            checkBeneficiaryAccountExistsDao(
                { acc_no: "123", company_id: "1" },
                conn
            )
            ).rejects.toThrow("executeQuery crash");
        });

        it("should execute SQL only once", async () => {
            db.executeQuery.mockResolvedValue({ rows: [] });

            await checkBeneficiaryAccountExistsDao(
            { acc_no: "123", company_id: "1" },
            conn
            );

            expect(db.executeQuery).toHaveBeenCalledTimes(1);
        });
    });

    describe("checkBeneficiaryAccountExistsDao", () => {
        const conn = {};

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should return true when beneficiary account exists", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [{ 1: 1 }],
            });

            const result = await checkBeneficiaryAccountExistsDao(
            {
                acc_no: "1234567890",
                company_id: 100,
            },
            conn
            );

            expect(result).toBe(true);
        });

        it("should return false when beneficiary account does not exist", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            const result = await checkBeneficiaryAccountExistsDao(
            {
                acc_no: "1234567890",
                company_id: 100,
            },
            conn
            );

            expect(result).toBe(false);
        });

        it("should throw when acc_no is missing", async () => {
            await expect(
            checkBeneficiaryAccountExistsDao(
                {
                company_id: 100,
                },
                conn
            )
            ).rejects.toThrow("Missing acc_no or company_id in filters");

            expect(db.executeQuery).not.toHaveBeenCalled();

            expect(logger.error).toHaveBeenCalledWith(
            "Error in checkBeneficiaryAccountExistsDao:",
            expect.any(Error)
            );
        });

        it("should throw when company_id is missing", async () => {
            await expect(
            checkBeneficiaryAccountExistsDao(
                {
                acc_no: "1234567890",
                },
                conn
            )
            ).rejects.toThrow("Missing acc_no or company_id in filters");

            expect(db.executeQuery).not.toHaveBeenCalled();

            expect(logger.error).toHaveBeenCalledWith(
            "Error in checkBeneficiaryAccountExistsDao:",
            expect.any(Error)
            );
        });

        it("should call executeQuery with correct SQL and parameters", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            await checkBeneficiaryAccountExistsDao(
            {
                acc_no: "ACC001",
                company_id: 55,
            },
            conn
            );

            expect(db.executeQuery).toHaveBeenCalledTimes(1);

            const [sql, params, passedConn] = db.executeQuery.mock.calls[0];

            expect(sql).toContain('FROM public."BeneficiaryAccounts"');
            expect(sql).toContain("bea.is_obsolete = false");
            expect(sql).toContain("bea.acc_no = $1");
            expect(sql).toContain("bea.company_id = $2");
            expect(sql).toContain("LIMIT 1");

            expect(params).toEqual(["ACC001", 55]);
            expect(passedConn).toBe(conn);
        });

        it("should use provided connection", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            const connection = { id: 1 };

            await checkBeneficiaryAccountExistsDao(
            {
                acc_no: "ACC100",
                company_id: 5,
            },
            connection
            );

            expect(db.executeQuery).toHaveBeenCalledWith(
            expect.any(String),
            ["ACC100", 5],
            connection
            );
        });

        it("should work with null connection", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            await checkBeneficiaryAccountExistsDao(
            {
                acc_no: "ACC100",
                company_id: 5,
            },
            null
            );

            expect(db.executeQuery).toHaveBeenCalledWith(
            expect.any(String),
            ["ACC100", 5],
            null
            );
        });

        it("should log executeQuery errors", async () => {
            const error = new Error("Database Error");

            db.executeQuery.mockRejectedValue(error);

            await expect(
            checkBeneficiaryAccountExistsDao(
                {
                acc_no: "ACC100",
                company_id: 5,
                },
                conn
            )
            ).rejects.toThrow(error);

            expect(logger.error).toHaveBeenCalledWith(
            "Error in checkBeneficiaryAccountExistsDao:",
            error
            );
        });

        it("should rethrow executeQuery errors", async () => {
            const error = new Error("Unexpected DB failure");

            db.executeQuery.mockRejectedValue(error);

            await expect(
            checkBeneficiaryAccountExistsDao(
                {
                acc_no: "ACC100",
                company_id: 5,
                },
                conn
            )
            ).rejects.toThrow(error);
        });
    });

    describe("getBeneficiaryAccountDaoAll", () => {
        const conn = {};

        beforeEach(() => {
            jest.clearAllMocks();
            db.isSafeColumnName.mockReturnValue(true);
        });

        it("should return rows for ADMIN role", async () => {
            const rows = [{ id: 1 }];

            db.executeQuery.mockResolvedValue({ rows });

            const result = await getBeneficiaryAccountDaoAll(
            { company_id: 1 },
            1,
            10,
            Role.ADMIN,
            conn
            );

            expect(result).toEqual(rows);

            const [sql] = db.executeQuery.mock.calls[0];
            expect(sql).toContain("creator.user_name");
            expect(sql).toContain("config_initial_balance");
        });

        it("should return rows for MERCHANT role", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [{ id: 1 }],
            });

            await getBeneficiaryAccountDaoAll(
            {},
            1,
            10,
            Role.MERCHANT,
            conn
            );

            const [sql] = db.executeQuery.mock.calls[0];

            expect(sql).toContain("bea.ifsc AS ifsc");
            expect(sql).not.toContain("creator.user_name");
        });

        it("should return rows for VENDOR role", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [{ id: 1 }],
            });

            await getBeneficiaryAccountDaoAll(
            {},
            1,
            10,
            Role.VENDOR,
            conn
            );

            const [sql] = db.executeQuery.mock.calls[0];

            expect(sql).toContain("v.user_id AS user_id");
            expect(sql).toContain("bea.ifsc AS ifsc");
        });

        it("should apply pagination", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            await getBeneficiaryAccountDaoAll(
            {},
            2,
            25,
            Role.ADMIN,
            conn
            );

            const [, params] = db.executeQuery.mock.calls[0];

            expect(params).toEqual([25, 25]);
        });

        it("should work without pagination", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            await getBeneficiaryAccountDaoAll(
            {},
            null,
            null,
            Role.ADMIN,
            conn
            );

            const [sql, params] = db.executeQuery.mock.calls[0];

            expect(sql).not.toContain("LIMIT");
            expect(params).toEqual([]);
        });

        it("should flatten array filters", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            await getBeneficiaryAccountDaoAll(
            {
                user_id: [[1, 2], 3],
            },
            1,
            10,
            Role.ADMIN,
            conn
            );

            const [, params] = db.executeQuery.mock.calls[0];

            expect(params).toContainEqual([1, 2, 3]);
        });

        it("should ignore empty array filters", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            await getBeneficiaryAccountDaoAll(
            {
                user_id: [],
            },
            1,
            10,
            Role.ADMIN,
            conn
            );

            const [sql, params] = db.executeQuery.mock.calls[0];

            expect(sql).not.toContain('bea."user_id" = ANY');
            expect(params).toEqual([10, 0]);
        });

        it("should apply JSON filters", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            await getBeneficiaryAccountDaoAll(
            {
                "config->>type": "Personal",
            },
            1,
            10,
            Role.ADMIN,
            conn
            );

            const [sql, params] = db.executeQuery.mock.calls[0];

            expect(sql).toContain("bea.config->>'type'");
            expect(params).toContain("Personal");
        });

        it("should ignore invalid column names", async () => {
            db.isSafeColumnName.mockImplementation((name) => name === "company_id");

            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            await getBeneficiaryAccountDaoAll(
            {
                invalid: "abc",
                company_id: 5,
            },
            1,
            10,
            Role.ADMIN,
            conn
            );

            const [sql, params] = db.executeQuery.mock.calls[0];

            expect(sql).not.toContain('"invalid"');
            expect(sql).toContain('"company_id"');
            expect(params).toContain(5);
        });

        it("should call executeQuery correctly", async () => {
            db.executeQuery.mockResolvedValue({
            rows: [{ id: 10 }],
            });

            await getBeneficiaryAccountDaoAll(
            { company_id: 2 },
            1,
            10,
            Role.ADMIN,
            conn
            );

            expect(db.executeQuery).toHaveBeenCalledTimes(1);

            const [sql, params, passedConn] = db.executeQuery.mock.calls[0];

            expect(sql).toContain('FROM public."BeneficiaryAccounts"');
            expect(params).toEqual([10, 0, 2]);
            expect(passedConn).toBe(conn);
        });

        it("should log executeQuery errors", async () => {
            const error = new Error("DB Error");

            db.executeQuery.mockRejectedValue(error);

            await expect(
            getBeneficiaryAccountDaoAll(
                {},
                1,
                10,
                Role.ADMIN,
                conn
            )
            ).rejects.toThrow(error);

            expect(logger.error).toHaveBeenCalledWith(
            "Error in get BeneficiaryAccount Dao:",
            error
            );
        });

        it("should rethrow executeQuery errors", async () => {
            const error = new Error("Unexpected");

            db.executeQuery.mockRejectedValue(error);

            await expect(
            getBeneficiaryAccountDaoAll(
                {},
                1,
                10,
                Role.ADMIN,
                conn
            )
            ).rejects.toThrow(error);
        });
    });

    describe("getBeneficiaryAccountBySearchDao", () => {
        const conn = {};

        beforeEach(() => {
            jest.clearAllMocks();
            db.isSafeColumnName.mockReturnValue(true);
        });

        it("should return search result successfully", async () => {
            db.executeQuery
            .mockResolvedValueOnce({ rows: [{ total: "1" }] })
            .mockResolvedValueOnce({ rows: [{ id: 1 }] });

            const result = await getBeneficiaryAccountBySearchDao(
            { company_id: 1 },
            1,
            10,
            Role.ADMIN,
            ["abc"],
            conn
            );

            expect(result).toEqual({
            totalCount: 1,
            totalPages: 1,
            bankAccounts: [{ id: 1 }],
            });
        });

        it("should support multiple search terms", async () => {
            db.executeQuery
            .mockResolvedValueOnce({ rows: [{ total: "2" }] })
            .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });

            await getBeneficiaryAccountBySearchDao(
            {},
            1,
            10,
            Role.ADMIN,
            ["abc", "xyz"],
            conn
            );

            const [, params] = db.executeQuery.mock.calls[1];

            expect(params).toContain("%abc%");
            expect(params).toContain("%xyz%");
        });

        it("should execute count query first", async () => {
            db.executeQuery
            .mockResolvedValueOnce({ rows: [{ total: "5" }] })
            .mockResolvedValueOnce({ rows: [] });

            await getBeneficiaryAccountBySearchDao(
            {},
            1,
            10,
            Role.ADMIN,
            ["abc"],
            conn
            );

            expect(db.executeQuery).toHaveBeenCalledTimes(2);

            expect(db.executeQuery.mock.calls[0][0]).toContain("COUNT(*)");
            expect(db.executeQuery.mock.calls[1][0]).toContain(
            'FROM public."BeneficiaryAccounts"'
            );
        });

        it("should apply pagination", async () => {
            db.executeQuery
            .mockResolvedValueOnce({ rows: [{ total: "20" }] })
            .mockResolvedValueOnce({ rows: [] });

            await getBeneficiaryAccountBySearchDao(
            {},
            2,
            10,
            Role.ADMIN,
            [],
            conn
            );

            const [, params] = db.executeQuery.mock.calls[1];

            expect(params.slice(-2)).toEqual([10, 10]);
        });

        it("should build ADMIN query", async () => {
            db.executeQuery
            .mockResolvedValueOnce({ rows: [{ total: "0" }] })
            .mockResolvedValueOnce({ rows: [] });

            await getBeneficiaryAccountBySearchDao(
            {},
            1,
            10,
            Role.ADMIN,
            [],
            conn
            );

            const [sql] = db.executeQuery.mock.calls[1];

            expect(sql).toContain("creator.user_name");
            expect(sql).toContain("config_initial_balance");
        });

        it("should build MERCHANT query", async () => {
            db.executeQuery
            .mockResolvedValueOnce({ rows: [{ total: "0" }] })
            .mockResolvedValueOnce({ rows: [] });

            await getBeneficiaryAccountBySearchDao(
            {},
            1,
            10,
            Role.MERCHANT,
            [],
            conn
            );

            const [sql] = db.executeQuery.mock.calls[1];

            expect(sql).toContain("bea.ifsc AS ifsc");
            expect(sql).not.toContain("creator.user_name");
        });

        it("should build VENDOR query", async () => {
            db.executeQuery
            .mockResolvedValueOnce({ rows: [{ total: "0" }] })
            .mockResolvedValueOnce({ rows: [] });

            await getBeneficiaryAccountBySearchDao(
            {},
            1,
            10,
            Role.VENDOR,
            [],
            conn
            );

            const [sql] = db.executeQuery.mock.calls[1];

            expect(sql).toContain("bea.ifsc AS ifsc");
        });

        it("should apply normal filters", async () => {
            db.executeQuery
            .mockResolvedValueOnce({ rows: [{ total: "0" }] })
            .mockResolvedValueOnce({ rows: [] });

            await getBeneficiaryAccountBySearchDao(
            {
                company_id: 100,
            },
            1,
            10,
            Role.ADMIN,
            [],
            conn
            );

            const [, params] = db.executeQuery.mock.calls[1];

            expect(params).toContain(100);
        });

        it("should apply JSON filters", async () => {
            db.executeQuery
            .mockResolvedValueOnce({ rows: [{ total: "0" }] })
            .mockResolvedValueOnce({ rows: [] });

            await getBeneficiaryAccountBySearchDao(
            {
                "config->>type": "Personal",
            },
            1,
            10,
            Role.ADMIN,
            [],
            conn
            );

            const [sql] = db.executeQuery.mock.calls[1];

            expect(sql).toContain("bea.config->>'type'");
        });

        it("should apply array filters", async () => {
            db.executeQuery
            .mockResolvedValueOnce({ rows: [{ total: "0" }] })
            .mockResolvedValueOnce({ rows: [] });

            await getBeneficiaryAccountBySearchDao(
            {
                user_id: [1, 2],
            },
            1,
            10,
            Role.ADMIN,
            [],
            conn
            );

            const [sql, params] = db.executeQuery.mock.calls[1];

            expect(sql).toContain("ANY");
            expect(params).toContainEqual([1, 2]);
        });

        it("should ignore invalid search values", async () => {
            db.executeQuery
            .mockResolvedValueOnce({ rows: [{ total: "0" }] })
            .mockResolvedValueOnce({ rows: [] });

            await getBeneficiaryAccountBySearchDao(
            {},
            1,
            10,
            Role.ADMIN,
            [123, null, "abc"],
            conn
            );

            const [, params] = db.executeQuery.mock.calls[1];

            expect(params).toContain("%abc%");
            expect(params).not.toContain("%123%");
        });

        it("should execute fallback query when requested page exceeds results", async () => {
            db.executeQuery
            .mockResolvedValueOnce({ rows: [{ total: "2" }] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ id: 99 }] });

            const result = await getBeneficiaryAccountBySearchDao(
            {},
            5,
            10,
            Role.ADMIN,
            [],
            conn
            );

            expect(db.executeQuery).toHaveBeenCalledTimes(3);

            expect(result.bankAccounts).toEqual([{ id: 99 }]);
        });

        it("should log executeQuery errors", async () => {
            const error = new Error("DB Error");

            db.executeQuery.mockRejectedValue(error);

            await expect(
            getBeneficiaryAccountBySearchDao(
                {},
                1,
                10,
                Role.ADMIN,
                [],
                conn
            )
            ).rejects.toThrow(error);

            expect(logger.error).toHaveBeenCalledWith(
            "Error in get Beneficiary Account By SearchDao:",
            error
            );
        });

        it("should rethrow executeQuery errors", async () => {
            const error = new Error("Unexpected");

            db.executeQuery.mockRejectedValue(error);

            await expect(
            getBeneficiaryAccountBySearchDao(
                {},
                1,
                10,
                Role.ADMIN,
                [],
                conn
            )
            ).rejects.toThrow(error);
        });
    });

    describe("getBeneficiaryAccountBySearchDao (Part 2)", () => {
        const conn = {};

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should search using one keyword", async () => {
            db.executeQuery
            .mockResolvedValueOnce({ rows: [{ total: "1" }] }) // count
            .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // data

            const res = await getBeneficiaryAccountBySearchDao(
            {},
            1,
            10,
            "ADMIN",
            ["test"],
            conn
            );

            expect(db.executeQuery).toHaveBeenCalledTimes(2);
            expect(res.bankAccounts).toEqual([{ id: 1 }]);
            expect(res.totalCount).toBe(1);
        });

        it("should search using multiple keywords", async () => {
            db.executeQuery
            .mockResolvedValueOnce({ rows: [{ total: "2" }] })
            .mockResolvedValueOnce({ rows: [] });

            await getBeneficiaryAccountBySearchDao(
            {},
            1,
            10,
            "ADMIN",
            ["a", "b"],
            conn
            );

            expect(db.executeQuery).toHaveBeenCalledTimes(2);
        });

        it("should ignore non-string search term", async () => {
            db.executeQuery
            .mockResolvedValueOnce({ rows: [{ total: "1" }] })
            .mockResolvedValueOnce({ rows: [] });

            await getBeneficiaryAccountBySearchDao(
            {},
            1,
            10,
            "ADMIN",
            ["valid", 123, null],
            conn
            );

            expect(db.executeQuery).toHaveBeenCalledTimes(2);
        });

        it("should ignore empty search term", async () => {
            db.executeQuery
            .mockResolvedValueOnce({ rows: [{ total: "0" }] })
            .mockResolvedValueOnce({ rows: [] });

            await getBeneficiaryAccountBySearchDao(
            {},
            1,
            10,
            "ADMIN",
            [],
            conn
            );

            expect(db.executeQuery).toHaveBeenCalledTimes(2);
        });

        it("should build search query with no search terms", async () => {
            db.executeQuery
            .mockResolvedValueOnce({ rows: [{ total: "1" }] })
            .mockResolvedValueOnce({ rows: [] });

            await getBeneficiaryAccountBySearchDao({}, 1, 10, "ADMIN", null, conn);

            expect(db.executeQuery).toHaveBeenCalledTimes(2);
        });

        it("should build search query with filters and search terms", async () => {
            db.executeQuery
            .mockResolvedValueOnce({ rows: [{ total: "1" }] })
            .mockResolvedValueOnce({ rows: [] });

            await getBeneficiaryAccountBySearchDao(
            { bank_name: "HDFC" },
            1,
            10,
            "ADMIN",
            ["abc"],
            conn
            );

            expect(db.executeQuery).toHaveBeenCalledTimes(2);
        });

        it("should build search query with JSON filter", async () => {
            db.isSafeColumnName.mockReturnValue(true);

            db.executeQuery
            .mockResolvedValueOnce({ rows: [{ total: "1" }] })
            .mockResolvedValueOnce({ rows: [] });

            await getBeneficiaryAccountBySearchDao(
            { "config->>type": "UPI" },
            1,
            10,
            "ADMIN",
            ["abc"],
            conn
            );

            expect(db.executeQuery).toHaveBeenCalled();
        });

        it("should build search query with array filter", async () => {
            db.isSafeColumnName.mockReturnValue(true);

            db.executeQuery
            .mockResolvedValueOnce({ rows: [{ total: "1" }] })
            .mockResolvedValueOnce({ rows: [] });

            await getBeneficiaryAccountBySearchDao(
            { bank_name: ["SBI", "HDFC"] },
            1,
            10,
            "ADMIN",
            ["abc"],
            conn
            );

            expect(db.executeQuery).toHaveBeenCalledTimes(2);
        });

        it("should ignore invalid filter columns", async () => {
            db.isSafeColumnName.mockReturnValue(false);

            db.executeQuery
            .mockResolvedValueOnce({ rows: [{ total: "1" }] })
            .mockResolvedValueOnce({ rows: [] });

            await getBeneficiaryAccountBySearchDao(
            { invalid_column: "test" },
            1,
            10,
            "ADMIN",
            ["abc"],
            conn
            );

            expect(db.executeQuery).toHaveBeenCalledTimes(2);
        });

        it("should build ADMIN select columns", async () => {
            db.executeQuery
            .mockResolvedValueOnce({ rows: [{ total: "1" }] })
            .mockResolvedValueOnce({ rows: [{ id: 1 }] });

            const res = await getBeneficiaryAccountBySearchDao(
            {},
            1,
            10,
            "ADMIN",
            ["x"],
            conn
            );

            expect(res.bankAccounts).toEqual([{ id: 1 }]);
        });

        it("should build MERCHANT select columns", async () => {
            db.executeQuery
            .mockResolvedValueOnce({ rows: [{ total: "1" }] })
            .mockResolvedValueOnce({ rows: [] });

            await getBeneficiaryAccountBySearchDao({}, 1, 10, "MERCHANT", ["x"], conn);

            expect(db.executeQuery).toHaveBeenCalledTimes(2);
        });

        it("should build VENDOR select columns", async () => {
            db.executeQuery
            .mockResolvedValueOnce({ rows: [{ total: "1" }] })
            .mockResolvedValueOnce({ rows: [] });

            await getBeneficiaryAccountBySearchDao({}, 1, 10, "VENDOR", ["x"], conn);

            expect(db.executeQuery).toHaveBeenCalledTimes(2);
        });

        it("should calculate pagination offset correctly", async () => {
            db.executeQuery
            .mockResolvedValueOnce({ rows: [{ total: "20" }] })
            .mockResolvedValueOnce({ rows: [] });

            await getBeneficiaryAccountBySearchDao({}, 3, 10, "ADMIN", ["x"], conn);

            expect(db.executeQuery).toHaveBeenCalledTimes(2);
        });

        it("should omit pagination when page is undefined", async () => {
            db.executeQuery
            .mockResolvedValueOnce({ rows: [{ total: "10" }] })
            .mockResolvedValueOnce({ rows: [] });

            await getBeneficiaryAccountBySearchDao({}, undefined, 10, "ADMIN", ["x"], conn);

            expect(db.executeQuery).toHaveBeenCalledTimes(2);
        });

        it("should execute query with provided connection", async () => {
            db.executeQuery
            .mockResolvedValueOnce({ rows: [{ total: "1" }] })
            .mockResolvedValueOnce({ rows: [] });

            await getBeneficiaryAccountBySearchDao({}, 1, 10, "ADMIN", ["x"], conn);

            expect(db.executeQuery).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(Array),
            conn
            );
        });

        it("should return empty rows", async () => {
            db.executeQuery
            .mockResolvedValueOnce({ rows: [{ total: "0" }] })
            .mockResolvedValueOnce({ rows: [] });

            const res = await getBeneficiaryAccountBySearchDao(
            {},
            1,
            10,
            "ADMIN",
            ["x"],
            conn
            );

            expect(res.bankAccounts).toEqual([]);
            expect(res.totalCount).toBe(0);
        });

        it("should log executeQuery errors", async () => {
            db.executeQuery.mockRejectedValue(new Error("DB error"));

            await expect(
            getBeneficiaryAccountBySearchDao({}, 1, 10, "ADMIN", ["x"], conn)
            ).rejects.toThrow("DB error");

            expect(logger.error).toHaveBeenCalled();
        });

        it("should rethrow executeQuery errors", async () => {
            db.executeQuery.mockRejectedValue(new Error("fail"));

            await expect(
            getBeneficiaryAccountBySearchDao({}, 1, 10, "ADMIN", ["x"], conn)
            ).rejects.toThrow("fail");
        });
    });

    describe("createBeneficiaryAccountDao", () => {
        const conn = {};

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should create beneficiary account successfully", async () => {
            const payload = {
            bank_name: "SBI",
            acc_no: "1234567890",
            };

            const row = { id: 1 };

            db.buildInsertQuery.mockReturnValue([
            "INSERT SQL",
            ["SBI", "1234567890"],
            ]);

            db.executeQuery.mockResolvedValue({
            rows: [row],
            });

            const result = await createBeneficiaryAccountDao(payload, conn);

            expect(result).toEqual(row);
        });

        it("should call buildInsertQuery with correct table name", async () => {
            const payload = { bank_name: "ICICI" };

            db.buildInsertQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockResolvedValue({ rows: [{}] });

            await createBeneficiaryAccountDao(payload, conn);

            expect(db.buildInsertQuery).toHaveBeenCalledWith(
            tableName.BENEFICIARY_ACCOUNTS,
            payload
            );
        });

        it("should call executeQuery with generated SQL and parameters", async () => {
            const payload = {
            bank_name: "Axis",
            };

            db.buildInsertQuery.mockReturnValue([
            "INSERT SQL",
            ["Axis"],
            ]);

            db.executeQuery.mockResolvedValue({
            rows: [{}],
            });

            await createBeneficiaryAccountDao(payload, conn);

            expect(db.executeQuery).toHaveBeenCalledWith(
            "INSERT SQL",
            ["Axis"],
            conn
            );
        });

        it("should return first inserted row", async () => {
            const row = {
            id: 99,
            bank_name: "HDFC",
            };

            db.buildInsertQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockResolvedValue({
            rows: [row],
            });

            const result = await createBeneficiaryAccountDao({}, conn);

            expect(result).toEqual(row);
        });

        it("should return undefined when no rows are returned", async () => {
            db.buildInsertQuery.mockReturnValue(["SQL", []]);

            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            const result = await createBeneficiaryAccountDao({}, conn);

            expect(result).toBeUndefined();
        });

        it("should use provided connection", async () => {
            db.buildInsertQuery.mockReturnValue(["SQL", []]);

            db.executeQuery.mockResolvedValue({
            rows: [{}],
            });

            await createBeneficiaryAccountDao({}, conn);

            expect(db.executeQuery).toHaveBeenCalledWith(
            "SQL",
            [],
            conn
            );
        });

        it("should work with null connection", async () => {
            db.buildInsertQuery.mockReturnValue(["SQL", []]);

            db.executeQuery.mockResolvedValue({
            rows: [{}],
            });

            await createBeneficiaryAccountDao({}, null);

            expect(db.executeQuery).toHaveBeenCalledWith(
            "SQL",
            [],
            null
            );
        });

        it("should log buildInsertQuery error", async () => {
            const error = new Error("Insert Query Error");

            db.buildInsertQuery.mockImplementation(() => {
            throw error;
            });

            await expect(
            createBeneficiaryAccountDao({}, conn)
            ).rejects.toThrow(error);

            expect(logger.error).toHaveBeenCalledWith(error);
        });

        it("should log executeQuery error", async () => {
            const error = new Error("Execute Error");

            db.buildInsertQuery.mockReturnValue(["SQL", []]);

            db.executeQuery.mockRejectedValue(error);

            await expect(
            createBeneficiaryAccountDao({}, conn)
            ).rejects.toThrow(error);

            expect(logger.error).toHaveBeenCalledWith(error);
        });

        it("should rethrow executeQuery error", async () => {
            const error = new Error("Database Error");

            db.buildInsertQuery.mockReturnValue(["SQL", []]);

            db.executeQuery.mockRejectedValue(error);

            await expect(
            createBeneficiaryAccountDao({}, conn)
            ).rejects.toThrow(error);
        });

        it("should preserve parameter order returned by buildInsertQuery", async () => {
            const params = [
            "John",
            "9876543210",
            "SBI",
            5,
            ];

            db.buildInsertQuery.mockReturnValue([
            "SQL",
            params,
            ]);

            db.executeQuery.mockResolvedValue({
            rows: [{}],
            });

            await createBeneficiaryAccountDao({}, conn);

            expect(db.executeQuery).toHaveBeenCalledWith(
            "SQL",
            params,
            conn
            );
        });
    });

    describe("createBeneficiaryAccountDao (Part 2)", () => {
        const conn = {};
        const payload = { acc_no: "123", bank_name: "HDFC" };

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should call buildInsertQuery with BeneficiaryAccounts table", async () => {
            db.buildInsertQuery.mockReturnValue(["SQL", ["p1"]]);
            db.executeQuery.mockResolvedValue({ rows: [{}] });

            await createBeneficiaryAccountDao(payload, conn);

            expect(db.buildInsertQuery).toHaveBeenCalledWith(
            "BeneficiaryAccounts",
            payload
            );
        });

        it("should pass payload to buildInsertQuery", async () => {
            db.buildInsertQuery.mockReturnValue(["SQL", ["p1"]]);
            db.executeQuery.mockResolvedValue({ rows: [{}] });

            await createBeneficiaryAccountDao(payload, conn);

            expect(db.buildInsertQuery).toHaveBeenCalledWith(
            expect.any(String),
            payload
            );
        });

        it("should execute generated insert query", async () => {
            db.buildInsertQuery.mockReturnValue(["INSERT_SQL", ["p1"]]);
            db.executeQuery.mockResolvedValue({ rows: [{}] });

            await createBeneficiaryAccountDao(payload, conn);

            expect(db.executeQuery).toHaveBeenCalledWith(
            "INSERT_SQL",
            ["p1"],
            conn
            );
        });

        it("should execute insert with transaction connection", async () => {
            db.buildInsertQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockResolvedValue({ rows: [{}] });

            await createBeneficiaryAccountDao(payload, conn);

            expect(db.executeQuery).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(Array),
            conn
            );
        });

        it("should return inserted row", async () => {
            const insertedRow = { id: 1 };

            db.buildInsertQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockResolvedValue({ rows: [insertedRow] });

            const result = await createBeneficiaryAccountDao(payload, conn);

            expect(result).toEqual(insertedRow);
        });

        it("should return null when insert returns no rows", async () => {
            db.buildInsertQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockResolvedValue({ rows: [] });

            const result = await createBeneficiaryAccountDao(payload, conn);

            expect(result).toBeUndefined();
        });

        it("should log buildInsertQuery error", async () => {
            db.buildInsertQuery.mockImplementation(() => {
            throw new Error("build failed");
            });

            await expect(
            createBeneficiaryAccountDao(payload, conn)
            ).rejects.toThrow("build failed");

            expect(logger.error).toHaveBeenCalled();
        });

        it("should log executeQuery error", async () => {
            db.buildInsertQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockRejectedValue(new Error("DB insert error"));

            await expect(
            createBeneficiaryAccountDao(payload, conn)
            ).rejects.toThrow("DB insert error");

            expect(logger.error).toHaveBeenCalled();
        });

        it("should rethrow insert error", async () => {
            db.buildInsertQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockRejectedValue(new Error("fail insert"));

            await expect(
            createBeneficiaryAccountDao(payload, conn)
            ).rejects.toThrow("fail insert");
        });

        it("should build insert only once", async () => {
            db.buildInsertQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockResolvedValue({ rows: [{}] });

            await createBeneficiaryAccountDao(payload, conn);

            expect(db.buildInsertQuery).toHaveBeenCalledTimes(1);
        });
    });

    describe("getBeneficiaryAccountDaoByBankName", () => {
        const conn = {};

        beforeEach(() => {
            jest.clearAllMocks();
            db.isSafeColumnName.mockReturnValue(true);
        });

        it("should return bank names successfully", async () => {
            const rows = [
            { label: "SBI", value: 1 },
            { label: "HDFC", value: 2 },
            ];

            db.executeQuery.mockResolvedValue({
            rowCount: 2,
            rows,
            });

            const result = await getBeneficiaryAccountDaoByBankName(
            1,
            "Personal",
            {},
            conn
            );

            expect(result).toEqual({
            totalCount: 2,
            bankNames: rows,
            });
        });

        it("should apply filters", async () => {
            db.executeQuery.mockResolvedValue({
            rowCount: 0,
            rows: [],
            });

            await getBeneficiaryAccountDaoByBankName(
            1,
            "Personal",
            {
                user_id: 10,
            },
            conn
            );

            const [sql, params] = db.executeQuery.mock.calls[0];

            expect(sql).toContain('"user_id" = $1');
            expect(params).toEqual([10]);
        });

        it("should use first element from array filter", async () => {
            db.executeQuery.mockResolvedValue({
            rowCount: 0,
            rows: [],
            });

            await getBeneficiaryAccountDaoByBankName(
            1,
            "Personal",
            {
                user_id: [25],
            },
            conn
            );

            const [, params] = db.executeQuery.mock.calls[0];

            expect(params).toEqual([25]);
        });

        it("should ignore empty filters", async () => {
            db.executeQuery.mockResolvedValue({
            rowCount: 0,
            rows: [],
            });

            await getBeneficiaryAccountDaoByBankName(
            1,
            "Personal",
            {},
            conn
            );

            const [sql, params] = db.executeQuery.mock.calls[0];

            expect(sql).toContain("is_obsolete = false");
            expect(params).toEqual([]);
        });

        it("should ignore invalid column names", async () => {
            db.isSafeColumnName.mockImplementation(
            (column) => column === "user_id"
            );

            db.executeQuery.mockResolvedValue({
            rowCount: 0,
            rows: [],
            });

            await getBeneficiaryAccountDaoByBankName(
            1,
            "Personal",
            {
                invalid: "abc",
                user_id: 7,
            },
            conn
            );

            const [sql, params] = db.executeQuery.mock.calls[0];

            expect(sql).not.toContain('"invalid"');
            expect(sql).toContain('"user_id" = $1');
            expect(params).toEqual([7]);
        });

        it("should build correct SQL", async () => {
            db.executeQuery.mockResolvedValue({
            rowCount: 0,
            rows: [],
            });

            await getBeneficiaryAccountDaoByBankName(
            1,
            "Personal",
            {},
            conn
            );

            const [sql] = db.executeQuery.mock.calls[0];

            expect(sql).toContain(
            'SELECT bank_name AS label, id AS value'
            );
            expect(sql).toContain(
            'FROM "BeneficiaryAccounts"'
            );
            expect(sql).toContain("ORDER BY bank_name ASC");
            expect(sql).toContain("is_obsolete = false");
        });

        it("should return correct totalCount", async () => {
            db.executeQuery.mockResolvedValue({
            rowCount: 5,
            rows: [],
            });

            const result = await getBeneficiaryAccountDaoByBankName(
            1,
            "Personal",
            {},
            conn
            );

            expect(result.totalCount).toBe(5);
        });

        it("should use provided connection", async () => {
            db.executeQuery.mockResolvedValue({
            rowCount: 0,
            rows: [],
            });

            await getBeneficiaryAccountDaoByBankName(
            1,
            "Personal",
            {},
            conn
            );

            expect(db.executeQuery).toHaveBeenCalledWith(
            expect.any(String),
            [],
            conn
            );
        });

        it("should work with null connection", async () => {
            db.executeQuery.mockResolvedValue({
            rowCount: 0,
            rows: [],
            });

            await getBeneficiaryAccountDaoByBankName(
            1,
            "Personal",
            {},
            null
            );

            expect(db.executeQuery).toHaveBeenCalledWith(
            expect.any(String),
            [],
            null
            );
        });

        it("should log executeQuery errors", async () => {
            const error = new Error("DB Error");

            db.executeQuery.mockRejectedValue(error);

            await expect(
            getBeneficiaryAccountDaoByBankName(
                1,
                "Personal",
                {},
                conn
            )
            ).rejects.toThrow(error);

            expect(logger.error).toHaveBeenCalledWith(
            "Error querying bank accounts:",
            error.message,
            error.stack
            );
        });

        it("should rethrow executeQuery errors", async () => {
            const error = new Error("Unexpected");

            db.executeQuery.mockRejectedValue(error);

            await expect(
            getBeneficiaryAccountDaoByBankName(
                1,
                "Personal",
                {},
                conn
            )
            ).rejects.toThrow(error);
        });
    });

    describe("getBeneficiaryAccountDaoByBankName (Part 2)", () => {
        const conn = {};

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should query beneficiary by bank id", async () => {
            db.isSafeColumnName.mockReturnValue(true);
            db.executeQuery.mockResolvedValue({
            rowCount: 1,
            rows: [{ label: "HDFC", value: 1 }],
            });

            const res = await getBeneficiaryAccountDaoByBankName(
            "COMP1",
            "BANK",
            { bank_name: "HDFC" },
            conn
            );

            expect(res.bankNames).toEqual([{ label: "HDFC", value: 1 }]);
        });

        it("should query beneficiary by type", async () => {
            db.isSafeColumnName.mockReturnValue(true);

            db.executeQuery.mockResolvedValue({
            rowCount: 1,
            rows: [{ label: "SBI", value: 2 }],
            });

            const res = await getBeneficiaryAccountDaoByBankName(
            "COMP1",
            "TYPE",
            { type: "SAVINGS" },
            conn
            );

            expect(res.totalCount).toBe(1);
        });

        it("should apply user_id filter", async () => {
            db.isSafeColumnName.mockReturnValue(true);

            db.executeQuery.mockResolvedValue({
            rowCount: 1,
            rows: [{ label: "ICICI", value: 3 }],
            });

            await getBeneficiaryAccountDaoByBankName(
            "COMP1",
            "BANK",
            { user_id: "123" },
            conn
            );

            expect(db.executeQuery).toHaveBeenCalled();
        });

        it("should apply multiple user_id filter", async () => {
            db.isSafeColumnName.mockReturnValue(true);

            db.executeQuery.mockResolvedValue({
            rowCount: 1,
            rows: [],
            });

            await getBeneficiaryAccountDaoByBankName(
            "COMP1",
            "BANK",
            { user_id: ["1", "2"] },
            conn
            );

            expect(db.executeQuery).toHaveBeenCalled();
        });

        it("should apply JSON filter", async () => {
            db.isSafeColumnName.mockReturnValue(true);

            db.executeQuery.mockResolvedValue({
            rowCount: 1,
            rows: [],
            });

            await getBeneficiaryAccountDaoByBankName(
            "COMP1",
            "BANK",
            { "config->>type": "UPI" },
            conn
            );

            expect(db.executeQuery).toHaveBeenCalled();
        });

        it("should ignore invalid filter columns", async () => {
            db.isSafeColumnName.mockReturnValue(false);

            db.executeQuery.mockResolvedValue({
            rowCount: 1,
            rows: [],
            });

            await getBeneficiaryAccountDaoByBankName(
            "COMP1",
            "BANK",
            { invalid_col: "x" },
            conn
            );

            expect(db.executeQuery).toHaveBeenCalled();
        });

        it("should execute query with connection", async () => {
            db.isSafeColumnName.mockReturnValue(true);

            db.executeQuery.mockResolvedValue({
            rowCount: 0,
            rows: [],
            });

            await getBeneficiaryAccountDaoByBankName(
            "COMP1",
            "BANK",
            { bank_name: "HDFC" },
            conn
            );

            expect(db.executeQuery).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(Array),
            conn
            );
        });

        it("should return empty rows", async () => {
            db.isSafeColumnName.mockReturnValue(true);

            db.executeQuery.mockResolvedValue({
            rowCount: 0,
            rows: [],
            });

            const res = await getBeneficiaryAccountDaoByBankName(
            "COMP1",
            "BANK",
            {},
            conn
            );

            expect(res.bankNames).toEqual([]);
            expect(res.totalCount).toBe(0);
        });

        it("should return DAO rows directly", async () => {
            db.isSafeColumnName.mockReturnValue(true);

            db.executeQuery.mockResolvedValue({
            rowCount: 2,
            rows: [
                { label: "A", value: 1 },
                { label: "B", value: 2 },
            ],
            });

            const res = await getBeneficiaryAccountDaoByBankName(
            "COMP1",
            "BANK",
            {},
            conn
            );

            expect(res.bankNames.length).toBe(2);
        });

        it("should log executeQuery errors", async () => {
            db.isSafeColumnName.mockReturnValue(true);

            db.executeQuery.mockRejectedValue(new Error("DB error"));

            await expect(
            getBeneficiaryAccountDaoByBankName(
                "COMP1",
                "BANK",
                {},
                conn
            )
            ).rejects.toThrow("DB error");

            expect(logger.error).toHaveBeenCalled();
        });

        it("should rethrow executeQuery errors", async () => {
            db.isSafeColumnName.mockReturnValue(true);

            db.executeQuery.mockRejectedValue(new Error("fail"));

            await expect(
            getBeneficiaryAccountDaoByBankName(
                "COMP1",
                "BANK",
                {},
                conn
            )
            ).rejects.toThrow("fail");
        });

        it("should preserve parameter ordering", async () => {
            db.isSafeColumnName.mockReturnValue(true);

            db.executeQuery.mockResolvedValue({
            rowCount: 1,
            rows: [],
            });

            await getBeneficiaryAccountDaoByBankName(
            "COMP1",
            "BANK",
            { bank_name: "HDFC", user_id: "123" },
            conn
            );

            expect(db.executeQuery).toHaveBeenCalled();
        });
    });

    describe("updateBeneficiaryAccountDao", () => {
        const conn = {};

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should update beneficiary account successfully", async () => {
            const row = { id: 1 };

            db.buildAndExecuteUpdateQuery.mockResolvedValue(row);

            const result = await updateBeneficiaryAccountDao(
            { id: 1 },
            { bank_name: "SBI" },
            conn
            );

            expect(result).toEqual(row);
        });

        it("should call buildAndExecuteUpdateQuery correctly", async () => {
            db.buildAndExecuteUpdateQuery.mockResolvedValue({ id: 1 });

            const id = { id: 1 };
            const payload = { bank_name: "ICICI" };

            await updateBeneficiaryAccountDao(id, payload, conn);

            expect(db.buildAndExecuteUpdateQuery).toHaveBeenCalledWith(
            tableName.BENEFICIARY_ACCOUNTS,
            payload,
            id,
            {},
            { returnUpdated: true },
            conn
            );
        });

        it("should return updated row", async () => {
            const row = { id: 10 };

            db.buildAndExecuteUpdateQuery.mockResolvedValue(row);

            const result = await updateBeneficiaryAccountDao({}, {}, conn);

            expect(result).toEqual(row);
        });

        it("should return undefined when no row returned", async () => {
            db.buildAndExecuteUpdateQuery.mockResolvedValue(undefined);

            const result = await updateBeneficiaryAccountDao({}, {}, conn);

            expect(result).toBeUndefined();
        });

        it("should use provided connection", async () => {
            db.buildAndExecuteUpdateQuery.mockResolvedValue({});

            await updateBeneficiaryAccountDao({}, {}, conn);

            expect(db.buildAndExecuteUpdateQuery).toHaveBeenCalledWith(
            expect.any(String),
            {},
            {},
            {},
            { returnUpdated: true },
            conn
            );
        });

        it("should work with null connection", async () => {
            db.buildAndExecuteUpdateQuery.mockResolvedValue({});

            await updateBeneficiaryAccountDao({}, {}, null);

            expect(db.buildAndExecuteUpdateQuery).toHaveBeenCalledWith(
            expect.any(String),
            {},
            {},
            {},
            { returnUpdated: true },
            null
            );
        });

        it("should log build/update errors", async () => {
            const error = new Error("Update Error");

            db.buildAndExecuteUpdateQuery.mockRejectedValue(error);

            await expect(
            updateBeneficiaryAccountDao({}, {}, conn)
            ).rejects.toThrow(error);

            expect(logger.error).toHaveBeenCalledWith(
            "Error in updateBeneficiaryAccountDao:",
            error
            );
        });

        it("should rethrow update errors", async () => {
            const error = new Error("Unexpected");

            db.buildAndExecuteUpdateQuery.mockRejectedValue(error);

            await expect(
            updateBeneficiaryAccountDao({}, {}, conn)
            ).rejects.toThrow(error);
        });
    });

    describe("updateBeneficiaryAccountDao (Part 2)", () => {
        const conn = {};
        const payload = { bank_name: "HDFC" };
        const id = 1;

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should call buildUpdateQuery", async () => {
            db.buildAndExecuteUpdateQuery.mockResolvedValue({ id: 1 });

            await updateBeneficiaryAccountDao(id, payload, conn);

            expect(db.buildAndExecuteUpdateQuery).toHaveBeenCalled();
        });

        it("should execute update query", async () => {
            db.buildAndExecuteUpdateQuery.mockResolvedValue({ id: 1 });

            const res = await updateBeneficiaryAccountDao(id, payload, conn);

            expect(res).toEqual({ id: 1 });
        });

        it("should pass ids correctly", async () => {
            db.buildAndExecuteUpdateQuery.mockResolvedValue({ id: 1 });

            await updateBeneficiaryAccountDao(id, payload, conn);

            expect(db.buildAndExecuteUpdateQuery).toHaveBeenCalledWith(
            "BeneficiaryAccounts",
            payload,
            id,
            {},
            { returnUpdated: true },
            conn
            );
        });

        it("should execute update with transaction connection", async () => {
            db.buildAndExecuteUpdateQuery.mockResolvedValue({ id: 1 });

            await updateBeneficiaryAccountDao(id, payload, conn);

            expect(db.buildAndExecuteUpdateQuery).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(Object),
            expect.anything(),
            expect.any(Object),
            expect.any(Object),
            conn
            );
        });

        it("should return updated row", async () => {
            db.buildAndExecuteUpdateQuery.mockResolvedValue({ id: 99, bank: "ICICI" });

            const res = await updateBeneficiaryAccountDao(id, payload, conn);

            expect(res).toEqual({ id: 99, bank: "ICICI" });
        });

        it("should log buildUpdateQuery error", async () => {
            db.buildAndExecuteUpdateQuery.mockRejectedValue(
            new Error("build update failed")
            );

            await expect(
            updateBeneficiaryAccountDao(id, payload, conn)
            ).rejects.toThrow("build update failed");

            expect(logger.error).toHaveBeenCalled();
        });

        it("should log executeQuery error", async () => {
            db.buildAndExecuteUpdateQuery.mockRejectedValue(
            new Error("DB update error")
            );

            await expect(
            updateBeneficiaryAccountDao(id, payload, conn)
            ).rejects.toThrow("DB update error");

            expect(logger.error).toHaveBeenCalled();
        });

        it("should rethrow update error", async () => {
            db.buildAndExecuteUpdateQuery.mockRejectedValue(
            new Error("update failed")
            );

            await expect(
            updateBeneficiaryAccountDao(id, payload, conn)
            ).rejects.toThrow("update failed");
        });
    });

    describe("deleteBeneficiaryDao", () => {
        const conn = {};

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should delete beneficiary successfully", async () => {
            db.buildUpdateQuery.mockReturnValue([
            "UPDATE SQL",
            [true, 1],
            ]);

            db.executeQuery.mockResolvedValue({
            rows: [{ id: 1 }],
            });

            const result = await deleteBeneficiaryDao(
            { id: 1 },
            { is_obsolete: true },
            conn
            );

            expect(result).toEqual({ id: 1 });
        });

        it("should call buildUpdateQuery correctly", async () => {
            const id = { id: 5 };
            const payload = { is_obsolete: true };

            db.buildUpdateQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockResolvedValue({ rows: [{}] });

            await deleteBeneficiaryDao(id, payload, conn);

            expect(db.buildUpdateQuery).toHaveBeenCalledWith(
            tableName.BENEFICIARY_ACCOUNTS,
            payload,
            id
            );
        });

        it("should call executeQuery correctly", async () => {
            db.buildUpdateQuery.mockReturnValue([
            "UPDATE SQL",
            [1, 2],
            ]);

            db.executeQuery.mockResolvedValue({
            rows: [{}],
            });

            await deleteBeneficiaryDao({}, {}, conn);

            expect(db.executeQuery).toHaveBeenCalledWith(
            "UPDATE SQL",
            [1, 2],
            conn
            );
        });

        it("should return deleted row", async () => {
            const row = { id: 50 };

            db.buildUpdateQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockResolvedValue({
            rows: [row],
            });

            const result = await deleteBeneficiaryDao({}, {}, conn);

            expect(result).toEqual(row);
        });

        it("should return undefined when no rows returned", async () => {
            db.buildUpdateQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            const result = await deleteBeneficiaryDao({}, {}, conn);

            expect(result).toBeUndefined();
        });

        it("should use provided connection", async () => {
            db.buildUpdateQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockResolvedValue({
            rows: [{}],
            });

            await deleteBeneficiaryDao({}, {}, conn);

            expect(db.executeQuery).toHaveBeenCalledWith(
            "SQL",
            [],
            conn
            );
        });

        it("should work with null connection", async () => {
            db.buildUpdateQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockResolvedValue({
            rows: [{}],
            });

            await deleteBeneficiaryDao({}, {}, null);

            expect(db.executeQuery).toHaveBeenCalledWith(
            "SQL",
            [],
            null
            );
        });

        it("should log buildUpdateQuery errors", async () => {
            const error = new Error("Build Error");

            db.buildUpdateQuery.mockImplementation(() => {
            throw error;
            });

            await expect(
            deleteBeneficiaryDao({}, {}, conn)
            ).rejects.toThrow(error);

            expect(logger.error).toHaveBeenCalledWith(
            "Error in deleteBeneficiaryDao:",
            error
            );
        });

        it("should log executeQuery errors", async () => {
            const error = new Error("Execute Error");

            db.buildUpdateQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockRejectedValue(error);

            await expect(
            deleteBeneficiaryDao({}, {}, conn)
            ).rejects.toThrow(error);

            expect(logger.error).toHaveBeenCalledWith(
            "Error in deleteBeneficiaryDao:",
            error
            );
        });

        it("should rethrow executeQuery errors", async () => {
            const error = new Error("Unexpected");

            db.buildUpdateQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockRejectedValue(error);

            await expect(
            deleteBeneficiaryDao({}, {}, conn)
            ).rejects.toThrow(error);
        });
    });

    describe("deleteBeneficiaryDao (Part 2)", () => {
        const conn = {};
        const id = 1;
        const data = { is_obsolete: true };

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should call buildUpdateQuery", async () => {
            db.buildUpdateQuery.mockReturnValue(["SQL", ["p1"]]);
            db.executeQuery.mockResolvedValue({ rows: [{}] });

            await deleteBeneficiaryDao(id, data, conn);

            expect(db.buildUpdateQuery).toHaveBeenCalled();
        });

        it("should soft delete beneficiary account", async () => {
            db.buildUpdateQuery.mockReturnValue(["SQL", ["p1"]]);
            db.executeQuery.mockResolvedValue({ rows: [{ id: 1, is_obsolete: true }] });

            const res = await deleteBeneficiaryDao(id, data, conn);

            expect(res).toEqual({ id: 1, is_obsolete: true });
        });

        it("should pass ids correctly", async () => {
            db.buildUpdateQuery.mockReturnValue(["SQL", ["p1"]]);
            db.executeQuery.mockResolvedValue({ rows: [{}] });

            await deleteBeneficiaryDao(id, data, conn);

            expect(db.buildUpdateQuery).toHaveBeenCalledWith(
            "BeneficiaryAccounts",
            data,
            id
            );
        });

        it("should execute delete with transaction connection", async () => {
            db.buildUpdateQuery.mockReturnValue(["SQL", ["p1"]]);
            db.executeQuery.mockResolvedValue({ rows: [{}] });

            await deleteBeneficiaryDao(id, data, conn);

            expect(db.executeQuery).toHaveBeenCalledWith(
            "SQL",
            ["p1"],
            conn
            );
        });

        it("should return updated row", async () => {
            db.buildUpdateQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockResolvedValue({
            rows: [{ id: 99, is_obsolete: true }],
            });

            const res = await deleteBeneficiaryDao(id, data, conn);

            expect(res).toEqual({ id: 99, is_obsolete: true });
        });

        it("should log buildAndExecuteUpdateQuery error", async () => {
            db.buildUpdateQuery.mockImplementation(() => {
            throw new Error("build delete failed");
            });

            await expect(
            deleteBeneficiaryDao(id, data, conn)
            ).rejects.toThrow("build delete failed");

            expect(logger.error).toHaveBeenCalled();
        });

        it("should log delete query error", async () => {
            db.buildUpdateQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockRejectedValue(new Error("DB delete error"));

            await expect(
            deleteBeneficiaryDao(id, data, conn)
            ).rejects.toThrow("DB delete error");

            expect(logger.error).toHaveBeenCalled();
        });

        it("should rethrow delete query error", async () => {
            db.buildUpdateQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockRejectedValue(new Error("delete failed"));

            await expect(
            deleteBeneficiaryDao(id, data, conn)
            ).rejects.toThrow("delete failed");
        });
    });

    describe("updateBanktBalanceDao", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should update bank balance successfully", async () => {
            db.buildUpdateQuery.mockReturnValue([
            "UPDATE SQL",
            [100, 100, 9, 1],
            ]);

            db.executeQuery.mockResolvedValue({
            rows: [{ id: 1, balance: 100 }],
            });

            const result = await updateBanktBalanceDao(
            { id: 1 },
            100,
            9
            );

            expect(result).toEqual({ id: 1, balance: 100 });
        });

        it("should call buildUpdateQuery with correct arguments", async () => {
            db.buildUpdateQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockResolvedValue({ rows: [{}] });

            await updateBanktBalanceDao(
            { id: 10 },
            500,
            99
            );

            expect(db.buildUpdateQuery).toHaveBeenCalledWith(
            tableName.BENEFICIARY_ACCOUNTS,
            {
                balance: 500,
                today_balance: 500,
                updated_by: 99,
            },
            { id: 10 },
            {
                balance: "+",
                today_balance: "+",
            }
            );
        });

        it("should verify increment operators", async () => {
            db.buildUpdateQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockResolvedValue({ rows: [{}] });

            await updateBanktBalanceDao(
            { id: 7 },
            250,
            3
            );

            expect(
            db.buildUpdateQuery.mock.calls[0][3]
            ).toEqual({
            balance: "+",
            today_balance: "+",
            });
        });

        it("should call executeQuery correctly", async () => {
            db.buildUpdateQuery.mockReturnValue([
            "UPDATE SQL",
            [250, 250, 5, 1],
            ]);

            db.executeQuery.mockResolvedValue({
            rows: [{}],
            });

            const conn = {};

            await updateBanktBalanceDao(
            { id: 1 },
            250,
            5,
            conn
            );

            expect(db.executeQuery).toHaveBeenCalledWith(
            "UPDATE SQL",
            [250, 250, 5, 1],
            conn
            );
        });

        it("should return updated row", async () => {
            const row = {
            id: 2,
            balance: 900,
            };

            db.buildUpdateQuery.mockReturnValue(["SQL", []]);

            db.executeQuery.mockResolvedValue({
            rows: [row],
            });

            const result = await updateBanktBalanceDao(
            { id: 2 },
            900,
            1
            );

            expect(result).toEqual(row);
        });

        it("should return undefined when no rows returned", async () => {
            db.buildUpdateQuery.mockReturnValue(["SQL", []]);

            db.executeQuery.mockResolvedValue({
            rows: [],
            });

            const result = await updateBanktBalanceDao(
            { id: 1 },
            100,
            5
            );

            expect(result).toBeUndefined();
        });

        it("should use provided connection", async () => {
            const conn = {};

            db.buildUpdateQuery.mockReturnValue(["SQL", []]);

            db.executeQuery.mockResolvedValue({
            rows: [{}],
            });

            await updateBanktBalanceDao(
            { id: 1 },
            100,
            5,
            conn
            );

            expect(db.executeQuery).toHaveBeenCalledWith(
            "SQL",
            [],
            conn
            );
        });

        it("should work with null connection", async () => {
            db.buildUpdateQuery.mockReturnValue(["SQL", []]);

            db.executeQuery.mockResolvedValue({
            rows: [{}],
            });

            await updateBanktBalanceDao(
            { id: 1 },
            100,
            5,
            null
            );

            expect(db.executeQuery).toHaveBeenCalledWith(
            "SQL",
            [],
            null
            );
        });

        it("should log buildUpdateQuery error", async () => {
            const error = new Error("build failed");

            db.buildUpdateQuery.mockImplementation(() => {
            throw error;
            });

            await expect(
            updateBanktBalanceDao(
                { id: 1 },
                100,
                5
            )
            ).rejects.toThrow(error);

            expect(logger.error).toHaveBeenCalled();
        });

        it("should log executeQuery error", async () => {
            const error = new Error("db failed");

            db.buildUpdateQuery.mockReturnValue([
            "SQL",
            [],
            ]);

            db.executeQuery.mockRejectedValue(error);

            await expect(
            updateBanktBalanceDao(
                { id: 1 },
                100,
                5
            )
            ).rejects.toThrow(error);

            expect(logger.error).toHaveBeenCalledWith(error);
        });

        it("should preserve parameter order", async () => {
            const params = [
            100,
            100,
            9,
            1,
            ];

            db.buildUpdateQuery.mockReturnValue([
            "SQL",
            params,
            ]);

            db.executeQuery.mockResolvedValue({
            rows: [{}],
            });

            await updateBanktBalanceDao(
            { id: 1 },
            100,
            9
            );

            expect(
            db.executeQuery.mock.calls[0][1]
            ).toEqual(params);
        });
    });

    describe("updateBankBalanceDao (Part 2)", () => {
        const conn = {};
        const filters = { id: 1 };
        const amount = 500;
        const updated_by = 10;

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should update closing balance", async () => {
            db.buildUpdateQuery.mockReturnValue(["SQL", ["p1"]]);
            db.executeQuery.mockResolvedValue({
            rows: [{ id: 1, balance: 500 }],
            });

            const res = await updateBanktBalanceDao(
            filters,
            amount,
            updated_by,
            conn
            );

            expect(res.balance).toBe(500);
        });

        it("should update config JSON", async () => {
            db.buildUpdateQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockResolvedValue({ rows: [{}] });

            await updateBanktBalanceDao(filters, amount, updated_by, conn);

            expect(db.buildUpdateQuery).toHaveBeenCalled();
        });

        it("should call buildUpdateQuery", async () => {
            db.buildUpdateQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockResolvedValue({ rows: [{}] });

            await updateBanktBalanceDao(filters, amount, updated_by, conn);

            expect(db.buildUpdateQuery).toHaveBeenCalledWith(
            "BeneficiaryAccounts",
            expect.objectContaining({
                balance: amount,
                today_balance: amount,
                updated_by,
            }),
            filters,
            { balance: "+", today_balance: "+" }
            );
        });

        it("should execute update query", async () => {
            db.buildUpdateQuery.mockReturnValue(["SQL", ["x"]]);
            db.executeQuery.mockResolvedValue({ rows: [{}] });

            await updateBanktBalanceDao(filters, amount, updated_by, conn);

            expect(db.executeQuery).toHaveBeenCalledWith(
            "SQL",
            ["x"],
            conn
            );
        });

        it("should execute update with transaction connection", async () => {
            db.buildUpdateQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockResolvedValue({ rows: [{}] });

            await updateBanktBalanceDao(filters, amount, updated_by, conn);

            expect(db.executeQuery).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(Array),
            conn
            );
        });

        it("should return updated row", async () => {
            db.buildUpdateQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockResolvedValue({
            rows: [{ id: 99, balance: 999 }],
            });

            const res = await updateBanktBalanceDao(
            filters,
            amount,
            updated_by,
            conn
            );

            expect(res).toEqual({ id: 99, balance: 999 });
        });

        it("should log executeQuery error", async () => {
            db.buildUpdateQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockRejectedValue(new Error("DB update failed"));

            await expect(
            updateBanktBalanceDao(filters, amount, updated_by, conn)
            ).rejects.toThrow("DB update failed");

            expect(logger.error).toHaveBeenCalled();
        });

        it("should rethrow executeQuery error", async () => {
            db.buildUpdateQuery.mockReturnValue(["SQL", []]);
            db.executeQuery.mockRejectedValue(new Error("fail update"));

            await expect(
            updateBanktBalanceDao(filters, amount, updated_by, conn)
            ).rejects.toThrow("fail update");
        });
    });
});
