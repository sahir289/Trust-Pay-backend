import { tableName } from '../../constants/index.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';
import { buildSelectQuery, buildUpdateQuery, executeQuery,buildJoinQuery } from '../../utils/db.js';

const getUsersDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  columns = [],
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
        columns.length ? columns : '*',
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
    
    const result = await executeQuery(sql, queryParams);
    return result.rows;
  } catch (error) {
    console.error('Error in get Users Dao:', error);
    throw error.message;
  }
};

export const getUsersBySearchDao = async (
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
        "User".last_login,
        "User".last_logout,
        "User".config,
        "User".created_by,
        "User".updated_by,
        "User".created_at,
        "User".updated_at,
        "User".first_name || ' ' || "User".last_name AS full_name,
        "Designation".designation AS Designation 
      FROM "User" 
      LEFT JOIN "Designation" ON "User".designation_id = "Designation".id 
      WHERE 1=1 
        AND "User".is_obsolete = false 
        AND "User"."company_id" = $1
    `;

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


    searchTerms.forEach((term) => {

      if (term.toLowerCase() === 'true' || term.toLowerCase() === 'false') {
        const boolValue = term.toLowerCase() === 'true';
        conditions.push(`
          (
            "User".is_enabled = $${paramIndex}
          )
        `);
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
            OR LOWER("User".updated_by::text) LIKE LOWER($${paramIndex})
            OR LOWER("User".first_name || ' ' || "User".last_name) LIKE LOWER($${paramIndex})
            OR LOWER("Designation".designation) LIKE LOWER($${paramIndex})
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
      ORDER BY "User"."created_at" DESC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `;
    values.push(limitNum, offset);

    const countResult = await executeQuery(countQuery, values.slice(0, -2));
    const searchResult = await executeQuery(queryText, values);

    const totalItems = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalItems / limitNum);

    const data = {
      totalCount: totalItems,
      totalPages,
      Users: searchResult.rows,
    };
    return data;
  } catch (error) {
    console.error(error.message);
    throw error.message;
  }
};
const getUserByIdDao = async (conn, ids) => {
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
        u.created_by, 
        u.updated_by, 
        u.created_at, 
        u.updated_at, 
        r.role , 
        d.designation   
      FROM public."User" u
      LEFT JOIN public."Role" r ON u.role_id = r.id 
      LEFT JOIN public."Designation" d ON u.designation_id = d.id  
      WHERE u.id = $1 AND u.is_obsolete = false
    `;
    const queryParams = [ids.id];
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
    const result = await conn.query(baseQuery, queryParams);
    if (result.rowCount === 0) {
      console.error('No user found with the provided id and filters');
      return [];
    }
    return result.rows;
  } catch (error) {
    console.error('error getting while fetching user', error);
    throw error.message;
  }
};

const getUsersByUserNameDao = async (ids, username) => {
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
        r.role, 
        d.designation 
      FROM public."User" u
      LEFT JOIN public."Role" r ON u.role_id = r.id 
      LEFT JOIN public."Designation" d ON u.designation_id = d.id 
      WHERE u.user_name = $1
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

    const result = await executeQuery(baseQuery, queryParams);
    if (result.rowCount === 0) {
      console.log(`No user found with username: ${username}`);
      return null;
    }
    return result.rows[0];
  } catch (error) {
    console.error(`Error fetching user by username: ${username}`, error);
    throw error.message;
  }
};

const createUserDao = async (payload,conn) => {
  try {

    const sql = `
    INSERT INTO public."User" (role_id, company_id, designation_id, first_name, last_name, email, contact_no, user_name, password, code, is_enabled)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id 
    `;

    const values = [
      payload.role_id,
      payload.company_id,
      payload.designation_id,
      payload.first_name,
      payload.last_name,
      payload.email,
      payload.contact_no,
      payload.user_name,
      payload.password,
      payload.code,
      payload.is_enabled,
    ];
    let result;
    ///temperary for conn ...in future can excute to query in if condition
    if (conn) {
      result = await conn.query(sql, values);
    }
    else {
      result = await executeQuery(sql, values);
    }
    console.log(
      `User with username: ${payload.user_name} created successfully`,
    );

    return result.rows[0];

  } catch (error) {
    console.error(`Error creating user: ${payload.user_name}`, error);
    throw error.message;
  }
};

/////no params get all users data
const getUsersForCronDao = async (conn) => {
  try {
    const sql = `SELECT id  FROM public."User" where is_obsolete = false`;
    const result = await conn.query(sql);
    if (result.rows.length === 0) {
      console.log('No users Found');
      return [];
    }
    return result.rows;
  } catch (error) {
    console.error('error getting users', error);
    throw error.message;
  }
};

const updateUserDao = async (ids, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.USER, data, ids);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error in updateMerchantDao:', error);
    throw error.message;
  }
}

export {
  getUsersDao,
  getUserByIdDao,
  getUsersForCronDao,
  getUsersByUserNameDao,
  createUserDao,
  updateUserDao,
};

