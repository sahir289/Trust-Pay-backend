import { CREATE_USER_SCHEMA, VALIDATE_USER_BY_ID } from '../../schemas/userSchema.js';
import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
import { createHash } from '../../utils/bcryptPassword.js';
import { getConnection } from '../../utils/db.js';
import { createUserDao, getUserByIdDao, getUsersByUserNameDao, getUsersDao } from './userDao.js';
import { filterResponse } from '../../helpers/index.js';
import { columns, merchantColumns, Role, vendorColumns } from '../../constants/index.js';
// import { createMerchantService } from '../merchants/merchantService.js';
// import { createVendorService } from '../vendors/vendorService.js';
// import { getRoleDao } from '../roles/rolesDao.js';

const getUsersService = async (role) => {
  let conn;
  try {
    conn = await getConnection();
    const filterColumns = role === Role.MERCHANT ? merchantColumns.USER : role === Role.VENDOR ? vendorColumns.USER : columns.USER;
    const result = await getUsersDao(conn);
    console.log('get Users successfully');
    const finalResult = await filterResponse(result, filterColumns);
    return finalResult;
  } catch (error) {
    console.error('error getting while fetching user', error);
    throw new BadRequestError('Error getting while fetching user');
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        console.error('Error while releasing the connection', releaseError);
      }
    }
  }
};

const getUserByIdService = async (id, role) => {
  let conn;
  try {
    const filterColumns = role === Role.MERCHANT ? merchantColumns.USER : role === Role.VENDOR ? vendorColumns.USER : columns.USER;

    conn = await getConnection();
    const result = await getUserByIdDao(conn, id);

    const joiValidation = VALIDATE_USER_BY_ID.validate(result);
    if (joiValidation.error) {
      throw new ValidationError(joiValidation.error);
    }
    console.log('get User by id successfully');
    const finalResult = await filterResponse(result, filterColumns);
    return finalResult;
  } catch (error) {
    console.error('error getting while getting user by id', error);
    throw new BadRequestError('Error getting while getting user by id');
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        console.error('Error while releasing the connection', releaseError);
      }
    }
  }
};

const getUsersByUserNameService = async (username, role) => {
  let conn;
  try {
    const filterColumns = role === Role.MERCHANT ? merchantColumns.USER : role === Role.VENDOR ? vendorColumns.USER : columns.USER;

    conn = await getConnection();

    const data = await getUsersByUserNameDao(conn, username);
    console.log('get Users successfully');

    const finalResult = await filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    console.error('error getting while fetching user', error);
    throw new BadRequestError('Error getting while fetching user');
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        console.error('Error while releasing the connection', releaseError);
      }
    }
  }
};

const createUserService = async (conn,payload, role) => {

  try {
    const filterColumns = role === Role.MERCHANT ? merchantColumns.USER : role === Role.VENDOR ? vendorColumns.USER : columns.USER;
    const { user_name } = payload;
    const joiValidation = CREATE_USER_SCHEMA.validate(payload);
    if (joiValidation.error) {
      throw new ValidationError(joiValidation.error);
    }
    const user = await getUsersByUserNameDao(conn, user_name);
    if (user?.user_name || user?.email || user?.contact_no) {
      console.error('User already exists');
      throw new BadRequestError('User already exists');
    }
    const password = await createHash(payload.password);

    payload.password = password;
    const User = await createUserDao(conn, payload);
    // const role =await getRoleDao(payload.role_id)
    // if (role.role === "Merchant" || role.role === "Merchant_Admin" ) {
    //   const merchantPayload={
    //    "user_id":User.id,
    //    "role_id":payload.role_id,
    //    "company_id":payload.company_id,
    //    "first_name":payload.first_name,
    //    "last_name":payload.last_name,
    //    "code":payload.code,
    //    "min_payin": 0.0,
    //    "max_payin": 0.0,
    //     "payin_commission": 0.0,
    //     "min_payout": 0.0,
    //     "max_payout": 0.0,
    //    "payout_commission": 0.0,
    //   "balance": 0.0,
    //     "created_by":User.id,
    //     "updated_by":""
    //   }
    //   await createMerchantService(merchantPayload);
    // }
    // if (role.role === "Vendor" || role.role === "Vendor_Admin") {
    //   const vendorPayload={
    //    "user_id":User.id,
    //    "role_id":payload.role_id,
    //    "company_id":payload.company_id,
    //    "first_name":payload.first_name,
    //    "last_name":payload.last_name,
    //    "code":payload.code,
    //     "payin_commission": 0.0,
    //    "payout_commission": 0.0,
    //   "balance": 0.0,
    //     "created_by":User.id,
    //     "updated_by":""
    //   }
    //   await createVendorService(vendorPayload);
    // }
    console.log('User Created Successfully');
    const finalResult =  filterResponse(User, filterColumns);
    return finalResult;
  } catch (error) {
    console.error('error getting while creating user', error);
    throw new BadRequestError('Error getting while creating user');
  } 
};

export { getUsersService, getUserByIdService, getUsersByUserNameService, createUserService };
