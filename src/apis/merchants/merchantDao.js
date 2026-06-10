import { tableName, Role } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
  buildAndExecuteUpdateQuery,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { enhanceMerchantsWithSubMerchants } from '../../utils/enhanceSubMerchant.js';
export const createMerchantDao = async (data, conn = null) => {
  try {
    delete data.parent_id;
    const [sql, params] = buildInsertQuery(tableName.MERCHANT, data);
    const result = await executeQuery(sql, params, conn);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in createMerchantDao:', error);
    throw error;
  }
};

export const getMerchantForEsDao = async (merchantId, conn = null) => {
  try {
    const sql = `
      SELECT 
        code,
        dispute_enabled,
        (config->'urls'->>'return') AS return_url,
        (config->'urls'->>'payin_notify') AS notify_url
      FROM "${tableName.MERCHANT}"
      WHERE id = $1
    `;
    const result = await executeQuery(sql, [merchantId], conn);
    return result.rows[0];
  } catch (error) {
    logger.error(
      `Error fetching merchant details for ID ${merchantId}:`,
      error,
    );
    throw error;
  }
};

export const getMerchantsCodeDao = async (
  filters,
  includeSubMerchants = false,
  includeOnlyMerchants = false,
  excludeDisabledMerchant = false,
  conn = null,
  allow_intent = null,
) => {
  try {
    //includeSubMerchants  convert string to boolean
    if (includeSubMerchants) {
      includeSubMerchants = includeSubMerchants.toLowerCase() === 'true';
    }
    if (includeOnlyMerchants) {
      includeOnlyMerchants = includeOnlyMerchants.toLowerCase() === 'true';
    }
    if (typeof allow_intent === 'string') {
      allow_intent = allow_intent.toLowerCase() === 'true';
    }
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
    if (excludeDisabledMerchant) {
      sql += ` AND m.is_enabled = TRUE `;
    }
    if (allow_intent === true) {
      sql += ` AND (m.config ->> 'allow_intent')::boolean = TRUE `;
    } 
    else if (allow_intent === false) {
      sql += ` AND (
        (m.config ->> 'allow_intent') IS NULL OR 
        (m.config ->> 'allow_intent')::boolean = FALSE
      ) `;
    }
    const queryParams = [];
    let paramIndex = 1;
    if (includeOnlyMerchants) {
      sql += `
      AND m.user_id IN (
          SELECT u.id 
          FROM "${tableName.USER}" u
          JOIN "${tableName.DESIGNATION}" d 
            ON u.designation_id = d.id 
          WHERE d.designation = 'MERCHANT'
        )
      `;
    }
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
    const result = await executeQuery(sql, queryParams, conn);
    logger.log('Fetched Merchants:', result.rows.length, 'rows');
    return result.rows;
  } catch (error) {
    logger.error('Error executing merchant query:', error);
    throw error;
  }
};
// get merchant with user_id  to get submerchant for user hierachys
export const getMerchantByUserIdDao = async (userId, conn = null) => {
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
      AND "Merchant"."user_id" ${Array.isArray(userId) ? '= ANY($1)' : '= $1'}
      ORDER BY "Merchant"."created_at" ASC;
    `;

    // Query parameters
    const queryParams = [userId];

    // Execute query
    const result = await executeQuery(sql, queryParams, conn);

    // Return the rows (merchant data)
    return result.rows;
  } catch (error) {
    logger.error(
      `Error in getMerchantByUserIdDao for user_id ${userId}:`,
      error,
    );
    throw error;
  }
};

//only for submerchant data
export const getMerchantByUserDao = async (userId, role, conn = null) => {
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
        CASE 
          WHEN $2 = 'ADMIN' 
            THEN (("Merchant".config::jsonb - ARRAY['keys', 'SUCCESSRATIOCHATID'])::json)
          ELSE 
            json_build_object(
            'urls', COALESCE("Merchant".config->'urls', '{}'),
            'unblocked_countries', COALESCE("Merchant".config->'unblocked_countries', '{}')
          )
        END AS config,
        creator.user_name AS created_by, 
        updater.user_name AS updated_by, 
        "Merchant".created_at, 
        "Merchant".updated_at, 
        CASE WHEN $2 = 'ADMIN' THEN "Merchant".company_id ELSE NULL END AS company_id, 
        CASE WHEN $2 = 'ADMIN' THEN "User".designation_id ELSE NULL END AS designation_id,
        "User".first_name || ' ' || "User".last_name AS full_name, 
        "Designation".designation AS designation_name 
      FROM "Merchant" 
      JOIN "User" ON "Merchant".user_id = "User".id 
      LEFT JOIN "Designation" ON "User".designation_id = "Designation".id
      LEFT JOIN "User" creator ON "Merchant".created_by = creator.id 
      LEFT JOIN "User" updater ON "Merchant".updated_by = updater.id
      WHERE "Merchant".is_obsolete = false 
      AND "Merchant"."user_id" ${Array.isArray(userId) ? '= ANY($1)' : '= $1'}
      ORDER BY "Merchant"."created_at" ASC;
    `;

    // Ensure role is a string or null
    const sanitizedRole = typeof role === 'undefined' ? null : role;

    // Query parameters
    const queryParams = [userId, sanitizedRole];

    // Execute query
    const result = await executeQuery(sql, queryParams, conn);

    // Return the rows (merchant data)
    return result.rows;
  } catch (error) {
    logger.error(
      `Error in getMerchantByUserIdDao for user_id ${userId}:`,
      error,
    );
    throw error;
  }
};
export const getMerchantsBankResponseDao = async (
  filters = {},
  conn = null,
) => {
  try {
    const selectColumns = `
      id,
      code,
      balance,
      payin_commission,
      user_id
    `;
    const [sql, params] = buildSelectQuery(
      `SELECT ${selectColumns} FROM "${tableName.MERCHANT}" WHERE 1=1`,
      filters,
    );
    const result = await executeQuery(sql, params, conn);
    return result.rows || [];
  } catch (error) {
    logger.error('Error fetching merchant data:', error);
    throw error;
  }
};

