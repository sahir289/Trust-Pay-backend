import { tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';
export const createPayoutDao = async (conn,data) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.PAYOUT, data);
    let result;
      if (conn && conn.query) {
        result = await conn.query(sql, params);
      } else {
        result = await executeQuery(sql, params);
      }
    return result.rows[0];
  } catch (error) {
    console.error('Error in createPayoutDao:', error);
    throw new Error('Failed to create payout');
  }
};

export const getPayoutsDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  columns = [],
) => {
  try {
  const baseQuery = `SELECT ${columns.length ? columns.join(', ') : "*"} FROM "${tableName.PAYOUT}" WHERE 1=1`;
  //TODO: columns.PAYOUT dynamic search
  if (filters.search) {
              filters.or = buildSearchFilterObj(filters.search, tableName.PAYOUT);
              delete filters.search;
          }
  const [sql, queryParams] = buildSelectQuery(baseQuery, filters, page, pageSize, sortBy, sortOrder);
  // Execute query
  const result = await executeQuery(sql, queryParams);
  return result.rows;}
  catch (error) {
    console.error('Error in getpayoutDao:', error);
    throw new Error('Failed to fetch payouts');
}
};

export const updatePayoutDao = async (ids, data, conn) => {
    try {
      const [sql, params] = buildUpdateQuery(tableName.PAYOUT, data, ids);
      
      let result;
      if (conn && conn.query) {
        result = await conn.query(sql, params);
      } else {
        result = await executeQuery(sql, params);
      }
      
      return result.rows[0];
    } catch (error) {
      console.error("Error occurred while updating payout:", error);
      throw new Error("An error occurred while processing the payout update.");
    }
  };
  

export const deletePayoutDao = async (ids,data) => {
    try {
      const [sql, params] = buildUpdateQuery(tableName.PAYOUT, data, ids);
      const result = await executeQuery(sql, params);
      return result.rows[0];
    } catch (error) {
      console.error("Error occurred while deleting payout:", error);
      throw new Error("An error occurred while processing the payout deletion.");
    }
  };
  