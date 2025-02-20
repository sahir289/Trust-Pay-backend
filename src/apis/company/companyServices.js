import { BadRequestError } from '../../utils/appErrors.js';
import { getConnection } from '../../utils/db.js';
import { createCompanyDao, deleteCompanyDao, getCompanyDao, updateCompanyDao } from './companyDao.js';
import { createUserService } from '../users/userService.js';
import { transactionWrapper } from '../../utils/db.js';
import { createRoleService } from '../roles/rolesService.js';
import { createDesignationService } from '../designation/designationServices.js';
const getCompanyService = async (id) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await getCompanyDao(id);
    return result;
  } catch (error) {
    console.error('error getting while company', error);
    throw new BadRequestError('Error getting while company');
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
  try {
    const result = await createCompanyDao(payload);
    const roleName = {
      "role": "Userrerr",
      "company_id": result.id,
      "created_by":result.id
    };
    const role = await createRoleService(roleName)
    console.log(role,"role from roleName");
    const DesignationPayload = {
      "role_id": role.id,
      "company_id": result.id,
      "designation":role.role
    }
    const Designation = await createDesignationService(DesignationPayload);
    console.log(Designation,"designation from designation")
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
    console.error('error getting while company', error);
    throw new BadRequestError('Error getting while company');
  }
};

const updateCompanyService = async (id, payload) => {
     transactionWrapper(updateCompanyDao)(id, payload);
};
const deleteCompanyService = async (id) => {
    transactionWrapper( deleteCompanyDao)(id, { is_obsolete: true });
};

export {  getCompanyService, createCompanyService, updateCompanyService, deleteCompanyService };
