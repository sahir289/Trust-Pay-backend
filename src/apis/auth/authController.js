import { INSERT_AUTH_SCHEMA } from '../../schemas/authSchema.js';
import { ValidationError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { loginService } from './authService.js';


const loginController = async (req, res) => {
  // const { userName, password, confirmOverRide = false } = req.body;
  const payload = req.body;
  const options = { abortEarly: false };
  const joiValidation = INSERT_AUTH_SCHEMA.validate(payload, options);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const data = await loginService(payload);
  console.log('login successfully', 'info');
  return sendSuccess(res, data, 'login successfully');
};

export { loginController };
