// import { processRequest } from '../../middlewares/processRequest.js';
import {
  AccessDeniedError,
  AuthenticationError,
  BadRequestError,
  NotFoundError,
} from '../../utils/appErrors.js';
import { createHash, verifyHash } from '../../utils/bcryptPassword.js';
import os from 'os';
import { getConnection } from '../../utils/db.js';
import { getUsersByUserNameDao, updateUserDao } from '../users/userDao.js';
import { generateUserToken } from '../../utils/auth.js';
import {
  addLoginDao,
  deleteUserSessionsDao,
  getSessionByIdDao,
  changePasswordDao,
} from './authDao.js';
import {
  createUserOtpDao,
  getUserOtpDao,
  updateUserOtpDao,
} from '../userOtp/userOtpDao.js';
import { generateUUID } from '../../utils/generateUUID.js';
import { generateOTP } from '../../utils/generateOtp.js';
import { forceLogoutUser } from '../../utils/sockets.js';
import { sendOTP } from '../../utils/sendMailer.js';
import { logger } from '../../utils/logger.js';
import { compareHash } from '../../utils/hashUtils.js';

const loginService = async (config, clientIP) => {
  let conn;
  try {
    let user = await getUsersByUserNameDao({}, config.username);
    if (!user) {
      throw new NotFoundError('User Not Found.');
    }
    if (!user.is_enabled) {
      throw new AccessDeniedError(
        'User not active. Please contact Support Team',
      );
    }

    let isLoginSecondFlag = false;
    // Handle password update for newPassword
    if (config.newPassword) {
      const isPasswordValid = await verifyHash(config.password, user.password);
      if (!isPasswordValid) {
        throw new NotFoundError('Invalid current password. Please try again.');
      }
      const hashedPassword = await createHash(config.newPassword);
      conn = await getConnection();
      await updateUserDao(
        { id: user.id },
        {
          password: hashedPassword,
          config: { ...user.config, isLoginFirst: false },
        },
        conn,
      );
      isLoginSecondFlag = true;
    } else {
      // Verify password for regular login
      const isPasswordValid = await verifyHash(config.password, user.password);
      if (!isPasswordValid) {
        throw new NotFoundError('Invalid Credentials. Please try again.');
      }
    }

    // Handle first login
    if (user.config.isLoginFirst && !isLoginSecondFlag) {
      const loginFirstObj = {
        id: user.id,
        isLoginFirst: user.config.isLoginFirst,
      };
      return loginFirstObj;
    }

    // Proceed with session and token generation for non-first login
    conn = conn || (await getConnection());
    const userDetails = {
      user_id: user.id,
      company_id: user.company_id,
    };

    const userSession = await getSessionByIdDao(userDetails);

    let sessionId;
    // if user session already exists, skipping session creation
    if (userSession) {
      sessionId = userSession.session_id;
    } else {
      sessionId = generateUUID();
    }
    await deleteUserSessionsDao(user.id, user.company_id);

    const tokenInfo = generateUserToken(user);
    const hashedToken = await createHash(tokenInfo.refreshToken);
    const newConfig = {
      user_info: {
        user_ip: clientIP,
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
    };
    await addLoginDao(user.id, newConfig, user.company_id, sessionId);

    // notify previous sessions to log out
    forceLogoutUser(user.id);

    return {
      tokenInfo,
      sessionId,
    };
  } catch (error) {
    logger.error('Error in login service:', error);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        logger.error('Error while releasing the connection', releaseError);
      }
    }
  }
};

const refreshTokenService = async (user_id, company_id, refreshToken) => {
  let conn;
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
    throw new BadRequestError(error.message);
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        logger.error('Error while releasing the connection', releaseError);
      }
    }
  }
};

const logoutService = async (decodeToken, session_id) => {
  let conn;
  try {
    conn = await getConnection();
    const data = await deleteUserSessionsDao(
      decodeToken.user_id,
      decodeToken.company_id,
      session_id,
    );
    return data;
  } catch (error) {
    logger.error('Error getting while logout', error);
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        logger.error('Error while releasing the connection', releaseError);
      }
    }
  }
};

const changePasswordService = async (payload) => {
  let conn;
  try {
    conn = await getConnection();
    const userDetials = {
      user_name: payload.user_name,
      password: payload.oldPassword,
    };
    const verified = await verificationService(payload.user_id, userDetials);
    if (!verified) {
      throw new AuthenticationError('Invalid Password');
    }
    const newPassword = await createHash(payload.password);
    const user = await changePasswordDao(payload.user_id, newPassword);
    return user;
  } catch (error) {
    console.log('Error getting while changing password', error);
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        console.error('Error while releasing the connection', releaseError);
      }
    }
  }
};

const verificationService = async (ids, payload) => {
  try {
    const userDetails = await getUsersByUserNameDao(ids, payload.user_name);
    const isPasswordValid = await verifyHash(
      payload.password,
      userDetails.password,
    );
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid Password');
    }
    return userDetails;
  } catch (error) {
    console.log('Error getting while changing password', error);
  }
};
const forgetPasswordService = async (payload) => {
  try {
    const hashPassword = await createHash(payload.password);
    const user = await updateUserDao(
      { id: payload.user_id },
      { password: hashPassword },
    );
    return user;
  } catch (error) {
    console.log('Error getting while forgetting password', error);
  }
};
const verfyUserService = async (user_name) => {
  try {
    let userDetails = await getUsersByUserNameDao({}, user_name);
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
    console.log('Error while verifying user', error);
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
    console.log('Error while verifying otp', error);
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
};
