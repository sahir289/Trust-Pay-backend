// import { processRequest } from '../../middlewares/processRequest.js';
import {
  AccessDeniedError,
  AuthenticationError,
  BadRequestError,
  NotFoundError,
} from '../../utils/appErrors.js';
import { createHash, verifyHash } from '../../utils/bcryptPassword.js';
import { getConnection } from '../../utils/db.js';
import { getUsersByUserNameDao } from '../users/userDao.js';
import { createNewToken } from '../../utils/auth.js';
import { addLoginDao } from './authDao.js';
import { generateUUID } from '../../utils/generateUUID.js';


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
    const tokenInfo = createNewToken({
      user_name: user.user_name,
      user_id: user.id,
      designation_id: user.designation,
      designation_name: user.designation_name,
      role_id: user.role,
      role_name: user.role_name,
      company_id: user.company_id,
      session_id: sessionId
    });
    const hashedToken = await createHash(tokenInfo.refreshToken);
    const newConfig = {
      refresh_token: hashedToken,
      confirm_over_ride: config.confirm_over_ride,
      session_id: sessionId,
    }

    await addLoginDao(conn, user.id, newConfig, user.company_id);
    return tokenInfo;
  
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};


export { loginService };
