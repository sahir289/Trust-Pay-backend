import { tableName } from '../../constants/index.js';
import {
  buildAndExecuteUpdateQuery,
  buildInsertQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';

export const createPayoutDao = async (conn, data) => {
  try {
    // Ensure `config` is initialized if not provided
    if (!data.config) {
      data.config = {}; // Default to an empty JSON object
    }

    const [sql, params] = buildInsertQuery(tableName.PAYOUT, data);
    const result = conn
      ? await conn.query(sql, params)
      : await executeQuery(sql, params);

    return result.rows[0];
  } catch (error) {
    console.error('Error in createPayoutDao:', error);
    throw error.message;
  }
};

export const getPayoutsDao = async (filters, company_id, page, limit, role, conn) => {
  try {
    if (typeof company_id === 'string') {
      company_id = company_id.trim();
    }

    let conditions = [`u.is_obsolete = false`];
    let queryParams = [];
    if(company_id){
      conditions.push(`u.company_id = '${company_id}'`);
    }
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
          'notify_url', r.config->>'notify_url',
          'public_key', r.config->'keys'->>'public',
          'private_key', r.config->'keys'->>'private'
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
          u.merchant_order_id,
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
          ve.code AS vendor_code,
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
        LEFT JOIN public."Vendor" ve ON u.vendor_id = ve.id
        WHERE ${conditions.join(' AND ')}  
      ),
      total_count AS (
        SELECT COUNT(*) AS total FROM filtered_payOuts
      )
      SELECT * FROM filtered_payOuts, total_count
      ORDER BY sno DESC
      ${limitcondition}
    `;

    let result;

    if (conn && conn.query) {
      result = await conn.query(baseQuery, queryParams);
    } else {
      result = await executeQuery(baseQuery, queryParams);
    }
    return result.rows;
  } catch (error) {
    console.error('Error in getPayoutsDao:', error);
    throw error.message;
  }
};
export const getPayoutsBySearchDao = async (
  company_id,
  searchTerms,
  limitNum,
  offset,
) => {
  try {
    const conditions = [];
    const values = [company_id];
    let paramIndex = 2;

    let queryText = `
      SELECT 
        p.id,
        p.sno,
        p.user,
        p.bank_acc_id,
        p.amount,
        p.status,
        p.merchant_order_id,
        p.failed_reason,
        p.currency,
        p.upi_id,
        p.utr_id,
        p.rejected_reason,
        p.payout_merchant_commission,
        p.payout_vendor_commission,
        p.created_at,
        p.updated_at,
        p.config AS payout_details,
        b.nick_name AS bank_nickname,
        m.code AS merchant_code,
        v.code AS vendor_code,
        json_build_object(
          'account_holder_name', p.acc_holder_name,
          'account_no', p.acc_no,
          'ifsc_code', p.ifsc_code,
          'bank_name', p.bank_name
        ) AS user_bank_details
      FROM public."Payout" p
      LEFT JOIN public."Merchant" m ON p.merchant_id = m.id
      LEFT JOIN public."BankAccount" b ON p.bank_acc_id = b.id
      LEFT JOIN public."Vendor" v ON p.vendor_id = v.id
      WHERE p.is_obsolete = false 
      AND p.company_id = $1
    `;

    searchTerms.forEach((term) => {
      if (term.toLowerCase() === 'true' || term.toLowerCase() === 'false') {
        const boolValue = term.toLowerCase() === 'true';
        conditions.push(`(p.is_obsolete = $${paramIndex})`);
        values.push(boolValue);
        paramIndex++;
      } else {
        conditions.push(`
          (
            LOWER(p.id::text) LIKE LOWER($${paramIndex})
            OR LOWER(p.user) LIKE LOWER($${paramIndex})
            OR LOWER(p.status) LIKE LOWER($${paramIndex})
            OR LOWER(p.merchant_order_id) LIKE LOWER($${paramIndex})
            OR LOWER(p.failed_reason) LIKE LOWER($${paramIndex})
            OR LOWER(p.currency) LIKE LOWER($${paramIndex})
            OR LOWER(p.upi_id) LIKE LOWER($${paramIndex})
            OR LOWER(p.utr_id) LIKE LOWER($${paramIndex})
            OR LOWER(p.rejected_reason) LIKE LOWER($${paramIndex})
            OR LOWER(b.nick_name) LIKE LOWER($${paramIndex})
            OR LOWER(m.code) LIKE LOWER($${paramIndex})
            OR LOWER(v.code) LIKE LOWER($${paramIndex})
            OR p.amount::text LIKE $${paramIndex}
            OR LOWER(p.config->>'method') LIKE LOWER($${paramIndex})
            OR LOWER(p.config->>'rejected_reason') LIKE LOWER($${paramIndex})
            OR LOWER(p.acc_holder_name) LIKE LOWER($${paramIndex})
            OR LOWER(p.acc_no) LIKE LOWER($${paramIndex})
            OR LOWER(p.ifsc_code) LIKE LOWER($${paramIndex})
            OR LOWER(p.bank_name) LIKE LOWER($${paramIndex})
          )
        `);
        values.push(`%${term}%`);
        paramIndex++;
      }
    });

    if (conditions.length > 0) {
      queryText += ' AND (' + conditions.join(' OR ') + ')';
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${queryText}) as count_table`;

    queryText += `
      ORDER BY p.created_at DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;
    values.push(limitNum, offset);

    const countResult = await executeQuery(countQuery, values.slice(0, -2));
    const searchResult = await executeQuery(queryText, values);

    const totalItems = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalItems / limitNum);

    const data = {
      totalCount: totalItems,
      totalPages,
      payouts: searchResult.rows,
    };
    return data;
  } catch (error) {
    console.error('Error in getPayoutsBySearchDao:', error);
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
    // Clone the data object to avoid modifying the original
    const updateData = { ...data };

    // If config is present, ensure it's properly formatted
    if (updateData.config && typeof updateData.config === 'object') {
      // Get existing config first to merge with new config
      const existingData = await executeQuery(
        `SELECT config FROM "${tableName.PAYOUT}" WHERE id = $1`,
        [ids.id]
      );

      if (existingData.rows.length > 0) {
        const existingConfig = existingData.rows[0].config || {};
        // Merge existing config with new config
        updateData.config = {
          ...existingConfig,
          ...updateData.config
        };
      }
    }

    // Use buildAndExecuteUpdateQuery
    return await buildAndExecuteUpdateQuery(
      tableName.PAYOUT,
      updateData,
      ids,
      {}, // No special fields
      { returnUpdated: true },
      conn
    );
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
