import { tableName } from '../../constants/index.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';
import { buildSelectQuery, buildUpdateQuery, executeQuery } from '../../utils/db.js';

const getUsersDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  columns = [],
) => {
  try {
    const baseQuery = `SELECT ${columns.length ? columns.join(', ') : '*'} FROM "${tableName.USER}" WHERE 1=1`;
    if (filters.search) {
      filters.or = buildSearchFilterObj(filters.search, tableName.USER);
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
    );
    // Execute query
    const result = await executeQuery(sql, queryParams);
    return result.rows;
  } catch (error) {
    console.error('Error in getUserssDao:', error);
    throw error.message;
  }
};

// const getUsersDao = async (conn, ids) => {
//   try {
//     let baseQuery = `
//       SELECT
//         u.id,
//         u.first_name,
//         u.last_name,
//         u.email,
//         u.contact_no,
//         u.user_name,
//         u.code,
//         u.is_enabled,
//         u.last_login,
//         u.last_logout,
//         u.config,
//         u.created_by,
//         u.updated_by,
//         u.created_at,
//         u.updated_at,
//         r.role,
//         d.designation
//       FROM public."User" u
//       LEFT JOIN public."Role" r ON u.role_id = r.id
//       LEFT JOIN public."Designation" d ON u.designation_id = d.id
//       WHERE u.is_obsolete = false
//     `;
//     const queryParams = [];
//     if (ids.role_id) {
//       baseQuery += ` AND u.role_id = $${queryParams.length + 1}`;
//       queryParams.push(ids.role_id);
//     }
//     if (ids.designation_id) {
//       baseQuery += ` AND u.designation_id = $${queryParams.length + 1}`;
//       queryParams.push(ids.designation_id);
//     }
//     if (ids.company_id) {
//       baseQuery += ` AND u.company_id = $${queryParams.length + 1}`;
//       queryParams.push(ids.company_id);
//     }
//     const result = await conn.query(baseQuery, queryParams);
//     if (result.rows.length === 0) {
//       console.error('No users found');
//       return [];
//     }

//       return result.rows;

//   } catch (error) {
//     console.error('error getting while fetching user', error);
//     throw new DbError('Error executing query to fetch all users');
//   }
// };
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
      // result = await conn.query(sql, values);
      result = await executeQuery(sql, values);
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

