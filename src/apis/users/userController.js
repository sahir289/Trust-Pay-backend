import { BadRequestError } from '../../utils/appErrors.js';
import Logger from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getUsersByUserNameService, getUsersService } from './userService.js';

const logger = new Logger();

const getUsers = async (req, res) => {
  try {
    const reqBody = req.body;
    
    const data = await getUsersService(reqBody);
    logger.log('getUsers successfully', 'info');
    return sendSuccess(res, data, 'getUsers successfully');
  } catch (error) {
    logger.log('error getting while logging in', 'error', error);
  }
};

const getUsersByUserName = async (req, res) => {
    try {
      const { username } = req.body;
      if (!username) {
        logger.log('Username is required', 'error');
        throw new BadRequestError('Username is required');
    }
      const data = await getUsersByUserNameService(username);
      logger.log('getUsers successfully', 'info');
      return sendSuccess(res, data, 'getUsers successfully');
    } catch (error) {
      logger.log('error getting while logging in', 'error', error);
    }
  };

export { getUsers, getUsersByUserName };
