import { BadRequestError, InternalServerError } from '../../utils/appErrors.js';
import { createHash } from '../../utils/bcryptPassword.js';
import { getConnection } from '../../utils/db.js';
import {
  createUserDao,
  getUserByIdDao,
  getUsersByUserNameDao,
  getUsersDao,
} from './userDao.js';
import { filterResponse } from '../../helpers/index.js';
import {
  columns,
  merchantColumns,
  Role,
  vendorColumns,
} from '../../constants/index.js';
import { createMerchantService } from '../merchants/merchantService.js';
import { createVendorService } from '../vendors/vendorService.js';

const getUsersService = async (ids, role) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.USER
        : role === Role.VENDOR
          ? vendorColumns.USER
          : columns.USER;
    return await getUsersDao(ids, null, null, null, null, filterColumns);
  } catch (error) {
    console.error('error getting while fetching user', error);
    throw new InternalServerError(error);
  }
};

const getUserByIdService = async (ids, role) => {
  let conn;
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.USER
        : role === Role.VENDOR
          ? vendorColumns.USER
          : columns.USER;
    conn = await getConnection();
    const result = await getUserByIdDao(conn, ids);

    console.log('get User by id successfully');
    const finalResult = filterResponse(result, filterColumns);
    return finalResult;
  } catch (error) {
    console.error('error getting while getting user by id', error);
    throw new InternalServerError(error);
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

const getUsersByUserNameService = async (username, ids, role) => {
  let conn;
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.USER
        : role === Role.VENDOR
          ? vendorColumns.USER
          : columns.USER;
    conn = await getConnection();
    const data = await getUsersByUserNameDao(conn, ids, username);
    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    console.error('error getting while fetching user', error);
    throw new InternalServerError(error);
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

const createUserService = async (conn, payload, role) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.USER
        : role === Role.VENDOR
          ? vendorColumns.USER
          : columns.USER;
    const { user_name } = payload;

    const user = await getUsersByUserNameDao(
      conn,
      payload.company_id,
      user_name,
    );
    if (user?.user_name || user?.email || user?.contact_no) {
      console.error('User already exists');
      throw new BadRequestError('User already exists');
    }
    const password = await createHash(payload.password);
    payload.password = password;
    const User = await createUserDao(conn, payload);
    const userRole = await getUsersByUserNameDao(
      conn,
      payload.company_id,
      user_name,
    );
    const CommonCreateUserPayload = (
      User,
      payload,
      roleSpecificFields = {},
    ) => ({
      user_id: User.id,
      role_id: payload.role_id,
      company_id: payload.company_id,
      first_name: payload.first_name,
      last_name: payload.last_name,
      code: payload.code,
      balance: 0.0,
      created_by: User.id,
      updated_by: User.id,
      ...roleSpecificFields,
    });

    if (
      userRole.role === Role.MERCHANT ||
      userRole.role === Role.MERCHANT_ADMIN
    ) {
      const merchantPayload = CommonCreateUserPayload(User, payload, {
        min_payin: 0.0,
        max_payin: 0.0,
        payin_commission: 0.0,
        min_payout: 0.0,
        max_payout: 0.0,
        payout_commission: 0.0,
      });
      await createMerchantService(conn, merchantPayload, role);
    }

    if (userRole.role === Role.VENDOR) {
      const vendorPayload = CommonCreateUserPayload(User, payload, {
        payin_commission: 0.0,
        payout_commission: 0.0,
      });
      await createVendorService(conn, vendorPayload, role);
    }

    console.log('User Created Successfully');
    const finalResult = filterResponse(User, filterColumns);
    return finalResult;
  } catch (error) {
    console.error('error getting while creating user', error);
    throw new InternalServerError(error);
  }
};

export {
  getUsersService,
  getUserByIdService,
  getUsersByUserNameService,
  createUserService,
};
