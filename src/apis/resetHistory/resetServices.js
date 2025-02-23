import { BadRequestError } from '../../utils/appErrors.js';
import { createResetHistoryDao, deleteResetHistoryDao, getResetHistoryDao, updateResetHistoryDao } from './ResetHistoryDao.js';





const getResetHistoryService = async (id) => {
  try {
    const result = await getResetHistoryDao(id);
    return result;
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};
const createResetHistoryService = async (payload) => {
  try {

    const result = await createResetHistoryDao(payload);

    return result;
  } catch (error) {
    console.error('error getting while logging in', error);
    // throw new BadRequestError('Error getting while logging in');
  }
};

const updateResetHistoryService = async (id, payload) => {
  try {
    const result = await updateResetHistoryDao(id, payload);
    return result;
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};
const deleteResetHistoryService = async (id) => {


  try {
    const result = await deleteResetHistoryDao(id, { is_obsolete: true });
    return result;
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};



export { getResetHistoryService, createResetHistoryService, updateResetHistoryService, deleteResetHistoryService };
