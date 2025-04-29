import { tableName,Role } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
  buildAndExecuteUpdateQuery,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { enhanceMerchantsWithSubMerchants } from '../../utils/enhanceSubMerchant.js';
export const createMerchantDao = async (data, conn) => {
  try {
    delete data.parent_id;
    const [sql, params] = buildInsertQuery(tableName.MERCHANT, data);
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in createMerchantDao:', error);
    throw error.message;
  }
};

export const getMerchantsCodeDao = async (
  conn,
  filters,
  includeSubMerchants = false,
) => {
  try {
    let sql = `
      SELECT 
        m.code AS label, 
        m.user_id AS value, 
        m.id AS merchant_id,
        ${
          includeSubMerchants
            ? `
              COALESCE(
                json_agg(
                  json_build_object(
                    'label', sm.code,
                    'value', sm.user_id,
                    'merchant_id', sm.id
                  )
                ) FILTER (WHERE sm.id IS NOT NULL),
                '[]'::json
              ) AS submerchants
            `
            : `'[]'::json AS submerchants`
        }
      FROM 
        "${tableName.MERCHANT}" m
      LEFT JOIN "${tableName.USER_HIERARCHY}" uh 
        ON uh.user_id = m.user_id
      LEFT JOIN "${tableName.MERCHANT}" sm 
        ON sm.user_id IN (
          SELECT json_array_elements_text(uh.config -> 'siblings' -> 'sub_merchants')
          FROM "${tableName.USER_HIERARCHY}" uh_sub
          WHERE uh_sub.user_id = m.user_id
          AND uh_sub.config -> 'siblings' -> 'sub_merchants' IS NOT NULL
        )
        AND sm.company_id = m.company_id
        AND sm.is_obsolete = FALSE
      WHERE 
        m.is_obsolete = FALSE
    `;
    const queryParams = [];
    let paramIndex = 1;

    if (filters.company_id) {
      sql += ` AND m.company_id = $${paramIndex++}`;
      queryParams.push(filters.company_id);
    }
    if (filters.user_id) {
      if (Array.isArray(filters.user_id)) {
        sql += ` AND m.user_id = ANY($${paramIndex++})`;
        queryParams.push(filters.user_id);
      } else {
        sql += ` AND m.user_id = $${paramIndex++}`;
        queryParams.push(filters.user_id);
      }
    }

    sql += ` GROUP BY m.id, m.code, m.user_id ORDER BY m.code ASC`;
    const result = await conn.query(sql, queryParams);
    logger.log('Fetched Merchants:', result.rows.length, 'rows');
    return result.rows;
  } catch (error) {
    logger.error('Error executing merchant query:', error);
    throw new Error('Database query failed');
  }
};
// get merchant with user_id  to get submerchant for user hierachys
export const getMerchantByUserIdDao = async (userId) => {
  try {
    const sql = `
      SELECT 
        "Merchant".id, 
        "Merchant".user_id, 
        "Merchant".first_name, 
        "Merchant".last_name, 
        "Merchant".code, 
        "Merchant".min_payin, 
        "Merchant".max_payin, 
        "Merchant".payin_commission, 
        "Merchant".min_payout, 
        "Merchant".max_payout, 
        "Merchant".payout_commission, 
        "Merchant".is_test_mode, 
        "Merchant".is_enabled, 
        "Merchant".dispute_enabled, 
        "Merchant".is_demo, 
        "Merchant".balance, 
        "Merchant".config, 
        creator.user_name AS created_by, 
        updater.user_name AS updated_by, 
        "Merchant".created_at, 
        "Merchant".updated_at, 
        "User".designation_id, 
        "User".first_name || ' ' || "User".last_name AS full_name, 
        "Designation".designation AS designation_name 
      FROM "Merchant" 
      JOIN "User" ON "Merchant".user_id = "User".id 
      LEFT JOIN "Designation" ON "User".designation_id = "Designation".id
      LEFT JOIN "User" creator ON "Merchant".created_by = creator.id 
      LEFT JOIN "User" updater ON "Merchant".updated_by = updater.id
      WHERE  "Merchant".is_obsolete = false 
      AND "Merchant"."user_id" = $1
      ORDER BY "Merchant"."created_at" ASC;
    `;

    // Query parameters
    const queryParams = [userId];

    // Execute query
    const result = await executeQuery(sql, queryParams);

    // Return the rows (merchant data)
    return result.rows;
  } catch (error) {
    logger.error(
      `Error in getMerchantByUserIdDao for user_id ${userId}:`,
      error,
    );
    throw error.message;
  }
};
export const getMerchantsDao = async (
  filters,
  page = 0,
  pageSize = 10,
  sortBy = 'created_at',
  sortOrder = 'ASC',
  // columns to select from db (optional)
  role
) => {
  try {

  let baseQuery = `
  SELECT 
    "Merchant".id, 
    "Merchant".user_id, 
    "Merchant".first_name, 
    "Merchant".last_name, 
    "Merchant".code, 
    "Merchant".min_payin, 
    "Merchant".max_payin, 
    "Merchant".payin_commission, 
    "Merchant".min_payout, 
    "Merchant".max_payout, 
    "Merchant".payout_commission, 
    "Merchant".is_test_mode, 
    "Merchant".is_enabled, 
    "Merchant".dispute_enabled, 
    "Merchant".is_demo, 
    "Merchant".balance, 
    "Merchant".config, 
    "Merchant".company_id, 
    creator.user_name AS created_by, 
    updater.user_name AS updated_by, 
    "Merchant".created_at, 
    "Merchant".updated_at, 
    "User".designation_id, 
    "User".first_name || ' ' || "User".last_name AS full_name, 
    "Designation".designation AS designation_name 
  FROM "Merchant" 
  JOIN "User" ON "Merchant".user_id = "User".id 
  LEFT JOIN "Designation" ON "User".designation_id = "Designation".id
  LEFT JOIN "User" creator ON "Merchant".created_by = creator.id 
  LEFT JOIN "User" updater ON "Merchant".updated_by = updater.id
      `
  if (role == Role.ADMIN) {
    baseQuery += `
        WHERE "User".designation_id = (SELECT id FROM "Designation" WHERE designation = 'MERCHANT')
      `;
  }
    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
      tableName.MERCHANT,
    );
    // Execute query
    const result = await executeQuery(sql, queryParams);
    const data = await enhanceMerchantsWithSubMerchants(result.rows);
    return data;
  } catch (error) {
    logger.error('Error in getMerchantsDao:', error);
    throw error.message;
  }
};

