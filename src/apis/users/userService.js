import { InternalServerError } from '../../utils/appErrors.js';
import { createHash } from '../../utils/bcryptPassword.js';
import {
  getConnection,
  beginTransaction,
  commit,
  rollback,
} from '../../utils/db.js';
import { generatePassword } from '../../utils/generatePassword.js';
import { sendCredentialsEmail } from '../../utils/sendMailer.js';
import { unblocked_countries } from '../../constants/index.js';
import {
  createUserDao,
  getUserByIdDao,
  getUsersByUserNameDao,
  getUsersDao,
  updateUserDao,
  getUsersBySearchDao,
  getUsersInfoBySearchDao,
  getAllUsersDao,
  updateUserByIDDao,
  updateUser2FAStatusDao,
  updateUser2FAExemptionDao,
  disableTwoFactorDao,
  getAllUsersNameDao,
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
import { _createMerchantServiceInternal } from '../merchants/merchantService.js';
import { _createVendorServiceInternal } from '../vendors/vendorService.js';
import { BadRequestError } from '../../utils/appErrors.js';
import { logger } from '../../utils/logger.js';
import {
  createUserHierarchyDao,
  getUserHierarchysDao,
  updateUserHierarchyDao,
  getAllHierarchyUserIds,
} from '../userHierarchy/userHierarchyDao.js';
import { getMerchantByUserIdDao } from '../merchants/merchantDao.js';
import { getVendorByUserDao } from '../vendors/vendorDao.js';
import { getCompanyByIDDao } from '../company/companyDao.js';
import { getBankaccountCheckDao } from '../bankAccounts/bankaccountDao.js';
import { getSessionByUserIdDao } from '../auth/authDao.js';
import { forceLogoutUser } from '../../utils/sockets.js';
import { createHashApiKey } from '../../utils/cryptoAlgorithm.js';
// import { notifyAdminsAndUsers } from '../../utils/notifyUsers.js';

const getUsersService = async (
  ids,
  role,
  page,
  limit,
  designation,
  user_id,
) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.USER
        : role === Role.VENDOR || role === Role.SUB_VENDOR
          ? vendorColumns.USER
          : columns.USER;

    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;

    let userIdFilter = [];

    if (
      role === Role.VENDOR ||
      role === Role.SUB_VENDOR ||
      role === Role.MERCHANT
    ) {
      const userHierarchyData = await getUserHierarchysDao(
        { user_id },
        null,
        null,
        null,
        null,
        null,
      );
      const userHierarchy = userHierarchyData[0];

      if (
        designation === Role.VENDOR_OPERATIONS ||
        designation === Role.MERCHANT_OPERATIONS
      ) {
        const parentUserId = userHierarchy?.config?.parent;
        if (parentUserId) {
          userIdFilter.push(parentUserId);

          const parentHierarchyData = await getUserHierarchysDao(
            {
              user_id: parentUserId,
            },
            null,
            null,
            null,
            null,
            null,
          );
          const parentHierarchy = parentHierarchyData[0];

          if (role === Role.MERCHANT) {
            const subMerchants =
              parentHierarchy?.config?.siblings?.sub_merchants ?? [];
            userIdFilter.push(...subMerchants);

            // Fetch child.operations from each submerchant
            for (const subId of subMerchants) {
              const subHierarchyData = await getUserHierarchysDao(
                {
                  user_id: subId,
                },
                null,
                null,
                null,
                null,
                null,
              );
              const subHierarchy = subHierarchyData?.[0];
              const subOps = subHierarchy?.config?.child?.operations ?? [];
              userIdFilter.push(...subOps);
            }
          }

          const parentOps = parentHierarchy?.config?.child?.operations ?? [];
          userIdFilter.push(...parentOps);
        }
      } else {
        userIdFilter.push(user_id);
        const subMerchants =
          userHierarchy?.config?.siblings?.sub_merchants ?? [];
        userIdFilter.push(...subMerchants);

        // Add submerchant child.operations
        for (const subId of subMerchants) {
          const subHierarchyData = await getUserHierarchysDao(
            {
              user_id: subId,
            },
            null,
            null,
            null,
            null,
            null,
          );
          const subHierarchy = subHierarchyData?.[0];
          const subOps = subHierarchy?.config?.child?.operations ?? [];
          userIdFilter.push(...subOps);
        }

        const childOperations = userHierarchy?.config?.child?.operations ?? [];
        userIdFilter.push(...childOperations);
      }

      userIdFilter = [...new Set(userIdFilter)];
      ids.id = userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
    }
    return await getAllUsersDao(
      ids,
      pageNumber,
      pageSize,
      null,
      null,
      filterColumns,
    );
  } catch (error) {
    logger.error('error getting while fetching user', error);
    throw error;
  }
};

