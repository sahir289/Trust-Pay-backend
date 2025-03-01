import { BadRequestError } from '../../utils/appErrors.js';
import { createCompanyDao, deleteCompanyDao, getCompanyDao, updateCompanyDao } from './companyDao.js';
import { createUserService } from '../users/userService.js';
import { createDesignationService } from '../designation/designationServices.js';
import { createRoleDao } from '../roles/rolesDao.js';
const getCompanyService = async (id) => {

  try {
    const result = await getCompanyDao(id);
    return result;
  } catch (error) {
    console.error('error getting while company', error);
    throw new BadRequestError('Error getting while company');
  } 
};

const createCompanyService = async (conn, payload) => {
  try {
    const result = await createCompanyDao(conn, payload);
    const roleName = {
      role: "Admin",
      company_id: result.id,
      created_by: result.id
    };
    const role = await createRoleDao(conn, roleName);
    const DesignationPayload = {
      role_id: role.id,
      company_id: result.id,
      designation: role.role
    };
    const Designation = await createDesignationService(conn, DesignationPayload);
    const UserPayload = {
      role_id: Designation.id,
      company_id: result.id,
      designation_id: Designation.id,
      user_name: payload.first_name,
      email: payload.email,
      contact_no: result.contact_no,
      password: "12345", 
      first_name: payload.first_name,
      last_name: payload.last_name,
      code: payload.first_name.split('').reverse().join('')
    };
    console.log(DesignationPayload, UserPayload, "dghfhgh")
    // const userCreated = 
    await createUserService(conn, UserPayload);
    return result;
  } catch (error) {
    // Rollback transaction in case of an error
    console.error('Error while creating company:', error);
    throw new BadRequestError('Error occurred while creating company');
  } 
};

const updateCompanyService = async (id, payload) => {
  const result= updateCompanyDao(id, payload);
  return result;
};
const deleteCompanyService = async (id) => {
  const result= deleteCompanyDao(id, { is_obsolete: true }); 
  return result;
};

export { getCompanyService, createCompanyService, updateCompanyService, deleteCompanyService };
