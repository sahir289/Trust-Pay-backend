import { tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
export const createPayoutDao = async (conn, data) => {
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
  conn, payload
) => {
  let baseQuery = `SELECT DISTINCT ON (u.id)
  u.id, u.sno,u.user, u.merchant_id, u.bank_acc_id, 
 u.amount, u.status, u.failed_reason, u.currency, 
  u.merchant_order_id, u.acc_no, u.acc_holder_name, u.ifsc_code,u.bank_name,
  u.upi_id, utr_id, u.rejected_reason, 
  u.payout_merchant_commission, u.payout_vendor_commission,
  u.from_bank_acc_id, 
 u.approved_at, u.created_by, u.updated_by, u.created_at, u.updated_at, u.config AS payout_config,
  
  v.code AS vendor_code, v.id AS vendor_id, v.user_id AS vendor_user_id,
  b.id AS bank_table_id, b.user_id, b.nick_name,
  r.code AS merchant_code, r.id AS merchant_table_id, r.config

FROM public."Payout" u
LEFT JOIN public."Merchant" r 
  ON u.merchant_id = r.id
LEFT JOIN public."BankAccount" b
  ON u.bank_acc_id = b.id
LEFT JOIN public."Vendor" v 
  ON v.user_id = b.user_id
WHERE u.is_obsolete = false AND u.company_id = $1
ORDER BY u.id
LIMIT $3 OFFSET $2;
`

  const queryParams = [payload.company_id, payload.page, payload.limit];
  const result = await conn.query(baseQuery, queryParams);
    return {
      totalCount: result.rows.length,
      rows: result.rows.reduce((acc, res) => acc.concat({
          id: res.id,
          sno: res.sno,
          upi_short_code: res.upi_short_code,
          amount: res.amount,
          status: res.status,
          is_notified: res.is_notified,
          user_submitted_utr: res.user_submitted_utr,
          merchant_order_id: res.merchant_order_id,
          user: res.user,
          bank_account: res.nick_name,
          merchant: {
              code: res.merchant_code,
              ReturnUrl: res.payout_config.return_url,
              NotifyUrl: res.payout_config.notify_url,
          },
          vendor: res.vendor_code,
          bank_response: {
              amount: res.bank_res_amount,
              utr: res.utr,
          },
          payout_merchant_commission: res.payout_merchant_commission,
          payout_vendor_commission: res.payout_vendor_commission,
          user_submitted_image: res.user_submitted_image,
          duration: res.duration,
          approved_at: res.approved_at,
          created_by: res.created_by,
          updated_by: res.updated_by,
          created_at: res.created_at,
          updated_at: res.updated_at,
      }), [])
  };
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


export const deletePayoutDao = async (ids, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.PAYOUT, data, ids);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error("Error occurred while deleting payout:", error);
    throw new Error("An error occurred while processing the payout deletion.");
  }
};