const getUsersNameService = async (
  ids,
) => {
  try {
    return await getAllUsersNameDao(
      ids,
    );
  } catch (error) {
    logger.error('error getting while fetching user-names', error);
    throw error;
  }
};

const getUsersBySearchService = async (
  ids,
  role,
  page,
  limit,
  designation,
  user_id,
) => {
  try {
    // const filterColumns =
    //   role === Role.MERCHANT
    //     ? merchantColumns.USER
    //     : role === Role.VENDOR || role === Role.SUB_VENDOR
    //       ? vendorColumns.USER
    //       : columns.USER;

    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;

    let userIdFilter = [];

    if (
      role === Role.VENDOR ||
      role === Role.SUB_VENDOR ||
      role === Role.MERCHANT
    ) {
      const userHierarchyData = await getUserHierarchysDao(
        { user_id },
        null,
        null,
        null,
        null,
        null,
      );
      const userHierarchy = userHierarchyData[0];

      if (
        designation === Role.VENDOR_OPERATIONS ||
        designation === Role.MERCHANT_OPERATIONS
      ) {
        const parentUserId = userHierarchy?.config?.parent;
        if (parentUserId) {
          userIdFilter.push(parentUserId);

          const parentHierarchyData = await getUserHierarchysDao(
            {
              user_id: parentUserId,
            },
            null,
            null,
            null,
            null,
            null,
          );
          const parentHierarchy = parentHierarchyData[0];

          if (role === Role.MERCHANT) {
            const subMerchants =
              parentHierarchy?.config?.siblings?.sub_merchants ?? [];
            userIdFilter.push(...subMerchants);

            // Fetch child.operations from each submerchant
            for (const subId of subMerchants) {
              const subHierarchyData = await getUserHierarchysDao(
                {
                  user_id: subId,
                },
                null,
                null,
                null,
                null,
                null,
              );
              const subHierarchy = subHierarchyData?.[0];
              const subOps = subHierarchy?.config?.child?.operations ?? [];
              userIdFilter.push(...subOps);
            }
          }

          const parentOps = parentHierarchy?.config?.child?.operations ?? [];
          userIdFilter.push(...parentOps);
        }
      } else {
        userIdFilter.push(user_id);
        const subMerchants =
          userHierarchy?.config?.siblings?.sub_merchants ?? [];
        userIdFilter.push(...subMerchants);

        // Add submerchant child.operations
        for (const subId of subMerchants) {
          const subHierarchyData = await getUserHierarchysDao(
            {
              user_id: subId,
            },
            null,
            null,
            null,
            null,
            null,
          );
          const subHierarchy = subHierarchyData?.[0];
          const subOps = subHierarchy?.config?.child?.operations ?? [];
          userIdFilter.push(...subOps);
        }

        // Add sub_vendors and their operations
        const subVendors = userHierarchy?.config?.siblings?.sub_vendors ?? [];
        userIdFilter.push(...subVendors);

        // Add sub_vendor child.operations
        for (const subId of subVendors) {
          const subHierarchyData = await getUserHierarchysDao(
            {
              user_id: subId,
            },
            null,
            null,
            null,
            null,
            null,
          );
          const subHierarchy = subHierarchyData?.[0];
          const subOps = subHierarchy?.config?.child?.operations ?? [];
          userIdFilter.push(...subOps);
        }

        const childOperations = userHierarchy?.config?.child?.operations ?? [];
        userIdFilter.push(...childOperations);
      }

      userIdFilter = [...new Set(userIdFilter)];
      ids.id = userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
    }
    let searchTerms;
    if (ids.search) {
      searchTerms = ids.search
        .split(',')
        .map((term) => term.trim())
        .filter((term) => term.length > 0);
    }

    const data = await getUsersBySearchDao(
      ids,
      searchTerms,
      pageNumber,
      pageSize,
      role,
      // filterColumns
    );

    return data;
  } catch (error) {
    logger.error('Error while fetching users by search', error);
    throw error;
  }
};

