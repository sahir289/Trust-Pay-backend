import { BadRequestError } from '../../utils/appErrors.js';
import { getConnection } from '../../utils/db.js';
import { createCompanyByIdDao, deleteCompanyByIdDao, getCompanyByIdDao, updateCompanyByIdDao } from './companyDao.js';





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

    const result = await createCompanyByIdDao(payload);

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
