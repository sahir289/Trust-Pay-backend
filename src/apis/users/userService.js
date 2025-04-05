import { InternalServerError } from '../../utils/appErrors.js';
import { createHash } from '../../utils/bcryptPassword.js';
import { getConnection } from '../../utils/db.js';
import { generateUUID } from '../../utils/generateUUID.js';
import {
  createUserDao,
  getUserByIdDao,
  getUsersByUserNameDao,
  getUsersDao,
  updateUserDao,
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

const getUsersService = async (ids, role, page, limit) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.USER
        : role === Role.VENDOR
          ? vendorColumns.USER
          : columns.USER;
          const pageNumber = parseInt(page, 10) || 1;
          const pageSize = parseInt(limit, 10) || 10;
    return await getUsersDao(ids, pageNumber, pageSize, null, null, filterColumns);
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
      payload.company_id,
      user_name,
    );
    if (user?.user_name || user?.email || user?.contact_no) {
      throw new InternalServerError('User already exists');
    }
    const password = await createHash(payload.password);
    payload.password = password;
   
    const userPayload = {
      code: payload.code,
      role_id: payload.role_id,
      designation_id: payload.designation_id,
      first_name: payload.first_name,
      last_name: payload.last_name,
      email: payload.email,
      contact_no: payload.contact_no,
      user_name: payload.user_name,
      password: payload.password,
      is_enabled: payload.is_enabled,
      company_id: payload.company_id,
      created_by: payload.created_by,
      updated_by:payload.updated_by
    };
    const payin_notify = payload.payin_notify;
    const payout_notify = payload.payout_notify;
    const Return = payload.return;
    const site = payload.site;
    delete payload.payin_notify;
    delete payload.payout_notify;
    delete payload.return;
    delete payload.site;
    const User = await createUserDao(userPayload, conn);
    const userRole = await getUsersByUserNameDao(
      payload,
      user_name,
    );
    if (
      userRole.role === Role.MERCHANT) {
      const Private = generateUUID();
      const Public = generateUUID();
      const merchantPayload = {
        user_id: User.id,
        role_id: payload.role_id,
        company_id: payload.company_id,
        first_name: payload.first_name,
        last_name: payload.last_name,
        code: payload.code,
        balance: Number(0),
        min_payin: Number(payload.min_payin),
        max_payin: Number(payload.max_payin),
        payin_commission: Number(payload.payin_commission),
        min_payout: Number(payload.min_payout),
        max_payout: Number(payload.max_payout),
        payout_commission: Number(payload.payout_commission),
        created_by: payload.created_by,
        updated_by: payload.updated_by,
        config: {
          urls: {
            payin_notify: payin_notify,
            payout_notify: payout_notify,
            return: Return,
            site: site,
          },
          keys: {
            private: Private,
            public: Public,
          },
          is_intent: false,
        },
      };
      await createMerchantService(conn, merchantPayload, role);
    }

    if (userRole.role === Role.VENDOR) {
      const vendorPayload ={
        user_id: User.id,
        role_id: payload.role_id,
        company_id: payload.company_id,
        first_name: payload.first_name,
        last_name: payload.last_name,
        code: payload.code,
        balance: Number(0),
        payin_commission: Number(payload.payin_commission),
        payout_commission: Number(payload.payout_commission),
        created_by: payload.created_by,
        updated_by:payload.updated_by
      };
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


const userUpdateService = async (ids, payload, role) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.USER
        : role === Role.VENDOR
          ? vendorColumns.USER
          : columns.USER;
    const User = await updateUserDao(ids, payload);
    console.log('User Updated Successfully');
    const finalResult = filterResponse(User, filterColumns);
    return finalResult;
  } catch (error) {
    console.error('error getting while updating user', error);
    throw new InternalServerError(error);
  }
};


export {
  getUsersService,
  getUserByIdService,
  getUsersByUserNameService,
  createUserService,
  userUpdateService,
};
