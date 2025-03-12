import { tableName } from '../../constants/index.js';

import {
  buildInsertQuery,
  buildJoinQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';
import { DbError } from '../../utils/appErrors.js';
const getBankaccountDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  columns = [],
) => {
  try {
    const { VENDOR, BANK_ACCOUNT } = tableName
    const joins = [
      {
        table: VENDOR,
        // first is source key
        // second is target key
        keys: ['user_id', 'user_id'],
        type: 'LEFT JOIN',
        // columns: ['designation_id'],
        columnAs: [
          `"${VENDOR}".code AS Vendor`,
        ],
      }]
    const baseQuery = buildJoinQuery(
      BANK_ACCOUNT,
      columns.length ? columns : '*',
      joins,
    );
    if (filters.search) {
      filters.or = buildSearchFilterObj(filters.search, BANK_ACCOUNT);
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
      tableName.BANK_ACCOUNT,
    );
    // Execute query
    const result = await executeQuery(sql, queryParams);
    return result.rows;
  } catch (error) {
    console.error(error);
    throw error.message;
  }
};

const getMerchantBankDao = async (filters) => {
  try {
    const query = `SELECT * FROM  "${tableName.BANK_ACCOUNT}" WHERE 1=1`;
    const [sql, parameters] = buildSelectQuery(query, filters);
    const result = await executeQuery(sql, parameters);
    return {totalCount : result.rowCount, merchantBankCodes : result.rows};
  } catch (error) {
    console.error(error);
    throw error.message;
  }
};

const createBankaccountDao = async (payload) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.BANK_ACCOUNT, payload);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error(error);
    throw error.message;
  }
};

const getBankaccountDaoNickName = async (conn, company_id, type) => {
  const baseQuery = `SELECT nick_name,id FROM "${tableName.BANK_ACCOUNT}" WHERE company_id = $1 AND bank_used_for= $2`;
  const queryParams = [company_id, type];
  const result = await conn.query(baseQuery, queryParams);
  return { totalCount: result.rowCount, merchantCodes: result.rows };
}


const updateBankaccountDao = async (conn, id, payload) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.BANK_ACCOUNT, payload, id);
    let result;
    if (conn && conn.query) {
      result = await conn.query(sql, params); // Use connection to execute query
    } else {
      result = await executeQuery(sql, params); // Use executeQuery if no connection
    }
    return result.rows[0];
  } catch (error) {
    throw error.message;
  }
};

const deleteBankaccountDao = async (conn, id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.BANK_ACCOUNT, data, id);
    let result;
    if (conn && conn.query) {
      result = await conn.query(sql, params); // Use connection to execute query
    } else {
      result = await executeQuery(sql, params); // Use executeQuery if no connection
    }
    return result.rows[0];
  } catch {
    DbError('Error executing query');
  }
};

export const updateBanktBalanceDao = async (
  filters,
  amount,
  updated_by,
  conn,
) => {
  try {
    const [sql, params] = buildUpdateQuery(
      tableName.BANK_ACCOUNT,
      { balance: amount, today_balance: amount, updated_by },
      filters,
      { balance: '+', today_balance: '+' },
    );
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result[0];
  } catch (error) {
    console.error(error);
    throw error.message;
  }
};

export {
  getBankaccountDao,
  createBankaccountDao,
  updateBankaccountDao,
  deleteBankaccountDao,
  getMerchantBankDao,
  getBankaccountDaoNickName
};
