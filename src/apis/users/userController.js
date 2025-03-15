import { BadRequestError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  createUserService,
  getUserByIdService,
  getUsersByUserNameService,
  getUsersService,
  userUpdateService,
} from './userService.js';
import { CREATE_USER_SCHEMA } from '../../schemas/userSchema.js';
import { ValidationError } from '../../utils/appErrors.js';
import { transactionWrapper } from '../../utils/db.js';
const getUsers = async (req, res) => {
  // const reqBody = req.body;
  const { role, company_id } = req.user;
  const {page, limit} = req.query;
  const data = await getUsersService(
    {
      company_id,
      ...req.query,
    },
    role, page,limit,
  );
  console.log('getUsers successfully');
  return sendSuccess(res, data, 'getUsers successfully');
};

const getUsersByUserName = async (req, res) => {
  const { role, company_id } = req.user;
  const { username } = req.body;
  const ids = { company_id };
  if (!username) {
    console.error('Username is required');
    throw new BadRequestError('Username is required');
  }
  const data = await getUsersByUserNameService(username, ids, role);
  console.log('getUsers successfully');
  return sendSuccess(res, data, 'getUsers successfully');
};

const getUserById = async (req, res) => {
  const { role, role_id, designation_id, company_id } = req.user;
  const { id } = req.params;
  const ids = { role_id, designation_id, company_id, id };
  const data = await getUserByIdService(ids, role);
  console.log('get User by id successfully');
  return sendSuccess(res, data, 'getting User by id successfully');
};

const createUser = async (req, res) => {
  // const joiValidation = CREATE_USER_SCHEMA.validate(req.body);
  // if (joiValidation.error) {
  //   throw new ValidationError(joiValidation.error);
  // }
  const { role, company_id, user_id } = req.user;
  let payload = req.body;
  payload.company_id = company_id;
  payload.created_by = user_id;
  payload.updated_by = user_id;
  await transactionWrapper(createUserService)(payload, role);
  console.log('Create user successfully');
  return sendSuccess(res, {}, 'Create user successfully');
};


const updateUser = async (req, res) => {
  const joiValidation = CREATE_USER_SCHEMA.validate(req.body);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const { role, company_id, user_id } = req.user;
  let payload = req.body;
  payload.updated_by = user_id;
  const id = req.params.id;
  const ids = { id, company_id };
  await userUpdateService(ids ,payload, role);
  console.log('update user successfully');
  return sendSuccess(res, {}, 'update user successfully');
};

export { getUsers, getUserById, getUsersByUserName, createUser, updateUser };
