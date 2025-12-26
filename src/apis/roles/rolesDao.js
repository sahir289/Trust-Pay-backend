import {
  buildInsertQuery,
  buildSelectQuery,
  executeQuery,
  buildUpdateQuery,
} from '../../utils/db.js';
import { tableName, columns } from '../../constants/index.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';
import { logger } from '../../utils/logger.js';

const getRoleDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  Columns = columns.ROLE,
  conn = null
) => {
  try {
    const baseQuery = `SELECT ${Columns.length ? Columns.join(', ') : '*'} FROM "${tableName.ROLE}" WHERE 1=1`;
    if (filters.search) {
      filters.or = buildSearchFilterObj(filters.search, tableName.ROLE);
      delete filters.search;
    }
    //TODO: columns.ROLE dynamic search
    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
    );
    // Execute query
    const result = await executeQuery(sql, queryParams, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error in getRolesDao:', error);
    throw error;
  }
};

const createRoleDao = async (data, conn = null) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.ROLE, data);
    const result = await executeQuery(sql, params, conn);
    return result.rows[0];
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

const updateRoleDao = async (id, data, conn = null) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.ROLE, data, id);
    const result = await executeQuery(sql, params, conn);
    return result.rows[0];
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

const deleteRoleDao = async (id, data, conn = null) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.ROLE, data, id);
    const result = await executeQuery(sql, params, conn);
    return result.rows[0];
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

const getRolesById = async (id, conn = null) => {
  try {
    const sql = `SELECT * FROM "${tableName.ROLE}" WHERE id = $1`;
    const params = [id];
    const result = await executeQuery(sql, params, conn);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in getRolesById:', error);
    throw error;
  }
};

export { getRoleDao, createRoleDao, updateRoleDao, deleteRoleDao, getRolesById };
