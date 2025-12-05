import { logger } from '../../utils/logger.js';
import {
  getRoleDao,
  createRoleDao,
  updateRoleDao,
  deleteRoleDao,
} from './rolesDao.js';
import {
  getConnection,
  beginTransaction,
  commit,
  rollback,
} from '../../utils/db.js';

const getRoleService = async (filters) => {
  try {
    const data = await getRoleDao(filters);
    return data;
  } catch (error) {
    logger.error('Error while fetching role', error);
    throw error;
  }
};

const createRoleService = async (payload) => {
  let conn;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    
    const data = await createRoleDao(conn, payload);
    
    await commit(conn);
    return data;
  } catch (error) {
    if (conn) {
      await rollback(conn);
    }
    logger.error('Error while creating Role', error);
    throw error;
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

const updateRoleService = async (id, body) => {
  let conn;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    
    const data = await updateRoleDao(conn, id, body);
    
    await commit(conn);
    return data;
  } catch (error) {
    if (conn) {
      await rollback(conn);
    }
    logger.error('Error while updating Role', error);
    throw error;
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

const deleteRoleService = async (id, userData) => {
  try {
    const data = await deleteRoleDao(id, userData);
    return data;
  } catch (error) {
    logger.error('Error while updating Role', 'error', error);
    throw error;
  }
};

export {
  getRoleService,
  createRoleService,
  updateRoleService,
  deleteRoleService,
};
