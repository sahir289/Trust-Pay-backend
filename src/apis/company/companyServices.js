import { BadRequestError } from '../../utils/appErrors.js';
import { getConnection } from '../../utils/db.js';
import { createCompanyByIdDao, deleteCompanyByIdDao, getCompanyByIdDao, updateCompanyByIdDao } from './companyDao.js';
import { createRoleDao } from "../roles/rolesDao.js";
import {createDesignationByIdDao} from "../designation/designationDao.js"
import { createUserService } from '../users/userService.js';

const getCompanyByIDService = async (id) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await getCompanyByIdDao(id);
    return result;
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        console.error('Error while releasing the connection', releaseError);
      }
    }
  }
};

const createCompanyByIDService = async (payload) => {
  try {
    const result = await createCompanyByIdDao(payload);
    const roleName = {
      "role": "Admin",
      "company_id": result.id,
      "created_by":result.id
    };
    const role = await createRoleDao(roleName)
    const DesignationPayload = {
      "role_id": role.id,
      "company_id": result.id,
      "designation":role.role
    }
    const Designation = await createDesignationByIdDao(DesignationPayload);
    const UserPayload = {
     "role_id":role.id,
     "company_id": result.id,
     "designation_id": Designation.id,
     "user_name": role.role,
     "email":result.email,
     "contact_no":result.contact_no,
     "password":"12345",
     "first_name":result.first_name,
     "last_name":result.last_name,
     "code":result.first_name.split('').reverse().join('')
    }
    await createUserService(UserPayload);
    return result;
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};

const updateCompanyByIDService = async (id, payload) => {
  try {
    const result = await updateCompanyByIdDao(id, payload);
    return result;
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};
const deleteCompanyByIDService = async (id) => {


  try {
    const result = await deleteCompanyByIdDao(id, { is_obsolete: true });
    return result;
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};



export {  getCompanyByIDService, createCompanyByIDService, updateCompanyByIDService, deleteCompanyByIDService };
