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
import {
  getUserByIdDao,
  getUsersByUserNameDao,
  updateUserDao,
  getUsersByEmailDao,
} from '../users/userDao.js';
import { generateUserToken } from '../../utils/auth.js';
import {
  addLoginDao,
  deleteUserSessionsDao,
  getRefreshTokenDao,
  getSessionByIdDao,
  changePasswordDao,
} from './authDao.js';
import { createUserOtpDao ,getUserOtpDao,updateUserOtpDao} from '../userOtp/userOtpDao.js';
import { generateUUID } from '../../utils/generateUUID.js';
import { generateOTP } from '../../utils/generateOtp.js';
import { forceLogoutUser } from '../../utils/sockets.js';
import { sendOTP } from '../../utils/sendMailer.js';
const loginService = async (config, clientIP) => {
  let conn;
  let ids = {};
  try {
    
    const user = await getUsersByUserNameDao(ids, config.username);

    if (config.newPassword) {
      const isPasswordValid = await verifyHash(config.password, user?.password);
      if (isPasswordValid) {
        const hashedPassword = await createHash(config.newPassword);
        await updateUserDao(
          { id: user.id },
          { password: hashedPassword },
          conn,
        );
      }
    }    
    else {
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
    }

    config.password = config.newPassword;
    delete config.newPassword;
    // const isRequestVerified = processRequest(
    //   config.source,
    //   user.role_name
    // );
    // if (!isRequestVerified) {
    //   throw new BadRequestError('Invalid source or role combination');
    // }

    // const loginData = await addLoginDao(user.id, config, user.company);

    ///for first login data
    conn = await getConnection();
    if (user.config.isLoginFirst) {
      const loginFirstObj = {
        id: user.id,
        isLoginFirst: user.config.isLoginFirst,
      };
      const updateUser = await updateUserDao(
        { id: user.id },
        { config: { isLoginFirst: false } },
        conn
      );
      if (updateUser) {
        return loginFirstObj;
      }
    }

    const sessionId = generateUUID();

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
      token: { refresh_token: hashedToken },
      confirm_over_ride: config.confirmOverRide,
    };
    await addLoginDao(user.id, newConfig, user.company_id, sessionId);

    // **Notify previous sessions to log out**
    forceLogoutUser(user.id);

    return {
      tokenInfo,
      sessionId,
    };
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
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
  } if (conn) {
    try {
      conn.release();
    } catch (releaseError) {
      console.error('Error while releasing the connection', releaseError);
    }
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

const changePasswordService = async (payload) => {
  let conn;
  try {
    conn = await getConnection();
    const userDetials = {user_name:payload.user_name, password:payload.oldPassword}
    const verified = await verificationService(payload.user_id, userDetials);
    if (!verified) {
       throw new AuthenticationError('Invalid Password');
    }
    const newPassword =await createHash(payload.password)
    const user = await changePasswordDao(payload.user_id,newPassword);
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

const verificationService = async (id, payload) => {
try {
 const userDetails = await getUsersByUserNameDao(id, payload.user_name );
 const isPasswordValid = await verifyHash(payload.password, userDetails.password);
 if (!isPasswordValid) {
   throw new AuthenticationError('Invalid Password');
 }
  return userDetails;
   } catch (error) {
  console.log('Error getting while changing password', error);
   } 
}
const forgetPasswordService = async (payload) => {
  try {
    const hashPassword = await createHash(payload.password)
    const user =await updateUserDao(
    { id: payload.user_id },
    { password: hashPassword },
    );
    return user;
  } catch (error) {
    console.log('Error getting while forgetting password', error);
  }
};
const verfyUserService = async ( email) => {
  try {
    let userDetails = await getUsersByEmailDao(email);
    if (!userDetails) {
      throw new AuthenticationError(`Invalid User`);
    }
    const otp = generateOTP();
    await sendOTP(userDetails.email, otp);
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
     }
     else if (userDetails.is_used) {
       throw new AuthenticationError(`Please Enter New Otp`);
     }
     else {
       await updateUserOtpDao({ user_id: userDetails.user_id }, { is_used: true });
       return userDetails.user_id;
     }
   } catch (error) {
     console.log('Error while verifying otp', error);
   }
 }
export {
  loginService,
  refreshTokenService,
  changePasswordService,
  verificationService,
  logoutService,
  verfyUserService,
  verfyOtpService,
  forgetPasswordService
};
