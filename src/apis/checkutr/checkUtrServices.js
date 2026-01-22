import { BadRequestError, InternalServerError } from '../../utils/appErrors.js';
import { logger } from '../../utils/logger.js';
import {
  getConnection,
  beginTransaction,
  commit,
  rollback,
} from '../../utils/db.js';
// import { notifyAdminsAndUsers } from '../../utils/notifyUsers.js';
import {
  createCheckUtrDao,
  deleteCheckUtrDao,
  getCheckUtrBySearchDao,
  getCheckUtrDao,
  updateCheckUtrDao,
} from './checkUtrDao.js';

const getCheckUtrService = async (filters, page, limit, sortOrder) => {
  try {
    const result = await getCheckUtrDao(
      filters,
      page,
      limit,
      'sno',
      sortOrder,
      null,
    );
    return result;
  } catch (error) {
    logger.error('error getting while check utr', error);
    throw error;
  }
};

const getCheckUtrBySearchService = async (company_id, search, page, limit) => {
  try {
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
      throw new BadRequestError('Invalid pagination parameters');
    }

    let searchTerms = [];
    if (search || typeof search !== 'undefined') {
     searchTerms = search
      .split(',')
      .map((term) => term.trim())
      .filter((term) => term.length > 0);
    }

    // if (searchTerms.length === 0) {
    //   throw new BadRequestError('Please provide valid search items');
    // }
    const offset = (pageNum - 1) * limitNum;
    return await getCheckUtrBySearchDao(
      company_id,
      searchTerms,
      limitNum,
      offset,
    );
  } catch (error) {
    logger.error('error getting while getting check utr by search', error);
    throw error;
  }
};

const _createCheckUtrServiceInternal = async (payload, conn) => {
  try {
    const result = await createCheckUtrDao(payload, conn);
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: payload.company_id,
    //   message: `Check UTR has been performed for merchant order ID: ${merchant_order_id} with UTR: ${utr}`,
    //   payloadUserId: payload.updated_by,
    //   actorUserId: payload.updated_by,
    //   category: 'Data Entries',
    // });
    return result;
  } catch (error) {
    logger.error('error in _createCheckUtrServiceInternal', error);
    throw error;
  }
};

const createCheckUtrService = async (payload) => {
  let conn; let committed = false; ;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const result = await _createCheckUtrServiceInternal(payload, conn);
    await commit(conn); committed = true;
    return result;
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn);
    }
    logger.error('error getting while check utr', error);
    throw error;
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

const updateCheckUtrService = async (id, payload) => {
  try {
    const result = await updateCheckUtrDao(id, payload);
    return result;
  } catch (error) {
    logger.error('error getting while check utr', error);
    throw error;
  }
};
const deleteCheckUtrService = async (id) => {
  try {
    const result = await deleteCheckUtrDao(id, { is_obsolete: true });
    return result;
  } catch (error) {
    logger.error('error getting while check utr', error);
    throw new InternalServerError('Error getting while check utr');
  }
};

export {
  getCheckUtrService,
  getCheckUtrBySearchService,
  _createCheckUtrServiceInternal,
  createCheckUtrService,
  updateCheckUtrService,
  deleteCheckUtrService,
};
