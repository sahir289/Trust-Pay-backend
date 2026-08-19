import { Role, tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import {
  getUserHierarchyVendor,
  updateUserHierarchyVendor,
} from '../userHierarchy/userHierarchyDao.js';
// import { buildSearchFilterObj } from '../../utils/searchBuilder.js';
import { logger } from '../../utils/logger.js';
import { enhanceVendorsWithSubVendors } from '../../utils/enhanceSubVendor.js';

export const createVendorDao = async (data, conn = null) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.VENDOR, data);
    const result = await executeQuery(sql, params, conn);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in create Vendor Dao:', error);
    throw error;
  }
};

export const getVendorCodeDao = async (id, conn = null) => {
  try {
    const sql = `SELECT code FROM "${tableName.VENDOR}" WHERE id = $1`;
    const result = await executeQuery(sql, [id], conn);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error fetching vendor by ID:', error);
    throw error;
  }
};

export const getVendorsBankReponseDao = async (filters = {}, conn = null) => {
  try {
    let sql = `
      SELECT 
        v.id,
        v.user_id,
        v.code,
        v.balance,
        v.payin_commission,
        v.config,
        d.designation
      FROM "${tableName.VENDOR}" v 
      JOIN "${tableName.USER}" u ON v.user_id = u.id 
      LEFT JOIN "${tableName.DESIGNATION}" d ON u.designation_id = d.id 
      WHERE v.is_obsolete = false AND u.is_obsolete = false
    `;

    const params = [];
    let paramIndex = 1;

    // Handle filters manually
    if (filters.user_id) {
      if (Array.isArray(filters.user_id)) {
        sql += ` AND v.user_id = ANY($${paramIndex})`;
        params.push(filters.user_id);
      } else {
        sql += ` AND v.user_id = $${paramIndex}`;
        params.push(filters.user_id);
      }
      paramIndex++;
    }

    if (filters.company_id) {
      sql += ` AND v.company_id = $${paramIndex}`;
      params.push(filters.company_id);
      paramIndex++;
    }

    if (filters.code) {
      sql += ` AND v.code = $${paramIndex}`;
      params.push(filters.code);
      paramIndex++;
    }

    sql += ` ORDER BY v.created_at DESC`;

    const result = await executeQuery(sql, params, conn);
    return result.rows || [];
  } catch (error) {
    logger.error('Error fetching vendor data:', error);
    throw error;
  }
};

export const getVendorByAuthCodeDao = async (filters = {}, conn = null) => {
  try {
    let sql = `
      SELECT 
        v.id,
        v.user_id,
        v.code,
        v.balance,
        v.payin_commission,
        v.config,
        v.company_id,
        (
            SELECT COALESCE(
                json_agg(
                    json_build_object(
                        'id', ba.id,
                        'nick_name', ba.nick_name,
                        'secretKey', ba.config->'keys'->>'secretKey'
                    )
                ),
                '[]'::json
            )
            FROM "${tableName.BANK_ACCOUNT}" ba
            WHERE ba.user_id = v.user_id
            AND ba.is_obsolete = false
        ) AS banks
      FROM "${tableName.VENDOR}" v 
      WHERE v.is_obsolete = false
    `;

    const params = [];
    let paramIndex = 1;

    if (filters.code) {
      sql += ` AND v.code = $${paramIndex}`;
      params.push(filters.code);
      paramIndex++;
    }

    sql += ` ORDER BY v.created_at DESC LIMIT 1`;

    const result = await executeQuery(sql, params, conn);
    return result.rows?.[0] || {};
  } catch (error) {
    logger.error('Error fetching vendor data:', error);
    throw error;
  }
};

