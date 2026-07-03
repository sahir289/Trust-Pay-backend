import { jest } from "@jest/globals";

/* -------------------------------------------------------------------------- */
/*                                   Mocks                                    */
/* -------------------------------------------------------------------------- */

jest.unstable_mockModule("../../utils/db.js", () => ({
  getConnection: jest.fn(),
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
}));

jest.unstable_mockModule("../../utils/logger.js", () => ({
  logger: {
    error: jest.fn(),
  },
}));

jest.unstable_mockModule("../../utils/appErrors.js", () => ({
  BadRequestError: class BadRequestError extends Error {
    constructor(message) {
      super(message);
      this.name = "BadRequestError";
    }
  },
}));

jest.unstable_mockModule("../../constants/index.js", () => ({
  Role: {
    ADMIN: "ADMIN",
    MERCHANT: "MERCHANT",
    SUB_MERCHANT: "SUB_MERCHANT",
    MERCHANT_OPERATIONS: "MERCHANT_OPERATIONS",
    VENDOR: "VENDOR",
    VENDOR_ADMIN: "VENDOR_ADMIN",
    SUB_VENDOR: "SUB_VENDOR",
    VENDOR_OPERATIONS: "VENDOR_OPERATIONS",
  },
}));

jest.unstable_mockModule("../roles/rolesDao.js", () => ({
  getRoleDao: jest.fn(),
}));

jest.unstable_mockModule("../userHierarchy/userHierarchyDao.js", () => ({
  getUserHierarchysDao: jest.fn(),
}));

jest.unstable_mockModule("../users/userDao.js", () => ({
  getUserByCompanyCreatedAtDao: jest.fn(),
  getUserByIdDao: jest.fn(),
}));

jest.unstable_mockModule("./beneficiaryAccountDao.js", () => ({
  getBeneficiaryAccountDao: jest.fn(),
  createBeneficiaryAccountDao: jest.fn(),
  updateBeneficiaryAccountDao: jest.fn(),
  getBeneficiaryAccountDaoByBankName: jest.fn(),
  getBeneficiaryAccountBySearchDao: jest.fn(),
  getBeneficiaryAccountDaoAll: jest.fn(),
  deleteBeneficiaryDao: jest.fn(),
  checkBeneficiaryAccountExistsDao: jest.fn(),
}));

const db = await import("../../utils/db.js");

const { logger } = await import("../../utils/logger.js");

const { Role } = await import("../../constants/index.js");

const rolesDao = await import("../roles/rolesDao.js");

const hierarchyDao = await import("../userHierarchy/userHierarchyDao.js");

const userDao = await import("../users/userDao.js");

const beneficiaryDao = await import("./beneficiaryAccountDao.js");

const { BadRequestError } = await import("../../utils/appErrors.js");

const {
  getBeneficiaryAccountService,
  getBeneficiaryAccountBySearchService,
  createBeneficiaryAccountService,
  updateBeneficiaryAccountService,
  deleteBeneficiaryAccountService,
  getBeneficiaryAccountServiceByBankName,
} = await import("./beneficiaryAccountServices.js");