export const getMerchantByIdDao = async (id, company_id, conn = null) => {
  try {
    const sql = `
        SELECT id, user_id, code, payout_commission, config->'urls'->>'payout_notify' AS payout_notify 
          FROM "${tableName.MERCHANT}" WHERE id = $1 
          AND company_id = $2 
          AND is_obsolete = false`;
    const params = [id, company_id];
    const result = await executeQuery(sql, params, conn);
    return result?.rows;
  } catch (error) {
    logger.error(`Error in getMerchantByIdDao for ID ${id}:`, error.message);
    throw error;
  }
};
export const getMerchantForNotifyDao = async (
  filters = {},
  company_id,
  conn = null,
) => {
  try {
    const selectColumns = `
      id,
      code
    `;
    const baseQuery = `
      SELECT ${selectColumns}
      FROM "${tableName.MERCHANT}"
      WHERE is_obsolete = false
    `;
    const queryFilters = { ...filters };
    if (company_id !== undefined && company_id !== null) {
      queryFilters.company_id = company_id;
    }
    const [sql, params] = buildSelectQuery(baseQuery, queryFilters);
    const result = await executeQuery(sql, params, conn);
    return result.rows || [];
  } catch (error) {
    logger.error('Error in getMerchantForNotifyDao:', error);
    throw error;
  }
};
export const getMerchantForMigrateDao = async (
  filters = {},
  conn = null,
) => {
  try {
    const sql = `
      SELECT
        id,
        min_payin,
        max_payin,
        min_payout,
        max_payout,
        payin_commission,
        payout_commission,
        code,
        config
      FROM "Merchant"
      WHERE is_obsolete = false
        AND id = $1
      LIMIT 1
    `;
    const params = [filters.id];
    const result = await executeQuery(sql, params, conn);
    return result.rows?.[0] || null;
  } catch (error) {
    logger.error('Error in getMerchantForMigrateDao:', error);
    throw error;
  }
};

