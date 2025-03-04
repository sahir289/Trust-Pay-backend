import { tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';
export const createUserHierarchyDao = async (data, conn) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.USER_HIERARCHY, data);
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error in createUserHierarchyDao:', error);
    throw new Error('Failed to create user hierarchy');
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
};

export const updateUserHierarchyDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.USER_HIERARCHY, data, id);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error in updateUserHierarchyDao:', error);
    throw new Error('Failed to update user hierarchy');
  }
};

export const deleteUserHierarchyDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.USER_HIERARCHY, data, id);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error in deleteUserHierarchyDao:', error);
    throw new Error('Failed to delete user hierarchy');
  }
};
