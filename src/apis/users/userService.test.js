/**
 * userService.test.js
 * Part 1 - Imports & Mock Setup
 */

import { jest } from "@jest/globals";

jest.unstable_mockModule("../../utils/db.js", () => ({
  getConnection: jest.fn(),
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
}));

jest.unstable_mockModule("../../utils/bcryptPassword.js", () => ({
  createHash: jest.fn(),
}));

jest.unstable_mockModule("../../utils/generatePassword.js", () => ({
  generatePassword: jest.fn(() => "Password@123"),
}));

jest.unstable_mockModule("../../utils/generateUUID.js", () => ({
  generateUUID: jest.fn(() => "uuid-123"),
}));

jest.unstable_mockModule("../../utils/sendMailer.js", () => ({
  sendCredentialsEmail: jest.fn(),
}));

jest.unstable_mockModule("../../utils/sockets.js", () => ({
  forceLogoutUser: jest.fn(),
}));

jest.unstable_mockModule("../../utils/logger.js", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
  },
}));

jest.unstable_mockModule("../../helpers/index.js", () => ({
  filterResponse: jest.fn((data) => data),
}));

jest.unstable_mockModule("../../constants/index.js", () => ({
  unblocked_countries: ["IN"],

  Role: {
    ADMIN: "ADMIN",
    MERCHANT: "MERCHANT",
    SUB_MERCHANT: "SUB_MERCHANT",
    VENDOR: "VENDOR",
    SUB_VENDOR: "SUB_VENDOR",
    VENDOR_ADMIN: "VENDOR_ADMIN",
    MERCHANT_OPERATIONS: "MERCHANT_OPERATIONS",
    VENDOR_OPERATIONS: "VENDOR_OPERATIONS",
  },

  columns: {
    USER: {},
  },

  merchantColumns: {
    USER: {},
  },

  vendorColumns: {
    USER: {},
  },
}));

/*                                User DAO                                     */

jest.unstable_mockModule("./userDao.js", () => ({
  createUserDao: jest.fn(),
  getUserByIdDao: jest.fn(),
  getUsersByUserNameDao: jest.fn(),
  getUsersDao: jest.fn(),
  updateUserDao: jest.fn(),
  getUsersBySearchDao: jest.fn(),
  getUsersInfoBySearchDao: jest.fn(),
  getAllUsersDao: jest.fn(),
  updateUserByIDDao: jest.fn(),
  updateUser2FAStatusDao: jest.fn(),
  updateUser2FAExemptionDao: jest.fn(),
  disableTwoFactorDao: jest.fn(),
  getAllUsersNameDao: jest.fn(),
}));

jest.unstable_mockModule("../designation/designationDao.js", () => ({
  getDesignationDao: jest.fn(),
}));


jest.unstable_mockModule("../roles/rolesDao.js", () => ({
  getRoleDao: jest.fn(),
}));

jest.unstable_mockModule("../merchants/merchantService.js", () => ({
  _createMerchantServiceInternal: jest.fn(),
}));

jest.unstable_mockModule("../merchants/merchantDao.js", () => ({
  getMerchantByUserIdDao: jest.fn(),
}));


jest.unstable_mockModule("../vendors/vendorService.js", () => ({
  _createVendorServiceInternal: jest.fn(),
}));

jest.unstable_mockModule("../vendors/vendorDao.js", () => ({
  getVendorByUserDao: jest.fn(),
}));


jest.unstable_mockModule("../company/companyDao.js", () => ({
  getCompanyByIDDao: jest.fn(),
}));


jest.unstable_mockModule("../bankAccounts/bankaccountDao.js", () => ({
  getBankaccountCheckDao: jest.fn(),
}));


jest.unstable_mockModule("../userHierarchy/userHierarchyDao.js", () => ({
  createUserHierarchyDao: jest.fn(),
  getUserHierarchysDao: jest.fn(),
  updateUserHierarchyDao: jest.fn(),
  getAllHierarchyUserIds: jest.fn(),
}));


jest.unstable_mockModule("../auth/authDao.js", () => ({
  getSessionByUserIdDao: jest.fn(),
}));


jest.unstable_mockModule("../../utils/appErrors.js", () => ({
  InternalServerError: class InternalServerError extends Error {},
  BadRequestError: class BadRequestError extends Error {},
}));


