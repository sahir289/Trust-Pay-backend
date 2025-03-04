import { tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildJoinQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';

// Create ChargeBack entry
export const createChargeBackDao = async (data) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.CHARGE_BACK, data);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating ChargeBack entry:', error);
    throw new Error('Error creating ChargeBack entry');
  }
};

// Get ChargeBack entries with pagination, sorting, and filtering
export const getChargeBackDao = async (
   filters,
       page,
       pageSize,
       sortBy,
       sortOrder,
       // columns to select from db (optional)
       columns = [],
   ) => {
       try {
           const { VENDOR, CHARGE_BACK, MERCHANT } = tableName;
   
           const joins = [
               {
                   table: VENDOR,
                   // first is source key
                   // second is target key
                   keys: ['vendor_user_id', 'user_id'],
                   type: "JOIN",
                   columns: ["code"],
                   columnAs: [`"${VENDOR}".code AS vendor_name`],
               },
               {
                   table: MERCHANT,
                   // first is source key
                   // second is target key
                   keys: [`merchant_user_id`, 'user_id'],
                   type: "LEFT JOIN",
                   columns: ["code"],
                   columnAs: [`"${MERCHANT}".code AS merchant_name`],
               }
           ]
   
           const baseQuery = buildJoinQuery(CHARGE_BACK, columns.length ? columns : "*", joins);
           if (filters.search) {
               filters.or = buildSearchFilterObj(filters.search, CHARGE_BACK);
               delete filters.search;
           }
           // console.log(JSON.stringify(filters, undefined, 4));
           const [sql, queryParams] = buildSelectQuery(baseQuery, filters, page, pageSize, sortBy, sortOrder, tableName.CHARGE_BACK);
           // Execute query
           const result = await executeQuery(sql, queryParams);
           return result.rows;
       } catch (error) {
        console.error("Error fetching ChargeBack entries:", error);
        throw new Error("Error fetching ChargeBack entries");
       }
};

// Update ChargeBack entry
export const updateChargeBackDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.CHARGE_BACK, data, id);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error updating ChargeBack entry:', error);
    throw new Error('Error updating ChargeBack entry');
  }
};

// Delete ChargeBack entry
export const deleteChargeBackDao = async (id, company_id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.CHARGE_BACK, data, id);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error deleting ChargeBack entry:', error);
    throw new Error('Error deleting ChargeBack entry');
  }
};
