import { logoutSet } from '../../middlewares/auth.js';
import { INSERT_AUTH_SCHEMA } from '../../schemas/authSchema.js';
import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
import { generateUserToken, verifyToken } from '../../utils/auth.js';
// import { verifyToken } from '../../utils/auth.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { updateSessionDao, getAllActiveSessionsDao, deleteUserSessionsDao } from './authDao.js';
import { forceLogoutUser } from '../../utils/sockets.js';
import { logger } from '../../utils/logger.js';
import {
  loginService,
  // logoutService,
  refreshTokenService,
  changePasswordService,
  verificationService,
  verfyUserService,
  verfyOtpService,
  forgetPasswordService,
  logoutService,
} from './authService.js';

const loginController = async (req, res) => {
  let clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const payload = { ...req.body };
  const options = { abortEarly: false };
  const joiValidation = INSERT_AUTH_SCHEMA.validate(payload, options);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const data = await loginService(payload, clientIP);
  ///for first login user
  if (data.isLoginFirst) {
    return sendSuccess(res, data, "user's first login");
  }
  
  res.cookie('refreshToken', data.refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
  });
  
  // Check for concurrent sessions and include session info in response
  try {
    const sessions = await getAllActiveSessionsDao(data.user.user_id, data.user.company_id);
    const hasConcurrentSessions = sessions.length > 1;
    
    // Format session data
    const formattedSessions = sessions.map(session => {
      const config = JSON.parse(session.config);
      const userInfo = config.user_info || {};
      
      return {
        session_id: session.session_id,
        created_at: session.created_at,
        is_current: session.session_id === data.sessionId,
        device_info: {
          ip: userInfo.user_ip || 'Unknown',
          hostname: userInfo.hostname || 'Unknown',
          platform: userInfo.os_platform || 'Unknown',
          login_time: config.login_time || session.created_at
        }
      };
    });
    
    const token = {
      accessToken: data.tokenInfo.accessToken,
      sessionId: data.sessionId,
      sessionInfo: {
        has_concurrent_sessions: hasConcurrentSessions,
        total_sessions: sessions.length,
        current_session_id: data.sessionId,
        sessions: formattedSessions
      }
    };
    
    return sendSuccess(res, token, 'login successfully');
  } catch (error) {
    logger.error('Error getting session info during login:', error);
    // Fallback to basic response if session info fails
    const token = {
      accessToken: data.tokenInfo.accessToken,
      sessionId: data.sessionId,
    };
    return sendSuccess(res, token, 'login successfully');
  }
};

const refreshTokenController = async (req, res) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) {
    throw new BadRequestError('Unauthorized access, Try to login again');
  }
  const decoded = verifyToken(refreshToken, { ignoreExpiration: true });
  const session = await refreshTokenService(
    decoded.user_id,
    decoded.company_id,
    refreshToken,
  );
  const newAccessToken = generateUserToken(decoded);

  const config = JSON.parse(session.config);
  config.token.access_token = newAccessToken;
  await updateSessionDao(
    decoded.user_id,
    decoded.company_id,
    session.session_id,
    config,
  );
  const token = { accessToken: newAccessToken };

  return sendSuccess(res, token, 'Refresh token generated successfully');
};