export const getMerchantsDao = async (
  filters,
  page = 1,
  pageSize = 10,
  sortBy = 'created_at',
  sortOrder = 'ASC',
  role,
  conn = null,
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
        "Merchant".config, 
        "Merchant".company_id, 
        creator.user_name AS created_by, 
        updater.user_name AS updated_by, 
        "Merchant".created_at, 
        "Merchant".updated_at, 
        "User".designation_id, 
        "User".first_name || ' ' || "User".last_name AS full_name, 
        "Designation".designation AS designation_name,
        (
          SELECT net_balance 
          FROM "Calculation" 
          WHERE "Calculation".user_id = "Merchant".user_id 
          ORDER BY "Calculation".created_at DESC 
          LIMIT 1
        ) AS balance
      FROM "Merchant" 
      JOIN "User" ON "Merchant".user_id = "User".id 
      LEFT JOIN "Designation" ON "User".designation_id = "Designation".id
      LEFT JOIN "User" creator ON "Merchant".created_by = creator.id 
      LEFT JOIN "User" updater ON "Merchant".updated_by = updater.id
      WHERE 1=1
    `;

    if (role === Role.ADMIN) {
      baseQuery += `
        AND "User".designation_id = (
          SELECT id FROM "Designation" WHERE designation = 'MERCHANT'
        )
      `;
    }

    if (filters.active !== undefined) {
      filters.is_enabled = filters.active === 'true' || filters.active === true;
      delete filters.active;
    }
    if (filters.deleted !== undefined) {
      filters.is_obsolete = filters.deleted === 'true' || filters.deleted === true;
      delete filters.deleted;
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
    const result = await executeQuery(sql, queryParams, conn);
    const data = await enhanceMerchantsWithSubMerchants(result.rows);
    return data;
  } catch (error) {
    logger.error('Error in getMerchantsDao:', error);
    throw error;
  }
};

export const getMerchantsForDashboardReportDao = async (
  filters = {},
  conn = null,
) => {
  try {
    const selectColumns = `
      user_id,
      COALESCE(config->>'sub_code', code) AS code
    `;
    const [sql, params] = buildSelectQuery(
      `SELECT ${selectColumns} FROM "${tableName.MERCHANT}" WHERE 1=1`,
      filters,
    );
    const result = await executeQuery(sql, params, conn);
    return result.rows || [];
  } catch (error) {
    logger.error('Error getting merchants data:', error);
    throw error;
  }
};

export const getMerchantsByCodeDao = async (code, api_key, conn = null) => {
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
      "Merchant".payout_commission, 
      "Merchant".min_payout, 
      "Merchant".max_payout, 
      "Merchant".config, 
      "Merchant".company_id, 
      creator.user_name AS created_by, 
      updater.user_name AS updated_by, 
      "Merchant".created_at, 
      "Merchant".updated_at, 
      "User".designation_id, 
      "User".first_name || ' ' || "User".last_name AS full_name, 
      "Designation".designation AS designation_name,
       (
          SELECT net_balance 
          FROM "Calculation" 
          WHERE "Calculation".user_id = "Merchant".user_id 
          ORDER BY "Calculation".created_at DESC 
          LIMIT 1
        ) AS balance
    FROM "Merchant" 
    JOIN "User" ON "Merchant".user_id = "User".id 
    LEFT JOIN "Designation" ON "User".designation_id = "Designation".id
    LEFT JOIN "User" creator ON "Merchant".created_by = creator.id 
    LEFT JOIN "User" updater ON "Merchant".updated_by = updater.id
    WHERE "Merchant".is_enabled = true AND "Merchant".is_obsolete = false
  `;

    let queryParams = [];
    if (code) {
      baseQuery += ` AND "Merchant".code = $1`;
      queryParams = [code.trim()];
    }
    // if (api_key) {
    //   queryParams.push(api_key);
    //   baseQuery += ` AND ("Merchant".config->'keys'->>'public' = $${queryParams.length} OR "Merchant".config->'keys'->>'private' = $${queryParams.length})`;
    // }

    const result = await executeQuery(baseQuery, queryParams, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error in getMerchants By Code Dao:', error);
    throw error;
  }
};

