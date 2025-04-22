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
  getUsersBySearchDao,
} from './userDao.js';
import { getDesignationDao } from '../designation/designationDao.js';
import { getRoleDao } from '../roles/rolesDao.js';
import { filterResponse } from '../../helpers/index.js';
import {
  columns,
  merchantColumns,
  Role,
  vendorColumns,
} from '../../constants/index.js';
import { createMerchantService } from '../merchants/merchantService.js';
import { createVendorService } from '../vendors/vendorService.js';
import { BadRequestError } from '../../utils/appErrors.js';
import { logger } from '../../utils/logger.js';
import {
  createUserHierarchyDao,
  getUserHierarchysDao,
  updateUserHierarchyDao,
} from '../userHierarchy/userHierarchyDao.js';

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
    return await getUsersDao(
      ids,
      pageNumber,
      pageSize,
      null,
      null,
      filterColumns,
    );
  } catch (error) {
    console.error('error getting while fetching user', error);
    throw new InternalServerError(error);
  }
};
const getUsersBySearchService = async (filters, role) => {
  try {
    const pageNum = parseInt(filters.page);
    const limitNum = parseInt(filters.limit);
    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
      throw new BadRequestError('Invalid pagination parameters');
    }
    const searchTerms = filters.search
      .split(',')
      .map((term) => term.trim())
      .filter((term) => term.length > 0);

    if (searchTerms.length === 0) {
      throw new BadRequestError('Please provide valid search terms');
    }
    const offset = (pageNum - 1) * limitNum;

    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.USER
        : role === Role.VENDOR
          ? vendorColumns.USER
          : columns.USER;
    // TODO: add designation constants

    const data = await getUsersBySearchDao(
      filters,
      searchTerms,
      limitNum,
      offset,
      filterColumns,
    );

    return data;
  } catch (error) {
    logger.error('Error while fetching users by search', error);
    throw new InternalServerError(error.message);
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

const createUserService = async (conn, payload, role, designation) => {
  // const filterColumns =
  //   role === Role.MERCHANT
  //     ? merchantColumns.USER
  //     : role === Role.VENDOR
  //       ? vendorColumns.USER
  //       : columns.USER;
  const { user_name } = payload;
  const user = await getUsersByUserNameDao(payload.company_id, user_name);
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
    updated_by: payload.updated_by,
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
  const userRole = await getRoleDao({ id: payload.role_id });
  const userDesignation = await getDesignationDao({
    id: payload.designation_id,
  });
  ///for operations

  if (
    userDesignation[0].designation == Role.MERCHANT_OPERATIONS ||
    userDesignation[0].designation == Role.VENDOR_OPERATIONS
  ) {
    const hierarchy = await getUserHierarchysDao({
      user_id:
        role == Role.ADMIN ||
        designation == Role.MERCHANT ||
        designation == Role.SUB_MERCHANT ||
        designation == Role.VENDOR
          ? payload?.parent_id
          : payload.created_by,
    });
    //  {"child":{"operations":[]},"siblings":{"sub_merchants":["19fb0634-31cc-41f3-a09f-29b524e4aee5","972d353d-158f-4013-93d6-a17f7e606800"]}}
    const hierarchyConfig = hierarchy[0]?.config;
    const currentChildren = hierarchy[0]?.config?.child?.operations || [];
    await updateUserHierarchyDao(
      { id: hierarchy[0].id },
      {
        config: {
          ...hierarchyConfig,
          child: { operations: [...currentChildren, User.id] },
        },
      },
      conn,
    );
    if(userDesignation[0].designation == 'VENDOR_OPERATIONS' || userDesignation[0].designation == 'MERCHANT_OPERATIONS'){
    await createUserHierarchyDao(
      { user_id: User.id, created_by : payload.created_by , updated_by: payload.updated_by, company_id: payload.company_id },
      conn,
    );
  }}

  ///for merchant sub-merchant
  if (
    userDesignation[0].designation === Role.MERCHANT ||
    userDesignation[0].designation === Role.SUB_MERCHANT
  ) {
    const Private = generateUUID();
    const Public = generateUUID();
    const merchantPayload = {
      user_id: User.id,
      role_id: payload.role_id,
      role: userRole[0].role,
      designation: userDesignation[0].designation,
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
      parent_id:
        role == Role.ADMIN || designation == Role.MERCHANT
          ? payload?.parent_id
          : payload.created_by,
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
        allow_intent: false,
      },
    };
    await createMerchantService(conn, merchantPayload);
  }
  ///for vendor
  if (userDesignation[0].designation === Role.VENDOR) {
    const vendorPayload = {
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
      updated_by: payload.updated_by,
    };
    await createVendorService(conn, vendorPayload, role);
  }

  console.log('User Created Successfully');
  // const finalResult = filterResponse(User, filterColumns);
  return Error;
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
  getUsersBySearchService,
  getUsersByUserNameService,
  createUserService,
  userUpdateService,
};
