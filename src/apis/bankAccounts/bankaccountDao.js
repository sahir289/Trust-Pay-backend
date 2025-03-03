import { tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';
const getBankaccountDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  columns = [],
) => {
  const baseQuery = `SELECT ${columns.length ? columns.join(', ') : '*'} FROM "${tableName.BANK_ACCOUNT}" WHERE 1=1`;
  if (filters.search) {
    filters.or = buildSearchFilterObj(filters.search, tableName.BANK_ACCOUNT);
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
  console.log(result.rows, 'sqlqueryparams');
  return result.rows;
};

const getMerchantBankDao = async (filters) => {
  const query = `SELECT * FROM  "${tableName.BANK_ACCOUNT}" WHERE 1=1`;
  const [sql, parameters] = buildSelectQuery(query, filters);
  const result = await executeQuery(sql, parameters);
  return result.rows;
};

const createBankaccountDao = async (payload) => {
  const [sql, params] = buildInsertQuery(tableName.BANK_ACCOUNT, payload);
  const result = await executeQuery(sql, params);
  return result.rows[0];
};

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
    console.error(error);
    throw error;
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
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const updateBanktBalanceDao = async (
  filters,
  balance,
  today_balance,
  conn,
) => {
  const [sql, params] = buildUpdateQuery(
    tableName.BANK_ACCOUNT,
    { balance, today_balance },
    filters,
    { balance: '+', today_balance: '+' },
  );
  if (conn && conn.query) {
    const result = await conn.query(sql, params);
    return result.rows[0];
  }
  const result = await executeQuery(sql, params);
  return result[0];
};

export {
  getBankaccountDao,
  createBankaccountDao,
  updateBankaccountDao,
  deleteBankaccountDao,
  getMerchantBankDao,
};