const getUsersInfoBySearchService = async (
  ids,
  role,
  page,
  limit,
  startDate,
  endDate,
) => {
  try {  

    const pageNumber = Number.parseInt(page, 10) || 1;
    const pageSize = Number.parseInt(limit, 10) || 10;

    let searchTerms;
    if (ids.search) {
      searchTerms = ids.search
        .split(',')
        .map((term) => term.trim())
        .filter((term) => term.length > 0);
    }

    const data = await getUsersInfoBySearchDao(
      ids,
      searchTerms,
      pageNumber,
      pageSize,
      startDate,
      endDate,
      role,
      // filterColumns
    );

    return data;
  } catch (error) {
    logger.error('Error while fetching users by search', error);
    throw error;
  }
};

const getUserByIdService = async (ids, role) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.USER
        : role === Role.VENDOR || role === Role.SUB_VENDOR
          ? vendorColumns.USER
          : columns.USER;
    const result = await getUserByIdDao(ids);

    const finalResult = filterResponse(result, filterColumns, {
      stripSensitive: true,
    });
    return finalResult;
  } catch (error) {
    logger.error('error getting while getting user by id', error);
    throw error;
  }
};

const getUsersByUserNameService = async (username, ids, role) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.USER
        : role === Role.VENDOR || role === Role.SUB_VENDOR
          ? vendorColumns.USER
          : columns.USER;
    const data = await getUsersByUserNameDao(ids, username);
    const finalResult = filterResponse(data, filterColumns, {
      stripSensitive: true,
    });
    return finalResult;
  } catch (error) {
    logger.error('error getting while fetching user', error);
    throw error;
  }
};

