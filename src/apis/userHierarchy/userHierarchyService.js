import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
import {
  createUserHierarchyDao,
  deleteUserHierarchyDao,
  getUserHierarchysDao,
  updateUserHierarchyDao,
} from './userHierarchyDao.js';
import { columns, merchantColumns, Role } from '../../constants/index.js';
import { filterResponse } from '../../helpers/index.js';
import { logger } from '../../utils/logger.js';
const _createUserHierarchyServiceInternal = async (payload, role, conn) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.USER_HIERARCHY
        : columns.USER_HIERARCHY;
    const data = await createUserHierarchyDao(payload, conn);
    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    logger.error('error in _createUserHierarchyServiceInternal', error);
    throw error;
  }
};

const createUserHierarchyService = async (payload, role) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const finalResult = await _createUserHierarchyServiceInternal(
      payload,
      role,
      conn,
    );
    await commit(conn);
    committed = true;
    return finalResult;
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn); // Rollback the transaction in case of error
    }
    logger.error('Error while creating UserHierarchy', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

const getUserHierarchyService = async (filters, role, page, limit) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.USER_HIERARCHY
        : columns.USER_HIERARCHY;
    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;
    return await getUserHierarchysDao(
      filters,
      pageNumber,
      pageSize,
      null,
      null,
      filterColumns,
    );
  } catch (error) {
    logger.error('Error while fetching UserHierarchys', error);
    throw error;
  }
};

const _updateUserHierarchyServiceInternal = async (id, payload, role, conn) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.USER_HIERARCHY
        : columns.USER_HIERARCHY;
    const data = await updateUserHierarchyDao(id, payload, conn);
    const finalResult = await filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    logger.error('error in _updateUserHierarchyServiceInternal', error);
    throw error;
  }
};

const updateUserHierarchyService = async (id, payload, role) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const finalResult = await _updateUserHierarchyServiceInternal(
      id,
      payload,
      role,
      conn,
    );
    await commit(conn);
    committed = true;
    return finalResult;
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn); // Rollback the transaction in case of error
    }
    logger.error('Error while updating UserHierarchy', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

const _deleteUserHierarchyServiceInternal = async (
  ids,
  updated_by,
  role,
  conn,
) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.USER_HIERARCHY
        : columns.USER_HIERARCHY;
    const payload = { is_obsolete: true, updated_by };
    const data = await deleteUserHierarchyDao(ids, payload, conn);
    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    logger.error('error in _deleteUserHierarchyServiceInternal', error);
    throw error;
  }
};

const deleteUserHierarchyService = async (ids, updated_by, role) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const finalResult = await _deleteUserHierarchyServiceInternal(
      ids,
      updated_by,
      role,
      conn,
    );
    await commit(conn);
    committed = true;
    return finalResult;
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn); // Rollback the transaction in case of error
    }
    logger.error('Error while deleting UserHierarchy', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

export {
  createUserHierarchyService,
  getUserHierarchyService,
  updateUserHierarchyService,
  deleteUserHierarchyService,
};
