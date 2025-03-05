import { tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildJoinQuery,
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
       // columns to select from db (optional)
       columns = [],
   ) => {
       try {
   
           const { USER, VENDOR, DESIGNATION } = tableName;
   
           const joins = [
               {
                   table: USER,
                   // first is source key
                   // second is target key
                   keys: ['user_id', 'id'],
                   type: "JOIN",
                   columns: ["designation_id"],
                   columnAs: [`"${USER}".first_name || ' ' || "${USER}".last_name AS full_name`],
               },
               {
                   table: DESIGNATION,
                   // first is source key
                   // second is target key
                   keys: [`designation_id`, 'id'],
                   type: "LEFT JOIN",
                   columnAs: [`"${DESIGNATION}".designation AS designation_name`],
                   referenceTable: USER,
               }
           ]
   
           const baseQuery = buildJoinQuery(VENDOR, columns.length ? columns : "*", joins);
           console.log(baseQuery);
           if (filters.search) {
               filters.or = buildSearchFilterObj(filters.search, VENDOR);
               delete filters.search;
           }
           // console.log(JSON.stringify(filters, undefined, 4));
           const [sql, queryParams] = buildSelectQuery(baseQuery, filters, page, pageSize, sortBy, sortOrder, tableName.VENDOR);
           // Execute query
           const result = await executeQuery(sql, queryParams);
           return result.rows;
       } catch (error) {
        console.error('Error in getVendorsDao:', error);
        throw error.message;
      }
   }
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
