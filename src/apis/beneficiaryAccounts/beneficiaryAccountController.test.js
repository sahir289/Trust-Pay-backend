import { jest } from "@jest/globals";

jest.unstable_mockModule("../../constants/index.js", () => ({
  Role: {
    ADMIN: "ADMIN",
    MERCHANT: "MERCHANT",
    VENDOR: "VENDOR",
    SUB_MERCHANT: "SUB_MERCHANT",
    MERCHANT_OPERATIONS: "MERCHANT_OPERATIONS",
    VENDOR_ADMIN: "VENDOR_ADMIN",
    SUB_VENDOR: "SUB_VENDOR",
    VENDOR_OPERATIONS: "VENDOR_OPERATIONS",
  },
}));

jest.unstable_mockModule(
  "../../schemas/BeneficiaryAccountSchema.js",
  () => ({
    BENEFICIARY_ACCOUNT_SCHEMA: {
      validate: jest.fn(),
    },
    UPDATE_BENEFICIARY_ACCOUNT_SCHEMA: {
      validate: jest.fn(),
    },
    VALIDATE_BENEFICIARY_ACCOUNT_BY_ID: {
      validate: jest.fn(),
    },
  })
);

jest.unstable_mockModule("../../utils/appErrors.js", () => ({
  ValidationError: class ValidationError extends Error {
    constructor(message) {
      super(message);
      this.name = "ValidationError";
    }
  },
}));

jest.unstable_mockModule("../../utils/logger.js", () => ({
  logger: {
    log: jest.fn(),
    error: jest.fn(),
  },
}));

jest.unstable_mockModule("../../utils/responseHandlers.js", () => ({
  sendSuccess: jest.fn(),
}));

jest.unstable_mockModule("../../utils/redishashkey.js", () => ({
  generateCacheKey: jest.fn(),
}));

jest.unstable_mockModule("../../utils/controllerCache.js", () => ({
  normalizeQueryForCache: jest.fn(),
  readJsonCache: jest.fn(),
  shouldServeCachedResponse: jest.fn(),
  writeJsonCache: jest.fn(),
  invalidateCompanyCacheByPrefix: jest.fn(),
}));

jest.unstable_mockModule("../../config/config.js", () => ({
  default: {
    controllerCacheTtls: {
      beneficiary: {
        list: 300,
        search: 300,
        byBankName: 300,
        byId: 300,
      },
    },
  },
}));

jest.unstable_mockModule("./beneficiaryAccountServices.js", () => ({
  getBeneficiaryAccountService: jest.fn(),
  createBeneficiaryAccountService: jest.fn(),
  updateBeneficiaryAccountService: jest.fn(),
  deleteBeneficiaryAccountService: jest.fn(),
  getBeneficiaryAccountServiceByBankName: jest.fn(),
  getBeneficiaryAccountBySearchService: jest.fn(),
}));

const { Role } = await import("../../constants/index.js");

const {
  BENEFICIARY_ACCOUNT_SCHEMA,
  UPDATE_BENEFICIARY_ACCOUNT_SCHEMA,
  VALIDATE_BENEFICIARY_ACCOUNT_BY_ID,
} = await import("../../schemas/BeneficiaryAccountSchema.js");

const { ValidationError } = await import("../../utils/appErrors.js");

const { logger } = await import("../../utils/logger.js");

const { sendSuccess } = await import(
  "../../utils/responseHandlers.js"
);

const {
  generateCacheKey,
} = await import("../../utils/redishashkey.js");

const cache = await import("../../utils/controllerCache.js");

const beneficiaryService = await import(
  "./beneficiaryAccountServices.js"
);
const config =
  (await import("../../config/config.js")).default;
const {
  getBeneficiaryAccount,
  getBeneficiaryAccountBySearch,
  getBeneficiaryAccountById,
  createBeneficiaryAccount,
  updateBeneficiaryAccount,
  deleteBeneficiaryAccount,
  getBeneficiaryAccountByBankName,
} = await import("./beneficiaryAccountController.js");

