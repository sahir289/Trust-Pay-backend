import { jest } from "@jest/globals";

const getMock = jest.fn();
const postMock = jest.fn();
const putMock = jest.fn();
const patchMock = jest.fn();

const routerMock = {
  get: getMock,
  post: postMock,
  put: putMock,
  patch: patchMock,
};

jest.unstable_mockModule("express", () => ({
  default: {
    Router: jest.fn(() => routerMock),
  },
}));

jest.unstable_mockModule("../../utils/tryCatchHandler.js", () => ({
  default: jest.fn((fn) => fn),
}));

jest.unstable_mockModule("./userController.js", () => ({
  getUsers: jest.fn(),
  getUsersnames: jest.fn(),
  getUsersBySearch: jest.fn(),
  getUsersInfoBySearch: jest.fn(),
  getUsersByUserName: jest.fn(),
  getUserById: jest.fn(),
  createUser: jest.fn(),
  updateUser: jest.fn(),
  sendMail: jest.fn(),
  toggleUser2FA: jest.fn(),
  toggleUser2FAExemption: jest.fn(),
  resetUser2FA: jest.fn(),
}));

jest.unstable_mockModule("../../middlewares/auth.js", () => ({
  isAuthenticated: jest.fn(),
  authorized: jest.fn((role) => `authorized-${JSON.stringify(role)}`),
}));

jest.unstable_mockModule("../../constants/index.js", () => ({
  AccessRoles: {
    USER: "USER",
    USER_INFO: "USER_INFO",
    ALL: "ALL",
  },
  Role: {
    ADMIN: "ADMIN",
    SUPER_ADMIN: "SUPER_ADMIN",
  },
}));

const express = await import("express");
const tryCatchHandler = (
  await import("../../utils/tryCatchHandler.js")
).default;

const controller = await import("./userController.js");

const auth = await import("../../middlewares/auth.js");

const { AccessRoles, Role } = await import(
  "../../constants/index.js"
);


