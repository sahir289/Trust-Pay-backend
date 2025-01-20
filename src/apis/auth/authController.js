import { INSERT_AUTH_SCHEMA } from '../../schemas/authSchema.js';
import { ValidationError } from '../../utils/appErrors.js';
import Logger from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { loginService } from './authService.js';

const logger = new Logger();

const loginController = async (req, res) => {
  try {
    // const { userName, password, confirmOverRide = false } = req.body;
    const payload = req.body;
    const options = { abortEarly: false };
    const joiValidation = INSERT_AUTH_SCHEMA.validate(payload, options);
    if (joiValidation.error) {
      throw new ValidationError(joiValidation.error);
    }
    const data = await loginService(payload);
    logger.log('login successfully', 'info');
    return sendSuccess(res, data, 'login successfully');
  } catch (error) {
    logger.log('error getting while logging in', 'error', error);
  }
};

export { loginController };
