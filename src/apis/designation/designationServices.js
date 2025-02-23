import { merchantColumns, Role } from '../../constants/index.js';
import { BadRequestError } from '../../utils/appErrors.js';
import { getConnection } from '../../utils/db.js';
import { getDesignationDao, createDesignationDao, updateDesignationDao, deleteDesignationDao } from './designationDao.js';

const getDesignationService = async (payload, role) => {
  let conn;
  try {
    const filterColumns = role === Role.MERCHANT ? merchantColumns.DESIGNATION : role === Role.VENDOR ? vendorColumns.DESIGNATION : columns.DESIGNATION;
    conn = await getConnection();
    const result = await getDesignationDao(payload);
    return result;
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
    
    const result = await createDesignationDao(payload);

    return result;
  } catch (error) {
    console.error('error getting while Designation', error);
    throw new BadRequestError('Error getting while Designation');
  }
};

const updateDesignationService = async (id, payload, role) => {
  try {
    const result = await updateDesignationDao(id, payload);
    return result;
  } catch (error) {
    console.error('error getting while Designation', error);
    throw new BadRequestError('Error getting while Designation');
  }
};

const deleteDesignationService = async (id, role) => {
  try {
    const result = await deleteDesignationDao(id, { is_obsolete: true });
    return result;
  } catch (error) {
    console.error('error getting while Designation', error);
    throw new BadRequestError('Error getting while Designation');
  }
};


export { getDesignationService, createDesignationService, updateDesignationService, deleteDesignationService };
