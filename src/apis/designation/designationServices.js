import { BadRequestError } from '../../utils/appErrors.js';
import { getConnection } from '../../utils/db.js';
import { getDesignationDao, createDesignationByIdDao, updateDesignationByIdDao, deleteDesignationByIdDao } from './designationDao.js';

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

const createDesignationByIDService = async (payload) => {
  try {

    const result = await createDesignationByIdDao(payload);

    return result;
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};

const updateDesignationByIDService = async (id, payload) => {
  try {
    const result = await updateDesignationByIdDao(id, payload);
    return result;
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};

const deleteDesignationByIDService = async (id) => {
  try {
    const result = await deleteDesignationByIdDao(id, { is_obsolete: true });
    return result;
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};


export { getDesignationService, createDesignationByIDService, updateDesignationByIDService, deleteDesignationByIDService };