describe("user/index routes", () => {
    beforeEach(async () => {
        await import("./index.js");
    });

    describe("GET routes", () => {
        it("should register GET /get", () => {
        expect(getMock).toHaveBeenCalledWith(
            "/get",
            [
            auth.isAuthenticated,
            `authorized-"${AccessRoles.USER}"`,
            ],
            controller.getUsers
        );
        });

        it("should register GET /", () => {
        expect(getMock).toHaveBeenCalledWith(
            "/",
            [
            auth.isAuthenticated,
            `authorized-"${AccessRoles.USER}"`,
            ],
            controller.getUsersBySearch
        );
        });

        it("should register GET /usernames", () => {
        expect(getMock).toHaveBeenCalledWith(
            "/usernames",
            [
            auth.isAuthenticated,
            `authorized-"${AccessRoles.USER}"`,
            ],
            controller.getUsersnames
        );
        });

        it("should register GET /info", () => {
        expect(getMock).toHaveBeenCalledWith(
            "/info",
            [
            auth.isAuthenticated,
            `authorized-"${AccessRoles.USER_INFO}"`,
            ],
            controller.getUsersInfoBySearch
        );
        });

        it("should register GET /get-users-by-name", () => {
        expect(getMock).toHaveBeenCalledWith(
            "/get-users-by-name",
            [
            auth.isAuthenticated,
            `authorized-"${AccessRoles.USER}"`,
            ],
            controller.getUsersByUserName
        );
        });

        it("should wrap every GET controller using tryCatchHandler", () => {
        expect(tryCatchHandler).toHaveBeenCalledWith(
            controller.getUsers
        );

        expect(tryCatchHandler).toHaveBeenCalledWith(
            controller.getUsersBySearch
        );

        expect(tryCatchHandler).toHaveBeenCalledWith(
            controller.getUsersnames
        );

        expect(tryCatchHandler).toHaveBeenCalledWith(
            controller.getUsersInfoBySearch
        );

        expect(tryCatchHandler).toHaveBeenCalledWith(
            controller.getUsersByUserName
        );
        });
    });
    describe("POST/PUT routes", () => {
        it("should register GET /:id", () => {
            expect(getMock).toHaveBeenCalledWith(
            "/:id",
            [
                auth.isAuthenticated,
                `authorized-"${AccessRoles.ALL}"`,
            ],
            controller.getUserById
            );
        });

        it("should register POST /create-user", () => {
            expect(postMock).toHaveBeenCalledWith(
            "/create-user",
            [
                auth.isAuthenticated,
                `authorized-"${AccessRoles.USER}"`,
            ],
            controller.createUser
            );
        });

        it("should register PUT /update-user/:id", () => {
            expect(putMock).toHaveBeenCalledWith(
            "/update-user/:id",
            [
                auth.isAuthenticated,
                `authorized-"${AccessRoles.USER}"`,
            ],
            controller.updateUser
            );
        });

        it("should register POST /send-mail", () => {
            expect(postMock).toHaveBeenCalledWith(
            "/send-mail",
            [
                auth.isAuthenticated,
                `authorized-"${AccessRoles.USER}"`,
            ],
            controller.sendMail
            );
        });

        it("should wrap getUserById with tryCatchHandler", () => {
            expect(tryCatchHandler).toHaveBeenCalledWith(
            controller.getUserById
            );
        });

        it("should wrap createUser with tryCatchHandler", () => {
            expect(tryCatchHandler).toHaveBeenCalledWith(
            controller.createUser
            );
        });

        it("should wrap updateUser with tryCatchHandler", () => {
            expect(tryCatchHandler).toHaveBeenCalledWith(
            controller.updateUser
            );
        });

        it("should wrap sendMail with tryCatchHandler", () => {
            expect(tryCatchHandler).toHaveBeenCalledWith(
            controller.sendMail
            );
        });

        it("should register exactly two POST routes", () => {
            expect(postMock).toHaveBeenCalledTimes(3);
        });

        it("should register exactly one PUT route", () => {
            expect(putMock).toHaveBeenCalledTimes(1);
        });

        it("should register GET /:id after username route", () => {
            const calls = getMock.mock.calls.map((c) => c[0]);

            expect(calls).toContain("/:id");
            expect(calls.indexOf("/:id")).toBeGreaterThan(
            calls.indexOf("/get-users-by-name")
            );
        });
    });
    describe("PATCH routes", () => {
        it("should register PATCH /:id/2fa", () => {
            expect(patchMock).toHaveBeenCalledWith(
            "/:id/2fa",
            [
                auth.isAuthenticated,
                `authorized-${JSON.stringify([
                Role.ADMIN,
                Role.SUPER_ADMIN,
                ])}`,
            ],
            controller.toggleUser2FA
            );
        });

        it("should register POST /:id/2fa/reset", () => {
            expect(postMock).toHaveBeenCalledWith(
            "/:id/2fa/reset",
            [
                auth.isAuthenticated,
                `authorized-"${AccessRoles.ALL}"`,
            ],
            controller.resetUser2FA
            );
        });

        it("should register PATCH /:id/2fa-exemption", () => {
            expect(patchMock).toHaveBeenCalledWith(
            "/:id/2fa-exemption",
            [
                auth.isAuthenticated,
                `authorized-${JSON.stringify([
                Role.ADMIN,
                Role.SUPER_ADMIN,
                ])}`,
            ],
            controller.toggleUser2FAExemption
            );
        });

        it("should wrap toggleUser2FA with tryCatchHandler", () => {
            expect(tryCatchHandler).toHaveBeenCalledWith(
            controller.toggleUser2FA
            );
        });

        it("should wrap resetUser2FA with tryCatchHandler", () => {
            expect(tryCatchHandler).toHaveBeenCalledWith(
            controller.resetUser2FA
            );
        });

        it("should wrap toggleUser2FAExemption with tryCatchHandler", () => {
            expect(tryCatchHandler).toHaveBeenCalledWith(
            controller.toggleUser2FAExemption
            );
        });
    });

    describe("Router initialization", () => {
        it("should create express router", () => {
            expect(express.default.Router).toHaveBeenCalledTimes(1);
        });

        it("should export the router instance", async () => {
            const module = await import("./index.js");

            expect(module.default).toBe(routerMock);
        });
    });

    describe("Route registration summary", () => {
        it("should register six GET routes", () => {
            expect(getMock).toHaveBeenCalledTimes(6);
        });

        it("should register three POST routes", () => {
            expect(postMock).toHaveBeenCalledTimes(3);
        });

        it("should register one PUT route", () => {
            expect(putMock).toHaveBeenCalledTimes(1);
        });

        it("should register two PATCH routes", () => {
            expect(patchMock).toHaveBeenCalledTimes(2);
        });

        it("should call authorized for every protected route", () => {
            expect(auth.authorized).toHaveBeenCalledTimes(12);
        });

        it("should use USER access role where expected", () => {
            expect(auth.authorized).toHaveBeenCalledWith(
            AccessRoles.USER
            );
        });

        it("should use USER_INFO access role", () => {
            expect(auth.authorized).toHaveBeenCalledWith(
            AccessRoles.USER_INFO
            );
        });

        it("should use ALL access role", () => {
            expect(auth.authorized).toHaveBeenCalledWith(
            AccessRoles.ALL
            );
        });

        it("should authorize admin and super admin for 2FA routes", () => {
            expect(auth.authorized).toHaveBeenCalledWith([
            Role.ADMIN,
            Role.SUPER_ADMIN,
            ]);
        });

        it("should wrap every controller with tryCatchHandler", () => {
            expect(tryCatchHandler).toHaveBeenCalledTimes(12);
        });

        it("should register every controller exactly once", () => {
            expect(tryCatchHandler.mock.calls.map((c) => c[0])).toEqual([
            controller.getUsers,
            controller.getUsersBySearch,
            controller.getUsersnames,
            controller.getUsersInfoBySearch,
            controller.getUsersByUserName,
            controller.getUserById,
            controller.createUser,
            controller.updateUser,
            controller.sendMail,
            controller.toggleUser2FA,
            controller.resetUser2FA,
            controller.toggleUser2FAExemption,
            ]);
        });
    });

});