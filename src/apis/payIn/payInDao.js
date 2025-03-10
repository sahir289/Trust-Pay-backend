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
    console.error('Error generating PayIn URL:', error);
    throw error.message;
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
    console.error('Error getting PayIn URL:', error);
    throw error.message;
  }
};

export const getPayInsDao = async (conn, filters, company_id, page, limit, role) => {
  try {
    if (typeof company_id === 'string') {
      company_id = company_id.trim();
    }
    let conditions = [`u.is_obsolete = false`, `u.company_id = $1`];
    let queryParams = [company_id];
    let limitcondition = '';

    if (filters.startDate && filters.endDate) {
      conditions.push(`u.created_at BETWEEN $${queryParams.length + 1} AND $${queryParams.length + 2}`);
      queryParams.push(filters.startDate, filters.endDate);
      // delete filters.startDate
      // delete filters.endDate
    }
    if (page && limit) {
      limitcondition = `LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
      queryParams.push(limit, (page - 1) * limit);
    }
    if (Object.keys(filters).length > 0) {
      Object.keys(filters).forEach((key) => {
        delete filters.page
        delete filters.limit
        const value = filters[key];
        if (value !== null && value !== undefined && value !== '') {
          if (Array.isArray(value)) {
            conditions.push(`u."${key}" = ANY($${queryParams.length + 1})`);
            queryParams.push(value);
          } else {
            conditions.push(`u."${key}" = $${queryParams.length + 1}`);
            queryParams.push(value);
          }
        }
      });
    }
    let commissionSelect = '';
    if (role === 'MERCHANT') {
      commissionSelect = `u.payin_merchant_commission, u.merchant_order_id, 
      json_build_object(
        'merchant_code', r.code,
        'return_url', r.config->>'return_url',
        'notify_url', r.config->>'notify_url'
    ) AS merchant_details,`;
    } else if (role === 'VENDOR') {
      commissionSelect = 'u.payin_vendor_commission, v.code AS vendor_code,';
    } else {
      commissionSelect = `u.payin_merchant_commission,
      json_build_object(
        'merchant_code', r.code,
        'return_url', r.config->>'return_url',
        'notify_url', r.config->>'notify_url'
    ) AS merchant_details,u.payin_vendor_commission, v.code AS vendor_code,
      u.payin_vendor_commission, u.approved_at, u.created_by, u.updated_by, u.created_at, u.updated_at`;
    }
    const baseQuery = `
      WITH filtered_payins AS (
        SELECT DISTINCT ON (u.id)
        u.id,
        u.sno,
        u.upi_short_code,
        u.amount,
        u.status,
        u.merchant_order_id,
        u.is_notified,
        u.user_submitted_utr,
        u.user,
        u.user_submitted_image,
        u.duration,
        u.config AS payin_details,
        b.nick_name,
        ${commissionSelect},
        json_build_object(
            'utr', br.utr,
            'amount', br.amount
        ) AS bank_res_details
        FROM public."Payin" u
        LEFT JOIN public."Merchant" r ON u.merchant_id = r.id
        LEFT JOIN public."BankAccount" b ON u.bank_acc_id = b.id
        LEFT JOIN public."BankResponse" br ON b.id = br.bank_id
        LEFT JOIN public."Vendor" v ON v.user_id = b.user_id
        WHERE ${conditions.join(' AND ')}  
      )
      SELECT * FROM filtered_payins
      ORDER BY sno ASC
      ${limitcondition}
    `;

    const result = await conn.query(baseQuery, queryParams);

    return { totalCount: result.rowCount, payin: result.rows };
  } catch (error) {
    console.error('Error getting PayIn URL:', error);
    throw error.message;
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
    console.error('Error getting PayIn URLs:', error);
    throw error.message;
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
    console.error('Error updating PayIn URL:', error);
    throw error.message;
  }
};
