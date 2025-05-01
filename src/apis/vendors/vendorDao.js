import { Role, tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
// import { buildSearchFilterObj } from '../../utils/searchBuilder.js';
import { logger } from '../../utils/logger.js';

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
    throw error.message;
  }
};

export const getVendorsCodeDao = async (
  filters,conn
) => {
  try {
    const baseQuery = `
        SELECT 
            code AS label, 
            user_id AS value, 
            id AS vendor_id 
        FROM 
            "${tableName.VENDOR}" 
        WHERE 
            is_obsolete = FALSE 
    `
     let [sql, queryParams] = buildSelectQuery(
       baseQuery,
       filters,
       tableName.VENDOR,
     );
    sql = sql.replace(/\s*ORDER BY\s+.*$/i, '') + ' ORDER BY "code" ASC';
    const result = await conn.query(sql, queryParams);
    logger.log('Fetched Vendors:', result.rows.length, 'rows');
    return result.rows;
  } catch (error) {
    logger.error('Error executing vendor query:', error);
    throw new Error('Database query failed'); // Re-throwing for upstream handling
  }
};


export const getVendorsDao = async (
  filters,
  page = 1,
  pageSize = 10,
  sortBy = 'created_at',
  sortOrder = 'DESC',
  role
) => {
  try {
    const baseQuery = `
      SELECT 
        "Vendor".id,
        "Vendor".user_id,
        "Vendor".first_name,
        "Vendor".last_name,
        "Vendor".code,
        "Vendor".payin_commission,
        "Vendor".payout_commission,
        "Vendor".balance,
        "Vendor".created_by,
        "Vendor".updated_by,
        "Vendor".config,
        "Vendor".created_at,
        "Vendor".updated_at,
        "Vendor".company_id,
        user_main.designation_id,
        user_main.first_name || ' ' || user_main.last_name AS full_name,
        d.designation AS designation_name,
        u.user_name AS created_by,
        uu.user_name AS updated_by
      FROM "Vendor"
      JOIN "User" AS user_main ON "Vendor".user_id = user_main.id
      LEFT JOIN "Designation" AS d ON user_main.designation_id = d.id
      LEFT JOIN "User" AS u ON "Vendor".created_by = u.id
      LEFT JOIN "User" AS uu ON "Vendor".updated_by = uu.id
    `;
    //when vendor login added get login specific payouts
  if (role == Role.ADMIN) {
    baseQuery += `
        WHERE "User".designation_id = (SELECT id FROM "Designation" WHERE designation = 'VENDOR')
      `;
  }
    const [query, values] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
      'Vendor' 
    );

    const result = await executeQuery(query, values);
    return result.rows;
  } catch (error) {
    logger.error('Error in getVendorsDao:', error);
    throw error.message;
  }
};


export const getVendorsBySearchDao = async (
  filters,
  searchTerms,
  limitNum,
  offset,
) => {
  try {
    const conditions = [];
    const values = [filters.company_id];
    let paramIndex = 2;

    let queryText = `
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
      WHERE 1=1 
      AND "Vendor".is_obsolete = false 
      AND "Vendor"."company_id" = $1
    `;
      if (filters.user_id) {
        queryText += ` AND "Vendor"."user_id" = $${paramIndex}`;
        values.push(filters.user_id);
        paramIndex += 1;
      }
    searchTerms.forEach((term) => {
  
      // Handle boolean terms
      if (term.toLowerCase() === 'true' || term.toLowerCase() === 'false') {
        const boolValue = term.toLowerCase() === 'true';
        conditions.push(`
          ("Vendor".config->>'is_enabled')::boolean = $${paramIndex}
        `);
        values.push(boolValue);
        paramIndex++;
      } else {
        // Handle text/numeric terms including JSON fields
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
            OR LOWER("User".first_name || ' ' || "User".last_name) LIKE LOWER($${paramIndex})
            OR LOWER("Designation".designation) LIKE LOWER($${paramIndex})
            OR LOWER("Vendor".config->>'utr') LIKE LOWER($${paramIndex})
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
      ORDER BY "Vendor"."created_at" DESC
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
      Vendors: searchResult.rows,
    };
    return data;
  } catch (error) {
    logger.error(error.message);
    throw error.message;
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
    throw error.message;
  }
};

export const deleteVendorDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.VENDOR, data, id);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in deleteVendorDao:', error);
    throw error.message;
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
    throw error.message;
  }
};
