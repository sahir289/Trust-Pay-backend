import { BadRequestError } from '../../utils/appErrors.js';
import { beginTransaction, commit, getConnection, rollback } from '../../utils/db.js';
import { createCompanyDao, deleteCompanyDao, getCompanyDao, updateCompanyDao } from './companyDao.js';
import { createUserService } from '../users/userService.js';
import { transactionWrapper } from '../../utils/db.js';
import { createDesignationService } from '../designation/designationServices.js';
import { createRoleDao } from '../roles/rolesDao.js';
import { columns, merchantColumns, Role, vendorColumns } from '../../constants/index.js';
import { filterResponse } from '../../helpers/index.js';
const getCompanyService = async (id, role) => {
  let conn;
  try {
    conn = await getConnection();
    const filterColumns = role === Role.MERCHANT ? merchantColumns.COMPANY : role === Role.VENDOR ? vendorColumns.COMPANY : columns.COMPANY;
    
    const result = await getCompanyDao({id});
    const finalResult = await filterResponse(result, filterColumns);
    return finalResult;
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

const createCompanyService = async (payload, roleIs) => {
  let conn;
  try {
    const filterColumns = roleIs === Role.MERCHANT ? merchantColumns.COMPANY : roleIs === Role.VENDOR ? vendorColumns.COMPANY : columns.COMPANY;

    conn = await getConnection();
    await beginTransaction(conn);
    const result = await createCompanyDao(payload);
    // const [sql, params] = buildInsertQuery(tableName.COMPANY, payload)
    // const result = await executeQuery(sql, params);
    
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
    const Designation = await createDesignationService(DesignationPayload);

    // Step 5: Create user
    const UserPayload = {
      role_id: Designation.id,
      company_id: result.id,
      designation_id: Designation.id,
      user_name: Designation.role,
      email: Designation.email,
      contact_no: result.contact_no,
      password: "12345", // Ensure you have proper hashing for the password
      first_name: Designation.first_name,
      last_name: Designation.last_name,
      code: Designation.first_name.split('').reverse().join('')
    };
    const userCreated = await createUserService(UserPayload);
    console.log(userCreated, "333");

    // Step 6: Commit the transaction
    await commit(conn);

    // Return the result if all is successful
    const finalResult = await filterResponse(result, filterColumns);
    return finalResult;
  } catch (error) {
    // Rollback transaction in case of an error
    if (conn) {
      try {
        await rollback(conn);
        console.log("Transaction rolled back due to error");
      } catch (rollbackError) {
        console.error('Error during transaction rollback', rollbackError);
      }
    }

    // Log the error and throw a new error
    console.error('Error while creating company:', error);
    throw new BadRequestError('Error occurred while creating company');
  } finally {
    // Always release the connection
    if (conn) {
      try {
        conn.release();
        console.log('Connection released');
      } catch (releaseError) {
        console.error('Error while releasing the connection', releaseError);
      }
    }
  }
};




const updateCompanyService = async (id, payload, role) => {
  const filterColumns = role === Role.MERCHANT ? merchantColumns.COMPANY : role === Role.VENDOR ? vendorColumns.COMPANY : columns.COMPANY;

  const result= transactionWrapper(updateCompanyDao)(id, payload);
  const finalResult = await filterResponse(result, filterColumns);
  return finalResult;
};
const deleteCompanyService = async (id, role) => {
  const filterColumns = role === Role.MERCHANT ? merchantColumns.COMPANY : role === Role.VENDOR ? vendorColumns.COMPANY : columns.COMPANY;

  const result= transactionWrapper(deleteCompanyDao)(id, { is_obsolete: true });
  const finalResult = await filterResponse(result, filterColumns);
  return finalResult;
};

export { getCompanyService, createCompanyService, updateCompanyService, deleteCompanyService };
