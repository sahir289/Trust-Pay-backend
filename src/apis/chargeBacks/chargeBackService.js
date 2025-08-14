import { InternalServerError, NotFoundError } from '../../utils/appErrors.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
import {
  createChargeBackDao,
  deleteChargeBackDao,
  // getChargeBackDao,
  updateChargeBackDao,
  getChargeBacksBySearchDao,
  getChargebackByIdDao,
  getAllChargeBackDao,
} from './chargeBackDao.js';
import {
  columns,
  merchantColumns,
  Role,
  vendorColumns,
} from '../../constants/index.js';
import { BadRequestError } from '../../utils/appErrors.js';
import { filterResponse } from '../../helpers/index.js';
import { getCalculationforCronDao } from '../calculation/calculationDao.js';
import { updateCalculationBalanceDao } from '../calculation/calculationDao.js';
import { logger } from '../../utils/logger.js';
import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
// import { getVendorsDao,updateVendorDao } from '../vendors/vendorDao.js';
// import { getPayInDaoByCode } from '../payIn/payInDao.js';
import {
  getCompanyDao,
  updateCompanyConfigDao,
} from '../company/companyDao.js';
// import { notifyAdminsAndUsers } from '../../utils/notifyUsers.js';
import {
  getMerchantByUserIdDao,
  updateMerchantDao,
} from '../merchants/merchantDao.js';

const createChargeBackService = async (
  payload,
  PayinDetails,
  role,
  company_id,
  user_id,
) => {
  let conn;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    payload.vendor_user_id = PayinDetails[0].vendor_user_id;
    payload.merchant_user_id = PayinDetails[0].merchant_user_id;
    payload.payin_id = PayinDetails[0].payin_id;
    payload.bank_acc_id = PayinDetails[0].bank_acc_id;
    payload.created_by = user_id;
    payload.updated_by = user_id;
    payload.company_id = company_id;
    payload.config = {
      blocked_users: [
        { userId: PayinDetails[0].user, user_ip: PayinDetails[0].user_ip },
      ],
    };
    delete payload.merchant_order_id;
    const companyData = await getCompanyDao({ id: company_id });
    if (!companyData || !companyData[0]) {
      throw new NotFoundError('Company not found');
    }
    let existingBlockedUsers = companyData[0]?.config?.blocked_users || [];
    let companyBlockedUsersObj =
      Array.isArray(existingBlockedUsers) && existingBlockedUsers[0]?.user_ip
        ? { user_ip: existingBlockedUsers[0].user_ip }
        : { user_ip: [] };

    const isAlreadyBlocked = companyBlockedUsersObj.user_ip.includes(
      PayinDetails[0].user_ip.trim(),
    );
    let updatedCompanyBlockedUsers;
    if (!isAlreadyBlocked) {
      updatedCompanyBlockedUsers = {
        user_ip: [...companyBlockedUsersObj.user_ip, PayinDetails[0].user_ip],
      };
    } else {
      updatedCompanyBlockedUsers = companyBlockedUsersObj;
    }
    const dbCompanyBlockedUsers =
      updatedCompanyBlockedUsers.user_ip.length > 0
        ? [{ user_ip: updatedCompanyBlockedUsers.user_ip }]
        : [];
    await updateCompanyConfigDao(
      { id: company_id },
      {
        config: {
          blocked_users: dbCompanyBlockedUsers,
        },
      },
      conn,
    );
    const data = await createChargeBackDao(payload);
    const MerchantuserId = data.merchant_user_id;
    const merchantData = await getMerchantByUserIdDao(MerchantuserId);
    if (!merchantData || !merchantData[0]) {
      throw new NotFoundError('Merchant not found');
    }
    let existingBlockedUsersMerchant =
      merchantData[0]?.config?.blocked_users || [];
    let merchantBlockedUsersObj =
      Array.isArray(existingBlockedUsersMerchant) &&
      existingBlockedUsersMerchant[0]?.userId
        ? { userId: existingBlockedUsersMerchant[0].userId }
        : { userId: [] };
    if (merchantBlockedUsersObj.userId.join('') === PayinDetails[0].user) {
      merchantBlockedUsersObj.userId = [PayinDetails[0].user];
    }
    const isAlreadyUserBlocked = merchantBlockedUsersObj.userId.includes(
      PayinDetails[0].user,
    );
    let updatedMerchantBlockedUsers;
    if (!isAlreadyUserBlocked) {
      updatedMerchantBlockedUsers = {
        userId: [
          ...merchantBlockedUsersObj.userId.filter(
            (id) => id !== PayinDetails[0].user,
          ),
          PayinDetails[0].user,
        ],
      };
    } else {
      updatedMerchantBlockedUsers = merchantBlockedUsersObj;
    }
    const dbMerchantBlockedUsers =
      updatedMerchantBlockedUsers.userId.length > 0
        ? [{ userId: updatedMerchantBlockedUsers.userId }]
        : [];
    await updateMerchantDao(
      { user_id: MerchantuserId },
      {
        config: {
          blocked_users: dbMerchantBlockedUsers,
        },
      },
      conn,
    );
    const merchantCalculation = await getCalculationforCronDao(MerchantuserId);
    if (!merchantCalculation || !merchantCalculation[0]) {
      throw new NotFoundError('Merchant calculations not found');
    }
    const amount = Number(payload.amount);
    const merchantId = merchantCalculation[0].id;
    await updateCalculationBalanceDao(
      { id: merchantId },
      {
        total_chargeback_count: 1,
        total_chargeback_amount: amount,
        current_balance: -amount,
        net_balance: -amount,
      },
      conn,
    );
    const VendorUserId = data.vendor_user_id;
    const vendorCalculation = await getCalculationforCronDao(VendorUserId);
    if (!vendorCalculation || !vendorCalculation[0]) {
      throw new NotFoundError('Vendor calculations not found');
    }
    const VendorId = vendorCalculation[0].id;
    await updateCalculationBalanceDao(
      { id: VendorId },
      {
        total_chargeback_count: 1,
        total_chargeback_amount: amount,
        current_balance: -amount,
        net_balance: -amount,
      },
      conn,
    );
    await commit(conn);
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: payload.company_id,
    //   message: `The new ChargeBack of amount ${payload.amount} against Merchant Order ID ${merchantOrderId} has been created.`,
    //   payloadUserId: payload.vendor_user_id,
    //   actorUserId: payload.merchant_user_id,
    //   category: 'ChargeBack',
    // });
    return data;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn);
      } catch (rollbackError) {
        logger.error('Error during transaction rollback', rollbackError);
      }
      throw error;
    }
    logger.error('Error in createChargebackService', error);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        logger.error('Error while releasing the connection', releaseError);
      }
    }
  }
};

