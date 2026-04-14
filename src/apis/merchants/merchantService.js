import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from '../../utils/appErrors.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
import {
  createMerchantDao,
  deleteMerchantDao,
  getAllMerchantsDao,
  getMerchantByCodeDao,
  getMerchantsBySearchDao,
  getMerchantsCodeDao,
  getMerchantsDao,
  updateMerchantDao,
} from './merchantDao.js';
import {
  createUserHierarchyDao,
  getUserHierarchysDao,
  updateUserHierarchyDao,
} from '../userHierarchy/userHierarchyDao.js';
import {
  columns,
  merchantColumns,
  // Method,
  Role,
} from '../../constants/index.js';
import { filterResponse } from '../../helpers/index.js';
import { createCalculationDao } from '../calculation/calculationDao.js';
import { logger } from '../../utils/logger.js';
import {
  getBankaccountDao,
  updateBankaccountDao,
} from '../bankAccounts/bankaccountDao.js';
import { updateUserDao } from '../users/userDao.js';
import { getSessionByUserIdDao } from '../auth/authDao.js';
import { forceLogoutUser } from '../../utils/sockets.js';
// import { notifyAdminsAndUsers } from '../../utils/notifyUsers.js';
// Create Merchant Service

const _createMerchantServiceInternal = async (payload, conn) => {
  try {
    const parentId = payload.parent_id;
    delete payload.parentId;
    let Role_id = payload.role_id;
    let userRole = payload.role;
    let userDesignation = payload.designation;
    delete payload.role_id;
    delete payload.role;
    delete payload.designation;
    const data = await createMerchantDao(payload, conn);
    const calculationPayload = {
      role_id: Role_id,
      user_id: data.user_id,
      company_id: data.company_id,
    };
    await createCalculationDao(calculationPayload, conn);
    if (userRole === Role.MERCHANT) {
      await createUserHierarchyDao(
        {
          user_id: data.user_id,
          // role_id: Role_id,
          created_by: data.created_by,
          updated_by: data.updated_by,
          company_id: data.company_id,
        },
        conn,
      );
    }
    if (
      // userDesignation === Role.MERCHANT ||
      userDesignation === Role.SUB_MERCHANT
    ) {
      try {
        const hierarchy = await getUserHierarchysDao(
          { user_id: parentId },
          null,
          null,
          null,
          null,
          null,
          conn,
        );
        if (!hierarchy || !hierarchy[0]?.id) {
          logger.error('No hierarchy found for parentId:', parentId);
          return;
        }
        //  {"child":{"operations":[]},"siblings":{"sub_merchants":["19fb0634-31cc-41f3-a09f-29b524e4aee5","972d353d-158f-4013-93d6-a17f7e606800"]}}
        const currentChildren =
          hierarchy[0]?.config?.siblings?.sub_merchants || [];
        const userConfig = hierarchy[0]?.config;
        await updateUserHierarchyDao(
          { id: hierarchy[0].id },
          {
            config: {
              ...userConfig,
              siblings: { sub_merchants: [...currentChildren, data.user_id] },
            },
          },
          conn,
        );
      } catch (error) {
        logger.error('Error updating hierarchy:', error);
      }
    }
    logger.log('Merchant created successfully');
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: payload.company_id,
    //   message: `New Merchant with Code ${data.code} has been created.`,
    //   payloadUserId: payload.updated_by,
    //   actorUserId:
    //     userDesignation === Role.SUB_MERCHANT ? parentId : payload.updated_by,
    //   category: 'Client',
    //   subCategory: 'Merchant'
    // });
    return data;
  } catch (error) {
    logger.error('Error in _createMerchantServiceInternal', error);
    throw error;
  }
};

