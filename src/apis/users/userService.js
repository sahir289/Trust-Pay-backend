import { BadRequestError } from '../../utils/appErrors.js';
import { getConnection } from '../../utils/db.js';
import Logger from '../../utils/logger.js';
import { getUsersByUserNameDao, getUsersDao } from './userDao.js';

const logger = new Logger();

const getUsersService= async (payload) => {
  let conn;
  try {
    conn = await getConnection();
    const data = await getUsersDao(conn, payload);
    logger.log('getUsers successfully', 'info');
    return data;
  } catch (error) {
    logger.log('error getting while logging in', 'error', error);
    throw new BadRequestError('Error getting while logging in');
  } finally{
    if (conn) {
        try {
          conn.release();
        } catch (releaseError) {
          logger.log('Error while releasing the connection', 'error', releaseError);
        }
      }
  }
};

const getUsersByUserNameService= async (username) => {
    let conn;
    try {
      conn = await getConnection();

      const data = await getUsersByUserNameDao(conn, username);
      logger.log('getUsers successfully', 'info');
      
      return data;
    } catch (error) {
      logger.log('error getting while logging in', 'error', error);
      throw new BadRequestError('Error getting while logging in');
    } finally{
      if (conn) {
          try {
            conn.release();
          } catch (releaseError) {
            logger.log('Error while releasing the connection', 'error', releaseError);
          }
        }
    }
  };

export { getUsersService, getUsersByUserNameService };