const db = await import("../../utils/db.js");
const bcrypt = await import("../../utils/bcryptPassword.js");
const passwordUtil = await import("../../utils/generatePassword.js");
const uuid = await import("../../utils/generateUUID.js");
const sendMailer = await import("../../utils/sendMailer.js");
const sockets = await import("../../utils/sockets.js");
const helper = await import("../../helpers/index.js");
const constants = await import("../../constants/index.js");

const userDao = await import("./userDao.js");
const designationDao = await import("../designation/designationDao.js");
const roleDao = await import("../roles/rolesDao.js");
const merchantService = await import("../merchants/merchantService.js");
const vendorService = await import("../vendors/vendorService.js");
const merchantDao = await import("../merchants/merchantDao.js");
const vendorDao = await import("../vendors/vendorDao.js");
const companyDao = await import("../company/companyDao.js");
const hierarchyDao = await import("../userHierarchy/userHierarchyDao.js");
const bankDao = await import("../bankAccounts/bankaccountDao.js");
const authDao = await import("../auth/authDao.js");

const { logger } = await import("../../utils/logger.js");

const {
  getUsersService,
  getUsersNameService,
  getUserByIdService,
  getUsersBySearchService,
  getUsersInfoBySearchService,
  getUsersByUserNameService,
  createUserService,
  userUpdateService,
  sendMailService,
  updateUser2FAService,
  toggleUser2FAExemptionService,
  resetUser2FAService,
  _createUserServiceInternal,
} = await import("./userService.js");

