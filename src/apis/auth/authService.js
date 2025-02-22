// import { processRequest } from '../../middlewares/processRequest.js';
import {
  AccessDeniedError,
  AuthenticationError,
  BadRequestError,
  NotFoundError,
} from '../../utils/appErrors.js';
import { createHash, verifyHash } from '../../utils/bcryptPassword.js';
import { getConnection } from '../../utils/db.js';
import { getUserByIdDao, getUsersByUserNameDao } from '../users/userDao.js';
import { generateUserToken } from '../../utils/auth.js';
import { addLoginDao, getRefreshTokenDao } from './authDao.js';
import { generateUUID } from '../../utils/generateUUID.js';
import { io } from '../../../server.js';


const loginService = async (config) => {
  let conn;
  try{
    conn = await getConnection();
    const user = await getUsersByUserNameDao(conn, config.username);
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

    // const payload = {
    //   first_name: user?.first_name,
    //   last_name: user?.last_name,
    //   email: user?.email,
    //   contact_no: user.contact_no,
    //   status: user?.status,
    //   config: user?.config,
    // };

    // const currentTime = new Date().getTime();
    // const timeDifference = currentTime - user.config.otpExpirationTime;
    // const validDuration = 2 * 60 * 1000;
    // if (timeDifference <= validDuration) {
    //   if (otp === user.config.otp) {
    //     updateUserDao(conn, user.id, payload, token);
    //   } else {
    //     throw new BadRequestError('Invalid Otp');
    //   }
    // } else {
    //   throw new BadRequestError('Otp is Expired !!!');
    // }

    // if (user.status === STATUS.IN_ACTIVE) {
    //   throw new BadRequestError('Unable to login. User Inactive');
    // }
    // const isPasswordCorrect = bcrypt.compareSync(password, data.password);
    // if (!isPasswordCorrect) {
    //   throw new BadRequestError('Invalid credentials');
    // }

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
      refresh_token: hashedToken,
      confirm_over_ride: config.confirm_over_ride,
      session_id: sessionId,
    }
    
    await addLoginDao(conn, user.id, newConfig, user.company_id);

    // **Notify previous sessions to log out**
    io.to(user.id).emit('forceLogout');


    return {
      tokenInfo,
      sessionId
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
    if (!storedToken){
      throw new BadRequestError('Invalid Refresh Token');  
    }
    const user = await getUserByIdDao(conn, storedToken.user_id);  
    const tokenInfo = generateUserToken(user);
    return tokenInfo;
  } catch (error) {
    console.log('Error getting while getting refresh token', error);
  }
}

const logoutService = async (config) => {
  console.log(config)

}


export { loginService, refreshTokenService, logoutService };
