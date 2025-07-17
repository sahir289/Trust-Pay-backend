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
  getAllActiveSessionsDao,
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
import { logOutUser } from '../../utils/sockets.js';
import { Role } from '../../constants/index.js';
import { enforceSingleSession } from '../../middlewares/concurrentSessionMiddleware.js';

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

    if (user.designation === Role.ADMIN && !config.newPassword) {
      if (!config.unique_admin_id) {
        throw new BadRequestError(
          'Unique admin ID is required for admin login.',
        );
      }
      if (user.company_config.unique_admin_id !== config.unique_admin_id) {
        throw new BadRequestError(
          'You are not authorized to access this account.',
        );
      }
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
    
    try {
      // Start a transaction with serializable isolation to prevent race conditions
      await conn.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      
      const userDetails = {
        user_id: user.id,
        company_id: user.company_id,
      };

      // Enhanced concurrent session enforcement
      logger.info(`[LOGIN] Enforcing single session for user: ${user.id}`);
      await enforceSingleSession(user.id, user.company_id, null, conn);
      
      // Double-check: ensure no active sessions remain
      const remainingSessions = await getAllActiveSessionsDao(user.id, user.company_id);
      if (remainingSessions.length > 0) {
        logger.warn(`[LOGIN] Warning: ${remainingSessions.length} sessions still active after cleanup for user ${user.id}`);
        
        // Force cleanup of any remaining sessions
        for (const session of remainingSessions) {
          await deleteUserSessionsDao(user.id, user.company_id, session.session_id, conn);
          forceLogoutUser(user.id, session.session_id);
          logger.warn(`[LOGIN] Force removed session ${session.session_id} for user ${user.id}`);
        }
      }
      
      // Final verification - no sessions should exist
      const existingSession = await getSessionByIdDao(userDetails);
      if (existingSession) {
        logger.error(`[LOGIN] Critical: Session still exists after cleanup for user: ${user.id}, session: ${existingSession.session_id}`);
        
        // Emergency cleanup
        await deleteUserSessionsDao(user.id, user.company_id, existingSession.session_id, conn);
        forceLogoutUser(user.id, existingSession.session_id);
      }

      // Generate new session ID and tokens
      const sessionId = generateUUID();
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
        login_time: new Date().toISOString(),
      };

      // Create new session - this should be the only active session
      await addLoginDao(user.id, newConfig, user.company_id, sessionId, conn);
      
      // Verify only one session exists
      const allActiveSessions = await getAllActiveSessionsDao(user.id, user.company_id);
      if (allActiveSessions.length > 1) {
        logger.error(`Critical: Multiple active sessions detected for user ${user.id}:`, 
          allActiveSessions.map(s => s.session_id));
        
        // Emergency cleanup - keep only the newest session
        for (let i = 1; i < allActiveSessions.length; i++) {
          const oldSession = allActiveSessions[i];
          await deleteUserSessionsDao(user.id, user.company_id, oldSession.session_id, conn);
          forceLogoutUser(user.id, oldSession.session_id);
          logger.warn(`Emergency cleanup: Removed duplicate session ${oldSession.session_id} for user ${user.id}`);
        }
      }
      
      // Commit the transaction
      await conn.query('COMMIT');

      logger.info(`New session created for user: ${user.id}, session: ${sessionId}`);

      // Final verification - notify any other sessions via WebSocket
      setTimeout(() => {
        forceLogoutUser(user.id, null, sessionId);
      }, 1000);

      return {
        tokenInfo,
        sessionId,
      };
    } catch (transactionError) {
      // Rollback the transaction on error
      await conn.query('ROLLBACK');
      
      // Handle serialization failures by retrying once
      if (transactionError.code === '40001' || transactionError.message.includes('serialization failure')) {
        logger.warn(`Serialization failure for user ${user.id}, retrying login...`);
        // Add a small random delay to prevent thundering herd
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
        throw new AuthenticationError('Login request conflict. Please try again.');
      }
      
      throw transactionError;
    }
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
    await logOutUser(decodeToken.user_id, session_id);
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
    logger.error('Error getting while changing password', error);
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
    logger.error('Error getting while verify password', error);
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
    logger.error('Error getting while forgetting password', error);
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
    logger.log('Error while verifying user', error);
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
