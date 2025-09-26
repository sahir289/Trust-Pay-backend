import { Role, tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
// import { buildSearchFilterObj } from '../../utils/searchBuilder.js';
import { logger } from '../../utils/logger.js';
import { enhanceVendorsWithSubVendors } from '../../utils/enhanceSubVendor.js';



export const createVendorDao = async (data, conn) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.VENDOR, data);
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in create Vendor Dao:', error);
    throw error;
  }
};

export const getVendorCodeDao = async (id) => {
  try {
    const sql = `SELECT code FROM "${tableName.VENDOR}" WHERE id = $1`;
    const result = await executeQuery(sql, [id]);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error fetching vendor by ID:', error);
    throw error;
  }
};

export const getVendorsBankReponseDao = async (filters = {}) => {
  try {
    const selectColumns = `
      id,
      user_id,
      code,
      balance,
      payin_commission
    `;
    const [sql, params] = buildSelectQuery(
      `SELECT ${selectColumns} FROM "${tableName.VENDOR}" WHERE 1=1`,
      filters,
    );
    const result = await executeQuery(sql, params);
    return result.rows || [];
  } catch (error) {
    logger.error('Error fetching vendor data:', error);
    throw error;
  }
};
export const getVendorsDashBoardReportDao = async (
  filters = {}
) => {
  try {
    const selectColumns = `
      user_id,
      code
    `;
    const [sql, params] = buildSelectQuery(
      `SELECT ${selectColumns} FROM "${tableName.VENDOR}" WHERE 1=1`,
      filters
    );
    const result = await executeQuery(sql, params);
    return result.rows || [];
  } catch (error) {
    logger.error('Error getting vendor data:', error);
    throw error;
  }
};
export const getVendorsCodeDao = async (
  filters,
  conn,
  includeSubVendors = false,
  includeOnlyVendors = false,
  excludeDisabledVendor = false,
  includeSeperateSubVendors = false,
) => {
  try {
    // Convert string to boolean
    if (includeSubVendors) {
      includeSubVendors = includeSubVendors.toLowerCase() === 'true';
    }
    if (includeOnlyVendors) {
      includeOnlyVendors = includeOnlyVendors.toLowerCase() === 'true';
    }
    if (includeSeperateSubVendors) {
      includeSeperateSubVendors = includeSeperateSubVendors.toLowerCase() === 'true';
    }
    
    let sql = `
      SELECT 
        v.code AS label, 
        v.user_id AS value, 
        v.id AS vendor_id,
        ${
          includeSubVendors
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
      sql += ` AND v.is_enabled = TRUE `;
    }
    
    const queryParams = [];
    let paramIndex = 1;
    
    if (includeOnlyVendors) {
      sql += `
      AND v.user_id IN (
          SELECT u.id 
          FROM "${tableName.USER}" u
          JOIN "${tableName.DESIGNATION}" d 
            ON u.designation_id = d.id 
          WHERE d.designation = 'VENDOR'
        )
      `;
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
    
    const result = await conn.query(sql, queryParams);
    logger.log('Fetched Vendors:', result.rows.length, 'rows');
    return result.rows;
  } catch (error) {
    logger.error('Error executing vendor query:', error);
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
      `(SELECT net_balance FROM "Calculation" WHERE "Calculation".user_id = "Vendor".user_id ORDER BY "Calculation".updated_at DESC LIMIT 1) AS balance`,
    ];

    // Add extra columns for admin
    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
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

    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
      fromClause += `
      LEFT JOIN "User" AS u ON "Vendor".created_by = u.id
      LEFT JOIN "User" AS uu ON "Vendor".updated_by = uu.id
      `;
    }

    // Build WHERE clause
    let whereClause = `
      WHERE "Vendor".is_obsolete = false
    `;
    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
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

    const [query, values] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
      'Vendor',
    );
    const result = await executeQuery(query, values);
    
    // Enhance with sub-vendor data
    const enhancedVendors = await enhanceVendorsWithSubVendors(result.rows, includeSeperateSubVendors, role, filters.company_id);
    return enhancedVendors;
  } catch (error) {
    logger.error('Error in getVendorsDao:', error);
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
  includeSeperateSubVendors = false
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
      `(SELECT net_balance FROM "Calculation" WHERE "Calculation".user_id = "Vendor".user_id ORDER BY "Calculation".updated_at DESC LIMIT 1) AS balance`,
    ];

    // Add extra columns for admin
    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
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

    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
      fromClause += `
      LEFT JOIN "User" AS u ON "Vendor".created_by = u.id
      LEFT JOIN "User" AS uu ON "Vendor".updated_by = uu.id
      `;
    }

    // Build WHERE clause
    let whereClause = `
      WHERE "Vendor".is_obsolete = false
    `;
    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
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

    const [query, values] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
      'Vendor',
    );
    const result = await executeQuery(query, values);
    
    // Enhance with sub-vendor data
    const enhancedVendors = await enhanceVendorsWithSubVendors(result.rows, includeSeperateSubVendors, role, filters.company_id);
    return enhancedVendors;
  } catch (error) {
    logger.error('Error in getVendorsDao:', error);
    throw error;
  }
};

export const getVendorsBySearchDao = async (
  filters,
  pageNumber ,
  pageSize ,
  searchTerms,
  includeSeperateSubVendors = false
) => {
  try {
    const conditions = [];
    const values = [];
    let paramIndex = 1;

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
      `c.first_name || ' ' || c.last_name AS company`,
      `(SELECT net_balance FROM "Calculation" WHERE "Calculation".user_id = "Vendor".user_id ORDER BY "Calculation".created_at DESC LIMIT 1) AS balance`,
    ];

    // Add extra columns for admin
    if (filters.role === Role.ADMIN || filters.role === Role.SUPER_ADMIN) {
      columns.push(
        `"Vendor".created_by`,
        `"Vendor".updated_by`,
        `"Vendor".company_id`,
        `"Vendor".config`,
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
      LEFT JOIN public."Company" c
        ON "Vendor".company_id = c.id
      ${
        filters.role === Role.ADMIN || filters.role === Role.SUPER_ADMIN
          ? `LEFT JOIN "User" AS u ON "Vendor".created_by = u.id
         LEFT JOIN "User" AS uu ON "Vendor".updated_by = uu.id`
          : ''
      }
      WHERE "Vendor".is_obsolete = false
    `;

    // Add company_id filter only if present in filters, support comma-separated string or array
    if (filters.company_id) {
      let companyIds = filters.company_id;
      if (typeof companyIds === 'string' && companyIds.includes(',')) {
        companyIds = companyIds.split(',').map((v) => v.trim()).filter(Boolean);
      }
      if (Array.isArray(companyIds)) {
        if (companyIds.length > 0) {
          const placeholders = companyIds.map((_, idx) => `$${paramIndex + idx}`).join(', ');
          queryText += ` AND "Vendor"."company_id" IN (${placeholders})`;
          values.push(...companyIds);
          paramIndex += companyIds.length;
        }
      } else {
        queryText += ` AND "Vendor"."company_id" = $${paramIndex}`;
        values.push(companyIds);
        paramIndex++;
      }
    }

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
              OR LOWER(c.first_name || ' ' || c.last_name) LIKE LOWER($${paramIndex})
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
    const countResult = await executeQuery(countQuery, values);

    // Calculate offset - pageNumber is 1-based
    const offset = (pageNumber - 1) * pageSize;

    queryText += `
      ORDER BY "Vendor"."updated_at" DESC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `;
    values.push(pageSize, offset);
    let searchResult = await executeQuery(queryText, values);
    // Calculate pagination metadata
    const totalItems = parseInt(countResult.rows[0].total);
    let totalPages = Math.ceil(totalItems / pageSize);
    if (totalItems > 0 && searchResult.rows.length === 0 && offset > 0) {
      values[values.length - 1] = 0;
      searchResult = await executeQuery(queryText, values);
      totalPages = Math.ceil(totalItems / pageSize);
    }
    
    // Enhance with sub-vendor data
    const enhancedVendors = await enhanceVendorsWithSubVendors(searchResult.rows, includeSeperateSubVendors, filters.role, filters.company_id);
    
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

export const updateVendorDao = async (id, data, conn) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.VENDOR, data, id);
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in updateVendorDao:', error);
    throw error;
  }
};

