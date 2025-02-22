import { columns, tableName } from '../../constants/index.js';
import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from '../../utils/db.js';
const getBankaccountDao = async (
  search,
  payload,
  page,
  pageSize,
  sortBy,
  sortOrder
) => {
  const baseQuery = `SELECT id,upi_id,upi_params,ac_name,ifsc,bank_name,is_qr,is_bank,min_payin,is_enabled,payin_count,balance,today_balance,bank_used_for,created_by,updated_by FROM "${tableName.BANK_ACCOUNT}" WHERE 1=1 `;
  const [sql, queryParams] = buildSelectQuery(baseQuery, search, columns.BANK_ACCOUNT, page, pageSize, sortBy, sortOrder, typeof search != 'string',payload);
  // Execute query
  const result = await executeQuery(sql, queryParams);
  return result.rows;
};

const getMerchantBankDao = async (id) => {
  const query = `SELECT * FROM  "${tableName.BANK_ACCOUNT}" WHERE 1=1 AND "company_id" = $1 AND "user_id" = $1`;
  const [sql, parameters] = buildSelectQuery(query, id);
  const result = await executeQuery(sql, parameters);
  return result.rows;
}

const createBankaccountDao = async (payload) => {
  const [sql, params] = buildInsertQuery(tableName.BANK_ACCOUNT, payload)
  const result = await executeQuery(sql, params);
  return result.rows[0];
};

const updateBankaccountDao = async (id,payload, conn) => {
  const [sql, params] = buildUpdateQuery(tableName.BANK_ACCOUNT, payload, id);
  if (conn && conn.query) {
    const result = await conn.query(sql, params);
    return result.rows[0];
  }
  const result = await executeQuery(sql, params);
  return result.rows[0];
};

const deleteBankaccountDao = async (id, data) => {
  const [sql, params] = buildUpdateQuery(tableName.BANK_ACCOUNT, data,  id );
  const result = await executeQuery(sql, params);
  return result.rows[0];
};

export const updateBanktBalanceDao = async (filters, balance, today_balance, conn) => {
  const [sql, params] = buildUpdateQuery(tableName.BANK_ACCOUNT, { balance, today_balance }, filters, { balance: '+', today_balance: '+' });
  if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
  }
  const result = await executeQuery(sql, params);
  return result[0];
}


export { getBankaccountDao, createBankaccountDao, updateBankaccountDao, deleteBankaccountDao, getMerchantBankDao };
