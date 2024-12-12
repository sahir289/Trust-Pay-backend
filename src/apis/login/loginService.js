import {
  AccessDeniedError,
  AuthenticationError,
  InternalServerError,
  NotFoundError,
} from '../../utils/appErrors.js';
import { comparePassword } from '../../utils/bcryptPassword.js';
import { generateAccessToken } from '../../utils/generateJWT.js';

const loginService = async (userName, password, confirmOverRide) => {
  const user = 'h'
//   await getUserByUsernameRepo(userName);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (!user.isEnabled) {
    throw new AccessDeniedError('User is not enabled'); // 403 Forbidden - The user exists but is not verified.
  }

  const isPasswordValid = comparePassword(password, user?.password);

  if (!isPasswordValid) {
    throw new AuthenticationError('Invalid credentials'); // 401 Unauthorized - The provided credentials (password) are invalid.
  }

  const isAccessTokenExists = 'dummy'
//   await tokenRepo.getTokenByUserId(user?.id);
  if (!isAccessTokenExists) {
    const newAccessToken = generateAccessToken({
      id: user.id,
      userName: user?.userName,
      role: user?.role,
      code: user.code,
      vendor_code: user?.vendor_code,
    });
    // await tokenRepo.createUserToken(newAccessToken, user?.id);
    return newAccessToken;
  } else if (confirmOverRide) {
    const updateAccessToken = generateAccessToken({
      id: user.id,
      userName: user?.userName,
      role: user?.role,
      code: user.code,
      vendor_code: user?.vendor_code,
    });
    // await tokenRepo.updateUserToken(updateAccessToken, isAccessTokenExists?.id);
    return updateAccessToken;
  } else {
    throw new InternalServerError(`User is already logged in somewhere else`);
  }
};

export { loginService };
