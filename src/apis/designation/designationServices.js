import { logger } from '../../utils/logger.js';
import {
  getDesignationDao,
  createDesignationDao,
  updateDesignationDao,
  deleteDesignationDao,
} from './designationDao.js';
import {
  getConnection,
  beginTransaction,
  commit,
  rollback,
} from '../../utils/db.js';

const getDesignationService = async (user, page, limit) => {
  try {
    const result = await getDesignationDao(user, page, limit);
    return result;
  } catch (error) {
    logger.error('error getting while Designation', error);
    throw error;
  }
};

const createDesignationService = async (payload) => {
  let conn;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    
    const result = await createDesignationDao(conn, payload);
    
    await commit(conn);
    return result;
  } catch (error) {
    if (conn) {
      await rollback(conn);
    }
    logger.error('error getting while Designation', error);
    throw error;
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

const updateDesignationService = async (id, payload) => {
  try {
    const result = await updateDesignationDao(id, payload);
    return result;
  } catch (error) {
    logger.error('error getting while Designation', error);
    throw error;
  }
};

const deleteDesignationService = async (id) => {
  try {
    const result = await deleteDesignationDao(id, {
      is_obsolete: true,
    });
    return result;
  } catch (error) {
    logger.error('error getting while Designation', error);
    throw error;
  }
};

export {
  getDesignationService,
  createDesignationService,
  updateDesignationService,
  deleteDesignationService,
};
