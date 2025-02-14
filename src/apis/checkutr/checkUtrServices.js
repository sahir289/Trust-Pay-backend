import { BadRequestError } from '../../utils/appErrors.js';
import { getConnection } from '../../utils/db.js';
import { createCheckUtrDao, deleteCheckUtrDao, getCheckUtrDao, updateCheckUtrDao } from './checkUtrDao.js';





const getCheckUtrService = async (id) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await getCheckUtrDao(id);
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
const createCheckUtrService = async (payload) => {
  try {

    const result = await createCheckUtrDao(payload);

    return result;
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};

const updateCheckUtrService = async (id, payload) => {
  try {
    const result = await updateCheckUtrDao(id, payload);
    return result;
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};
const deleteCheckUtrService = async (id) => {


  try {
    const result = await deleteCheckUtrDao(id, { is_obsolete: true });
    return result;
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};



export {  getCheckUtrService, createCheckUtrService, updateCheckUtrService, deleteCheckUtrService };
