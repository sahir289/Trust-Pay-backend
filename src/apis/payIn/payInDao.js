import { tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { getConnection } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';

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
    const { PAYIN } = tableName;
    if (typeof company_id === 'string') {
      company_id = company_id.trim();
    }
    let conditions = [`p.is_obsolete = false`, `p.company_id = $1`];
    let queryParams = [company_id];
    let limitcondition = '';

    // const tableConfigs = {
    //   u: {
    //     columns: ['sno', 'upi_short_code', 'amount', 'status', 'merchant_order_id', 'user_submitted_utr', 'user', 'is_notified'],
    //     jsonFields: ['p.config'],
    //   },
    //   r: {
    //     columns: ['code'],
    //     jsonFields: ['r.config'],
    //   },
    //   b: {
    //     columns: ['nick_name'],
    //     jsonFields: [],
    //   },
    //   br: {
    //     columns: ['utr', 'amount'],
    //     jsonFields: [],
    //   },
    //   v: {
    //     columns: ['code'],
    //     jsonFields: [],
    //   },
    // };

    if (filters.search) {
      filters.or = buildSearchFilterObj(filters.search, PAYIN);
      delete filters.search;
    }

    console.log(filters.or, "filetrs")
    // const { conditions, queryParams } = buildFilterConditions(filters, tableConfigs, baseConditions, baseParams);

    console.log(conditions, queryParams, "+++++++");

    if (filters.startDate && filters.endDate) {
      conditions.push(`p.created_at BETWEEN $${queryParams.length + 1} AND $${queryParams.length + 2}`);
      queryParams.push(filters.startDate, filters.endDate);
    }
    if (page && limit) {
      limitcondition = `LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
      queryParams.push(limit, (page - 1) * limit);
    }
  
    let commissionSelect = '';
    if (role === 'MERCHANT') {
      commissionSelect = `p.payin_merchant_commission, p.merchant_order_id, 
        json_build_object(
          'merchant_code', r.code,
          'return_url', r.config->>'return_url',
          'notify_url', r.config->>'notify_url'
      ) AS merchant_details`;
    } else if (role === 'VENDOR') {
      commissionSelect = 'p.payin_vendor_commission, v.code AS vendor_code,';
    } else {
      commissionSelect = `p.payin_merchant_commission,
        json_build_object(
          'merchant_code', r.code,
          'return_url', r.config->>'return_url',
          'notify_url', r.config->>'notify_url'
      ) AS merchant_details,p.payin_vendor_commission, v.code AS vendor_code,
      p.payin_vendor_commission, p.approved_at, p.created_by, p.updated_by, p.created_at, p.updated_at`;
    }
    const baseQuery = `
      WITH filtered_payins AS (
        SELECT DISTINCT ON (p.id)
        p.id,
        p.sno,
        p.upi_short_code,
        p.amount,
        p.status,
        p.merchant_order_id,
        p.is_notified,
        p.user_submitted_utr,
        p.user,
        p.user_submitted_image,
        p.duration,
        p.config AS payin_details,
        b.nick_name,
        ${commissionSelect},
        json_build_object(
            'utr', br.utr,
            'amount', br.amount
        ) AS bank_res_details
      
        FROM public."Payin" p
        LEFT JOIN public."Merchant" r ON p.merchant_id = r.id
        LEFT JOIN public."BankAccount" b ON p.bank_acc_id = b.id
        LEFT JOIN public."BankResponse" br ON p.bank_response_id = br.id
        LEFT JOIN public."Vendor" v ON v.user_id = b.user_id
        WHERE ${conditions.join(' AND ')}  
      ),
      total_count AS (
        SELECT COUNT(*) AS total FROM filtered_payins
      )
      SELECT * FROM filtered_payins, total_count
      ORDER BY sno DESC
      ${limitcondition}
    `;
    console.log(filters, "filters")

    // const [sql, values] = buildSelectQuery(
    //   baseQuery,
    //   filters,
    //   page,
    //   limit,
    //   filters.sortBy,
    //   filters.sortOrder,
    //   PAYIN,
    // );
    console.log(baseQuery, "_________aqollllll", queryParams, "______valuess", conditions, limitcondition, "limitcondition");
    const result = await executeQuery(baseQuery, queryParams);
    // const result = await conn.query(baseQuery, queryParams);
    return { totalCount: result.rows[0]?.total, payins: result.rows }
  } catch (error) {
    logger.error('Error getting PayIn URL:', error);
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

export const getPayinDetailsByMerchantOrderId = async (merchantOrderId) => {
  let conn;
  const baseQuery = `
    SELECT 
        p.id AS payin_id, 
        p.bank_acc_id, 
        p.merchant_id, 
        ba.user_id AS vendor_user_id, 
        m.user_id AS merchant_user_id
    FROM public."Payin" p
    JOIN public."BankAccount" ba ON p.bank_acc_id = ba.id
    JOIN public."Merchant" m ON p.merchant_id = m.id
    WHERE p.merchant_order_id = $1 AND p.is_obsolete = false;
  `;

  try {
    conn = await getConnection(); // Get DB connection
    const result = await conn.query(baseQuery, [merchantOrderId]); // Execute query
    return result.rows; // Return result
  } catch (error) {
    console.error('Error fetching payin details:', error);
    throw error;
  } finally {
    if (conn) conn.release(); // Ensure connection is released
  }
};
