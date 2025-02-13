import { BadRequestError } from '../../utils/appErrors.js';
import { createHash } from '../../utils/bcryptPassword.js';
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
      const { user_name } = payload;
      const user = await getUsersByUserNameDao(conn, user_name);
      if (user?.user_name || user?.email || user?.contact_no) {
        console.error('User already exists');
        throw new BadRequestError('User already exists');
      }
      const password = await createHash(payload.password);
      
      payload.password = password;
      const data = await createUserDao(conn, payload);

      console.log('User Created Successfully', data);
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
