import { BadRequestError } from '../../utils/appErrors.js';
import Logger from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createUserService, getUserByIdService, getUsersByUserNameService, getUsersService } from './userService.js';

const logger = new Logger();

const getUsers = async (req, res) => {
  try {
    // const reqBody = req.body;
    const data = await getUsersService();
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

const getUserById = async (req, res) => {
  try {
    const {id} = req.params;
    const data = await getUserByIdService(id);
    logger.log('get User by id successfully', 'info');
    return sendSuccess(res, data, 'getting User by id successfully');
  } catch (error) {
    logger.log('error getting while getting user by id', 'error', error);
  }
};

const createUser = async (req, res) => {
  try {
    const payload = req.body;
    if (!payload) {
      logger.log('payload is required', 'error');
      throw new BadRequestError('payload is required');
    }
    const data = await createUserService(payload);
    logger.log('create user successfully', 'info');
    return sendSuccess(res, data, 'create user successfully');
  } catch (error) {
    logger.log('error getting while creating user', 'error', error);
  }
};

export { getUsers, getUserById, getUsersByUserName, createUser };
