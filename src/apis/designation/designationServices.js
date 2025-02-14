import { BadRequestError } from '../../utils/appErrors.js';
import { getConnection } from '../../utils/db.js';

import { getDesignationDao, createDesignationDao, updateDesignationDao, deleteDesignationDao } from './designationDao.js';


const getDesignationService = async (payload) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await getDesignationDao(payload);
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

const createDesignationService = async (payload) => {
  try {

    const result = await createDesignationDao(payload);

    return result;
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};

const updateDesignationService = async (id, payload) => {
  try {
    const result = await updateDesignationDao(id, payload);
    return result;
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};

const deleteDesignationService = async (id) => {
  try {
    const result = await deleteDesignationDao(id, { is_obsolete: true });
    return result;
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};



export { getDesignationService, createDesignationService, updateDesignationService, deleteDesignationService };

