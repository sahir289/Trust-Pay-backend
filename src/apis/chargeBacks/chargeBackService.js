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
  getMerchantConfigByUserIdDao,
  updateMerchantDao,
} from '../merchants/merchantDao.js';
import { trackVendorsNetBalance } from '../../utils/trackVendorsNetBalance.js';
import { newTableEntry } from '../../utils/sockets.js';
import { tableName } from '../../constants/index.js';

const _createChargeBackServiceInternal = async (
  payload,
  PayinDetails,
  role,
  company_id,
  user_id,
  conn,
  merchantCalculation,
  vendorCalculation,
) => {
  try {
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
    const companyData = await getCompanyDao(
      { id: company_id },
      null,
      null,
      null,
      null,
      conn,
    );
    if (!companyData || !companyData[0]) {
      throw new NotFoundError('Company not found');
    }
    let existingBlockedUsers = companyData[0]?.config?.blocked_users || [];
    let companyBlockedUsersObj =
      Array.isArray(existingBlockedUsers) && existingBlockedUsers[0]?.user_ip
        ? { user_ip: existingBlockedUsers[0].user_ip }
        : { user_ip: [] };
        const userIp = PayinDetails[0]?.user_ip?.trim();
        const isAlreadyBlocked =
          userIp && companyBlockedUsersObj?.user_ip.includes(userIp);
    let updatedCompanyBlockedUsers;
    if (!isAlreadyBlocked && userIp) {
      updatedCompanyBlockedUsers = {
        user_ip: [...companyBlockedUsersObj.user_ip, userIp],
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
    const data = await createChargeBackDao(payload, conn);
    const MerchantuserId = data.merchant_user_id;
    const merchantData = await getMerchantConfigByUserIdDao(MerchantuserId, conn);
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
    if (!vendorCalculation || !vendorCalculation[0]) {
      throw new NotFoundError('Vendor calculations not found');
    }
    const VendorId = vendorCalculation[0].id;
    const updatedCalculation = {
      total_chargeback_count: 1,
      total_chargeback_amount: amount,
      current_balance: -amount,
      net_balance: -amount,
    };
    const response = await updateCalculationBalanceDao(
      { id: VendorId },
      updatedCalculation,
      conn,
    );

    // Deferred — monitoring side-effect that must not block the response or risk rolling back the transaction
    setImmediate(() => {
      trackVendorsNetBalance(vendorCalculation[0].user_id, response).catch((err) =>
        logger.error('trackVendorsNetBalance failed:', err),
      );
    });
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: payload.company_id,
    //   message: `The new ChargeBack of amount ${payload.amount} against Merchant Order ID ${merchantOrderId} has been created.`,
    //   payloadUserId: payload.vendor_user_id,
    //   actorUserId: payload.merchant_user_id,
    //   category: 'ChargeBack',
    // });

    // Emit socket event for new chargeback
    const chargebackResponseObj = {
      id: data.id,
      sno: data.sno || null,
      merchant_user_id: data.merchant_user_id || null,
      vendor_user_id: data.vendor_user_id || null,
      payin_id: data.payin_id || null,
      bank_acc_id: data.bank_acc_id || null,
      amount: data.amount || 0,
      reference_date: data.reference_date || null,
      created_by: data.created_by || '',
      updated_by: data.updated_by || '',
      created_at: data.created_at,
      updated_at: data.updated_at,
      bank_name: PayinDetails[0]?.bank_name || PayinDetails[0]?.nick_name || null,
      utr: PayinDetails[0]?.utr || PayinDetails[0]?.user_submitted_utr || null,
      merchant_name: merchantData[0]?.name || null,
      config: data.config || {},
      user: PayinDetails[0]?.user || null,
      user_ip: PayinDetails[0]?.user_ip || null,
      merchant_order_id: PayinDetails[0]?.merchant_order_id || null,
      vendor_name: PayinDetails[0]?.vendor_name || null,
      merchant_display_code: merchantData[0]?.code || null,
      company_id: data.company_id || null,
      status: data.status || null,
    };
    setImmediate(() => {
      newTableEntry(tableName.CHARGE_BACK, chargebackResponseObj).catch((err) =>
        logger.error('Socket emit failed for chargeback:', err),
      );
    });

    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.CHARGE_BACK
        : columns.CHARGE_BACK;
    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    logger.error('error in _createChargeBackServiceInternal', error);
    throw error;
  }
};

const createChargeBackService = async (
  payload,
  PayinDetails,
  role,
  company_id,
  user_id,
) => {
  let conn;
  let committed = false;
  try {
    // Pre-fetch calculation rows in parallel before opening the transaction.
    // We only need the `id` from each row, and the updates are atomic increments,
    // so it is safe to read these outside the transaction.
    const [merchantCalculation, vendorCalculation] = await Promise.all([
      getCalculationforCronDao(PayinDetails[0].merchant_user_id),
      getCalculationforCronDao(PayinDetails[0].vendor_user_id),
    ]);
    if (!merchantCalculation?.[0]) {
      throw new NotFoundError('Merchant calculations not found');
    }
    if (!vendorCalculation?.[0]) {
      throw new NotFoundError('Vendor calculations not found');
    }

    conn = await getConnection();
    await beginTransaction(conn);
    const data = await _createChargeBackServiceInternal(
      payload,
      PayinDetails,
      role,
      company_id,
      user_id,
      conn,
      merchantCalculation,
      vendorCalculation,
    );
    await commit(conn);
    committed = true;
    return data;
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn);
    }
    logger.error('Error in createChargebackService', error);
    throw error;
  } finally {
    if (conn) conn.release();
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
        : role === Role.VENDOR || role === Role.SUB_VENDOR
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
    } else if (role === Role.VENDOR) {
      const userHierarchys = await getUserHierarchysDao({ user_id });
      if (userHierarchys && userHierarchys.length > 0) {
        const userHierarchy = userHierarchys[0];
        if (
          userHierarchy?.config &&
          Array.isArray(userHierarchy?.config?.siblings?.sub_vendors)
        ) {
          filters.vendor_user_id = [
            ...filters.vendor_user_id,
            ...(userHierarchy?.config?.siblings?.sub_vendors ?? []),
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
        : role === Role.VENDOR || role === Role.SUB_VENDOR
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
    } else if (role === Role.VENDOR) {
      const userHierarchys = await getUserHierarchysDao({ user_id });
      if (userHierarchys && userHierarchys.length > 0) {
        const userHierarchy = userHierarchys[0];
        if (
          userHierarchy?.config &&
          Array.isArray(userHierarchy?.config?.siblings?.sub_vendors)
        ) {
          filters.vendor_user_id = [
            ...filters.vendor_user_id,
            ...(userHierarchy?.config?.siblings?.sub_vendors ?? []),
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

const _blockChargebackUserServiceInternal = async (ids, data, conn) => {
  try {
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
      if (!companyBlockedIPs.includes(user_ip?.trim())) {
        companyBlockedIPs.push(user_ip?.trim());
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
        (ip) => ip?.trim() !== user_ip?.trim(),
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

    const config = { blocked_users: updatedChargebackBlockedUsers };
    const result = await updateChargeBackDao(
      { id, company_id },
      { config },
      conn,
    );
    return result;
  } catch (error) {
    logger.error('error in _blockChargebackUserServiceInternal', error);
    throw error;
  }
};

const blockChargebackUserService = async (ids, data) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);

    const result = await _blockChargebackUserServiceInternal(ids, data, conn);

    await commit(conn);
    committed = true;
    return result;
  } catch (error) {
    if (conn && !committed) await rollback(conn);
    logger.error('Error in blockChargebackUserService', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

const _updateChargeBackServiceInternal = async (
  ids,
  payload,
  chargeBack,
  conn,
) => {
  try {
    const data = await updateChargeBackDao(ids, payload, conn);
    let MerchantuserId = data.merchant_user_id;
    const merchantCalculation = await getCalculationforCronDao(
      MerchantuserId,
      conn,
    );
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
        // total_chargeback_count: 1,
        total_chargeback_amount: amount,
        current_balance: -amount,
        net_balance: -amount,
      },
      conn,
    );
    // update vendor calculations
    let VendorUserId = data.vendor_user_id;
    const vendorCalculation = await getCalculationforCronDao(
      VendorUserId,
      conn,
    );
    let VendorId = vendorCalculation[0].id;
    const updatedCalculation = {
      total_chargeback_count: 1,
      total_chargeback_amount: amount,
      current_balance: -amount,
      net_balance: -amount,
    };
    const response = await updateCalculationBalanceDao(
      { id: VendorId },
      updatedCalculation,
      conn,
    );

    await trackVendorsNetBalance(vendorCalculation[0].user_id, response);

    // Emit socket event for updated chargeback
    const chargebackResponseObj = {
      id: data.id,
      sno: data.sno || null,
      merchant_user_id: data.merchant_user_id || null,
      vendor_user_id: data.vendor_user_id || null,
      payin_id: data.payin_id || null,
      bank_acc_id: data.bank_acc_id || null,
      amount: data.amount || 0,
      reference_date: data.reference_date || null,
      created_by: data.created_by || '',
      updated_by: data.updated_by || '',
      created_at: data.created_at,
      updated_at: data.updated_at,
      bank_name: chargeBack?.bank_name || chargeBack?.nick_name || null,
      utr: chargeBack?.utr || chargeBack?.user_submitted_utr || null,
      merchant_name: chargeBack?.merchant_name || null,
      config: data.config || {},
      user: chargeBack?.user || null,
      user_ip: chargeBack?.user_ip || null,
      merchant_order_id: chargeBack?.merchant_order_id || null,
      vendor_name: chargeBack?.vendor_name || null,
      merchant_display_code: chargeBack?.merchant_display_code || chargeBack?.merchant_code || null,
      company_id: data.company_id || null,
      status: data.status || null,
    };
    setImmediate(() => {
      newTableEntry(tableName.CHARGE_BACK, chargebackResponseObj).catch((err) =>
        logger.error('Socket emit failed for chargeback update:', err),
      );
    });

    return data;
  } catch (error) {
    logger.error('error in _updateChargeBackServiceInternal', error);
    throw error;
  }
};

const updateChargeBackService = async (ids, payload) => {
  let conn;
  let committed = false;
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
    const data = await _updateChargeBackServiceInternal(
      ids,
      payload,
      chargeBack,
      conn,
    );
    await commit(conn);
    committed = true;
    return data;
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn); // Rollback the transaction in case of error
    }
    logger.error('Error while updating ChargeBack', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

const _deleteChargeBackServiceInternal = async (ids, payload, role, conn) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.CHARGE_BACK
        : role === Role.VENDOR || role === Role.SUB_VENDOR
          ? vendorColumns.CHARGE_BACK
          : columns.CHARGE_BACK;

    const data = await deleteChargeBackDao(ids, payload, conn);
    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    logger.error('error in _deleteChargeBackServiceInternal', error);
    throw error;
  }
};

const deleteChargeBackService = async (ids, payload, role) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const finalResult = await _deleteChargeBackServiceInternal(
      ids,
      payload,
      role,
      conn,
    );
    await commit(conn);
    committed = true;
    return finalResult;
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn); // Rollback the transaction in case of error
    }
    logger.error('Error while deleting ChargeBack', error);
    throw error;
  } finally {
    if (conn) conn.release();
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
