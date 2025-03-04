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
import { getUserByIdDao, getUsersByUserNameDao } from '../users/userDao.js';
import { generateUserToken } from '../../utils/auth.js';
import {
  addLoginDao,
  getRefreshTokenDao,
  getSessionByIdDao,
} from './authDao.js';
import { generateUUID } from '../../utils/generateUUID.js';
import { io } from '../../../server.js';

const loginService = async (config, clientIP) => {
  let conn;
  let ids = {};
  try {
    conn = await getConnection();
    const user = await getUsersByUserNameDao(conn, ids, config.username);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (!user.is_enabled) {
      throw new AccessDeniedError('User is not enabled'); // 403 Forbidden - The user exists but is not verified.
    }

    const isPasswordValid = await verifyHash(config.password, user?.password);
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid credentials'); // 401 Unauthorized - The provided credentials (password) are invalid.
    }

    // const isRequestVerified = processRequest(
    //   config.source,
    //   user.role_name
    // );
    // if (!isRequestVerified) {
    //   throw new BadRequestError('Invalid source or role combination');
    // }

    // const loginData = await addLoginDao(conn, user.id, config, user.company);
    const sessionId = generateUUID();

    // await deleteUserSessionsDao(conn, user.id);

    const tokenInfo = generateUserToken(user);
    const hashedToken = await createHash(tokenInfo.refreshToken);
    const newConfig = {
      user_ip: clientIP,
      token: { refresh_token: hashedToken },
      confirm_over_ride: config.confirmOverRide,
      hostname: os.hostname(),
      os_platform: os.platform(),
      network_interface: Object.values(os.networkInterfaces())[0]?.[0],
      cpu_cores: os.cpus()[0],
    };
    await addLoginDao(conn, user.id, newConfig, user.company_id, sessionId);

    // **Notify previous sessions to log out**
    io.to(user.id).emit('forceLogout');

    return {
      tokenInfo,
      sessionId,
    };
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};

const refreshTokenService = async (refreshToken) => {
  let conn;
  try {
    const hashedToken = await createHash(refreshToken);
    const storedToken = await getRefreshTokenDao(hashedToken);
    if (!storedToken) {
      throw new BadRequestError('Invalid Refresh Token');
    }
    const user = await getUserByIdDao(conn, storedToken.user_id);
    const tokenInfo = generateUserToken(user);
    return tokenInfo;
  } catch (error) {
    console.log('Error getting while getting refresh token', error);
  }
};

const logoutService = async (decodeToken, session_id) => {
  let conn;
  try {
    conn = await getConnection();
    console.log(decodeToken, session_id);
    const user = await getSessionByIdDao(conn, decodeToken, session_id);
    const tokenInfo = generateUserToken(user);
    return tokenInfo;
  } catch (error) {
    console.log('Error getting while getting refresh token', error);
  }
};

export { loginService, refreshTokenService, logoutService };
