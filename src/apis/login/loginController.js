import Logger from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { loginService } from './loginService.js';

const logger = new Logger();

const loginController = async (req, res) => {
  try {
    const { userName, password, confirmOverRide = false } = req.body;

    const data = await loginService(userName, password, confirmOverRide);
    logger.log('login successfully', 'info', data);
    return sendSuccess(res, data, 'login successfully');
  } catch (error) {
    logger.log('error getting while logging in', 'error', error);
  }
};

export { loginController };
