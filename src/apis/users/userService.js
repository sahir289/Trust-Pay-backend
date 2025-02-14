import { BadRequestError } from '../../utils/appErrors.js';
import { createHash } from '../../utils/bcryptPassword.js';
import { getConnection } from '../../utils/db.js';
import { createUserDao, getUserByIdDao, getUsersByUserNameDao, getUsersDao } from './userDao.js';
import { createMerchantService } from '../merchants/merchantService.js';
import { createVendorService } from '../vendors/vendorService.js';
import { getRoleByIdDao } from '../roles/rolesDao.js';


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
      console.log('get Users successfully');
      
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
      const User = await createUserDao(conn, payload);
      console.log('User Created Successfully');
      const role =await getRoleByIdDao(payload.role_id)
      if (role.role === "Merchant" || role.role === "Merchant_Admin" ) {
        const merchantPayload={
         "user_id":User.id,
         "role_id":payload.role_id,
         "company_id":payload.company_id,
         "first_name":payload.first_name,
         "last_name":payload.last_name,
         "code":payload.code,
         "min_payin": 0.0,
         "max_payin": 0.0,
          "payin_commission": 0.0,
          "min_payout": 0.0,
          "max_payout": 0.0,
         "payout_commission": 0.0,
        "balance": 0.0,
          "created_by":User.id,
          "updated_by":""
        }
        await createMerchantService(merchantPayload);
      }
      if (role.role === "Vendor" || role.role === "Vendor_Admin") {
        const vendorPayload={
         "user_id":User.id,
         "role_id":payload.role_id,
         "company_id":payload.company_id,
         "first_name":payload.first_name,
         "last_name":payload.last_name,
         "code":payload.code,
          "payin_commission": 0.0,
         "payout_commission": 0.0,
        "balance": 0.0,
          "created_by":User.id,
          "updated_by":""
        }
        await createVendorService(vendorPayload);
      }
      return User;
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
