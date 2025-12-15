import { tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';
export const createUserHierarchyDao = async (data, conn = null) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.USER_HIERARCHY, data);
    const result = conn ? await conn.query(sql, params) : await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in create UserHierarchy Dao:', error);
    throw error;
  }
};
export const getUserHierarchysDashBoardReportDao = async (filters = {}) => {
  try {
    const selectColumns = `
      config
    `;
    const [sql, params] = buildSelectQuery(
      `SELECT ${selectColumns} FROM "${tableName.USER_HIERARCHY}" WHERE 1=1`,
      filters,
    );
    const result = await executeQuery(sql, params);
    return result.rows || [];
  } catch (error) {
    logger.error('Error getting user hierarchies data:', error);
    throw error;
  }
};
export const getUserHierarchysDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  columns = [],
) => {
  try {
    const baseQuery = `SELECT ${columns.length ? columns.join(', ') : '*'} FROM "${tableName.USER_HIERARCHY}" WHERE 1=1`;
    //TODO: columns.USER_HEIRARCHY dynamic search
    if (filters.search) {
      filters.or = buildSearchFilterObj(filters.search, tableName.MERCHANT);
      delete filters.search;
    }
    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
    );
    // Execute query
    const result = await executeQuery(sql, queryParams);
    return result.rows;
  } catch (error) {
    logger.error('Error in get UserHierarchy Dao:', error);
    throw error;
  }
};

export const updateUserHierarchyDao = async (id, data, conn = null) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.USER_HIERARCHY, data, id);
    const result = conn ? await conn.query(sql, params) : await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in updateUserHierarchyDao:', error);
    throw error;
  }
};

export const deleteUserHierarchyDao = async (id, data, conn = null) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.USER_HIERARCHY, data, id);
    const result = conn ? await conn.query(sql, params) : await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in deleteUserHierarchyDao:', error);
    throw error;
  }
};

export const getUserHierarchyVendor = async (userId) => {
  try {
    const sql = `SELECT config FROM "${tableName.USER_HIERARCHY}" WHERE user_id = $1 LIMIT 1;`;
    const { rows } = await executeQuery(sql, [userId]);
    return rows[0]?.config || {};
  } catch (error) {
    logger.error('Error in deleteUserHierarchyDao:', error);
    throw error;
  }
};

export const updateUserHierarchyVendor = async (userId, newConfig, updatedBy) => {
  try {
    const sql = `UPDATE "${tableName.USER_HIERARCHY}"
               SET config = $1, updated_by = $2
               WHERE user_id = $3
               RETURNING *;`;
    const { rows } = await executeQuery(sql, [newConfig, updatedBy, userId]);
    return rows[0];
  } catch (error) {
    logger.error('Error in deleteUserHierarchyDao:', error);
    throw error;
  }
};