export const getMerchantsByCodeAndApiKeyDao = async (
  code,
  api_key,
  conn = null,
) => {
  try {
    if (!code || !api_key) return [];
    const cleanCode = code.trim();
    const cleanApiKey = api_key.trim();

    const query = `
      SELECT 
        m.id,
        m.user_id,
        m.code,
        m.min_payin,
        m.max_payin,

        jsonb_build_object(
          'keys', m.config->'keys',
          'urls', m.config->'urls',
          'is_h2h', (m.config->>'is_h2h')::boolean,
          'allow_intent', (m.config->>'allow_intent')::boolean,
          'whitelist_ips', m.config->'whitelist_ips'
        ) AS config,
        m.company_id,
        (u.first_name || ' ' || u.last_name) AS full_name
      FROM "Merchant" m
      INNER JOIN "User" u ON m.user_id = u.id
      WHERE 
        m.is_enabled = TRUE
        AND m.is_obsolete = FALSE
        AND m.code = $1
        AND (
          m.config->'keys'->>'public' = $2 OR 
          m.config->'keys'->>'private' = $2
        )
      LIMIT 1;
    `;

    const params = [cleanCode, cleanApiKey];

    const result = await executeQuery(query, params, conn);
    return result?.rows ?? [];
  } catch (error) {
    logger.error('Error in getMerchantsByCodeAndApiKeyDao:', error);
    throw error;
  }
};
export const  getMerchantsBalance = async (
  code,
  api_key,
  conn = null,
) => {
  try {
    if (!code || !api_key) return {};
    const cleanCode = code.trim();
    const cleanApiKey = api_key.trim();
    const query = `
      SELECT 
        m.user_id
      FROM "Merchant" m
      WHERE 
        m.is_enabled = TRUE
        AND m.is_obsolete = FALSE
        AND m.code = $1
        AND m.config->'keys'->>'private' = $2
    `;
    const params = [cleanCode, cleanApiKey];
    const result = await executeQuery(query, params, conn);
    console.log(result.rows[0]);
    return result?.rows[0] ?? {};
  } catch (error) {
    logger.error('Error in getMerchantsByCodeAndApiKeyDao:', error);
    throw error;
  }
};