export const deleteVendorDao = async (conn, id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.VENDOR, data, id);
    const result = await conn.query(sql, params);
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
    const result = await executeQuery(sql, params);
    return result[0];
  } catch (error) {
    logger.error('Error in updateVendorBalanceDao:', error);
    throw error;
  }
};

export const getVendorsDaoArray = async (company_id, code) => {
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
          ORDER BY "Calculation".updated_at DESC 
          LIMIT 1
        ) AS balance
           FROM "Vendor" 
      JOIN "User" ON "Vendor".user_id = "User".id 
      LEFT JOIN "Designation" ON "User".designation_id = "Designation".id 
      WHERE "Vendor".is_obsolete = false 
      AND "Vendor".user_id = ANY($1)
    `;

    let queryParams = [code];

    if (company_id) {
      // Parse company_id - handle both single values and comma-separated arrays
      let companyIds = company_id;
      if (typeof company_id === 'string' && company_id.includes(',')) {
        companyIds = company_id.split(',').map(id => id.trim()).filter(id => id);
      }
      
      if (Array.isArray(companyIds)) {
        if (companyIds.length > 0) {
          const placeholders = companyIds.map((_, idx) => `$${3 + idx}`).join(', ');
          baseQuery += ` AND "Vendor".company_id IN (${placeholders})`;
          queryParams.push(...companyIds);
        }
      } else {
        baseQuery += ` AND "Vendor".company_id = $2`;
        queryParams.push(companyIds);
      }
    }

    const result = await executeQuery(baseQuery, queryParams);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching merchant by code and API key:', error);
    throw error;
  }
};

export const getBankResponseAccessByIDDao = async (id) => {
  try {
    const query = `
      SELECT "Vendor".config->>'bank_response_access' as bank_response_access FROM "Vendor"
      WHERE "Vendor".user_id = $1
    `;
    const result = await executeQuery(query, [id]);
    return result.rows[0];
  } catch (error) {
    logger.error('Error fetching bank response access by ID:', error);
    throw error;
  }
};

export const getVendorByCodeDao = async (code) => {
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

    const result = await executeQuery(sql, [code]);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching vendor by code:', error);
    throw error;
  }
};

//only for subvendor data
export const getVendorByUserDao = async (userId) => {
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
    const result = await executeQuery(sql, queryParams);

    // Return the rows (vendor data)
    return result.rows;
  } catch (error) {
    logger.error(
      `Error in getVendorByUserDao for user_id ${userId}:`,
      error,
    );
    throw error;
  }
};