const getChargeBacksService = async (
  filters,
  role,
  page,
  limit,
  user_id,
  sortOrder = 'DESC',
  // designation,
) => {
  try {
    // Determine columns based on role
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.CHARGE_BACK
        : role === Role.VENDOR
          ? vendorColumns.CHARGE_BACK
          : columns.CHARGE_BACK;

    if (role == Role.MERCHANT) {
      filters.merchant_user_id = [user_id];
    }
    if (role == Role.VENDOR) {
      filters.vendor_user_id = [user_id];
    }

    if (role === Role.MERCHANT) {
      // user_id is unique
      const userHierarchys = await getUserHierarchysDao({ user_id });
      if (userHierarchys || userHierarchys.length > 0) {
        const userHierarchy = userHierarchys[0];

        if (
          userHierarchy?.config ||
          Array.isArray(userHierarchy?.config?.siblings?.sub_merchants)
        ) {
          filters.merchant_user_id = [
            ...filters.merchant_user_id,
            ...(userHierarchy?.config?.siblings?.sub_merchants ?? []),
          ];
        }
      }
    }

    // Parse and validate pagination parameters
    const pageNumber =
      page === 'no_pagination'
        ? null
        : Math.max(1, parseInt(String(page), 10) || 1);
    const pageSize =
      limit === 'no_pagination'
        ? null
        : Math.max(1, Math.min(100, parseInt(String(limit), 10) || 10)); // Added upper limit

    // Call DAO with all required parameters
    const chargeBacks = await getAllChargeBackDao(
      filters,
      pageNumber,
      pageSize,
      'sno',
      sortOrder,
      filterColumns,
      role,
    );

    // logger.info('Fetched ChargeBacks successfully', {
    //   role,
    //   page: pageNumber,
    //   limit: pageSize,
    //   filterCount: Object.keys(filters).length,
    // });

    return chargeBacks;
  } catch (error) {
    logger.error('Error while fetching ChargeBacks', {
      error: error instanceof Error ? error.message : String(error),
      role,
      filters,
      page,
      limit,
    });
    throw new InternalServerError(
      error instanceof Error ? error.message : 'Failed to fetch chargebacks',
    );
  }
};
const getChargeBacksBySearchService = async (
  filters,
  role,
  page,
  limit,
  user_id,
  sortOrder = 'DESC',
  // designation,
) => {
  try {
    // Determine columns based on role
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.CHARGE_BACK
        : role === Role.VENDOR
          ? vendorColumns.CHARGE_BACK
          : columns.CHARGE_BACK;

    if (role == Role.MERCHANT) {
      filters.merchant_user_id = [user_id];
    }
    if (role == Role.VENDOR) {
      filters.vendor_user_id = [user_id];
    }

    if (role === Role.MERCHANT) {
      // user_id is unique
      const userHierarchys = await getUserHierarchysDao({ user_id });
      if (userHierarchys || userHierarchys.length > 0) {
        const userHierarchy = userHierarchys[0];

        if (
          userHierarchy?.config ||
          Array.isArray(userHierarchy?.config?.siblings?.sub_merchants)
        ) {
          filters.merchant_user_id = [
            ...filters.merchant_user_id,
            ...(userHierarchy?.config?.siblings?.sub_merchants ?? []),
          ];
        }
      }
    }

    // Parse and validate pagination parameters
    const pageNumber =
      page === 'no_pagination'
        ? null
        : Math.max(1, parseInt(String(page), 10) || 1);
    const pageSize =
      limit === 'no_pagination'
        ? null
        : Math.max(1, Math.min(100, parseInt(String(limit), 10) || 10)); // Added upper limit
    let searchTerms;
    if (filters.search) {
       searchTerms = filters.search
        .split(',')
        .map((term) => term.trim())
        .filter((term) => term.length > 0);
    }
    // Call DAO with all required parameters
    const chargeBacks = await getChargeBacksBySearchDao(
      filters,
      pageNumber,
      pageSize,
      'sno',
      sortOrder,
      filterColumns,
      role,
      searchTerms,
    );

    // logger.info('Fetched ChargeBacks successfully', {
    //   role,
    //   page: pageNumber,
    //   limit: pageSize,
    //   filterCount: Object.keys(filters).length,
    // });

    return chargeBacks;
  } catch (error) {
    logger.error('Error while fetching chargeback by search', error);
    throw new InternalServerError(error.message);
  }
};

