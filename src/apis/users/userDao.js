import { Role, tableName } from '../../constants/index.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';
import {
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
  buildJoinQuery,
  buildInsertQuery,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
// import esClient from '../../utils/elasticClient.js';
// import { createUserInES, getUsersByESSearch } from '../../elasticSearch/user/common.js';

export const getUsersContactDao = async (company_id, contact_no, conn = null) => {
  try {
    const sql = `
      SELECT id
      FROM "${tableName.USER}" 
      WHERE is_obsolete = FALSE
        AND company_id = $1
        AND contact_no = $2
    `;
    const result = await executeQuery(sql, [company_id, contact_no], conn);
    return result.rows.length > 0;
  } catch (error) {
    logger.error('Error executing user contact query:', error);
    throw error;
  }
};

export const getUsersNameDao = async (user_id, conn = null) => {
  try {
    const sql = `
      SELECT u.user_name, u.code, r.role , d.designation
      FROM "${tableName.USER}" u
      LEFT JOIN "${tableName.ROLE}" r ON u.role_id = r.id
      LEFT JOIN "${tableName.DESIGNATION}" d ON u.designation_id = d.id
      WHERE u.is_obsolete = FALSE
        AND u.id = $1
    `;
    const result = await executeQuery(sql, [user_id], conn);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error executing user query:', error);
    throw error;
  }
};

const getUsersDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  columns = [],
  conn = null,
) => {
  try {
    const { USER, ROLE, DESIGNATION } = tableName;
    const joins = [
      {
        table: ROLE,
        // first is source key
        // second is target key
        keys: ['role_id', 'id'],
        type: 'JOIN',
        columns: ['role'],
        columnAs: [`"${ROLE}".role AS Role`],
      },
      {
        table: DESIGNATION,
        // first is source key
        // second is target key
        keys: [`designation_id`, 'id'],
        type: 'LEFT JOIN',
        columnAs: [`"${DESIGNATION}".designation AS Designation`],
        referenceTable: USER,
      },
    ];
    const baseQuery = buildJoinQuery(
      USER,
      columns?.length ? columns : '*',
      joins,
    );
    if (filters.search) {
      filters.or = buildSearchFilterObj(filters.search, USER);
      delete filters.search;
    }
    //TODO: columns.ROLE dynamic search
    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
      USER,
    );

    const result = await executeQuery(sql, queryParams, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error in get Users Dao:', error);
    throw error;
  }
};

const getAllUsersDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  columns = [],
  conn = null,
) => {
  try {
    const { USER, ROLE, DESIGNATION } = tableName;
    const joins = [
      {
        table: ROLE,
        // first is source key
        // second is target key
        keys: ['role_id', 'id'],
        type: 'JOIN',
        columns: ['role'],
        columnAs: [`"${ROLE}".role AS Role`],
      },
      {
        table: DESIGNATION,
        // first is source key
        // second is target key
        keys: [`designation_id`, 'id'],
        type: 'LEFT JOIN',
        columnAs: [`"${DESIGNATION}".designation AS Designation`],
        referenceTable: USER,
      },
    ];
    const baseQuery = buildJoinQuery(
      USER,
      columns?.length ? columns : '*',
      joins,
    );
    if (filters.search) {
      filters.or = buildSearchFilterObj(filters.search, USER);
      delete filters.search;
    }
    //TODO: columns.ROLE dynamic search
    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
      USER,
    );

    const result = await executeQuery(sql, queryParams, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error in get Users Dao:', error);
    throw error;
  }
};