export const getVendorsDashBoardReportDao = async (filters = {}, conn = null) => {
  try {
    const selectColumns = `
      user_id,
      code
    `;
    const [sql, params] = buildSelectQuery(
      `SELECT ${selectColumns} FROM "${tableName.VENDOR}" WHERE 1=1`,
      filters,
    );
    const result = await executeQuery(sql, params, conn);
    return result.rows || [];
  } catch (error) {
    logger.error('Error getting vendor data:', error);
    throw error;
  }
};
export const getVendorsCodeDao = async (
  filters,
  includeSubVendors = false,
  includeOnlyVendors = false,
  excludeDisabledVendor = false,
  includeSeperateSubVendors = false,
  includeVendorAdmin = false,
  isEnabled = false,
  conn = null,
) => {
  try {
    // Convert string to boolean
    if (includeSubVendors) {
      includeSubVendors = includeSubVendors.toLowerCase() === 'true';
    }
    if (includeOnlyVendors) {
      includeOnlyVendors = includeOnlyVendors.toLowerCase() === 'true';
    }
    if (includeVendorAdmin) {
      includeVendorAdmin = includeVendorAdmin.toLowerCase() === 'true';
    }
    if (includeSeperateSubVendors) {
      includeSeperateSubVendors =
        includeSeperateSubVendors.toLowerCase() === 'true';
    }
    if (isEnabled) {
      isEnabled = isEnabled.toLowerCase() === 'true';
    }
    let sql = `
      SELECT 
        v.code AS label, 
        v.user_id AS value, 
        v.id AS vendor_id,
        ${includeSubVendors
        ? `
              COALESCE(
                json_agg(
                  json_build_object(
                    'label', sv.code,
                    'value', sv.user_id,
                    'vendor_id', sv.id
                  )
                ) FILTER (WHERE sv.id IS NOT NULL),
                '[]'::json
              ) AS subvendors
            `
        : `'[]'::json AS subvendors`
      }
      FROM 
        "${tableName.VENDOR}" v
      LEFT JOIN "${tableName.USER_HIERARCHY}" uh 
        ON uh.user_id = v.user_id
      LEFT JOIN "${tableName.VENDOR}" sv 
        ON sv.user_id IN (
          SELECT json_array_elements_text(uh.config -> 'siblings' -> 'sub_vendors')
          FROM "${tableName.USER_HIERARCHY}" uh_sub
          WHERE uh_sub.user_id = v.user_id
          AND uh_sub.config -> 'siblings' -> 'sub_vendors' IS NOT NULL
        )
        AND sv.company_id = v.company_id
        AND sv.is_obsolete = FALSE
      WHERE 
        v.is_obsolete = FALSE
    `;

    if (excludeDisabledVendor) {
      sql += ` AND (v.config->>'is_enabled')::boolean = true`;
    }

    const queryParams = [];
    let paramIndex = 1;
    if (includeVendorAdmin && includeOnlyVendors && includeSubVendors) {
      sql += `
         AND v.user_id IN (
             SELECT u.id 
             FROM "${tableName.USER}" u
             JOIN "${tableName.DESIGNATION}" d 
               ON u.designation_id = d.id 
             WHERE d.designation IN ('VENDOR_ADMIN','VENDOR','SUB_VENDOR')  
         )
       `;
    } else if (includeVendorAdmin && includeOnlyVendors) {
      sql += `
         AND v.user_id IN (
             SELECT u.id 
             FROM "${tableName.USER}" u
             JOIN "${tableName.DESIGNATION}" d 
               ON u.designation_id = d.id 
             WHERE d.designation IN ('VENDOR_ADMIN', 'VENDOR')  
         )
       `;
    } else if (includeOnlyVendors && !includeVendorAdmin) {
      sql += `
      AND v.user_id IN (
          SELECT u.id 
          FROM "${tableName.USER}" u
          JOIN "${tableName.DESIGNATION}" d 
            ON u.designation_id = d.id 
          WHERE d.designation = 'VENDOR'
        )
      `;
    } else if (includeVendorAdmin && !includeOnlyVendors) {
      sql += `
      AND v.user_id IN (
          SELECT u.id 
          FROM "${tableName.USER}" u
          JOIN "${tableName.DESIGNATION}" d 
            ON u.designation_id = d.id 
          WHERE d.designation = 'VENDOR_ADMIN'
        )
      `;
    } else {
      sql += `
      AND v.user_id IN (
          SELECT u.id 
          FROM "${tableName.USER}" u
          JOIN "${tableName.DESIGNATION}" d 
            ON u.designation_id = d.id 
          WHERE d.designation != 'VENDOR_ADMIN'
      )
    `;
    }
    if (isEnabled) {
      sql += ` AND (v.config->>'is_enabled')::boolean = true`;
    }

    if (filters.company_id) {
      sql += ` AND v.company_id = $${paramIndex++}`;
      queryParams.push(filters.company_id);
    }

    if (filters.user_id) {
      if (Array.isArray(filters.user_id)) {
        sql += ` AND v.user_id = ANY($${paramIndex++})`;
        queryParams.push(filters.user_id);
      } else {
        sql += ` AND v.user_id = $${paramIndex++}`;
        queryParams.push(filters.user_id);
      }
    }

    sql += ` GROUP BY v.id, v.code, v.user_id ORDER BY v.code ASC`;
    const result = await executeQuery(sql, queryParams, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error executing vendor query:', error);
    throw error;
  }
};
export const getVendorsPayinsDao = async (filters, conn = null) => {
  try {
    let query = `
    SELECT code, user_id, payin_commission
    FROM public."Vendor"
    WHERE user_id = $1
    And is_obsolete = false
  `;
    const params = [filters.user_id];
    const result = await executeQuery(query, params, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error executing vendor Payins query:', error.message);
    throw error;
  }
};

export const getVendorsDao = async (
  filters,
  page = 1,
  pageSize = 10,
  sortBy = 'created_at',
  sortOrder = 'DESC',
  role,
  includeSeperateSubVendors = false,
  conn = null,
) => {
  try {
    let baseQuery;
    // Build base query based on role
    // Define columns to select
    const columns = [
      `"Vendor".id`,
      `"Vendor".user_id`,
      `"Vendor".first_name`,
      `"Vendor".last_name`,
      `"Vendor".code`,
      `"Vendor".payin_commission`,
      `"Vendor".payout_commission`,
      `"Vendor".created_at`,
      `"Vendor".updated_at`,
      `"Vendor".config`,
      `user_main.first_name || ' ' || user_main.last_name AS full_name`,
      `d.designation AS designation_name`,
      `(SELECT net_balance FROM "Calculation" WHERE "Calculation".user_id = "Vendor".user_id ORDER BY "Calculation".created_at DESC LIMIT 1) AS balance`,
    ];

    // Add extra columns for admin
    if (role === Role.ADMIN) {
      columns.push(
        `"Vendor".created_by`,
        `"Vendor".updated_by`,
        `"Vendor".company_id`,
        `user_main.designation_id`,
        `u.user_name AS created_by`,
        `uu.user_name AS updated_by`,
      );
    }

    // Build FROM/JOIN clause
    let fromClause = `
      FROM "Vendor"
      JOIN "User" AS user_main ON "Vendor".user_id = user_main.id
      LEFT JOIN "Designation" AS d ON user_main.designation_id = d.id
    `;

    if (role === Role.ADMIN) {
      fromClause += `
      LEFT JOIN "User" AS u ON "Vendor".created_by = u.id
      LEFT JOIN "User" AS uu ON "Vendor".updated_by = uu.id
      `;
    }

    // Build WHERE clause
    let whereClause = `
      WHERE "Vendor".is_obsolete = false
    `;
    if (role === Role.ADMIN) {
      whereClause += `
      AND user_main.designation_id = (SELECT id FROM "Designation" WHERE designation = 'VENDOR')
      `;
    }

    baseQuery = `
      SELECT ${columns.join(',\n')}
      ${fromClause}
      ${whereClause}
    `;
    const value = [];
    let paramIndex = 1;

    if (filters.id) {
      baseQuery += `
      AND "Vendor".id = $${paramIndex}
    `;
      value.push(filters.id);
      paramIndex++;
    }

    // Handle active filter (is_enabled in config)
    if (filters.active !== undefined) {
      const activeValue = filters.active === 'true' || filters.active === true;
      baseQuery += `
      AND COALESCE(NULLIF("Vendor".config->>'is_enabled', ''), 'false')::boolean = $${paramIndex}
    `;
      value.push(activeValue);
      paramIndex++;
      delete filters.active; // Remove from filters so buildSelectQuery doesn't try to add it
    }

    // Handle deleted filter (is_obsolete)
    if (filters.deleted !== undefined) {
      const deletedValue = filters.deleted === 'true' || filters.deleted === true;
      baseQuery += `
      AND "Vendor".is_obsolete = $${paramIndex}
    `;
      value.push(deletedValue);
      paramIndex++;
      delete filters.deleted; // Remove from filters so buildSelectQuery doesn't try to add it
    }

    const [query, values] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
      'Vendor',
    );
    const result = await executeQuery(query, values, conn);

    // Enhance with sub-vendor data
    const enhancedVendors = await enhanceVendorsWithSubVendors(
      result.rows,
      includeSeperateSubVendors,
      role,
      filters.company_id,
      conn,
    );
    return enhancedVendors;
  } catch (error) {
    logger.error('Error in getVendorsDao:', error);
    throw error;
  }
};

export const getVendorByIdDao = async (user_id, company_id, conn = null) => {
  try {
    const sql = `
    SELECT 
        v.id, 
        v.user_id, 
        v.payout_commission, 
        v.config,
        d.designation AS designation_name
    FROM "${tableName.VENDOR}" v
    JOIN "User" u ON v.user_id = u.id
    LEFT JOIN "Designation" d ON u.designation_id = d.id
    WHERE v.user_id = $1
    AND v.company_id = $2
    AND v.is_obsolete = false
    ;
  `;
    const params = [user_id, company_id];
    const result = await executeQuery(sql, params, conn);
    return result.rows || null;
  } catch (error) {
    logger.error('Error fetching vendor by ID:', error);
    throw error;
  }
};

export const getVendorIdsByUserIds = async (user_ids, conn = null) => {
  try {
    const ids = Array.isArray(user_ids) ? user_ids : [user_ids];
    if (ids.length === 0) return [];

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const query = `
      SELECT id
      FROM "Vendor"
      WHERE user_id IN (${placeholders})
        AND is_obsolete = false
    `;
    const result = await executeQuery(query, ids, conn);
    return result.rows.map((row) => row.id);
  } catch (error) {
    logger.error('Error in getVendorIdsByUserIds:', error);
    throw error;
  }
};
export const getAllVendorsDao = async (
  filters,
  page = 1,
  pageSize = 10,
  sortBy = 'created_at',
  sortOrder = 'DESC',
  role,
  includeSeperateSubVendors = false,
  conn = null,
) => {
  try {
    let baseQuery;
    // Build base query based on role
    // Define columns to select
    const columns = [
      `"Vendor".id`,
      `"Vendor".user_id`,
      `"Vendor".first_name`,
      `"Vendor".last_name`,
      `"Vendor".code`,
      `"Vendor".payin_commission`,
      `"Vendor".payout_commission`,
      `"Vendor".created_at`,
      `"Vendor".updated_at`,
      `user_main.first_name || ' ' || user_main.last_name AS full_name`,
      `d.designation AS designation_name`,
      `(SELECT net_balance FROM "Calculation" WHERE "Calculation".user_id = "Vendor".user_id ORDER BY "Calculation".created_at DESC LIMIT 1) AS balance`,
    ];

    // Add extra columns for admin
    if (role === Role.ADMIN) {
      columns.push(
        `"Vendor".created_by`,
        `"Vendor".updated_by`,
        `"Vendor".company_id`,
        `user_main.designation_id`,
        `u.user_name AS created_by`,
        `uu.user_name AS updated_by`,
      );
    }

    // Build FROM/JOIN clause
    let fromClause = `
      FROM "Vendor"
      JOIN "User" AS user_main ON "Vendor".user_id = user_main.id
      LEFT JOIN "Designation" AS d ON user_main.designation_id = d.id
    `;

    if (role === Role.ADMIN) {
      fromClause += `
      LEFT JOIN "User" AS u ON "Vendor".created_by = u.id
      LEFT JOIN "User" AS uu ON "Vendor".updated_by = uu.id
      `;
    }

    // Build WHERE clause
    let whereClause = `
      WHERE "Vendor".is_obsolete = false
    `;
    if (role === Role.ADMIN) {
      whereClause += `
      AND user_main.designation_id = (SELECT id FROM "Designation" WHERE designation = 'VENDOR')
      `;
    }

    baseQuery = `
      SELECT ${columns.join(',\n')}
      ${fromClause}
      ${whereClause}
    `;
    const value = [];
    let paramIndex = 1;

    if (filters.id) {
      baseQuery += `
      AND "Vendor".id = $${paramIndex}
    `;
      value.push(filters.id);
      paramIndex++;
    }
    // Handle active filter (is_enabled in config)
    if (filters.active !== undefined) {
      const activeValue = filters.active === 'true' || filters.active === true;
      baseQuery += `
      AND COALESCE(NULLIF("Vendor".config->>'is_enabled', ''), 'false')::boolean = $${paramIndex}
    `;
      value.push(activeValue);
      paramIndex++;
      delete filters.active; // Remove from filters so buildSelectQuery doesn't try to add it
    }

    // Handle deleted filter (is_obsolete)
    if (filters.deleted !== undefined) {
      const deletedValue = filters.deleted === 'true' || filters.deleted === true;
      baseQuery += `
      AND "Vendor".is_obsolete = $${paramIndex}
    `;
      value.push(deletedValue);
      paramIndex++;
      delete filters.deleted; // Remove from filters so buildSelectQuery doesn't try to add it
    }

    const [query, values] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
      'Vendor',
    );
    const result = await executeQuery(query, values, conn);

    // Enhance with sub-vendor data
    const enhancedVendors = await enhanceVendorsWithSubVendors(
      result.rows,
      includeSeperateSubVendors,
      role,
      filters.company_id,
      conn,
    );
    return enhancedVendors;
  } catch (error) {
    logger.error('Error in getVendorsDao:', error);
    throw error;
  }
};

