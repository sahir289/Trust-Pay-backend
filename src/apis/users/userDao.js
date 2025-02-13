import { DbError } from '../../utils/appErrors.js';


const getUsersDao = async (conn) => {
  try {
    const sql = `SELECT id, role_id, company_id, designation_id, first_name, last_name, email, contact_no, user_name, password, code, is_enabled, last_login, last_logout, config, created_by, updated_by, created_at, updated_at FROM public."User" where is_obsolete = false`;
    const result = await conn.query(sql);

    if (result.rows.length === 0) {
      console.error('No users Found');
      return [];
    }
    const data = {
      total_count: result.rowCount,
      users: result.rows,
    }
    return data;
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new DbError('Error executing query to fetch all users');
  }
};

const getUserByIdDao = async (conn, id) => {
  try {
    const sql = `
    SELECT id, role_id, company_id, designation_id, first_name, last_name, email, contact_no, user_name, password, code, 
      is_enabled, last_login, last_logout, config, created_by, updated_by, created_at, updated_at 
    FROM public."User" WHERE id = $1 AND is_obsolete = false`;
    const values = [id];
    const result = await conn.query(sql, values);
    if (result.rows.length === 0) {
      console.error('No users Found');
      return [];
    }
    const data = {
      user: result.rows,
    }
    return data;
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new DbError('Error executing query to fetch all users');
  }
};

const getUsersByUserNameDao = async (conn, username) => {
  try {
    const sql = `SELECT id, role_id, company_id, designation_id, first_name, last_name, email, contact_no, user_name, code, password, is_enabled, config, created_by, updated_by, created_at, updated_at 
    FROM public."User" WHERE user_name = $1`;
    const values = [username];
    const result = await conn.query(sql, values);
    if (result.rowCount === 0) {
      console.log(`No user found with username: ${username}`);
      return null;
    }
    return result.rows[0];
  } catch (error) {
    console.error(`Error fetching user by username: ${username}`, error);
    throw new DbError('Error executing query to fetch user by username');
  }
};

const createUserDao = async (conn, payload) => {

  try {
    const sql = `
    INSERT INTO public."User" (role_id, company_id, designation_id, first_name, last_name, email, contact_no, user_name,password, code, is_enabled
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id `;

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
      payload.is_enabled
    ];

    const result = await conn.query(sql, values);
    if (result) {
      console.log(`User with username: ${payload.user_name} created successfully`);
      return null;
    }  console.log("password123", result.rows[0])
    return result;
  } catch (error) {
    console.error(`Error creating user: ${payload.user_name}`, error);
    throw new DbError('Error executing query to create user');
  }
};

export { getUsersDao, getUserByIdDao, getUsersByUserNameDao, createUserDao };
