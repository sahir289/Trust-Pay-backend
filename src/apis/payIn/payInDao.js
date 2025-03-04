import { tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';

export const generatePayInUrlDao = async (data) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.PAYIN, data);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error generating PayIn URL:', error); // Log the error for debugging
    throw error.message; // Rethrow the error to propagate it
  }
};

export const getPayInUrlDao = async (filters) => {
  try {
    const [sql, params] = buildSelectQuery(
      `SELECT * FROM "${tableName.PAYIN}" WHERE 1=1`,
      filters,
    );
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error getting PayIn URL:', error); // Log the error for debugging
    throw error.message; // Rethrow the error to propagate it
  }
};

export const getPayInsDao = async (conn, payload) => {
  try
  {const baseQuery = `
    SELECT DISTINCT ON (u.id)
    u.id,
    u.sno,
    u.upi_short_code,
    u.amount,
    u.status,
    u.is_notified,
    u.user_submitted_utr,
    u.merchant_order_id,
    u.user,
    u.payin_merchant_commission,
    u.payin_vendor_commission,
    u.user_submitted_image,
    u.duration,
    u.approved_at,
    u.created_by,
    u.updated_by,
    u.created_at,
    u.updated_at,
    u.config AS payin_details,
    v.code AS vendor_code,
    b.nick_name,

    json_build_object(
        'merchant_code', r.code,
        'return_url', r.config->>'return_url',
        'notify_url', r.config->>'notify_url'
    ) AS merchant_details,

    json_build_object(
        'utr', br.utr,
        'amount', br.amount
    ) AS bank_res_details
  
FROM public."Payin" u
LEFT JOIN public."Merchant" r ON u.merchant_id = r.id
LEFT JOIN public."BankAccount" b ON u.bank_acc_id = b.id
LEFT JOIN public."BankResponse" br ON b.id = br.bank_id
LEFT JOIN public."Vendor" v ON v.user_id = b.user_id
WHERE u.is_obsolete = false 
AND u.company_id = $1;
    `;

  const queryParams = [payload.company_id];
  const result = await conn.query(baseQuery, queryParams);
  return { totalCount: result.rows.length, rows: result.rows };}
  catch(error){
    console.error('Error getting PayIn URL:', error); // Log the error for debugging
    throw error.message; // Rethrow the error to propagate it
  }
};

export const getPayInUrlsDao = async (filters = {}) => {
  try {
    const [sql, params] = buildSelectQuery(
      `SELECT * FROM "${tableName.PAYIN}" WHERE 1=1`,
      filters,
      // , page, limit
    );
    const result = await executeQuery(sql, params);
    return result.rows;
  } catch (error) {
    console.error('Error getting PayIn URLs:', error); // Log the error for debugging
    throw error.message; // Rethrow the error to propagate it
  }
};

export const updatePayInUrlDao = async (id, data, conn) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.PAYIN, data, { id });
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error updating PayIn URL:', error); // Log the error for debugging
    throw error.message; // Rethrow the error to propagate it
  }
};
