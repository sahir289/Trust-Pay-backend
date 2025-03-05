import { tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';

export const createVendorDao = async (data, conn) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.VENDOR, data);
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error in create Vendor Dao:', error);
    throw error.message;
  }
};

export const getVendorsDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  columns = [],
) => {
  try {
    const baseQuery = `SELECT ${columns.length ? columns.join(', ') : '*'} FROM "${tableName.VENDOR}" WHERE 1=1`;

    // Execute query
    if (filters.search) {
      filters.or = buildSearchFilterObj(filters.search, tableName.VENDOR);
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
    console.error('Error in getVendorsDao:', error);
    throw error.message;
  }
};

export const updateVendorDao = async (id, data, conn) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.VENDOR, data, id);
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error in updateVendorDao:', error);
    throw error.message;
  }
};

export const deleteVendorDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.VENDOR, data, id);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error in deleteVendorDao:', error);
    throw error.message;
  }
};

export const updateVendorBalanceDao = async (filters, valueToAdd, updated_by, conn) => {
  try {
    const [sql, params] = buildUpdateQuery(
      tableName.VENDOR,
      { balance: valueToAdd, updated_by },
      filters,
      { balance: '+' },
    );
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result[0];
  } catch (error) {
    console.error('Error in updateVendorBalanceDao:', error);
    throw error.message;
  }
};
