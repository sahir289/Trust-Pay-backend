import { BadRequestError } from '../../utils/appErrors.js';
import { getConnection } from '../../utils/db.js';
import { createSettlementByIdDao, deleteSettlementByIdDao, getSettlementByIdDao, updateSettlementByIdDao } from './settlementDao.js';





const getSettlementByIDService = async (id) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await getSettlementByIdDao(id);
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
const createSettlementByIDService = async (payload) => {
  try {

    const result = await createSettlementByIdDao(payload);

    return result;
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};

const updateSettlementByIDService = async (id, payload) => {
  try {
    const result = await updateSettlementByIdDao(id, payload);
    return result;
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};
const deleteSettlementByIDService = async (id) => {


  try {
    const result = await deleteSettlementByIdDao(id, { is_obsolete: true });
    return result;
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};



export {  getSettlementByIDService, createSettlementByIDService, updateSettlementByIDService, deleteSettlementByIDService };