export const getVendorsBySearchDao = async (
  filters,
  pageNumber,
  pageSize,
  searchTerms,
  includeSeperateSubVendors = false,
  conn = null,
) => {
  try {
    const conditions = [];
    const values = [filters.company_id];
    let paramIndex = 2;

    // Build base SELECT columns based on role
    const columns = [
      `"Vendor".id`,
      `"Vendor".user_id`,
      `"Vendor".first_name`,
      `"Vendor".last_name`,
      `"Vendor".code`,
      `"Vendor".payin_commission`,
      `"Vendor".payout_commission`,
      `"Vendor".created_at`,
      `"Vendor".updated_at`,
      `"user_main".first_name || ' ' || "user_main".last_name AS full_name`,
      `"Vendor".config->>'net_balance' AS net_balance_limit`,
      `"d".designation AS designation_name`,
      `(SELECT net_balance FROM "Calculation" WHERE "Calculation".user_id = "Vendor".user_id ORDER BY "Calculation".created_at DESC LIMIT 1) AS balance`,
    ];

    // Add extra columns for admin
    if (filters.role === Role.ADMIN) {
      columns.push(
        `"Vendor".created_by`,
        `"Vendor".updated_by`,
        `"Vendor".company_id`,
        `"Vendor".config`,
        `COALESCE("Vendor".config->>'is_owned') AS is_owned`,
        `COALESCE(NULLIF("Vendor".config->>'is_enabled', ''), 'false')::boolean AS is_enabled`, //Empty string '' casts to true; NULLIF prevents that bug.
        `"user_main".designation_id`,
        `u.user_name AS created_by`,
        `uu.user_name AS updated_by`,
      );
    }

    let queryText = `
      SELECT 
      ${columns.join(',\n')}
      FROM "Vendor"
      JOIN "User" AS user_main ON "Vendor".user_id = user_main.id
      LEFT JOIN "Designation" AS d ON user_main.designation_id = d.id
      ${filters.role === Role.ADMIN
        ? `LEFT JOIN "User" AS u ON "Vendor".created_by = u.id
         LEFT JOIN "User" AS uu ON "Vendor".updated_by = uu.id`
        : ''
      }
      WHERE "Vendor".is_obsolete = false
      AND "Vendor"."company_id" = $1
    `;
    if (filters.user_id) {
      if (Array.isArray(filters.user_id)) {
        queryText += ` AND "Vendor"."user_id" = ANY(ARRAY[${filters.user_id.map(() => `$${paramIndex++}`).join(',')}])`;
        values.push(...filters.user_id);
      } else {
        queryText += ` AND "Vendor"."user_id" = $${paramIndex}`;
        values.push(filters.user_id);
        paramIndex += 1;
      }
    }

    // Handle active filter (is_enabled in config)
    if (filters.active !== undefined) {
      const activeValue = filters.active === 'true' || filters.active === true;
      queryText += ` AND COALESCE(NULLIF("Vendor".config->>'is_enabled', ''), 'false')::boolean = $${paramIndex}`;
      values.push(activeValue);
      paramIndex += 1;
    }

    // Handle deleted filter (is_obsolete)
    if (filters.deleted !== undefined) {
      const deletedValue = filters.deleted === 'true' || filters.deleted === true;
      queryText += ` AND "Vendor".is_obsolete = $${paramIndex}`;
      values.push(deletedValue);
      paramIndex += 1;
    }

    if (searchTerms) {
      searchTerms.forEach((term) => {
        if (term.toLowerCase() === 'true' || term.toLowerCase() === 'false') {
          const boolValue = term.toLowerCase() === 'true';
          conditions.push(`
            ("Vendor".config->>'is_enabled')::boolean = $${paramIndex}
          `);
          values.push(boolValue);
          paramIndex++;
        } else {
          conditions.push(`
            (
              LOWER("Vendor".id::text) LIKE LOWER($${paramIndex})
              OR LOWER("Vendor".user_id::text) LIKE LOWER($${paramIndex})
              OR LOWER("Vendor".first_name) LIKE LOWER($${paramIndex})
              OR LOWER("Vendor".last_name) LIKE LOWER($${paramIndex})
              OR LOWER("Vendor".code) LIKE LOWER($${paramIndex})
              OR "Vendor".payin_commission::text LIKE $${paramIndex}
              OR "Vendor".payout_commission::text LIKE $${paramIndex}
              OR LOWER("Vendor".created_by::text) LIKE LOWER($${paramIndex})
              OR LOWER("Vendor".updated_by::text) LIKE LOWER($${paramIndex})
              OR LOWER("user_main".first_name || ' ' || "user_main".last_name) LIKE LOWER($${paramIndex})
              OR LOWER("d".designation) LIKE LOWER($${paramIndex})
              OR LOWER("Vendor".config->>'utr') LIKE LOWER($${paramIndex})
              OR (
                SELECT net_balance::text 
                FROM "Calculation" 
                WHERE "Calculation".user_id = "Vendor".user_id 
                ORDER BY "Calculation".created_at DESC 
                LIMIT 1
              ) LIKE $${paramIndex}
            )
          `);
          values.push(`%${term}%`);
          paramIndex++;
        }
      });
    }

    if (conditions.length > 0) {
      queryText += ' AND (' + conditions.join(' OR ') + ')';
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${queryText}) as count_table`;
    const countResult = await executeQuery(countQuery, values, conn);

    // Calculate offset - pageNumber is 1-based
    const offset = (pageNumber - 1) * pageSize;

    queryText += `
      ORDER BY "Vendor"."updated_at" DESC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `;
    values.push(pageSize, offset);
    let searchResult = await executeQuery(queryText, values, conn);
    // Calculate pagination metadata
    const totalItems = parseInt(countResult.rows[0].total);
    let totalPages = Math.ceil(totalItems / pageSize);
    if (totalItems > 0 && searchResult.rows.length === 0 && offset > 0) {
      values[values.length - 1] = 0;
      searchResult = await executeQuery(queryText, values, conn);
      totalPages = Math.ceil(totalItems / pageSize);
    }

    // Enhance with sub-vendor data
    const enhancedVendors = await enhanceVendorsWithSubVendors(
      searchResult.rows,
      includeSeperateSubVendors,
      filters.role,
      filters.company_id,
      conn,
    );

    const data = {
      totalCount: totalItems,
      totalPages,
      Vendors: enhancedVendors,
    };
    return data;
  } catch (error) {
    logger.error(error.message);
    throw error;
  }
};
export const updateVendorDao = async (id, data, conn = null) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.VENDOR, data, id);
    const result = await executeQuery(sql, params, conn);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in updateVendorDao:', error);
    throw error;
  }
};

export const deleteVendorDao = async (id, data, conn = null) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.VENDOR, data, id);
    const result = await executeQuery(sql, params, conn);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in deleteVendorDao:', error);
    throw error;
  }
};

export const updateVendorBalanceDao = async (
  filters,
  valueToAdd,
  updated_by,
  conn,
) => {
  try {
    const [sql, params] = buildUpdateQuery(
      tableName.VENDOR,
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
    logger.error('Error in updateVendorBalanceDao:', error);
    throw error;
  }
};

export const getVendorsDaoArray = async (company_id, code, conn = null) => {
  try {
    let baseQuery = `
      SELECT 
       "Vendor".id, 
        "Vendor".user_id, 
        "Vendor".first_name, 
        "Vendor".last_name, 
        "Vendor".code, 
        "Vendor".payin_commission, 
        "Vendor".payout_commission, 
        "Vendor".config, 
        "Vendor".created_by, 
        "Vendor".updated_by, 
        "Vendor".created_at, 
        "Vendor".updated_at, 
        "User".designation_id, 
        "User".first_name || ' ' || "User".last_name AS full_name, 
          "Designation".designation AS designation_name,
         (
          SELECT net_balance 
          FROM "Calculation" 
          WHERE "Calculation".user_id = "Vendor".user_id 
          ORDER BY "Calculation".created_at DESC 
          LIMIT 1
        ) AS balance
           FROM "Vendor" 
      JOIN "User" ON "Vendor".user_id = "User".id 
      LEFT JOIN "Designation" ON "User".designation_id = "Designation".id 
      WHERE "Vendor".is_obsolete = false 
      AND "Vendor"."company_id" = $1
      AND "Vendor".user_id = ANY($2)
    `;

    let queryParams = [company_id, code];
    const result = await executeQuery(baseQuery, queryParams, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching merchant by code and API key:', error);
    throw error;
  }
};

export const getBankResponseAccessByIDDao = async (id, conn = null) => {
  try {
    const query = `
      SELECT "Vendor".config->>'bank_response_access' as bank_response_access FROM "Vendor"
      WHERE "Vendor".user_id = $1
    `;
    const result = await executeQuery(query, [id], conn);
    return result.rows[0];
  } catch (error) {
    logger.error('Error fetching bank response access by ID:', error);
    throw error;
  }
};

export const getVendorByCodeDao = async (code, conn = null) => {
  try {
    const sql = `
      SELECT 
        "Vendor".id,
        "Vendor".user_id, 
        "Vendor".first_name, 
        "Vendor".last_name, 
        "Vendor".code,
        "Vendor".payin_commission,
        "Vendor".payout_commission
      FROM "Vendor"
      WHERE "Vendor".is_obsolete = false
      AND "Vendor".code = $1
      ORDER BY "Vendor"."created_at" ASC;
    `;

    const result = await executeQuery(sql, [code], conn);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching vendor by code:', error);
    throw error;
  }
};

//only for subvendor data
export const getVendorByUserDao = async (userId, conn = null) => {
  try {
    const sql = `
      SELECT 
        "Vendor".id,
        "Vendor".user_id, 
        "Vendor".first_name, 
        "Vendor".last_name, 
        "Vendor".code,
        "Vendor".payin_commission,
        "Vendor".payout_commission,
        "Vendor".balance,
        "Vendor".config,
        "Vendor".created_by,
        "Vendor".updated_by, 
        "Vendor".created_at, 
        "Vendor".updated_at, 
        "User".designation_id, 
        "User".first_name || ' ' || "User".last_name AS full_name, 
        "Designation".designation AS designation_name 
      FROM "Vendor" 
      JOIN "User" ON "Vendor".user_id = "User".id 
      LEFT JOIN "Designation" ON "User".designation_id = "Designation".id
      WHERE "Vendor".is_obsolete = false 
      AND "Vendor"."user_id" ${Array.isArray(userId) ? '= ANY($1)' : '= $1'}
      ORDER BY "Vendor"."created_at" ASC;
    `;

    // Query parameters
    const queryParams = [userId];

    // Execute query
    const result = await executeQuery(sql, queryParams, conn);

    // Return the rows (vendor data)
    return result.rows;
  } catch (error) {
    logger.error(`Error in getVendorByUserDao for user_id ${userId}:`, error);
    throw error;
  }
};

/**
 * Get designation id by designation name
 */
export const getDesignationIdDao = async (designation, conn = null) => {
  try {
    const sql = `SELECT id FROM "${tableName.DESIGNATION}" WHERE designation = $1 LIMIT 1;`;
    const result = await executeQuery(sql, [designation], conn);
    return result.rows[0]?.id || null;
  } catch (error) {
    logger.error('Error in getDesignationIdDao:', error);
    throw error;
  }
};

export const isNetBalanceZeroForTwoHours = async (vendorUserId, conn = null) => {
  try {
    const sql = `
      SELECT net_balance, updated_at
      FROM "Calculation"
      WHERE user_id = $1 
        AND net_balance = 0
        AND DATE(updated_at) = CURRENT_DATE
      ORDER BY updated_at DESC
      LIMIT 1;
    `;
    const result = await executeQuery(sql, [vendorUserId], conn);
    if (!result.rows.length) {
      return false;
    } else {
      return true;
    }
    // const lastZeroTime = new Date(result.rows[0].updated_at);
    // const now = new Date();
    // const diffHours = (now - lastZeroTime) / (1000 * 60 * 60);
    // return diffHours >= 2;
  } catch (error) {
    logger.error('Error in isNetBalanceZeroForTwoHours:', error);
    throw error;
  }
};

const getVendorCode = async (userId, conn = null) => {
  try {
    const sql = `SELECT code FROM "${tableName.VENDOR}" WHERE user_id = $1 LIMIT 1;`;
    const { rows } = await executeQuery(sql, [userId], conn);
    return rows[0]?.code;
  } catch (error) {
    logger.error('Error in getVendorCode:', error);
    throw error;
  }
};

const getVendorConfig = async (userId, conn = null) => {
  try {
    const sql = `SELECT code, config FROM "${tableName.VENDOR}" WHERE user_id = $1 LIMIT 1;`;
    const { rows } = await executeQuery(sql, [userId], conn);
    return { code: rows[0]?.code, config: rows[0]?.config || {} };
  } catch (error) {
    logger.error('Error in getVendorConfig:', error);
    throw error;
  }
};

const updateVendorConfig = async (userId, newConfig, updatedBy, conn = null) => {
  try {
    const sql = `UPDATE "${tableName.VENDOR}"
               SET config = $1, updated_by = $2
               WHERE user_id = $3
               RETURNING *;`;
    const { rows } = await executeQuery(sql, [newConfig, updatedBy, userId], conn);
    return rows[0];
  } catch (error) {
    logger.error('Error in updateVendorConfig:', error);
    throw error;
  }
};

// Helper functions for linking/unlinking/transfers vendors

const addSubVendorToParent = (parentConfig, subVendorUserId) => {
  const subVendors = parentConfig?.siblings?.sub_vendors || [];
  const newList = Array.isArray(subVendors)
    ? [...new Set([...subVendors, subVendorUserId])]
    : [subVendorUserId];
  return {
    ...parentConfig,
    siblings: {
      ...(parentConfig.siblings || {}),
      sub_vendors: newList,
    },
  };
};

const setParentInChild = (childConfig, parentUserId) => ({
  ...childConfig,
  parent: parentUserId,
});
const buildSubCode = (parentCode, childCode) => `${parentCode}(${childCode})`;
const removeSubVendorFromParent = (parentConfig, subVendorUserId) => {
  const subVendors = parentConfig?.siblings?.sub_vendors || [];
  const newList = Array.isArray(subVendors)
    ? subVendors.filter((id) => id !== subVendorUserId)
    : [];

  return {
    ...parentConfig,
    siblings: {
      ...(parentConfig.siblings || {}),
      sub_vendors: newList,
    },
  };
};
const clearParentInChild = (childConfig) => ({
  ...childConfig,
  parent: '',
});

const removeSubCodeFromVendor = (vendorConfig) => {
  if (!('sub_code' in vendorConfig)) return vendorConfig;
  return {
    ...vendorConfig,
    prev_sub_code: vendorConfig.sub_code || null,
    sub_code: undefined,
    is_owned: undefined,
  };
};

const updateSubCodeWithHistory = (vendorConfig, newSubCode) => ({
  ...vendorConfig,
  prev_sub_code: vendorConfig.sub_code || null,
  sub_code: newSubCode,
});

//linkVendorDao links a sub-vendor to a parent vendor

export const linkVendorDao = async (
  vendorUserId,
  subVendorUserId,
  user_id,
  mediator_payin_commission,
  mediator_payout_commission,
  conn = null,
) => {
  try {
    const parentConfig = await getUserHierarchyVendor(vendorUserId);
    const childConfig = await getUserHierarchyVendor(subVendorUserId);

    const newParentConfig = addSubVendorToParent(parentConfig, subVendorUserId);
    const updatedParent = await updateUserHierarchyVendor(
      vendorUserId,
      newParentConfig,
      user_id,
      conn,
    );

    const newChildConfig = setParentInChild(childConfig, vendorUserId);
    await updateUserHierarchyVendor(subVendorUserId, newChildConfig, user_id, conn);

    const parentCode = await getVendorCode(vendorUserId);
    if (parentCode) {
      const { code: childCode, config: vendorConfig } =
        await getVendorConfig(subVendorUserId);
      const subCode = buildSubCode(parentCode, childCode);

      const updatedVendorConfig = {
        ...vendorConfig,
        sub_code: subCode,
        mediator_payin_commission: mediator_payin_commission,
        mediator_payout_commission: mediator_payout_commission,
      };
      await updateVendorConfig(subVendorUserId, updatedVendorConfig, user_id, conn);
    }

    return updatedParent;
  } catch (error) {
    logger.error('Error in linkVendorDao:', error);
    throw error;
  }
};

//unlinkVendorDao unlinks a sub-vendor from its parent vendor

export const unlinkVendorDao = async (
  vendorUserId,
  subVendorUserId,
  user_id,
  conn = null,
) => {
  try {
    const parentConfig = await getUserHierarchyVendor(vendorUserId);
    const childConfig = await getUserHierarchyVendor(subVendorUserId);
    const newParentConfig = removeSubVendorFromParent(
      parentConfig,
      subVendorUserId,
    );
    const updatedParent = await updateUserHierarchyVendor(
      vendorUserId,
      newParentConfig,
      user_id,
      conn,
    );
    const newChildConfig = clearParentInChild(childConfig);
    await updateUserHierarchyVendor(subVendorUserId, newChildConfig, user_id, conn);
    const { config: vendorConfig } = await getVendorConfig(subVendorUserId);
    const cleanedVendorConfig = removeSubCodeFromVendor(vendorConfig);
    if (cleanedVendorConfig !== vendorConfig) {
      await updateVendorConfig(subVendorUserId, cleanedVendorConfig, user_id, conn);
    }
    return updatedParent;
  } catch (error) {
    logger.error('Error in unlinkVendorDao:', error);
    throw error;
  }
};

//transferVendorDao transfers a sub-vendor from one parent vendor to another
export const transferVendorDao = async (
  vendorUserId,
  newVendorUserId,
  currentVendorUserId,
  user_id,
  conn = null,
) => {
  try {
    const currentParentConfig =
      await getUserHierarchyVendor(currentVendorUserId);
    const newParentConfig = await getUserHierarchyVendor(newVendorUserId);
    const childConfig = await getUserHierarchyVendor(vendorUserId);
    const updatedCurrentConfig = removeSubVendorFromParent(
      currentParentConfig,
      vendorUserId,
    );
    await updateUserHierarchyVendor(
      currentVendorUserId,
      updatedCurrentConfig,
      user_id,
      conn,
    );
    const updatedNewConfig = addSubVendorToParent(
      newParentConfig,
      vendorUserId,
    );
    const result = await updateUserHierarchyVendor(
      newVendorUserId,
      updatedNewConfig,
      user_id,
      conn,
    );
    const updatedChildConfig = setParentInChild(childConfig, newVendorUserId);
    await updateUserHierarchyVendor(vendorUserId, updatedChildConfig, user_id, conn);
    const newParentCode = await getVendorCode(newVendorUserId);
    if (newParentCode) {
      const { code: childCode, config: vendorConfig } =
        await getVendorConfig(vendorUserId);
      const newSubCode = buildSubCode(newParentCode, childCode);
      const finalVendorConfig = updateSubCodeWithHistory(
        vendorConfig,
        newSubCode,
      );
      await updateVendorConfig(vendorUserId, finalVendorConfig, user_id, conn);
    }
    return result;
  } catch (error) {
    logger.error('Error in transferVendorDao:', error);
    throw error;
  }
};

export const getVendorByUserId = async (user_id, conn = null) => {
  try {
    const sql = `SELECT * FROM "${tableName.VENDOR}" WHERE user_id = $1 AND is_obsolete = false LIMIT 1;`;
    const result = await executeQuery(sql, [user_id], conn);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error fetching vendor by user_id:', error);
    throw error;
  }
};

// Batch fetch vendors by array of user_ids
export const getVendorForAssignDao = async (user_id, conn = null) => {
  try {
    const sql = `
      SELECT code, user_id
      FROM "Vendor"
      WHERE user_id = $1 AND is_obsolete = false
      LIMIT 1
    `;
    const result = await executeQuery(sql, [user_id], conn);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error in getVendorForAssignDao:', error);
    throw error;
  }
};
export const getVendorsByUserIdsDao = async (user_ids = [], conn = null) => {
  if (!Array.isArray(user_ids) || user_ids.length === 0) return [];
  try {
    const sql = `
      SELECT 
        "Vendor".id,
        "Vendor".user_id,
        "Vendor".first_name,
        "Vendor".last_name,
        "Vendor".code,
        "Vendor".payin_commission,
        "Vendor".payout_commission,
        "Vendor".created_at,
        "Vendor".updated_at,
        "Vendor".config
      FROM "Vendor"
      WHERE "Vendor".user_id = ANY($1::text[])
        AND "Vendor".is_obsolete = false
    `;
    const result = await executeQuery(sql, [user_ids], conn);
    return result.rows;
  } catch (error) {
    logger.error('Error in getVendorsByUserIdsDao:', error);
    throw error;
  }
};