export const getMerchantsBySearchDao = async (
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

    // Base query for merchants
    let queryText = `
      SELECT 
        "Merchant".id, 
        "Merchant".user_id, 
        "Merchant".first_name, 
        "Merchant".last_name, 
        "Merchant".code, 
        "Merchant".min_payin, 
        "Merchant".max_payin, 
        "Merchant".payin_commission, 
        "Merchant".min_payout, 
        "Merchant".max_payout, 
        "Merchant".payout_commission, 
        "Merchant".is_test_mode, 
        "Merchant".is_enabled, 
        "Merchant".dispute_enabled, 
        "Merchant".is_demo, 
        "Merchant".balance, 
        "Merchant".config, 
        "Merchant".company_id, 
        creator.user_name as created_by, 
        updater.user_name as updated_by, 
        "Merchant".created_at, 
        "Merchant".updated_at, 
        "User".designation_id, 
        "User".first_name || ' ' || "User".last_name AS full_name, 
        "Designation".designation AS designation_name 
      FROM "Merchant" 
      JOIN "User" ON "Merchant".user_id = "User".id 
      LEFT JOIN "Designation" ON "User".designation_id = "Designation".id
      LEFT JOIN "User" creator ON "Merchant".created_by = creator.id 
      LEFT JOIN "User" updater ON "Merchant".updated_by = updater.id
      WHERE "Merchant".is_obsolete = false
        AND "Merchant"."company_id" = $1
    `;

    // Apply designation filter for ADMIN role, but allow sub-merchants in search
    if (role === Role.ADMIN) {
      queryText += `
        AND (
          "User".designation_id = (SELECT id FROM "Designation" WHERE designation = 'MERCHANT')
          OR "User".designation_id = (SELECT id FROM "Designation" WHERE designation = 'SUB_MERCHANT')
        )
      `;
    }

    if (filters.user_id) {
      if (Array.isArray(filters.user_id)) {
        const placeholders = filters.user_id
          .map((_, i) => `$${paramIndex + i}`)
          .join(', ');
        queryText += ` AND "Merchant"."user_id" IN (${placeholders})`;
        values.push(...filters.user_id);
        paramIndex += filters.user_id.length;
      } else {
        queryText += ` AND "Merchant"."user_id" = $${paramIndex}`;
        values.push(filters.user_id);
        paramIndex++;
      }
    }

    searchTerms.forEach((term) => {
      if (term.toLowerCase() === 'true' || term.toLowerCase() === 'false') {
        const boolVal = term.toLowerCase() === 'true';
        conditions.push(`
          (
            "Merchant".is_test_mode = $${paramIndex}
            OR "Merchant".is_enabled = $${paramIndex}
            OR "Merchant".dispute_enabled = $${paramIndex}
            OR "Merchant".is_demo = $${paramIndex}
            OR ("Merchant".config->'allow_intent')::boolean = $${paramIndex}
          )
        `);
        values.push(boolVal);
        paramIndex++;
      } else {
        conditions.push(`
          (
            LOWER("Merchant".id::text) LIKE LOWER($${paramIndex})
            OR LOWER("Merchant".user_id::text) LIKE LOWER($${paramIndex})
            OR LOWER("Merchant".first_name) LIKE LOWER($${paramIndex})
            OR LOWER("Merchant".last_name) LIKE LOWER($${paramIndex})
            OR LOWER("Merchant".code) LIKE LOWER($${paramIndex})
            OR "Merchant".min_payin::text LIKE $${paramIndex}
            OR "Merchant".max_payin::text LIKE $${paramIndex}
            OR "Merchant".payin_commission::text LIKE $${paramIndex}
            OR "Merchant".min_payout::text LIKE $${paramIndex}
            OR "Merchant".max_payout::text LIKE $${paramIndex}
            OR "Merchant".payout_commission::text LIKE $${paramIndex}
            OR LOWER(creator.user_name) LIKE LOWER($${paramIndex})
            OR LOWER(updater.user_name) LIKE LOWER($${paramIndex})
            OR LOWER("User".first_name || ' ' || "User".last_name) LIKE LOWER($${paramIndex})
            OR LOWER("Designation".designation) LIKE LOWER($${paramIndex})
            OR LOWER("Merchant".config->'keys'->>'public') LIKE LOWER($${paramIndex})
            OR LOWER("Merchant".config->'keys'->>'private') LIKE LOWER($${paramIndex})
            OR LOWER("Merchant".config->'urls'->>'site') LIKE LOWER($${paramIndex})
            OR LOWER("Merchant".config->'urls'->>'return') LIKE LOWER($${paramIndex})
            OR LOWER("Merchant".config->'urls'->>'payin_notify') LIKE LOWER($${paramIndex})
            OR LOWER("Merchant".config->'urls'->>'payout_notify') LIKE LOWER($${paramIndex})
          )
        `);
        values.push(`%${term}%`);
        paramIndex++;
      }
    });

    if (conditions.length > 0) {
      queryText += ' AND (' + conditions.join(' OR ') + ')';
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${queryText}) AS count_table`;

    queryText += `
      ORDER BY "Merchant"."created_at" DESC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `;

    values.push(limitNum, offset);
    const countResult = await executeQuery(countQuery, values.slice(0, -2));
    const searchResult = await executeQuery(queryText, values);
    const data = await enhanceMerchantsWithSubMerchants(searchResult.rows);
    return {
      totalCount: parseInt(countResult.rows[0].total),
      totalPages: Math.ceil(countResult.rows[0].total / limitNum),
      merchants: data,
    };
  } catch (error) {
    logger.error('Error in getMerchantsBySearchDao', error.message);
    throw new Error(error.message);
  }
};

export const updateMerchantDao = async (ids, data, conn) => {
  return await buildAndExecuteUpdateQuery('Merchant', data, ids, {}, { returnUpdated: true }, conn);
};

export const deleteMerchantDao = async (ids, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.MERCHANT, data, ids);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in deleteMerchantDao:', error);
    throw error.message;
  }
};

export const updateMerchantBalanceDao = async (
  filters,
  valueToAdd,
  updated_by,
  conn,
) => {
  try {
    const [sql, params] = buildUpdateQuery(
      tableName.MERCHANT,
      { balance: valueToAdd, updated_by },
      filters,
      { balance: '+' },
    );
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result[0];
  } catch (error) {
    logger.error('Error in updateMerchantBalanceDao:', error);
    throw error.message;
  }
};

export const getMerchantByCodeAndApiKey = async (code, publicKey) => {
  try {
    const query = `
      SELECT * 
      FROM "${tableName.MERCHANT}" 
      WHERE code = $1 AND config->'keys'->>'public' = $2 AND is_obsolete = false
    `;
    const params = [code, publicKey];
    const result = await executeQuery(query, params);
    return result.rows[0]; // Return the first matching merchant
  } catch (error) {
    logger.error('Error fetching merchant by code and API key:', error);
    throw error.message;
  }
};
