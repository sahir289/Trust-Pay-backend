import { BadRequestError, InternalServerError } from '../../utils/appErrors.js';
import { logger } from '../../utils/logger.js';
import {
  createCheckUtrDao,
  deleteCheckUtrDao,
  getCheckUtrBySearchDao,
  getCheckUtrDao,
  updateCheckUtrDao,
} from './checkUtrDao.js';

const getCheckUtrService = async (id, page, limit) => {
  try {
    const result = await getCheckUtrDao(id, page, limit, null, null, null);
    return result;
  } catch (error) {
    logger.error('error getting while check utr', error);
    throw new InternalServerError(error);
  }
};

const getCheckUtrBySearchService = async (company_id, search, page, limit) => {
  try {
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const sortBy = 'sno';
    const sortOrder = 'DESC';
    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
      throw new BadRequestError('Invalid pagination parameters');
    }
    return await getCheckUtrBySearchDao(company_id, pageNum, limitNum, sortBy, sortOrder);
  } catch (error) {
    logger.error('error getting while getting check utr by search', error);
    throw new InternalServerError(error);
  }
};

const createCheckUtrService = async (payload) => {
  try {
    const result = await createCheckUtrDao(payload);
    return result;
  } catch (error) {
    console.error('error getting while check utr', error);
    throw new InternalServerError(error);
  }
};

const updateCheckUtrService = async (id, payload) => {
  try {
    const result = await updateCheckUtrDao(id, payload);
    return result;
  } catch (error) {
    console.error('error getting while check utr', error);
    throw new InternalServerError(error);
  }
};
const deleteCheckUtrService = async (id) => {
  try {
    const result = await deleteCheckUtrDao(id, { is_obsolete: true });
    return result;
  } catch (error) {
    console.error('error getting while check utr', error);
    throw new InternalServerError('Error getting while check utr');
  }
};

export {
  getCheckUtrService,
  getCheckUtrBySearchService,
  createCheckUtrService,
  updateCheckUtrService,
  deleteCheckUtrService,
};
