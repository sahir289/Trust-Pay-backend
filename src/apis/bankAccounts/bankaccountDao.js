import {  tableName } from '../../constants/index.js';
import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from '../../utils/db.js';
const getBankaccountDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder
) => {
  const baseQuery = `SELECT id,upi_id,upi_params,user_id,acc_no,ifsc,bank_name,is_qr,is_bank,min_payin,is_enabled,payin_count,balance,today_balance,bank_used_for,created_by,updated_by FROM "${tableName.BANK_ACCOUNT}" WHERE 1=1 `;
  const [sql, queryParams] = buildSelectQuery(baseQuery, filters, page, pageSize, sortBy, sortOrder);
  const result = await executeQuery(sql, queryParams);
  console.log(sql, queryParams, result.rows[0], "sqlparamsresult")
  return result.rows.length>0 ? result : result.rows[0];
};


const getMerchantBankDao = async (filters) => {
  const query = `SELECT * FROM  "${tableName.BANK_ACCOUNT}" WHERE 1=1`;
  const [sql, parameters] = buildSelectQuery(query, filters);
  const result = await executeQuery(sql, parameters);
  return result.rows;
}

const createBankaccountDao = async (payload) => {
  const [sql, params] = buildInsertQuery(tableName.BANK_ACCOUNT, payload)
  const result = await executeQuery(sql, params);
  return result.rows[0];
};

const updateBankaccountDao = async (conn,id,payload) => {

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
    console.log(sql, params, data, "dshjdjbcjkcb" )
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
