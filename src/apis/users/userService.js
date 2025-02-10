import { BadRequestError } from '../../utils/appErrors.js';
import { getConnection } from '../../utils/db.js';
import { createUserDao, getUserByIdDao, getUsersByUserNameDao, getUsersDao } from './userDao.js';


const getUsersService = async () => {
  let conn;
  try {
    conn = await getConnection();
    const result = await getUsersDao(conn);
    console.log('get Users successfully');
    return result;
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  } finally{
    if (conn) {
        try {
          conn.release();
        } catch (releaseError) {
          console.error('Error while releasing the connection', releaseError);
        }
      }
  }
};

const getUserByIdService = async (id) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await getUserByIdDao(conn, id);
    console.log('get User by id successfully');
    return result;
  } catch (error) {
    console.error('error getting while getting user by id', error);
    throw new BadRequestError('Error getting while getting user by id');
  } finally{
    if (conn) {
        try {
          conn.release();
        } catch (releaseError) {
          console.error('Error while releasing the connection', releaseError);
        }
      }
  }
};

const getUsersByUserNameService = async (username) => {
    let conn;
    try {
      conn = await getConnection();

      const data = await getUsersByUserNameDao(conn, username);
      console.log('getUsers successfully');
      
      return data;
    } catch (error) {
      console.error('error getting while logging in', error);
      throw new BadRequestError('Error getting while logging in');
    } finally{
      if (conn) {
          try {
            conn.release();
          } catch (releaseError) {
            console.error('Error while releasing the connection', releaseError);
          }
        }
    }
  };

  const createUserService = async (payload) => {
    let conn;
    try {
      conn = await getConnection();

      const data = await createUserDao(conn, payload);
      console.log('create user successfully');
      
      return data;
    } catch (error) {
      console.error('error getting while creating user', error);
      throw new BadRequestError('Error getting while creating user');
    } finally{
      if (conn) {
          try {
            conn.release();
          } catch (releaseError) {
            console.error('Error while releasing the connection', releaseError);
          }
        }
    }
  };

export { getUsersService, getUserByIdService, getUsersByUserNameService, createUserService };
