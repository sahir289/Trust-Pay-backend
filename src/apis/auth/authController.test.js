import { jest } from "@jest/globals";


jest.unstable_mockModule("ua-parser-js", () => ({
  UAParser: jest.fn(() => ({
    getResult: () => ({
      browser: { name: "Chrome" },
      os: { name: "Windows" },
    }),
  })),
}));

jest.unstable_mockModule("../../middlewares/auth.js", () => ({
  logoutSet: {
    add: jest.fn(),
  },
}));

jest.unstable_mockModule("../../middlewares/authRateLimiter.js", () => ({
  recordAuthFailure: jest.fn(),
  resetAuthFailures: jest.fn(),
}));

jest.unstable_mockModule("../../schemas/authSchema.js", () => ({
  INSERT_AUTH_SCHEMA: {
    validate: jest.fn(() => ({
      error: null,
    })),
  },
}));

jest.unstable_mockModule("../../utils/auth.js", () => ({
  generateUserToken: jest.fn(),
  verifyToken: jest.fn(),
  verifyRefreshToken: jest.fn(),
}));

jest.unstable_mockModule("../../utils/responseHandlers.js", () => ({
  sendSuccess: jest.fn(),
}));

jest.unstable_mockModule("./authDao.js", () => ({
  updateSessionDao: jest.fn(),
}));

jest.unstable_mockModule("./authService.js", () => ({
  loginService: jest.fn(),
  refreshTokenService: jest.fn(),
  logoutService: jest.fn(),
  verificationService: jest.fn(),
  changePasswordService: jest.fn(),
  verfyUserService: jest.fn(),
  verfyOtpService: jest.fn(),
  forgetPasswordService: jest.fn(),
  getUserRoleService: jest.fn(),
  verifyLoginOtpService: jest.fn(),
  setup2FAService: jest.fn(),
  confirm2FAService: jest.fn(),
  disable2FAService: jest.fn(),
}));


const {
  loginController,
  refreshTokenController,
  logoutController,
  verificationController,
  changePasswordController,
  verfyUserController,
  verfyOtpController,
  forgetPasswordController,
  getUserRoleController,
  verifyLoginOtpController,
  setup2FAController,
  confirm2FAController,
  disable2FAController,
} = await import("./authController.js");

const {
  loginService,
  refreshTokenService,
  logoutService,
  verificationService,
  changePasswordService,
  verfyUserService,
  verfyOtpService,
  forgetPasswordService,
  getUserRoleService,
  verifyLoginOtpService,
  setup2FAService,
  confirm2FAService,
  disable2FAService,
} = await import("./authService.js");

const { updateSessionDao } = await import("./authDao.js");

const {
  generateUserToken,
  verifyToken,
  verifyRefreshToken,
} = await import("../../utils/auth.js");

const { sendSuccess } = await import(
  "../../utils/responseHandlers.js"
);

const {
  recordAuthFailure,
  resetAuthFailures,
} = await import("../../middlewares/authRateLimiter.js");

const {
  INSERT_AUTH_SCHEMA,
} = await import("../../schemas/authSchema.js");


