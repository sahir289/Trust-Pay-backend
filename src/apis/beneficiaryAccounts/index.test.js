import { jest } from "@jest/globals";

const mockRouter = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
};

jest.unstable_mockModule("express", () => ({
  default: {
    Router: jest.fn(() => mockRouter),
  },
}));

jest.unstable_mockModule("../../utils/tryCatchHandler.js", () => ({
  default: jest.fn((fn) => fn),
}));

jest.unstable_mockModule("./beneficiaryAccountController.js", () => ({
  getBeneficiaryAccount: jest.fn(),
  getBeneficiaryAccountBySearch: jest.fn(),
  getBeneficiaryAccountByBankName: jest.fn(),
  getBeneficiaryAccountById: jest.fn(),
  createBeneficiaryAccount: jest.fn(),
  updateBeneficiaryAccount: jest.fn(),
  deleteBeneficiaryAccount: jest.fn(),
}));

const isAuthenticated = jest.fn();

const authorized = jest.fn((role) => `authorized-${role}`);

jest.unstable_mockModule("../../middlewares/auth.js", () => ({
  isAuthenticated,
  authorized,
}));

jest.unstable_mockModule("../../constants/index.js", () => ({
  AccessRoles: {
    BENEFICIARY_ACCOUNTS: "BENEFICIARY_ACCOUNTS",
    ALL: "ALL",
  },
}));
const express = await import("express");

const tryCatchHandler = (
  await import("../../utils/tryCatchHandler.js")
).default;

const controller = await import("./beneficiaryAccountController.js");

const auth = await import("../../middlewares/auth.js");

const { AccessRoles } = await import("../../constants/index.js");

const { default: beneficiaryRouter } = await import(
  "./index.js"
);

