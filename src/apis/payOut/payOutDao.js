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
    throw error.message;
  }
};

export const getPayoutsDao = async (conn, filters, company_id, page, limit, role) => {
  try {
    if (typeof company_id === 'string') {
      company_id = company_id.trim();
    }

    let conditions = [`u.is_obsolete = false`, `u.company_id = $1`];
    let queryParams = [company_id];
    let limitcondition = '';

    if (filters?.startDate && filters?.endDate) {
      conditions.push(`u.created_at BETWEEN $${queryParams.length + 1} AND $${queryParams.length + 2}`);
      queryParams.push(filters.startDate, filters.endDate);
    }
    
    if (page && limit) {
      limitcondition = `LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
      queryParams.push(limit, (page - 1) * limit);
    }
    Object.keys(filters).forEach((key) => {
      delete filters.page
      delete filters.limit
      const value = filters[key];
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          conditions.push(`u."${key}" = ANY($${queryParams.length + 1})`);
        } else {
          conditions.push(`u."${key}" = $${queryParams.length + 1}`);
        }
        queryParams.push(value);
      }
    });

    let commissionSelect = '';
    if (role === 'MERCHANT') {
      commissionSelect = `
        u.payout_merchant_commission, 
        u.merchant_order_id, 
        json_build_object(
          'merchant_code', r.code,
          'return_url', r.config->>'return_url',
          'notify_url', r.config->>'notify_url'
        ) AS merchant_details
      `;
    } else if (role === 'VENDOR') {
      commissionSelect = `u.payout_vendor_commission, v.code AS vendor_code, 
          v.id AS vendor_id, 
          v.user_id AS vendor_user_id,`;
    } else {
      commissionSelect = `
        u.merchant_id, 
        u.payout_merchant_commission, 
        u.payout_vendor_commission, 
        u.approved_at, 
        u.created_by, 
        u.updated_by, 
        u.created_at, 
        v.code AS vendor_code, 
        v.id AS vendor_id, 
        v.user_id AS vendor_user_id,
        u.updated_at, 
        json_build_object(
          'merchant_code', r.code,
          'return_url', r.config->>'return_url',
          'notify_url', r.config->>'notify_url'
        ) AS merchant_details
      `;
    }

    let baseQuery = `
      WITH filtered_payOuts AS (
        SELECT DISTINCT ON (u.id) 
          u.id, 
          u.sno,
          u.user,    
          u.bank_acc_id, 
          u.amount,
          u.status, 
          u.failed_reason, 
          u.currency, 
          u.upi_id, 
          u.utr_id, 
          u.rejected_reason,
          u.config AS payout_details,
          ${commissionSelect},
          b.id AS bank_table_id, 
          b.user_id, 
          b.nick_name,
          r.id AS merchant_table_id,
          json_build_object(
            'account_holder_name', u.acc_holder_name,
            'account_no', u.acc_no,
            'ifsc_code', u.ifsc_code,
            'bank_name', u.bank_name
          ) AS user_bank_details
        FROM public."Payout" u
        LEFT JOIN public."Merchant" r ON u.merchant_id = r.id
        LEFT JOIN public."BankAccount" b ON u.bank_acc_id = b.id
        LEFT JOIN public."Vendor" v ON v.user_id = b.user_id
        WHERE ${conditions.join(' AND ')}  
      ),
      total_count AS (
        SELECT COUNT(*) AS total FROM filtered_payOuts
      )
      SELECT * FROM filtered_payOuts, total_count
      ORDER BY sno DESC
      ${limitcondition}
    `;

    const result = await conn.query(baseQuery, queryParams);
    return { totalCount: result.rows[0]?.total, payout: result.rows };
  } catch (error) {
    console.error('Error in getPayoutsDao:', error);
    throw error.message;
  }
};


export const getPayoutsCronDao = async (conn, payload) => {
  try {
    let baseQuery = `SELECT * FROM public."Payout" 
      WHERE is_obsolete = false AND status = $1
      ORDER BY created_at
    `;
    const queryParams = [payload];

    const result = await conn.query(baseQuery, queryParams);
    return result.rows;
  } catch (error) {
    console.error('Error in createPayoutDao:', error);
    throw error.message;
  }
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
    console.error('Error occurred while updating payout:', error);
    throw error.message;
  }
};

export const deletePayoutDao = async (ids, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.PAYOUT, data, ids);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error occurred while deleting payout:', error);
    throw error.message;
  }
};