const logoutController = async (req, res) => {
  const { session_id, terminate_all_other_sessions, terminate_session_id } = req.body;
  const token = req.header('x-auth-token');
  const decodeToken = verifyToken(token);
  
  try {
    // Handle different logout scenarios
    if (terminate_all_other_sessions) {
      // Terminate all other sessions except current
      const sessions = await getAllActiveSessionsDao(decodeToken.user_id, decodeToken.company_id);
      const currentSessionId = session_id;
      const otherSessions = sessions.filter(s => s.session_id !== currentSessionId);
      
      let terminatedCount = 0;
      for (const session of otherSessions) {
        try {
          await forceLogoutUser(decodeToken.user_id, session.session_id);
          await deleteUserSessionsDao(decodeToken.user_id, decodeToken.company_id, session.session_id);
          terminatedCount++;
          logger.info(`Terminated session ${session.session_id} for user ${decodeToken.user_id}`);
        } catch (error) {
          logger.error(`Failed to terminate session ${session.session_id}:`, error);
        }
      }
      
      // Perform normal logout for current session
      await logoutService(decodeToken, session_id);
      logoutSet.add(token);
      
      return sendSuccess(res, {
        terminated_other_sessions: terminatedCount,
        total_other_sessions: otherSessions.length
      }, `Logged out successfully. ${terminatedCount} other sessions terminated.`);
      
    } else if (terminate_session_id && terminate_session_id !== session_id) {
      // Terminate a specific session (not current)
      const sessions = await getAllActiveSessionsDao(decodeToken.user_id, decodeToken.company_id);
      const targetSession = sessions.find(s => s.session_id === terminate_session_id);
      
      if (!targetSession) {
        throw new BadRequestError('Session not found or already terminated');
      }
      
      // Force logout the specific session
      await forceLogoutUser(decodeToken.user_id, terminate_session_id);
      await deleteUserSessionsDao(decodeToken.user_id, decodeToken.company_id, terminate_session_id);
      
      logger.info(`Session ${terminate_session_id} terminated by user ${decodeToken.user_id}`);
      
      return sendSuccess(res, {
        terminated_session_id: terminate_session_id,
        action: 'session_terminated'
      }, 'Session terminated successfully');
      
    } else {
      // Normal logout - just current session
      await logoutService(decodeToken, session_id);
      logoutSet.add(token);
      
      return sendSuccess(res, {
        action: 'logout'
      }, 'logout successfully');
    }
    
  } catch (error) {
    logger.error('Error during logout/session management:', error);
    
    // Fallback to basic logout
    await logoutService(decodeToken, session_id);
    logoutSet.add(token);
    return sendSuccess(res, {}, 'logout successfully');
  }
};

const verificationController = async (req, res) => {
  const { user_name,user_id,company_id } = req.user;
  const { password } = req.body;
  let ids = { user_id, company_id };
  const validate = await verificationService(ids, { user_name, password });
  if (!validate) {
    throw new BadRequestError('Invalid password');
  }

  return sendSuccess(res, {}, 'Verification successful');
};
const changePasswordController = async (req, res) => {
  const { user_id, user_name } = req.user;
  const { oldPassword, password } = req.body;
  const changedPassword = await changePasswordService({
    user_id,
    user_name,
    password,
    oldPassword,
  });
  if (!changedPassword) {
    throw new BadRequestError('Invalid old password');
  }
  return sendSuccess(res, {}, 'Password Changed Successfully');
};

const verfyUserController = async (req, res) => {
  const { user_name } = req.body;
  const verfyUser = await verfyUserService(user_name);
  if (!verfyUser) {
    throw new BadRequestError("Invalid User's Info");
  }
  return sendSuccess(res, {}, 'Verified User Successfully');
};
const verfyOtpController = async (req, res) => {
  const { otp } = req.body;
  const verfyUser = await verfyOtpService(otp);
  if (!verfyUser) {
    throw new BadRequestError('Invalid OTP');
  }
  return sendSuccess(res, verfyUser, 'Verified Otp Successfully');
};
const forgetPasswordController = async (req, res) => {
  const { password, user_id } = req.body;
  const verfyUser = await forgetPasswordService({ password, user_id });
  if (!verfyUser) {
    throw new BadRequestError("Invalid User's Info");
  }
  return sendSuccess(res, {}, 'Password Reset Successfully');
};

export {
  loginController,
  refreshTokenController,
  changePasswordController,
  logoutController,
  verificationController,
  verfyUserController,
  verfyOtpController,
  forgetPasswordController,
};