const _createUserServiceInternal = async (payload, conn) => {
  try {
    const { user_name } = payload;
    let company_id = payload.company_id;
    const user = await getUsersByUserNameDao(company_id, user_name);
    if (user?.user_name || user?.email || user?.contact_no) {
      throw new BadRequestError('User already exists');
    }
    // else {
    //   const verifyEmail = await getUsersDao({ email: email });
    //   if (verifyEmail.length > 0) {
    //     throw new BadRequestError('Email already exists');
    //   }
    // }
    const Password = generatePassword(user_name);
    const hashPassword = await createHash(Password);
    payload.password = hashPassword;
    const userPayload = {
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
      config: { isLoginFirst: true },
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

    const designation = await getDesignationDao(
      { id: payload.designation_id },
      conn,
    );
    const userRole = await getRoleDao({ id: payload.role_id }, conn);
    const userDesignation = await getDesignationDao(
      {
        id: payload.designation_id,
      },
      conn,
    );
    if (userDesignation[0]?.designation == Role.SUB_VENDOR) {
      const banks = await getBankaccountCheckDao(
        {
          user_id: payload.parent_id,
        },
        conn,
      );
      if (banks) {
        throw new BadRequestError(
          'Parent cannot contain any existing banks. Please remove all banks from the parent before adding a new Vendor.',
        );
      }
    }
    let unique_id = payload?.unique_admin_id;
    if (userDesignation[0]?.designation == Role.ADMIN) {
      const company = await getCompanyByIDDao({ id: payload.company_id }, conn);
      if (company?.length > 0) {
        unique_id =
          company[0]?.config?.unique_admin_id &&
          company[0]?.config?.unique_admin_id;
      }
    }
    if (
      userDesignation[0]?.designation == Role.MERCHANT_OPERATIONS ||
      userDesignation[0]?.designation == Role.VENDOR_OPERATIONS
    ) {
      ///for operations

      const hierarchy = await getUserHierarchysDao(
        {
          user_id: payload?.parent_id ? payload?.parent_id : payload.created_by,
        },
        null,
        null,
        null,
        null,
        null,
        null,
        conn,
      );
      const hierarchyConfig = hierarchy[0]?.config;
      const currentChildren = hierarchy[0]?.config?.child?.operations || [];
      await updateUserHierarchyDao(
        { id: hierarchy[0]?.id },
        {
          config: {
            ...hierarchyConfig,
            child: { operations: [...currentChildren, User.id] },
          },
        },
        conn,
      );
      if (
        userDesignation[0].designation == Role.VENDOR_OPERATIONS ||
        userDesignation[0].designation == Role.MERCHANT_OPERATIONS
      ) {
        await createUserHierarchyDao(
          {
            user_id: User.id,
            created_by: payload.created_by,
            updated_by: payload.updated_by,
            company_id: payload.company_id,
            config: {
              parent: payload?.parent_id
                ? payload?.parent_id
                : payload.created_by,
            },
          },
          conn,
        );
      }
    }

    let merchant = {};
    ///for merchant sub-merchant
    if (
      userDesignation[0]?.designation === Role.MERCHANT ||
      userDesignation[0]?.designation === Role.SUB_MERCHANT
    ) {
      let userCode;
      let sub_code;
      if (userDesignation[0]?.designation === Role.SUB_MERCHANT) {
        const user_id = payload?.parent_id
          ? payload?.parent_id
          : payload.created_by;
        userCode = await getMerchantByUserIdDao(user_id, conn);
        sub_code = `${userCode[0].code}(${payload.code})`;
      }
      const { secretKey, publicKey } = createHashApiKey();
      const merchantPayload = {
        user_id: User.id,
        role_id: payload.role_id,
        role: userRole[0].role,
        designation: userDesignation[0].designation,
        company_id: payload.company_id,
        first_name: payload.first_name,
        last_name: payload.last_name,
        code: payload.code.trim(),
        balance: Number(0),
        min_payin: Number(payload.min_payin),
        max_payin: Number(payload.max_payin),
        payin_commission: Number(payload.payin_commission),
        min_payout: Number(payload.min_payout),
        max_payout: Number(payload.max_payout),
        payout_commission: Number(payload.payout_commission),
        parent_id: payload?.parent_id ? payload?.parent_id : payload.created_by,
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
            private: secretKey,
            public: publicKey,
          },
          allow_intent: false,
          allow_payout: false,
          allow_clickrr: false,
          allow_tatapay: false,
          allow_payassist: false,
          is_h2h: payload?.is_h2h || false,
          ...(sub_code && { sub_code }),
          unblocked_countries: unblocked_countries,
          gm_code: payload.gm_code,
          whitelist_ips: payload.whitelist_ips,
          apiVersion: 'v2',
        },
      };
      merchant = await _createMerchantServiceInternal(merchantPayload, conn);
    }
    ///for vendor sub-vendor
    if (
      userDesignation[0]?.designation === Role.VENDOR ||
      userDesignation[0]?.designation === Role.SUB_VENDOR ||
      userDesignation[0]?.designation === Role.VENDOR_ADMIN
    ) {
      let userCode;
      let sub_code;
      let is_owned = false;
      if (userDesignation[0]?.designation === Role.SUB_VENDOR) {
        const user_id = payload?.parent_id
          ? payload?.parent_id
          : payload.created_by;
        userCode = await getVendorByUserDao(user_id, conn);
        sub_code = `${userCode[0].code}(${payload.code})`;
        is_owned = payload.is_owned;
      }
      const { secretKey } = createHashApiKey();
      const vendorPayload = {
        user_id: User.id,
        role_id: payload.role_id,
        company_id: payload.company_id,
        first_name: payload.first_name,
        last_name: payload.last_name,
        code: payload.code.trim(),
        balance: Number(0),
        config: {
          bank_response_access: false,
          net_balance: payload.net_balance || '0',
          ...(sub_code && { sub_code }),
          ...(is_owned && { is_owned }),
          is_enabled: true,
          mediator_payin_commission: payload.mediator_payin_commission || 0,
          mediator_payout_commission: payload.mediator_payout_commission || 0,
          gm_code: payload.gm_code,
          keys: {
            private: secretKey          },
        },
        payin_commission: Number(payload.payin_commission),
        payout_commission: Number(payload.payout_commission),
        created_by: payload.created_by,
        updated_by: payload.updated_by,
        designation: userDesignation[0]?.designation,
        role: userRole[0].role,
        parent_id: payload?.parent_id ? payload?.parent_id : payload.created_by,
      };
      await _createVendorServiceInternal(vendorPayload, conn);
    }

    if (User) {
      try {
        const data = await sendCredentialsEmail({
          email: User.email,
          username: User.user_name,
          password: Password,
          code: merchant?.config ? merchant.code : '',
          secretKey: merchant?.config ? merchant.config.keys.private : '',
          designation: designation[0]?.designation,
          unique_id,
        });

        if (!data) {
          throw new InternalServerError('Failed to send email');
        }
      } catch (error) {
        logger.log('Error while sending email:', error);
        throw error;
      }
    }

    // const finalResult = filterResponse(User, filterColumns);
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: payload.company_id,
    //   message: `New User with username: ${payload.user_name} has been created.`,
    //   payloadUserId: payload.created_by,
    //   actorUserId: payload.created_by,
    //   category: 'User',
    // });
    return User;
  } catch (error) {
    logger.error('error in _createUserServiceInternal', error);
    throw error;
  }
};