export const getMerchantByCodeDao = async (code, conn = null) => {
  try {
    let baseQuery = `
      SELECT 
        "Merchant".id,
        "Merchant".code, 
        "Merchant".payin_commission, 
        "Merchant".payout_commission,
        "Merchant".min_payin,
        "Merchant".max_payin
      FROM "Merchant" 
    `;

    let queryParams = [];
    if (code) {
      baseQuery += ` WHERE "Merchant".code = $1`;
      queryParams = [code.trim()];
    }
    const result = await executeQuery(baseQuery, queryParams, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error in getMerchants By Code Dao:', error);
    throw error;
  }
};
export const getMerchantsForSuccessRatioDao = async (
  filters = {},
  conn = null,
) => {
  try {
    const selectColumns = `
      id,
      code,
      company_id,
      config
    `;
    const [sql, params] = buildSelectQuery(
      `SELECT ${selectColumns} FROM "${tableName.MERCHANT}" WHERE is_obsolete = false`,
      filters,
    );
    const result = await executeQuery(sql, params, conn);
    return result.rows || [];
  } catch (error) {
    logger.error('Error in getMerchantsForSuccessRatioDao:', error);
    throw error;
  }
};

export const getAllMerchantsDao = async (
  filters,
  page = 1,
  pageSize = 10,
  sortBy = 'created_at',
  sortOrder = 'ASC',
  role,
  conn = null,
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
        "Merchant".config, 
        "Merchant".company_id, 
        creator.user_name AS created_by, 
        updater.user_name AS updated_by, 
        "Merchant".created_at, 
        "Merchant".updated_at, 
        "User".designation_id, 
        "User".first_name || ' ' || "User".last_name AS full_name, 
        "Designation".designation AS designation_name,
        (
          SELECT net_balance 
          FROM "Calculation" 
          WHERE "Calculation".user_id = "Merchant".user_id 
          ORDER BY "Calculation".created_at DESC 
          LIMIT 1
        ) AS balance
      FROM "Merchant" 
      JOIN "User" ON "Merchant".user_id = "User".id 
      LEFT JOIN "Designation" ON "User".designation_id = "Designation".id
      LEFT JOIN "User" creator ON "Merchant".created_by = creator.id 
      LEFT JOIN "User" updater ON "Merchant".updated_by = updater.id
      WHERE 1=1
    `;

    if (role === Role.ADMIN) {
      baseQuery += `
        AND "User".designation_id = (
          SELECT id FROM "Designation" WHERE designation = 'MERCHANT'
        )
      `;
    }

    if (filters.active !== undefined) {
      filters.is_enabled = filters.active === 'true' || filters.active === true;
      delete filters.active;
    }
    if (filters.deleted !== undefined) {
      filters.is_obsolete = filters.deleted === 'true' || filters.deleted === true;
      delete filters.deleted;
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
    const result = await executeQuery(sql, queryParams, conn);
    const data = await enhanceMerchantsWithSubMerchants(result.rows);
    return data;
  } catch (error) {
    logger.error('Error in getMerchantsDao:', error);
    throw error;
  }
};

export const getMerchantsBySearchDao = async (
  filters,
  page = 1,
  pageSize = 10,
  sortBy = 'updated_at',
  sortOrder = 'ASC',
  role,
  searchTerms = [],
  conn = null,
) => {
  try {
    const conditions = [];
    const values = [filters.company_id];
    let paramIndex = 2;

    values.push(role);
    const roleParamIndex = paramIndex;
    paramIndex++;

    const limitNum =
      parseInt(filters.limit, 10) || parseInt(pageSize, 10) || 10;
    const pageNum = parseInt(filters.page, 10) || parseInt(page, 10) || 1;
    let offset = (pageNum - 1) * limitNum;

    const sortField = sortBy || 'updated_at';
    const orderDirection = ['ASC', 'DESC'].includes(sortOrder?.toUpperCase())
      ? sortOrder.toUpperCase()
      : 'DESC';
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
        CASE 
          WHEN $${roleParamIndex} = 'ADMIN' 
        THEN (("Merchant".config::jsonb - ARRAY['keys', 'SUCCESSRATIOCHATID'])::json)
          ELSE 
        json_build_object(
          'urls', COALESCE("Merchant".config->'urls', '{}'),
          'unblocked_countries', COALESCE("Merchant".config->'unblocked_countries', '{}')
        )
        END AS config,
        CASE WHEN $2 = 'ADMIN' THEN "Merchant".company_id ELSE NULL END AS company_id, 
        creator.user_name AS created_by, 
        updater.user_name AS updated_by, 
        "Merchant".created_at, 
        "Merchant".updated_at, 
        CASE WHEN $2 = 'ADMIN' THEN "User".designation_id ELSE NULL END AS designation_id,
        "User".first_name || ' ' || "User".last_name AS full_name, 
        "Designation".designation AS designation_name,
        (SELECT net_balance 
         FROM "Calculation" 
         WHERE "Calculation".user_id = "Merchant".user_id 
         ORDER BY "Calculation".created_at DESC 
         LIMIT 1) AS balance
      FROM "Merchant" 
      JOIN "User" ON "Merchant".user_id = "User".id 
      LEFT JOIN "Designation" ON "User".designation_id = "Designation".id
      LEFT JOIN "User" creator ON "Merchant".created_by = creator.id 
      LEFT JOIN "User" updater ON "Merchant".updated_by = updater.id
      WHERE "Merchant".is_obsolete = false 
      AND "Merchant"."company_id" = $1
    `;

    if (role === Role.ADMIN && searchTerms.length > 0) {
      queryText += `
        AND (
          "User".designation_id = (SELECT id FROM "Designation" WHERE designation = 'MERCHANT')
          OR "User".designation_id = (SELECT id FROM "Designation" WHERE designation = 'SUB_MERCHANT')
        )
      `;
    } else if (role === Role.ADMIN) {
      queryText += `
        AND "User".designation_id = (
          SELECT id FROM "Designation" WHERE designation = 'MERCHANT'
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

    // Handle active filter (is_enabled)
    if (filters.active !== undefined) {
      const activeValue = filters.active === 'true' || filters.active === true;
      queryText += ` AND "Merchant".is_enabled = $${paramIndex}`;
      values.push(activeValue);
      paramIndex += 1;
    }

    // Handle deleted filter (is_obsolete)
    if (filters.deleted !== undefined) {
      const deletedValue = filters.deleted === 'true' || filters.deleted === true;
      queryText += ` AND "Merchant".is_obsolete = $${paramIndex}`;
      values.push(deletedValue);
      paramIndex += 1;
    }

    if (searchTerms.length > 0) {
      for (const term of searchTerms) {
        if (term.toLowerCase() === 'true' || term.toLowerCase() === 'false') {
          const boolValue = term.toLowerCase() === 'true';
          conditions.push(`
            (
              "Merchant".is_test_mode = $${paramIndex}
              OR "Merchant".is_enabled = $${paramIndex}
              OR "Merchant".dispute_enabled = $${paramIndex}
              OR "Merchant".is_demo = $${paramIndex}
              OR ("Merchant".config->'allow_intent')::boolean = $${paramIndex}
            )
          `);
          values.push(boolValue);
          paramIndex++;
        } else {
          let conditionBlock = `
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
        OR LOWER("Merchant".config->'urls'->>'site') LIKE LOWER($${paramIndex})
        OR LOWER("Merchant".config->'urls'->>'return') LIKE LOWER($${paramIndex})
        OR LOWER("Merchant".config->'urls'->>'payin_notify') LIKE LOWER($${paramIndex})
        OR LOWER("Merchant".config->'urls'->>'payout_notify') LIKE LOWER($${paramIndex})
        OR (
          SELECT net_balance::text 
          FROM "Calculation" 
          WHERE "Calculation".user_id = "Merchant".user_id 
          ORDER BY "Calculation".created_at DESC 
          LIMIT 1
        ) LIKE $${paramIndex}
    `;
          if (role === 'ADMIN') {
            conditionBlock += `
        OR LOWER("Merchant".config::text) LIKE LOWER($${paramIndex})
      `;
          }
          conditionBlock += `)`;
          conditions.push(conditionBlock);
          values.push(`%${term}%`);
          paramIndex++;
        }
      }
    }

    if (conditions.length > 0) {
      queryText += ' AND (' + conditions.join(' OR ') + ')';
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${queryText}) AS count_table`;

    queryText += `
      ORDER BY "${sortField}" ${orderDirection}
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `;
    values.push(limitNum, offset);

    const countResult = await executeQuery(
      countQuery,
      values.slice(0, -2),
      conn,
    );
    let searchResult = await executeQuery(queryText, values, conn);

    const totalItems = parseInt(countResult.rows[0].total, 10);
    let totalPages = Math.ceil(totalItems / limitNum);

    if (totalItems > 0 && searchResult.rows.length === 0 && offset > 0) {
      values[values.length - 1] = 0;
      searchResult = await executeQuery(queryText, values, conn);
      totalPages = Math.ceil(totalItems / limitNum);
    }

    const data = await enhanceMerchantsWithSubMerchants(
      searchResult.rows,
      role,
    );

    return {
      totalCount: totalItems,
      totalPages,
      merchants: data,
    };
  } catch (error) {
    logger.error('Error in getMerchantsBySearchDao', error.message);
    throw error;
  }
};
export const getMerchantsForValidatePayinDao = async (filters, conn = null) => {
  try {
    let query = `
    SELECT id, code, min_payin, max_payin, config
    FROM public."Merchant"
    WHERE is_obsolete = false
    and id = $1
  `;
    const params = [filters.id];
    const result = await executeQuery(query, params, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error in getMerchantsForValidatePayinDao:', error.message);
    throw error;
  }
};

export const updateMerchantDao = async (ids, data, conn = null) => {
  return await buildAndExecuteUpdateQuery(
    'Merchant',
    data,
    ids,
    {},
    { returnUpdated: true },
    conn,
  );
};

export const migrateMerchantDao = async (ids, data, conn = null) => {
  try {
  const [sql, params] = buildUpdateQuery(tableName.MERCHANT, data, ids);
    const result = await executeQuery(sql, params, conn);
    return result;
} catch (error) {
    logger.error('Error in migrateMerchantDao:', error)
    throw error  ;
}
}

export const deleteMerchantDao = async (
  ids,
  data,
  conn = null,
  options = { returnUpdated: true },
) => {
  try {
    const { id, company_id } = ids;
    const idArray = Array.isArray(id) ? id : [id];

    const is_obsolete = true;
    const updated_by = data.updated_by;

    const values = [is_obsolete, updated_by, idArray, company_id];

    const returningClause = options.returnUpdated ? 'RETURNING *' : '';

    const sql = `
      UPDATE "Merchant"
      SET "is_obsolete" = $1,
          "updated_by" = $2
      WHERE "id" = ANY($3)
        AND "company_id" = $4
      ${returningClause}
    `;

    const result = await executeQuery(sql, values, conn);

    return result.rows;
  } catch (error) {
    logger.error('Error in deleteMerchantDao:', error);
    throw error;
  }
};

export const updateMerchantBalanceDao = async (
  filters,
  valueToAdd,
  updated_by,
  conn = null,
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
    const result = await executeQuery(sql, params, conn);
    return result[0];
  } catch (error) {
    logger.error('Error in updateMerchantBalanceDao:', error);
    throw error;
  }
};

