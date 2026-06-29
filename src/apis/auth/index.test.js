import { jest } from "@jest/globals";

/* -------------------------------------------------------------------------- */
/*                               Mock Express                                 */
/* -------------------------------------------------------------------------- */

const postMock = jest.fn();
const getMock = jest.fn();
const useMock = jest.fn();

jest.unstable_mockModule("express", () => ({
  default: {
    Router: () => ({
      post: postMock,
      get: getMock,
      use: useMock,
    }),
  },
}));

/* -------------------------------------------------------------------------- */
/*                           Mock dependencies                                */
/* -------------------------------------------------------------------------- */

jest.unstable_mockModule("../../utils/tryCatchHandler.js", () => ({
  default: jest.fn((fn) => fn),
}));

jest.unstable_mockModule("./authController.js", () => ({
  loginController: jest.fn(),
  logoutController: jest.fn(),
  refreshTokenController: jest.fn(),
  verificationController: jest.fn(),
  changePasswordController: jest.fn(),
  verfyUserController: jest.fn(),
  verfyOtpController: jest.fn(),
  forgetPasswordController: jest.fn(),
  getUserRoleController: jest.fn(),
  verifyLoginOtpController: jest.fn(),
}));

jest.unstable_mockModule("../../middlewares/auth.js", () => ({
  isAuthenticated: jest.fn(),
}));

jest.unstable_mockModule("../../middlewares/loginLocationRestrict.js", () => ({
  geoLocationGuard: jest.fn(),
}));

jest.unstable_mockModule("../../middlewares/authRateLimiter.js", () => ({
  authApiRateLimiter: jest.fn(),
  loginBruteGuard: jest.fn(),
  verify2faBruteGuard: jest.fn(),
}));

/* -------------------------------------------------------------------------- */
/*                         Import AFTER mocks                                 */
/* -------------------------------------------------------------------------- */

await import("./index.js"); // your file (index.js)

/* -------------------------------------------------------------------------- */
/*                                 TESTS                                      */
/* -------------------------------------------------------------------------- */

describe("Auth Routes (index.js)", () => {

  test("should apply global authApiRateLimiter middleware", () => {
    expect(useMock).toHaveBeenCalledWith(expect.any(Function));
  });

  test("should register login route", () => {
    expect(postMock).toHaveBeenCalledWith(
      "/login",
      expect.any(Function),
      expect.any(Function),
      expect.any(Function)
    );
  });

  test("should register verify-2fa route", () => {
    expect(postMock).toHaveBeenCalledWith(
      "/verify-2fa",
      expect.any(Function),
      expect.any(Function)
    );
  });

  test("should register refresh-token route", () => {
    expect(postMock).toHaveBeenCalledWith(
      "/refresh-token",
      expect.any(Function)
    );
  });

  test("should register get-user-role route", () => {
    expect(getMock).toHaveBeenCalledWith(
      "/get-user-role",
      expect.any(Function)
    );
  });

  test("should register logout route with auth middleware", () => {
    expect(postMock).toHaveBeenCalledWith(
      "/logout",
      expect.any(Function),
      expect.any(Function)
    );
  });

  test("should register password change routes", () => {
    expect(postMock).toHaveBeenCalledWith(
      "/change-password",
      expect.any(Function),
      expect.any(Function)
    );

    expect(postMock).toHaveBeenCalledWith(
      "/password-verification",
      expect.any(Function),
      expect.any(Function)
    );
  });

  test("should register OTP and reset routes", () => {
    expect(postMock).toHaveBeenCalledWith(
      "/otp_verification",
      expect.any(Function),
      expect.any(Function)
    );

    expect(postMock).toHaveBeenCalledWith(
      "/reset_password",
      expect.any(Function),
      expect.any(Function)
    );

    expect(postMock).toHaveBeenCalledWith(
      "/user_verification",
      expect.any(Function),
      expect.any(Function)
    );
  });

});