const createUserService = async (payload) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const User = await _createUserServiceInternal(payload, conn);
    await commit(conn);
    committed = true;
    return User;
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn);
    }
    logger.error('Error in createUserService:', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

const _userUpdateServiceInternal = async (ids, payload, conn) => {
  try {
    // if (payload.email) {
    //   const verifyEmail = await getUsersDao({ email: payload.email });
    //   if (verifyEmail.length > 0) {
    //     throw new BadRequestError('Email already Registered');
    //   }
    // }
    if (payload.is_enabled === false || payload.is_enabled === true) {
      const user = await getAllHierarchyUserIds(ids.id, conn);
      const userPayload = {
        is_obsolete: false,
        is_enabled : payload.is_enabled,
        updated_by : payload.updated_by
      };
      const User = await updateUserByIDDao({ id: user }, userPayload, conn);
      const sessions = await getSessionByUserIdDao({ user_id: user }, conn);
       if (sessions && sessions.length > 0) {
         for (const session of sessions) {
           if (session?.session_id) {
             await forceLogoutUser(session.user_id, session.session_id);
           }
         }
       }
      return User;
}
    const User = await updateUserDao(ids, payload, conn);
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: ids.company_id,
    //   message: `User with username: ${User.user_name} has been updated.`,
    //   payloadUserId: payload.updated_by,
    //   actorUserId: payload.updated_by,
    //   category: 'User',
    // });
    return User;
  } catch (error) {
    logger.error('error in _userUpdateServiceInternal', error);
    throw error;
  }
};

const userUpdateService = async (ids, payload) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const User = await _userUpdateServiceInternal(ids, payload, conn);
    await commit(conn);
    committed = true;
    return User;
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn);
    }
    logger.error('error getting while updating user', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

const updateUser2FAService = async (id, isTwoFactorRequired) => {
  try {
    return await updateUser2FAStatusDao(id, isTwoFactorRequired);
  } catch (error) {
    logger.error('Error in updateUser2FAService:', error);
    throw error;
  }
};

const resetUser2FAService = async (targetUserId, adminId, adminUsername) => {
  try {
    const result = await disableTwoFactorDao(targetUserId);
    if (result) {
      logger.info(`[AUDIT] 2FA Reset: User ID ${targetUserId} had their 2FA reset by Admin ${adminUsername} (ID: ${adminId}) at ${new Date().toISOString()}`);
    }
    return result;
  } catch (error) {
    logger.error('Error in resetUser2FAService:', error);
    throw error;
  }
};

const sendMailService = async (payload) => {
  try {
    const { user_id } = payload;
    const user = await getUsersDao({ id: user_id });
    const role = await getRoleDao({ id: user[0].role_id });
    const designation = await getDesignationDao({ id: user[0].designation_id });
    let merchant;
    if (role[0].role === Role.MERCHANT) {
      merchant = await getMerchantByUserIdDao(user_id);
    }
    return await sendCredentialsEmail({
      email: user[0].email,
      username: user[0].user_name,
      code: merchant ? merchant[0].code : '',
      secretKey: merchant ? merchant[0].config.keys.private : '',
      publicKey: merchant ? merchant[0].config.keys.public : '',
      designation: designation[0].designation,
    });
  } catch (error) {
    logger.error('error getting while sending mail', error);
    throw error;
  }
};

const toggleUser2FAExemptionService = async (userId, exempt) => {
  try {
    const result = await updateUser2FAExemptionDao(userId, exempt);
    if (result) {
      logger.info(`[AUDIT] 2FA Exemption Updated: User ID ${userId} exemption set to ${exempt} at ${new Date().toISOString()}`);
    }
    return result;
  } catch (error) {
    logger.error('Error in toggleUser2FAExemptionService:', error);
    throw error;
  }
};

export {
  getUsersService,
  getUsersNameService,
  getUserByIdService,
  getUsersBySearchService,
  getUsersInfoBySearchService,
  getUsersByUserNameService,
  createUserService,
  userUpdateService,
  sendMailService,
  updateUser2FAService,
  toggleUser2FAExemptionService,
  resetUser2FAService,
  _createUserServiceInternal,
};
