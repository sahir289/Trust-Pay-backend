import { Role } from '../../constants/index.js';
import { BadRequestError, InternalServerError } from '../../utils/appErrors.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { deactivateBank } from '../../utils/sockets.js';
import { getRoleDao } from '../roles/rolesDao.js';
import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
import { getUserByIdDao } from '../users/userDao.js';
import {
  getBeneficiaryAccountDao,
  createBeneficiaryAccountDao,
  updateBeneficiaryAccountDao,
  deleteBankaccountDao,
  getBeneficiaryAccountDaoByBankName,
  getBeneficiaryAccountBySearchDao,
} from './beneficiaryAccountDao.js';

const getBeneficiaryAccountService = async (
  filters,
  role,
  page,
  limit,
  user_id,
  designation,
) => {
  try {
    let merchant_user_id = role === Role.MERCHANT ? [user_id] : [];

    if (role === Role.MERCHANT) {
      const userHierarchys = await getUserHierarchysDao({ user_id });
      const userHierarchy = userHierarchys?.[0];

      if (designation === Role.MERCHANT && userHierarchy) {
        const subMerchants =
          userHierarchy?.config?.siblings?.sub_merchants ?? [];
        if (Array.isArray(subMerchants) && subMerchants.length > 0) {
          merchant_user_id = [...merchant_user_id, ...subMerchants];
          filters.user_id = [merchant_user_id];
        } else {
          filters.user_id = [user_id];
        }
      } else if (designation === Role.SUB_MERCHANT) {
        filters.user_id = [user_id];
      } else if (designation === Role.MERCHANT_OPERATIONS && userHierarchy) {
        const parentID = userHierarchy?.config?.parent;
        if (parentID) {
          const parentHierarchys = await getUserHierarchysDao({
            user_id: parentID,
          });
          const parentHierarchy = parentHierarchys?.[0];
          const subMerchants =
            parentHierarchy?.config?.siblings?.sub_merchants ?? [];

          const userIdFilter = [...new Set([parentID, ...subMerchants])];
          filters.user_id = [userIdFilter];
        }
      }
    } else if (role === Role.VENDOR) {
      if (designation == Role.VENDOR) {
        filters.user_id = [user_id];
      } else if (designation == Role.VENDOR_OPERATIONS) {
        const userHierarchys = await getUserHierarchysDao({ user_id });
        const parentID = userHierarchys[0]?.config?.parent;
        if (parentID) {
          filters.user_id = [parentID];
        }
      }
    }

    if (filters?.beneficiary_role) {
      const role_id = await getRoleDao({role: filters.beneficiary_role});
      filters.role_id = role_id[0]?.id;
      delete filters.beneficiary_role;
    }

    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;
    return await getBeneficiaryAccountDao(
      { ...filters },
      pageNumber,
      pageSize,
      role,
    );
  } catch (error) {
    logger.error('error getting while  getting banks', error);
    throw new InternalServerError(error);
  }
};

const getBeneficiaryAccountBySearchService = async (
  role,
  search,
  bank_used_for,
  page,
  limit,
) => {
  try {
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
      throw new BadRequestError('Invalid pagination parameters');
    }
    const searchTerms = search
      .split(',')
      .map((term) => term.trim())
      .filter((term) => term.length > 0);

    if (searchTerms.length === 0) {
      throw new BadRequestError('Please provide valid search items');
    }
    const offset = (pageNum - 1) * limitNum;
    return await getBeneficiaryAccountBySearchDao(
      role,
      searchTerms,
      limitNum,
      offset,
      bank_used_for,
    );
  } catch (error) {
    logger.error('error getting while getting check utr by search', error);
    throw new InternalServerError(error.message);
  }
};

const getBeneficiaryAccountServiceByBankName = async (
  company_id,
  type,
  role,
  user_id,
  designation,
) => {
  let conn;
  try {
    conn = await getConnection();
    await beginTransaction(conn);

    let filters = {};
    if (role == Role.VENDOR) {
      filters.user_id = [user_id];
    }
    const userHierarchys = await getUserHierarchysDao({ user_id });
    if (designation == Role.VENDOR_OPERATIONS) {
      const parentID = userHierarchys[0]?.config?.parent;
      if (parentID) {
        filters.user_id = [parentID];
      }
    }

    const result = await getBeneficiaryAccountDaoByBankName(
      conn,
      company_id,
      type,
      filters,
    );
    await commit(conn);
    return result;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn);
      } catch (rollbackError) {
        console.error('Error during transaction rollback', rollbackError);
      }
    }
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

const createBeneficiaryAccountService = async (payload) => {
  try {
    const role_id = await getUserByIdDao(payload.user_id);
    payload.role_id = role_id[0]?.id;
    const result = await createBeneficiaryAccountDao(payload);
    return result;
  } catch (error) {
    console.error('error getting while  creating banks', error);
    throw new BadRequestError('Error getting while  creating banks');
  }
};

const updateBeneficiaryAccountService = async (conn, ids, payload) => {
  try {
    let result;

    const bank = await getBeneficiaryAccountDao({
      id: ids.id,
    });

    if (Object.keys(payload).length === 0) {
      if (bank[0].today_balance >= bank[0].config?.max_limit) {
        payload.is_enabled = false;
        deactivateBank(bank[0].nick_name, ids.id);
      } else if (bank[0].today_balance === bank[0].config?.max_limit) {
        deactivateBank(bank[0].nick_name, ids.id, true);
      }
    }

    if (Object.keys(payload).length > 0) {
      result = await updateBeneficiaryAccountDao(
        { id: ids.id },
        payload,
        conn,
      );
    }
    return result;
  } catch (error) {
    console.error('error getting while  updating banks', error);
    throw new BadRequestError('Error getting while  updating banks');
  }
};

const deleteBeneficiaryAccountService = async (conn, ids) => {
  try {
    const payload = { is_obsolete: true };
    const result = await deleteBankaccountDao(
      conn,
      { id: ids.id },
      payload,
    );
    return result;
  } catch (error) {
    console.error('error getting while deleting banks', error);
    throw new BadRequestError('Error getting while  deleting banks');
  }
};

export {
  getBeneficiaryAccountService,
  getBeneficiaryAccountBySearchService,
  createBeneficiaryAccountService,
  updateBeneficiaryAccountService,
  deleteBeneficiaryAccountService,
  getBeneficiaryAccountServiceByBankName,
};
