import { DbError } from '../../utils/appErrors.js';
import Logger from '../../utils/logger.js';

const logger = new Logger();

const getUsersDao= async (conn, payload) => {
    console.log(payload)
  try {    
    const sql = 'SELECT * FROM users';
    const data = await conn.query(sql);
    return data;
  } catch (error) {
    logger.log('error getting while logging in', 'error', error);
    throw new DbError('Error executing query to fetch all users');
  }
};

const getUsersByUserNameDao= async (conn, username) => {
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

export { getUsersDao, getUsersByUserNameDao };