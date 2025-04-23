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

export const getPayInsDao = async (filters, company_id, page, limit, role) => {
  try {
    const { PAYIN } = tableName;

    if (typeof company_id === 'string') {
      company_id = company_id.trim();
    }

    const conditions = [`p.is_obsolete = false`, `p.company_id = $1`];
    const queryParams = [company_id];
    const limitcondition = { value: '' };

    const handledKeys = new Set([
      'search',
      'startDate',
      'endDate',
      'status',
      'sortBy',
      'sortOrder',
    ]);

    const conditionBuilders = {
      search: (filters, PAYIN) => {
        if (!filters.search || typeof filters.search !== 'string') return;
        try {
          filters.or = buildSearchFilterObj(filters.search, PAYIN);
          delete filters.search;
        } catch (error) {
          logger.warn(`Invalid search filter: ${filters.search}`, error);
          delete filters.search;
        }
      },
      dateRange: (filters, conditions, queryParams) => {
        if (!filters.startDate || !filters.endDate) return;
        const nextParamIdx = queryParams.length + 1;
        conditions.push(
          `p.created_at BETWEEN $${nextParamIdx} AND $${nextParamIdx + 1}`,
        );
        queryParams.push(filters.startDate, filters.endDate);
      },
      bankName: (filters, conditions, queryParams) => {
        if (!filters.nick_name) return;
        const nextParamIdx = queryParams.length + 1;
        conditions.push(`LOWER(b.nick_name) LIKE LOWER($${nextParamIdx})`);
        queryParams.push(filters.nick_name);
      },
      status: (filters, conditions, queryParams) => {
        if (!filters.status) return;
        const statusArray = filters.status.split(',').map((s) => s.trim());
        const nextParamIdx = queryParams.length + 1;
        const placeholders = statusArray
          .map((_, idx) => `$${nextParamIdx + idx}`)
          .join(', ');
        conditions.push(
          statusArray.length > 1
            ? `p.status IN (${placeholders})`
            : `p.status = $${nextParamIdx}`,
        );
        queryParams.push(...statusArray);
      },
      pagination: (page, limit, queryParams, limitconditionRef) => {
        if (!page || !limit) return;
        const nextParamIdx = queryParams.length + 1;
        limitconditionRef.value = `LIMIT $${nextParamIdx} OFFSET $${nextParamIdx + 1}`;
        queryParams.push(limit, (page - 1) * limit);
      },
    };

    // Apply the filters
    conditionBuilders.search(filters, PAYIN);
    conditionBuilders.dateRange(filters, conditions, queryParams);
    conditionBuilders.bankName(filters, conditions, queryParams);
    conditionBuilders.status(filters, conditions, queryParams);
    conditionBuilders.pagination(page, limit, queryParams, limitcondition);

    Object.entries(filters).forEach(([key, value]) => {
      if (handledKeys.has(key) || value == null) return;
      const nextParamIdx = queryParams.length + 1;

      // Special handling for arrays
      if (Array.isArray(value)) {
        const placeholders = value
          .map((_, idx) => `$${nextParamIdx + idx}`)
          .join(', ');
        conditions.push(`p.${key} IN (${placeholders})`);
        queryParams.push(...value);
      } else {
        const isMultiValue = typeof value === 'string' && value.includes(',');
        const valueArray = isMultiValue
          ? value.split(',').map((v) => v.trim())
          : [value];
        const placeholders = valueArray
          .map((_, idx) => `$${nextParamIdx + idx}`)
          .join(', ');
        conditions.push(
          isMultiValue
            ? `p.${key} IN (${placeholders})`
            : `p.${key} = $${nextParamIdx}`,
        );
        queryParams.push(...valueArray);
      }
    });

    // Build role-based select fields
    let commissionSelect = '';
    if (role === 'MERCHANT') {
      commissionSelect = `
        p.payin_merchant_commission,
        p.merchant_order_id,
        json_build_object(
          'merchant_code', r.code,
          'dispute',r.dispute_enabled,
          'return_url', r.config->>'return_url',
          'notify_url', r.config->>'notify_url'
        ) AS merchant_details
      `;
    } else if (role === 'VENDOR') {
      commissionSelect = `
        p.payin_vendor_commission,
        v.code AS vendor_code
      `;
    } else {
      commissionSelect = `
        p.payin_merchant_commission,
        json_build_object(
          'merchant_code', r.code,
          'dispute',r.dispute_enabled,
          'return_url', r.config->>'return_url',
          'notify_url', r.config->>'notify_url'
        ) AS merchant_details,
        p.payin_vendor_commission,
        v.code AS vendor_code,
        p.approved_at,
        p.created_by,
        p.updated_by,
        p.created_at,
        p.updated_at
      `;
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
      )
      SELECT * FROM filtered_payins
      ORDER BY sno DESC
      ${limitcondition.value}
    `;

    // Debug log: Check if placeholders match params
    const expectedParamCount = (baseQuery.match(/\$\d+/g) || []).length;
    if (expectedParamCount !== queryParams.length) {
      logger.warn('⚠️ Placeholder count does not match parameter count!');
      logger.warn(
        `Expected: ${expectedParamCount}, Got: ${queryParams.length}`,
      );
    }

    const result = await executeQuery(baseQuery, queryParams);

    return {
      payins: result.rows,
    };
  } catch (error) {
    logger.error('Error getting PayIn URL:', error);
    throw error.message;
  }
};
export const getPayinsBySearchDao = async (
  filters,
  searchTerms,
  limitNum,
  offset,
  role,
) => {
  try {
    const conditions = [];
    const values = [filters.company_id];
    let paramIndex = 2;
    let commissionSelect = '';
    // Define commissionSelect without leading commas
    if (role === 'MERCHANT') {
      commissionSelect = `
        p.payin_merchant_commission,
        p.merchant_order_id,
        json_build_object(
          'merchant_code', m.code,
          'dispute',m.dispute_enabled,

          'return_url', m.config->>'return_url',
          'notify_url', m.config->>'notify_url'
        ) AS merchant_details`;
    } else if (role === 'VENDOR') {
      commissionSelect = `
        p.payin_vendor_commission,
        v.code AS vendor_code`;
    } else {
      commissionSelect = `
        p.payin_merchant_commission,
        json_build_object(
          'merchant_code', m.code,
          'dispute',m.dispute_enabled,
          'return_url', m.config->>'return_url',
          'notify_url', m.config->>'notify_url'
        ) AS merchant_details,
        p.payin_vendor_commission,
        v.code AS vendor_code,
        p.approved_at,
        p.created_by,
        p.updated_by,
        p.created_at,
        p.updated_at`;
    }

    let queryText = `
      SELECT
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
        b.nick_name
        ${commissionSelect ? `,${commissionSelect}` : ''},
        json_build_object(
          'utr', br.utr,
          'amount', br.amount
        ) AS bank_res_details
      FROM public."Payin" p
      LEFT JOIN public."Merchant" m ON p.merchant_id = m.id
      LEFT JOIN public."BankAccount" b ON p.bank_acc_id = b.id
      LEFT JOIN public."BankResponse" br ON p.bank_response_id = br.id
      LEFT JOIN public."Vendor" v ON v.user_id = b.user_id
      WHERE p.is_obsolete = false
      AND p.company_id = $1
    `;
    if (filters.status) {
      const statusArray = filters.status.split(',').map((s) => s.trim());
      queryText += ` AND p.status IN (${statusArray.map((_, i) => `$${paramIndex + i}`).join(', ')})`;
      values.push(...statusArray);
      paramIndex += statusArray.length;
    }
    searchTerms.forEach((term) => {
      if (term.toLowerCase() === 'true' || term.toLowerCase() === 'false') {
        const boolValue = term.toLowerCase() === 'true';
        conditions.push(`
          (
            p.is_notified = $${paramIndex}
            OR p.is_url_expires = $${paramIndex}
            OR p.one_time_used = $${paramIndex}
          )
        `);
        values.push(boolValue);
        paramIndex++;
      } else {
        conditions.push(`
          (
            LOWER(p.id::text) LIKE LOWER($${paramIndex})
            OR LOWER(p.sno::text) LIKE LOWER($${paramIndex})
            OR LOWER(p.upi_short_code) LIKE LOWER($${paramIndex})
            OR LOWER(p.status) LIKE LOWER($${paramIndex})
            OR LOWER(p.merchant_order_id) LIKE LOWER($${paramIndex})
            OR LOWER(p.user_submitted_utr) LIKE LOWER($${paramIndex})
            OR LOWER(p.user) LIKE LOWER($${paramIndex})
            OR LOWER(b.nick_name) LIKE LOWER($${paramIndex})
            OR LOWER(br.utr) LIKE LOWER($${paramIndex})
            OR LOWER(m.code) LIKE LOWER($${paramIndex})
            OR LOWER(v.code) LIKE LOWER($${paramIndex})
            OR p.amount::text LIKE $${paramIndex}
            OR br.amount::text LIKE $${paramIndex}
            OR LOWER(p.config->>'user') LIKE LOWER($${paramIndex})
            OR LOWER(p.config->'urls'->>'site') LIKE LOWER($${paramIndex})
            OR LOWER(p.config->'urls'->>'notify') LIKE LOWER($${paramIndex})
          )
        `);
        values.push(`%${term}%`);
        paramIndex++;
      }
    });

    if (conditions.length > 0) {
      queryText += ' AND (' + conditions.join(' OR ') + ')';
    }

    const countQuery = `SELECT COUNT(*) AS total FROM (${queryText}) AS count_table`;

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

    return {
      totalCount: totalItems,
      totalPages,
      payins: searchResult.rows,
    };
  } catch (error) {
    logger.error('Error in getPayinSearch:', error);
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
  if (!merchantOrderId || typeof merchantOrderId !== 'string') {
    throw new Error('Valid merchantOrderId is required');
  }

  let conn;
  const baseQuery = `
    SELECT 
      p.id AS payin_id,
      p.bank_acc_id,
      p.merchant_id,
      ba.user_id AS vendor_user_id,
      m.user_id AS merchant_user_id,
      p.created_at,
      p.status
    FROM public."Payin" p
    LEFT JOIN public."BankAccount" ba ON p.bank_acc_id = ba.id
    JOIN public."Merchant" m ON p.merchant_id = m.id
    WHERE p.merchant_order_id = $1
    AND p.is_obsolete = false
    LIMIT 1;
  `;

  try {
    conn = await getConnection();
    console.log(conn);
    const result = await conn.query(baseQuery, [merchantOrderId]);

    return result.rows;
  } catch (error) {
    const errorMessage = `Error fetching payin details for merchantOrderId ${merchantOrderId}: ${error.message}`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  } finally {
    if (conn) {
      try {
        await conn.release();
      } catch (releaseError) {
        console.error('Error releasing connection:', releaseError);
      }
    }
  }
};
