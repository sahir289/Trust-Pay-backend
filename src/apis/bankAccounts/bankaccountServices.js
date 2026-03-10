import { Role } from '../../constants/index.js';
import { BadRequestError, InternalServerError } from '../../utils/appErrors.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
import { stringifyJSON } from '../../utils/index.js';
import { logger } from '../../utils/logger.js';
import redisClient from '../../utils/redisClient.js';
// import { notifyAdminsAndUsers } from '../../utils/notifyUsers.js';
import { deactivateBank } from '../../utils/sockets.js';
import {
  // getBankResponseDaoAll,
  updateBotResponseDao,
  getBankResponsesforFreeze,
} from '../bankResponse/bankResponseDao.js';
import { getCalculationforCronDao } from '../calculation/calculationDao.js';
import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
import { getVendorsDao } from '../vendors/vendorDao.js';
import {
  getBankaccountDao,
  createBankaccountDao,
  updateBankaccountDao,
  deleteBankaccountDao,
  getBankAccountDaoNickName,
  getBankAccountsBySearchDao,
  getAllBankaccountDao,
} from './bankaccountDao.js';

const BANK_NAMES_CACHE_TTL_SEC = Number.parseInt(
  process.env.BANK_NAMES_CACHE_TTL_SEC || '30',
  10,
);

