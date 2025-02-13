import { BadRequestError } from '../../utils/appErrors.js';
import { getConnection } from '../../utils/db.js';
import { createCompanyByIdDao, deleteCompanyByIdDao, getCompanyByIdDao, updateCompanyByIdDao } from './companyDao.js';
import { createRoleDao } from "../roles/rolesDao.js";
import {createDesignationByIdDao} from "../designation/designationDao.js"

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
    console.log(payload,"payload from company")
    const result = await createCompanyByIdDao(payload);
    console.log(result,"Company");
    const company_id=result.id;
    const name=result.first_name;
    const Roles = ["ADMIN","VENDOR","MERCHANT"];
    for (const role of Roles) {
      const rolePayload = {
        "role": role,
        "company_id": company_id,
        "created_by": name
      };
    const createdRole = await createRoleDao(rolePayload);
    const role_id = createdRole.id;
    const designation=createdRole.role;
    const DesignationPayload = {
      "role_id": role_id,
      "company_id": company_id,
      "created_by":name,
      "designation":designation
    }
    const Designation = await createDesignationByIdDao(DesignationPayload);
    console.log(Designation,"Designation")}
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
