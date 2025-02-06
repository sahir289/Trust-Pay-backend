import { DbError } from '../../utils/appErrors.js';
import Logger from '../../utils/logger.js';

const logger = new Logger();

const getUsersDao = async (conn) => {
  try {
    const sql = `SELECT id, role_id, company_id, designation_id, first_name, last_name, email, contact_no, user_name, password, code, is_enabled, last_login, last_logout, config, created_by, updated_by, created_at, updated_at FROM public."User" where is_obsolete = false`;
    const result = await conn.query(sql);

    if (result.rows.length === 0) {
      logger.log('No users Found', 'error');
      return [];
    }
    const data = {
      total_count: result.rowCount,
      users: result.rows,
    }
    return data;
  } catch (error) {
    logger.log('error getting while logging in', 'error', error);
    throw new DbError('Error executing query to fetch all users');
  }
};

const getUserByIdDao = async (conn, id) => {
  try {
    const sql = `
    SELECT id, role_id, company_id, designation_id, first_name, last_name, email, contact_no, user_name, password, code, 
      is_enabled, last_login, last_logout, config, created_by, updated_by, created_at, updated_at 
    FROM public."User" WHERE id = $1 AND is_obsolete = false;`;
    const values = [id];
    const result = await conn.query(sql, values);
    if (result.rows.length === 0) {
      logger.log('No users Found', 'error');
      return [];
    }
    const data = {
      user: result.rows,
    }
    return data;
  } catch (error) {
    logger.log('error getting while logging in', 'error', error);
    throw new DbError('Error executing query to fetch all users');
  }
};

const getUsersByUserNameDao = async (conn, username) => {
  try {
    const sql = 'SELECT * FROM users WHERE username = $1';
    const values = [username];
    const result = await conn.query(sql, values);
    if (result.rowCount === 0) {
      logger.log(`No user found with username: ${username}`, 'info');
      return null;
    }
    return result;
  } catch (error) {
    logger.log(`Error fetching user by username: ${username}`, 'error', error);
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
      logger.log(`User with username: ${payload.user_name} created successfully`, 'info');
      return null;
    }
    return result;
  } catch (error) {
    logger.log(`Error creating user: ${payload.user_name}`, 'error', error);
    throw new DbError('Error executing query to create user');
  }
};

export { getUsersDao, getUserByIdDao, getUsersByUserNameDao, createUserDao };
