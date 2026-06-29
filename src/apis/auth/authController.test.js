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
});