let req;
let res;
describe("Beneficiary Account Controller", () => {
    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            user: {
            user_id: 1,
            company_id: 100,
            role: Role.ADMIN,
            designation: Role.ADMIN,
            },
            query: {},
            params: {},
            body: {},
        };

        res = {};

        BENEFICIARY_ACCOUNT_SCHEMA.validate.mockReturnValue({
            error: null,
        });

        UPDATE_BENEFICIARY_ACCOUNT_SCHEMA.validate.mockReturnValue({
            error: null,
        });

        VALIDATE_BENEFICIARY_ACCOUNT_BY_ID.validate.mockReturnValue({
            error: null,
        });

        generateCacheKey.mockReturnValue("cache-key");

        cache.normalizeQueryForCache.mockImplementation((q) => q);

        cache.readJsonCache.mockResolvedValue(null);

        cache.shouldServeCachedResponse.mockReturnValue(false);

        cache.writeJsonCache.mockResolvedValue();

        cache.invalidateCompanyCacheByPrefix.mockResolvedValue();

        sendSuccess.mockReturnValue({
            success: true,
        });
    });

    describe("getBeneficiaryAccount - Cache", () => {
        beforeEach(() => {
            beneficiaryService.getBeneficiaryAccountService.mockResolvedValue([
            { id: 1 },
            ]);

            cache.writeJsonCache.mockResolvedValue();
        });

        it("should return cached response when cache exists", async () => {
            const cached = [{ id: 99 }];

            cache.readJsonCache.mockResolvedValue(cached);
            cache.shouldServeCachedResponse.mockReturnValue(true);

            await getBeneficiaryAccount(req, res);

            expect(sendSuccess).toHaveBeenCalledWith(
            res,
            cached,
            "get Beneficiary successfully"
            );
        });

        it("should skip service call when cache is hit", async () => {
            cache.readJsonCache.mockResolvedValue([{ id: 1 }]);
            cache.shouldServeCachedResponse.mockReturnValue(true);

            await getBeneficiaryAccount(req, res);

            expect(
            beneficiaryService.getBeneficiaryAccountService
            ).not.toHaveBeenCalled();

            expect(cache.writeJsonCache).not.toHaveBeenCalled();
        });

        it("should write cache after successful service response", async () => {
            beneficiaryService.getBeneficiaryAccountService.mockResolvedValue([
            { id: 10 },
            ]);

            await getBeneficiaryAccount(req, res);

            expect(cache.writeJsonCache).toHaveBeenCalledWith(
            expect.any(String),
            [{ id: 10 }],
            300
            );
        });

        it("should generate correct cache key", async () => {
            generateCacheKey.mockReturnValue("generated-key");

            await getBeneficiaryAccount(req, res);

            expect(generateCacheKey).toHaveBeenCalledWith(
            expect.objectContaining({
                company_id: 100,
                role: Role.ADMIN,
                user_id: 1,
                designation: Role.ADMIN,
                page: undefined,
                limit: undefined,
            }),
            "beneficiary-list"
            );

            expect(cache.readJsonCache).toHaveBeenCalledWith(
            "beneficiary:read:100:list:generated-key",
            "Beneficiary list cache"
            );
        });

        it("should normalize query before cache key generation", async () => {
            req.query = {
            page: "1",
            limit: "10",
            };

            await getBeneficiaryAccount(req, res);

            expect(
            cache.normalizeQueryForCache
            ).toHaveBeenCalledWith(req.query);
        });

        it("should call shouldServeCachedResponse", async () => {
            cache.readJsonCache.mockResolvedValue(null);

            await getBeneficiaryAccount(req, res);

            expect(
            cache.shouldServeCachedResponse
            ).toHaveBeenCalledWith(null, req.query);
        });
    });

    describe("getBeneficiaryAccount - Filters & Service", () => {
        beforeEach(() => {
            beneficiaryService.getBeneficiaryAccountService.mockResolvedValue([
            { id: 1 },
            ]);
        });

        it("should add beneficiary_role filter", async () => {
            req.query.beneficiary_role = Role.VENDOR;

            await getBeneficiaryAccount(req, res);

            expect(
            beneficiaryService.getBeneficiaryAccountService
            ).toHaveBeenCalledWith(
            expect.objectContaining({
                beneficiary_role: Role.VENDOR,
            }),
            Role.ADMIN,
            undefined,
            undefined,
            1,
            Role.ADMIN,
            100
            );
        });

        it("should add beneficiary_user_id filter", async () => {
            req.query.beneficiary_user_id = 25;

            await getBeneficiaryAccount(req, res);

            expect(
                beneficiaryService.getBeneficiaryAccountService
                ).toHaveBeenCalledWith(
                expect.objectContaining({
                    user_id: 25,
                }),
                Role.ADMIN,
                undefined,
                undefined,
                1,
                Role.ADMIN,
                100
            );
        });

        it("should add config->>is_enabled filter", async () => {
            req.query.is_enabled = true;

            await getBeneficiaryAccount(req, res);

            expect(
                beneficiaryService.getBeneficiaryAccountService
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    "config->>is_enabled": "true",
                }),
                Role.ADMIN,
                undefined,
                undefined,
                1,
                Role.ADMIN,
                100
            );
        });

        it("should force is_enabled=true for VENDOR", async () => {
            req.user.role = Role.VENDOR;

            await getBeneficiaryAccount(req, res);

            expect(
            beneficiaryService.getBeneficiaryAccountService
            ).toHaveBeenCalledWith(
            expect.objectContaining({
                "config->>is_enabled": "true",
            }),
            Role.VENDOR,
            undefined,
            undefined,
            1,
            Role.ADMIN,
            100
            );
        });

        it("should not add is_enabled filter when undefined", async () => {
            await getBeneficiaryAccount(req, res);

            const filters =
            beneficiaryService.getBeneficiaryAccountService.mock.calls[0][0];

            expect(filters["config->>is_enabled"]).toBeUndefined();
        });

        it("should preserve forSettlementFlag", async () => {
            req.query.forSettlementFlag = "true";

            await getBeneficiaryAccount(req, res);

            expect(
                beneficiaryService.getBeneficiaryAccountService
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    forSettlementFlag: "true",
                }),
                Role.ADMIN,
                undefined,
                undefined,
                1,
                Role.ADMIN,
                100
            );
        });

        it("should call getBeneficiaryAccountService with correct arguments", async () => {
            req.query.page = "2";
            req.query.limit = "20";

            await getBeneficiaryAccount(req, res);

            expect(
            beneficiaryService.getBeneficiaryAccountService
            ).toHaveBeenCalledWith(
            expect.any(Object),
            Role.ADMIN,
            "2",
            "20",
            1,
            Role.ADMIN,
            100
            );
        });

        it("should pass pagination correctly", async () => {
            req.query.page = "5";
            req.query.limit = "15";

            await getBeneficiaryAccount(req, res);

            expect(
            beneficiaryService.getBeneficiaryAccountService.mock.calls[0].slice(2, 4)
            ).toEqual(["5", "15"]);
        });

        it("should pass designation", async () => {
            req.user.designation = Role.MERCHANT;

            await getBeneficiaryAccount(req, res);

            expect(
            beneficiaryService.getBeneficiaryAccountService.mock.calls[0][5]
            ).toBe(Role.MERCHANT);
        });

        it("should pass company_id", async () => {
            req.user.company_id = 555;

            await getBeneficiaryAccount(req, res);

            expect(
            beneficiaryService.getBeneficiaryAccountService.mock.calls[0][6]
            ).toBe(555);
        });

        it("should pass role", async () => {
            req.user.role = Role.MERCHANT;

            await getBeneficiaryAccount(req, res);

            expect(
            beneficiaryService.getBeneficiaryAccountService.mock.calls[0][1]
            ).toBe(Role.MERCHANT);
        });

        it("should pass user_id", async () => {
            req.user.user_id = 88;

            await getBeneficiaryAccount(req, res);

            expect(
            beneficiaryService.getBeneficiaryAccountService.mock.calls[0][4]
            ).toBe(88);
        });
    });

    describe("getBeneficiaryAccount - Logger & Errors", () => {
        beforeEach(() => {
            beneficiaryService.getBeneficiaryAccountService.mockResolvedValue([
            { id: 1 },
            ]);
        });

        it("should log success message", async () => {
            await getBeneficiaryAccount(req, res);

            expect(logger.log).toHaveBeenCalledWith(
            "get Beneficiary successfully",
            Role.ADMIN
            );
        });

        it("should propagate cache read error", async () => {
            const error = new Error("cache read");

            cache.readJsonCache.mockRejectedValue(error);

            await expect(
            getBeneficiaryAccount(req, res)
            ).rejects.toThrow(error);
        });

        it("should propagate service error", async () => {
            const error = new Error("service");

            beneficiaryService.getBeneficiaryAccountService.mockRejectedValue(error);

            await expect(
            getBeneficiaryAccount(req, res)
            ).rejects.toThrow(error);
        });

        it("should propagate cache write error", async () => {
            const error = new Error("cache write");

            cache.writeJsonCache.mockRejectedValue(error);

            await expect(
            getBeneficiaryAccount(req, res)
            ).rejects.toThrow(error);
        });

        it("should propagate sendSuccess error", async () => {
            const error = new Error("send success");

            sendSuccess.mockImplementation(() => {
            throw error;
            });

            await expect(
            getBeneficiaryAccount(req, res)
            ).rejects.toThrow(error);
        });
    });

    describe("getBeneficiaryAccountBySearch - Cache", () => {
        const req = {
            user: {
            role: Role.ADMIN,
            user_id: 7,
            designation: Role.ADMIN,
            company_id: 100,
            },
            query: {
            page: "1",
            limit: "10",
            search: "abc",
            },
        };

        const res = {};

        it("should return cached response", async () => {
            cache.readJsonCache.mockResolvedValue({ cached: true });
            cache.shouldServeCachedResponse.mockReturnValue(true);

            await getBeneficiaryAccountBySearch(req, res);

            expect(sendSuccess).toHaveBeenCalledWith(
            res,
            { cached: true },
            "get Beneficiary successfully"
            );
        });

        it("should skip service on cache hit", async () => {
            cache.readJsonCache.mockResolvedValue({ data: 1 });
            cache.shouldServeCachedResponse.mockReturnValue(true);

            await getBeneficiaryAccountBySearch(req, res);

            expect(
            beneficiaryService.getBeneficiaryAccountBySearchService
            ).not.toHaveBeenCalled();
        });

        it("should write cache", async () => {
            cache.readJsonCache.mockResolvedValue(null);
            cache.shouldServeCachedResponse.mockReturnValue(false);

            beneficiaryService.getBeneficiaryAccountBySearchService.mockResolvedValue([
            { id: 1 },
            ]);

            await getBeneficiaryAccountBySearch(req, res);

            expect(cache.writeJsonCache).toHaveBeenCalled();
        });

        it("should generate cache key correctly", async () => {
            cache.readJsonCache.mockResolvedValue(null);
            cache.shouldServeCachedResponse.mockReturnValue(false);

            beneficiaryService.getBeneficiaryAccountBySearchService.mockResolvedValue(
            []
            );

            await getBeneficiaryAccountBySearch(req, res);

            expect(generateCacheKey).toHaveBeenCalled();
        });
    });

    describe("getBeneficiaryAccountByBankName", () => {
        let req;
        let res;

        beforeEach(() => {
            req = {
            query: {
                type: "Personal",
            },
            user: {
                company_id: 100,
                role: Role.ADMIN,
                user_id: 7,
                designation: Role.ADMIN,
            },
            };

            res = {};

            cache.readJsonCache.mockResolvedValue(null);
            cache.shouldServeCachedResponse.mockReturnValue(false);

            beneficiaryService.getBeneficiaryAccountServiceByBankName.mockResolvedValue({
            totalCount: 1,
            bankNames: [{ label: "HDFC", value: 1 }],
            });

            cache.writeJsonCache.mockResolvedValue();
            sendSuccess.mockReturnValue({});
        });

        /* -------------------------------------------------------------------------- */
        /*                                Cache Tests                                 */
        /* -------------------------------------------------------------------------- */

        it("should return cached response", async () => {
            cache.readJsonCache.mockResolvedValue({ cached: true });
            cache.shouldServeCachedResponse.mockReturnValue(true);

            await getBeneficiaryAccountByBankName(req, res);

            expect(sendSuccess).toHaveBeenCalledWith(
            res,
            { cached: true },
            "get Beneficiary successfully"
            );
        });

        it("should skip service on cache hit", async () => {
            cache.readJsonCache.mockResolvedValue({ cached: true });
            cache.shouldServeCachedResponse.mockReturnValue(true);

            await getBeneficiaryAccountByBankName(req, res);

            expect(beneficiaryService.getBeneficiaryAccountServiceByBankName).not.toHaveBeenCalled();
        });

        it("should generate cache key", async () => {
            await getBeneficiaryAccountByBankName(req, res);

            expect(generateCacheKey).toHaveBeenCalledWith(
            {
                company_id: 100,
                type: "Personal",
                role: Role.ADMIN,
                user_id: 7,
                designation: Role.ADMIN,
            },
            "beneficiary-bankname"
            );
        });

        /* -------------------------------------------------------------------------- */
        /*                               Service Tests                                */
        /* -------------------------------------------------------------------------- */

        it("should call service correctly", async () => {
            await getBeneficiaryAccountByBankName(req, res);

            expect(beneficiaryService.getBeneficiaryAccountServiceByBankName).toHaveBeenCalledWith(
            100,
            "Personal",
            Role.ADMIN,
            7,
            Role.ADMIN
            );
        });

        it("should write cache", async () => {
            await getBeneficiaryAccountByBankName(req, res);

            expect(cache.writeJsonCache).toHaveBeenCalledWith(
            expect.any(String),
            {
                totalCount: 1,
                bankNames: [{ label: "HDFC", value: 1 }],
            },
            config.controllerCacheTtls.beneficiary.byBankName
            );
        });

        it("should pass type", async () => {
            req.query.type = "Business";

            await getBeneficiaryAccountByBankName(req, res);

            expect(beneficiaryService.getBeneficiaryAccountServiceByBankName).toHaveBeenCalledWith(
            100,
            "Business",
            Role.ADMIN,
            7,
            Role.ADMIN
            );
        });

        it("should pass company_id", async () => {
            req.user.company_id = 500;

            await getBeneficiaryAccountByBankName(req, res);

            expect(beneficiaryService.getBeneficiaryAccountServiceByBankName).toHaveBeenCalledWith(
            500,
            "Personal",
            Role.ADMIN,
            7,
            Role.ADMIN
            );
        });

        it("should pass designation", async () => {
            req.user.designation = Role.VENDOR_OPERATIONS;

            await getBeneficiaryAccountByBankName(req, res);

            expect(beneficiaryService.getBeneficiaryAccountServiceByBankName).toHaveBeenCalledWith(
            100,
            "Personal",
            Role.ADMIN,
            7,
            Role.VENDOR_OPERATIONS
            );
        });

        it("should pass role", async () => {
            req.user.role = Role.VENDOR;

            await getBeneficiaryAccountByBankName(req, res);

            expect(beneficiaryService.getBeneficiaryAccountServiceByBankName).toHaveBeenCalledWith(
            100,
            "Personal",
            Role.VENDOR,
            7,
            Role.ADMIN
            );
        });

        /* -------------------------------------------------------------------------- */
        /*                                 Error Tests                                */
        /* -------------------------------------------------------------------------- */

        it("should propagate service error", async () => {
            const error = new Error("service failed");

            beneficiaryService.getBeneficiaryAccountServiceByBankName.mockRejectedValue(error);

            await expect(
            getBeneficiaryAccountByBankName(req, res)
            ).rejects.toThrow(error);
        });

        it("should propagate cache errors", async () => {
            const error = new Error("cache failed");

            cache.readJsonCache.mockRejectedValue(error);

            await expect(
            getBeneficiaryAccountByBankName(req, res)
            ).rejects.toThrow(error);
        });
    });


    describe("getBeneficiaryAccountById", () => {
    let req;
    let res;

    beforeEach(() => {
        req = {
        params: {
            id: "11",
        },
        user: {
            role: Role.ADMIN,
            company_id: 100,
        },
        query: {},
        };

        res = {};

        cache.readJsonCache.mockResolvedValue(null);
        cache.shouldServeCachedResponse.mockReturnValue(false);

        beneficiaryService.getBeneficiaryAccountService.mockResolvedValue([{ id: 11 }]);

        cache.writeJsonCache.mockResolvedValue();

        sendSuccess.mockReturnValue({});
    });

    it("should return cached response", async () => {
        cache.readJsonCache.mockResolvedValue([{ id: 1 }]);
        cache.shouldServeCachedResponse.mockReturnValue(true);

        await getBeneficiaryAccountById(req, res);

        expect(sendSuccess).toHaveBeenCalledWith(
        res,
        [{ id: 1 }],
        "get Bank successfully"
        );
    });

    it("should skip service when cached", async () => {
        cache.readJsonCache.mockResolvedValue([{ id: 1 }]);
        cache.shouldServeCachedResponse.mockReturnValue(true);

        await getBeneficiaryAccountById(req, res);

        expect(beneficiaryService.getBeneficiaryAccountService).not.toHaveBeenCalled();
    });

    it("should call service with id filter", async () => {
        await getBeneficiaryAccountById(req, res);

        expect(beneficiaryService.getBeneficiaryAccountService).toHaveBeenCalledWith(
        { id: "11" },
        Role.ADMIN
        );
    });

    it("should pass role", async () => {
        req.user.role = Role.VENDOR;

        await getBeneficiaryAccountById(req, res);

        expect(beneficiaryService.getBeneficiaryAccountService).toHaveBeenCalledWith(
        { id: "11" },
        Role.VENDOR
        );
    });

    it("should write cache", async () => {
        await getBeneficiaryAccountById(req, res);

        expect(cache.writeJsonCache).toHaveBeenCalled();
    });

    it("should use cache TTL", async () => {
        await getBeneficiaryAccountById(req, res);

        expect(cache.writeJsonCache).toHaveBeenCalledWith(
        expect.any(String),
        [{ id: 11 }],
        config.controllerCacheTtls.beneficiary.byId
        );
    });

    it("should propagate service error", async () => {
        beneficiaryService.getBeneficiaryAccountService.mockRejectedValue(new Error("service"));

        await expect(getBeneficiaryAccountById(req, res)).rejects.toThrow(
        "service"
        );
    });

    it("should propagate cache errors", async () => {
        cache.readJsonCache.mockRejectedValue(new Error("cache"));

        await expect(getBeneficiaryAccountById(req, res)).rejects.toThrow(
        "cache"
        );
    });
    });

    describe("createBeneficiaryAccount", () => {
    let req;
    let res;

    beforeEach(() => {
        req = {
        body: {
            bank_name: "HDFC",
            acc_no: "123456",
        },
        user: {
            user_id: 7,
            company_id: 100,
        },
        };

        res = {};

        BENEFICIARY_ACCOUNT_SCHEMA.validate.mockReturnValue({
        error: null,
        });

        beneficiaryService.createBeneficiaryAccountService.mockResolvedValue({});

        cache.invalidateCompanyCacheByPrefix.mockResolvedValue();

        sendSuccess.mockReturnValue({});
    });

    /* ----------------------------- Validation ----------------------------- */

    it("should validate request body", async () => {
        await createBeneficiaryAccount(req, res);

        expect(BENEFICIARY_ACCOUNT_SCHEMA.validate).toHaveBeenCalledWith(req.body);
    });

    it("should throw ValidationError when validation fails", async () => {
        BENEFICIARY_ACCOUNT_SCHEMA.validate.mockReturnValue({
        error: "validation failed",
        });

        await expect(createBeneficiaryAccount(req, res)).rejects.toBeInstanceOf(
        ValidationError
        );
    });

    it("should not call service on validation failure", async () => {
        BENEFICIARY_ACCOUNT_SCHEMA.validate.mockReturnValue({
        error: "validation failed",
        });

        await expect(createBeneficiaryAccount(req, res)).rejects.toThrow();

        expect(beneficiaryService.createBeneficiaryAccountService).not.toHaveBeenCalled();
    });

    /* ------------------------------ Payload ------------------------------ */

    it("should set created_by", async () => {
        await createBeneficiaryAccount(req, res);

        expect(req.body.created_by).toBe(7);
    });

    it("should set updated_by", async () => {
        await createBeneficiaryAccount(req, res);

        expect(req.body.updated_by).toBe(7);
    });

    it("should set company_id", async () => {
        await createBeneficiaryAccount(req, res);

        expect(req.body.company_id).toBe(100);
    });

    it("should preserve existing payload fields", async () => {
        await createBeneficiaryAccount(req, res);

        expect(req.body.bank_name).toBe("HDFC");
        expect(req.body.acc_no).toBe("123456");
    });

    /* ------------------------------ Service ------------------------------ */

    it("should call createBeneficiaryAccountService", async () => {
        await createBeneficiaryAccount(req, res);

        expect(beneficiaryService.createBeneficiaryAccountService).toHaveBeenCalledWith(
        req.body,
        100
        );
    });

    it("should invalidate cache", async () => {
        await createBeneficiaryAccount(req, res);

        expect(cache.invalidateCompanyCacheByPrefix).toHaveBeenCalledWith(
        100,
        "beneficiary:read:",
        "Beneficiary cache"
        );
    });

    it("should send success response", async () => {
        await createBeneficiaryAccount(req, res);

        expect(sendSuccess).toHaveBeenCalledWith(
        res,
        {},
        "Beneficiary Created successfully"
        );
    });

    /* ------------------------------- Errors ------------------------------- */

    it("should propagate service error", async () => {
        beneficiaryService.createBeneficiaryAccountService.mockRejectedValue(
        new Error("service error")
        );

        await expect(createBeneficiaryAccount(req, res)).rejects.toThrow(
        "service error"
        );
    });

    it("should propagate invalidate cache error", async () => {
        cache.invalidateCompanyCacheByPrefix.mockRejectedValue(
        new Error("cache error")
        );

        await expect(createBeneficiaryAccount(req, res)).rejects.toThrow(
        "cache error"
        );
    });

    it("should propagate sendSuccess error", async () => {
        sendSuccess.mockImplementation(() => {
        throw new Error("send error");
        });

        await expect(createBeneficiaryAccount(req, res)).rejects.toThrow(
        "send error"
        );
    });
    });

    describe("updateBeneficiaryAccount", () => {
    let req;
    let res;

    beforeEach(() => {
        req = {
        params: {
            id: "15",
        },
        body: {
            bank_name: "ICICI",
            acc_no: "123456789",
        },
        user: {
            user_id: 7,
            company_id: 100,
            role: Role.ADMIN,
        },
        };

        res = {};

        UPDATE_BENEFICIARY_ACCOUNT_SCHEMA.validate.mockReturnValue({
        error: null,
        });

        beneficiaryService.updateBeneficiaryAccountService.mockResolvedValue({});

        cache.invalidateCompanyCacheByPrefix.mockResolvedValue();

        sendSuccess.mockReturnValue({});
    });

    /* ----------------------------- Validation ----------------------------- */

    it("should validate payload", async () => {
        await updateBeneficiaryAccount(req, res);

        expect(
        UPDATE_BENEFICIARY_ACCOUNT_SCHEMA.validate
        ).toHaveBeenCalledWith(req.body);
    });

    it("should throw ValidationError", async () => {
        UPDATE_BENEFICIARY_ACCOUNT_SCHEMA.validate.mockReturnValue({
        error: "validation error",
        });

        await expect(updateBeneficiaryAccount(req, res)).rejects.toBeInstanceOf(
        ValidationError
        );
    });

    it("should not call service on validation failure", async () => {
        UPDATE_BENEFICIARY_ACCOUNT_SCHEMA.validate.mockReturnValue({
        error: "validation error",
        });

        await expect(updateBeneficiaryAccount(req, res)).rejects.toThrow();

        expect(beneficiaryService.updateBeneficiaryAccountService).not.toHaveBeenCalled();
    });

    /* ------------------------------- Payload ------------------------------- */

    it("should set updated_by", async () => {
        await updateBeneficiaryAccount(req, res);

        expect(req.body.updated_by).toBe(7);
    });

    it("should create ids object", async () => {
        await updateBeneficiaryAccount(req, res);

        expect(beneficiaryService.updateBeneficiaryAccountService).toHaveBeenCalledWith(
        {
            id: "15",
            company_id: 100,
        },
        expect.any(Object),
        Role.ADMIN
        );
    });

    /* ------------------------------- Service ------------------------------- */

    it("should call updateBeneficiaryAccountService", async () => {
        await updateBeneficiaryAccount(req, res);

        expect(beneficiaryService.updateBeneficiaryAccountService).toHaveBeenCalledWith(
        {
            id: "15",
            company_id: 100,
        },
        expect.objectContaining({
            updated_by: 7,
        }),
        Role.ADMIN
        );
    });

    it("should invalidate cache", async () => {
        await updateBeneficiaryAccount(req, res);

        expect(cache.invalidateCompanyCacheByPrefix).toHaveBeenCalledWith(
        100,
        "beneficiary:read:",
        "Beneficiary cache"
        );
    });

    it("should send success", async () => {
        await updateBeneficiaryAccount(req, res);

        expect(sendSuccess).toHaveBeenCalledWith(
        res,
        {},
        "Beneficiary Updated successfully"
        );
    });

    /* -------------------------------- Errors ------------------------------- */

    it("should propagate service error", async () => {
        beneficiaryService.updateBeneficiaryAccountService.mockRejectedValue(
        new Error("service failed")
        );

        await expect(updateBeneficiaryAccount(req, res)).rejects.toThrow(
        "service failed"
        );
    });

    it("should propagate invalidate cache error", async () => {
        cache.invalidateCompanyCacheByPrefix.mockRejectedValue(
        new Error("cache failed")
        );

        await expect(updateBeneficiaryAccount(req, res)).rejects.toThrow(
        "cache failed"
        );
    });

    it("should propagate sendSuccess error", async () => {
        sendSuccess.mockImplementation(() => {
        throw new Error("send failed");
        });

        await expect(updateBeneficiaryAccount(req, res)).rejects.toThrow(
        "send failed"
        );
    });
    });

    describe("deleteBeneficiaryAccount", () => {
    let req;
    let res;

    beforeEach(() => {
        req = {
        params: {
            id: "20",
        },
        user: {
            company_id: 500,
        },
        };

        res = {};

        VALIDATE_BENEFICIARY_ACCOUNT_BY_ID.validate.mockReturnValue({
        error: null,
        });

        beneficiaryService.deleteBeneficiaryAccountService.mockResolvedValue({});

        cache.invalidateCompanyCacheByPrefix.mockResolvedValue();

        sendSuccess.mockReturnValue({});
    });

    it("should validate id", async () => {
        await deleteBeneficiaryAccount(req, res);

        expect(
        VALIDATE_BENEFICIARY_ACCOUNT_BY_ID.validate
        ).toHaveBeenCalledWith("20");
    });

    it("should throw ValidationError", async () => {
        VALIDATE_BENEFICIARY_ACCOUNT_BY_ID.validate.mockReturnValue({
        error: "validation error",
        });

        await expect(deleteBeneficiaryAccount(req, res)).rejects.toBeInstanceOf(
        ValidationError
        );
    });

    it("should not call service when validation fails", async () => {
        VALIDATE_BENEFICIARY_ACCOUNT_BY_ID.validate.mockReturnValue({
        error: "validation error",
        });

        await expect(deleteBeneficiaryAccount(req, res)).rejects.toThrow();

        expect(beneficiaryService.deleteBeneficiaryAccountService).not.toHaveBeenCalled();
    });

    it("should create ids object", async () => {
        await deleteBeneficiaryAccount(req, res);

        expect(beneficiaryService.deleteBeneficiaryAccountService).toHaveBeenCalledWith({
        id: "20",
        company_id: 500,
        });
    });

    it("should call deleteBeneficiaryAccountService", async () => {
        await deleteBeneficiaryAccount(req, res);

        expect(beneficiaryService.deleteBeneficiaryAccountService).toHaveBeenCalledTimes(1);
    });

    it("should invalidate cache", async () => {
        await deleteBeneficiaryAccount(req, res);

        expect(cache.invalidateCompanyCacheByPrefix).toHaveBeenCalledWith(
        500,
        "beneficiary:read:",
        "Beneficiary cache"
        );
    });

    it("should send success", async () => {
        await deleteBeneficiaryAccount(req, res);

        expect(sendSuccess).toHaveBeenCalledWith(
        res,
        {},
        "deleted Beneficiary successfully"
        );
    });
    });

    describe("Controller Error Coverage", () => {
    let req;
    let res;

    beforeEach(() => {
        req = {
        params: { id: "10" },
        body: { bank_name: "HDFC" },
        query: {},
        user: {
            company_id: 100,
            role: Role.ADMIN,
            user_id: 7,
        },
        };

        res = {};

        UPDATE_BENEFICIARY_ACCOUNT_SCHEMA.validate.mockReturnValue({ error: null });
        BENEFICIARY_ACCOUNT_SCHEMA.validate.mockReturnValue({ error: null });
        VALIDATE_BENEFICIARY_ACCOUNT_BY_ID.validate.mockReturnValue({
        error: null,
        });

        beneficiaryService.updateBeneficiaryAccountService.mockResolvedValue({});
        beneficiaryService.createBeneficiaryAccountService.mockResolvedValue({});
        beneficiaryService.deleteBeneficiaryAccountService.mockResolvedValue({});

        cache.invalidateCompanyCacheByPrefix.mockResolvedValue();
        sendSuccess.mockReturnValue({});
    });

    it("should propagate update service error", async () => {
        beneficiaryService.updateBeneficiaryAccountService.mockRejectedValue(
        new Error("update failed")
        );

        await expect(updateBeneficiaryAccount(req, res)).rejects.toThrow(
        "update failed"
        );
    });

    it("should propagate delete service error", async () => {
        beneficiaryService.deleteBeneficiaryAccountService.mockRejectedValue(
        new Error("delete failed")
        );

        await expect(deleteBeneficiaryAccount(req, res)).rejects.toThrow(
        "delete failed"
        );
    });

    it("should propagate invalidate cache error", async () => {
        cache.invalidateCompanyCacheByPrefix.mockRejectedValue(
        new Error("cache failed")
        );

        await expect(createBeneficiaryAccount(req, res)).rejects.toThrow(
        "cache failed"
        );
    });

    it("should propagate sendSuccess error", async () => {
        sendSuccess.mockImplementation(() => {
        throw new Error("send failed");
        });

        await expect(createBeneficiaryAccount(req, res)).rejects.toThrow(
        "send failed"
        );
    });
    });

    describe("invalidateBeneficiaryCache", () => {
    beforeEach(() => {
        cache.invalidateCompanyCacheByPrefix.mockResolvedValue();
        BENEFICIARY_ACCOUNT_SCHEMA.validate.mockReturnValue({ error: null });
        UPDATE_BENEFICIARY_ACCOUNT_SCHEMA.validate.mockReturnValue({ error: null });
        VALIDATE_BENEFICIARY_ACCOUNT_BY_ID.validate.mockReturnValue({
        error: null,
        });

        beneficiaryService.createBeneficiaryAccountService.mockResolvedValue({});
        beneficiaryService.updateBeneficiaryAccountService.mockResolvedValue({});
        beneficiaryService.deleteBeneficiaryAccountService.mockResolvedValue({});
        sendSuccess.mockReturnValue({});
    });

    it("should call invalidateCompanyCacheByPrefix", async () => {
        await createBeneficiaryAccount(
        {
            body: {},
            user: { company_id: 200, user_id: 1 },
        },
        {}
        );

        expect(cache.invalidateCompanyCacheByPrefix).toHaveBeenCalled();
    });

    it("should pass company id", async () => {
        await deleteBeneficiaryAccount(
        {
            params: { id: "1" },
            user: { company_id: 555 },
        },
        {}
        );

        expect(cache.invalidateCompanyCacheByPrefix).toHaveBeenCalledWith(
        555,
        expect.any(String),
        expect.any(String)
        );
    });

    it("should use beneficiary:read: prefix", async () => {
        await updateBeneficiaryAccount(
        {
            params: { id: "1" },
            body: {},
            user: {
            company_id: 300,
            user_id: 7,
            role: Role.ADMIN,
            },
        },
        {}
        );

        expect(cache.invalidateCompanyCacheByPrefix).toHaveBeenCalledWith(
        300,
        "beneficiary:read:",
        expect.any(String)
        );
    });

    it("should use Beneficiary cache label", async () => {
        await createBeneficiaryAccount(
        {
            body: {},
            user: {
            company_id: 10,
            user_id: 1,
            },
        },
        {}
        );

        expect(cache.invalidateCompanyCacheByPrefix).toHaveBeenCalledWith(
        10,
        "beneficiary:read:",
        "Beneficiary cache"
        );
    });
    });

    describe("Cache Utility Coverage", () => {
    beforeEach(() => {
        cache.readJsonCache.mockResolvedValue(null);
        cache.shouldServeCachedResponse.mockReturnValue(false);

        beneficiaryService.getBeneficiaryAccountService.mockResolvedValue([]);

        cache.writeJsonCache.mockResolvedValue();

        sendSuccess.mockReturnValue({});
    });

    const req = {
        user: {
        company_id: 100,
        role: Role.ADMIN,
        user_id: 5,
        designation: Role.ADMIN,
        },
        query: {
        page: "1",
        limit: "10",
        },
    };

    it("should call readJsonCache", async () => {
        await getBeneficiaryAccount(req, {});
        expect(cache.readJsonCache).toHaveBeenCalled();
    });

    it("should call writeJsonCache", async () => {
        await getBeneficiaryAccount(req, {});
        expect(cache.writeJsonCache).toHaveBeenCalled();
    });

    it("should call shouldServeCachedResponse", async () => {
        await getBeneficiaryAccount(req, {});
        expect(cache.shouldServeCachedResponse).toHaveBeenCalled();
    });

    it("should call normalizeQueryForCache", async () => {
        await getBeneficiaryAccount(req, {});
        expect(cache.normalizeQueryForCache).toHaveBeenCalledWith(req.query);
    });

    it("should call generateCacheKey", async () => {
        await getBeneficiaryAccount(req, {});
        expect(generateCacheKey).toHaveBeenCalled();
    });
    });

    describe("Controller Edge Cases", () => {
    beforeEach(() => {
        cache.readJsonCache.mockResolvedValue(null);
        cache.shouldServeCachedResponse.mockReturnValue(false);

        beneficiaryService.getBeneficiaryAccountService.mockResolvedValue([]);

        cache.writeJsonCache.mockResolvedValue();

        sendSuccess.mockReturnValue({});
    });

    it("should handle empty query object", async () => {
        const req = {
            user: {
            company_id: 1,
            role: Role.ADMIN,
            user_id: 1,
            },
            query: {},
        };

        cache.readJsonCache.mockResolvedValue(null);
        cache.shouldServeCachedResponse.mockReturnValue(false);
        beneficiaryService.getBeneficiaryAccountService.mockResolvedValue([]);
        sendSuccess.mockReturnValue({});

        await expect(getBeneficiaryAccount(req, res)).resolves.toBeDefined();
        });

    it("should handle req.body empty", async () => {
        BENEFICIARY_ACCOUNT_SCHEMA.validate.mockReturnValue({ error: null });
        beneficiaryService.createBeneficiaryAccountService.mockResolvedValue({});
        cache.invalidateCompanyCacheByPrefix.mockResolvedValue();

        await expect(
        createBeneficiaryAccount(
            {
            body: {},
            user: { company_id: 1, user_id: 1 },
            },
            {}
        )
        ).resolves.not.toThrow();
    });

    it("should handle req.params empty", async () => {
        VALIDATE_BENEFICIARY_ACCOUNT_BY_ID.validate.mockReturnValue({
        error: null,
        });

        beneficiaryService.deleteBeneficiaryAccountService.mockResolvedValue({});
        cache.invalidateCompanyCacheByPrefix.mockResolvedValue();

        await expect(
        deleteBeneficiaryAccount(
            {
            params: {},
            user: { company_id: 1 },
            },
            {}
        )
        ).resolves.not.toThrow();
    });

    it("should handle company_id undefined", async () => {
        await getBeneficiaryAccount(
        {
            query: {},
            user: {
            company_id: undefined,
            role: Role.ADMIN,
            user_id: 1,
            },
        },
        {}
        );

        expect(beneficiaryService.getBeneficiaryAccountService).toHaveBeenCalled();
    });

    it("should handle role undefined", async () => {
        await getBeneficiaryAccount(
        {
            query: {},
            user: {
            company_id: 1,
            role: undefined,
            user_id: 1,
            },
        },
        {}
        );

        expect(beneficiaryService.getBeneficiaryAccountService).toHaveBeenCalled();
    });

    it("should handle designation undefined", async () => {
        await getBeneficiaryAccount(
        {
            query: {},
            user: {
            company_id: 1,
            role: Role.ADMIN,
            user_id: 1,
            designation: undefined,
            },
        },
        {}
        );

        expect(beneficiaryService.getBeneficiaryAccountService).toHaveBeenCalled();
    });

    it("should handle user_id undefined", async () => {
        await getBeneficiaryAccount(
        {
            query: {},
            user: {
            company_id: 1,
            role: Role.ADMIN,
            user_id: undefined,
            },
        },
        {}
        );

        expect(beneficiaryService.getBeneficiaryAccountService).toHaveBeenCalled();
    });

    it("should handle beneficiary_role undefined", async () => {
        await getBeneficiaryAccount(
        {
            query: {},
            user: {
            company_id: 1,
            role: Role.ADMIN,
            user_id: 1,
            },
        },
        {}
        );

        expect(beneficiaryService.getBeneficiaryAccountService).toHaveBeenCalled();
    });

    it("should handle beneficiary_user_id undefined", async () => {
        await getBeneficiaryAccount(
        {
            query: {},
            user: {
            company_id: 1,
            role: Role.ADMIN,
            user_id: 1,
            },
        },
        {}
        );

        expect(beneficiaryService.getBeneficiaryAccountService).toHaveBeenCalled();
    });

    it("should handle page undefined", async () => {
        await getBeneficiaryAccount(
        {
            query: { limit: "10" },
            user: {
            company_id: 1,
            role: Role.ADMIN,
            user_id: 1,
            },
        },
        {}
        );

        expect(beneficiaryService.getBeneficiaryAccountService).toHaveBeenCalled();
    });

    it("should handle limit undefined", async () => {
        await getBeneficiaryAccount(
        {
            query: { page: "1" },
            user: {
            company_id: 1,
            role: Role.ADMIN,
            user_id: 1,
            },
        },
        {}
        );

        expect(beneficiaryService.getBeneficiaryAccountService).toHaveBeenCalled();
    });

    it("should handle type undefined", async () => {
        beneficiaryService.getBeneficiaryAccountServiceByBankName.mockResolvedValue([]);

        await getBeneficiaryAccountByBankName(
        {
            query: {},
            user: {
            company_id: 1,
            role: Role.ADMIN,
            user_id: 1,
            },
        },
        {}
        );

        expect(beneficiaryService.getBeneficiaryAccountServiceByBankName).toHaveBeenCalled();
    });

    it("should handle search undefined", async () => {
        beneficiaryService.getBeneficiaryAccountBySearchService.mockResolvedValue([]);

        await getBeneficiaryAccountBySearch(
        {
            query: {},
            user: {
            company_id: 1,
            role: Role.ADMIN,
            user_id: 1,
            },
        },
        {}
        );

        expect(beneficiaryService.getBeneficiaryAccountBySearchService).toHaveBeenCalled();
    });

    it("should handle is_enabled=false", async () => {
        await getBeneficiaryAccount(
        {
            query: {
            is_enabled: false,
            },
            user: {
            company_id: 1,
            role: Role.ADMIN,
            user_id: 1,
            },
        },
        {}
        );

        expect(beneficiaryService.getBeneficiaryAccountService).toHaveBeenCalled();
    });

    it("should handle cached response is null", async () => {
        cache.readJsonCache.mockResolvedValue(null);

        await getBeneficiaryAccount(
        {
            query: {},
            user: {
            company_id: 1,
            role: Role.ADMIN,
            user_id: 1,
            },
        },
        {}
        );

        expect(beneficiaryService.getBeneficiaryAccountService).toHaveBeenCalled();
    });

    it("should handle cached response is empty object", async () => {
        cache.readJsonCache.mockResolvedValue({});
        cache.shouldServeCachedResponse.mockReturnValue(true);

        await getBeneficiaryAccount(
        {
            query: {},
            user: {
            company_id: 1,
            role: Role.ADMIN,
            user_id: 1,
            },
        },
        {}
        );

        expect(sendSuccess).toHaveBeenCalled();
    });

    it("should handle cached response is empty array", async () => {
        cache.readJsonCache.mockResolvedValue([]);
        cache.shouldServeCachedResponse.mockReturnValue(true);

        await getBeneficiaryAccount(
        {
            query: {},
            user: {
            company_id: 1,
            role: Role.ADMIN,
            user_id: 1,
            },
        },
        {}
        );

        expect(sendSuccess).toHaveBeenCalled();
    });
    });
});