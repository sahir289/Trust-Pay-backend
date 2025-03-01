import { BadRequestError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createUserService, getUserByIdService, getUsersByUserNameService, getUsersService } from './userService.js';
import { VALIDATE_USER_BY_ID ,CREATE_USER_SCHEMA} from '../../schemas/userSchema.js';
import { ValidationError } from '../../utils/appErrors.js';
import { transactionWrapper } from '../../utils/db.js';
const getUsers = async (req, res) => {
  try {
    // const reqBody = req.body;
    const { role,company_id} = req.user;
    const ids = {company_id}
    const data = await getUsersService(ids,role);
    console.log('getUsers successfully');
    return sendSuccess(res, data, 'getUsers successfully');
  } catch (error) {
    console.error('error getting while fetching user', error);
  }
};

const getUsersByUserName = async (req, res) => {
  try {
    const {role,company_id} = req.user;
    const {username} = req.body;
    const ids = {company_id};
    if (!username) {
      console.error('Username is required');
      throw new BadRequestError('Username is required');
    }
    const data = await getUsersByUserNameService(username,ids,role);
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
    const joiValidation = CREATE_USER_SCHEMA.validate(req.body);
    if (joiValidation.error) {
      throw new ValidationError(joiValidation.error);
    }
    const { role,company_id,user_id,role_id,designation_id } = req.user;
    console.log(role_id,designation_id,"hiii from the role id and hello from the role id i get")
    let payload = req.body;
    payload.company_id=company_id;
    payload.created_by=user_id;
    payload.updated_by=user_id;
    const data = await transactionWrapper(createUserService)(payload, role);
    console.log('create user successfully');
    return sendSuccess(res, data, 'create user successfully');
  } catch (error) {
    console.error('error getting while creating user', error);
  }
};

export { getUsers, getUserById, getUsersByUserName, createUser };