let mockConn;
describe("getBeneficiaryAccountService", () => {
    beforeEach(() => {
    jest.clearAllMocks();

    mockConn = {
        release: jest.fn(),
    };

    db.getConnection.mockResolvedValue(mockConn);

    db.beginTransaction.mockResolvedValue();

    db.commit.mockResolvedValue();

    db.rollback.mockResolvedValue();
    });

    describe("getBeneficiaryAccountService", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should return beneficiary accounts for ADMIN", async () => {
        const filters = {};
        const result = [{ id: 1 }];

        beneficiaryDao.getBeneficiaryAccountDaoAll.mockResolvedValue(result);

        const response = await getBeneficiaryAccountService(
        filters,
        Role.ADMIN,
        1,
        10,
        100,
        Role.ADMIN,
        5
        );

        expect(response).toEqual(result);

        expect(beneficiaryDao.getBeneficiaryAccountDaoAll).toHaveBeenCalledWith(
        { company_id: 5 },
        1,
        10,
        Role.ADMIN
        );
    });

    it("should return beneficiary accounts for MERCHANT", async () => {
        hierarchyDao.getUserHierarchysDao.mockResolvedValue([
        {
            config: {
            siblings: {
                sub_merchants: [2, 3],
            },
            },
        },
        ]);

        beneficiaryDao.getBeneficiaryAccountDaoAll.mockResolvedValue([{ id: 1 }]);

        const filters = {};

        await getBeneficiaryAccountService(
        filters,
        Role.MERCHANT,
        1,
        10,
        1,
        Role.MERCHANT,
        9
        );

        expect(filters.user_id).toEqual([[1, 2, 3]]);
    });

    it("should return beneficiary accounts for SUB_MERCHANT", async () => {
        hierarchyDao.getUserHierarchysDao.mockResolvedValue([]);

        beneficiaryDao.getBeneficiaryAccountDaoAll.mockResolvedValue([]);

        const filters = {};

        await getBeneficiaryAccountService(
        filters,
        Role.MERCHANT,
        1,
        10,
        50,
        Role.SUB_MERCHANT,
        1
        );

        expect(filters.user_id).toEqual([50]);
    });

    it("should use parent hierarchy for MERCHANT_OPERATIONS", async () => {
        hierarchyDao.getUserHierarchysDao
        .mockResolvedValueOnce([
            {
            config: {
                parent: 99,
            },
            },
        ])
        .mockResolvedValueOnce([
            {
            config: {
                siblings: {
                sub_merchants: [5, 6],
                },
            },
            },
        ]);

        beneficiaryDao.getBeneficiaryAccountDaoAll.mockResolvedValue([]);

        const filters = {};

        await getBeneficiaryAccountService(
        filters,
        Role.MERCHANT,
        1,
        10,
        20,
        Role.MERCHANT_OPERATIONS,
        3
        );

        expect(filters.user_id).toEqual([[99, 5, 6]]);
    });

    it("should return beneficiary accounts for VENDOR", async () => {
        userDao.getUserByCompanyCreatedAtDao.mockResolvedValue({
        id: 900,
        });

        beneficiaryDao.getBeneficiaryAccountDaoAll.mockResolvedValue([]);

        const filters = {};

        await getBeneficiaryAccountService(
        filters,
        Role.VENDOR,
        1,
        10,
        7,
        Role.VENDOR,
        8
        );

        expect(filters.user_id).toEqual([7, 900]);
    });

    it("should use parent for VENDOR_OPERATIONS", async () => {
        hierarchyDao.getUserHierarchysDao.mockResolvedValue([
        {
            config: {
            parent: 12,
            },
        },
        ]);

        userDao.getUserByCompanyCreatedAtDao.mockResolvedValue({
        id: 999,
        });

        beneficiaryDao.getBeneficiaryAccountDaoAll.mockResolvedValue([]);

        const filters = {};

        await getBeneficiaryAccountService(
        filters,
        Role.VENDOR,
        1,
        10,
        5,
        Role.VENDOR_OPERATIONS,
        2
        );

        expect(filters.user_id).toEqual([12, 999]);
    });

    it("should append admin user for ADMIN filters", async () => {
        userDao.getUserByCompanyCreatedAtDao.mockResolvedValue({
        id: 100,
        });

        beneficiaryDao.getBeneficiaryAccountDaoAll.mockResolvedValue([]);

        const filters = {
        user_id: 8,
        };

        await getBeneficiaryAccountService(
        filters,
        Role.ADMIN,
        1,
        10,
        1,
        Role.ADMIN,
        10
        );

        expect(filters.user_id).toEqual([8, 100]);
    });

    it("should lookup beneficiary role", async () => {
        rolesDao.getRoleDao.mockResolvedValue([{ id: 15 }]);

        beneficiaryDao.getBeneficiaryAccountDaoAll.mockResolvedValue([]);

        const filters = {
        beneficiary_role: Role.MERCHANT,
        };

        await getBeneficiaryAccountService(
        filters,
        Role.ADMIN,
        1,
        10,
        1,
        Role.ADMIN,
        1
        );

        expect(rolesDao.getRoleDao).toHaveBeenCalledWith({
        role: Role.MERCHANT,
        });

        expect(filters.role_id).toBe(15);

        expect(filters.beneficiary_role).toBeUndefined();
    });

    it("should include ADMIN role when beneficiary role is VENDOR", async () => {
        rolesDao.getRoleDao
        .mockResolvedValueOnce([{ id: 10 }])
        .mockResolvedValueOnce([{ id: 1 }]);

        beneficiaryDao.getBeneficiaryAccountDaoAll.mockResolvedValue([]);

        const filters = {
        beneficiary_role: Role.VENDOR,
        };

        await getBeneficiaryAccountService(
        filters,
        Role.ADMIN,
        1,
        10,
        1,
        Role.ADMIN,
        1
        );

        expect(filters.role_id).toEqual([10, 1]);
    });

    it("should parse pagination correctly", async () => {
        beneficiaryDao.getBeneficiaryAccountDaoAll.mockResolvedValue([]);

        await getBeneficiaryAccountService(
        {},
        Role.ADMIN,
        "5",
        "25",
        1,
        Role.ADMIN,
        1
        );

        expect(
        beneficiaryDao.getBeneficiaryAccountDaoAll
        ).toHaveBeenCalledWith(
        { company_id: 1 },
        5,
        25,
        Role.ADMIN
        );
    });

    it("should use default pagination", async () => {
        beneficiaryDao.getBeneficiaryAccountDaoAll.mockResolvedValue([]);

        await getBeneficiaryAccountService(
        {},
        Role.ADMIN,
        undefined,
        undefined,
        1,
        Role.ADMIN,
        1
        );

        expect(
        beneficiaryDao.getBeneficiaryAccountDaoAll
        ).toHaveBeenCalledWith(
        { company_id: 1 },
        1,
        10,
        Role.ADMIN
        );
    });

    it("should ignore pagination for settlement flag", async () => {
        beneficiaryDao.getBeneficiaryAccountDaoAll.mockResolvedValue([]);

        const filters = {
        forSettlementFlag: "true",
        };

        await getBeneficiaryAccountService(
        filters,
        Role.ADMIN,
        9,
        50,
        1,
        Role.ADMIN,
        2
        );

        expect(filters.forSettlementFlag).toBeUndefined();

        expect(
        beneficiaryDao.getBeneficiaryAccountDaoAll
        ).toHaveBeenCalledWith(
        { company_id: 2 },
        undefined,
        undefined,
        Role.ADMIN
        );
    });

    it("should return empty array", async () => {
        beneficiaryDao.getBeneficiaryAccountDaoAll.mockResolvedValue([]);

        const result = await getBeneficiaryAccountService(
        {},
        Role.ADMIN,
        1,
        10,
        1,
        Role.ADMIN,
        1
        );

        expect(result).toEqual([]);
    });

    it("should propagate DAO errors", async () => {
        const error = new Error("dao");

        beneficiaryDao.getBeneficiaryAccountDaoAll.mockRejectedValue(error);

        await expect(
        getBeneficiaryAccountService(
            {},
            Role.ADMIN,
            1,
            10,
            1,
            Role.ADMIN,
            1
        )
        ).rejects.toThrow(error);
    });

    it("should log DAO errors", async () => {
        const error = new Error("failed");

        beneficiaryDao.getBeneficiaryAccountDaoAll.mockRejectedValue(error);

        await expect(
        getBeneficiaryAccountService(
            {},
            Role.ADMIN,
            1,
            10,
            1,
            Role.ADMIN,
            1
        )
        ).rejects.toThrow(error);

        expect(logger.error).toHaveBeenCalledWith(
        "error getting while getting beneficiary banks",
        error
        );
    });

    it("should handle undefined filters", async () => {
        beneficiaryDao.getBeneficiaryAccountDaoAll.mockResolvedValue([]);

        await expect(
        getBeneficiaryAccountService(
            undefined,
            Role.ADMIN,
            1,
            10,
            1,
            Role.ADMIN,
            1
        )
        ).rejects.toThrow();
    });

    it("should handle null page and limit", async () => {
        beneficiaryDao.getBeneficiaryAccountDaoAll.mockResolvedValue([]);

        await getBeneficiaryAccountService(
        {},
        Role.ADMIN,
        null,
        null,
        1,
        Role.ADMIN,
        3
        );

        expect(
        beneficiaryDao.getBeneficiaryAccountDaoAll
        ).toHaveBeenCalledWith(
        { company_id: 3 },
        1,
        10,
        Role.ADMIN
        );
    });
    });

    describe("Additional getBeneficiaryAccountService test cases", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should use current user when merchant has no sub merchants", async () => {
            hierarchyDao.getUserHierarchysDao.mockResolvedValue([
            {
                config: {
                siblings: {
                    sub_merchants: [],
                },
                },
            },
            ]);

            beneficiaryDao.getBeneficiaryAccountDaoAll.mockResolvedValue([]);

            const filters = {};

            await getBeneficiaryAccountService(
            filters,
            Role.MERCHANT,
            1,
            10,
            15,
            Role.MERCHANT,
            1
            );

            expect(filters.user_id).toEqual([15]);
        });

        it("should not set user_id when merchant operations parent is missing", async () => {
            hierarchyDao.getUserHierarchysDao.mockResolvedValue([
            {
                config: {},
            },
            ]);

            beneficiaryDao.getBeneficiaryAccountDaoAll.mockResolvedValue([]);

            const filters = {};

            await getBeneficiaryAccountService(
            filters,
            Role.MERCHANT,
            1,
            10,
            20,
            Role.MERCHANT_OPERATIONS,
            1
            );

            expect(filters.user_id).toBeUndefined();
        });

        it("should not append admin user when admin user is not found", async () => {
            userDao.getUserByCompanyCreatedAtDao.mockResolvedValue(null);

            beneficiaryDao.getBeneficiaryAccountDaoAll.mockResolvedValue([]);

            const filters = {
            user_id: 99,
            };

            await getBeneficiaryAccountService(
            filters,
            Role.ADMIN,
            1,
            10,
            1,
            Role.ADMIN,
            5
            );

            expect(filters.user_id).toEqual(99);
        });

        it("should not set role_id when beneficiary role lookup returns empty", async () => {
            rolesDao.getRoleDao.mockResolvedValue([]);

            beneficiaryDao.getBeneficiaryAccountDaoAll.mockResolvedValue([]);

            const filters = {
            beneficiary_role: Role.MERCHANT,
            };

            await getBeneficiaryAccountService(
            filters,
            Role.ADMIN,
            1,
            10,
            1,
            Role.ADMIN,
            1
            );

            expect(filters.role_id).toBeUndefined();
            expect(filters.beneficiary_role).toBeUndefined();
        });

        it("should not append ADMIN role when ADMIN role lookup returns empty", async () => {
            rolesDao.getRoleDao
            .mockResolvedValueOnce([{ id: 10 }])
            .mockResolvedValueOnce([]);

            beneficiaryDao.getBeneficiaryAccountDaoAll.mockResolvedValue([]);

            const filters = {
            beneficiary_role: Role.VENDOR,
            };

            await getBeneficiaryAccountService(
            filters,
            Role.ADMIN,
            1,
            10,
            1,
            Role.ADMIN,
            1
            );

            expect(filters.role_id).toBe(10);
        });

        it("should preserve existing filters while adding company_id", async () => {
            beneficiaryDao.getBeneficiaryAccountDaoAll.mockResolvedValue([]);

            const filters = {
            bank_name: "HDFC",
            account_type: "Settlement",
            };

            await getBeneficiaryAccountService(
            filters,
            Role.ADMIN,
            1,
            10,
            1,
            Role.ADMIN,
            99
            );

            expect(
            beneficiaryDao.getBeneficiaryAccountDaoAll
            ).toHaveBeenCalledWith(
            {
                bank_name: "HDFC",
                account_type: "Settlement",
                company_id: 99,
            },
            1,
            10,
            Role.ADMIN
            );
        });

        it("should default page when invalid page is provided", async () => {
            beneficiaryDao.getBeneficiaryAccountDaoAll.mockResolvedValue([]);

            await getBeneficiaryAccountService(
            {},
            Role.ADMIN,
            "abc",
            20,
            1,
            Role.ADMIN,
            1
            );

            expect(
            beneficiaryDao.getBeneficiaryAccountDaoAll
            ).toHaveBeenCalledWith(
            { company_id: 1 },
            1,
            20,
            Role.ADMIN
            );
        });

        it("should default limit when invalid limit is provided", async () => {
            beneficiaryDao.getBeneficiaryAccountDaoAll.mockResolvedValue([]);

            await getBeneficiaryAccountService(
            {},
            Role.ADMIN,
            2,
            "xyz",
            1,
            Role.ADMIN,
            1
            );

            expect(
            beneficiaryDao.getBeneficiaryAccountDaoAll
            ).toHaveBeenCalledWith(
            { company_id: 1 },
            2,
            10,
            Role.ADMIN
            );
        });

        it("should return DAO result without modification", async () => {
            const daoResult = [
            {
                id: 1,
                bank_name: "ICICI",
            },
            {
                id: 2,
                bank_name: "HDFC",
            },
            ];

            beneficiaryDao.getBeneficiaryAccountDaoAll.mockResolvedValue(daoResult);

            const result = await getBeneficiaryAccountService(
            {},
            Role.ADMIN,
            1,
            10,
            1,
            Role.ADMIN,
            5
            );

            expect(result).toBe(daoResult);
        });

        it("should handle vendor when admin user lookup returns undefined", async () => {
            userDao.getUserByCompanyCreatedAtDao.mockResolvedValue(undefined);

            beneficiaryDao.getBeneficiaryAccountDaoAll.mockResolvedValue([]);

            const filters = {};

            await getBeneficiaryAccountService(
            filters,
            Role.VENDOR,
            1,
            10,
            12,
            Role.VENDOR,
            8
            );

            expect(filters.user_id).toEqual([12]);
        });
    });

    describe("getBeneficiaryAccountBySearchService", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should return search result for ADMIN", async () => {
        beneficiaryDao.getBeneficiaryAccountBySearchDao.mockResolvedValue([
        { id: 1 },
        ]);

        const result = await getBeneficiaryAccountBySearchService(
        {},
        Role.ADMIN,
        1,
        10,
        100,
        Role.ADMIN,
        5
        );

        expect(result).toEqual([{ id: 1 }]);

        expect(
        beneficiaryDao.getBeneficiaryAccountBySearchDao
        ).toHaveBeenCalledWith(
        { company_id: 5 },
        1,
        10,
        Role.ADMIN,
        []
        );
    });

    it("should return search result for MERCHANT", async () => {
        hierarchyDao.getUserHierarchysDao.mockResolvedValue([
        {
            config: {
            siblings: {
                sub_merchants: [2, 3],
            },
            },
        },
        ]);

        beneficiaryDao.getBeneficiaryAccountBySearchDao.mockResolvedValue([]);

        const filters = {};

        await getBeneficiaryAccountBySearchService(
        filters,
        Role.MERCHANT,
        1,
        10,
        1,
        Role.MERCHANT,
        9
        );

        expect(filters.user_id).toEqual([[1, 2, 3]]);
    });

    it("should handle SUB_MERCHANT", async () => {
        hierarchyDao.getUserHierarchysDao.mockResolvedValue([]);

        beneficiaryDao.getBeneficiaryAccountBySearchDao.mockResolvedValue([]);

        const filters = {};

        await getBeneficiaryAccountBySearchService(
        filters,
        Role.MERCHANT,
        1,
        10,
        22,
        Role.SUB_MERCHANT,
        9
        );

        expect(filters.user_id).toEqual([22]);
    });

    it("should handle MERCHANT_OPERATIONS", async () => {
        hierarchyDao.getUserHierarchysDao
        .mockResolvedValueOnce([
            {
            config: {
                parent: 10,
            },
            },
        ])
        .mockResolvedValueOnce([
            {
            config: {
                siblings: {
                sub_merchants: [20, 30],
                },
            },
            },
        ]);

        beneficiaryDao.getBeneficiaryAccountBySearchDao.mockResolvedValue([]);

        const filters = {};

        await getBeneficiaryAccountBySearchService(
        filters,
        Role.MERCHANT,
        1,
        10,
        5,
        Role.MERCHANT_OPERATIONS,
        9
        );

        expect(filters.user_id).toEqual([[10, 20, 30]]);
    });

    it("should handle VENDOR", async () => {
        hierarchyDao.getUserHierarchysDao.mockResolvedValue([
        {
            config: {
            siblings: {
                sub_vendor: [50, 60],
            },
            },
        },
        ]);

        userDao.getUserByCompanyCreatedAtDao.mockResolvedValue({
        id: 999,
        });

        beneficiaryDao.getBeneficiaryAccountBySearchDao.mockResolvedValue([]);

        const filters = {};

        await getBeneficiaryAccountBySearchService(
        filters,
        Role.VENDOR,
        1,
        10,
        7,
        Role.VENDOR,
        2
        );

        expect(filters.user_id).toEqual([[50, 60], 999]);
    });

    it("should handle VENDOR_ADMIN", async () => {
        hierarchyDao.getUserHierarchysDao.mockResolvedValue([
        {
            config: {
            siblings: {
                sub_vendor: [],
            },
            },
        },
        ]);

        userDao.getUserByCompanyCreatedAtDao.mockResolvedValue({
        id: 999,
        });

        beneficiaryDao.getBeneficiaryAccountBySearchDao.mockResolvedValue([]);

        const filters = {};

        await getBeneficiaryAccountBySearchService(
        filters,
        Role.VENDOR,
        1,
        10,
        9,
        Role.VENDOR_ADMIN,
        1
        );

        expect(filters.user_id).toEqual([9, 999]);
    });

    it("should handle SUB_VENDOR", async () => {
        hierarchyDao.getUserHierarchysDao.mockResolvedValue([]);

        userDao.getUserByCompanyCreatedAtDao.mockResolvedValue({
        id: 500,
        });

        beneficiaryDao.getBeneficiaryAccountBySearchDao.mockResolvedValue([]);

        const filters = {};

        await getBeneficiaryAccountBySearchService(
        filters,
        Role.VENDOR,
        1,
        10,
        12,
        Role.SUB_VENDOR,
        8
        );

        expect(filters.user_id).toEqual([12, 500]);
    });

    it("should handle VENDOR_OPERATIONS", async () => {
        hierarchyDao.getUserHierarchysDao
        .mockResolvedValueOnce([
            {
            config: {
                parent: 88,
            },
            },
        ])
        .mockResolvedValueOnce([
            {
            config: {
                parent: 88,
            },
            },
        ]);

        userDao.getUserByCompanyCreatedAtDao.mockResolvedValue({
        id: 999,
        });

        beneficiaryDao.getBeneficiaryAccountBySearchDao.mockResolvedValue([]);

        const filters = {};

        await getBeneficiaryAccountBySearchService(
        filters,
        Role.VENDOR,
        1,
        10,
        11,
        Role.VENDOR_OPERATIONS,
        7
        );

        expect(filters.user_id).toEqual([88, 999]);
    });

    it("should append admin user for ADMIN", async () => {
        hierarchyDao.getUserHierarchysDao.mockResolvedValue([]);

        userDao.getUserByCompanyCreatedAtDao.mockResolvedValue({
        id: 777,
        });

        beneficiaryDao.getBeneficiaryAccountBySearchDao.mockResolvedValue([]);

        const filters = {
        user_id: 15,
        };

        await getBeneficiaryAccountBySearchService(
        filters,
        Role.ADMIN,
        1,
        10,
        1,
        Role.ADMIN,
        2
        );

        expect(filters.user_id).toEqual([15, 777]);
    });

    it("should lookup beneficiary role", async () => {
        hierarchyDao.getUserHierarchysDao.mockResolvedValue([]);

        rolesDao.getRoleDao.mockResolvedValue([{ id: 15 }]);

        beneficiaryDao.getBeneficiaryAccountBySearchDao.mockResolvedValue([]);

        const filters = {
        beneficiary_role: Role.MERCHANT,
        };

        await getBeneficiaryAccountBySearchService(
        filters,
        Role.ADMIN,
        1,
        10,
        1,
        Role.ADMIN,
        1
        );

        expect(filters.role_id).toBe(15);

        expect(filters.beneficiary_role).toBeUndefined();
    });

    it("should lookup ADMIN role when beneficiary role is VENDOR", async () => {
        hierarchyDao.getUserHierarchysDao.mockResolvedValue([]);

        rolesDao.getRoleDao
        .mockResolvedValueOnce([{ id: 9 }])
        .mockResolvedValueOnce([{ id: 1 }]);

        beneficiaryDao.getBeneficiaryAccountBySearchDao.mockResolvedValue([]);

        const filters = {
        beneficiary_role: Role.VENDOR,
        };

        await getBeneficiaryAccountBySearchService(
        filters,
        Role.ADMIN,
        1,
        10,
        1,
        Role.ADMIN,
        1
        );

        expect(filters.role_id).toEqual([9, 1]);
    });

    it("should parse comma separated search", async () => {
        hierarchyDao.getUserHierarchysDao.mockResolvedValue([]);

        beneficiaryDao.getBeneficiaryAccountBySearchDao.mockResolvedValue([]);

        const filters = {
        search: "abc, def , ghi",
        };

        await getBeneficiaryAccountBySearchService(
        filters,
        Role.ADMIN,
        "2",
        "15",
        1,
        Role.ADMIN,
        8
        );

        expect(
        beneficiaryDao.getBeneficiaryAccountBySearchDao
        ).toHaveBeenCalledWith(
        { company_id: 8 },
        2,
        15,
        Role.ADMIN,
        ["abc", "def", "ghi"]
        );
    });

    it("should remove search from filters", async () => {
        hierarchyDao.getUserHierarchysDao.mockResolvedValue([]);

        beneficiaryDao.getBeneficiaryAccountBySearchDao.mockResolvedValue([]);

        const filters = {
        search: "abc",
        };

        await getBeneficiaryAccountBySearchService(
        filters,
        Role.ADMIN,
        1,
        10,
        1,
        Role.ADMIN,
        1
        );

        expect(filters.search).toBeUndefined();
    });

    it("should throw BadRequestError for empty search", async () => {
        hierarchyDao.getUserHierarchysDao.mockResolvedValue([]);

        const filters = {
        search: " , , ",
        };

        await expect(
        getBeneficiaryAccountBySearchService(
            filters,
            Role.ADMIN,
            1,
            10,
            1,
            Role.ADMIN,
            1
        )
        ).rejects.toThrow(BadRequestError);
    });

    it("should use default pagination", async () => {
        hierarchyDao.getUserHierarchysDao.mockResolvedValue([]);

        beneficiaryDao.getBeneficiaryAccountBySearchDao.mockResolvedValue([]);

        await getBeneficiaryAccountBySearchService(
        {},
        Role.ADMIN,
        undefined,
        undefined,
        1,
        Role.ADMIN,
        5
        );

        expect(
        beneficiaryDao.getBeneficiaryAccountBySearchDao
        ).toHaveBeenCalledWith(
        { company_id: 5 },
        1,
        10,
        Role.ADMIN,
        []
        );
    });

    it("should return empty array", async () => {
        hierarchyDao.getUserHierarchysDao.mockResolvedValue([]);

        beneficiaryDao.getBeneficiaryAccountBySearchDao.mockResolvedValue([]);

        const result = await getBeneficiaryAccountBySearchService(
        {},
        Role.ADMIN,
        1,
        10,
        1,
        Role.ADMIN,
        1
        );

        expect(result).toEqual([]);
    });

    it("should propagate DAO errors", async () => {
        hierarchyDao.getUserHierarchysDao.mockResolvedValue([]);

        const error = new Error("DAO Error");

        beneficiaryDao.getBeneficiaryAccountBySearchDao.mockRejectedValue(error);

        await expect(
        getBeneficiaryAccountBySearchService(
            {},
            Role.ADMIN,
            1,
            10,
            1,
            Role.ADMIN,
            1
        )
        ).rejects.toThrow(error);
    });

    it("should log DAO errors", async () => {
        hierarchyDao.getUserHierarchysDao.mockResolvedValue([]);

        const error = new Error("failed");

        beneficiaryDao.getBeneficiaryAccountBySearchDao.mockRejectedValue(error);

        await expect(
        getBeneficiaryAccountBySearchService(
            {},
            Role.ADMIN,
            1,
            10,
            1,
            Role.ADMIN,
            1
        )
        ).rejects.toThrow(error);

        expect(logger.error).toHaveBeenCalledWith(
        "Error in get BeneficiaryAccountBySearchService:",
        error
        );
    });
    });

    describe("Additional getBeneficiaryAccountBySearchService test cases", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should use current user when vendor has no sub vendors", async () => {
            hierarchyDao.getUserHierarchysDao.mockResolvedValue([
            {
                config: {
                siblings: {
                    sub_vendor: [],
                },
                },
            },
            ]);

            userDao.getUserByCompanyCreatedAtDao.mockResolvedValue({
            id: 500,
            });

            beneficiaryDao.getBeneficiaryAccountBySearchDao.mockResolvedValue([]);

            const filters = {};

            await getBeneficiaryAccountBySearchService(
            filters,
            Role.VENDOR,
            1,
            10,
            25,
            Role.VENDOR,
            1
            );

            expect(filters.user_id).toEqual([25, 500]);
        });

        it("should not overwrite user_id when vendor operations parent does not exist", async () => {
            hierarchyDao.getUserHierarchysDao
            .mockResolvedValueOnce([
                {
                config: {},
                },
            ]);

            userDao.getUserByCompanyCreatedAtDao.mockResolvedValue({
            id: 900,
            });

            beneficiaryDao.getBeneficiaryAccountBySearchDao.mockResolvedValue([]);

            const filters = {};

            await getBeneficiaryAccountBySearchService(
            filters,
            Role.VENDOR,
            1,
            10,
            12,
            Role.VENDOR_OPERATIONS,
            2
            );

            expect(filters.user_id).toEqual([900]);
        });

        it("should not append admin user when admin lookup returns null", async () => {
            hierarchyDao.getUserHierarchysDao.mockResolvedValue([
            {
                config: {},
            },
            ]);

            userDao.getUserByCompanyCreatedAtDao.mockResolvedValue(null);

            beneficiaryDao.getBeneficiaryAccountBySearchDao.mockResolvedValue([]);

            const filters = {
            user_id: 99,
            };

            await getBeneficiaryAccountBySearchService(
            filters,
            Role.ADMIN,
            1,
            10,
            1,
            Role.ADMIN,
            5
            );

            expect(filters.user_id).toEqual(99);
        });

        it("should support a single search keyword", async () => {
            hierarchyDao.getUserHierarchysDao.mockResolvedValue([]);

            beneficiaryDao.getBeneficiaryAccountBySearchDao.mockResolvedValue([]);

            const filters = {
            search: "ICICI",
            };

            await getBeneficiaryAccountBySearchService(
            filters,
            Role.ADMIN,
            1,
            10,
            1,
            Role.ADMIN,
            3
            );

            expect(
            beneficiaryDao.getBeneficiaryAccountBySearchDao
            ).toHaveBeenCalledWith(
            { company_id: 3 },
            1,
            10,
            Role.ADMIN,
            ["ICICI"]
            );
        });

        it("should trim multiple search keywords correctly", async () => {
            hierarchyDao.getUserHierarchysDao.mockResolvedValue([]);

            beneficiaryDao.getBeneficiaryAccountBySearchDao.mockResolvedValue([]);

            const filters = {
            search: "  SBI ,  HDFC  , ICICI ",
            };

            await getBeneficiaryAccountBySearchService(
            filters,
            Role.ADMIN,
            1,
            10,
            1,
            Role.ADMIN,
            7
            );

            expect(
            beneficiaryDao.getBeneficiaryAccountBySearchDao
            ).toHaveBeenCalledWith(
            { company_id: 7 },
            1,
            10,
            Role.ADMIN,
            ["SBI", "HDFC", "ICICI"]
            );
        });

        it("should preserve existing filters after removing search", async () => {
            hierarchyDao.getUserHierarchysDao.mockResolvedValue([]);

            beneficiaryDao.getBeneficiaryAccountBySearchDao.mockResolvedValue([]);

            const filters = {
            bank_name: "Axis",
            search: "abc",
            };

            await getBeneficiaryAccountBySearchService(
            filters,
            Role.ADMIN,
            1,
            10,
            1,
            Role.ADMIN,
            8
            );

            expect(
            beneficiaryDao.getBeneficiaryAccountBySearchDao
            ).toHaveBeenCalledWith(
            {
                bank_name: "Axis",
                company_id: 8,
            },
            1,
            10,
            Role.ADMIN,
            ["abc"]
            );
        });

        it("should not assign role_id when beneficiary role lookup returns empty", async () => {
            hierarchyDao.getUserHierarchysDao.mockResolvedValue([]);

            rolesDao.getRoleDao.mockResolvedValue([]);

            beneficiaryDao.getBeneficiaryAccountBySearchDao.mockResolvedValue([]);

            const filters = {
            beneficiary_role: Role.MERCHANT,
            };

            await getBeneficiaryAccountBySearchService(
            filters,
            Role.ADMIN,
            1,
            10,
            1,
            Role.ADMIN,
            1
            );

            expect(filters.role_id).toBeUndefined();
            expect(filters.beneficiary_role).toBeUndefined();
        });

        it("should return DAO response without modification", async () => {
            hierarchyDao.getUserHierarchysDao.mockResolvedValue([]);

            const daoResponse = [
            {
                id: 1,
                bank_name: "HDFC",
            },
            {
                id: 2,
                bank_name: "ICICI",
            },
            ];

            beneficiaryDao.getBeneficiaryAccountBySearchDao.mockResolvedValue(
            daoResponse
            );

            const result = await getBeneficiaryAccountBySearchService(
            {},
            Role.ADMIN,
            1,
            10,
            1,
            Role.ADMIN,
            5
            );

            expect(result).toBe(daoResponse);
        });
    });
    
    describe("getBeneficiaryAccountServiceByBankName", () => {
    beforeEach(() => {
        jest.clearAllMocks();

        mockConn = {
        release: jest.fn(),
        };
    });

    it("should return beneficiary accounts by bank name", async () => {
        const result = [{ id: 1 }];

        hierarchyDao.getUserHierarchysDao.mockResolvedValue([
        { config: {} },
        ]);

        beneficiaryDao.getBeneficiaryAccountDaoByBankName.mockResolvedValue(result);

        const response =
        await getBeneficiaryAccountServiceByBankName(
            10,
            "Settlement",
            Role.ADMIN,
            5,
            Role.ADMIN
        );

        expect(response).toEqual(result);

        expect(
        beneficiaryDao.getBeneficiaryAccountDaoByBankName
        ).toHaveBeenCalledWith(
        10,
        "Settlement",
        {},
        null
        );
    });

    it("should use user_id filter for vendor", async () => {
        hierarchyDao.getUserHierarchysDao.mockResolvedValue([
        { config: {} },
        ]);

        beneficiaryDao.getBeneficiaryAccountDaoByBankName.mockResolvedValue([]);

        await getBeneficiaryAccountServiceByBankName(
        20,
        "Settlement",
        Role.VENDOR,
        100,
        Role.VENDOR
        );

        expect(
        beneficiaryDao.getBeneficiaryAccountDaoByBankName
        ).toHaveBeenCalledWith(
        20,
        "Settlement",
        {
            user_id: [100],
        },
        null
        );
    });

    it("should use parent user for vendor operations", async () => {
        hierarchyDao.getUserHierarchysDao.mockResolvedValue([
        {
            config: {
            parent: 555,
            },
        },
        ]);

        beneficiaryDao.getBeneficiaryAccountDaoByBankName.mockResolvedValue([]);

        await getBeneficiaryAccountServiceByBankName(
        20,
        "Settlement",
        Role.VENDOR,
        100,
        Role.VENDOR_OPERATIONS
        );

        expect(
        beneficiaryDao.getBeneficiaryAccountDaoByBankName
        ).toHaveBeenCalledWith(
        20,
        "Settlement",
        {
            user_id: [555],
        },
        null
        );
    });

    it("should not set parent filter when parent does not exist", async () => {
        hierarchyDao.getUserHierarchysDao.mockResolvedValue([
        {
            config: {},
        },
        ]);

        beneficiaryDao.getBeneficiaryAccountDaoByBankName.mockResolvedValue([]);

        await getBeneficiaryAccountServiceByBankName(
        20,
        "Settlement",
        Role.VENDOR,
        100,
        Role.VENDOR_OPERATIONS
        );

        expect(
        beneficiaryDao.getBeneficiaryAccountDaoByBankName
        ).toHaveBeenCalledWith(
        20,
        "Settlement",
        {
            user_id: [100],
        },
        null
        );
    });

    it("should call getUserHierarchysDao with correct parameters", async () => {
        hierarchyDao.getUserHierarchysDao.mockResolvedValue([
        { config: {} },
        ]);

        beneficiaryDao.getBeneficiaryAccountDaoByBankName.mockResolvedValue([]);

        await getBeneficiaryAccountServiceByBankName(
        15,
        "Primary",
        Role.ADMIN,
        22,
        Role.ADMIN
        );

        expect(hierarchyDao.getUserHierarchysDao).toHaveBeenCalledWith(
        { user_id: 22 },
        null,
        null,
        null,
        null,
        null,
        null
        );
    });

    it("should propagate hierarchy DAO errors", async () => {
        const error = new Error("Hierarchy failed");

        hierarchyDao.getUserHierarchysDao.mockRejectedValue(error);

        await expect(
        getBeneficiaryAccountServiceByBankName(
            10,
            "Settlement",
            Role.ADMIN,
            1,
            Role.ADMIN
        )
        ).rejects.toThrow(error);

        expect(logger.error).toHaveBeenCalledWith(
        "error in _getBeneficiaryAccountServiceByBankNameInternal",
        error
        );

        expect(logger.error).toHaveBeenCalledWith(
        "error getting while getting beneficiary by bank name",
        error
        );
    });

    it("should propagate beneficiary DAO errors", async () => {
        const error = new Error("DAO failed");

        hierarchyDao.getUserHierarchysDao.mockResolvedValue([
        { config: {} },
        ]);

        beneficiaryDao.getBeneficiaryAccountDaoByBankName.mockRejectedValue(error);

        await expect(
        getBeneficiaryAccountServiceByBankName(
            10,
            "Settlement",
            Role.ADMIN,
            1,
            Role.ADMIN
        )
        ).rejects.toThrow(error);

        expect(logger.error).toHaveBeenCalledWith(
        "error in _getBeneficiaryAccountServiceByBankNameInternal",
        error
        );

        expect(logger.error).toHaveBeenCalledWith(
        "error getting while getting beneficiary by bank name",
        error
        );
    });

    it("should return empty array when DAO returns empty array", async () => {
        hierarchyDao.getUserHierarchysDao.mockResolvedValue([
        { config: {} },
        ]);

        beneficiaryDao.getBeneficiaryAccountDaoByBankName.mockResolvedValue([]);

        const result =
        await getBeneficiaryAccountServiceByBankName(
            1,
            "Settlement",
            Role.ADMIN,
            10,
            Role.ADMIN
        );

        expect(result).toEqual([]);
    });

    it("should work for ADMIN role", async () => {
        hierarchyDao.getUserHierarchysDao.mockResolvedValue([
        { config: {} },
        ]);

        beneficiaryDao.getBeneficiaryAccountDaoByBankName.mockResolvedValue([]);

        await getBeneficiaryAccountServiceByBankName(
        1,
        "Settlement",
        Role.ADMIN,
        5,
        Role.ADMIN
        );

        expect(
        beneficiaryDao.getBeneficiaryAccountDaoByBankName
        ).toHaveBeenCalled();
    });

    it("should work for MERCHANT role", async () => {
        hierarchyDao.getUserHierarchysDao.mockResolvedValue([
        { config: {} },
        ]);

        beneficiaryDao.getBeneficiaryAccountDaoByBankName.mockResolvedValue([]);

        await getBeneficiaryAccountServiceByBankName(
        1,
        "Settlement",
        Role.MERCHANT,
        5,
        Role.MERCHANT
        );

        expect(
        beneficiaryDao.getBeneficiaryAccountDaoByBankName
        ).toHaveBeenCalled();
    });

    it("should work when hierarchy array is empty", async () => {
        hierarchyDao.getUserHierarchysDao.mockResolvedValue([]);

        beneficiaryDao.getBeneficiaryAccountDaoByBankName.mockResolvedValue([]);

        await getBeneficiaryAccountServiceByBankName(
        1,
        "Settlement",
        Role.VENDOR,
        5,
        Role.VENDOR_OPERATIONS
        );

        expect(
        beneficiaryDao.getBeneficiaryAccountDaoByBankName
        ).toHaveBeenCalledWith(
        1,
        "Settlement",
        {
            user_id: [5],
        },
        null
        );
    });
    });

    describe("Additional getBeneficiaryAccountServiceByBankName test cases", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should call DAO with empty filters for ADMIN role", async () => {
            hierarchyDao.getUserHierarchysDao.mockResolvedValue([
            {
                config: {},
            },
            ]);

            beneficiaryDao.getBeneficiaryAccountDaoByBankName.mockResolvedValue([]);

            await getBeneficiaryAccountServiceByBankName(
            1,
            "Settlement",
            Role.ADMIN,
            99,
            Role.ADMIN
            );

            expect(
            beneficiaryDao.getBeneficiaryAccountDaoByBankName
            ).toHaveBeenCalledWith(
            1,
            "Settlement",
            {},
            null
            );
        });

        it("should return DAO response without modification", async () => {
            const daoResponse = [
            {
                id: 1,
                bank_name: "HDFC",
            },
            {
                id: 2,
                bank_name: "ICICI",
            },
            ];

            hierarchyDao.getUserHierarchysDao.mockResolvedValue([
            {
                config: {},
            },
            ]);

            beneficiaryDao.getBeneficiaryAccountDaoByBankName.mockResolvedValue(
            daoResponse
            );

            const result = await getBeneficiaryAccountServiceByBankName(
            10,
            "Settlement",
            Role.ADMIN,
            5,
            Role.ADMIN
            );

            expect(result).toBe(daoResponse);
        });

        it("should handle undefined hierarchy config for vendor operations", async () => {
            hierarchyDao.getUserHierarchysDao.mockResolvedValue([
            {},
            ]);

            beneficiaryDao.getBeneficiaryAccountDaoByBankName.mockResolvedValue([]);

            await getBeneficiaryAccountServiceByBankName(
            10,
            "Settlement",
            Role.VENDOR,
            55,
            Role.VENDOR_OPERATIONS
            );

            expect(
            beneficiaryDao.getBeneficiaryAccountDaoByBankName
            ).toHaveBeenCalledWith(
            10,
            "Settlement",
            {
                user_id: [55],
            },
            null
            );
        });

        it("should call hierarchy DAO exactly once for ADMIN role", async () => {
            hierarchyDao.getUserHierarchysDao.mockResolvedValue([
            {
                config: {},
            },
            ]);

            beneficiaryDao.getBeneficiaryAccountDaoByBankName.mockResolvedValue([]);

            await getBeneficiaryAccountServiceByBankName(
            1,
            "Settlement",
            Role.ADMIN,
            5,
            Role.ADMIN
            );

            expect(hierarchyDao.getUserHierarchysDao).toHaveBeenCalledTimes(1);
        });

        it("should call hierarchy DAO twice for vendor operations when parent exists", async () => {
            hierarchyDao.getUserHierarchysDao.mockResolvedValue([
            {
                config: {
                parent: 999,
                },
            },
            ]);

            beneficiaryDao.getBeneficiaryAccountDaoByBankName.mockResolvedValue([]);

            await getBeneficiaryAccountServiceByBankName(
            1,
            "Settlement",
            Role.VENDOR,
            100,
            Role.VENDOR_OPERATIONS
            );

            expect(hierarchyDao.getUserHierarchysDao).toHaveBeenCalledTimes(1);

            expect(
            beneficiaryDao.getBeneficiaryAccountDaoByBankName
            ).toHaveBeenCalledWith(
            1,
            "Settlement",
            {
                user_id: [999],
            },
            null
            );
        });
    });
    
    describe("createBeneficiaryAccountService", () => {
    const payload = {
        user_id: 10,
        created_by: 99,
        updated_by: 99,
        acc_no: "123456",
        bank_name: "HDFC",
        type: "Settlement",
        initial_balance: 1000,
    };

    beforeEach(() => {
        jest.clearAllMocks();

        mockConn = {
        release: jest.fn(),
        };

        db.getConnection.mockResolvedValue(mockConn);
        db.beginTransaction.mockResolvedValue();
        db.commit.mockResolvedValue();
        db.rollback.mockResolvedValue();
    });

    it("should create beneficiary account successfully for ADMIN", async () => {
        const result = { id: 1 };

        userDao.getUserByIdDao.mockResolvedValue([
        { id: 10, role: Role.ADMIN },
        ]);

        rolesDao.getRoleDao.mockResolvedValue([
        { id: 1, role: Role.ADMIN },
        ]);

        userDao.getUserByCompanyCreatedAtDao.mockResolvedValue({
        id: 999,
        });

        beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([]);

        beneficiaryDao.createBeneficiaryAccountDao.mockResolvedValue(result);

        const response = await createBeneficiaryAccountService(
        { ...payload },
        100
        );

        expect(response).toEqual(result);

        expect(db.beginTransaction).toHaveBeenCalledWith(mockConn);
        expect(db.commit).toHaveBeenCalledWith(mockConn);
        expect(mockConn.release).toHaveBeenCalled();
    });

    it("should create beneficiary account successfully for VENDOR", async () => {
        userDao.getUserByIdDao.mockResolvedValue([
        { id: 10, role: Role.VENDOR },
        ]);

        rolesDao.getRoleDao.mockResolvedValue([
        { id: 2, role: Role.VENDOR },
        ]);

        beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([]);

        beneficiaryDao.createBeneficiaryAccountDao.mockResolvedValue({
        id: 2,
        });

        const result = await createBeneficiaryAccountService(
        { ...payload },
        1
        );

        expect(result.id).toBe(2);

        const createPayload =
        beneficiaryDao.createBeneficiaryAccountDao.mock.calls[0][0];

        expect(createPayload.config).toEqual({
        type: "Personal",
        initial_balance: 0,
        closing_balance: 0,
        is_enabled: true,
        });
    });

    it("should create beneficiary account successfully for MERCHANT", async () => {
        userDao.getUserByIdDao.mockResolvedValue([
        { id: 10, role: Role.MERCHANT },
        ]);

        rolesDao.getRoleDao.mockResolvedValue([
        { id: 3, role: Role.MERCHANT },
        ]);

        beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([]);

        beneficiaryDao.createBeneficiaryAccountDao.mockResolvedValue({
        id: 3,
        });

        await createBeneficiaryAccountService(
        { ...payload },
        1
        );

        const createPayload =
        beneficiaryDao.createBeneficiaryAccountDao.mock.calls[0][0];

        expect(createPayload.config).toEqual({
        type: "Personal",
        });
    });

    it("should rollback when duplicate account exists", async () => {
        const error = new BadRequestError(
        "Beneficiary account already exists for this merchant"
        );

        userDao.getUserByIdDao.mockResolvedValue([
        { id: 10, role: Role.MERCHANT },
        ]);

        rolesDao.getRoleDao.mockResolvedValue([
        { id: 1, role: Role.MERCHANT },
        ]);

        beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([
        { id: 100 },
        ]);

        await expect(
        createBeneficiaryAccountService(
            { ...payload },
            1
        )
        ).rejects.toThrow(error);

        expect(db.rollback).toHaveBeenCalledWith(mockConn);
        expect(db.commit).not.toHaveBeenCalled();
    });

    it("should throw when user does not exist", async () => {
        userDao.getUserByIdDao.mockResolvedValue([]);

        await expect(
        createBeneficiaryAccountService(
            { ...payload },
            1
        )
        ).rejects.toThrow("User not found");

        expect(db.rollback).toHaveBeenCalledWith(mockConn);
    });

    it("should throw when role does not exist", async () => {
        userDao.getUserByIdDao.mockResolvedValue([
        { id: 10, role: Role.ADMIN },
        ]);

        rolesDao.getRoleDao.mockResolvedValue([]);

        await expect(
        createBeneficiaryAccountService(
            { ...payload },
            1
        )
        ).rejects.toThrow("Role not found");

        expect(db.rollback).toHaveBeenCalledWith(mockConn);
    });

    it("should rollback when createBeneficiaryAccountDao throws", async () => {
        const error = new Error("create failed");

        userDao.getUserByIdDao.mockResolvedValue([
        { id: 10, role: Role.MERCHANT },
        ]);

        rolesDao.getRoleDao.mockResolvedValue([
        { id: 1, role: Role.MERCHANT },
        ]);

        beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([]);

        beneficiaryDao.createBeneficiaryAccountDao.mockRejectedValue(error);

        await expect(
        createBeneficiaryAccountService(
            { ...payload },
            1
        )
        ).rejects.toThrow(error);

        expect(db.rollback).toHaveBeenCalledWith(mockConn);

        expect(logger.error).toHaveBeenCalledWith(
        "error in _createBeneficiaryAccountServiceInternal",
        error
        );

        expect(logger.error).toHaveBeenCalledWith(
        "error getting while creating beneficiary account",
        error
        );
    });

    it("should rollback when commit fails", async () => {
        const error = new Error("commit failed");

        userDao.getUserByIdDao.mockResolvedValue([
        { id: 10, role: Role.MERCHANT },
        ]);

        rolesDao.getRoleDao.mockResolvedValue([
        { id: 1, role: Role.MERCHANT },
        ]);

        beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([]);

        beneficiaryDao.createBeneficiaryAccountDao.mockResolvedValue({
        id: 1,
        });

        db.commit.mockRejectedValue(error);

        await expect(
        createBeneficiaryAccountService(
            { ...payload },
            1
        )
        ).rejects.toThrow(error);

        expect(db.rollback).toHaveBeenCalledWith(mockConn);
    });

    it("should release connection after success", async () => {
        userDao.getUserByIdDao.mockResolvedValue([
        { id: 10, role: Role.MERCHANT },
        ]);

        rolesDao.getRoleDao.mockResolvedValue([
        { id: 1, role: Role.MERCHANT },
        ]);

        beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([]);

        beneficiaryDao.createBeneficiaryAccountDao.mockResolvedValue({
        id: 1,
        });

        await createBeneficiaryAccountService(
        { ...payload },
        1
        );

        expect(mockConn.release).toHaveBeenCalledTimes(1);
    });

    it("should release connection after rollback", async () => {
        const error = new Error("dao error");

        userDao.getUserByIdDao.mockResolvedValue([
        { id: 10, role: Role.MERCHANT },
        ]);

        rolesDao.getRoleDao.mockResolvedValue([
        { id: 1, role: Role.MERCHANT },
        ]);

        beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([]);

        beneficiaryDao.createBeneficiaryAccountDao.mockRejectedValue(error);

        await expect(
        createBeneficiaryAccountService(
            { ...payload },
            1
        )
        ).rejects.toThrow(error);

        expect(mockConn.release).toHaveBeenCalledTimes(1);
    });

    it("should rollback when beginTransaction fails", async () => {
        const error = new Error("begin failed");

        db.beginTransaction.mockRejectedValue(error);

        await expect(
        createBeneficiaryAccountService(
            { ...payload },
            1
        )
        ).rejects.toThrow(error);

        expect(db.rollback).toHaveBeenCalledWith(mockConn);
    });

    it("should throw when getConnection fails", async () => {
        const error = new Error("connection failed");

        db.getConnection.mockRejectedValue(error);

        await expect(
        createBeneficiaryAccountService(
            { ...payload },
            1
        )
        ).rejects.toThrow(error);

        expect(db.rollback).not.toHaveBeenCalled();
    });
    });

    describe("Additional createBeneficiaryAccountService test cases", () => {
        const payload = {
            user_id: 10,
            created_by: 10,
            updated_by: 10,
            acc_no: "123456789",
            bank_name: "HDFC",
            type: "Settlement",
            initial_balance: 5000,
        };

        beforeEach(() => {
            jest.clearAllMocks();

            mockConn = {
            release: jest.fn(),
            };

            db.getConnection.mockResolvedValue(mockConn);
            db.beginTransaction.mockResolvedValue();
            db.commit.mockResolvedValue();
            db.rollback.mockResolvedValue();
        });

        it("should overwrite payload user_id with company admin for ADMIN role", async () => {
            userDao.getUserByIdDao.mockResolvedValue([
            { id: 10, role: Role.ADMIN },
            ]);

            rolesDao.getRoleDao.mockResolvedValue([
            { id: 1, role: Role.ADMIN },
            ]);

            userDao.getUserByCompanyCreatedAtDao.mockResolvedValue({
            id: 999,
            });

            beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([]);
            beneficiaryDao.createBeneficiaryAccountDao.mockResolvedValue({ id: 1 });

            await createBeneficiaryAccountService({ ...payload }, 5);

            const createPayload =
            beneficiaryDao.createBeneficiaryAccountDao.mock.calls[0][0];

            expect(createPayload.user_id).toBe(999);
        });

        it("should keep original user_id when company admin is not found", async () => {
            userDao.getUserByIdDao.mockResolvedValue([
            { id: 10, role: Role.ADMIN },
            ]);

            rolesDao.getRoleDao.mockResolvedValue([
            { id: 1, role: Role.ADMIN },
            ]);

            userDao.getUserByCompanyCreatedAtDao.mockResolvedValue(null);

            beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([]);
            beneficiaryDao.createBeneficiaryAccountDao.mockResolvedValue({ id: 1 });

            await createBeneficiaryAccountService({ ...payload }, 5);

            const createPayload =
            beneficiaryDao.createBeneficiaryAccountDao.mock.calls[0][0];

            expect(createPayload.user_id).toBe(10);
        });

        it("should remove type and initial_balance from ADMIN payload", async () => {
            userDao.getUserByIdDao.mockResolvedValue([
            { id: 10, role: Role.ADMIN },
            ]);

            rolesDao.getRoleDao.mockResolvedValue([
            { id: 1, role: Role.ADMIN },
            ]);

            userDao.getUserByCompanyCreatedAtDao.mockResolvedValue({
            id: 999,
            });

            beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([]);
            beneficiaryDao.createBeneficiaryAccountDao.mockResolvedValue({ id: 1 });

            await createBeneficiaryAccountService({ ...payload }, 1);

            const createPayload =
            beneficiaryDao.createBeneficiaryAccountDao.mock.calls[0][0];

            expect(createPayload.type).toBeUndefined();
            expect(createPayload.initial_balance).toBeUndefined();
        });

        it("should remove type from vendor payload", async () => {
            userDao.getUserByIdDao.mockResolvedValue([
            { id: 10, role: Role.VENDOR },
            ]);

            rolesDao.getRoleDao.mockResolvedValue([
            { id: 2, role: Role.VENDOR },
            ]);

            beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([]);
            beneficiaryDao.createBeneficiaryAccountDao.mockResolvedValue({ id: 2 });

            await createBeneficiaryAccountService({ ...payload }, 1);

            const createPayload =
            beneficiaryDao.createBeneficiaryAccountDao.mock.calls[0][0];

            expect(createPayload.type).toBeUndefined();
        });

        it("should remove initial_balance from vendor payload", async () => {
            userDao.getUserByIdDao.mockResolvedValue([
            { id: 10, role: Role.VENDOR },
            ]);

            rolesDao.getRoleDao.mockResolvedValue([
            { id: 2, role: Role.VENDOR },
            ]);

            beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([]);
            beneficiaryDao.createBeneficiaryAccountDao.mockResolvedValue({ id: 2 });

            await createBeneficiaryAccountService({ ...payload }, 1);

            const createPayload =
            beneficiaryDao.createBeneficiaryAccountDao.mock.calls[0][0];

            expect(createPayload.initial_balance).toBeUndefined();
        });

        it("should remove type from merchant payload", async () => {
            userDao.getUserByIdDao.mockResolvedValue([
            { id: 10, role: Role.MERCHANT },
            ]);

            rolesDao.getRoleDao.mockResolvedValue([
            { id: 3, role: Role.MERCHANT },
            ]);

            beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([]);
            beneficiaryDao.createBeneficiaryAccountDao.mockResolvedValue({ id: 3 });

            await createBeneficiaryAccountService({ ...payload }, 1);

            const createPayload =
            beneficiaryDao.createBeneficiaryAccountDao.mock.calls[0][0];

            expect(createPayload.type).toBeUndefined();
        });

        it("should check duplicate using vendor user_id", async () => {
            userDao.getUserByIdDao.mockResolvedValue([
            { id: 10, role: Role.VENDOR },
            ]);

            rolesDao.getRoleDao.mockResolvedValue([
            { id: 2, role: Role.VENDOR },
            ]);

            beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([]);
            beneficiaryDao.createBeneficiaryAccountDao.mockResolvedValue({ id: 1 });

            await createBeneficiaryAccountService({ ...payload }, 1);

            expect(
            beneficiaryDao.getBeneficiaryAccountDao
            ).toHaveBeenCalledWith(
            {
                acc_no: payload.acc_no,
                user_id: payload.user_id,
            },
            null,
            null,
            Role.VENDOR,
            mockConn
            );
        });

        it("should check duplicate without user_id for merchant", async () => {
            userDao.getUserByIdDao.mockResolvedValue([
            { id: 10, role: Role.MERCHANT },
            ]);

            rolesDao.getRoleDao.mockResolvedValue([
            { id: 3, role: Role.MERCHANT },
            ]);

            beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([]);
            beneficiaryDao.createBeneficiaryAccountDao.mockResolvedValue({ id: 1 });

            await createBeneficiaryAccountService({ ...payload }, 1);

            expect(
            beneficiaryDao.getBeneficiaryAccountDao
            ).toHaveBeenCalledWith(
            {
                acc_no: payload.acc_no,
            },
            null,
            null,
            Role.MERCHANT,
            mockConn
            );
        });

        it("should check duplicate without user_id for admin", async () => {
            userDao.getUserByIdDao.mockResolvedValue([
            { id: 10, role: Role.ADMIN },
            ]);

            rolesDao.getRoleDao.mockResolvedValue([
            { id: 1, role: Role.ADMIN },
            ]);

            userDao.getUserByCompanyCreatedAtDao.mockResolvedValue({
            id: 999,
            });

            beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([]);
            beneficiaryDao.createBeneficiaryAccountDao.mockResolvedValue({ id: 1 });

            await createBeneficiaryAccountService({ ...payload }, 1);

            expect(
            beneficiaryDao.getBeneficiaryAccountDao
            ).toHaveBeenCalledWith(
            {
                acc_no: payload.acc_no,
            },
            null,
            null,
            Role.ADMIN,
            mockConn
            );
        });

        it("should assign role_id from role lookup", async () => {
            userDao.getUserByIdDao.mockResolvedValue([
            { id: 10, role: Role.MERCHANT },
            ]);

            rolesDao.getRoleDao.mockResolvedValue([
            { id: 77, role: Role.MERCHANT },
            ]);

            beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([]);
            beneficiaryDao.createBeneficiaryAccountDao.mockResolvedValue({ id: 5 });

            await createBeneficiaryAccountService({ ...payload }, 1);

            const createPayload =
            beneficiaryDao.createBeneficiaryAccountDao.mock.calls[0][0];

            expect(createPayload.role_id).toBe(77);
        });

        it("should return DAO response directly", async () => {
            const daoResponse = {
            id: 123,
            bank_name: "ICICI",
            };

            userDao.getUserByIdDao.mockResolvedValue([
            { id: 10, role: Role.MERCHANT },
            ]);

            rolesDao.getRoleDao.mockResolvedValue([
            { id: 3, role: Role.MERCHANT },
            ]);

            beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([]);
            beneficiaryDao.createBeneficiaryAccountDao.mockResolvedValue(
            daoResponse
            );

            const result = await createBeneficiaryAccountService(
            { ...payload },
            1
            );

            expect(result).toBe(daoResponse);
        });

        it("should call createBeneficiaryAccountDao exactly once", async () => {
            userDao.getUserByIdDao.mockResolvedValue([
            { id: 10, role: Role.MERCHANT },
            ]);

            rolesDao.getRoleDao.mockResolvedValue([
            { id: 3, role: Role.MERCHANT },
            ]);

            beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([]);
            beneficiaryDao.createBeneficiaryAccountDao.mockResolvedValue({ id: 1 });

            await createBeneficiaryAccountService({ ...payload }, 1);

            expect(
            beneficiaryDao.createBeneficiaryAccountDao
            ).toHaveBeenCalledTimes(1);
        });
    });
    
    describe("updateBeneficiaryAccountService", () => {
    const ids = {
        id: 1,
        company_id: 100,
    };

    const payload = {
        acc_no: "123456789",
        bank_name: "HDFC",
        updated_by: 10,
    };

    beforeEach(() => {
        jest.clearAllMocks();

        mockConn = {
        release: jest.fn(),
        };

        db.getConnection.mockResolvedValue(mockConn);
        db.beginTransaction.mockResolvedValue();
        db.commit.mockResolvedValue();
        db.rollback.mockResolvedValue();
    });

    it("should update beneficiary account successfully", async () => {
        const updated = { id: 1 };

        beneficiaryDao.checkBeneficiaryAccountExistsDao.mockResolvedValue(false);

        beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([
        {
            id: 1,
            bank_name: "HDFC",
        },
        ]);

        beneficiaryDao.updateBeneficiaryAccountDao.mockResolvedValue(updated);

        const result = await updateBeneficiaryAccountService(
        ids,
        payload
        );

        expect(result).toEqual(updated);

        expect(db.beginTransaction).toHaveBeenCalledWith(mockConn);

        expect(db.commit).toHaveBeenCalledWith(mockConn);

        expect(mockConn.release).toHaveBeenCalled();
    });

    it("should detect duplicate account number", async () => {
        beneficiaryDao.checkBeneficiaryAccountExistsDao.mockResolvedValue(true);

        await expect(
        updateBeneficiaryAccountService(ids, payload)
        ).rejects.toThrow(
        "Beneficiary account no. already exists"
        );

        expect(db.rollback).toHaveBeenCalledWith(mockConn);

        expect(db.commit).not.toHaveBeenCalled();
    });

    it("should throw when beneficiary account is not found", async () => {
        beneficiaryDao.checkBeneficiaryAccountExistsDao.mockResolvedValue(false);

        beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([]);

        await expect(
        updateBeneficiaryAccountService(ids, payload)
        ).rejects.toThrow(
        "Beneficiary account not found"
        );

        expect(db.rollback).toHaveBeenCalledWith(mockConn);
    });

    it("should skip duplicate check when acc_no is not supplied", async () => {
        beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([
        {
            id: 1,
            bank_name: "ICICI",
        },
        ]);

        beneficiaryDao.updateBeneficiaryAccountDao.mockResolvedValue({
        id: 1,
        });

        await updateBeneficiaryAccountService(
        ids,
        {
            bank_name: "Axis",
        }
        );

        expect(
        beneficiaryDao.checkBeneficiaryAccountExistsDao
        ).not.toHaveBeenCalled();
    });

    it("should rollback when update DAO throws", async () => {
        const error = new Error("update failed");

        beneficiaryDao.checkBeneficiaryAccountExistsDao.mockResolvedValue(false);

        beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([
        {
            id: 1,
            bank_name: "HDFC",
        },
        ]);

        beneficiaryDao.updateBeneficiaryAccountDao.mockRejectedValue(error);

        await expect(
        updateBeneficiaryAccountService(ids, payload)
        ).rejects.toThrow(error);

        expect(db.rollback).toHaveBeenCalledWith(mockConn);

        expect(logger.error).toHaveBeenCalledWith(
        "error in _updateBeneficiaryAccountService",
        error
        );

        expect(logger.error).toHaveBeenCalledWith(
        "error getting while updating banks",
        error.message
        );
    });

    it("should rollback when getBeneficiaryAccountDao throws", async () => {
        const error = new Error("fetch failed");

        beneficiaryDao.checkBeneficiaryAccountExistsDao.mockResolvedValue(false);

        beneficiaryDao.getBeneficiaryAccountDao.mockRejectedValue(error);

        await expect(
        updateBeneficiaryAccountService(ids, payload)
        ).rejects.toThrow(error);

        expect(db.rollback).toHaveBeenCalledWith(mockConn);
    });

    it("should rollback when duplicate check DAO throws", async () => {
        const error = new Error("duplicate check failed");

        beneficiaryDao.checkBeneficiaryAccountExistsDao.mockRejectedValue(error);

        await expect(
        updateBeneficiaryAccountService(ids, payload)
        ).rejects.toThrow(error);

        expect(db.rollback).toHaveBeenCalledWith(mockConn);
    });

    it("should rollback when commit fails", async () => {
        const error = new Error("commit failed");

        beneficiaryDao.checkBeneficiaryAccountExistsDao.mockResolvedValue(false);

        beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([
        {
            id: 1,
            bank_name: "HDFC",
        },
        ]);

        beneficiaryDao.updateBeneficiaryAccountDao.mockResolvedValue({
        id: 1,
        });

        db.commit.mockRejectedValue(error);

        await expect(
        updateBeneficiaryAccountService(ids, payload)
        ).rejects.toThrow(error);

        expect(db.rollback).toHaveBeenCalledWith(mockConn);

        expect(mockConn.release).toHaveBeenCalled();
    });

    it("should rollback when beginTransaction fails", async () => {
        const error = new Error("begin failed");

        db.beginTransaction.mockRejectedValue(error);

        await expect(
        updateBeneficiaryAccountService(ids, payload)
        ).rejects.toThrow(error);

        expect(db.rollback).toHaveBeenCalledWith(mockConn);
    });

    it("should throw when getConnection fails", async () => {
        const error = new Error("connection failed");

        db.getConnection.mockRejectedValue(error);

        await expect(
        updateBeneficiaryAccountService(ids, payload)
        ).rejects.toThrow(error);

        expect(db.rollback).not.toHaveBeenCalled();
    });

    it("should release connection after successful update", async () => {
        beneficiaryDao.checkBeneficiaryAccountExistsDao.mockResolvedValue(false);

        beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([
        {
            id: 1,
            bank_name: "HDFC",
        },
        ]);

        beneficiaryDao.updateBeneficiaryAccountDao.mockResolvedValue({
        id: 1,
        });

        await updateBeneficiaryAccountService(ids, payload);

        expect(mockConn.release).toHaveBeenCalledTimes(1);
    });

    it("should release connection after rollback", async () => {
        beneficiaryDao.checkBeneficiaryAccountExistsDao.mockResolvedValue(true);

        await expect(
        updateBeneficiaryAccountService(ids, payload)
        ).rejects.toThrow();

        expect(mockConn.release).toHaveBeenCalledTimes(1);
    });
    });

    describe("Additional updateBeneficiaryAccountService test cases", () => {
        let mockConn;

        beforeEach(() => {
            jest.clearAllMocks();

            mockConn = {
            release: jest.fn(),
            };

            db.getConnection.mockResolvedValue(mockConn);
            db.beginTransaction.mockResolvedValue();
            db.commit.mockResolvedValue();
            db.rollback.mockResolvedValue();
        });

        const ids = {
            id: 1,
            company_id: 100,
        };

        it("should call update DAO with correct ids", async () => {
            beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([
            {
                id: 1,
                bank_name: "HDFC",
            },
            ]);

            beneficiaryDao.updateBeneficiaryAccountDao.mockResolvedValue({
            affectedRows: 1,
            });

            await updateBeneficiaryAccountService(ids, {
            bank_name: "ICICI",
            });

            expect(
            beneficiaryDao.updateBeneficiaryAccountDao
            ).toHaveBeenCalledWith(
            {
                id: 1,
                company_id: 100,
            },
            {
                bank_name: "ICICI",
            },
            mockConn
            );
        });

        it("should pass payload unchanged to update DAO", async () => {
            const payload = {
            bank_name: "Axis",
            ifsc: "UTIB0001234",
            updated_by: 5,
            };

            beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([
            {
                id: 1,
            },
            ]);

            beneficiaryDao.updateBeneficiaryAccountDao.mockResolvedValue({
            affectedRows: 1,
            });

            await updateBeneficiaryAccountService(ids, payload);

            expect(
            beneficiaryDao.updateBeneficiaryAccountDao.mock.calls[0][1]
            ).toEqual(payload);
        });

        it("should skip duplicate validation when acc_no is undefined", async () => {
            beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([
            {
                id: 1,
            },
            ]);

            beneficiaryDao.updateBeneficiaryAccountDao.mockResolvedValue({
            affectedRows: 1,
            });

            await updateBeneficiaryAccountService(ids, {
            bank_name: "SBI",
            });

            expect(
            beneficiaryDao.checkBeneficiaryAccountExistsDao
            ).not.toHaveBeenCalled();
        });

        it("should skip duplicate validation when acc_no is null", async () => {
            beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([
            {
                id: 1,
            },
            ]);

            beneficiaryDao.updateBeneficiaryAccountDao.mockResolvedValue({
            affectedRows: 1,
            });

            await updateBeneficiaryAccountService(ids, {
            acc_no: null,
            });

            expect(
            beneficiaryDao.checkBeneficiaryAccountExistsDao
            ).not.toHaveBeenCalled();
        });

        it("should skip duplicate validation when acc_no is empty string", async () => {
            beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([
            {
                id: 1,
            },
            ]);

            beneficiaryDao.updateBeneficiaryAccountDao.mockResolvedValue({
            affectedRows: 1,
            });

            await updateBeneficiaryAccountService(ids, {
            acc_no: "",
            });

            expect(
            beneficiaryDao.checkBeneficiaryAccountExistsDao
            ).not.toHaveBeenCalled();
        });

        it("should update only bank_name", async () => {
            beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([
            {
                id: 1,
            },
            ]);

            beneficiaryDao.updateBeneficiaryAccountDao.mockResolvedValue({
            affectedRows: 1,
            });

            await updateBeneficiaryAccountService(ids, {
            bank_name: "Kotak",
            });

            expect(
            beneficiaryDao.updateBeneficiaryAccountDao
            ).toHaveBeenCalledWith(
            ids,
            {
                bank_name: "Kotak",
            },
            mockConn
            );
        });

        it("should return update DAO response directly", async () => {
            const daoResponse = {
            affectedRows: 1,
            changedRows: 1,
            };

            beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([
            {
                id: 1,
            },
            ]);

            beneficiaryDao.updateBeneficiaryAccountDao.mockResolvedValue(
            daoResponse
            );

            const result = await updateBeneficiaryAccountService(
            ids,
            {
                bank_name: "ICICI",
            }
            );

            expect(result).toBe(daoResponse);
        });

        it("should call update DAO exactly once", async () => {
            beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([
            {
                id: 1,
            },
            ]);

            beneficiaryDao.updateBeneficiaryAccountDao.mockResolvedValue({
            affectedRows: 1,
            });

            await updateBeneficiaryAccountService(ids, {
            bank_name: "HDFC",
            });

            expect(
            beneficiaryDao.updateBeneficiaryAccountDao
            ).toHaveBeenCalledTimes(1);
        });
    });
    
    describe("deleteBeneficiaryAccountService", () => {
    const ids = {
        id: 1,
        company_id: 100,
    };

    beforeEach(() => {
        jest.clearAllMocks();

        mockConn = {
        release: jest.fn(),
        };

        db.getConnection.mockResolvedValue(mockConn);
        db.beginTransaction.mockResolvedValue();
        db.commit.mockResolvedValue();
        db.rollback.mockResolvedValue();
    });

    it("should delete beneficiary account successfully", async () => {
        const deleted = { id: 1, is_obsolete: true };

        beneficiaryDao.deleteBeneficiaryDao.mockResolvedValue(deleted);

        const result = await deleteBeneficiaryAccountService(ids);

        expect(result).toEqual(deleted);

        expect(db.beginTransaction).toHaveBeenCalledWith(mockConn);
        expect(db.commit).toHaveBeenCalledWith(mockConn);
        expect(db.rollback).not.toHaveBeenCalled();
    });

    it("should pass correct payload to deleteBeneficiaryDao", async () => {
        beneficiaryDao.deleteBeneficiaryDao.mockResolvedValue({ id: 1 });

        await deleteBeneficiaryAccountService(ids);

        expect(
        beneficiaryDao.deleteBeneficiaryDao
        ).toHaveBeenCalledWith(
        {
            id: ids.id,
            company_id: ids.company_id,
        },
        {
            is_obsolete: true,
        },
        mockConn
        );
    });

    it("should rollback when deleteBeneficiaryDao throws", async () => {
        const error = new Error("delete failed");

        beneficiaryDao.deleteBeneficiaryDao.mockRejectedValue(error);

        await expect(
        deleteBeneficiaryAccountService(ids)
        ).rejects.toThrow(error);

        expect(db.rollback).toHaveBeenCalledWith(mockConn);

        expect(logger.error).toHaveBeenCalledWith(
        "error in _deleteBeneficiaryAccountServiceInternal",
        error
        );

        expect(logger.error).toHaveBeenCalledWith(
        "error getting while deleting banks",
        error
        );
    });

    it("should rollback when commit fails", async () => {
        const error = new Error("commit failed");

        beneficiaryDao.deleteBeneficiaryDao.mockResolvedValue({
        id: 1,
        });

        db.commit.mockRejectedValue(error);

        await expect(
        deleteBeneficiaryAccountService(ids)
        ).rejects.toThrow(error);

        expect(db.rollback).toHaveBeenCalledWith(mockConn);

        expect(mockConn.release).toHaveBeenCalled();
    });

    it("should rollback when beginTransaction fails", async () => {
        const error = new Error("begin failed");

        db.beginTransaction.mockRejectedValue(error);

        await expect(
        deleteBeneficiaryAccountService(ids)
        ).rejects.toThrow(error);

        expect(db.rollback).toHaveBeenCalledWith(mockConn);
    });

    it("should throw when getConnection fails", async () => {
        const error = new Error("connection failed");

        db.getConnection.mockRejectedValue(error);

        await expect(
        deleteBeneficiaryAccountService(ids)
        ).rejects.toThrow(error);

        expect(db.rollback).not.toHaveBeenCalled();
    });

    it("should release connection after successful delete", async () => {
        beneficiaryDao.deleteBeneficiaryDao.mockResolvedValue({
        id: 1,
        });

        await deleteBeneficiaryAccountService(ids);

        expect(mockConn.release).toHaveBeenCalledTimes(1);
    });

    it("should release connection after rollback", async () => {
        beneficiaryDao.deleteBeneficiaryDao.mockRejectedValue(
        new Error("dao failed")
        );

        await expect(
        deleteBeneficiaryAccountService(ids)
        ).rejects.toThrow();

        expect(mockConn.release).toHaveBeenCalledTimes(1);
    });

    it("should call deleteBeneficiaryDao exactly once", async () => {
        beneficiaryDao.deleteBeneficiaryDao.mockResolvedValue({
        id: 1,
        });

        await deleteBeneficiaryAccountService(ids);

        expect(
        beneficiaryDao.deleteBeneficiaryDao
        ).toHaveBeenCalledTimes(1);
    });

    it("should not commit after rollback", async () => {
        beneficiaryDao.deleteBeneficiaryDao.mockRejectedValue(
        new Error("dao error")
        );

        await expect(
        deleteBeneficiaryAccountService(ids)
        ).rejects.toThrow();

        expect(db.rollback).toHaveBeenCalled();
        expect(db.commit).not.toHaveBeenCalled();
    });

    it("should use transaction connection for delete DAO", async () => {
        beneficiaryDao.deleteBeneficiaryDao.mockResolvedValue({
        id: 1,
        });

        await deleteBeneficiaryAccountService(ids);

        expect(
        beneficiaryDao.deleteBeneficiaryDao.mock.calls[0][2]
        ).toBe(mockConn);
    });

    it("should return delete DAO result", async () => {
        const deleted = {
        id: 55,
        is_obsolete: true,
        };

        beneficiaryDao.deleteBeneficiaryDao.mockResolvedValue(deleted);

        const result = await deleteBeneficiaryAccountService(ids);

        expect(result).toStrictEqual(deleted);
    });
    });

    describe("Additional deleteBeneficiaryAccountService test cases", () => {
        let mockConn;

        beforeEach(() => {
            jest.clearAllMocks();

            mockConn = {
            release: jest.fn(),
            };

            db.getConnection.mockResolvedValue(mockConn);
            db.beginTransaction.mockResolvedValue();
            db.commit.mockResolvedValue();
            db.rollback.mockResolvedValue();
        });

        const ids = {
            id: 10,
            company_id: 99,
        };

        it("should call delete DAO with correct ids and payload", async () => {
            beneficiaryDao.deleteBeneficiaryDao.mockResolvedValue({
            affectedRows: 1,
            });

            await deleteBeneficiaryAccountService(ids);

            expect(
            beneficiaryDao.deleteBeneficiaryDao
            ).toHaveBeenCalledWith(
            {
                id: 10,
                company_id: 99,
            },
            {
                is_obsolete: true,
            },
            mockConn
            );
        });

        it("should return delete DAO response without modification", async () => {
            const daoResponse = {
            affectedRows: 1,
            changedRows: 1,
            };

            beneficiaryDao.deleteBeneficiaryDao.mockResolvedValue(daoResponse);

            const result = await deleteBeneficiaryAccountService(ids);

            expect(result).toBe(daoResponse);
        });

        it("should commit transaction after successful delete", async () => {
            beneficiaryDao.deleteBeneficiaryDao.mockResolvedValue({
            affectedRows: 1,
            });

            await deleteBeneficiaryAccountService(ids);

            expect(db.beginTransaction).toHaveBeenCalledWith(mockConn);
            expect(db.commit).toHaveBeenCalledWith(mockConn);
            expect(db.rollback).not.toHaveBeenCalled();
        });

        it("should release connection after successful delete", async () => {
            beneficiaryDao.deleteBeneficiaryDao.mockResolvedValue({
            affectedRows: 1,
            });

            await deleteBeneficiaryAccountService(ids);

            expect(mockConn.release).toHaveBeenCalledTimes(1);
        });

        it("should rollback transaction when delete DAO throws error", async () => {
            const error = new Error("Delete failed");

            beneficiaryDao.deleteBeneficiaryDao.mockRejectedValue(error);

            await expect(
            deleteBeneficiaryAccountService(ids)
            ).rejects.toThrow("Delete failed");

            expect(db.rollback).toHaveBeenCalledWith(mockConn);
            expect(mockConn.release).toHaveBeenCalledTimes(1);
            expect(db.commit).not.toHaveBeenCalled();
        });
    });
    
    describe("beneficiaryAccountService - edge cases", () => {
    beforeEach(() => {
        jest.clearAllMocks();

        mockConn = {
        release: jest.fn(),
        };

        db.getConnection.mockResolvedValue(mockConn);
        db.beginTransaction.mockResolvedValue();
        db.commit.mockResolvedValue();
        db.rollback.mockResolvedValue();
    });

    /* ---------------------------------------------------------------------- */
    /* createBeneficiaryAccountService                                        */
    /* ---------------------------------------------------------------------- */

    it("should use created_by when user_id is missing", async () => {
        userDao.getUserByIdDao.mockResolvedValue([
        {
            id: 99,
            role: Role.MERCHANT,
        },
        ]);

        rolesDao.getRoleDao.mockResolvedValue([
        {
            id: 1,
            role: Role.MERCHANT,
        },
        ]);

        beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([]);

        beneficiaryDao.createBeneficiaryAccountDao.mockResolvedValue({
        id: 1,
        });

        await createBeneficiaryAccountService(
        {
            created_by: 99,
            updated_by: 99,
            acc_no: "1111",
            bank_name: "HDFC",
        },
        10
        );

        expect(userDao.getUserByIdDao).toHaveBeenCalledWith({
        id: 99,
        });
    });

    it("should not rollback after successful commit", async () => {
        userDao.getUserByIdDao.mockResolvedValue([
        { id: 1, role: Role.MERCHANT },
        ]);

        rolesDao.getRoleDao.mockResolvedValue([
        { id: 1, role: Role.MERCHANT },
        ]);

        beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([]);

        beneficiaryDao.createBeneficiaryAccountDao.mockResolvedValue({
        id: 10,
        });

        await createBeneficiaryAccountService(
        {
            user_id: 1,
            created_by: 1,
            updated_by: 1,
            acc_no: "123",
        },
        1
        );

        expect(db.commit).toHaveBeenCalled();
        expect(db.rollback).not.toHaveBeenCalled();
    });

    it("should pass transaction connection to create DAO", async () => {
        userDao.getUserByIdDao.mockResolvedValue([
        { id: 1, role: Role.VENDOR },
        ]);

        rolesDao.getRoleDao.mockResolvedValue([
        { id: 2, role: Role.VENDOR },
        ]);

        beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([]);

        beneficiaryDao.createBeneficiaryAccountDao.mockResolvedValue({
        id: 5,
        });

        await createBeneficiaryAccountService(
        {
            user_id: 1,
            created_by: 1,
            updated_by: 1,
            acc_no: "111",
        },
        1
        );

        expect(
        beneficiaryDao.createBeneficiaryAccountDao.mock.calls[0][1]
        ).toBe(mockConn);
    });

    /* ---------------------------------------------------------------------- */
    /* updateBeneficiaryAccountService                                        */
    /* ---------------------------------------------------------------------- */

    it("should pass transaction connection to update DAO", async () => {
        beneficiaryDao.checkBeneficiaryAccountExistsDao.mockResolvedValue(false);

        beneficiaryDao.getBeneficiaryAccountDao.mockResolvedValue([
        {
            id: 1,
            bank_name: "HDFC",
        },
        ]);

        beneficiaryDao.updateBeneficiaryAccountDao.mockResolvedValue({
        id: 1,
        });

        await updateBeneficiaryAccountService(
        {
            id: 1,
            company_id: 10,
        },
        {
            bank_name: "Axis",
        }
        );

        expect(
        beneficiaryDao.updateBeneficiaryAccountDao.mock.calls[0][2]
        ).toBe(mockConn);
    });

    it("should not commit when update fails", async () => {
        beneficiaryDao.checkBeneficiaryAccountExistsDao.mockRejectedValue(
        new Error("failure")
        );

        await expect(
        updateBeneficiaryAccountService(
            {
            id: 1,
            company_id: 1,
            },
            {
            acc_no: "123",
            }
        )
        ).rejects.toThrow();

        expect(db.commit).not.toHaveBeenCalled();
        expect(db.rollback).toHaveBeenCalled();
    });

    /* ---------------------------------------------------------------------- */
    /* deleteBeneficiaryAccountService                                        */
    /* ---------------------------------------------------------------------- */

    it("should pass transaction connection to delete DAO", async () => {
        beneficiaryDao.deleteBeneficiaryDao.mockResolvedValue({
        id: 1,
        });

        await deleteBeneficiaryAccountService({
        id: 1,
        company_id: 5,
        });

        expect(
        beneficiaryDao.deleteBeneficiaryDao.mock.calls[0][2]
        ).toBe(mockConn);
    });

    it("should not commit when delete fails", async () => {
        beneficiaryDao.deleteBeneficiaryDao.mockRejectedValue(
        new Error("delete failed")
        );

        await expect(
        deleteBeneficiaryAccountService({
            id: 1,
            company_id: 1,
        })
        ).rejects.toThrow();

        expect(db.commit).not.toHaveBeenCalled();
        expect(db.rollback).toHaveBeenCalled();
    });

    /* ---------------------------------------------------------------------- */
    /* runtime errors                                                          */
    /* ---------------------------------------------------------------------- */

    it("should propagate unexpected runtime error during create", async () => {
        const error = new Error("unexpected");

        userDao.getUserByIdDao.mockImplementation(() => {
        throw error;
        });

        await expect(
        createBeneficiaryAccountService(
            {
            user_id: 1,
            created_by: 1,
            acc_no: "111",
            },
            1
        )
        ).rejects.toThrow(error);

        expect(logger.error).toHaveBeenCalled();
    });

    it("should propagate unexpected runtime error during update", async () => {
        const error = new Error("runtime");

        beneficiaryDao.checkBeneficiaryAccountExistsDao.mockImplementation(() => {
        throw error;
        });

        await expect(
        updateBeneficiaryAccountService(
            {
            id: 1,
            company_id: 1,
            },
            {
            acc_no: "1",
            }
        )
        ).rejects.toThrow(error);

        expect(logger.error).toHaveBeenCalled();
    });

    it("should propagate unexpected runtime error during delete", async () => {
        const error = new Error("runtime");

        beneficiaryDao.deleteBeneficiaryDao.mockImplementation(() => {
        throw error;
        });

        await expect(
        deleteBeneficiaryAccountService({
            id: 1,
            company_id: 1,
        })
        ).rejects.toThrow(error);

        expect(logger.error).toHaveBeenCalled();
    });

    /* ---------------------------------------------------------------------- */
    /* transaction integrity                                                   */
    /* ---------------------------------------------------------------------- */

    it("should rollback only once when create fails", async () => {
        userDao.getUserByIdDao.mockResolvedValue([]);

        await expect(
        createBeneficiaryAccountService(
            {
            user_id: 1,
            created_by: 1,
            },
            1
        )
        ).rejects.toThrow();

        expect(db.rollback).toHaveBeenCalledTimes(1);
    });

    it("should release connection exactly once after create failure", async () => {
        userDao.getUserByIdDao.mockResolvedValue([]);

        await expect(
        createBeneficiaryAccountService(
            {
            user_id: 1,
            created_by: 1,
            },
            1
        )
        ).rejects.toThrow();

        expect(mockConn.release).toHaveBeenCalledTimes(1);
    });

    it("should release connection exactly once after update failure", async () => {
        beneficiaryDao.checkBeneficiaryAccountExistsDao.mockRejectedValue(
        new Error("error")
        );

        await expect(
        updateBeneficiaryAccountService(
            {
            id: 1,
            company_id: 1,
            },
            {
            acc_no: "123",
            }
        )
        ).rejects.toThrow();

        expect(mockConn.release).toHaveBeenCalledTimes(1);
    });

    it("should release connection exactly once after delete failure", async () => {
        beneficiaryDao.deleteBeneficiaryDao.mockRejectedValue(
        new Error("error")
        );

        await expect(
        deleteBeneficiaryAccountService({
            id: 1,
            company_id: 1,
        })
        ).rejects.toThrow();

        expect(mockConn.release).toHaveBeenCalledTimes(1);
    });

    it("should log create service errors", async () => {
        const error = new Error("create error");

        userDao.getUserByIdDao.mockRejectedValue(error);

        await expect(
        createBeneficiaryAccountService(
            {
            user_id: 1,
            created_by: 1,
            },
            1
        )
        ).rejects.toThrow(error);

        expect(logger.error).toHaveBeenCalledWith(
        "error getting while creating beneficiary account",
        error
        );
    });

    it("should log update service errors", async () => {
        const error = new Error("update error");

        beneficiaryDao.checkBeneficiaryAccountExistsDao.mockRejectedValue(error);

        await expect(
        updateBeneficiaryAccountService(
            {
            id: 1,
            company_id: 1,
            },
            {
            acc_no: "111",
            }
        )
        ).rejects.toThrow(error);

        expect(logger.error).toHaveBeenCalledWith(
        "error getting while updating banks",
        error.message
        );
    });

    it("should log delete service errors", async () => {
        const error = new Error("delete error");

        beneficiaryDao.deleteBeneficiaryDao.mockRejectedValue(error);

        await expect(
        deleteBeneficiaryAccountService({
            id: 1,
            company_id: 1,
        })
        ).rejects.toThrow(error);

        expect(logger.error).toHaveBeenCalledWith(
        "error getting while deleting banks",
        error
        );
    });
    });
});