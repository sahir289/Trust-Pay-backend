import { merchantColumns, Role } from '../../constants/index.js';
import { BadRequestError } from '../../utils/appErrors.js';
import { getConnection } from '../../utils/db.js';
import { getDesignationDao, createDesignationDao, updateDesignationDao, deleteDesignationDao } from './designationDao.js';

const getDesignationService = async (search,user, role) => {
  let conn;
  try {
    const filterColumns = role === Role.MERCHANT ? merchantColumns.DESIGNATION : role === Role.VENDOR ? vendorColumns.DESIGNATION : columns.DESIGNATION;
    conn = await getConnection();
    const result = await getDesignationDao(search,user);
    const finalResult = await filterResponse(result, filterColumns);
        return finalResult;
  } catch (error) {
    console.error('error getting while Designation', error);
    throw new BadRequestError('Error getting while Designation');
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

const createDesignationService = async (payload, role) => {
  try {
    const filterColumns = role === Role.MERCHANT ? merchantColumns.DESIGNATION : role === Role.VENDOR ? vendorColumns.DESIGNATION : columns.DESIGNATION;

    const result = await createDesignationDao(payload);

    const finalResult = await filterResponse(result, filterColumns);
        return finalResult;
  } catch (error) {
    console.error('error getting while Designation', error);
    throw new BadRequestError('Error getting while Designation');
  }
};

const updateDesignationService = async (id,comapany_id,role_id, payload, role) => {
  try {
    const filterColumns = role === Role.MERCHANT ? merchantColumns.DESIGNATION : role === Role.VENDOR ? vendorColumns.DESIGNATION : columns.DESIGNATION;

    const result = await updateDesignationDao(id,comapany_id,role_id, payload);
    const finalResult = await filterResponse(result, filterColumns);
        return finalResult;
  } catch (error) {
    console.error('error getting while Designation', error);
    throw new BadRequestError('Error getting while Designation');
  }
};

const deleteDesignationService = async (id,comapany_id,role_id, role) => {
  try {
    const filterColumns = role === Role.MERCHANT ? merchantColumns.DESIGNATION : role === Role.VENDOR ? vendorColumns.DESIGNATION : columns.DESIGNATION;
    const result = await deleteDesignationDao(id,comapany_id,role_id, { is_obsolete: true });
    const finalResult = await filterResponse(result, filterColumns);
        return finalResult;
  } catch (error) {
    console.error('error getting while Designation', error);
    throw new BadRequestError('Error getting while Designation');
  }
};


export { getDesignationService, createDesignationService, updateDesignationService, deleteDesignationService };
