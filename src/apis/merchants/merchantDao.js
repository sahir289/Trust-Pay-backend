import { tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildJoinQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';

export const createMerchantDao = async (data, conn) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.MERCHANT, data);
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error in createMerchantDao:', error);
    throw error.message;
  }
};

export const getMerchantsCodeDao = async (conn,
company_id ) => {
  try {
    const baseQuery = `SELECT code,user_id FROM "${tableName.MERCHANT}" WHERE company_id = $1`;
    const queryParams = [company_id];
    const result = await conn.query(baseQuery, queryParams);
    return result.rows;
  } catch (error) {
    console.error('Error fetching company:', error);
    throw error.message;
  }
};


export const getMerchantsDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  // columns to select from db (optional)
  columns = [],
) => {
  try {
    const { USER, MERCHANT, DESIGNATION } = tableName;

    const joins = [
      {
        table: USER,
        // first is source key
        // second is target key
        keys: ['user_id', 'id'],
        type: 'JOIN',
        columns: ['designation_id'],
        columnAs: [
          `"${USER}".first_name || ' ' || "${USER}".last_name AS full_name`,
        ],
      },
      {
        table: DESIGNATION,
        // first is source key
        // second is target key
        keys: [`designation_id`, 'id'],
        type: 'LEFT JOIN',
        columnAs: [`"${DESIGNATION}".designation AS designation_name`],
        referenceTable: USER,
      },
    ];

    const baseQuery = buildJoinQuery(
      MERCHANT,
      columns.length ? columns : '*',
      joins,
    );

    if (filters.search) {
      filters.or = buildSearchFilterObj(filters.search, MERCHANT);
      delete filters.search;
    }
    // console.log(JSON.stringify(filters, undefined, 4));
    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
      tableName.MERCHANT,
    );
    // Execute query
    const result = await executeQuery(sql, queryParams);
    return result.rows;
  } catch (error) {
    console.error('Error in getMerchantsDao:', error);
    throw error.message;
  }
};

export const updateMerchantDao = async (ids, data, conn) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.MERCHANT, data, ids);
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error in updateMerchantDao:', error);
    throw error.message;
  }
};

export const deleteMerchantDao = async (ids, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.MERCHANT, data, ids);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error in deleteMerchantDao:', error);
    throw error.message;
  }
};

export const updateMerchantBalanceDao = async (
  filters,
  valueToAdd,
  updated_by,
  conn,
) => {
  try {
    const [sql, params] = buildUpdateQuery(
      tableName.MERCHANT,
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
    console.error('Error in updateMerchantBalanceDao:', error);
    throw error.message;
  }
};
