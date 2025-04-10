import { tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildJoinQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
  buildAndExecuteUpdateQuery,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';

export const createMerchantDao = async (data, conn) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.MERCHANT, data);
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error in createMerchantDao:', error);
    throw error.message;
  }
};

export const getMerchantsCodeDao = async (conn, company_id) => {
  try {
    const baseQuery = `SELECT 
    m.code AS label,  -- Parent Merchant Name
    m.user_id AS value,  -- Parent User ID
    m.id AS merchant_id,  -- Parent Merchant ID
    COALESCE(
        json_agg(
            json_build_object(
                'label', sm.code,  --child
                'value',sm.user_id, --child
                'merchant_id', sm.id --child
            )
        ) FILTER (WHERE sm.id IS NOT NULL), '[]'
    ) AS submerchants
FROM public."Merchant" m
LEFT JOIN public."UserHierarchy" uh 
    ON uh.config::jsonb ? m.user_id::TEXT  
LEFT JOIN public."Merchant" sm 
    ON sm.user_id IN (
        SELECT jsonb_array_elements_text(uh.config::jsonb->m.user_id::TEXT) 
    )  
WHERE m.company_id = $1
AND m.is_obsolete = FALSE  
GROUP BY m.id, m.code, m.user_id
ORDER BY m.code ASC;`;
    const queryParams = [company_id];
    const result = await conn.query(baseQuery, queryParams);
    return result.rows;
  } catch (error) {
    console.error('Error fetching company:', error);
    throw error.message;
  }
};

export const getMerchantsDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  // columns to select from db (optional)
  columns = [],
) => {
  try {
    const { USER, MERCHANT, DESIGNATION } = tableName;

    const joins = [
      {
        table: USER,
        // first is source key
        // second is target key
        keys: ['user_id', 'id'],
        type: 'JOIN',
        columns: ['designation_id'],
        columnAs: [
          `"${USER}".first_name || ' ' || "${USER}".last_name AS full_name`,
        ],
      },
      {
        table: DESIGNATION,
        // first is source key
        // second is target key
        keys: [`designation_id`, 'id'],
        type: 'LEFT JOIN',
        columnAs: [`"${DESIGNATION}".designation AS designation_name`],
        referenceTable: USER,
      },
    ];

    const baseQuery = buildJoinQuery(
      MERCHANT,
      columns?.length ? columns : '*',
      joins,
    );
    if (filters.search) {
      filters.or = buildSearchFilterObj(filters.search, MERCHANT);
      delete filters.search;
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
    return result.rows;
  } catch (error) {
    console.error('Error in getMerchantsDao:', error);
    throw error.message;
  }
};

export const getMerchantsBySearchDao = async (
  filters,
  searchTerms,
  limitNum,
  offset,
  // user_id
) => {
  try {
   const conditions = [];
    const values = [filters.company_id];
    let paramIndex = 2;

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
        "Merchant".created_by, 
        "Merchant".updated_by, 
        "Merchant".created_at, 
        "Merchant".updated_at, 
        "User".designation_id, 
        "User".first_name || ' ' || "User".last_name AS full_name, 
        "Designation".designation AS designation_name 
      FROM "Merchant" 
      JOIN "User" ON "Merchant".user_id = "User".id 
      LEFT JOIN "Designation" ON "User".designation_id = "Designation".id 
      WHERE 1=1 
      AND "Merchant".is_obsolete = false 
      AND "Merchant"."company_id" = $1
    `;

    searchTerms.forEach(term => {
      // it will handle boolean terms
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
        // it will handle text/numeric terms including JSON fields
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
            OR LOWER("Merchant".created_by::text) LIKE LOWER($${paramIndex})
            OR LOWER("Merchant".updated_by::text) LIKE LOWER($${paramIndex})
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

   const countQuery = `SELECT COUNT(*) as total FROM (${queryText}) as count_table`;

    queryText += `
      ORDER BY "Merchant"."created_at" DESC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `;
    values.push(limitNum, offset);

    const countResult = await executeQuery(countQuery, values.slice(0, -2));
    const searchResult = await executeQuery(queryText, values);

    // Calculate pagination metadata
    const totalItems = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalItems / limitNum);

    const data = {
      totalCount: totalItems,
      totalPages,
      merchants: searchResult.rows,
    };
    return data;
  } catch (error) {
    logger.error(error.message);
    throw error.message;
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
    console.error('Error in deleteMerchantDao:', error);
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
    console.error('Error in updateMerchantBalanceDao:', error);
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
    console.error('Error fetching merchant by code and API key:', error);
    throw error.message;
  }
};
