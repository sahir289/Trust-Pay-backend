import { BadRequestError } from '../../utils/appErrors.js';
import { getConnection } from '../../utils/db.js';
import Logger from '../../utils/logger.js';
import { createUserDao, getUserByIdDao, getUsersByUserNameDao, getUsersDao } from './userDao.js';

const logger = new Logger();

const getUsersService = async () => {
  let conn;
  try {
    conn = await getConnection();
    const result = await getUsersDao(conn);
    logger.log('get Users successfully', 'info');
    return result;
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

const getUserByIdService = async (id) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await getUserByIdDao(conn, id);
    logger.log('get User by id successfully', 'info');
    return result;
  } catch (error) {
    logger.log('error getting while getting user by id', 'error', error);
    throw new BadRequestError('Error getting while getting user by id');
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

const getUsersByUserNameService = async (username) => {
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

  const createUserService = async (payload) => {
    let conn;
    try {
      conn = await getConnection();

      const data = await createUserDao(conn, payload);
      logger.log('create user successfully', 'info');
      
      return data;
    } catch (error) {
      logger.log('error getting while creating user', 'error', error);
      throw new BadRequestError('Error getting while creating user');
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

export { getUsersService, getUserByIdService, getUsersByUserNameService, createUserService };