const createMerchantService = async (payload) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const data = await _createMerchantServiceInternal(payload, conn);
    await commit(conn);
    committed = true;
    return data;
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn);
    }
    logger.error('Error while creating merchant', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

// Get Merchants Service
const getMerchantsService = async (
  filters,
  role,
  page,
  limit,
  designation,
  user_id,
) => {
  try {
    const filterColumns =
      role === Role.MERCHANT ? merchantColumns.MERCHANT : columns.MERCHANT;
    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;

    let userIdFilter = Array.isArray(user_id)
      ? [...user_id]
      : user_id
        ? [user_id]
        : [];
    if (role === Role.MERCHANT) {
      const userHierarchys = await getUserHierarchysDao(
        { user_id }
      );
      const userHierarchy = userHierarchys[0];
      if (designation === Role.MERCHANT || designation === Role.SUB_MERCHANT) {
        if (userHierarchy?.config?.siblings?.sub_merchants) {
          const subMerchants =
            userHierarchy?.config?.siblings?.sub_merchants ?? [];
          userIdFilter = [...new Set([...userIdFilter, ...subMerchants])];
        }
      } else if (designation === Role.MERCHANT_OPERATIONS) {
        const parentUserId = userHierarchy?.config?.parent;
        if (parentUserId && !userIdFilter.includes(parentUserId)) {
          userIdFilter.push(parentUserId);
        }
        if (parentUserId) {
          const parentHierarchys = await getUserHierarchysDao(
            {
              user_id: parentUserId,
            }
          );
          const parentHierarchy = parentHierarchys[0];
          if (parentHierarchy?.config?.siblings?.sub_merchants) {
            const subMerchants =
              parentHierarchy?.config?.siblings?.sub_merchants ?? [];
            userIdFilter = [...new Set([...userIdFilter, ...subMerchants])];
          }
        }
      }
    }
    if (userIdFilter.length > 0) {
      filters.user_id =
        userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
    }
    if (role === Role.ADMIN) {
      delete filters.user_id;
    }
    let data = await getAllMerchantsDao(
      filters,
      pageNumber,
      pageSize,
      'updated_at',
      null,
      role
    );

    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    logger.error('Error while fetching merchants', error);
    throw error;
  }
};
// let searchTerms;
// if (filters.search) {
//   searchTerms = filters.search
//     .split(',')
//     .map((term) => term.trim())
//     .filter((term) => term.length > 0);
// }
const getMerchantsBySearchService = async (
  filters,
  role,
  designation,
  user_id,
) => {
  try {
    // const filterColumns =
    //   role === Role.MERCHANT ? merchantColumns.MERCHANT : columns.MERCHANT;
    const pageNumber = parseInt(filters?.page, 10) || 1;
    const pageSize = parseInt(filters?.limit, 10) || 10;

    let userIdFilter = Array.isArray(user_id)
      ? [...user_id]
      : user_id
        ? [user_id]
        : [];
    if (role === Role.MERCHANT) {
      const userHierarchys = await getUserHierarchysDao(
        { user_id }
      );
      const userHierarchy = userHierarchys[0];
      if (designation === Role.MERCHANT || designation === Role.SUB_MERCHANT) {
        if (userHierarchy?.config?.siblings?.sub_merchants) {
          const subMerchants =
            userHierarchy?.config?.siblings?.sub_merchants ?? [];
          userIdFilter = [...new Set([...userIdFilter, ...subMerchants])];
        }
      } else if (designation === Role.MERCHANT_OPERATIONS) {
        const parentUserId = userHierarchy?.config?.parent;
        if (parentUserId && !userIdFilter.includes(parentUserId)) {
          userIdFilter.push(parentUserId);
        }
        if (parentUserId) {
          const parentHierarchys = await getUserHierarchysDao(
            {
              user_id: parentUserId,
            }
          );
          const parentHierarchy = parentHierarchys[0];
          if (parentHierarchy?.config?.siblings?.sub_merchants) {
            const subMerchants =
              parentHierarchy?.config?.siblings?.sub_merchants ?? [];
            userIdFilter = [...new Set([...userIdFilter, ...subMerchants])];
          }
        }
      }
    }
    if (userIdFilter.length > 0) {
      filters.user_id =
        userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
    }
    if (role === Role.ADMIN) {
      delete filters.user_id;
    }

    let searchTerms;
    if (filters.search) {
      searchTerms = filters.search
        .split(',')
        .map((term) => term.trim())
        .filter((term) => term.length > 0);
    }
    const data = await getMerchantsBySearchDao(
      filters,
      pageNumber,
      pageSize,
      'updated_at',
      null,
      role,
      searchTerms
    );

    // let data = await getAllMerchantsDao(
    //   filters,
    //   pageNumber,
    //   pageSize,
    //   'updated_at',
    //   null,
    //   role,
    // );

    // const finalResult = filterResponse(data, filterColumns);
    return data;
  } catch (error) {
    logger.error('Error while fetching merchants by search', error);
    throw new InternalServerError(error.message);
  }
};

const getMerchantsServiceCode = async (
  filters,
  role,
  designation,
  user_id,
  includeSubMerchants,
  includeOnlyMerchants,
  excludeDisabledMerchant,
) => {
  try {
    let userIdFilter = Array.isArray(user_id)
      ? [...user_id]
      : user_id
        ? [user_id]
        : [];

    if (role === Role.MERCHANT) {
      const userHierarchys = await getUserHierarchysDao(
        { user_id }
      );
      const userHierarchy = userHierarchys[0];

      if (designation === Role.MERCHANT) {
        const subMerchants =
          userHierarchy?.config?.siblings?.sub_merchants ?? [];
        userIdFilter = [...new Set([...userIdFilter, ...subMerchants])];
      } else if (designation === Role.MERCHANT_OPERATIONS) {
        const parentUserId = userHierarchy?.config?.parent;
        if (parentUserId && !userIdFilter.includes(parentUserId)) {
          userIdFilter.push(parentUserId);
        }
        if (parentUserId) {
          const parentHierarchys = await getUserHierarchysDao(
            {
              user_id: parentUserId,
            }
          );
          const parentHierarchy = parentHierarchys[0];
          const subMerchants =
            parentHierarchy?.config?.siblings?.sub_merchants ?? [];
          userIdFilter = [...new Set([...userIdFilter, ...subMerchants])];
        }
      }
    }

    if (userIdFilter.length > 0) {
      filters.user_id =
        userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
    }

    if (role === Role.ADMIN) {
      delete filters.user_id;
      excludeDisabledMerchant = true;
    }

    const codes = await getMerchantsCodeDao(
      filters,
      includeSubMerchants,
      includeOnlyMerchants,
      excludeDisabledMerchant,
    );
    return codes;
  } catch (error) {
    logger.error('Error while getting merchants codes', error);
    throw error;
  }
};

// Update Merchant Service
const _updateMerchantServiceInternal = async (ids, payload) => {
  try {
    // const filterColumns =
    //   role === Role.MERCHANT ? merchantColumns.MERCHANT : columns.MERCHANT;
    if (payload?.whitelist_ips || payload?.whitelist_ips === '') {
      payload.config = {
        ...payload.config,
        whitelist_ips: payload?.whitelist_ips,
      };
    }
    delete payload.whitelist_ips;
    const data = await updateMerchantDao(ids, payload); // Adjust DAO call for update
    logger.log('Merchant updated successfully');
    // const finalResult = filterResponse(data, filterColumns);
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: ids.company_id,
    //   message: `Merchant with Code ${data.code} has been updated.`,
    //   payloadUserId: payload.updated_by,
    //   actorUserId: payload.updated_by,
    //   category: 'Client',
    //   subCategory: 'Merchant'
    // });
    return data;
  } catch (error) {
    logger.error('Error in _updateMerchantServiceInternal', error);
    throw error;
  }
};

const updateMerchantService = async (ids, payload) => {

  try {
    const data = await _updateMerchantServiceInternal(ids, payload);
    return data;
  } catch (error) {
    logger.error('Error while updating merchant', error);
    throw error;
  }
};

// Delete Merchant Service (with Transaction Handling)
const _deleteMerchantServiceInternal = async (
  ids,
  updated_by,
  roleIs,
  conn,
) => {
  try {
    const id = ids.id;
    const merchantDetails = await getMerchantsDao(
      { id },
      1,
      10,
      'updated_at',
      null,
      roleIs,
      conn,
    );

    //------delete merchant and submerchant--------------------

    const user_id = merchantDetails[0].user_id;
    const subMerchants = await getUserHierarchysDao(
      { user_id },
      null,
      null,
      null,
      null,
      null,
      conn,
    );
    const subMerchantIds =
      subMerchants[0]?.config?.siblings?.sub_merchants || [];
    const operationIds = subMerchants[0]?.config?.child?.operations || [];
    const allMerchantIds = [merchantDetails[0].id]; // start with this id
     const subMerchantsoperations = await getUserHierarchysDao(
       { user_id: subMerchantIds }
     );
        const suboperationIds =
          subMerchantsoperations[0]?.config?.child?.operations || [];
    const allIds = [...subMerchantIds, ...operationIds];
    for (const id of allIds) {
      const idsList = await getMerchantsDao(
        { user_id: id },
        null,
        null,
        null,
        null,
        null,
        conn,
      );
      if (Array.isArray(idsList)) {
        for (const merchant of idsList) {
          allMerchantIds.push(merchant.id);
        }
      } else if (idsList && idsList.id) {
        allMerchantIds.push(idsList.id);
      }
    }

    //------remove from bank assigned to merchant which are deleted--------------------

    ids.id = allMerchantIds;
    const merchant_id = [merchantDetails[0].id, ...subMerchantIds];
    const bankDetails = await getBankaccountDao(
      { merchant_id },
      null,
      null,
      roleIs,
      conn,
    );
    const userId = [merchantDetails[0].id];
    for (const subMerchantId of subMerchantIds) {
      const idsList = await getMerchantsDao(
        { user_id: subMerchantId },
        null,
        null,
        null,
        null,
        null,
        conn,
      );
      if (Array.isArray(idsList)) {
        for (const merchant of idsList) {
          userId.push(merchant.id);
        }
      } else if (idsList && idsList.id) {
        userId.push(idsList.id);
      }
    }
    for (const bank of bankDetails) {
      const currentMerchants = bank.config?.merchants || [];
      const filteredMerchants = currentMerchants.filter(
        (m) => !userId.includes(m),
      );
      const bankId = bank.id;
      await updateBankaccountDao(
        { id: bankId, company_id: ids.company_id },
        { config: { merchants: filteredMerchants } },
        conn,
      );
    }
    //delete user of merchant also
    const userIds = [
      merchantDetails[0].user_id,
      ...subMerchantIds,
      ...operationIds,
      ...suboperationIds,
    ];
    await updateUserDao(
      { id: userIds },
      { is_obsolete: true, is_enabled: false },
      conn,
    );
    let sessionData = {};
    sessionData.user_id = userIds;
    const sessions = await getSessionByUserIdDao(sessionData, conn);
    if (sessions && sessions.length > 0) {
      for (const session of sessions) {
        if (session?.session_id) {
          await forceLogoutUser(session.user_id, session.session_id);
        }
      }
    }
    const payload = { is_obsolete: true,is_enabled: false, updated_by };
    const data = await deleteMerchantDao(ids, payload, conn); // Adjust DAO call for delete
    logger.log('Merchant deleted successfully');
    // const userArr = await getUserByIdDao(conn, {
    //   id: userIds,
    //   company_id: ids.company_id,
    // });
    // const userCodes = userArr.map((user) => user.code).join(', ');
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: ids.company_id,
    //   message: `Merchants with Code ${userCodes} has been deleted.`,
    //   payloadUserId: updated_by,
    //   actorUserId: updated_by,
    //   category: 'Client',
    //   subCategory: 'Merchant'
    // });
    return data;
  } catch (error) {
    logger.error('Error in _deleteMerchantServiceInternal', error);
    throw error;
  }
};

const deleteMerchantService = async (ids, updated_by, roleIs) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn); // Start a transaction
    const data = await _deleteMerchantServiceInternal(
      ids,
      updated_by,
      roleIs,
      conn,
    );
    await commit(conn);
    committed = true; // Commit the transaction
    return data;
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn); // Rollback the transaction in case of error
    }
    logger.error('Error while deleting merchant', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

const getMerchantByIdService = async (
  filters,
  role,
  addUserHierarchy = false,
) => {
  try {
    const entryColumns =
      role === Role.MERCHANT ? merchantColumns.MERCHANT : columns.MERCHANT;
    const filterColumns = entryColumns.includes('user_id')
      ? entryColumns
      : [...entryColumns, 'user_id'];
    const dataArr = await getMerchantsDao(
      filters,
      null,
      null,
      null,
      null,
      filterColumns
    );

    const merchant = dataArr[0];

    if (!merchant) {
      throw new NotFoundError('Merchant not found!');
    }

    const user_id = merchant.user_id;
    delete merchant.user_id;

    if (addUserHierarchy) {
      // user_id is unique
      const userHierarchys = await getUserHierarchysDao(
        { user_id }
      );
      const userHierarchy = userHierarchys[0];

      if (
        !userHierarchy ||
        !userHierarchy.config ||
        !Array.isArray(userHierarchy.config[user_id])
      ) {
        merchant.subMerchants = [];
        return merchant;
      }

      merchant.subMerchants = await getMerchantsDao(
        {
          user_id: userHierarchy.config[user_id],
          company_id: filters.company_id,
        },
        null,
        null,
        null,
        null,
        filterColumns
      );
    }

    return merchant;
  } catch (error) {
    logger.error('Error while fetching merchant by ID', error);
    throw error;
  }
};

const getMerchantsByCodeService = async (code) => {
  try {
    if (!code) {
      throw new BadRequestError('Code is required');
    }
    const data = await getMerchantByCodeDao(code);
    if (data.length === 0) {
      throw new NotFoundError('Merchant not found');
    }
    return data[0];
  } catch (error) {
    logger.error('Error while fetching merchant by code', error);
    throw error;
  }
};

export {
  _createMerchantServiceInternal,
  createMerchantService,
  getMerchantsService,
  getMerchantsBySearchService,
  updateMerchantService,
  deleteMerchantService,
  getMerchantByIdService,
  getMerchantsServiceCode,
  getMerchantsByCodeService,
};
