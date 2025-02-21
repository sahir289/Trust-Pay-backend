import { logoutSet } from '../../middlewares/auth.js';
import { INSERT_AUTH_SCHEMA } from '../../schemas/authSchema.js';
import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
import { verifyToken } from '../../utils/auth.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { loginService, logoutService, refreshTokenService } from './authService.js';

const loginController = async (req, res) => {
  // const { userName, password, confirmOverRide = false } = req.body;
  const payload = req.body;
  const options = { abortEarly: false };
  const joiValidation = INSERT_AUTH_SCHEMA.validate(payload, options);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const data = await loginService(payload);
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
  if (!refreshToken) {
    throw new BadRequestError('Unauthorized');
  }
  const data = await refreshTokenService(refreshToken);
  return sendSuccess(res, data, 'refresh token generated successfully');

};

const logoutController = async (req, res) => {
  const { session_id } = req.body;
  console.log(session_id)
  const token = req.header('x-auth-token');
  const decodeToken = verifyToken(token);
  const data = await logoutService(decodeToken);
  logoutSet.add(token);
  console.log('logout successfully', 'info');
  return sendSuccess(res, data, 'logout successfully');
};

export { loginController, refreshTokenController, logoutController };