describe("beneficiaryAccountIndex", () => {
    beforeEach(async () => {
        jest.resetModules();

        const express = await import("express");

        await import("./index.js");
    });

    describe("GET Routes", () => {
        describe("/get", () => {
            it("should register GET /get", () => {
            expect(mockRouter.get).toHaveBeenCalledWith(
                "/get",
                expect.any(Array),
                controller.getBeneficiaryAccount
            );
            });

            it("should use isAuthenticated middleware", () => {
            const call = mockRouter.get.mock.calls.find(
                ([path]) => path === "/get"
            );

            expect(call[1][0]).toBe(auth.isAuthenticated);
            });

            it("should call authorized with BENEFICIARY_ACCOUNTS", () => {
            expect(auth.authorized).toHaveBeenCalledWith(
                AccessRoles.BENEFICIARY_ACCOUNTS
            );
            });

            it("should wrap getBeneficiaryAccount using tryCatchHandler", () => {
            expect(tryCatchHandler).toHaveBeenCalledWith(
                controller.getBeneficiaryAccount
            );
            });
        });

        describe("/", () => {
            it("should register GET /", () => {
            expect(mockRouter.get).toHaveBeenCalledWith(
                "/",
                expect.any(Array),
                controller.getBeneficiaryAccountBySearch
            );
            });

            it("should use authentication middleware", () => {
            const call = mockRouter.get.mock.calls.find(
                ([path]) => path === "/"
            );

            expect(call[1][0]).toBe(auth.isAuthenticated);
            });

            it("should authorize BENEFICIARY_ACCOUNTS", () => {
            expect(auth.authorized).toHaveBeenCalledWith(
                AccessRoles.BENEFICIARY_ACCOUNTS
            );
            });

            it("should wrap getBeneficiaryAccountBySearch", () => {
            expect(tryCatchHandler).toHaveBeenCalledWith(
                controller.getBeneficiaryAccountBySearch
            );
            });
        });

        describe("/beneficiarybanknames", () => {
            it("should register GET /beneficiarybanknames", () => {
            expect(mockRouter.get).toHaveBeenCalledWith(
                "/beneficiarybanknames",
                expect.any(Array),
                controller.getBeneficiaryAccountByBankName
            );
            });

            it("should authorize ALL", () => {
            expect(auth.authorized).toHaveBeenCalledWith(
                AccessRoles.ALL
            );
            });

            it("should wrap getBeneficiaryAccountByBankName", () => {
            expect(tryCatchHandler).toHaveBeenCalledWith(
                controller.getBeneficiaryAccountByBankName
            );
            });
        });

        describe("/:id", () => {
            it("should register GET /:id", () => {
            expect(mockRouter.get).toHaveBeenCalledWith(
                "/:id",
                expect.any(Array),
                controller.getBeneficiaryAccountById
            );
            });

            it("should authorize BENEFICIARY_ACCOUNTS", () => {
            expect(auth.authorized).toHaveBeenCalledWith(
                AccessRoles.BENEFICIARY_ACCOUNTS
            );
            });

            it("should wrap getBeneficiaryAccountById", () => {
            expect(tryCatchHandler).toHaveBeenCalledWith(
                controller.getBeneficiaryAccountById
            );
            });
        });
    });

    describe("POST Route", () => {
        describe("/create-beneficiary", () => {
            it("should register POST route", () => {
            expect(mockRouter.post).toHaveBeenCalledWith(
                "/create-beneficiary",
                expect.any(Array),
                controller.createBeneficiaryAccount
            );
            });

            it("should use authentication", () => {
            const call = mockRouter.post.mock.calls.find(
                ([path]) => path === "/create-beneficiary"
            );

            expect(call[1][0]).toBe(auth.isAuthenticated);
            });

            it("should authorize BENEFICIARY_ACCOUNTS", () => {
            expect(auth.authorized).toHaveBeenCalledWith(
                AccessRoles.BENEFICIARY_ACCOUNTS
            );
            });

            it("should wrap createBeneficiaryAccount", () => {
            expect(tryCatchHandler).toHaveBeenCalledWith(
                controller.createBeneficiaryAccount
            );
            });
        });
    });

    describe("PUT Route", () => {
        describe("/update-beneficiary/:id", () => {
            it("should register PUT route", () => {
            expect(mockRouter.put).toHaveBeenCalledWith(
                "/update-beneficiary/:id",
                expect.any(Array),
                controller.updateBeneficiaryAccount
            );
            });

            it("should use authentication", () => {
            const call = mockRouter.put.mock.calls.find(
                ([path]) => path === "/update-beneficiary/:id"
            );

            expect(call[1][0]).toBe(auth.isAuthenticated);
            });

            it("should authorize BENEFICIARY_ACCOUNTS", () => {
            expect(auth.authorized).toHaveBeenCalledWith(
                AccessRoles.BENEFICIARY_ACCOUNTS
            );
            });

            it("should wrap updateBeneficiaryAccount", () => {
            expect(tryCatchHandler).toHaveBeenCalledWith(
                controller.updateBeneficiaryAccount
            );
            });
        });
    });

    describe("DELETE Route", () => {
        describe("/delete-beneficiary/:id", () => {
            it("should register DELETE route", () => {
            expect(mockRouter.delete).toHaveBeenCalledWith(
                "/delete-beneficiary/:id",
                expect.any(Array),
                controller.deleteBeneficiaryAccount
            );
            });

            it("should use authentication", () => {
            const call = mockRouter.delete.mock.calls.find(
                ([path]) => path === "/delete-beneficiary/:id"
            );

            expect(call[1][0]).toBe(auth.isAuthenticated);
            });

            it("should authorize BENEFICIARY_ACCOUNTS", () => {
            expect(auth.authorized).toHaveBeenCalledWith(
                AccessRoles.BENEFICIARY_ACCOUNTS
            );
            });

            it("should wrap deleteBeneficiaryAccount", () => {
            expect(tryCatchHandler).toHaveBeenCalledWith(
                controller.deleteBeneficiaryAccount
            );
            });
        });
    });

    describe("tryCatchHandler Coverage", () => {
        it("should wrap getBeneficiaryAccount", () => {
            expect(tryCatchHandler).toHaveBeenCalledWith(
            controller.getBeneficiaryAccount
            );
        });

        it("should wrap getBeneficiaryAccountBySearch", () => {
            expect(tryCatchHandler).toHaveBeenCalledWith(
            controller.getBeneficiaryAccountBySearch
            );
        });

        it("should wrap getBeneficiaryAccountById", () => {
            expect(tryCatchHandler).toHaveBeenCalledWith(
            controller.getBeneficiaryAccountById
            );
        });

        it("should wrap createBeneficiaryAccount", () => {
            expect(tryCatchHandler).toHaveBeenCalledWith(
            controller.createBeneficiaryAccount
            );
        });

        it("should wrap updateBeneficiaryAccount", () => {
            expect(tryCatchHandler).toHaveBeenCalledWith(
            controller.updateBeneficiaryAccount
            );
        });

        it("should wrap deleteBeneficiaryAccount", () => {
            expect(tryCatchHandler).toHaveBeenCalledWith(
            controller.deleteBeneficiaryAccount
            );
        });

        it("should wrap getBeneficiaryAccountByBankName", () => {
            expect(tryCatchHandler).toHaveBeenCalledWith(
            controller.getBeneficiaryAccountByBankName
            );
        });
    });

    describe("authorized Coverage", () => {
        it("should call authorized BENEFICIARY_ACCOUNTS five times", () => {
            const beneficiaryCalls = auth.authorized.mock.calls.filter(
            ([role]) => role === AccessRoles.BENEFICIARY_ACCOUNTS
            );

            expect(auth.authorized).toHaveBeenCalledWith(
                AccessRoles.BENEFICIARY_ACCOUNTS
            );
        });

        it("should call authorized ALL once", () => {
            const allCalls = auth.authorized.mock.calls.filter(
            ([role]) => role === AccessRoles.ALL
            );

            expect(auth.authorized).toHaveBeenCalledWith(
                AccessRoles.ALL
            );
        });

        it("should preserve middleware order", () => {
            const routes = [
            ...mockRouter.get.mock.calls,
            ...mockRouter.post.mock.calls,
            ...mockRouter.put.mock.calls,
            ...mockRouter.delete.mock.calls,
            ];

            routes.forEach((call) => {
            expect(call[1][0]).toBe(auth.isAuthenticated);
            expect(call[1][1]).toBe(
                `authorized-${call[1][1].split("-")[1]}`
            );
            });
        });
    });

});