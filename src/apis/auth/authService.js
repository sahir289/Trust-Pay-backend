import {
  AuthenticationError,
  BadRequestError,
  NotFoundError,
} from '../../utils/appErrors.js';
import { createHash, verifyHash } from '../../utils/bcryptPassword.js';
import os from 'node:os';
import {
  beginTransaction,
  commit,
  executeQuery,
  getConnection,
  rollback,
} from '../../utils/db.js';
import {
  getUsersByUserNameDao,
  updateUserDao,
  saveTwoFactorSecretDao,
  enableTwoFactorDao,
  disableTwoFactorDao,
} from '../users/userDao.js';
import {
  generateUserToken,
  generatePreAuthToken,
  verifyPreAuthToken,
} from '../../utils/auth.js';
import { generateSetup, verifyTotpToken } from '../../services/twoFactorService.js';
import {
  addLoginDao,
  deleteUserSessionsDao,
  getSessionByIdDao,
  changePasswordDao,
  getUserAuthPasswordDao,
  getRoleByUserNameDao,
  getUserForVerificationDao,
} from './authDao.js';
import {
  AUTH_SESSION_CACHE_TTL_SEC,
  buildAuthSessionCacheKey,
  deleteCachedData,
  setCachedData,
} from '../../utils/redishashkey.js';
import { filterResponse } from '../../helpers/index.js';
import { columns } from '../../constants/index.js';
import {
  createUserOtpDao,
  getUserOtpDao,
  updateUserOtpDao,
} from '../userOtp/userOtpDao.js';
import { generateUUID } from '../../utils/generateUUID.js';
import { generateOTP } from '../../utils/generateOtp.js';
import { forceLogoutUser, logOutUser } from '../../utils/sockets.js';
import { sendOTP } from '../../utils/sendMailer.js';
import { logger } from '../../utils/logger.js';
import {
  compareHash,
  createHash as createDeterministicHash,
} from '../../utils/hashUtils.js';
import { Role } from '../../constants/index.js';
import { getSettingDao } from '../settings/settingsDao.js';

const assertAdminLoginAccess = (user, config) => {
  if (user.designation !== Role.ADMIN || config.newPassword) {
    return;
  }

  if (!config.unique_admin_id) {
    throw new BadRequestError('Unique admin ID is required for admin login.');
  }

  if (user.company_config.unique_admin_id !== config.unique_admin_id) {
    throw new BadRequestError('You are not authorized to access this account.');
  }
};

const getFirstLoginResponse = (user, isLoginSecondFlag) => {
  if (!user.config.isLoginFirst || isLoginSecondFlag) {
    return null;
  }

  return {
    id: user.id,
    isLoginFirst: user.config.isLoginFirst,
  };
};

const buildLoginSessionConfig = (config, clientIP, tokenInfo, hashedToken) => ({
  user_info: {
    user_ip: clientIP,
    user_location: config.user_location || {},
    hostname: os.hostname(),
    os_platform: os.platform(),
    network_interface: Object.values(os.networkInterfaces())[0]?.[0],
    cpu_cores: os.cpus()[0],
  },
  token: {
    access_token: tokenInfo.accessToken,
    refresh_token: hashedToken,
  },
  confirm_over_ride: config.confirmOverRide,
  login_time: new Date().toISOString(),
});

const prepareLoginData = async (user, config) => {
  if (config.newPassword) {
    const isPasswordValid = await verifyHash(config.password, user.password);
    if (!isPasswordValid) {
      throw new NotFoundError('Invalid current password. Please try again.');
    }

    return {
      hashedPassword: await createHash(config.newPassword),
      isLoginSecondFlag: true,
    };
  }

  const isPasswordValid = await verifyHash(config.password, user.password);
  if (!isPasswordValid) {
    throw new NotFoundError('Invalid Credentials. Please try again.');
  }

  return {
    hashedPassword: null,
    isLoginSecondFlag: false,
  };
};

