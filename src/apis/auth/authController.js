import { logoutSet } from '../../middlewares/auth.js';
import { INSERT_AUTH_SCHEMA } from '../../schemas/authSchema.js';
import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
// import { verifyToken } from '../../utils/auth.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  loginService,
  // logoutService,
  refreshTokenService,
} from './authService.js';

const loginController = async (req, res) => {
  // const { userName, password, confirmOverRide = false } = req.body;
  let clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const payload = { ...req.body };
  console.log(payload, 'dhfdjhf djchf');
  const options = { abortEarly: false };
  const joiValidation = INSERT_AUTH_SCHEMA.validate(payload, options);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const data = await loginService(payload, clientIP);
  res.cookie('refreshToken', data.refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
  });
  const token = {
    accessToken: data.tokenInfo.accessToken,
    sessionId: data.sessionId,
  };
  console.log('login successfully', 'info');
  return sendSuccess(res, token, 'login successfully');
};

const refreshTokenController = async (req, res) => {
  const { refreshToken } = req.cookies;
  console.log(req.cookies, 'refreshToken');
  if (!refreshToken) {
    throw new BadRequestError('Unauthorized');
  }
  const data = await refreshTokenService(refreshToken);
  return sendSuccess(res, data, 'refresh token generated successfully');
};

const logoutController = async (req, res) => {
  const { session_id } = req.body;
  console.log(session_id, 'session_id');
  const token = req.header('x-auth-token');
  // const decodeToken = verifyToken(token);
  // const data = await logoutService(decodeToken, session_id);
  // console.log(data, "data")
  logoutSet.add(token); // we will update this logic in future, currently this approach is not good to invalidate token
  console.log('logout successfully', 'info');
  return sendSuccess(res, {}, 'logout successfully');
};

export { loginController, refreshTokenController, logoutController };
