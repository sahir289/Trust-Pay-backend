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
  getConnection,
  rollback,
} from '../../utils/db.js';
import { getUsersByUserNameDao, updateUserDao } from '../users/userDao.js';
import { generateUserToken } from '../../utils/auth.js';
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

    // After successful login, force logout all other sessions for this user
    // This is done AFTER the transaction to ensure we don't interfere with the login process
    forceLogoutUser(user.id, null, sessionId);

    return {
      tokenInfo,
      sessionId,
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
};
