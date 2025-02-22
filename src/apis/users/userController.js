import { BadRequestError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createUserService, getUserByIdService, getUsersByUserNameService, getUsersService } from './userService.js';
import { sendError } from '../../utils/responseHandlers.js';

const getUsers = async (req, res) => {
  try {
    // const reqBody = req.body;
    let user={};
    const {role_id,company_id,designation_id}=req.user;
    user.role_id=role_id;
    user.company_id=company_id;
    user.designation_id=designation_id;
    const data = await getUsersService();
    console.log('getUsers successfully');
    return sendSuccess(res, data, 'getUsers successfully');
  } catch (error) {
    console.error('error getting while logging in', error);
  }
};

const getUsersByUserName = async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      console.error('Username is required');
      throw new BadRequestError('Username is required');
    }
    const data = await getUsersByUserNameService(username);
    console.log('getUsers successfully');
    return sendSuccess(res, data, 'getUsers successfully');
  } catch (error) {
    console.error('error getting while logging in', error);
  }
};

const getUserById = async (req, res) => {
  try {
    const {id} = req.params;
    const data = await getUserByIdService(id);
    console.log('get User by id successfully');
    return sendSuccess(res, data, 'getting User by id successfully');
  } catch (error) {
    console.error('error getting while getting user by id', error);
  }
};

const createUser = async (req, res) => {
  try {
    // const {} = req.user;
    let payload = req.body;
    if (!payload) {
      console.error('payload is required');
      return sendError(res, 'payload is required', 'Validation Error');
    }
    const {company_id} = req.user;
    payload.company_id=company_id;
    const data = await createUserService(payload);
    console.log('create user successfully');
    return sendSuccess(res, data, 'create user successfully');
  } catch (error) {
    console.error('error getting while creating user', error);
  }
};

export { getUsers, getUserById, getUsersByUserName, createUser };