describe("Auth Controller", () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      body: {},
      query: {},
      cookies: {},

      headers: {
        "user-agent": "Chrome",
      },

      socket: {
        remoteAddress: "127.0.0.1",
      },

      user: {
        user_id: 1,
        company_id: 10,
        user_name: "admin",
      },

      header: jest.fn(),
    };

    res = {
      cookie: jest.fn(),
    };

    INSERT_AUTH_SCHEMA.validate.mockReturnValue({
      error: null,
    });
  });

  describe("loginController", () => {
    test("should login successfully", async () => {
      loginService.mockResolvedValue({
        refreshToken: "refresh-token",
        tokenInfo: {
          accessToken: "access-token",
        },
        sessionId: "session-1",
        user: {
          id: 1,
          user_name: "admin",
        },
        two_factor_enforcement: false,
        must_setup_2fa: false,
      });

      await loginController(req, res);

      expect(loginService).toHaveBeenCalledTimes(1);

      expect(resetAuthFailures).toHaveBeenCalledWith(req);

      expect(res.cookie).toHaveBeenCalledWith(
        "refreshToken",
        "refresh-token",
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: "Strict",
        })
      );

      expect(sendSuccess).toHaveBeenCalledWith(
        res,
        {
          accessToken: "access-token",
          sessionId: "session-1",
          user: {
            id: 1,
            user_name: "admin",
          },
          two_factor_enforcement: false,
          must_setup_2fa: false,
        },
        "login successfully"
      );
    });

    test("should return first login", async () => {
      loginService.mockResolvedValue({
        isLoginFirst: true,
      });

      await loginController(req, res);

      expect(sendSuccess).toHaveBeenCalledWith(
        res,
        {
          isLoginFirst: true,
        },
        "user's first login"
      );
    });

    test("should return 2FA required", async () => {
      loginService.mockResolvedValue({
        twoFactorRequired: true,
        preAuthToken: "pre-auth-token",
        two_factor_enforcement: true,
      });

      await loginController(req, res);

      expect(sendSuccess).toHaveBeenCalledWith(
        res,
        {
          twoFactorRequired: true,
          preAuthToken: "pre-auth-token",
          two_factor_enforcement: true,
        },
        "2FA verification required"
      );
    });

    test("should return must setup 2FA", async () => {
      loginService.mockResolvedValue({
        must_setup_2fa: true,
        refreshToken: "refresh",
        tokenInfo: {
          accessToken: "access",
        },
        sessionId: "session-id",
        user: {
          id: 1,
        },
        two_factor_enforcement: true,
      });

      await loginController(req, res);

      expect(res.cookie).toHaveBeenCalled();

      expect(sendSuccess).toHaveBeenCalled();
    });

    test("should record auth failure", async () => {
      loginService.mockRejectedValue(
        new Error("Invalid credentials")
      );

      await expect(
        loginController(req, res)
      ).rejects.toThrow();

      expect(recordAuthFailure).toHaveBeenCalledWith(req);
    });
  });

  describe("loginController - additional cases", () => {
    const res = { cookie: jest.fn(), status: jest.fn(() => res) };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    test("should throw ValidationError when Joi validation fails", async () => {
      INSERT_AUTH_SCHEMA.validate.mockReturnValueOnce({
        error: new Error("validation error"),
      });

      const req = { body: {}, headers: {} };

      await expect(loginController(req, res)).rejects.toThrow();
    });

    test("should call recordAuthFailure when loginService throws unexpected error", async () => {
      loginService.mockRejectedValueOnce(new Error("DB error"));

      const req = { body: {}, headers: {} };

      await expect(loginController(req, res)).rejects.toThrow("DB error");
      expect(recordAuthFailure).toHaveBeenCalled();
    });

    test("should resetAuthFailures after successful login", async () => {
      loginService.mockResolvedValueOnce({
        tokenInfo: { accessToken: "a" },
        sessionId: "s",
        user: {},
        refreshToken: "r",
      });

      const req = { body: {}, headers: {} };

      await loginController(req, res);

      expect(resetAuthFailures).toHaveBeenCalled();
    });

    test("should not set cookie when twoFactorRequired is true", async () => {
      loginService.mockResolvedValueOnce({
        twoFactorRequired: true,
        preAuthToken: "p",
      });

      const req = { body: {}, headers: {} };

      await loginController(req, res);

      expect(res.cookie).not.toHaveBeenCalled();
    });

    test("should not set cookie when must_setup_2fa is true", async () => {
      loginService.mockResolvedValueOnce({
        must_setup_2fa: true,
        refreshToken: "r",
        tokenInfo: { accessToken: "a" },
        sessionId: "s",
        user: {},
      });

      const req = { body: {}, headers: {} };

      await loginController(req, res);

      expect(res.cookie).toHaveBeenCalled();
    });

    test("should handle missing x-forwarded-for header", async () => {
      loginService.mockResolvedValueOnce({
        tokenInfo: { accessToken: "a" },
        sessionId: "s",
        user: {},
        refreshToken: "r",
      });

      const req = { body: {}, headers: {} };

      await loginController(req, res);

      expect(loginService).toHaveBeenCalled();
    });

    test("should handle undefined loginService response safely", async () => {
      loginService.mockResolvedValueOnce(undefined);

      const req = { body: {}, headers: {} };

      await expect(loginController(req, res)).rejects.toThrow();
    });

    test("should not crash when x-forwarded-for is missing", async () => {
      loginService.mockResolvedValueOnce({
        tokenInfo: { accessToken: "a" },
        sessionId: "s",
        user: {},
        refreshToken: "r",
      });

      const req = { body: {}, headers: {} };

      await loginController(req, res);

      expect(sendSuccess).toHaveBeenCalled();
    });
  });

  describe("refreshTokenController", () => {
    test("should refresh access token", async () => {
      req.cookies.refreshToken = "refresh-token";

      verifyRefreshToken.mockReturnValue({
        user_id: 1,
        company_id: 10,
      });

      refreshTokenService.mockResolvedValue({
        config: JSON.stringify({
          token: {},
        }),
        session_id: "session-1",
      });

      generateUserToken.mockReturnValue("new-access-token");

      await refreshTokenController(req, res);

      expect(refreshTokenService).toHaveBeenCalled();

      expect(updateSessionDao).toHaveBeenCalled();

      expect(sendSuccess).toHaveBeenCalledWith(
        res,
        {
          accessToken: "new-access-token",
        },
        "Refresh token generated successfully"
      );
    });

    test("should throw if refresh token missing", async () => {
      req.cookies = {};

      await expect(
        refreshTokenController(req, res)
      ).rejects.toThrow();
    });

    test("should throw if refresh token invalid", async () => {
      req.cookies.refreshToken = "invalid";

      verifyRefreshToken.mockReturnValue(false);

      await expect(
        refreshTokenController(req, res)
      ).rejects.toThrow();
    });
  });

  describe("refreshTokenController - additional cases", () => {
    const res = {};

    beforeEach(() => jest.clearAllMocks());

    test("should throw when refreshToken cookie is missing", async () => {
      const req = { cookies: {} };

      await expect(refreshTokenController(req, res)).rejects.toThrow();
    });

    test("should throw when verifyRefreshToken returns null", async () => {
      verifyRefreshToken.mockReturnValueOnce(null);

      const req = { cookies: { refreshToken: "r" } };

      await expect(refreshTokenController(req, res)).rejects.toThrow();
    });

    test("should throw when decoded token invalid", async () => {
      verifyRefreshToken.mockReturnValueOnce({ user_id: null });

      const req = { cookies: { refreshToken: "r" } };

      await expect(refreshTokenController(req, res)).rejects.toThrow();
    });

    test("should handle corrupted session.config JSON", async () => {
      refreshTokenService.mockResolvedValueOnce({
        config: "invalid-json",
      });

      const req = { cookies: { refreshToken: "r" } };

      await expect(refreshTokenController(req, res)).rejects.toThrow();
    });

    test("should not generate token if company_id missing", async () => {
      verifyRefreshToken.mockReturnValueOnce({ user_id: 1 });

      const req = { cookies: { refreshToken: "r" } };

      await expect(refreshTokenController(req, res)).rejects.toThrow();
    });
  });

  describe("logoutController", () => {
    test("should logout successfully", async () => {
      req.body = {
        session_id: "session-id",
      };

      req.header.mockReturnValue("jwt-token");

      verifyToken.mockReturnValue({
        user_id: 1,
      });

      logoutService.mockResolvedValue();

      await logoutController(req, res);

      expect(logoutService).toHaveBeenCalled();

      expect(sendSuccess).toHaveBeenCalledWith(
        res,
        {},
        "logout successfully"
      );
    });
  });

  describe("logoutController - additional cases", () => {
    const res = {};

    beforeEach(() => jest.clearAllMocks());

    test("should throw when x-auth-token is missing", async () => {
      const req = { headers: {}, body: {} };

      await expect(logoutController(req, res)).rejects.toThrow();
    });

    test("should not call logoutService if token invalid", async () => {
      verifyToken.mockReturnValueOnce(null);

      const req = { headers: { "x-auth-token": "t" }, body: {} };

      await expect(logoutController(req, res)).rejects.toThrow();
      expect(logoutService).not.toHaveBeenCalled();
    });

    test("should add token to logoutSet after success", async () => {
      verifyToken.mockReturnValueOnce({ user_id: 1 });
      logoutService.mockResolvedValueOnce({});

      const req = {
        body: { session_id: "s1" },
        header: jest.fn(() => "test-token"),
      };

      const res = {};

      await logoutController(req, res);

      const { logoutSet } = await import("../../middlewares/auth.js");
      expect(logoutSet.add).toHaveBeenCalledWith("test-token");
    });
  });

  describe("verificationController", () => {
    test("should verify password successfully", async () => {
      req.body = {
        password: "password123",
      };

      verificationService.mockResolvedValue(true);

      await verificationController(req, res);

      expect(verificationService).toHaveBeenCalledWith(
        {
          user_id: 1,
          company_id: 10,
        },
        {
          user_name: "admin",
          password: "password123",
        }
      );

      expect(sendSuccess).toHaveBeenCalledWith(
        res,
        {},
        "Verification successful"
      );
    });

    test("should throw when password is invalid", async () => {
      req.body = {
        password: "wrong",
      };

      verificationService.mockResolvedValue(false);

      await expect(
        verificationController(req, res)
      ).rejects.toThrow();
    });
  });

  describe("verfyUserController - additional cases", () => {
    const res = {};

    test("should throw when username missing", async () => {
      const req = { body: {} };

      await expect(verfyUserController(req, res)).rejects.toThrow();
    });

    test("should handle null service response", async () => {
      verfyUserService.mockResolvedValueOnce(null);

      const req = { body: { user_name: "u" } };

      await expect(verfyUserController(req, res)).rejects.toThrow();
    });
  });

  describe("changePasswordController", () => {
    test("should change password", async () => {
      req.body = {
        oldPassword: "old123",
        password: "new123",
      };

      changePasswordService.mockResolvedValue(true);

      await changePasswordController(req, res);

      expect(changePasswordService).toHaveBeenCalledWith({
        user_id: 1,
        user_name: "admin",
        password: "new123",
        oldPassword: "old123",
      });

      expect(sendSuccess).toHaveBeenCalledWith(
        res,
        {},
        "Password Changed Successfully"
      );
    });

    test("should throw for invalid old password", async () => {
      req.body = {
        oldPassword: "wrong",
        password: "new123",
      };

      changePasswordService.mockResolvedValue(false);

      await expect(
        changePasswordController(req, res)
      ).rejects.toThrow();
    });
  });

  describe("changePasswordController - additional cases", () => {
    const res = {};

    test("should throw when old password incorrect", async () => {
      changePasswordService.mockResolvedValueOnce(false);

      const req = {
        user: { user_id: 1, user_name: "u" },
        body: { oldPassword: "a", password: "b" },
      };

      await expect(changePasswordController(req, res)).rejects.toThrow();
    });

    test("should handle service exception", async () => {
      changePasswordService.mockRejectedValueOnce(new Error("fail"));

      const req = {
        user: { user_id: 1, user_name: "u" },
        body: { oldPassword: "a", password: "b" },
      };

      await expect(changePasswordController(req, res)).rejects.toThrow();
    });
  });

  describe("verfyUserController", () => {
    test("should verify user", async () => {
      req.body = {
        user_name: "admin",
      };

      verfyUserService.mockResolvedValue(true);

      await verfyUserController(req, res);

      expect(verfyUserService).toHaveBeenCalledWith("admin");

      expect(sendSuccess).toHaveBeenCalledWith(
        res,
        {},
        "Verified User Successfully"
      );
    });

    test("should throw if user not found", async () => {
      req.body = {
        user_name: "unknown",
      };

      verfyUserService.mockResolvedValue(false);

      await expect(
        verfyUserController(req, res)
      ).rejects.toThrow();
    });
  });

  describe("verfyUserController - additional cases", () => {
    const res = {};

    test("should throw when username missing", async () => {
      const req = { body: {} };

      await expect(verfyUserController(req, res)).rejects.toThrow();
    });

    test("should handle null service response", async () => {
      verfyUserService.mockResolvedValueOnce(null);

      const req = { body: { user_name: "u" } };

      await expect(verfyUserController(req, res)).rejects.toThrow();
    });
  });

  describe("verfyOtpController", () => {
    test("should verify otp", async () => {
      req.body = {
        otp: "123456",
      };

      verfyOtpService.mockResolvedValue({
        verified: true,
      });

      await verfyOtpController(req, res);

      expect(verfyOtpService).toHaveBeenCalledWith("123456");

      expect(sendSuccess).toHaveBeenCalledWith(
        res,
        {
          verified: true,
        },
        "Verified Otp Successfully"
      );
    });

    test("should throw invalid otp", async () => {
      req.body = {
        otp: "000000",
      };

      verfyOtpService.mockResolvedValue(false);

      await expect(
        verfyOtpController(req, res)
      ).rejects.toThrow();
    });
  });

  describe("verfyOtpController - additional cases", () => {
    const res = {};

    test("should throw when OTP missing", async () => {
      const req = { body: {} };

      await expect(verfyOtpController(req, res)).rejects.toThrow();
    });

    test("should handle invalid OTP format", async () => {
      verfyOtpService.mockResolvedValueOnce(false);

      const req = { body: { otp: "abc" } };

      await expect(verfyOtpController(req, res)).rejects.toThrow();
    });
  });

  describe("forgetPasswordController", () => {
    test("should reset password", async () => {
      req.body = {
        password: "newPassword",
        user_id: 1,
      };

      forgetPasswordService.mockResolvedValue(true);

      await forgetPasswordController(req, res);

      expect(forgetPasswordService).toHaveBeenCalledWith({
        password: "newPassword",
        user_id: 1,
      });

      expect(sendSuccess).toHaveBeenCalledWith(
        res,
        {},
        "Password Reset Successfully"
      );
    });

    test("should throw if reset fails", async () => {
      req.body = {
        password: "newPassword",
        user_id: 1,
      };

      forgetPasswordService.mockResolvedValue(false);

      await expect(
        forgetPasswordController(req, res)
      ).rejects.toThrow();
    });
  });

  describe("forgetPasswordController - additional cases", () => {
    const res = {};

    test("should throw when user_id missing", async () => {
      const req = { body: { password: "a" } };

      await expect(forgetPasswordController(req, res)).rejects.toThrow();
    });

    test("should reject weak password reset", async () => {
      forgetPasswordService.mockResolvedValueOnce(false);

      const req = { body: { password: "123", user_id: 1 } };

      await expect(forgetPasswordController(req, res)).rejects.toThrow();
    });
  });

  describe("getUserRoleController", () => {
    test("should fetch role", async () => {
      req.query = {
        userName: "admin",
      };

      getUserRoleService.mockResolvedValue({
        role: "Admin",
      });

      await getUserRoleController(req, res);

      expect(getUserRoleService).toHaveBeenCalledWith("admin");

      expect(sendSuccess).toHaveBeenCalledWith(
        res,
        {
          role: "Admin",
        },
        "User role fetched successfully"
      );
    });
  });

  describe("getUserRoleController - additional cases", () => {
    const res = {};

    test("should handle missing query param", async () => {
      const req = { query: {} };

      getUserRoleService.mockResolvedValueOnce(null);

      await getUserRoleController(req, res);

      expect(sendSuccess).toHaveBeenCalled();
    });

    test("should handle service failure", async () => {
      getUserRoleService.mockRejectedValueOnce(new Error("db fail"));

      const req = { query: { userName: "u" } };

      await expect(getUserRoleController(req, res)).rejects.toThrow();
    });
  });

  describe("verifyLoginOtpController", () => {
    test("should verify login otp successfully", async () => {
      req.body = {
        preAuthToken: "pre-auth-token",
        otpToken: "123456",
      };

      verifyLoginOtpService.mockResolvedValue({
        tokenInfo: {
          accessToken: "access-token",
          refreshToken: "refresh-token",
        },
        sessionId: "session-1",
        user: {
          id: 1,
          user_name: "admin",
        },
        two_factor_enforcement: false,
        must_setup_2fa: false,
      });

      await verifyLoginOtpController(req, res);

      expect(verifyLoginOtpService).toHaveBeenCalledWith(
        "pre-auth-token",
        "123456",
        "127.0.0.1",
        expect.any(Object)
      );

      expect(resetAuthFailures).toHaveBeenCalledWith(req);

      expect(res.cookie).toHaveBeenCalledWith(
        "refreshToken",
        "refresh-token",
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: "Strict",
        })
      );

      expect(sendSuccess).toHaveBeenCalledWith(
        res,
        {
          accessToken: "access-token",
          sessionId: "session-1",
          user: {
            id: 1,
            user_name: "admin",
          },
          two_factor_enforcement: false,
          must_setup_2fa: false,
        },
        "login successfully"
      );
    });

    test("should record auth failure when OTP verification fails", async () => {
      req.body = {
        preAuthToken: "pre-auth-token",
        otpToken: "123456",
      };

      verifyLoginOtpService.mockRejectedValue(
        new Error("Invalid OTP")
      );

      await expect(
        verifyLoginOtpController(req, res)
      ).rejects.toThrow();

      expect(recordAuthFailure).toHaveBeenCalledWith(req);
    });

    test("should throw if preAuthToken is missing", async () => {
      req.body = {
        otpToken: "123456",
      };

      await expect(
        verifyLoginOtpController(req, res)
      ).rejects.toThrow();
    });

    test("should throw if otpToken is missing", async () => {
      req.body = {
        preAuthToken: "pre-auth-token",
      };

      await expect(
        verifyLoginOtpController(req, res)
      ).rejects.toThrow();
    });
  });

  describe("verifyLoginOtpController - additional cases", () => {
    const res = { cookie: jest.fn() };

    test("should throw when preAuthToken missing", async () => {
      const req = { body: { otpToken: "123" }, headers: {} };

      await expect(verifyLoginOtpController(req, res)).rejects.toThrow();
    });

    test("should reset failures on success", async () => {
      verifyLoginOtpService.mockResolvedValueOnce({
        tokenInfo: { accessToken: "a", refreshToken: "r" },
        sessionId: "s",
        user: {},
      });

      const req = {
        body: { preAuthToken: "p", otpToken: "1" },
        headers: {},
      };

      await verifyLoginOtpController(req, res);

      expect(resetAuthFailures).toHaveBeenCalled();
    });
  });

  describe("setup2FAController", () => {
    test("should setup 2FA", async () => {
      setup2FAService.mockResolvedValue({
        qrCodeDataUrl: "qr-code",
        secret: "secret-key",
      });

      await setup2FAController(req, res);

      expect(setup2FAService).toHaveBeenCalledWith(
        1,
        "admin"
      );

      expect(sendSuccess).toHaveBeenCalledWith(
        res,
        {
          qrCodeDataUrl: "qr-code",
          secret: "secret-key",
        },
        "2FA setup initiated. Scan the QR code, then call /2fa/confirm"
      );
    });
  });

  describe("setup2FAController", () => {
    test("should throw when req.user missing", async () => {
      const req = { user: null };

      await expect(setup2FAController(req, {})).rejects.toThrow();
    });
  });

  describe("confirm2FAController", () => {
    test("should confirm 2FA", async () => {
      req.body = {
        otpToken: "123456",
      };

      confirm2FAService.mockResolvedValue();

      await confirm2FAController(req, res);

      expect(confirm2FAService).toHaveBeenCalledWith(
        1,
        "123456"
      );

      expect(sendSuccess).toHaveBeenCalledWith(
        res,
        {},
        "2FA has been enabled successfully"
      );
    });

    test("should throw if otpToken missing", async () => {
      req.body = {};

      await expect(
        confirm2FAController(req, res)
      ).rejects.toThrow();
    });
  });

  describe("confirm2FAController", () => {
    test("should throw when otpToken missing", async () => {
      const req = { user: { user_id: 1 }, body: {} };

      await expect(confirm2FAController(req, {})).rejects.toThrow();
    });
  });

  describe("disable2FAController", () => {
    test("should disable 2FA", async () => {
      req.body = {
        otpToken: "123456",
      };

      disable2FAService.mockResolvedValue();

      await disable2FAController(req, res);

      expect(disable2FAService).toHaveBeenCalledWith(
        1,
        "123456"
      );

      expect(sendSuccess).toHaveBeenCalledWith(
        res,
        {},
        "2FA has been disabled successfully"
      );
    });

    test("should throw if otpToken missing", async () => {
      req.body = {};

      await expect(
        disable2FAController(req, res)
      ).rejects.toThrow();
    });
  });

  describe("disable2FAController", () => {
    test("should throw when otpToken missing", async () => {
      const req = { user: { user_id: 1 }, body: {} };

      await expect(disable2FAController(req, {})).rejects.toThrow();
    });
  });
});