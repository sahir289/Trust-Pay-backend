import { BadRequestError } from '../../utils/appErrors.js';
import { createHash } from '../../utils/bcryptPassword.js';
import { getConnection } from '../../utils/db.js';
import { createUserDao, getUserByIdDao, getUsersByUserNameDao, getUsersDao } from './userDao.js';
import { createMerchantService } from '../merchants/merchantService.js';
import { createVendorService } from '../vendors/vendorService.js';

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
      const User = await createUserDao(conn, payload);
      console.log('User Created Successfully');
      if (payload.role === "MERCHANT") {
        const merchantPayload={
         "user_id":User.id,
         "role_id":User.role_id,
         "company_id":User.company_id,
         "first_name":User.first_name,
         "last_name":User.last_name,
         "code":User.code,
          "min_payin": 0.0,
          "max_payin": 0.0,
          "payin_commission": 0.0,
          "min_payout": 0.0,
          "max_payout": 0.0,
          "payout_commission": 0.0,
          "is_test_mode": true,
          "is_enabled": true,
          "dispute_enabled": true,
          "is_demo": false,
          "balance": 0.0,
        }
        const merchant = createMerchantService(merchantPayload)

        // {
        //   "id": "uuid_generate_v4()",
        //   "role_id": "string",
        //   "user_id": "string",
        //   "first_name": "string",
        //   "last_name": "string",
        //   "code": "string",
        //   "site_url": "string",
        //   "api_key": "string",
        //   "secret_key": "string",
        //   "public_api_key": "string",
        //   "notify_url": "string",
        //   "return_url": "string",
        //   "min_payin": 0.0,
        //   "max_payin": 0.0,
        //   "payin_commission": 0.0,
        //   "min_payout": 0.0,
        //   "max_payout": 0.0,
        //   "payout_commission": 0.0,
        //   "payout_notify_url": "string",
        //   "is_test_mode": false,
        //   "is_enabled": true,
        //   "dispute_enabled": true,
        //   "is_demo": false,
        //   "balance": 0.0,
        //   "company_id": "string",
        //   "config": {},
        //   "created_by": "string",
        //   "updated_by": "string",
        //   "created_at": "now()",
        //   "updated_at": "now()",
        //   "is_obsolete": false
        // }
        
        console.log(merchant,"merchant from user")
     }
     if(payload.role === "VENDOR"){
       const vendor = createVendorService(payload)
       console.log(vendor)
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