const getBankaccountService = async (
  filters,
  company_id,
  role,
  page,
  limit,
  user_id,
  designation,
) => {
  let conn;
  try {
    conn = await getConnection();
    if (role == Role.VENDOR) {
      const userHierarchys = await getUserHierarchysDao(
        { user_id },
        null,
        null,
        null,
        null,
        null,
        conn,
      );
      const userHierarchy = userHierarchys?.[0];

      const subVendors = userHierarchy?.config?.siblings?.sub_vendors ?? [];
      if (Array.isArray(subVendors) && subVendors.length > 0) {
        const vendorUserIds = [user_id, ...subVendors];
        filters.user_id = vendorUserIds;
      } else {
        filters.user_id = [user_id];
      }
    } else if (role == Role.SUB_VENDOR) {
      filters.user_id = [user_id];
    }

    const userHierarchys = await getUserHierarchysDao(
      { user_id },
      null,
      null,
      null,
      null,
      null,
      conn,
    );
    if (designation == Role.VENDOR_OPERATIONS) {
      const userHierarchy = userHierarchys?.[0];
      const parentID = userHierarchy?.config?.parent;
      const subVendors = userHierarchy?.config?.siblings?.sub_vendors ?? [];

      if (parentID) {
        if (Array.isArray(subVendors) && subVendors.length > 0) {
          const vendorUserIds = [parentID, ...subVendors];
          filters.user_id = vendorUserIds;
        } else {
          filters.user_id = [parentID];
        }
      }
    }

    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;
    return await getAllBankaccountDao(
      { company_id, ...filters },
      pageNumber,
      pageSize,
      role,
      designation,
      conn,
    );
  } catch (error) {
    logger.error('error getting while  getting banks', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

const getBankAccountBySearchService = async (
  filters,
  company_id,
  role,
  page,
  limit,
  user_id,
  designation,
  search,
) => {
  let conn;
  try {
    conn = await getConnection();
    if (role == Role.VENDOR) {
      const userHierarchys = await getUserHierarchysDao(
        { user_id },
        null,
        null,
        null,
        null,
        null,
        conn,
      );
      const userHierarchy = userHierarchys?.[0];

      const subVendors = userHierarchy?.config?.siblings?.sub_vendors ?? [];
      if (Array.isArray(subVendors) && subVendors.length > 0) {
        const vendorUserIds = [user_id, ...subVendors];
        filters.user_id = vendorUserIds;
      } else {
        filters.user_id = [user_id];
      }
    } else if (role == Role.SUB_VENDOR) {
      filters.user_id = [user_id];
    }

    const userHierarchys = await getUserHierarchysDao(
      { user_id },
      null,
      null,
      null,
      null,
      null,
      conn,
    );
    if (designation == Role.VENDOR_OPERATIONS) {
      const userHierarchy = userHierarchys?.[0];
      const parentID = userHierarchy?.config?.parent;
      const subVendors = userHierarchy?.config?.siblings?.sub_vendors ?? [];

      if (parentID) {
        if (Array.isArray(subVendors) && subVendors.length > 0) {
          const vendorUserIds = [parentID, ...subVendors];
          filters.user_id = vendorUserIds;
        } else {
          filters.user_id = [parentID];
        }
      }
    }

    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;
    let searchTerms;
    if (search) {
      searchTerms = search
        .split(',')
        .map((term) => term.trim())
        .filter((term) => term.length > 0);
    }
    const banks = await getBankAccountsBySearchDao(
      { company_id, ...filters },
      pageNumber,
      pageSize,
      role,
      designation,
      searchTerms,
      conn,
    );
    return banks;
  } catch (error) {
    logger.error('error getting while getting check utr by search', error);
    throw new InternalServerError(error.message);
  } finally {
    if (conn) conn.release();
  }
};

const getBankaccountServiceNickName = async (
  company_id,
  type,
  role,
  user_id,
  designation,
  user,
  // check_enabled
) => {
  let conn;
  try {
    const userFilterKey = Array.isArray(user)
      ? user.join(',')
      : user || '';
    const cacheKey = `bank:names:${company_id}:${type}:${role}:${user_id}:${designation}:${userFilterKey}`;

    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    conn = await getConnection();
    let filters = {};
    if (role == Role.VENDOR) {
      const userHierarchys = await getUserHierarchysDao(
        { user_id },
        null,
        null,
        null,
        null,
        null,
        conn,
      );
      const userHierarchy = userHierarchys?.[0];

      const subVendors = userHierarchy?.config?.siblings?.sub_vendors ?? [];
      if (Array.isArray(subVendors) && subVendors.length > 0) {
        const vendorUserIds = [user_id, ...subVendors];
        filters.user_id = vendorUserIds;
      } else {
        filters.user_id = [user_id];
      }
    } else if (role == Role.SUB_VENDOR) {
      filters.user_id = [user_id];
    }
    // If user is an array, use it directly
    if (Array.isArray(user)) {
      filters.user_id = user;
    } else if (user) {
      filters.user_id = [user];
    }
    const userHierarchys = await getUserHierarchysDao(
      { user_id },
      null,
      null,
      null,
      null,
      null,
      conn,
    );
    if (designation == Role.VENDOR_OPERATIONS) {
      const userHierarchy = userHierarchys?.[0];
      const parentID = userHierarchy?.config?.parent;
      const subVendors = userHierarchy?.config?.siblings?.sub_vendors ?? [];

      if (parentID) {
        if (Array.isArray(subVendors) && subVendors.length > 0) {
          const vendorUserIds = [parentID, ...subVendors];
          filters.user_id = vendorUserIds;
        } else {
          filters.user_id = [parentID];
        }
      }
    }

    const result = await getBankAccountDaoNickName(
      company_id,
      type,
      filters,
      conn,
      // check_enabled
    );

    await redisClient.set(
      cacheKey,
      JSON.stringify(result),
      'EX',
      BANK_NAMES_CACHE_TTL_SEC,
    );

    return result;
  } catch (error) {
    logger.error('Error in getBankaccountServiceNickName', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

const _createBankaccountServiceInternal = async (
  payload,
  designation,
  user_id,
  conn = null,
  // company_id,
) => {
  try {
    //child add bankaccount for its parent
    if (designation === Role.VENDOR_OPERATIONS) {
      const childHierarchy = await getUserHierarchysDao(
        { user_id },
        null,
        null,
        null,
        null,
        null,
        conn,
      );
      const parentUserId = childHierarchy[0].config.parent;
      payload.user_id = parentUserId;
    }
    if (designation === Role.VENDOR_ADMIN && !payload.user_id) {
      throw new BadRequestError(
        'Vendor Admins are not allowed to create own bank accounts.',
      );
    }
    const result = await createBankaccountDao(payload, conn);
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: company_id,
    //   message: `A new ${payload.bank_used_for} bank account with nick name ${payload.nick_name} has been created.`,
    //   payloadUserId: payload.user_id,
    //   actorUserId: user_id,
    //   category: 'Bank Account',
    // });
    return result;
  } catch (error) {
    logger.error('error in _createBankaccountServiceInternal', error);
    throw error;
  }
};

const createBankaccountService = async (
  payload,
  designation,
  user_id,
  // company_id,
) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const result = await _createBankaccountServiceInternal(
      payload,
      designation,
      user_id,
      conn,
      // company_id,
    );
    await commit(conn);
    committed = true;
    return result;
  } catch (error) {
    if (conn && !committed) await rollback(conn);
    logger.error('error getting while  creating banks', error.message);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

// Internal helper for updateBankaccount - used when called within another service's transaction
const _updateBankaccountInternal = async (
  ids,
  payload,
  role,
  conn = null,
  // company_id,
  // user_id,
) => {
  try {
    let result;

    const bank = await getBankaccountDao(
      {
        id: ids.id,
        company_id: ids.company_id,
      },
      null,
      null,
      role,
      null,
      conn,
    );

    if (payload?.is_enabled === false) {
      // Clear merchants array when bank is disabled
      payload = {
        ...payload,
        config: {
          ...payload.config,
          merchants: [],
        },
      };
    }

    // Check net_balance limit when trying to enable a bank
    if (
      payload?.is_enabled === true &&
      bank[0]?.user_id &&
      bank[0]?.bank_used_for === 'PayIn'
    ) {
      const userId = bank[0].user_id;

      // Get vendor by userId
      const vendors = await getVendorsDao(
        { user_id: userId },
        null,
        null,
        null,
        null,
        null,
        null,
        conn,
      );
      if (vendors && vendors.length > 0) {
        const vendor = vendors[0];
        const netBalanceLimit = vendor?.config?.net_balance;

        if (netBalanceLimit && netBalanceLimit > 0) {
          // Get calculation entry by userId
          const calculations = await getCalculationforCronDao(userId, conn);
          if (calculations && calculations.length > 0) {
            const currentNetBalance = calculations[0].net_balance;

            // Check if current net_balance exceeds the limit
            if (currentNetBalance > netBalanceLimit) {
              throw new BadRequestError(
                `Cannot enable bank account. Current net balance (${currentNetBalance}) exceeds the allowed limit (${netBalanceLimit}).`,
              );
            }
          }
        }
      }
    }

    //show notification only to vendor whose bank status is updated
    let userId = bank[0].user_id;
    const userHierarchys = await getUserHierarchysDao(
      { user_id: userId },
      null,
      null,
      null,
      null,
      null,
      conn,
    );
    if (role === Role.VENDOR_OPERATIONS) {
      userId = userHierarchys[0]?.config?.parent;
    }
    if (
      Object.keys(payload).length === 1 &&
      payload.latest_balance &&
      bank[0].is_enabled &&
      bank[0].config?.max_limit &&
      bank[0].config?.max_limit !== 0
    ) {
      if (payload.latest_balance >= bank[0].config?.max_limit) {
        payload.is_enabled = false;
        payload = {
          ...payload,
          config: {
            ...bank[0].config,
            merchants: [],
          },
        };
        deactivateBank(bank[0].nick_name, ids.id, userId);
      } else if (payload.latest_balance === bank[0].config?.max_limit) {
        deactivateBank(bank[0].nick_name, ids.id, true);
      }
    }
    delete payload.latest_balance;

    //added merchant_added key in config which contains date on which merchant is added along with its id
    if (payload?.config?.merchant_added) {
      const existingMerchantDetails = bank[0]?.config?.merchant_added || {};
      const newMerchantDetails = {};

      for (const key in payload.config.merchant_added) {
        const merchantId = key.replace(/^\[?"?|"?\]$/g, '');
        newMerchantDetails[merchantId] = payload.config.merchant_added[key];
      }

      payload.config.merchant_added = {
        ...existingMerchantDetails,
        ...newMerchantDetails,
      };
    }

    const payloadData = JSON.parse(stringifyJSON(payload));
    if (Object.keys(payload).length > 0) {
      result = await updateBankaccountDao(
        { id: ids.id, company_id: ids.company_id },
        payload,
        false, // isParentDeleted
        conn, // Pass connection
      );
    }
    if (payloadData?.config?.is_freeze === true) {
      const bankResponse = await getBankResponsesforFreeze(
        {
          bank_id: ids.id,
          is_used: false,
          status: '/success',
        },
        conn,
      );
      if (bankResponse.length > 0) {
        for (let i = 0; i < bankResponse.length; i++) {
          await updateBotResponseDao(
            bankResponse[i].id,
            {
              status: '/freezed',
            },
            conn,
          );
        }
      }
    }
    if (payloadData?.config?.is_freeze === false) {
      const bankResponse = await getBankResponsesforFreeze(
        {
          bank_id: ids.id,
          is_used: false,
          status: '/freezed',
        },
        conn,
      );
      if (bankResponse.length > 0) {
        for (let i = 0; i < bankResponse.length; i++) {
          await updateBotResponseDao(
            bankResponse[i].id,
            {
              status: '/success',
            },
            conn,
          );
        }
      }
    }

    return result;
  } catch (error) {
    logger.error('error in _updateBankaccountInternal', error);
    throw error;
  }
};

// Public service - manages its own transaction
const updateBankaccountService = async (
  ids,
  payload,
  role,
  // company_id,
  // user_id,
) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const result = await _updateBankaccountInternal(ids, payload, role, conn);
    await commit(conn);
    committed = true;
    return result;
  } catch (error) {
    if (conn && !committed) await rollback(conn);
    logger.error('error getting while  updating banks', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

const deleteBankaccountService = async (ids, user_id) => {
  try {
    const payload = { is_obsolete: true, updated_by: user_id };
    const result = await deleteBankaccountDao(
      { id: ids.id, company_id: ids.company_id },
      payload,
    );
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: ids.company_id,
    //   message: `Bank with nick name ${result.nick_name} has been deleted.`,
    //   payloadUserId: user_id,
    //   actorUserId: user_id,
    //   category: 'Bank Account',
    // });

    return result;
  } catch (error) {
    logger.error('error getting while deleting banks', error);
    throw error;
  }
};

const _activeInactiveBankAccountServiceInternal = async (
  ids,
  payload,
  conn,
) => {
  try {
    const result = await updateBankaccountDao(
      { id: ids.id, company_id: ids.company_id },
      payload,
      false, // isParentDeleted
      conn, // Pass connection for transaction
    );
    return result;
  } catch (error) {
    logger.error('error in _activeInactiveBankAccountServiceInternal', error);
    throw error;
  }
};

const activeInactiveBankAccountService = async (ids, payload) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const result = await _activeInactiveBankAccountServiceInternal(
      ids,
      payload,
      conn,
    );
    await commit(conn);
    committed = true;
    return result;
  } catch (error) {
    if (conn && !committed) await rollback(conn);
    logger.error('error getting while updating banks', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

export {
  getBankaccountService,
  getBankAccountBySearchService,
  createBankaccountService,
  updateBankaccountService,
  _updateBankaccountInternal, // Internal helper for use within transactions
  deleteBankaccountService,
  getBankaccountServiceNickName,
  activeInactiveBankAccountService,
};