const blockChargebackUserService = async (ids, data) => {
  let conn;
  try {
    conn = await getConnection();

    await beginTransaction(conn);

    const { id, company_id } = ids;
    const { user_ip, userId, merchant_user_id } = data.config;

    const chargebackdata = await getChargebackByIdDao({ id });

    if (!chargebackdata?.[0]) throw new NotFoundError('Chargeback not found');

    const company = await getCompanyDao({ id: company_id });

    if (!company?.[0]) throw new NotFoundError('Company not found');

    const merchantData = await getMerchantByUserIdDao(merchant_user_id);

    if (!merchantData?.[0]) throw new NotFoundError('Merchant not found');

    // Normalize helper
    const normalize = (val) => val?.toString().trim().toLowerCase();
    const isSameUserEntry = (u1, u2) =>
      normalize(u1.userId) === normalize(u2.userId) &&
      normalize(u1.user_ip) === normalize(u2.user_ip);

    let chargebackBlockedUsers = chargebackdata[0]?.config?.blocked_users || [];

    const isBlocked = chargebackBlockedUsers.some((u) =>
      isSameUserEntry(u, { userId, user_ip }),
    );

    let updatedChargebackBlockedUsers;

    if (isBlocked) {
      // UNBLOCK
      updatedChargebackBlockedUsers = chargebackBlockedUsers.filter(
        (u) => !isSameUserEntry(u, { userId, user_ip }),
      );
    } else {
      // BLOCK
      updatedChargebackBlockedUsers = [
        ...chargebackBlockedUsers,
        { userId, user_ip },
      ];
    }

    await updateChargeBackDao(
      { id: chargebackdata[0].id },
      { config: { blocked_users: updatedChargebackBlockedUsers } },
      conn,
    );
    if (!isBlocked) {
      // ---- Company block ----
      let companyBlockedUsers = company[0]?.config?.blocked_users || [];
      let companyBlockedIPs =
        Array.isArray(companyBlockedUsers) && companyBlockedUsers[0]?.user_ip
          ? companyBlockedUsers[0].user_ip
          : [];
      if (!companyBlockedIPs.includes(user_ip.trim())) {
        companyBlockedIPs.push(user_ip.trim());
      }
      const updatedCompanyBlockedUsers = companyBlockedIPs.length
        ? [{ user_ip: companyBlockedIPs }]
        : [];
      await updateCompanyConfigDao(
        { id: company_id },
        { config: { blocked_users: updatedCompanyBlockedUsers } },
        conn,
      );
      // ---- Merchant block ----
      let merchantBlockedUsers = merchantData[0]?.config?.blocked_users || [];
      let merchantBlockedIds =
        Array.isArray(merchantBlockedUsers) && merchantBlockedUsers[0]?.userId
          ? merchantBlockedUsers[0].userId
          : [];

      if (!merchantBlockedIds.includes(userId)) {
        merchantBlockedIds.push(userId);
      }

      const updatedMerchantBlockedUsers = merchantBlockedIds.length
        ? [{ userId: merchantBlockedIds }]
        : [];

      await updateMerchantDao(
        { user_id: merchant_user_id },
        {
          config: {
            blocked_users: updatedMerchantBlockedUsers,
          },
        },
        conn,
      );
    } else {
      // ---- Company unblock ----
      let companyBlockedUsers = company[0]?.config?.blocked_users || [];
      let companyBlockedIPs =
        Array.isArray(companyBlockedUsers) && companyBlockedUsers[0]?.user_ip
          ? companyBlockedUsers[0].user_ip
          : [];
      companyBlockedIPs = companyBlockedIPs.filter(
        (ip) => ip.trim() !== user_ip.trim(),
      );

      const updatedCompanyBlockedUsers = companyBlockedIPs.length
        ? [{ user_ip: companyBlockedIPs }]
        : [];
      await updateCompanyConfigDao(
        { id: company_id },
        { config: { blocked_users: updatedCompanyBlockedUsers } },
        conn,
      );
      // ---- Merchant unblock ----
      let merchantBlockedUsers = merchantData[0]?.config?.blocked_users || [];
      let merchantBlockedIds =
        Array.isArray(merchantBlockedUsers) && merchantBlockedUsers[0]?.userId
          ? merchantBlockedUsers[0].userId
          : [];
      merchantBlockedIds = merchantBlockedIds.filter((id) => id !== userId);

      const updatedMerchantBlockedUsers = merchantBlockedIds.length
        ? [{ userId: merchantBlockedIds }]
        : [];
      await updateMerchantDao(
        { user_id: merchant_user_id },
        {
          config: {
            blocked_users: updatedMerchantBlockedUsers,
          },
        },
        conn,
      );
    }

    await commit(conn);
    return {
      id: chargebackdata[0].id,
      config: { blocked_users: updatedChargebackBlockedUsers },
    };
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn);
      } catch (rollbackError) {
        logger.error('Error during transaction rollback', rollbackError);
      }
      throw error;
    }
    logger.error('Error in blockChargebackUserService', error);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        logger.error('Error while releasing the connection', releaseError);
      }
    }
  }
};

