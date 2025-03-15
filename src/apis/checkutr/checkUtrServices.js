import { BadRequestError } from '../../utils/appErrors.js';
import {
  createCheckUtrDao,
  deleteCheckUtrDao,
  getCheckUtrDao,
  updateCheckUtrDao,
} from './checkUtrDao.js';

const getCheckUtrService = async (id, page, limit) => {
  const result = await getCheckUtrDao( id, page,limit, null,null, null );
  return result;
};
const createCheckUtrService = async (payload) => {
  try {
    const result = await createCheckUtrDao(payload);

    return result;
  } catch (error) {
    console.error('error getting while check utr', error);
    // throw new BadRequestError('Error getting while check utr');
  }
};

const updateCheckUtrService = async (id, payload) => {
  try {
    const result = await updateCheckUtrDao(id, payload);
    return result;
  } catch (error) {
    console.error('error getting while check utr', error);
    throw new BadRequestError('Error getting while check utr');
  }
};
const deleteCheckUtrService = async (id) => {
  try {
    const result = await deleteCheckUtrDao(id, { is_obsolete: true });
    return result;
  } catch (error) {
    console.error('error getting while check utr', error);
    throw new BadRequestError('Error getting while check utr');
  }
};

export {
  getCheckUtrService,
  createCheckUtrService,
  updateCheckUtrService,
  deleteCheckUtrService,
};