const getAllUsersNameDao = async (
  filters,
  conn = null,
) => {
  try {
    const sql = `SELECT id, user_name FROM public."User" WHERE is_obsolete = false AND company_id = $1`;
    const queryParams = [filters.company_id];

    const result = await executeQuery(sql, queryParams, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error in get Users Dao:', error);
    throw error;
  }
};

const getUsersBySearchDao = async (
  filters,
  searchTerms,
  pageNumber = 1,
  pageSize = 10,
  role,
  conn = null,
) => {
  try {
    let data = {
      totalCount: 0,
      totalPages: 0,
      Users: []
    };
    // if(filters.search){
    //   const searchData = await getUsersByESSearch(filters.search);
    //   data = {
    //     totalCount: 1,
    //     totalPages: 12,
    //     Users: searchData,
    //   };
    //   return data;
    // }
    const conditions = [];
    const values = [filters.company_id];
    let paramIndex = 2;

    const validatedPageSize = Math.min(
      Math.max(parseInt(pageSize) || 10, 1),
      100,
    ); // Enforce 1-100 limit
    const validatedPageNumber = Math.max(parseInt(pageNumber) || 1);
    const offset = (validatedPageNumber - 1) * validatedPageSize;

    let queryText;
    if (role !== Role.ADMIN) {
      queryText = `
      SELECT 
        "User".id,
        "User".role_id,
        "User".designation_id,
        "User".first_name,
        "User".last_name,
        "User".email,
        "User".contact_no,
        "User".user_name,
        "User".code,
        "User".is_enabled,
        "User".is_two_factor_enabled,
        "User".is_two_factor_required,
        "User".is_two_factor_exempt,
        "User".last_login,
        "User".last_logout,
        "User".config,
        "User".created_at,
        "User".updated_at,
        "User".first_name || ' ' || "User".last_name AS full_name,
        "Designation".designation AS Designation 
      FROM "User" 
      LEFT JOIN "Designation" ON "User".designation_id = "Designation".id 
      LEFT JOIN public."User" cu ON "User".created_by = cu.id
      LEFT JOIN public."User" uu ON "User".updated_by = uu.id
      WHERE 1=1 
        AND "User".is_obsolete = false 
        AND "User"."company_id" = $1
    `;
    }
    else {
      queryText = `
      SELECT 
        "User".id,
        "User".role_id,
        "User".designation_id,
        "User".first_name,
        "User".last_name,
        "User".email,
        "User".contact_no,
        "User".user_name,
        "User".code,
        "User".is_enabled,
        "User".is_two_factor_enabled,
        "User".is_two_factor_required,
        "User".is_two_factor_exempt,
        "User".last_login,
        "User".last_logout,
        "User".config,
        cu.user_name AS created_by,
        uu.user_name AS updated_by,
        "User".created_at,
        "User".updated_at,
        "User".first_name || ' ' || "User".last_name AS full_name,
        "Designation".designation AS Designation 
      FROM "User" 
      LEFT JOIN "Designation" ON "User".designation_id = "Designation".id 
      LEFT JOIN public."User" cu ON "User".created_by = cu.id
      LEFT JOIN public."User" uu ON "User".updated_by = uu.id
      WHERE 1=1 
        AND "User".is_obsolete = false 
        AND "User"."company_id" = $1
    `;
    }

    if (filters.id) {
      if (Array.isArray(filters.id)) {
        const placeholders = filters.id
          .map((_, i) => `$${paramIndex + i}`)
          .join(', ');
        queryText += ` AND "User"."id" IN (${placeholders})`;
        values.push(...filters.id);
        paramIndex += filters.id.length;
      } else {
        queryText += ` AND "User"."id" = $${paramIndex}`;
        values.push(filters.id);
        paramIndex++;
      }
    }

    if (searchTerms) {
      searchTerms.forEach((term) => {
        if (term.toLowerCase() === 'true' || term.toLowerCase() === 'false') {
          const boolValue = term.toLowerCase() === 'true';
          conditions.push(`"User".is_enabled = $${paramIndex}`);
          values.push(boolValue);
          paramIndex++;
        } else {
          conditions.push(`
            (
              LOWER("User".id::text) LIKE LOWER($${paramIndex})
              OR LOWER("User".role_id::text) LIKE LOWER($${paramIndex})
              OR LOWER("User".designation_id::text) LIKE LOWER($${paramIndex})
              OR LOWER("User".first_name) LIKE LOWER($${paramIndex})
              OR LOWER("User".last_name) LIKE LOWER($${paramIndex})
              OR LOWER("User".email) LIKE LOWER($${paramIndex})
              OR LOWER("User".contact_no) LIKE LOWER($${paramIndex})
              OR LOWER("User".user_name) LIKE LOWER($${paramIndex})
              OR LOWER("User".code) LIKE LOWER($${paramIndex})
              OR LOWER("User".created_by::text) LIKE LOWER($${paramIndex})
              OR LOWER(cu."user_name") LIKE LOWER($${paramIndex})
              OR LOWER(uu."user_name") LIKE LOWER($${paramIndex})
              OR LOWER("User".updated_by::text) LIKE LOWER($${paramIndex})
              OR LOWER("User".first_name || ' ' || "User".last_name) LIKE LOWER($${paramIndex})
              OR LOWER("Designation".designation) LIKE LOWER($${paramIndex})
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

    queryText += `
      ORDER BY "User"."updated_at" DESC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `;
    values.push(validatedPageSize, offset);

    let searchResult = await executeQuery(queryText, values, conn);
    const totalItems = parseInt(countResult.rows[0].total);
    let totalPages = Math.ceil(totalItems / validatedPageSize);
    if (totalItems > 0 && searchResult.rows.length === 0 && offset > 0) {
      values[values.length - 1] = 0;
      searchResult = await executeQuery(queryText, values, conn);
      totalPages = Math.ceil(totalItems / validatedPageSize);
    }
    data = {
      totalCount: totalItems,
      totalPages,
      Users: searchResult.rows,
    };
    return data;
  } catch (error) {
    logger.error(error.message);
    throw error;
  }
};

const getUsersInfoBySearchDao = async (
  filters = {},
  searchTerms,
  page,
  pageSize,
  startDate,
  endDate,
  sortBy,
  sortOrder,
  conn = null,
) => {
  let query = `
SELECT
  at.id,
  at.user_id,
  u.user_name,
  at.company_id,
  at.session_id,
  at.config->'user_info'->>'user_ip' AS user_ip,
  at.config->'user_info'->>'browser' AS browser,
  at.config->'user_info'->>'os' AS os,
  at.config->'user_info'->>'device_type' AS device_type,
  at.config->'user_info'->>'browser_version' AS browser_version,
  at.config->'user_info'->>'os_version' AS os_version,
  at.config->'user_info'->'user_location'->>'latitude' AS latitude,
  at.config->'user_info'->'user_location'->>'longitude' AS longitude,
  at.config->'user_info'->'user_location'->'proxy'->>'isVpn' AS is_vpn,
  at.config->'user_info'->'user_location'->'proxy'->'raw'->>'country' AS country,
  at.config->'user_info'->'user_location'->'proxy'->'raw'->>'city' AS city,
  at.config->'user_info'->'user_location'->>'role' AS role,
  at.config->'user_info'->'user_location'->'proxy'->'raw'->>'provider' AS provider,
  at.is_obsolete,
  at.created_at,
  at.updated_at
FROM public."AccessToken" at
LEFT JOIN public."User" u
  ON at.user_id = u.id
WHERE at.is_obsolete = false
  `;

  const params = [];
  let index = 1;

  if (filters.id) {
    query += ` AND at.id = $${index++}`;
    params.push(filters.id);
  }

  if (filters.user_id) {
    query += ` AND at.user_id = $${index++}`;
    params.push(filters.user_id);
  }

  if (filters.user_name) {
    const userIds = filters.user_name
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  
    if (userIds.length > 0) {
      query += ` AND at.user_id = ANY($${index++})`;
      params.push(userIds);
    }
  }

  if (filters.company_id) {
    query += ` AND at.company_id = $${index++}`;
    params.push(filters.company_id);
  }

  if (filters.session_id) {
    query += ` AND at.session_id = $${index++}`;
    params.push(filters.session_id);
  }

  if (filters.is_obsolete !== undefined) {
    query += ` AND at.is_obsolete = $${index++}`;
    params.push(filters.is_obsolete);
  }

  if (searchTerms?.length > 0) {
    const searchConditions = [];
  
    for (const term of searchTerms) {
      searchConditions.push(`
        (
          u.user_name ILIKE $${index}
          OR at.config->'user_info'->>'user_ip' ILIKE $${index}
        )
      `);
  
      params.push(`%${term}%`);
      index++;
    }
  
    if (searchConditions.length) {
      query += ` AND (${searchConditions.join(' OR ')})`;
    }
  }


  const validatedPageSize = Math.min(
    Math.max(parseInt(pageSize) || 10, 1),
    100,
  );
  
  const validatedPageNumber = Math.max(
    parseInt(page) || 1,
    1,
  );
  
  const offset = (validatedPageNumber - 1) * validatedPageSize;

  if (startDate && endDate) {
    query += ` AND at.created_at BETWEEN $${index++} AND $${index++}`;
    params.push(
      `${startDate} 00:00:00`,
      `${endDate} 23:59:59.999`
    );
  } else if (startDate) {
    query += ` AND at.created_at >= $${index++}`;
    params.push(`${startDate} 00:00:00`);
  } else if (endDate) {
    query += ` AND at.created_at <= $${index++}`;
    params.push(`${endDate} 23:59:59.999`);
  }
  
  if (sortBy && sortOrder) {
    query += ` ORDER BY ${sortBy} ${sortOrder}`;
  } else {
    query += ` ORDER BY at.created_at DESC`;
  }
  
  query += ` LIMIT $${index++} OFFSET $${index++}`;
  
  params.push(validatedPageSize);
  params.push(offset);

  const result = await executeQuery(
    query,
    params,
    conn,
  );

  return result.rows;
};

const getUserByIdDao = async (ids, conn = null) => {
  try {
    let baseQuery = `
      SELECT 
        u.id, 
        u.first_name, 
        u.last_name, 
        u.email, 
        u.contact_no, 
        u.user_name, 
        u.code, 
        u.is_enabled, 
        u.last_login, 
        u.last_logout, 
        u.config, 
        u.is_two_factor_enabled,
        u.is_two_factor_required,
        u.is_two_factor_exempt,
        u.created_by, 
        u.updated_by, 
        u.created_at, 
        u.updated_at, 
        r.role, 
        d.designation,
        c.config AS company_config
      FROM public."User" u
      LEFT JOIN public."Role" r ON u.role_id = r.id 
      LEFT JOIN public."Designation" d ON u.designation_id = d.id
      LEFT JOIN public."Company" c ON u.company_id = c.id
      WHERE u.is_obsolete = false AND (c.is_obsolete = false OR c.id IS NULL)
    `;

    let queryParams = [];

    if (ids.id) {
      if (Array.isArray(ids.id)) {
        const placeholders = ids.id
          .map((_, idx) => `$${queryParams.length + idx + 1}`)
          .join(', ');
        baseQuery += ` AND u.id IN (${placeholders})`;
        queryParams.push(...ids.id);
      } else {
        baseQuery += ` AND u.id = $${queryParams.length + 1}`;
        queryParams.push(ids.id);
      }
    }
    if (ids.role_id) {
      baseQuery += ` AND u.role_id = $${queryParams.length + 1}`;
      queryParams.push(ids.role_id);
    }
    if (ids.designation_id) {
      baseQuery += ` AND u.designation_id = $${queryParams.length + 1}`;
      queryParams.push(ids.designation_id);
    }
    if (ids.company_id) {
      baseQuery += ` AND u.company_id = $${queryParams.length + 1}`;
      queryParams.push(ids.company_id);
    }
    const result = await executeQuery(baseQuery, queryParams, conn);
    if (result.rowCount === 0) {
      logger.error('No user found with the provided id and filters');
      return [];
    }
    return result.rows;
  } catch (error) {
    logger.error('error getting while fetching user', error);
    throw error;
  }
};
const getUserDao = async (id, conn = null) => {
  try {
    const sql = `
    SELECT r.role, u.is_two_factor_enabled
    FROM public."User" u
    LEFT JOIN public."Role" r ON u.role_id = r.id
    WHERE u.is_obsolete = false AND u.id = $1
  `;
    const result = await executeQuery(sql, [id.id], conn);
    if (result.rowCount === 0) {
      logger.error('No user found with the provided id and filters');
      return [];
    }
    return result.rows;
  } catch (error) {
    logger.error(`Error fetching user`, error.message);
    throw error;
  }
};
const getUsersByUserNameDao = async (ids, username, conn = null) => {
  try {
    let baseQuery = `
      SELECT 
        u.id, 
        u.first_name, 
        u.last_name, 
        u.email, 
        u.password,
        u.company_id,
        u.role_id,
        u.designation_id,
        u.contact_no, 
        u.user_name, 
        u.code, 
        u.is_enabled, 
        u.config, 
        u.created_by, 
        u.updated_by, 
        u.created_at, 
        u.updated_at, 
        u.is_two_factor_enabled,
        u.is_two_factor_required,
        u.is_two_factor_exempt,
        u.two_factor_secret,
        r.role, 
        d.designation,
        c.config AS company_config 
      FROM public."User" u
      LEFT JOIN public."Role" r ON u.role_id = r.id 
      LEFT JOIN public."Designation" d ON u.designation_id = d.id 
      LEFT JOIN public."Company" c ON u.company_id = c.id
      WHERE u.user_name = $1 AND u.is_obsolete = false AND c.is_obsolete = false
    `;

    const queryParams = [username];
    if (ids.role_id) {
      baseQuery += ` AND u.role_id = $${queryParams.length + 1}`;
      queryParams.push(ids.role_id);
    }
    if (ids.designation_id) {
      baseQuery += ` AND u.designation_id = $${queryParams.length + 1}`;
      queryParams.push(ids.designation_id);
    }
    if (ids.company_id) {
      baseQuery += ` AND u.company_id = $${queryParams.length + 1}`;
      queryParams.push(ids.company_id);
    }

    const result = await executeQuery(baseQuery, queryParams, conn);
    if (result.rowCount === 0) {
      logger.info(`No user found with username: ${username}`);
      return null;
    }
    return result.rows[0];
  } catch (error) {
    logger.error(`Error fetching user by username: ${username}`, error);
    throw error;
  }
};

const createUserDao = async (payload, conn = null) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.USER, payload);

    const result = await executeQuery(sql, params, conn);
    logger.info(
      `User with username: ${payload.user_name} created successfully`,
    );

    const insertedUser = result.rows[0];

    //  await createUserInES(insertedUser);

    return insertedUser;
  } catch (error) {
    logger.error(`Error creating user: ${payload.user_name}`, error);
    throw error;
  }
};

/////no params get all users data
const getUsersForCronDao = async (conn = null) => {
  try {
    const sql = `SELECT id  FROM public."User" where is_obsolete = false`;
    const result = await executeQuery(sql, [], conn);
    if (result.rows.length === 0) {
      logger.info('No users Found');
      return [];
    }
    return result.rows;
  } catch (error) {
    logger.error('error getting users', error);
    throw error;
  }
};

const updateUserDao = async (ids, data, conn = null) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.USER, data, ids);

    const result = await executeQuery(sql, params, conn);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in updateUserDao:', error);
    throw error;
  }
};

const getAdminUserIdsDao = async (company_id, conn = null) => {
  try {
    const sql = `
      SELECT id
      FROM "${tableName.USER}"
      WHERE is_obsolete = FALSE
        AND company_id = $1
        AND role_id = (SELECT id FROM "${tableName.ROLE}" WHERE role = 'ADMIN')
    `;
    const result = await executeQuery(sql, [company_id], conn);
    return result.rows;
  } catch (error) {
    logger.error('Error executing getAdminUsersDao query:', error);
    throw error;
  }
};

const getUserByCompanyCreatedAtDao = async (company_id, role, conn = null) => {
  try {
    const sql = `
      SELECT u.id, u.created_at
      FROM "User" u
      LEFT JOIN "Company" c ON u."company_id" = c.id
      LEFT JOIN "Role" r ON u."role_id" = r.id
      WHERE u.is_obsolete = FALSE
        AND c.id = $1
        AND r.role = $2
        AND (u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date = 
            (c.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date;
    `;
    const result = await executeQuery(sql, [company_id, role], conn);
    return result.rows[0];
  } catch (error) {
    logger.error('Error executing getUserByCompanyCreatedAtDao query:', error);
    throw error;
  }
};

const getUserByRoleDao = async (company_id, role, conn = null) => {
  try {
    const sql = `
      SELECT u.id
      FROM "${tableName.USER}" u
      LEFT JOIN public."Role" r ON u.role_id = r.id
      WHERE u.is_obsolete = FALSE
        AND u.company_id = $1
        AND r.role = $2
    `;
    const result = await executeQuery(sql, [company_id, role], conn);
    return result.rows;
  } catch (error) {
    logger.error('Error executing getUserByCompanyCreatedAtDao query:', error);
    throw error;
  }
};


const deleteUserDao = async (ids, data, conn = null) => {
  try {
    const values = [];
    const setClause = Object.entries(data).map(([key, value], index) => {
      values.push(value);
      return `"${key}" = $${index + 1}`;
    });

    let whereClause = '';
    const paramIndex = values.length + 1;
    if (ids.id) {
      if (Array.isArray(ids.id)) {
        whereClause = `"id" = ANY($${paramIndex})`;
        values.push(ids.id);
      } else {
        whereClause = `"id" = $${paramIndex}`;
        values.push(ids.id);
      }
    }

    const sql = `UPDATE "${tableName.USER}" SET ${setClause.join(', ')} WHERE ${whereClause} RETURNING *`;
    const result = await executeQuery(sql, values, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error in deleteUserDao:', error);
    throw error;
  }
};

const updateUserByIDDao = async (ids, data, conn = null) => {
  return await deleteUserDao(ids, data, conn);
};

const updateUser2FAStatusDao = async (userId, status, conn = null) => {
  try {
    const sql = `
      UPDATE public."User"
      SET is_two_factor_required = $1,
          updated_at = NOW()
      WHERE id = $2
        AND is_obsolete = false
      RETURNING id
    `;
    const result = await executeQuery(sql, [status, userId], conn);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error in updateUser2FAStatusDao:', error);
    throw error;
  }
};

/**
 * Updates the 2FA exemption status for a user.
 * When exempt = true, user bypasses global 2FA enforcement.
 */
const updateUser2FAExemptionDao = async (userId, exempt, conn = null) => {
  try {
    const sql = `
      UPDATE public."User"
      SET is_two_factor_exempt = $1,
          updated_at = NOW()
      WHERE id = $2
        AND is_obsolete = false
      RETURNING id, user_name, is_two_factor_exempt
    `;
    const result = await executeQuery(sql, [exempt, userId], conn);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error in updateUser2FAExemptionDao:', error);
    throw error;
  }
};

/**
 * Returns only the fields needed for the 2FA second-step verification.
 */
const getTwoFactorByUsernameDao = async (username, conn = null) => {
  try {
    const sql = `
      SELECT
        u.id,
        u.user_name,
        u.password,
        u.is_two_factor_enabled,
        u.two_factor_secret
      FROM public."User" u
      WHERE u.user_name = $1
        AND u.is_obsolete = false
    `;
    const result = await executeQuery(sql, [username], conn);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error in getTwoFactorByUsernameDao:', error);
    throw error;
  }
};

/**
 * Persists the TOTP secret for a user (called during 2FA setup).
 */
const saveTwoFactorSecretDao = async (userId, secret, conn = null) => {
  try {
    const sql = `
      UPDATE public."User"
      SET two_factor_secret = $1,
          updated_at = NOW()
      WHERE id = $2
        AND is_obsolete = false
      RETURNING id
    `;
    const result = await executeQuery(sql, [secret, userId], conn);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error in saveTwoFactorSecretDao:', error);
    throw error;
  }
};

/**
 * Flips is_two_factor_enabled to true (called after OTP is confirmed).
 */
const enableTwoFactorDao = async (userId, conn = null) => {
  try {
    const sql = `
      UPDATE public."User"
      SET is_two_factor_enabled = true,
          updated_at = NOW()
      WHERE id = $1
        AND is_obsolete = false
      RETURNING id
    `;
    const result = await executeQuery(sql, [userId], conn);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error in enableTwoFactorDao:', error);
    throw error;
  }
};

/**
 * Disables 2FA and clears the stored secret.
 */
const disableTwoFactorDao = async (userId, conn = null) => {
  try {
    const sql = `
      UPDATE public."User"
      SET is_two_factor_enabled = false,
          two_factor_secret = NULL,
          updated_at = NOW()
      WHERE id = $1
        AND is_obsolete = false
      RETURNING id
    `;
    const result = await executeQuery(sql, [userId], conn);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error in disableTwoFactorDao:', error);
    throw error;
  }
};

export {
  createUserDao,
  getUserByIdDao,
  getUsersByUserNameDao,
  getUsersDao,
  getAllUsersNameDao,
  updateUserDao,
  getUsersBySearchDao,
  getUsersInfoBySearchDao,
  getAllUsersDao,
  updateUserByIDDao,
  updateUser2FAStatusDao,
  updateUser2FAExemptionDao,
  getUserDao,
  getUsersForCronDao,
  getAdminUserIdsDao,
  getUserByCompanyCreatedAtDao,
  getUserByRoleDao,
  getTwoFactorByUsernameDao,
  saveTwoFactorSecretDao,
  enableTwoFactorDao,
  disableTwoFactorDao,
  deleteUserDao,
};