const updateChargeBackService = async (ids, payload) => {
  let conn;
  try {
    const chargebackdata = await getChargebackByIdDao({
      id: ids.id,
      company_id: ids.company_id,
    });
    const chargeBack = chargebackdata[0];
    const today = new Date().toISOString().split('T')[0];
    const createdAtDate = new Date(chargeBack.created_at)
      .toISOString()
      .split('T')[0];

    if (createdAtDate !== today) {
      throw new BadRequestError('Chargeback data must be from today');
    }
    conn = await getConnection();
    await beginTransaction(conn);
    const data = await updateChargeBackDao(ids, payload);
    let MerchantuserId = data.merchant_user_id;
    const merchantCalculation = await getCalculationforCronDao(MerchantuserId);
    let amount = Number(data.amount - chargeBack.amount);
    if (data.amount > chargeBack.amount) {
      amount = Math.abs(amount);
    } else {
      amount = -Math.abs(amount);
    }
    let merchantId = merchantCalculation[0].id;
    await updateCalculationBalanceDao(
      { id: merchantId },
      {
        total_chargeback_count: 1,
        total_chargeback_amount: amount,
        current_balance: -amount,
        net_balance: -amount,
      },
      conn,
    );
    // update vendor calculations
    let VendorUserId = data.vendor_user_id;
    const vendorCalculation = await getCalculationforCronDao(VendorUserId);
    let VendorId = vendorCalculation[0].id;
    await updateCalculationBalanceDao(
      { id: VendorId },
      {
        total_chargeback_count: 1,
        total_chargeback_amount: amount,
        current_balance: -amount,
        net_balance: -amount,
      },
      conn,
    );
    await commit(conn); // Commit the transaction
    return data;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn); // Rollback the transaction in case of error
      } catch (rollbackError) {
        logger.error('Error during transaction rollback', rollbackError);
      }
    }
    logger.error('Error while updating ChargeBack', error);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        logger.error('Error while releasing the connection', releaseError);
      }
    }
  }
};

const deleteChargeBackService = async (ids, payload, role) => {
  let conn;
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.CHARGE_BACK
        : role === Role.VENDOR
          ? vendorColumns.CHARGE_BACK
          : columns.CHARGE_BACK;

    conn = await getConnection();
    await beginTransaction(conn); // Start a transaction

    const data = await deleteChargeBackDao(ids, payload); // Adjust DAO call for delete
    await commit(conn); // Commit the transaction

    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn); // Rollback the transaction in case of error
      } catch (rollbackError) {
        logger.error('Error during transaction rollback', rollbackError);
      }
    }
    logger.error('Error while deleting ChargeBack', error);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        logger.error('Error while releasing the connection', releaseError);
      }
    }
  }
};

export {
  createChargeBackService,
  getChargeBacksService,
  getChargeBacksBySearchService,
  updateChargeBackService,
  deleteChargeBackService,
  blockChargebackUserService,
};
