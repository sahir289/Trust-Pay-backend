import { columns, tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';

const getDesignationDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  Columns = columns.DESIGNATION,
) => {
  try {
    const baseQuery = `SELECT ${Columns.length ? Columns.join(', ') : '*'} FROM "${tableName.DESIGNATION}" WHERE 1=1`;
    if (filters.search) {
      filters.or = buildSearchFilterObj(filters.search, tableName.DESIGNATION);
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
    const result = await executeQuery(sql, queryParams);
    return result.rows;
  } catch (error) {
    console.error('Error in getDesignationDao:', error);
    throw new Error('Database query failed');
  }
};

const createDesignationDao = async (conn, payload) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.DESIGNATION, payload);
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error in createDesignationDao:', error);
    throw new Error('Failed to create designation');
  }
};

const updateDesignationDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.DESIGNATION, data, id);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error in updateDesignationDao:', error);
    throw new Error('Failed to update designation');
  }
};

const deleteDesignationDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.DESIGNATION, data, id);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error in deleteDesignationDao:', error);
    throw new Error('Failed to delete designation');
  }
};

export {
  getDesignationDao,
  createDesignationDao,
  updateDesignationDao,
  deleteDesignationDao,
};
