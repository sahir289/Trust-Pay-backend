import { BadRequestError } from '../../utils/appErrors.js';
import {
  createResetHistoryDao,
  deleteResetHistoryDao,
  getResetHistoryDao,
  updateResetHistoryDao,
} from './resetDao.js';

const getResetHistoryService = async (id) => {
  try {
    const result = await getResetHistoryDao(id);
    return result;
  } catch (error) {
    console.error('error getting while reset history', error);
    throw new BadRequestError('Error getting while reset history');
  }
};
const createResetHistoryService = async (payload) => {
  try {
    const result = await createResetHistoryDao(payload);

    return result;
  } catch (error) {
    console.error('error getting while reset history', error);
    // throw new BadRequestError('Error getting while reset history');
  }
};

const updateResetHistoryService = async (id, payload) => {
  try {
    const result = await updateResetHistoryDao(id, payload);
    return result;
  } catch (error) {
    console.error('error getting while reset history', error);
    throw new BadRequestError('Error getting while reset history');
  }
};
const deleteResetHistoryService = async (id) => {
  try {
    const result = await deleteResetHistoryDao(id, { is_obsolete: true });
    return result;
  } catch (error) {
    console.error('error getting while reset history', error);
    throw new BadRequestError('Error getting while reset history');
  }
};

export {
  getResetHistoryService,
  createResetHistoryService,
  updateResetHistoryService,
  deleteResetHistoryService,
};
