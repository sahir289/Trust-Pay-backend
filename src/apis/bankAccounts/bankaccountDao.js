import { columns, tableName } from '../../constants/index.js';
import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from '../../utils/db.js';

const getBankaccountDao = async (
  search,
  page,
  pageSize,
  sortBy,
  sortOrder
) => {
  const baseQuery = `SELECT * FROM "${tableName.BANK_ACCOUNT}" WHERE 1=1`;
  const [sql, queryParams] = buildSelectQuery(baseQuery, search, columns.BANK_ACCOUNT, page, pageSize, sortBy, sortOrder, typeof search != 'string');
  // Execute query
  const result = await executeQuery(sql, queryParams);
  return result.rows;
};

const getMerchantBankDao = async (user_id) => {
  const query = `SELECT * FROM  "${tableName.BANK_ACCOUNT}" WHERE 1=1`;
  const [sql, parameters] = buildSelectQuery(query, { user_id });
  const result = await executeQuery(sql, parameters);
  return result.rows;
}

const createBankaccountDao = async (payload) => {
  const [sql, params] = buildInsertQuery(tableName.BANK_ACCOUNT, payload)
  const result = await executeQuery(sql, params);
  return result.rows[0];
};

const updateBankaccountDao = async (id, payload) => {
  const [sql, params] = buildUpdateQuery(tableName.BANK_ACCOUNT, payload, { id });
  const result = await executeQuery(sql, params);
  return result.rows[0];
};

const deleteBankaccountDao = async (id, data) => {
  const [sql, params] = buildUpdateQuery(tableName.BANK_ACCOUNT, data, { id });
  const result = await executeQuery(sql, params);
  return result.rows[0];
};

export { getBankaccountDao, createBankaccountDao, updateBankaccountDao, deleteBankaccountDao, getMerchantBankDao };