const loginService = async (
  config,
  clientIP,
  // retryCount = 0
) => {
  let conn;
  let committed = false;
  try {
    const user = await getUsersByUserNameDao({}, config.username);
    if (!user) {
      throw new NotFoundError('User Not Found.');
    }
    if (!user.is_enabled) {
      throw new NotFoundError('User not active. Please contact Support Team');
    }

    assertAdminLoginAccess(user, config);

    const { hashedPassword, isLoginSecondFlag } = await prepareLoginData(
      user,
      config,
    );

    const firstLoginResponse = getFirstLoginResponse(user, isLoginSecondFlag);
    if (firstLoginResponse) {
      return firstLoginResponse;
    }

    // Get the global 2FA enforcement setting
    const twoFactorEnforcementSetting = await getSettingDao('two_factor_enforcement');
    const isTwoFactorEnforced = twoFactorEnforcementSetting?.enabled || false;

    // If 2FA is enabled and this is a normal login (not a first-login password
    // change), do NOT issue a session yet. Return a short-lived pre-auth token
    // so the client can complete the second factor before getting full access.
    if (user.is_two_factor_enabled && !isLoginSecondFlag) {
      const preAuthToken = generatePreAuthToken({
        user_id: user.id,
        user_name: user.user_name,
      });
      return { twoFactorRequired: true, preAuthToken };
    }

    // Proceed with session and token generation for non-first login
    // Generate new session ID and tokens first (before any DB operations)
    const sessionId = generateUUID();
    const tokenInfo = generateUserToken(user, sessionId);
    const hashedToken = createDeterministicHash(tokenInfo.refreshToken);
    const newConfig = buildLoginSessionConfig(
      config,
      clientIP,
      tokenInfo,
      hashedToken,
    );

    conn = await getConnection();
    await beginTransaction(conn);

    if (hashedPassword) {
      try {
        await updateUserDao(
          { id: user.id },
          {
            password: hashedPassword,
            config: { ...user.config, isLoginFirst: false },
          },
          conn,
        );
      } catch (updateError) {
        logger.error('Error updating user password:', updateError);
        throw updateError;
      }
    }

    // First, immediately invalidate ALL existing sessions for this user
    // This prevents any race condition with multiple simultaneous logins
    await deleteUserSessionsDao(user.id, user.company_id, null, conn);

    // Create new session - this should be the only active session
    await addLoginDao(user.id, newConfig, user.company_id, sessionId, conn);

    // Commit the transaction
    await commit(conn);
    committed = true;

    logger.info(
      `New session created for user: ${user.id}, session: ${sessionId}`,
    );

    await setCachedData(
      buildAuthSessionCacheKey({
        user_id: user.id,
        company_id: user.company_id,
        session_id: sessionId,
      }),
      { session_id: sessionId },
      AUTH_SESSION_CACHE_TTL_SEC,
      'Auth session cache',
    );

    // After successful login, force logout all other sessions for this user
    // This is done AFTER the transaction to ensure we don't interfere with the login process
    forceLogoutUser(user.id, null, sessionId);

    return {
      tokenInfo,
      refreshToken: tokenInfo.refreshToken,
      sessionId,
      user: filterResponse(
        user,
        columns.USER,
        { stripSensitive: true },
      ),
      two_factor_enforcement: isTwoFactorEnforced,
    };
  } catch (error) {
    if (conn && !committed) await rollback(conn);
    logger.error('Error in login service:', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

const refreshTokenService = async (user_id, company_id, refreshToken) => {
  try {
    const session = await getSessionByIdDao({ user_id, company_id });
    if (!session) {
      throw new AuthenticationError('No active session found');
    }

    const config = JSON.parse(session.config);
    const isValid = compareHash(refreshToken, config.token.refresh_token);
    if (!isValid) {
      throw new AuthenticationError('Invalid refresh token');
    }
    return session;
  } catch (error) {
    logger.log('Error getting :', error);
    throw error;
  }
};

const logoutService = async (decodeToken, session_id) => {
  try {
    const data = await deleteUserSessionsDao(
      decodeToken.user_id,
      decodeToken.company_id,
      session_id,
    );

    await deleteCachedData(
      buildAuthSessionCacheKey({
        user_id: decodeToken.user_id,
        company_id: decodeToken.company_id,
        session_id: session_id || decodeToken.session_id,
      }),
      'Auth session cache',
    );

    // Emit socket logout asynchronously so API latency depends on DB work,
    // not on Socket.IO/Redis bridge availability.
    void logOutUser(decodeToken.user_id, session_id).catch((socketError) => {
      logger.warn('Logout socket emit failed (non-blocking):', socketError);
    });

    return data;
  } catch (error) {
    logger.error('Error getting while logout', error);
    throw error;
  }
};

const changePasswordService = async (payload) => {
  try {
    const userDetials = {
      user_name: payload.user_name,
      password: payload.oldPassword,
    };
    const verified = await verificationService(
      { user_id: payload.user_id },
      userDetials,
    );
    if (!verified) {
      throw new AuthenticationError('Invalid Password');
    }
    const newPassword = await createHash(payload.password);
    const user = await changePasswordDao(payload.user_id, newPassword);
    return user;
  } catch (error) {
    logger.error('Error getting while changing password', error);
    throw error;
  }
};

const verificationService = async (ids, payload) => {
  try {
    const userDetails = await getUserAuthPasswordDao({
      user_id: ids?.user_id || ids?.id,
      company_id: ids?.company_id,
      user_name: payload.user_name,
    });

    if (!userDetails) {
      throw new NotFoundError('User Not Found.');
    }

    const isPasswordValid = await verifyHash(
      payload.password,
      userDetails.password,
    );
    if (!isPasswordValid) {
      throw new BadRequestError('Invalid password');
    }
    return userDetails;
  } catch (error) {
    logger.error('Error getting while verify password', error);
    throw error;
  }
};
const forgetPasswordService = async (payload) => {
  try {
    const hashPassword = await createHash(payload.password);
    const user = await updateUserDao(
      { id: payload.user_id },
      {
        password: hashPassword,
        config: { isLoginFirst: false },
      },
    );
    return user;
  } catch (error) {
    logger.error('Error getting while forgetting password', error);
    throw error;
  }
};
const verfyUserService = async (user_name) => {
  try {
    const userDetails = await getUserForVerificationDao(user_name);
    if (!userDetails) {
      throw new AuthenticationError(`Invalid User`);
    }
    const otp = generateOTP();
    await sendOTP(
      userDetails.email,
      otp,
      userDetails.user_name,
      userDetails.designation,
    );
    const now = new Date();
    const expirationDate = new Date(now.getTime() + 10 * 60 * 1000);
    const payload = {
      user_id: userDetails.id,
      otp: otp,
      expiration_time: expirationDate,
    };
    await createUserOtpDao(payload);
    return true;
  } catch (error) {
    logger.log('Error while verifying user', error);
    throw error;
  }
};
const verfyOtpService = async (otp) => {
  try {
    let userDetails = await getUserOtpDao(otp);
    if (!userDetails) {
      throw new AuthenticationError(`Please Enter Vaild OTP`);
    }
    const expiration = userDetails?.expiration_time;
    const now = new Date();
    if (now >= expiration) {
      throw new AuthenticationError(`Expired Otp`);
    } else if (userDetails.is_used) {
      throw new AuthenticationError(`Please Enter New Otp`);
    } else {
      await updateUserOtpDao(
        { user_id: userDetails.user_id },
        { is_used: true },
      );
      return { id: userDetails.user_id };
    }
  } catch (error) {
    logger.log('Error while verifying otp', error);
    throw error;
  }
};

const getUserRoleService = async (userName) => {
  try {
    const user = await getRoleByUserNameDao(userName);
    if (!user) {
      throw new NotFoundError(`User not found`);
    }

    let response = {
      isAdmin: false,
      isVendor: false,
    };
    if (user.designation === Role.ADMIN) {
      response = {
        isAdmin: true,
      };
    } else if (user.role === Role.VENDOR) {
      response = {
        isVendor: true,
      };
    }
    return response;
  } catch (error) {
    logger.error('Error getting user role', error);
    throw error; // Re-throw the error to be handled by the calling function
  }
};

// ---------------------------------------------------------------------------
// Internal helper: creates a DB session and returns token info.
// Used by both loginService (non-2FA path) and verifyLoginOtpService.
// ---------------------------------------------------------------------------
const _createLoginSession = async (user, config, clientIP) => {
  let conn;
  let committed = false;
  try {
    const sessionId = generateUUID();
    const tokenInfo = generateUserToken(user, sessionId);
    const hashedToken = createDeterministicHash(tokenInfo.refreshToken);
    const newConfig = buildLoginSessionConfig(
      config,
      clientIP,
      tokenInfo,
      hashedToken,
    );

    conn = await getConnection();
    await beginTransaction(conn);

    await deleteUserSessionsDao(user.id, user.company_id, null, conn);
    await addLoginDao(user.id, newConfig, user.company_id, sessionId, conn);

    await commit(conn);
    committed = true;

    logger.info(
      `New session created for user: ${user.id}, session: ${sessionId}`,
    );

    await setCachedData(
      buildAuthSessionCacheKey({
        user_id: user.id,
        company_id: user.company_id,
        session_id: sessionId,
      }),
      { session_id: sessionId },
      AUTH_SESSION_CACHE_TTL_SEC,
      'Auth session cache',
    );

    forceLogoutUser(user.id, null, sessionId);

    // Get the global 2FA enforcement setting
    const twoFactorEnforcementSetting = await getSettingDao('two_factor_enforcement');
    const isTwoFactorEnforced = twoFactorEnforcementSetting?.enabled || false;

    return {
      tokenInfo,
      refreshToken: tokenInfo.refreshToken,
      sessionId,
      user: filterResponse(
        user,
        columns.USER,
        { stripSensitive: true },
      ),
      two_factor_enforcement: isTwoFactorEnforced,
    };
  } catch (error) {
    if (conn && !committed) await rollback(conn);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

// ---------------------------------------------------------------------------
// 2FA: second step of the login flow (called after OTP is submitted)
// ---------------------------------------------------------------------------
const verifyLoginOtpService = async (preAuthToken, otpToken, clientIP) => {
  try {
    // 1. Validate the pre-auth token
    const decoded = verifyPreAuthToken(preAuthToken);

    // 2. Re-fetch the full user so we have all fields for token generation
    const user = await getUsersByUserNameDao({}, decoded.user_name);
    if (!user) {
      throw new NotFoundError('User not found.');
    }
    if (!user.is_enabled) {
      throw new NotFoundError('User not active. Please contact Support Team');
    }
    if (!user.is_two_factor_enabled || !user.two_factor_secret) {
      throw new BadRequestError('2FA is not enabled for this user.');
    }

    // 3. Verify the OTP
    const isValid = verifyTotpToken(otpToken, user.two_factor_secret);
    if (!isValid) {
      throw new AuthenticationError('Invalid or expired OTP. Please try again.');
    }

    // 4. Create the real session and issue the full JWT
    const result = await _createLoginSession(
      user,
      { user_location: {} },
      clientIP,
    );
    return result;
  } catch (error) {
    logger.error('Error in verifyLoginOtpService:', error);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// 2FA management services (protected routes — user already authenticated)
// ---------------------------------------------------------------------------

/**
 * Generates a fresh TOTP secret + QR code and saves the secret.
 * The user must confirm with otpToken via confirm2FAService before 2FA
 * is actually enabled.
 */
const setup2FAService = async (userId, userName) => {
  try {
    const { secret, qrCodeDataUrl } = await generateSetup(userName);
    await saveTwoFactorSecretDao(userId, secret);
    return { qrCodeDataUrl, secret };
  } catch (error) {
    logger.error('Error in setup2FAService:', error);
    throw error;
  }
};

/**
 * Verifies the first OTP after setup and enables 2FA.
 * The secret must already be saved via setup2FAService.
 */
const confirm2FAService = async (userId, otpToken) => {
  try {
    const result = await executeQuery(
      `SELECT two_factor_secret
       FROM public."User"
       WHERE id = $1 AND is_obsolete = false`,
      [userId],
    );
    const row = result.rows[0] || null;

    if (!row?.two_factor_secret) {
      throw new BadRequestError(
        '2FA setup not started. Please call /2fa/setup first.',
      );
    }

    const isValid = verifyTotpToken(otpToken, row.two_factor_secret);
    if (!isValid) {
      throw new AuthenticationError('Invalid or expired OTP. Please try again.');
    }

    await enableTwoFactorDao(userId);
    return true;
  } catch (error) {
    logger.error('Error in confirm2FAService:', error);
    throw error;
  }
};

/**
 * Verifies the current OTP then disables 2FA and clears the secret.
 */
const disable2FAService = async (userId, otpToken) => {
  try {
    const result = await executeQuery(
      `SELECT is_two_factor_enabled, two_factor_secret
       FROM public."User"
       WHERE id = $1 AND is_obsolete = false`,
      [userId],
    );
    const row = result.rows[0] || null;

    if (!row?.is_two_factor_enabled) {
      throw new BadRequestError('2FA is not currently enabled for this user.');
    }
    if (!row.two_factor_secret) {
      throw new BadRequestError('No 2FA secret found. Please contact support.');
    }

    const isValid = verifyTotpToken(otpToken, row.two_factor_secret);
    if (!isValid) {
      throw new AuthenticationError('Invalid or expired OTP. Please try again.');
    }

    await disableTwoFactorDao(userId);
    return true;
  } catch (error) {
    logger.error('Error in disable2FAService:', error);
    throw error;
  }
};

export {
  loginService,
  refreshTokenService,
  changePasswordService,
  verificationService,
  logoutService,
  verfyUserService,
  verfyOtpService,
  forgetPasswordService,
  getUserRoleService,
  verifyLoginOtpService,
  setup2FAService,
  confirm2FAService,
  disable2FAService,
};
