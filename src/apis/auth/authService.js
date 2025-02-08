import { processRequest } from '../../middlewares/processRequest.js';
import {
  AccessDeniedError,
  AuthenticationError,
  BadRequestError,
  // InternalServerError,
  NotFoundError,
} from '../../utils/appErrors.js';
import { comparePassword } from '../../utils/bcryptPassword.js';
import { getConnection } from '../../utils/db.js';
// import { generateAccessToken } from '../../utils/auth.js';
import { getUsersByUserNameDao } from '../users/userDao.js';
import { createNewToken } from '../../utils/auth.js';
import { addLoginDao } from './authDao.js';
// import { generateUUID } from '../../utils/generateUUID.js';


const loginService = async (config) => {
  let conn;
  try{
    conn = await getConnection();
    const user = await getUsersByUserNameDao(conn, config.userName);
    if (!user) {
      throw new NotFoundError('User not found');
    }
  
    if (!user.isEnabled) {
      throw new AccessDeniedError('User is not enabled'); // 403 Forbidden - The user exists but is not verified.
    }
  
    const isPasswordValid = comparePassword(config.password, user?.password);
  
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

    const isRequestVerified = processRequest(
      config.source,
      user.role_name
    );
    if (!isRequestVerified) {
      throw new BadRequestError('Invalid source or role combination');
    }

    const loginData = await addLoginDao(conn, user.id, config, user.company);
    const tokenInfo = createNewToken({
      username: user.contact_no,
      userId: user.id,
      designationId: user.designation,
      designation_name: user.designation_name,
      roleId: user.role,
      role_name: user.role_name,
      companyId: user.company,
      source: loginData.config.source,
      loginId: loginData.id,
    });
    return tokenInfo;
  
  //   const isAccessTokenExists = 'dummy'
  // //   await tokenRepo.getTokenByUserId(user?.id);
  //   if (!isAccessTokenExists) {
  //     const newAccessToken = generateAccessToken({
  //       id: user.id,
  //       userName: user?.userName,
  //       role: user?.role,
  //       code: user.code,
  //       vendor_code: user?.vendor_code,
  //       merchant_code: user?.merchant_code,
  //     });
  //     // await tokenRepo.createUserToken(newAccessToken, user?.id);
  //     return newAccessToken;
  //   } else if (payload.confirmOverRide) {
  //     const updateAccessToken = generateAccessToken({
  //       id: user.id,
  //       userName: user?.userName,
  //       role: user?.role,
  //       code: user.code,
  //       vendor_code: user?.vendor_code,
  //       merchant_code: user?.merchant_code,
  //     });
  //     // await tokenRepo.updateUserToken(updateAccessToken, isAccessTokenExists?.id);
  //     return updateAccessToken;
  //   } else {
  //     throw new InternalServerError(`User is already logged in somewhere else`);
  //   }
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};

export { loginService };