export const getMerchantByCodeAndApiKey = async (
  code,
  publicKey,
  conn = null,
) => {
  try {
    const query = `
      SELECT * 
      FROM "${tableName.MERCHANT}" 
      WHERE code = $1 
      AND (config->'keys'->>'public' = $2 OR config->'keys'->>'private' = $2) 
      AND is_obsolete = false
    `;
    const params = [code, publicKey];
    const result = await executeQuery(query, params, conn);
    return result.rows[0]; // Return the first matching merchant
  } catch (error) {
    logger.error('Error fetching merchant by code and API key:', error);
    throw error;
  }
};

export const getMerchantsDaoArray = async (company_id, codes, conn = null) => {
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
      WHERE "Merchant".company_id = $1 AND "Merchant".is_obsolete = false
    `;

    let queryParams = [company_id];

    // Handle both user_id arrays and code arrays
    if (Array.isArray(codes) && codes.length > 0) {
      // Check if the first element looks like a UUID (user_id) or a code
      const firstCode = codes[0];
      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          firstCode,
        );

      if (isUUID) {
        // These are user_ids
        baseQuery += ` AND "Merchant".user_id = ANY($2)`;
        queryParams.push(codes);
      } else {
        // These are merchant codes
        baseQuery += ` AND "Merchant".code = ANY($2)`;
        queryParams.push(codes);
      }
    }

    const result = await executeQuery(baseQuery, queryParams, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching merchants by codes/user_ids:', error);
    throw error;
  }
};

// Lightweight fetch for merchant config by 
export const getMerchantConfigByUserIdDao = async (userId, conn = null) => {
  try {
    const sql = `
      SELECT user_id, config, code,
             first_name || ' ' || last_name AS name
      FROM "Merchant"
      WHERE user_id = $1 AND is_obsolete = false
      LIMIT 1
    `;
    const result = await executeQuery(sql, [userId], conn);
    return result.rows;
  } catch (error) {
    logger.error(`Error in getMerchantConfigByUserIdDao for user_id ${userId}:`, error);
    throw error;
  }
};

// Batch fetch merchants by array of codes
export const getMerchantsByCodesDao = async (codes = [], conn = null) => {
  if (!Array.isArray(codes) || codes.length === 0) return [];
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
        "Merchant".payout_commission, 
        "Merchant".min_payout, 
        "Merchant".max_payout, 
        "Merchant".config, 
        "Merchant".company_id, 
        creator.user_name AS created_by, 
        updater.user_name AS updated_by, 
        "Merchant".created_at, 
        "Merchant".updated_at, 
        "User".designation_id, 
        "User".first_name || ' ' || "User".last_name AS full_name, 
        "Designation".designation AS designation_name,
         (
            SELECT net_balance 
            FROM "Calculation" 
            WHERE "Calculation".user_id = "Merchant".user_id 
            ORDER BY "Calculation".created_at DESC 
            LIMIT 1
          ) AS balance
      FROM "Merchant" 
      JOIN "User" ON "Merchant".user_id = "User".id 
      LEFT JOIN "Designation" ON "User".designation_id = "Designation".id
      LEFT JOIN "User" creator ON "Merchant".created_by = creator.id 
      LEFT JOIN "User" updater ON "Merchant".updated_by = updater.id
      WHERE "Merchant".is_enabled = true AND "Merchant".is_obsolete = false
        AND "Merchant".code = ANY($1::text[])
    `;
    const result = await executeQuery(baseQuery, [codes], conn);
    return result.rows;
  } catch (error) {
    logger.error('Error in getMerchantsByCodesDao:', error);
    throw error;
  }
};