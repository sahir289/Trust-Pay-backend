import { BadRequestError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createUserService, getUserByIdService, getUsersByUserNameService, getUsersService } from './userService.js';
import { sendError } from '../../utils/responseHandlers.js';
import { VALIDATE_USER_BY_ID ,CREATE_USER_SCHEMA} from '../../schemas/userSchema.js';
import { ValidationError } from '../../utils/appErrors.js';
const getUsers = async (req, res) => {
  try {
    // const reqBody = req.body;
    const { role,role_id,designation_id,company_id} = req.user;
    const ids = {role_id,designation_id,company_id}
    const data = await getUsersService(ids,role);
    console.log('getUsers successfully');
    return sendSuccess(res, data, 'getUsers successfully');
  } catch (error) {
    console.error('error getting while fetching user', error);
  }
};

const getUsersByUserName = async (req, res) => {
  try {
    const { role,role_id,designation_id,company_id } = req.user;
    const { user_name } = req.body;
    const ids = {role_id,designation_id,company_id};
    if (!user_name) {
      console.error('Username is required');
      throw new BadRequestError('Username is required');
    }
    const data = await getUsersByUserNameService(user_name,ids, role);
    console.log('getUsers successfully');
    return sendSuccess(res, data, 'getUsers successfully');
  } catch (error) {
    console.error('error getting while fetching user', error);
  }
};

const getUserById = async (req, res) => {
  try {
    const { role,role_id,designation_id,company_id } = req.user;
     const joiValidation = VALIDATE_USER_BY_ID.validate(req.params);
        if (joiValidation.error) {
          throw new ValidationError(joiValidation.error);
        }
        const {id} = req.params;
    const ids = {role_id,designation_id,company_id,id};
    const data = await getUserByIdService(ids, role);
    console.log('get User by id successfully');
    return sendSuccess(res, data, 'getting User by id successfully');
  } catch (error) {
    console.error('error getting while getting user by id', error);
  }
};

const createUser = async (req, res) => {
  try {
    const { role } = req.user;
    // const {} = req.user;
    let payload = req.body;
    const joiValidation = CREATE_USER_SCHEMA.validate(payload);
    if (joiValidation.error) {
      throw new ValidationError(joiValidation.error);
    }
    if (!payload) {
      console.error('payload is required');
      return sendError(res, 'payload is required', 'Validation Error');
    }
    const {company_id} = req.user;
    payload.company_id=company_id;
    const data = await createUserService(payload, role);
    console.log('create user successfully');
    return sendSuccess(res, data, 'create user successfully');
  } catch (error) {
    console.error('error getting while creating user', error);
  }
};

export { getUsers, getUserById, getUsersByUserName, createUser };
