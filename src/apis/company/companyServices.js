import { BadRequestError } from '../../utils/appErrors.js';
import { beginTransaction, commit, getConnection } from '../../utils/db.js';
import { createCompanyDao, deleteCompanyDao, getCompanyDao, updateCompanyDao } from './companyDao.js';
import { createRoleDao } from "../roles/rolesDao.js";
import {createDesignationDao} from "../designation/designationDao.js"
import { createUserService } from '../users/userService.js';
import { transactionWrapper } from '../../utils/db.js';
const getCompanyService = async (id) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await getCompanyDao(id);
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

const createCompanyService = async (payload) => {
  let conn;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const result = await createCompanyDao(payload);
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
    const Designation = await createDesignationDao(DesignationPayload);
    
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
    await commit(conn);
    return result;
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};

const updateCompanyService = async (id, payload) => {
     transactionWrapper(updateCompanyDao)(id, payload);
};
const deleteCompanyService = async (id) => {
    transactionWrapper( deleteCompanyDao)(id, { is_obsolete: true });
};

export {  getCompanyService, createCompanyService, updateCompanyService, deleteCompanyService };