describe("User Service", () => {
    beforeEach(() => {
        jest.clearAllMocks();

        db.getConnection.mockResolvedValue({
        release: jest.fn(),
        });

        db.beginTransaction.mockResolvedValue();
        db.commit.mockResolvedValue();
        db.rollback.mockResolvedValue();
    });

    describe("getUsersService", () => {
        test("should return all users for ADMIN role", async () => {
            const users = [{ id: 1 }, { id: 2 }];

            userDao.getAllUsersDao.mockResolvedValue(users);

            const result = await getUsersService(
            {},
            constants.Role.ADMIN,
            1,
            10,
            "",
            100
            );

            expect(userDao.getAllUsersDao).toHaveBeenCalledWith(
            {},
            1,
            10,
            null,
            null,
            constants.columns.USER
            );

            expect(result).toEqual(users);
        });

        test("should use merchant columns", async () => {
            userDao.getAllUsersDao.mockResolvedValue([]);

            await getUsersService(
            {},
            constants.Role.MERCHANT,
            1,
            20,
            "",
            11
            );

            expect(userDao.getAllUsersDao).toHaveBeenCalledWith(
            {},
            1,
            20,
            null,
            null,
            constants.merchantColumns.USER
            );
        });

        test("should use vendor columns", async () => {
            userDao.getAllUsersDao.mockResolvedValue([]);

            await getUsersService(
            {},
            constants.Role.VENDOR,
            1,
            20,
            "",
            11
            );

            expect(userDao.getAllUsersDao).toHaveBeenCalled();
        });

        test("should default page and limit", async () => {
            userDao.getAllUsersDao.mockResolvedValue([]);

            await getUsersService(
            {},
            constants.Role.ADMIN,
            undefined,
            undefined,
            "",
            1
            );

            expect(userDao.getAllUsersDao).toHaveBeenCalledWith(
            {},
            1,
            10,
            null,
            null,
            constants.columns.USER
            );
        });

        test("should build vendor hierarchy filter", async () => {
            hierarchyDao.getUserHierarchysDao
            .mockResolvedValueOnce([
                {
                config: {
                    siblings: {
                    sub_merchants: [2],
                    },
                    child: {
                    operations: [3],
                    },
                },
                },
            ])
            .mockResolvedValueOnce([
                {
                config: {
                    child: {
                    operations: [4],
                    },
                },
                },
            ]);

            userDao.getAllUsersDao.mockResolvedValue([]);

            const ids = {};

            await getUsersService(
            ids,
            constants.Role.VENDOR,
            1,
            10,
            "",
            1
            );

            expect(ids.id).toEqual([1, 2, 4, 3]);
        });

        test("should build merchant operations hierarchy", async () => {
            hierarchyDao.getUserHierarchysDao
            .mockResolvedValueOnce([
                {
                config: {
                    parent: 100,
                },
                },
            ])
            .mockResolvedValueOnce([
                {
                config: {
                    siblings: {
                    sub_merchants: [200],
                    },
                    child: {
                    operations: [300],
                    },
                },
                },
            ])
            .mockResolvedValueOnce([
                {
                config: {
                    child: {
                    operations: [400],
                    },
                },
                },
            ]);

            userDao.getAllUsersDao.mockResolvedValue([]);

            const ids = {};

            await getUsersService(
            ids,
            constants.Role.MERCHANT,
            1,
            10,
            constants.Role.MERCHANT_OPERATIONS,
            5
            );

            expect(ids.id).toEqual([100, 200, 400, 300]);
        });

        test("should remove duplicate ids", async () => {
            hierarchyDao.getUserHierarchysDao.mockResolvedValue([
            {
                config: {
                siblings: {
                    sub_merchants: [2, 2],
                },
                child: {
                    operations: [3, 3],
                },
                },
            },
            ]);

            userDao.getAllUsersDao.mockResolvedValue([]);

            const ids = {};

            await getUsersService(
            ids,
            constants.Role.VENDOR,
            1,
            10,
            "",
            1
            );

            expect(ids.id).toEqual([1, 2, 3]);
        });

        test("should assign single id instead of array", async () => {
            hierarchyDao.getUserHierarchysDao.mockResolvedValue([
            {
                config: {
                siblings: {},
                child: {},
                },
            },
            ]);

            userDao.getAllUsersDao.mockResolvedValue([]);

            const ids = {};

            await getUsersService(
            ids,
            constants.Role.VENDOR,
            1,
            10,
            "",
            99
            );

            expect(ids.id).toBe(99);
        });

        test("should throw when DAO fails", async () => {
            userDao.getAllUsersDao.mockRejectedValue(
            new Error("DB Error")
            );

            await expect(
            getUsersService(
                {},
                constants.Role.ADMIN,
                1,
                10,
                "",
                1
            )
            ).rejects.toThrow("DB Error");

            expect(logger.error).toHaveBeenCalled();
        });

        test("should throw when hierarchy lookup fails", async () => {
            hierarchyDao.getUserHierarchysDao.mockRejectedValue(
            new Error("Hierarchy Error")
            );

            await expect(
            getUsersService(
                {},
                constants.Role.VENDOR,
                1,
                10,
                "",
                1
            )
            ).rejects.toThrow("Hierarchy Error");

            expect(logger.error).toHaveBeenCalled();
        });
    });
    
    describe("createUserService", () => {
        beforeEach(() => {
            jest.clearAllMocks();

            const conn = {
            release: jest.fn(),
            };

            db.getConnection.mockResolvedValue(conn);
            db.beginTransaction.mockResolvedValue();
            db.commit.mockResolvedValue();
            db.rollback.mockResolvedValue();
        });

        test("should create user successfully", async () => {
            const conn = await db.getConnection();

            userDao.getUsersByUserNameDao.mockResolvedValue(null);

            bcrypt.createHash.mockResolvedValue("hashed");

            userDao.createUserDao.mockResolvedValue({
            id: 1,
            email: "abc@test.com",
            user_name: "john",
            });

            designationDao.getDesignationDao
            .mockResolvedValueOnce([{ designation: "ADMIN" }])
            .mockResolvedValueOnce([{ designation: "ADMIN" }]);

            roleDao.getRoleDao.mockResolvedValue([
            {
                role: "ADMIN",
            },
            ]);

            companyDao.getCompanyByIDDao.mockResolvedValue([
            {
                config: {
                unique_admin_id: "ADMIN001",
                },
            },
            ]);

            sendMailer.sendCredentialsEmail.mockResolvedValue(true);

            const payload = {
            company_id: 1,
            role_id: 1,
            designation_id: 1,
            user_name: "john",
            first_name: "John",
            last_name: "Doe",
            email: "abc@test.com",
            contact_no: "9999999999",
            created_by: 1,
            updated_by: 1,
            is_enabled: true,
            unique_admin_id: "ADMIN001",
            };

            const result = await createUserService(payload);

            expect(result.id).toBe(1);
            expect(db.beginTransaction).toHaveBeenCalled();
            expect(db.commit).toHaveBeenCalled();
            expect(conn.release).toHaveBeenCalled();
        });

        test("should rollback when create fails", async () => {
            userDao.getUsersByUserNameDao.mockRejectedValue(
            new Error("DB Error")
            );

            await expect(
            createUserService({})
            ).rejects.toThrow("DB Error");

            expect(db.rollback).toHaveBeenCalled();
        });
    });

    describe("userUpdateService", () => {
        beforeEach(() => {
            jest.clearAllMocks();

            const conn = {
            release: jest.fn(),
            };

            db.getConnection.mockResolvedValue(conn);
            db.beginTransaction.mockResolvedValue();
            db.commit.mockResolvedValue();
            db.rollback.mockResolvedValue();
        });

        test("should update user", async () => {
            userDao.updateUserDao.mockResolvedValue({
            id: 10,
            });

            const result = await userUpdateService(
            {
                id: 10,
            },
            {
                first_name: "Updated",
            }
            );

            expect(result.id).toBe(10);
            expect(db.commit).toHaveBeenCalled();
        });

        test("should rollback on update error", async () => {
            userDao.updateUserDao.mockRejectedValue(
            new Error("update failed")
            );

            await expect(
            userUpdateService(
                { id: 1 },
                {}
            )
            ).rejects.toThrow("update failed");

            expect(db.rollback).toHaveBeenCalled();
        });
    });

    describe("updateUser2FAService", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should update 2FA status", async () => {
            userDao.updateUser2FAStatusDao.mockResolvedValue(true);

            const result = await updateUser2FAService(
            1,
            true
            );

            expect(result).toBe(true);

            expect(
            userDao.updateUser2FAStatusDao
            ).toHaveBeenCalledWith(1, true);
        });

        test("should throw dao error", async () => {
            userDao.updateUser2FAStatusDao.mockRejectedValue(
            new Error("DB Error")
            );

            await expect(
            updateUser2FAService(1, true)
            ).rejects.toThrow("DB Error");
        });
    });

    describe("resetUser2FAService", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should reset user 2FA", async () => {
            userDao.disableTwoFactorDao.mockResolvedValue(true);

            const result = await resetUser2FAService(
            5,
            1,
            "admin"
            );

            expect(result).toBe(true);

            expect(
            userDao.disableTwoFactorDao
            ).toHaveBeenCalledWith(5);
        });

        test("should throw dao error", async () => {
            userDao.disableTwoFactorDao.mockRejectedValue(
            new Error("reset failed")
            );

            await expect(
            resetUser2FAService(1, 2, "admin")
            ).rejects.toThrow("reset failed");
        });
    });

    describe("toggleUser2FAExemptionService", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should update exemption", async () => {
            userDao.updateUser2FAExemptionDao.mockResolvedValue(
            true
            );

            const result =
            await toggleUser2FAExemptionService(
                1,
                true
            );

            expect(result).toBe(true);

            expect(
            userDao.updateUser2FAExemptionDao
            ).toHaveBeenCalledWith(1, true);
        });

        test("should throw update error", async () => {
            userDao.updateUser2FAExemptionDao.mockRejectedValue(
            new Error("failed")
            );

            await expect(
            toggleUser2FAExemptionService(
                1,
                true
            )
            ).rejects.toThrow("failed");
        });
    });

    describe("sendMailService", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should send credentials mail for merchant", async () => {
            userDao.getUsersDao.mockResolvedValue([
            {
                role_id: 1,
                designation_id: 2,
                email: "abc@test.com",
                user_name: "john",
            },
            ]);

            roleDao.getRoleDao.mockResolvedValue([
            {
                role: "MERCHANT",
            },
            ]);

            designationDao.getDesignationDao.mockResolvedValue([
            {
                designation: "MERCHANT",
            },
            ]);

            merchantDao.getMerchantByUserIdDao.mockResolvedValue([
            {
                code: "M001",
                config: {
                keys: {
                    private: "private",
                    public: "public",
                },
                },
            },
            ]);

            sendMailer.sendCredentialsEmail.mockResolvedValue(true);

            const result = await sendMailService({
            user_id: 1,
            });

            expect(result).toBe(true);

            expect(
            sendMailer.sendCredentialsEmail
            ).toHaveBeenCalled();
        });

        test("should throw mail error", async () => {
            userDao.getUsersDao.mockRejectedValue(
            new Error("mail failed")
            );

            await expect(
            sendMailService({
                user_id: 1,
            })
            ).rejects.toThrow("mail failed");
        });
    });
    describe("updateUser2FAService", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should update 2FA status", async () => {
            userDao.updateUser2FAStatusDao.mockResolvedValue(true);

            const result = await updateUser2FAService(10, true);

            expect(userDao.updateUser2FAStatusDao).toHaveBeenCalledWith(10, true);
            expect(result).toBe(true);
        });

        test("should throw dao error", async () => {
            userDao.updateUser2FAStatusDao.mockRejectedValue(
            new Error("DB Error")
            );

            await expect(
            updateUser2FAService(10, true)
            ).rejects.toThrow("DB Error");
        });
    });

    describe("resetUser2FAService", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should reset user 2FA", async () => {
            userDao.disableTwoFactorDao.mockResolvedValue(true);

            const result = await resetUser2FAService(
            5,
            1,
            "admin"
            );

            expect(userDao.disableTwoFactorDao)
            .toHaveBeenCalledWith(5);

            expect(result).toBe(true);
        });

        test("should throw when dao fails", async () => {
            userDao.disableTwoFactorDao.mockRejectedValue(
            new Error("Reset failed")
            );

            await expect(
            resetUser2FAService(5, 1, "admin")
            ).rejects.toThrow("Reset failed");
        });
    });

    describe("toggleUser2FAExemptionService", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should enable exemption", async () => {
            userDao.updateUser2FAExemptionDao.mockResolvedValue(true);

            const result =
            await toggleUser2FAExemptionService(
                20,
                true
            );

            expect(
            userDao.updateUser2FAExemptionDao
            ).toHaveBeenCalledWith(20, true);

            expect(result).toBe(true);
        });

        test("should disable exemption", async () => {
            userDao.updateUser2FAExemptionDao.mockResolvedValue(true);

            await toggleUser2FAExemptionService(
            20,
            false
            );

            expect(
            userDao.updateUser2FAExemptionDao
            ).toHaveBeenCalledWith(20, false);
        });

        test("should throw when dao fails", async () => {
            userDao.updateUser2FAExemptionDao.mockRejectedValue(
            new Error("DAO Error")
            );

            await expect(
            toggleUser2FAExemptionService(
                20,
                true
            )
            ).rejects.toThrow("DAO Error");
        });
    });

    describe("sendMailService", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test("should send merchant credentials email", async () => {
            userDao.getUsersDao.mockResolvedValue([
            {
                id: 1,
                role_id: 2,
                designation_id: 3,
                email: "merchant@test.com",
                user_name: "merchant",
            },
            ]);

            roleDao.getRoleDao.mockResolvedValue([
            {
                role: "MERCHANT",
            },
            ]);

            designationDao.getDesignationDao.mockResolvedValue([
            {
                designation: "Merchant",
            },
            ]);

            merchantDao.getMerchantByUserIdDao.mockResolvedValue([
            {
                code: "M001",
                config: {
                keys: {
                    private: "private-key",
                    public: "public-key",
                },
                },
            },
            ]);

            sendMailer.sendCredentialsEmail.mockResolvedValue(true);

            const result = await sendMailService({
            user_id: 1,
            });

            expect(
            sendMailer.sendCredentialsEmail
            ).toHaveBeenCalled();

            expect(result).toBe(true);
        });

        test("should send non merchant credentials email", async () => {
            userDao.getUsersDao.mockResolvedValue([
            {
                id: 1,
                role_id: 2,
                designation_id: 3,
                email: "admin@test.com",
                user_name: "admin",
            },
            ]);

            roleDao.getRoleDao.mockResolvedValue([
            {
                role: "ADMIN",
            },
            ]);

            designationDao.getDesignationDao.mockResolvedValue([
            {
                designation: "Admin",
            },
            ]);

            sendMailer.sendCredentialsEmail.mockResolvedValue(true);

            const result = await sendMailService({
            user_id: 1,
            });

            expect(
            sendMailer.sendCredentialsEmail
            ).toHaveBeenCalled();

            expect(result).toBe(true);
        });

        test("should throw when send mail fails", async () => {
            userDao.getUsersDao.mockResolvedValue([
            {
                id: 1,
                role_id: 2,
                designation_id: 3,
                email: "admin@test.com",
                user_name: "admin",
            },
            ]);

            roleDao.getRoleDao.mockResolvedValue([
            {
                role: "ADMIN",
            },
            ]);

            designationDao.getDesignationDao.mockResolvedValue([
            {
                designation: "Admin",
            },
            ]);

            sendMailer.sendCredentialsEmail.mockRejectedValue(
            new Error("Mail Error")
            );

            await expect(
            sendMailService({
                user_id: 1,
            })
            ).rejects.toThrow("Mail Error");
        });
    });
});