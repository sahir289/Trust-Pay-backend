import { v4 as uuidv4 } from 'uuid';
import { BadRequestError, NotFoundError } from '../../utils/appErrors.js';
import { Buffer } from 'buffer';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
import {
  assignedPayoutDao,
  createPayoutDao,
  deletePayoutDao,
  getPayoutsDao,
  getPayoutsBySearchDao,
  updatePayoutDao,
  getAllPayoutsDao,
  // getPayoutByMerchantOrderIdDao,
  getPayouStatusByIdDao,
  getPayoutByUtrIdDao,
} from './payOutDao.js';
import {
  getMerchantsDao,
  getMerchantByUserIdDao,
  getMerchantsByCodeDao,
  getMerchantByIdDao,
} from '../merchants/merchantDao.js';
import {
  getVendorByIdDao,
  getVendorsDao,
  getVendorIdsByUserIds,
} from '../vendors/vendorDao.js';
import {
  getCalculationDao,
  getCalculationforCronDao,
} from '../calculation/calculationDao.js';
import {
  // updateBankaccountDao,
  getBankByIdDao,
  updateBankAccountBalanceDao
} from '../bankAccounts/bankaccountDao.js';
import config from '../../config/config.js';
import { merchantPayoutCallback } from '../../callBacksAndWebHook/merchantCallBacks.js';
import { createTataPayBulkPayout } from '../../tatapay/tatapay.js';
import {
  columns,
  merchantColumns,
  Role,
  vendorColumns,
  Status,
  Method,
  tableName,
} from '../../constants/index.js';
import { calculateCommission, filterResponse, getISTDateString } from '../../helpers/index.js';
import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
import { updateCalculationBalanceDao } from '../calculation/calculationDao.js';
import { logger } from '../../utils/logger.js';
import { publishBulkPayout } from '../../rabbitmq/producer.js';
import { checkLockEdit } from '../../utils/advisoryLock.js';
import { stringifyJSON } from '../../utils/index.js';
// import { notifyAdminsAndUsers } from '../../utils/notifyUsers.js';
import { getCompanyByIDDao } from '../company/companyDao.js';
import { trackVendorsNetBalance } from '../../utils/trackVendorsNetBalance.js';
import {
  createClickrrPayout,
  getClickrrWalletBalance,
} from '../../clickrr/clickrr.js';
import {
  createPayAssistPayout,
  getPayAssistWalletBalance,
} from '../../payassist/payassist.js';
import {
  createPayDumPayout,
} from '../../paydum/paydum.js';
import { createTataPayPayout } from '../../tatapay/tatapay.js';
import {
  createRupeeFlowBulkPayout,
  createRupeeFlowPayout,
} from '../../rupeeflow/rupeeflow.js';
import { createBSSPayout } from '../../bss/bss.js';
import { createSilkPayPayout } from '../../silkpay/silkpay.js';
import { createBSS02Payout } from '../../bss/bss02.js';
import { createBSS03Payout } from '../../bss/bss03.js';
import { createVertexPayPayout } from '../../vertexpay/vertexpay.js';
import { createRunsafePayPayout, getRunsafePayWalletBalance } from '../../runsafe/runsafepay.js';
import { createPayInFintechPayout } from '../../payinfintech/payinfintech.js';
import {createPennyPayPayout} from '../../pennypay/pennypay.js';
import { emitTableEntryAsync } from '../../utils/socket/sessionUtils.js';
import {createFreechipsPayout} from '../../freechips/freechips.js'
import { getMerchantKeysFromCacheOrDb } from '../../utils/cachedData/getmerchantkeycache.js';
// import { notifyNewCalculationTableEntry } from '../../utils/sockets.js';

// Helper function to check if vendor is sub-vendor and get parent info
const getSubVendorParentInfo = async (vendor, conn) => {
  try {
    // Check is_owned config
    const isOwned = vendor.config?.is_owned;
    if (isOwned === true || isOwned === 'true') {
      // logger.info(
      //   `Vendor is owned (is_owned=${isOwned}), skipping parent calculation`,
      // );
      return null;
    }

    // logger.info(
    //   `Sub-vendor detected with is_owned=${isOwned}, fetching user hierarchy`,
    // );

    // Get user hierarchy to find parent
    const userHierarchys = await getUserHierarchysDao(
      {
        user_id: vendor.user_id,
      },
      null,
      null,
      null,
      null,
      null,
      conn,
    );

    // logger.info(`User hierarchy result: ${JSON.stringify(userHierarchys)}`);

    const userHierarchy = userHierarchys?.[0];
    const parentId = userHierarchy?.config?.parent;

    if (!parentId) {
      // logger.warn(`Sub-vendor ${vendor.user_id} has no parent in hierarchy`);
      return null;
    }

    // logger.info(`Found parent ID: ${parentId}, fetching parent vendor details`);

    // Get parent vendor details
    const parentVendors = await getVendorsDao({ user_id: parentId });
    if (!parentVendors || !parentVendors[0]) {
      // logger.warn(`Parent vendor not found for user_id: ${parentId}`);
      return null;
    }
    // logger.info(`Parent vendor found: ${JSON.stringify(parentVendors[0])}`);

    return {
      parentVendor: parentVendors[0],
      parentUserId: parentId,
    };
  } catch (error) {
    logger.error('Error in getSubVendorParentInfo:', error);
    return null;
  }
};

// Helper function to calculate commission for parent vendor
const updateParentVendorCalculation = async (
  parentUserId,
  amount,
  vendorCommissionRate,
  isApproved,
  conn,
) => {
  try {
    // logger.info(
    //   `updateParentVendorCalculation called with: parentUserId=${parentUserId}, amount=${amount}, rate=${vendorCommissionRate}, isApproved=${isApproved}`,
    // );
    const parentCommission = calculateCommission(amount, vendorCommissionRate);

    // logger.info(`Calculated parent commission: ${parentCommission}`);

    await updateCalculationTable(
      parentUserId,
      {
        payoutCommission: parentCommission,
        amount: 0, // Parent vendor amount is always 0, only commission is tracked
      },
      isApproved,
      conn,
    );

    // logger.info(
    //   `Parent vendor calculation table updated successfully for userId: ${parentUserId}`,
    // );

    return parentCommission;
  } catch (error) {
    logger.error('Error in updateParentVendorCalculation:', error);
    throw error;
  }
};

const _createPayoutServiceInternal = async (
  headers,
  payload,
  role,
  userIp,
  fromUI,
  conn,
) => {
  try {
    // const filterColumns =
    //   role === Role.MERCHANT
    //     ? merchantColumns.PAYOUT
    //     : role === Role.VENDOR
    //       ? vendorColumns.PAYOUT
    //       : columns.PAYOUT;
    const { code, amount, returnUrl, notifyUrl, _merchantData } = payload;
    const details = _merchantData ? [_merchantData] : await getMerchantsByCodeDao(code);

    if (!details[0] || details[0].length === 0) {
      const error = new BadRequestError(
        'Merchant is inactive. Contact support for help!',
      );
      error.statusCode = 404;
      throw error;
    }

    // if (details[0]?.config?.whitelist_ips && role !== Role.ADMIN) {
    //   let whitelist = details[0].config.whitelist_ips;
    //   // Normalize whitelist to array of trimmed strings
    //   if (typeof whitelist === 'string') {
    //     whitelist = whitelist
    //       .split(',')
    //       .map((ip) => ip.trim())
    //       .filter(Boolean);
    //   } else if (Array.isArray(whitelist)) {
    //     whitelist = whitelist.map((ip) => String(ip).trim()).filter(Boolean);
    //   } else {
    //     whitelist = [];
    //   }
    //   if (
    //     whitelist.length &&
    //     !whitelist.includes(userIp) &&
    //     role !== Role.ADMIN
    //   ) {
    //     throw new BadRequestError('IP not whitelisted');
    //   }
    // }

    if (details[0]?.balance < 0 && !details[0]?.config?.allow_payout) {
      throw new BadRequestError('Merchant balance is less than payout amount');
    }

    const { config, user_id } = details[0];
    // const merchantAPIKey = config?.keys;
    const payoutAmount = Number(amount);
    const balanceRestriction = config.balanceRestriction;
    const merchant_order_id = payload.merchant_order_id ?? uuidv4();
    delete payload.code;
    payload.merchant_id = details[0].id;
    payload.merchant_order_id = merchant_order_id;
    payload.config = stringifyJSON({
      urls: {
        return: returnUrl || details[0].config?.urls?.return || '',
        notify: notifyUrl || details[0].config?.urls?.payout_notify || '',
      },
    });
    delete payload.returnUrl;
    delete payload.notifyUrl;
    delete payload._merchantData;
    payload.company_id = payload.company_id
      ? payload.company_id
      : details[0].company_id;
    payload.created_by = payload.created_by ? payload.created_by : user_id;
    payload.updated_by = payload.updated_by ? payload.updated_by : user_id;
    // const isOrderIdExist = await getPayoutByMerchantOrderIdDao(
    //   merchant_order_id,
    //   payload.company_id,
    // );
    // if (isOrderIdExist) {
    //   throw new BadRequestError('Merchant Order ID already exists');
    // }

    // if (!x_api_key || !merchantAPIKey) {
    //   throw new NotFoundError('Enter valid Api key');
    // }

    // if (
    //   x_api_key !== merchantAPIKey?.private &&
    //   x_api_key !== merchantAPIKey?.public
    // ) {
    //   throw new NotFoundError('Enter valid Api key');
    // }
    if (
      (amount < details[0].min_payout || amount > details[0].max_payout) &&
      role !== Role.ADMIN
    ) {
      throw new BadRequestError(
        `Amount should be between ${details[0].min_payout} and ${details[0].max_payout}`,
      );
    }

    delete payload.x_api_key;
    let data;
    try {
      data = await createPayoutDao(payload, conn);
    } catch (error) {
      if (error.code === '23505' && error.message?.includes('merchant_order_id')) {
        throw new BadRequestError('Merchant Order ID already exists');
      }
      throw error;
    }

    if (balanceRestriction) {
      const { totalNetBalance } = await getCalculationDao({ user_id });

      if (totalNetBalance < payoutAmount) {
        throw new BadRequestError('Insufficient Balance to create Payout');
      }
      const ekoBalanceEnquiry = await ekoWalletBalanceEnquiryInternally();
      if (Number(ekoBalanceEnquiry.data.balance) < payoutAmount) {
        throw new BadRequestError('Insufficient Balance in Wallet');
      }
    }

    const {
      allow_clickrr,
      clickrr_auto_approval_limit,
      allow_payassist,
      payassist_auto_approval_limit,
      allow_runsafe,
      runsafe_auto_approval_limit,
    } = details[0]?.config || {};

    if (allow_payassist) {
      const ids = { id: data.id, company_id: payload.company_id };
      const payassistWalletBalance = await getPayAssistWalletBalance({
        company_id: payload.company_id,
      });
      let updatedData;
      if (Number(payoutAmount) < Number(payassist_auto_approval_limit)) {
        if (
          Number(payassistWalletBalance?.data?.walletBalance) <
          Number(payoutAmount)
        ) {
          data = {
            status: 201,
            message: 'Insufficient Balance in Wallet',
          };
          return data;
        }
        // specific to clickrr max payout limit
        const updatedPayload = { config: { method: 'PAYASSIST' } };
        // Use the DAO directly since we're already in a transaction
        updatedData = await _updatePayoutServiceInternal(
          ids,
          updatedPayload,
          role,
          conn,
        );
        data = updatedData;
      }
    }

    if (allow_clickrr) {
      const ids = { id: data.id, company_id: payload.company_id };
      const clickrrWalletBalance = await getClickrrWalletBalance({
        company_id: payload.company_id,
      });

      let updatedData;
      if (Number(payoutAmount) < Number(clickrr_auto_approval_limit)) {
        if (
          Number(clickrrWalletBalance?.data?.walletBalance) <
          Number(payoutAmount)
        ) {
          data = {
            status: 201,
            message: 'Insufficient Balance in Wallet',
          };
          return data;
        }
        // specific to clickrr max payout limit
        const updatedPayload = { config: { method: 'CLICKRR' } };
        // Use the DAO directly since we're already in a transaction
        updatedData = await _updatePayoutServiceInternal(
          ids,
          updatedPayload,
          role,
          conn,
        );
        data = updatedData;
      }
    }

    if (allow_runsafe) {
      const ids = { id: data.id, company_id: payload.company_id };
      const getRunsafeWalletBalance = await getRunsafePayWalletBalance({
        company_id: payload.company_id,
      });
      let updatedData;
      if (Number(payoutAmount) < Number(runsafe_auto_approval_limit)) {
        if (
          Number(getRunsafeWalletBalance?.data?.balance) <
          Number(payoutAmount)
        ) {
          data = {
            status: 201,
            message: 'Insufficient Balance in Wallet',
          };
          return data;
        }
        // specific to clickrr max payout limit
        const updatedPayload = { config: { method: 'runsafe' } };
        // Use the DAO directly since we're already in a transaction
        updatedData = await _updatePayoutServiceInternal(
          ids,
          updatedPayload,
          role,
          conn,
        );
        data = updatedData;
      }
    }

    if (!code) {
      throw new NotFoundError('Merchant does not exist');
    }

    // const finalResult = filterResponse(data, filterColumns);
    const responseObj = {
      id: data.id,
      sno: data.sno || null,
      amount: data.amount || 0,
      status: data.status || null,
      failed_reason: data.failed_reason || null,
      currency: data.currency || 'INR',
      upi_id: data.upi_id || null,
      utr_id: data.utr_id || null,
      rejected_reason: data.rejected_reason || null,
      merchant_id: data.merchant_id || null,
      company_id: data.company_id || null,
      payout_merchant_commission: data.payout_merchant_commission || 0,
      payout_vendor_commission: data.payout_vendor_commission || 0,
      actual_vendor_commission: data.actual_vendor_commission || '0',
      brokerage_commission: data.brokerage_commission || '0',
      merchant_order_id: data.merchant_order_id || null,
      bank_acc_id: data.bank_acc_id || null,
      approved_at: data.approved_at || null,
      created_by: data.created_by || '',
      updated_by: data.updated_by || '',
      user: data.user || data.created_by || '',
      created_at: data.created_at,
      vendor_code: null,
      vendor_id: data.vendor_id || null,
      vendor_user_id: null,
      payout_details: data.config || {},
      updated_at: data.updated_at,
      user_id: null,
      nick_name: null,
      merchant_details: {
        merchant_code: code || null,
        return_url: details[0]?.config?.urls?.return || null,
        notify_url: details[0]?.config?.urls?.payout_notify || null,
        public_key: details[0]?.config?.keys?.public || null,
        private_key: details[0]?.config?.keys?.private || null,
      },
      user_bank_details: {
        account_holder_name: data.acc_holder_name || null,
        account_no: data.acc_no || null,
        ifsc_code: data.ifsc_code || null,
        bank_name: data.bank_name || null,
      },
      rejected_at: data.rejected_at || null,
    };

    emitTableEntryAsync(tableName.PAYOUT, responseObj)
    return data;
  } catch (error) {
    logger.error('error in _createPayoutServiceInternal', error);
    throw error;
  }
};

const createPayoutService = async (headers, payload, role, fromUI) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const data = await _createPayoutServiceInternal(
      headers,
      payload,
      role,
      null,
      fromUI,
      conn,
    );
    await commit(conn);
    committed = true;
    return data;
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn);
    }
    logger.error('Error in createPayoutService', error.message);
    throw error;
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

const getPayoutsService = async (
  company_id,
  page,
  limit,
  sortOrder,
  filters,
  role,
  user_id,
  designation,
) => {
  try {
    const fetchMerchantIds = async (user_ids) => {
      const merchants = await getMerchantByUserIdDao(user_ids);
      return merchants.map((merchant) => merchant.id);
    };
    const fetchVendorIds = async (user_ids) => {
      const vendors = await getVendorsDao(
        { user_id: user_ids },
        null,
        null,
        null,
        null,
        null,
        null,
      );
      return vendors.map((vendor) => vendor.id);
    };

    let merchant_user_id = role === Role.MERCHANT ? [user_id] : [];

    if (role === Role.MERCHANT) {
      const userHierarchys = await getUserHierarchysDao(
        { user_id },
        null,
        null,
        null,
        null,
        null,
      );
      const userHierarchy = userHierarchys?.[0];

      if (designation === Role.MERCHANT && userHierarchy) {
        const subMerchants =
          userHierarchy?.config?.siblings?.sub_merchants ?? [];
        if (Array.isArray(subMerchants) && subMerchants.length > 0) {
          merchant_user_id = [...merchant_user_id, ...subMerchants];
          filters.merchant_id = await fetchMerchantIds(merchant_user_id);
        } else {
          filters.merchant_id = await fetchMerchantIds([user_id]);
        }
      } else if (designation === Role.SUB_MERCHANT) {
        filters.merchant_id = await fetchMerchantIds([user_id]);
      } else if (designation === Role.MERCHANT_OPERATIONS && userHierarchy) {
        const parentID = userHierarchy?.config?.parent;
        if (parentID) {
          const parentHierarchys = await getUserHierarchysDao(
            {
              user_id: parentID,
            },
            null,
            null,
            null,
            null,
            null,
          );
          const parentHierarchy = parentHierarchys?.[0];
          const subMerchants =
            parentHierarchy?.config?.siblings?.sub_merchants ?? [];

          const userIdFilter = [...new Set([parentID, ...subMerchants])];
          filters.merchant_id = await fetchMerchantIds(userIdFilter);
        }
      }
    } else if (role === Role.VENDOR || role === Role.SUB_VENDOR) {
      if (designation === Role.VENDOR || designation === Role.VENDOR_ADMIN) {
        const userHierarchys = await getUserHierarchysDao(
          { user_id },
          null,
          null,
          null,
          null,
          null,
        );
        const userHierarchy = userHierarchys?.[0];
        const subVendors = userHierarchy?.config?.siblings?.sub_vendors ?? [];
        if (Array.isArray(subVendors) && subVendors.length > 0) {
          const vendorUserIds = [user_id, ...subVendors];
          filters.vendor_id = [];
          for (const vendorUserId of vendorUserIds) {
            const vendorId = await fetchVendorIds([vendorUserId]);
            filters.vendor_id.push(...vendorId);
          }
        } else {
          filters.vendor_id = await fetchVendorIds([user_id]);
        }
      } else if (designation === Role.SUB_VENDOR) {
        filters.vendor_id = await fetchVendorIds([user_id]);
      } else if (designation === Role.VENDOR_OPERATIONS) {
        const userHierarchys = await getUserHierarchysDao(
          { user_id },
          null,
          null,
          null,
          null,
          null,
        );
        const userHierarchy = userHierarchys?.[0];
        const parentID = userHierarchy?.config?.parent;
        if (parentID) {
          const parentHierarchys = await getUserHierarchysDao(
            {
              user_id: parentID,
            },
            null,
            null,
            null,
            null,
            null,
          );
          const parentHierarchy = parentHierarchys?.[0];
          const subVendors =
            parentHierarchy?.config?.siblings?.sub_vendors ?? [];

          const userIdFilter = [...new Set([parentID, ...subVendors])];
          filters.vendor_id = await fetchVendorIds(userIdFilter);
        }
      }
    }

    const data = await getAllPayoutsDao(
      filters,
      company_id,
      page,
      limit,
      sortOrder,
      role,
    );

    return { totalCount: data[0]?.total, payout: data };
  } catch (error) {
    logger.error('Error in getPayoutsService:', error);
    throw error;
  }
};

const getPayoutsBySearchService = async (
  filters,
  role,
  user_id,
  designation,
  isAmount,
) => {
  try {
    const fetchMerchantIds = async (user_ids) => {
      const merchants = await getMerchantByUserIdDao(user_ids);
      return merchants.map((merchant) => merchant.id);
    };

    const fetchVendorIds = async (user_ids) => {
      const vendors = await getVendorIdsByUserIds(user_ids);
      return vendors;
    };

    let merchant_user_id = role === Role.MERCHANT ? [user_id] : [];

    if (role === Role.MERCHANT) {
      const userHierarchys = await getUserHierarchysDao(
        { user_id },
        null,
        null,
        null,
        null,
        null,
      );
      const userHierarchy = userHierarchys?.[0];

      if (designation === Role.MERCHANT && userHierarchy) {
        const subMerchants =
          userHierarchy?.config?.siblings?.sub_merchants ?? [];
        if (Array.isArray(subMerchants) && subMerchants.length > 0) {
          merchant_user_id = [...merchant_user_id, ...subMerchants];
          filters.merchant_id = await fetchMerchantIds(merchant_user_id);
        } else {
          filters.merchant_id = await fetchMerchantIds([user_id]);
        }
      } else if (designation === Role.SUB_MERCHANT) {
        filters.merchant_id = await fetchMerchantIds([user_id]);
      } else if (designation === Role.MERCHANT_OPERATIONS && userHierarchy) {
        const parentID = userHierarchy?.config?.parent;
        if (parentID) {
          const parentHierarchys = await getUserHierarchysDao(
            {
              user_id: parentID,
            },
            null,
            null,
            null,
            null,
            null,
          );
          const parentHierarchy = parentHierarchys?.[0];
          const subMerchants =
            parentHierarchy?.config?.siblings?.sub_merchants ?? [];

          const userIdFilter = [...new Set([parentID, ...subMerchants])];
          filters.merchant_id = await fetchMerchantIds(userIdFilter);
        }
      }
    } else if (role === Role.VENDOR) {
      if (designation === Role.VENDOR || designation === Role.VENDOR_ADMIN) {
        const userHierarchys = await getUserHierarchysDao(
          { user_id },
          null,
          null,
          null,
          null,
          null,
        );
        const userHierarchy = userHierarchys?.[0];

        const subVendors = userHierarchy?.config?.siblings?.sub_vendors ?? [];
        if (Array.isArray(subVendors) && subVendors.length > 0) {
          const vendorUserIds = [user_id, ...subVendors];
          filters.vendor_id = await fetchVendorIds(vendorUserIds);
        } else {
          filters.vendor_id = await fetchVendorIds([user_id]);
        }
      } else if (designation === Role.SUB_VENDOR) {
        filters.vendor_id = await fetchVendorIds([user_id]);
      } else if (designation === Role.VENDOR_OPERATIONS) {
        const userHierarchys = await getUserHierarchysDao(
          { user_id },
          null,
          null,
          null,
          null,
          null,
        );
        const userHierarchy = userHierarchys?.[0];
        const parentID = userHierarchy?.config?.parent;
        if (parentID) {
          const parentHierarchys = await getUserHierarchysDao(
            {
              user_id: parentID,
            },
            null,
            null,
            null,
            null,
            null,
          );
          const parentHierarchy = parentHierarchys?.[0];
          const subVendors =
            parentHierarchy?.config?.siblings?.sub_vendors ?? [];

          const userIdFilter = [...new Set([parentID, ...subVendors])];
          filters.vendor_id = await fetchVendorIds(userIdFilter);
        }
      }
    }
    if (filters.vendor_code) {
      const vendorDetails = await getVendorsDao(
        {
          code: filters.vendor_code.trim(),
        },
        null,
        null,
        null,
        null,
        null,
      );
      if (vendorDetails.length === 0) {
        return;
      }
      const parentHierarchys = await getUserHierarchysDao(
        {
          user_id: vendorDetails[0].user_id,
        },
        null,
        null,
        null,
        null,
        null,
      );
      const subVendors =
        parentHierarchys[0]?.config?.siblings?.sub_vendors ?? [];
      const userIdFilter = [
        ...new Set([vendorDetails[0].user_id, ...subVendors]),
      ];
      filters.vendor_id = await fetchVendorIds(userIdFilter);
      delete filters.vendor_code;
    }
    const pageNum = parseInt(filters.page);
    const limitNum = parseInt(filters.limit);
    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
      throw new BadRequestError('Invalid pagination parameters');
    }
    let searchTerms = [];
    if (filters.search || filters.search === '') {
      searchTerms = filters.search
        .split(',')
        .map((term) => term.trim())
        .filter((term) => term.length > 0);
    }

    // if (searchTerms.length === 0) {
    //   throw new BadRequestError('Please provide valid search terms');
    // }
    const offset = (pageNum - 1) * limitNum;
    const data = await getPayoutsBySearchDao(
      filters,
      searchTerms,
      limitNum,
      offset,
      role,
      isAmount,
    );

    return data;
  } catch (error) {
    logger.error('Error while fetching Payout by search', error);
    throw error;
  }
};

const _updatePayoutServiceInternal = async (
  ids,
  payload,
  role,
  conn = null
) => {
  try {
    const payoutStatusRow =
    await getPayouStatusByIdDao(
      ids.id,
      ids.company_id,
      conn,
      true, // FOR UPDATE
    );
      if (!payoutStatusRow) {
        throw new NotFoundError('Payout status not found!');
      }
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.PAYOUT
        : role === Role.VENDOR || role === Role.SUB_VENDOR
          ? vendorColumns.PAYOUT
          : columns.PAYOUT;

    const method = payload?.config?.method;
    if (
      method !== Method.CLICKRR &&
      method !== Method.PAYASSIST &&
      method !== Method.PAYDUM &&
      method !== Method.TATAPAY &&
      method !== Method.RUPEEFLOW &&
      method !== Method.BSS &&
      method !== Method.BSS02 &&
      method !== Method.BSS03 &&
      method !== Method.SILKPAY &&
      method !== Method.VERTEXPAY &&
      method !== Method.RUNSAFE_PAY &&
      method !== Method.PAYINFINTECH
    )
      await checkLockEdit(ids.id, false, conn);

    // Early validation for UTR uniqueness
    if (payload?.utr_id) {
      const payoutDetails = await getPayoutByUtrIdDao(
        payload.utr_id,
        ids.company_id,
        conn,
      );
      if (payoutDetails && payoutDetails?.id !== ids.id) {
        throw new BadRequestError('UTR already exists');
      }
    }

    // Set status based on payload conditions
    if (payload?.utr_id && !payload.status && payload?.bank_acc_id) {
      Object.assign(payload, {
        status: Status.APPROVED,
        approved_at: new Date().toISOString(),
      });
    }
    else if (payload?.utr_id && payload.status == Status.APPROVED) {
      Object.assign(payload, {
        approved_at: new Date().toISOString()
      });
    }
    if (payload?.config?.rejected_reason) {
      Object.assign(payload, {
        status: Status.REJECTED,
        rejected_at: new Date().toISOString(),
      });
    }
    if (payload.status === Status.INITIATED) {
      Object.assign(payload, { utr_id: '', rejected_reason: '' });
    }

    const isOnlyUtrUpdate =
      Boolean(payload?.utr_id) &&
      Object.keys(payload).every((key) =>
        ['utr_id', 'updated_by'].includes(key),
      );

    // Fetch payout data first
    const singleWithdrawDataArr = await getPayoutsDao(
      ids,
      null,
      null,
      null,
      'DESC',
      null,
      conn,
    );

    const singleWithdrawData = singleWithdrawDataArr[0];
    if (!singleWithdrawData) {
      throw new NotFoundError('Payout not found!');
    }
    if(singleWithdrawData.status === Status.APPROVED && payload.status !== Status.REVERSED && !payload.utr_id){
      throw new BadRequestError('Payout Already Approved');
    }
    if(singleWithdrawData.status !== Status.INITIATED && payload.vendor_id === null ){
      throw new BadRequestError('Payout Already Processed, cannot update vendor');
    }

    const previousStatus = payoutStatusRow.status;
    let earlyReturnResult = null;

    // Status validation logic - consolidated
    if (payload.status) {
      const currentStatus = previousStatus;
      const newStatus = payload.status;

      const invalidTransitions = [
        [Status.REJECTED, Status.APPROVED],
        [Status.APPROVED, Status.REJECTED],
      ];

      const isInvalidTransition = invalidTransitions.some(
        ([from, to]) => currentStatus === from && newStatus === to,
      );
      if (isInvalidTransition) {
        throw new BadRequestError(
          `Cannot change payout status from ${currentStatus} to ${newStatus}`,
        );
      }

      const isDuplicateTerminalUpdate =
        currentStatus === newStatus &&
        [Status.APPROVED, Status.REJECTED].includes(currentStatus) &&
        !payload.utr_id &&
        !payload.config &&
        !payload.bank_acc_id;

      if (isDuplicateTerminalUpdate) {
        throw new BadRequestError(`Payout is already ${currentStatus}`);
      }
    }

    // Fetch related data in parallel
    const bankID = payload.bank_acc_id || singleWithdrawData.bank_acc_id;
    let [merchantArr, bankDataArr] = await Promise.all([
      getMerchantByIdDao(singleWithdrawData.merchant_id, ids.company_id, conn),
      bankID ? getBankByIdDao({ id: bankID }, conn) : Promise.resolve([]),
    ]);

    const merchant = merchantArr[0];
    if (!merchant) {
      throw new NotFoundError('Merchant not found!');
    }

    if (payload?.config?.method === Method.EKO) {
      await processEkoPayout(singleWithdrawData, payload);
    } else if (payload?.config?.method === Method.CLICKRR) {
      const method = payload.config.method;

      const [company] = await getCompanyByIDDao({ id: ids.company_id }, conn);
      if (!company) throw new NotFoundError('Company not found');

      const bankId = company.config.CLICKRR.defaultBankId;
      if (!bankId)
        throw new NotFoundError(`Default bank ID not found for ${method}`);

      bankDataArr = await getBankByIdDao({ id: bankId }, conn);

      if (!bankDataArr[0])
        throw new NotFoundError(`Bank not found for ${method} payout`);

      const updatedPayload = await createClickrrPayout(
        payload,
        ids,
        singleWithdrawData,
        bankId,
      );
      payload = updatedPayload;
    }
    else if (payload?.config?.method === Method.PENNYPAY) {
      const method = payload.config.method;
      logger.info(`Processing PennyPay payout for method: ${method}`);
      const [company] = await getCompanyByIDDao({ id: ids.company_id }, conn);
      if (!company) throw new NotFoundError('Company not found');
      const bankId = company.config.PENNY_PAY.defaultBankId;
      if (!bankId)
        throw new NotFoundError(`Default bank ID not found for ${method}`);
      bankDataArr = await getBankByIdDao({ id: bankId });
      if (!bankDataArr[0])
        throw new NotFoundError(`Bank not found for ${method} payout`);
      logger.info(`Creating PennyPay payout with bankId: ${bankId}`);
     const [vendor] = await getVendorsDao({
      user_id: bankDataArr[0].user_id,
    });
    if (!vendor) {
      throw new NotFoundError('Vendor not found for PennyPay payout');
    }
      const xApiKey = company.config.PENNY_PAY.secretKey;
      const code = company.config.PENNY_PAY.code;
      if (!xApiKey || !code) {
        throw new NotFoundError(
          `PennyPay configuration missing for ${method} payout`,
        );
      }
      const updatedPayload = await createPennyPayPayout(
        payload,
        singleWithdrawData,
        vendor.id,
        bankId,
        'pennyPay',
        xApiKey,
        code
      );
      payload = updatedPayload;
    }
     else if (payload?.config?.method === Method.TRUSTPAY) {
      const method = payload.config.method;
      logger.info(`Processing TrustPay payout for method: ${method}`);
      const [company] = await getCompanyByIDDao({ id: ids.company_id }, conn);
      if (!company) throw new NotFoundError('Company not found');
      const bankId = company.config.TRUST_PAY.defaultBankId;
      if (!bankId)
        throw new NotFoundError(`Default bank ID not found for ${method}`);
      bankDataArr = await getBankByIdDao({ id: bankId });
      if (!bankDataArr[0])
        throw new NotFoundError(`Bank not found for ${method} payout`);
       const [vendor] = await getVendorsDao({
      user_id: bankDataArr[0].user_id,
    });
    if (!vendor) {
      throw new NotFoundError('Vendor not found for TrustPay payout');
    }
      logger.info(`Creating TrustPay payout with bankId: ${bankId}`);
       const xApiKey = company.config.TRUST_PAY.secretKey;
      const code = company.config.TRUST_PAY.code;
      if (!xApiKey || !code) {
        throw new NotFoundError(
          `Trustpay configuration missing for ${method} payout`,
        );
      }
      const updatedPayload = await createPennyPayPayout(
        payload,
        singleWithdrawData,
        vendor.id,
        bankId,
        'trustPay',
        xApiKey,
        code
      );
      payload = updatedPayload;
    }
     else if (payload?.config?.method === Method.PAYBITRA) {
      const method = payload.config.method;
      logger.info(`Processing PayBitra payout for method: ${method}`);
      const [company] = await getCompanyByIDDao({ id: ids.company_id }, conn);
      if (!company) throw new NotFoundError('Company not found');
      const bankId = company.config.PAY_BITRA?.defaultBankId;
      if (!bankId)
        throw new NotFoundError(`Default bank ID not found for ${method}`);
      bankDataArr = await getBankByIdDao({ id: bankId });
      if (!bankDataArr[0])
        throw new NotFoundError(`Bank not found for ${method} payout`);
      const [vendor] = await getVendorsDao({
        user_id: bankDataArr[0].user_id,
      });
      if (!vendor) {
        throw new NotFoundError('Vendor not found for PayBitra payout');
      }
      logger.info(`Creating PayBitra payout with bankId: ${bankId}`);
      const xApiKey = company.config.PAY_BITRA?.secretKey;
      const code = company.config.PAY_BITRA?.code;
      if (!xApiKey || !code) {
        throw new NotFoundError(
          `PayBitra configuration missing for ${method} payout`,
        );
      }
      const updatedPayload = await createPennyPayPayout(
        payload,
        singleWithdrawData,
        vendor.id,
        bankId,
        'payBitra',
        xApiKey,
        code
      );
      payload = updatedPayload;
    }
     else if (payload?.config?.method === Method.PAYCRIC) {
      const method = payload.config.method;
      logger.info(`Processing PayCric payout for method: ${method}`);
      const [company] = await getCompanyByIDDao({ id: ids.company_id }, conn);
      if (!company) throw new NotFoundError('Company not found');
      const bankId = company.config.PAY_CRIC?.defaultBankId;
      if (!bankId)
        throw new NotFoundError(`Default bank ID not found for ${method}`);
      bankDataArr = await getBankByIdDao({ id: bankId });
      if (!bankDataArr[0])
        throw new NotFoundError(`Bank not found for ${method} payout`);
      const [vendor] = await getVendorsDao({
        user_id: bankDataArr[0].user_id,
      });
      if (!vendor) {
        throw new NotFoundError('Vendor not found for PayCric payout');
      }
      logger.info(`Creating PayCric payout with bankId: ${bankId}`);
      const xApiKey = company.config.PAY_CRIC?.secretKey;
      const code = company.config.PAY_CRIC?.code;
      if (!xApiKey || !code) {
        throw new NotFoundError(
          `PayCric configuration missing for ${method} payout`,
        );
      }
      const updatedPayload = await createPennyPayPayout(
        payload,
        singleWithdrawData,
        vendor.id,
        bankId,
        'payCric',
        xApiKey,
        code
      );
      payload = updatedPayload;
    }
    else if (payload?.config?.method === Method.FREECHIPS) {
      const method = payload.config.method;
      logger.info(`Processing FREECHIPS payout for method: ${method}`);
      const [company] = await getCompanyByIDDao({ id: ids.company_id }, conn);
      if (!company) throw new NotFoundError('Company not found');
      const bankId = company.config.FREECHIPS?.defaultBankId;
      if (!bankId)
        throw new NotFoundError(`Default bank ID not found for ${method}`);
      bankDataArr = await getBankByIdDao({ id: bankId });
     const [vendor] = await getVendorsDao({
        user_id: bankDataArr[0].user_id,
      });
      if (!vendor) {
        throw new NotFoundError('Vendor not found for PayBitra payout');
      }
      const updatedPayload = await  createFreechipsPayout(
        payload,
        singleWithdrawData,
        vendor.id,
        bankId
      );
      payload = updatedPayload;
    }
     else if (payload?.config?.method === Method.BSS) {
      const method = payload.config.method;
      logger.info(`Processing BSS payout for method: ${method}`);
      const [company] = await getCompanyByIDDao({ id: ids.company_id }, conn);
      if (!company) throw new NotFoundError('Company not found');

      const bankId = company.config.BSS.defaultBankId;
      if (!bankId)
        throw new NotFoundError(`Default bank ID not found for ${method}`);

      bankDataArr = await getBankByIdDao({ id: bankId });

      if (!bankDataArr[0])
        throw new NotFoundError(`Bank not found for ${method} payout`);

      // const clientIp = getClientIp(req);
      logger.info(`Creating BSS payout with bankId: ${bankId}`);
      const updatedPayload = await createBSSPayout(
        payload,
        ids,
        singleWithdrawData,
        bankId,
      );
      payload = updatedPayload;
    } else if (payload?.config?.method === Method.SILKPAY) {
      const method = payload.config.method;
      logger.info(`Processing SilkPay payout for method: ${method}`);
      const [company] = await getCompanyByIDDao({ id: ids.company_id }, conn);
      if (!company) throw new NotFoundError('Company not found');

      const bankId = company.config.SILKPAY.defaultBankId;
      if (!bankId)
        throw new NotFoundError(`Default bank ID not found for ${method}`);

      bankDataArr = await getBankByIdDao({ id: bankId });

      if (!bankDataArr[0])
        throw new NotFoundError(`Bank not found for ${method} payout`);

      // const clientIp = getClientIp(req);
      logger.info(`Creating SilkPay payout with bankId: ${bankId}`);
      const updatedPayload = await createSilkPayPayout(
        payload,
        ids,
        singleWithdrawData,
        bankId,
      );
      payload = updatedPayload;
    } else if (payload?.config?.method === Method.BSS02) {
      const method = payload.config.method;
      logger.info(`Processing BSS1013 payout for method: ${method}`);
      const [company] = await getCompanyByIDDao({ id: ids.company_id }, conn);
      if (!company) throw new NotFoundError('Company not found');

      const bankId = company.config.BSS02.defaultBankId;
      if (!bankId)
        throw new NotFoundError(`Default bank ID not found for ${method}`);

      bankDataArr = await getBankByIdDao({ id: bankId });

      if (!bankDataArr[0])
        throw new NotFoundError(`Bank not found for ${method} payout`);

      // const clientIp = getClientIp(req);
      logger.info(`Creating BSS1013 payout with bankId: ${bankId}`);
      const updatedPayload = await createBSS02Payout(
        payload,
        ids,
        singleWithdrawData,
        bankId,
      );
      payload = updatedPayload;
    } else if (payload?.config?.method === Method.BSS03) {
      const method = payload.config.method;
      logger.info(`Processing BSS1015 payout for method: ${method}`);
      const [company] = await getCompanyByIDDao({ id: ids.company_id }, conn);
      if (!company) throw new NotFoundError('Company not found');

      const bankId = company.config.BSS03.defaultBankId;
      if (!bankId)
        throw new NotFoundError(`Default bank ID not found for ${method}`);

      bankDataArr = await getBankByIdDao({ id: bankId });

      if (!bankDataArr[0])
        throw new NotFoundError(`Bank not found for ${method} payout`);

      // const clientIp = getClientIp(req);
      logger.info(`Creating BSS1015 payout with bankId: ${bankId}`);
      const updatedPayload = await createBSS03Payout(
        payload,
        ids,
        singleWithdrawData,
        bankId,
      );
      payload = updatedPayload;
    } else if (payload?.config?.method === Method.PAYASSIST) {
      const method = payload.config.method;

      const [company] = await getCompanyByIDDao({ id: ids.company_id }, conn);
      if (!company) throw new NotFoundError('Company not found');

      const bankId = company.config.PAY_ASSIST.defaultBankId;
      if (!bankId)
        throw new NotFoundError(`Default bank ID not found for ${method}`);

      bankDataArr = await getBankByIdDao({ id: bankId }, conn);

      if (!bankDataArr[0])
        throw new NotFoundError(`Bank not found for ${method} payout`);

      const updatedPayload = await createPayAssistPayout(
        payload,
        ids,
        singleWithdrawData,
        bankId,
      );

      if (updatedPayload?.skipPayoutUpdate) {
        logger.warn(
          'Skipping PayAssist payout update due to duplicate transaction retry response',
          {
            payoutId: ids.id,
            merchant_order_id: singleWithdrawData?.merchant_order_id,
            company_id: ids.company_id,
          },
        );
        earlyReturnResult = singleWithdrawData;
      } else {
        payload = updatedPayload;
      }
    } else if (payload?.config?.method === Method.PAYDUM) {
      const method = payload.config.method;

      const [company] = await getCompanyByIDDao({ id: ids.company_id }, conn);
      if (!company) throw new NotFoundError('Company not found');

      const bankId = company.config.PAY_DUM.defaultBankId;
      if (!bankId)
        throw new NotFoundError(`Default bank ID not found for ${method}`);

      bankDataArr = await getBankByIdDao({ id: bankId }, conn);

      if (!bankDataArr[0])
        throw new NotFoundError(`Bank not found for ${method} payout`);

      const updatedPayload = await createPayDumPayout(
        payload,
        ids,
        singleWithdrawData,
        bankId,
      );

      if (updatedPayload?.skipPayoutUpdate) {
        logger.warn(
          'Skipping PayDum payout update due to duplicate transaction retry response',
          {
            payoutId: ids.id,
            merchant_order_id: singleWithdrawData?.merchant_order_id,
            company_id: ids.company_id,
          },
        );
        earlyReturnResult = singleWithdrawData;
      } else {
        payload = updatedPayload;
      }
    } else if (payload?.config?.method === Method.TATAPAY) {
      const method = payload.config.method;

      const [company] = await getCompanyByIDDao({ id: ids.company_id }, conn);
      if (!company) throw new NotFoundError('Company not found');

      const bankId = company.config.TATA_PAY.defaultBankId;
      if (!bankId)
        throw new NotFoundError(`Default bank ID not found for ${method}`);

      bankDataArr = await getBankByIdDao({ id: bankId }, conn);

      if (!bankDataArr[0])
        throw new NotFoundError(`Bank not found for ${method} payout`);

      const updatedPayload = await createTataPayPayout(
        payload,
        ids,
        singleWithdrawData,
        bankId,
      );
      payload = updatedPayload;
    } else if (payload?.config?.method === Method.RUPEEFLOW) {
      if (!Number.isInteger(singleWithdrawData.amount)) {
        throw new BadRequestError('Amount must be in positive values');
      }
      const method = payload.config.method;

      const [company] = await getCompanyByIDDao({ id: ids.company_id }, conn);
      if (!company) throw new NotFoundError('Company not found');

      const bankId = company.config.RUPEE_FLOW.defaultBankId;
      if (!bankId)
        throw new NotFoundError(`Default bank ID not found for ${method}`);

      bankDataArr = await getBankByIdDao({ id: bankId }, conn);

      if (!bankDataArr[0])
        throw new NotFoundError(`Bank not found for ${method} payout`);

      const updatedPayload = await createRupeeFlowPayout(
        payload,
        ids,
        singleWithdrawData,
        bankId,
      );
      payload = updatedPayload;
    } else if (payload?.config?.method === Method.VERTEXPAY) {
      if (!Number.isInteger(singleWithdrawData.amount)) {
        throw new BadRequestError('Amount must be in positive values');
      }
      const method = payload.config.method;

      const [company] = await getCompanyByIDDao({ id: ids.company_id }, conn);
      if (!company) throw new NotFoundError('Company not found');

      const bankId = company.config.VERTEX_PAY.defaultBankId;
      if (!bankId)
        throw new NotFoundError(`Default bank ID not found for ${method}`);

      bankDataArr = await getBankByIdDao({ id: bankId }, conn);

      if (!bankDataArr[0])
        throw new NotFoundError(`Bank not found for ${method} payout`);

      const updatedPayload = await createVertexPayPayout(
        payload,
        ids,
        singleWithdrawData,
        bankId,
      );
      payload = updatedPayload;
    }
    else if (payload?.config?.method === Method.RUNSAFE_PAY) {
      if (!Number.isInteger(singleWithdrawData.amount)) {
        throw new BadRequestError('Amount must be in positive values');
      }
      const method = payload.config.method;

      const [company] = await getCompanyByIDDao({ id: ids.company_id }, conn);
      if (!company) throw new NotFoundError('Company not found');

      const bankId = company.config.runsafe.defaultBankId;
      if (!bankId)
        throw new NotFoundError(`Default bank ID not found for ${method}`);

      bankDataArr = await getBankByIdDao({ id: bankId }, conn);

      if (!bankDataArr[0])
        throw new NotFoundError(`Bank not found for ${method} payout`);

      const updatedPayload = await createRunsafePayPayout(
        payload,
        ids,
        singleWithdrawData,
        bankId,
      );
      payload = updatedPayload;
    }
    else if (payload?.config?.method === Method.PAYINFINTECH) {
      const method = payload.config.method;

      const [company] = await getCompanyByIDDao({ id: ids.company_id }, conn);
      if (!company) throw new NotFoundError('Company not found');

      // Allow if either allowPayInFintech flag is true, or PAYINFINTECH config exists (backward compatibility)
      if (!(company.config?.allowPayInFintech || company.config?.PAYINFINTECH)) {
        throw new BadRequestError('PayInFintech is not enabled for this company');
      }

      const payinfintechConfig = company.config.PAYINFINTECH;
      if (!payinfintechConfig) {
        throw new NotFoundError(`PayInFintech configuration not found for company`);
      }

      const bankId = payinfintechConfig.defaultBankId;
      if (!bankId)
        throw new NotFoundError(`Default bank ID not found for ${method}`);

      bankDataArr = await getBankByIdDao({ id: bankId }, conn);
      if (!bankDataArr[0])
        throw new NotFoundError(`Bank not found for ${method} payout`);

      payload.config._payinfintechCredentials = {
        Email: payinfintechConfig.Email,
        Password: payinfintechConfig.Password,
      };

      logger.info(`Processing PayInFintech payout with bankId: ${bankId}`);
      const updatedPayload = await createPayInFintechPayout(
        payload,
        ids,
        singleWithdrawData,
        bankId,
      );
      
      // Sanitize payload: move top-level txnid and payinfintech_txnid into config
      // These fields should only exist in the config JSONB field, not as database columns
      if (updatedPayload.orderId !== undefined) {
        updatedPayload.config = updatedPayload.config || {};
        updatedPayload.config.orderId = updatedPayload.orderId;
        delete updatedPayload.orderId;
      }
      if (updatedPayload.txnId !== undefined) {
        updatedPayload.config = updatedPayload.config || {};
        updatedPayload.config.txnId = updatedPayload.txnId;
        delete updatedPayload.txnId;
      }
      
      logger.info('PayInFintech: payload sanitized', {
        orderId: updatedPayload.config?.orderId,
        txnId: updatedPayload.config?.txnId,
      });
      
      payload = updatedPayload;
    }

    if (earlyReturnResult !== null) {
      return earlyReturnResult;
    }

    if (payload?.status === Status.REVERSED) {
      payload.config = {...(payload.config || {}), reversed_at: getISTDateString()};
    }
    const data = await updatePayoutDao(ids, payload, conn);
    if (data.status == Status.INITIATED) {
      earlyReturnResult = data;
    }
    // Early return for simple updates
    const checkPayload = {
      utr_id: payload.utr_id,
      updated_by: payload.updated_by,
    };
    if (stringifyJSON(payload) === stringifyJSON(checkPayload)) {
      earlyReturnResult = data;
    }

    const transitionedToApproved =
      !isOnlyUtrUpdate &&
      previousStatus !== Status.APPROVED &&
      data.status === Status.APPROVED;

    const transitionedToReversed =
      !isOnlyUtrUpdate &&
      previousStatus === Status.APPROVED &&
      data.status === Status.REVERSED &&
      data.approved_at !== null;

    const notifyUrl = data.config?.urls?.notify || merchant?.payout_notify;
       const Key = await getMerchantKeysFromCacheOrDb(merchant.id);
        const secretKey = Key?.private || null;
        const api_version = Key?.api_version || 'v1';

    // Early return if not approved
    if (!data.approved_at && data.status !== Status.PENDING && data.status !== Status.INITIATED && !data.rejected_at) {
      merchantPayoutCallback(notifyUrl, {
        merchantOrderId: data.merchant_order_id,
        payoutId: data.id,
        amount: data.amount,
        status: data.status,
        ...(api_version === 'v2'
          ? {
              utrId: data.utr_id || '',
            }
          : {
              code: merchant.code,
              utr_id: data.utr_id || '',
            }),
      }, secretKey);
      earlyReturnResult = data;
    }

    const bankData = bankDataArr[0];
    let vendor = null;
    // Only require bank for non-REJECTED and non-REVERSED (without approved_at) statuses
    if (
      ![Status.REJECTED, Status.INITIATED].includes(data.status) &&
      !(data.status === Status.REVERSED && data.approved_at == null)
    ) {
      if (!bankData) {
        throw new NotFoundError('Bank not found!');
      }
      if (bankData.is_obsolete) {
        throw new BadRequestError('Bank account is obsolete');
      }
      if (bankData.is_blocked) {
        throw new BadRequestError('Bank account is blocked');
      }
      const vendorArr = await getVendorByIdDao(
        bankData.user_id,
        ids.company_id,
        conn,
      );
      vendor = vendorArr[0];
      if (!vendor) {
        throw new NotFoundError('Vendor not found!');
      }
    } else {
      // For REJECTED or REVERSED (without approved_at), skip bank/vendor logic
      vendor = {};
    }

    // Calculate commissions once
    const merchantCommission = calculateCommission(
      data.amount,
      merchant.payout_commission,
    );
    const vendorCommission = calculateCommission(
      data.amount,
      vendor.payout_commission,
    );

    // Handle sub-vendor and parent commission logic
    // let totalVendorCommission = vendorCommission;
    // let brokerageCommission = 0;
    // let parentCommission = 0;
    // let payoutConfig = {};
    let subVendorParentInfo = null;
    if (vendor?.designation_name === Role.SUB_VENDOR) {
      subVendorParentInfo = await getSubVendorParentInfo(vendor, conn);
    }

    // Handle status-specific updates only on real status transitions
    if (transitionedToApproved) {
      // Prepare calculation updates including parent vendor if needed
      const calculationUpdates = [
        updateCalculationTable(
          merchant.user_id,
          { payoutCommission: merchantCommission, amount: data.amount },
          true,
          conn,
        ),
        updateCalculationTable(
          vendor.user_id,
          { payoutCommission: vendorCommission, amount: data.amount },
          true,
          conn,
        ),
      ];

      // Add parent vendor calculation if sub-vendor
      if (subVendorParentInfo) {
        calculationUpdates.push(
          updateParentVendorCalculation(
            subVendorParentInfo.parentUserId,
            Number(data.amount),
            Number(vendor.config?.mediator_payout_commission) || 0,
            true,
            conn,
          ),
        );
      }

      await Promise.all([
        ...calculationUpdates,
await updateBankAccountBalanceDao(
  { id: bankData.id, company_id: ids.company_id },
  {
    balance: -Number(data.amount),
    today_balance: -Number(data.amount),
    payin_count: 1,
  },
  conn,
),
        updatePayoutDao(
          ids,
          {
            payout_merchant_commission: merchantCommission,
            payout_vendor_commission: vendorCommission,
            vendor_id: vendor.id,
            // config: payoutConfig,
          },
          conn,
        ),
      ]);
    } else if (transitionedToReversed) {
      // Prepare calculation updates including parent vendor if needed
      const calculationUpdates = [
        updateCalculationTable(
          merchant.user_id,
          { payoutCommission: merchantCommission, amount: data.amount },
          false,
          conn,
        ),
        updateCalculationTable(
          vendor.user_id,
          { payoutCommission: vendorCommission, amount: data.amount },
          false,
          conn,
        ),
      ];

      // Add parent vendor calculation if sub-vendor
      if (subVendorParentInfo) {
        calculationUpdates.push(
          updateParentVendorCalculation(
            subVendorParentInfo.parentUserId,
            Number(data.amount),
            Number(vendor.config?.mediator_payout_commission) || 0,
            false,
            conn,
          ),
        );
      }

      await Promise.all([
        ...calculationUpdates,
      ]);
    }

    // This is async function but it's just the callback sending function therefore we are not using await
    if (data.status !== Status.PENDING && data.status !== Status.INITIATED) {
      merchantPayoutCallback(notifyUrl, {
        merchantOrderId: data.merchant_order_id,
        payoutId: data.id,
        amount: data.amount,
        status: data.status,
        ...(api_version === 'v2'
          ? {
              utrId: data.utr_id || '',
            }
          : {
              code: merchant.code,
              utr_id: data.utr_id || '',
            }),
      }, secretKey);
    }

    const finalResult = filterResponse(data, filterColumns);

    // Build responseObj once, after all data is available
    const responseObj = {
      id: data.id,
      sno: data.sno || null,
      amount: data.amount || 0,
      status: data.status || null,
      failed_reason: data.failed_reason || null,
      currency: data.currency || 'INR',
      upi_id: data.upi_id || null,
      utr_id: data.utr_id || null,
      rejected_reason: data.rejected_reason || null,
      merchant_id: data.merchant_id || null,
      company_id: data.company_id || null,
      payout_merchant_commission: data.payout_merchant_commission || 0,
      payout_vendor_commission: data.payout_vendor_commission || 0,
      actual_vendor_commission: data.actual_vendor_commission || '0',
      brokerage_commission: data.brokerage_commission || '0',
      merchant_order_id: data.merchant_order_id || null,
      bank_acc_id: data.bank_acc_id || null,
      approved_at: data.approved_at || null,
      created_by: data.created_by || '',
      updated_by: data.updated_by || '',
      user: data.user || data.created_by || '',
      created_at: data.created_at,
      vendor_code: vendor?.code || null,
      vendor_id: data.vendor_id || null,
      vendor_user_id: vendor?.user_id || null,
      payout_details: data.config || {},
      slip : data.config?.slip || null,
      updated_at: data.updated_at,
      user_id: vendor?.user_id || null,
      nick_name: bankDataArr?.[0]?.nick_name || null,
      merchant_details: {
        merchant_code: merchant?.code || null,
        return_url: merchant?.config?.urls?.return || null,
        notify_url: merchant?.config?.urls?.payout_notify || null,
        public_key: merchant?.config?.keys?.public || null,
        private_key: merchant?.config?.keys?.private || null,
      },
      user_bank_details: {
        account_holder_name: data.acc_holder_name || null,
        account_no: data.acc_no || null,
        ifsc_code: data.ifsc_code || null,
        bank_name: data.bank_name || null,
      },
      rejected_at: data.rejected_at || null,
    };

    // Emit socket event for every payout status update, at the end

    emitTableEntryAsync(tableName.PAYOUT, responseObj)
    
    // Always emit socket, then return the correct result
    if (earlyReturnResult !== null) {
      return earlyReturnResult;
    }
    return finalResult;
  } catch (error) {
    logger.error('error in _updatePayoutServiceInternal', error);
    throw error;
  }
};
const updatePayoutWebhookService = async (ids, payload, conn = null) => {
  try {
    const data = await updatePayoutDao(ids, payload, conn);
    const bankID = data.bank_acc_id;
    const [merchantArr, bankDataArr] = await Promise.all([
      getMerchantByIdDao(data.merchant_id, data.company_id, conn),
      bankID ? getBankByIdDao({ id: bankID }, conn) : Promise.resolve([]),
    ]);
    const merchant = merchantArr[0];
    if (!merchant) {
      throw new NotFoundError('Merchant not found!');
    }
    const bankData = bankDataArr[0];
    let vendor = null;
    if (bankData) {
      const vendorArr = await getVendorByIdDao(
        bankData.user_id,
        ids.company_id,
        conn,
      );
      vendor = vendorArr[0];
    }
    if (data.status === Status.APPROVED || data.status === Status.REVERSED) {
      if (!bankData) {
        throw new NotFoundError('Bank not found!');
      }
      if (!vendor) {
        throw new NotFoundError('Vendor not found!');
      }
      const merchantCommission = calculateCommission(
        data.amount,
        merchant.payout_commission,
      );
      const vendorCommission = calculateCommission(
        data.amount,
        vendor.payout_commission,
      );
      let subVendorParentInfo = null;
      if (vendor?.designation_name === Role.SUB_VENDOR) {
        subVendorParentInfo = await getSubVendorParentInfo(vendor, conn);
      }
      if (data.status === Status.APPROVED) {
        const calculationUpdates = [
          updateCalculationTable(
            merchant.user_id,
            { payoutCommission: merchantCommission, amount: data.amount },
            true,
            conn,
          ),
          updateCalculationTable(
            vendor.user_id,
            { payoutCommission: vendorCommission, amount: data.amount },
            true,
            conn,
          ),
        ];
        if (subVendorParentInfo) {
          calculationUpdates.push(
            updateParentVendorCalculation(
              subVendorParentInfo.parentUserId,
              Number(data.amount),
              Number(vendor.config?.mediator_payout_commission) || 0,
              true,
              conn,
            ),
          );
        }
        await Promise.all([
          ...calculationUpdates,
          updateBankAccountBalanceDao(
            { id: bankData.id, company_id: ids.company_id },
            {
              balance: -Number(data.amount),
              today_balance: -Number(data.amount),
              payin_count: 1,
            },
            conn,
          ),
          updatePayoutDao(
            ids,
            {
              payout_merchant_commission: merchantCommission,
              payout_vendor_commission: vendorCommission,
              vendor_id: data.vendor_id || vendor.id,
            },
            conn,
          ),
        ]);
        data.payout_merchant_commission = merchantCommission;
        data.payout_vendor_commission = vendorCommission;
        data.vendor_id = data.vendor_id || vendor.id;
      } else if (data.status === Status.REVERSED) {
        const calculationUpdates = [
          updateCalculationTable(
            merchant.user_id,
            { payoutCommission: merchantCommission, amount: data.amount },
            false,
            conn,
          ),
          updateCalculationTable(
            vendor.user_id,
            { payoutCommission: vendorCommission, amount: data.amount },
            false,
            conn,
          ),
        ];
        if (subVendorParentInfo) {
          calculationUpdates.push(
            updateParentVendorCalculation(
              subVendorParentInfo.parentUserId,
              Number(data.amount),
              Number(vendor.config?.mediator_payout_commission) || 0,
              false,
              conn,
            ),
          );
        }
        await Promise.all(calculationUpdates);
      }
    }
    const responseObj = {
      id: data.id,
      sno: data.sno || null,
      amount: data.amount || 0,
      status: data.status || null,
      failed_reason: data.failed_reason || null,
      currency: data.currency || 'INR',
      upi_id: data.upi_id || null,
      utr_id: data.utr_id || null,
      rejected_reason: data.rejected_reason || null,
      merchant_id: data.merchant_id || null,
      company_id: data.company_id || null,
      payout_merchant_commission: data.payout_merchant_commission || 0,
      payout_vendor_commission: data.payout_vendor_commission || 0,
      actual_vendor_commission: data.actual_vendor_commission || '0',
      brokerage_commission: data.brokerage_commission || '0',
      merchant_order_id: data.merchant_order_id || null,
      bank_acc_id: data.bank_acc_id || null,
      approved_at: data.approved_at || null,
      created_by: data.created_by || '',
      updated_by: data.updated_by || '',
      user: data.user || data.created_by || '',
      created_at: data.created_at,
      vendor_code: vendor?.code || null,
      vendor_id: data.vendor_id || null,
      vendor_user_id: vendor?.user_id || null,
      payout_details: data.config || {},
      slip: data.config?.slip || null,
      updated_at: data.updated_at,
      user_id: vendor?.user_id || null,
      nick_name: bankData?.nick_name || null,
      merchant_details: {
        merchant_code: merchant?.code || null,
        return_url: merchant?.config?.urls?.return || null,
        notify_url: merchant?.config?.urls?.payout_notify || null,
        public_key: merchant?.config?.keys?.public || null,
        private_key: merchant?.config?.keys?.private || null,
      },
      user_bank_details: {
        account_holder_name: data.acc_holder_name || null,
        account_no: data.acc_no || null,
        ifsc_code: data.ifsc_code || null,
        bank_name: data.bank_name || null,
      },
      rejected_at: data.rejected_at || null,
    };
    const notifyUrl =
      data.config?.urls?.notify ||
      merchant?.config?.urls?.payout_notify ||
      merchant?.payout_notify;

      const Key = await getMerchantKeysFromCacheOrDb(merchant.id);
      const secretKey = Key?.private || null;
      const api_version = Key?.api_version || 'v1';
    if (data.status !== Status.PENDING && data.status !== Status.INITIATED) {
      merchantPayoutCallback(notifyUrl, {
        merchantOrderId: data.merchant_order_id,
        payoutId: data.id,
        amount: data.amount,
        status: data.status,
        ...(api_version === 'v2'
          ? {
              utrId: data.utr_id || '',
            }
          : {
              code: merchant.code,
              utr_id: data.utr_id || '',
            }),
      }, secretKey);
    }
    emitTableEntryAsync(tableName.PAYOUT, responseObj);
    return data;
  } catch (error) {
    logger.error('error in _updatePayoutWebhookInternal', error);
    throw error;
  }
};
const updatePayoutService = async (ids, payload, role) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const data = await _updatePayoutServiceInternal(ids, payload, role, conn);
    await commit(conn);
    committed = true;
    return data;
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn);
    }
    logger.error('Error in updatePayoutService:', error.message);
    throw error;
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

const _markPayoutPendingForUtrSlipMismatchInternal = async (
  ids,
  payload,
  conn,
) => {
  try {
    const singleWithdrawDataArr = await getPayoutsDao(ids);
    const singleWithdrawData = singleWithdrawDataArr[0];
    if (!singleWithdrawData) {
      throw new NotFoundError('Payout not found!');
    }
    if(singleWithdrawData.status === Status.APPROVED){
      throw new BadRequestError('Payout Already Approved');
    }
    if(singleWithdrawData.status !== Status.INITIATED && payload.vendor_id === null ){
      throw new BadRequestError('Payout Already Processed, cannot update vendor');
    }
    const bankAccId = payload.bank_acc_id || singleWithdrawData.bank_acc_id;
    const reason = 'UTR does not match with slip UTR';
    const updatePayload = {
      status: Status.IMG_PENDING,
      updated_by: payload.updated_by,
      config: {
        ...(payload.config || {}),
        reason,
        utr: payload.utr_id || null,
        slip_utr: payload.slip_utr || null,
      },
    };
    if (payload.utr_id) {
      updatePayload.utr_id = payload.utr_id;
    }
    if (bankAccId) {
      updatePayload.bank_acc_id = bankAccId;
      if (!singleWithdrawData.vendor_id) {
        const bankDataArr = await getBankByIdDao({ id: bankAccId }, conn);
        const bankData = bankDataArr[0];
        if (!bankData) {
          throw new NotFoundError('Bank not found!');
        }
        const vendorArr = await getVendorByIdDao(
          bankData.user_id,
          ids.company_id,
          conn,
        );
        const vendor = vendorArr[0];
        if (!vendor) {
          throw new NotFoundError('Vendor not found!');
        }
        updatePayload.vendor_id = vendor.id;
      }
    }
    const data = await updatePayoutDao(ids, updatePayload, conn);

    const responseObj = {
      ...data, ...updatePayload, slip: payload?.config?.slip
    }

    emitTableEntryAsync(tableName.PAYOUT, responseObj)

    return data;
  } catch (error) {
    logger.error(
      'Error in _markPayoutPendingForUtrSlipMismatchInternal:',
      error,
    );
    throw error;
  }
};

const markPayoutPendingForUtrSlipMismatchService = async (ids, payload) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const data = await _markPayoutPendingForUtrSlipMismatchInternal(
      ids,
      payload,
      conn,
    );
    await commit(conn);
    committed = true;
    return data;
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn);
    }
    logger.error('Error in markPayoutPendingForUtrSlipMismatchService:', error);
    throw error;
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

///for update payout calculation of payout
const updateCalculationTable = async (user_id, data, isApproved, conn) => {
  // Early validation
  if (!user_id) {
    logger.warn('No user_id provided to updateCalculationTable');
    return;
  }

  // logger.info(
  //   `updateCalculationTable called with: user_id=${user_id}, data=${JSON.stringify(data)}, isApproved=${isApproved}`,
  // );

  if (
    typeof data.amount === 'undefined' ||
    typeof data.payoutCommission === 'undefined'
  ) {
    logger.error('Missing required properties in data');
    return;
  }

  if (isNaN(data.amount - data.payoutCommission)) {
    throw new BadRequestError('Invalid amount or commission');
  }

  const calculationData = await getCalculationforCronDao(user_id, conn);
  if (!calculationData[0]) {
    throw new NotFoundError('Calculation not found!');
  }

  // logger.info(
  //   `Found calculation data for user_id ${user_id}: calculationId=${calculationData[0].id}`,
  // );

  const calculationId = calculationData[0].id;
  const totalAmountData = Number(data.amount + data.payoutCommission);

  // Create payload based on approval status
  const payload = isApproved
    ? {
        total_payout_count: 1,
        total_payout_amount: data.amount,
        total_payout_commission: data.payoutCommission,
        current_balance: -totalAmountData,
        net_balance: -totalAmountData,
      }
    : {
        total_reverse_payout_count: 1,
        total_reverse_payout_amount: data.amount,
        total_reverse_payout_commission: -data.payoutCommission,
        current_balance: totalAmountData,
        net_balance: totalAmountData,
      };

  // logger.info(
  //   `Updating calculation table with payload: ${JSON.stringify(payload)}`,
  // );

  const response = await updateCalculationBalanceDao(
    { id: calculationId },
    payload,
    conn,
  );

  // logger.info(`Calculation table updated successfully for user_id: ${user_id}`);

  await trackVendorsNetBalance(calculationData[0].user_id, response);
  return response;
};

const processEkoPayout = async (singleWithdrawData, payload) => {
  try {
    const client_ref_id = Math.floor(Date.now() / 1000);
    const ekoResponse = await createEkoWithdraw(
      singleWithdrawData,
      client_ref_id,
    );

    if (ekoResponse?.status === 0) {
      const isSuccess =
        ekoResponse?.data?.txstatus_desc?.toUpperCase() == Status.SUCCESS;
      Object.assign(payload, {
        status: isSuccess ? Status.APPROVED : Status.REJECTED,
        approved_at: isSuccess ? new Date().toISOString() : null,
        rejected_at: isSuccess ? null : new Date().toISOString(),
        utr_id: ekoResponse?.data?.tid,
      });
      logger.info(`Payment initiated: ${ekoResponse?.message}`);
    } else {
      let getEkoPayoutStatus = null;
      if (ekoResponse.status === 1328) {
        getEkoPayoutStatus = await ekoPayoutStatus(client_ref_id);
      }
      Object.assign(payload, {
        status: Status.REJECTED,
        rejected_reason: ekoResponse?.message,
        rejected_at: new Date().toISOString(),
        utr_id: getEkoPayoutStatus?.data?.tid || null,
      });
      logger.error(`Payment rejected by eko due to ${ekoResponse?.message}`);
    }
  } catch (error) {
    logger.error('Error processing Eko method:', error);
  }
};

// const activateEkoService = async (req, res) => {
//   const key = config?.ekoAccessKey;
//   const encodedKey = Buffer.from(key).toString('base64');

//   const secretKeyTimestamp = Date.now();
//   const secretKey = crypto
//     .createHmac('sha256', encodedKey)
//     .update(secretKeyTimestamp.toString())
//     .digest('base64');

//   const encodedParams = new URLSearchParams();
//   encodedParams.set('service_code', config?.ekoServiceCode);
//   encodedParams.set('user_code', config?.ekoUserCode);
//   encodedParams.set('initiator_id', config?.ekoInitiatorId);

//   const url = config?.ekoPaymentsActivateUrl;
//   const options = {
//     method: 'PUT',
//     headers: {
//       accept: 'application/json',
//       developer_key: config?.ekoDeveloperKey,
//       'secret-key': secretKey,
//       'secret-key-timestamp': secretKeyTimestamp,
//       'content-type': 'application/x-www-form-urlencoded',
//     },
//     body: encodedParams,
//   };
//   try {
//     const response = await fetch(url, options);
//     const responseText = await response.text();

//     let parsedData;
//     try {
//       parsedData = JSON.parse(responseText);
//     } catch (err) {
//       logger.error(err);
//       parsedData = responseText;
//     }

//     return parsedData;
//   } catch (error) {
//     logger.error(error);
//   }
// };

const createEkoWithdraw = async (payload, client_ref_id) => {
  const newObj = {
    amount: payload?.amount,
    client_ref_id,
    recipient_name: payload?.acc_holder_name,
    ifsc: payload?.ifsc_code,
    account: payload?.ac_no,
    sender_name: 'TrustPay',
  };

  const key = config?.ekoAccessKey;
  const encodedKey = Buffer.from(key).toString('base64');

  const secretKeyTimestamp = Date.now();
  const secretKey = crypto
    .createHmac('sha256', encodedKey)
    .update(secretKeyTimestamp.toString())
    .digest('base64');

  const encodedParams = new URLSearchParams();
  encodedParams.set('service_code', config?.ekoServiceCode);
  encodedParams.set('initiator_id', config?.ekoInitiatorId);
  encodedParams.set('amount', newObj.amount);
  encodedParams.set('payment_mode', '5');
  encodedParams.set('client_ref_id', newObj.client_ref_id);
  encodedParams.set('recipient_name', newObj.recipient_name);
  encodedParams.set('ifsc', newObj.ifsc);
  encodedParams.set('account', newObj.account);
  encodedParams.set('sender_name', newObj.sender_name);
  encodedParams.set('source', 'NEWCONNECT');
  encodedParams.set('tag', 'Logistic');
  encodedParams.set('beneficiary_account_type', 1);

  const url = `${config?.ekoPaymentsInitiateUrl}:${config?.ekoUserCode}/settlement`;
  const options = {
    method: 'POST',
    headers: {
      accept: 'application/json',
      developer_key: config?.ekoDeveloperKey,
      'secret-key': secretKey,
      'secret-key-timestamp': secretKeyTimestamp,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: encodedParams,
  };

  try {
    const response = await fetch(url, options);
    const responseText = await response.text();

    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch (err) {
      logger.error(err);
      parsedData = responseText;
    }
    return parsedData;
  } catch (error) {
    logger.error(error);
  }
};

const ekoPayoutStatus = async (id) => {
  // const {id} = req.params; // here id wil be client_ref_id (unique)
  const key = config?.ekoAccessKey;
  const encodedKey = Buffer.from(key).toString('base64');

  const secretKeyTimestamp = Date.now();
  const secretKey = crypto
    .createHmac('sha256', encodedKey)
    .update(secretKeyTimestamp.toString())
    .digest('base64');

  const url = `${config?.ekoPaymentsStatusUrlByClientRefId}${id}?initiator_id=${config?.ekoInitiatorId}`;
  const options = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      developer_key: config?.ekoDeveloperKey,
      'secret-key': secretKey,
      'secret-key-timestamp': secretKeyTimestamp,
      'content-type': 'application/x-www-form-urlencoded',
    },
  };

  try {
    const response = await fetch(url, options);
    const responseText = await response.text();

    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch (err) {
      logger.error(err);
      parsedData = responseText;
    }
    return parsedData;
  } catch (error) {
    logger.error(error);
  }
};

const _assignedPayoutServiceInternal = async (
  id,
  payload,
  updated_by,
  company_id,
  conn,
) => {
  try {
    const data = await assignedPayoutDao(
      payload,
      id,
      updated_by,
      company_id,
      conn,
    );
    // Handle payout id extraction from payload (array or object)
    if (Array.isArray(payload)) {
      // If payload is array of string IDs
      for (const payoutId of payload) {
        const ids = { id: payoutId, company_id };
        const fullPayoutArr = await getPayoutsDao(
          ids,
          null,
          null,
          null,
          'DESC',
          null,
          conn,
        );
        const fullPayout = Array.isArray(fullPayoutArr)
          ? fullPayoutArr[0]
          : fullPayoutArr;

        const bankDataArr = await getBankByIdDao(
          { id: fullPayout.bank_acc_id },
          conn,
        );
        const bankData = bankDataArr[0];

        const vendorArr = await getVendorsDao(
          { id: fullPayout.vendor_id, company_id },
          null,
          null,
          null,
          'DESC',
          null,
          conn,
        );
        const vendor = vendorArr[0];

        const merchantArr = await getMerchantByIdDao(
          fullPayout.merchant_id,
          ids.company_id,
          conn,
        );
        const merchant = merchantArr[0];

        const responseObj = {
          id: fullPayout.id,
          sno: fullPayout.sno || null,
          amount: fullPayout.amount || 0,
          status: fullPayout.status || null,
          failed_reason: fullPayout.failed_reason || null,
          currency: fullPayout.currency || 'INR',
          upi_id: fullPayout.upi_id || null,
          utr_id: fullPayout.utr_id || null,
          rejected_reason: fullPayout.rejected_reason || null,
          merchant_id: fullPayout.merchant_id || null,
          company_id: fullPayout.company_id || null,
          payout_merchant_commission:
            fullPayout.payout_merchant_commission || 0,
          payout_vendor_commission: fullPayout.payout_vendor_commission || 0,
          actual_vendor_commission: fullPayout.actual_vendor_commission || '0',
          brokerage_commission: fullPayout.brokerage_commission || '0',
          merchant_order_id: fullPayout.merchant_order_id || null,
          bank_acc_id: fullPayout.bank_acc_id || null,
          approved_at: fullPayout.approved_at || null,
          created_by: fullPayout.created_by || '',
          updated_by: fullPayout.updated_by || '',
          user: fullPayout.user || fullPayout.created_by || '',
          created_at: fullPayout.created_at,
          vendor_code: vendor?.code || null,
          vendor_id: ![Role.VENDOR, Role.SUB_VENDOR, Role.VENDOR_OPERATIONS, Role.VENDOR_ADMIN].includes(vendor?.designation_name) ? fullPayout.vendor_id || null : null,
          vendor_user_id: vendor?.user_id || null,
          payout_details: fullPayout.config || {},
          updated_at: fullPayout.updated_at,
          user_id: vendor?.user_id || null,
          nick_name: bankData?.nick_name || null,
          merchant_details: {
            merchant_code: merchant?.code || null,
            return_url: merchant?.config?.urls?.return || null,
            notify_url: merchant?.config?.urls?.payout_notify || null,
            public_key: merchant?.config?.keys?.public || null,
            private_key: merchant?.config?.keys?.private || null,
          },
          user_bank_details: {
            account_holder_name: fullPayout?.user_bank_details?.account_holder_name || null,
            account_no: fullPayout?.user_bank_details?.account_no || null,
            ifsc_code: fullPayout?.user_bank_details?.ifsc_code || null,
            bank_name: fullPayout?.user_bank_details?.bank_name || null,
          },
          rejected_at: fullPayout.rejected_at || null,
        };

        emitTableEntryAsync(tableName.PAYOUT, responseObj)
      }
    }
    return data;
  } catch (error) {
    logger.error('error in _assignedPayoutServiceInternal', error);
    throw error;
  }
};

const assignedPayoutService = async (id, payload, updated_by, company_id) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const data = await _assignedPayoutServiceInternal(
      id,
      payload,
      updated_by,
      company_id,
      conn,
    );
    await commit(conn);
    committed = true;
    return data;
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn);
    }
    logger.error('Error while vendor assigning to Payout', error);
    throw error;
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

const _deletePayoutServiceInternal = async (id, updated_by, role, conn) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.PAYOUT
        : role === Role.VENDOR || role === Role.SUB_VENDOR
          ? vendorColumns.PAYOUT
          : columns.PAYOUT;
    const payload = { is_obsolete: true };
    payload.updated_by = updated_by;
    const data = await deletePayoutDao(id, payload, conn);
    const finalResult = await filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    logger.error('error in _deletePayoutServiceInternal', error);
    throw error;
  }
};

const deletePayoutService = async (id, updated_by, role) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const finalResult = await _deletePayoutServiceInternal(
      id,
      updated_by,
      role,
      conn,
    );
    await commit(conn);
    committed = true;
    return finalResult;
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn);
    }
    logger.error('Error while deleting Payout', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

export const ekoWalletBalanceEnquiryInternally = async () => {
  const key = config?.ekoAccessKey;
  const encodedKey = Buffer.from(key).toString('base64');

  const secretKeyTimestamp = Date.now();
  const secretKey = crypto
    .createHmac('sha256', encodedKey)
    .update(secretKeyTimestamp.toString())
    .digest('base64');

  const url = `${config?.ekoWalletBalanceEnquiryUrl}:${config?.ekoRegisteredMobileNo}/balance?initiator_id=${config?.ekoInitiatorId}&user_code=${config?.ekoUserCode}`;
  const options = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      developer_key: config?.ekoDeveloperKey,
      'secret-key': secretKey,
      'secret-key-timestamp': secretKeyTimestamp,
      'content-type': 'application/x-www-form-urlencoded',
    },
  };

  try {
    const response = await fetch(url, options);
    const responseText = await response.text();

    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch (err) {
      logger.error(err);
      parsedData = responseText;
    }
    return parsedData;
  } catch (error) {
    logger.error(error.message);
  }
};

// Public API Used by Merchants
const checkPayOutStatusService = async (
  payOutId,
  merchantCode,
  merchantOrderId,
  api_key,
) => {
  try {
    const merchantArr = await getMerchantsDao(
      { code: merchantCode },
      null,
      null,
      null,
      null,
      null,
      null,
    );
    const merchant = merchantArr[0];
    if (!merchant) {
      const data = {
        status: 400,
        message: 'Merchant does not exist',
      };
      return data;
    }

    const merchantConfig = merchant.config || {};

    if (
      api_key != merchantConfig.keys?.private &&
      api_key != merchantConfig.keys?.public
    ) {
      const data = {
        status: 404,
        message: 'Enter valid Api key',
      };
      return data;
    }

    const payOut = await getPayoutsDao(
      {
        id: payOutId,
        merchant_order_id: merchantOrderId,
      },
      null,
      null,
      null,
      null,
      null,
      null,
    );
    if (payOut.length == 0) {
      const data = {
        status: 404,
        message: 'Payout not found',
      };
      return data;
    }

    //check is payout detials belongs to that merchant or not
    if (!(payOut[0].merchant_id === merchant.id)) {
      const data = {
        status: 404,
        message:
          'merchant_order_id and payOut ID do not belong to the specified merchant',
      };
      return data;
    }
    return {
      status: payOut[0].status,
      merchantOrderId: payOut[0].merchant_order_id,
      amount: payOut[0].amount,
      payoutId: payOut[0].id,
      utr_id: payOut[0].utr_id ? payOut[0].utr_id : ' ',
    };
  } catch (error) {
    logger.error('Error check payout status:', error);
    throw error;
  }
};

/**
 * Create TataPay bulk payout service
 * @param {Object} params - Service parameters
 * @param {Array} params.payoutEntries - Array of payout entry objects
 * @param {Array} params.payoutIds - Array of payout IDs to fetch
 * @param {string} params.company_id - Company ID
 * @param {string} params.user_id - User ID
 * @returns {Promise<Object>} - Service response
 */
const _createTataPayBulkPayoutServiceInternal = async (
  { payoutEntries, payoutIds, company_id, user_id },
  conn,
) => {
  try {
    // Function to fetch payout data by IDs if needed
    const getPayoutData = async (ids, companyId) => {
      const payouts = await getPayoutsDao(
        {
          id: ids,
          company_id: companyId,
          status: [Status.INITIATED], // Only fetch processable payouts
        },
        companyId,
        null,
        null,
        'DESC',
        null,
        conn,
      );

      if (!payouts || payouts.length === 0) {
        throw new BadRequestError(
          'No valid payout records found for the provided IDs',
        );
      }

      return payouts;
    };

    // Function to update payout status in bulk
    const updatePayoutStatusBulk = async (payoutIds, payload) => {
      try {
        // Update payout records in database
        for (const payoutId of payoutIds) {
          await updatePayoutDao(
            { id: payoutId }, // ids parameter
            {
              // payload parameter
              ...payload,
              updated_at: new Date().toISOString(),
            },
            conn,
          );
        }

        logger.info('Bulk payout status updated successfully:', {
          payoutIds,
          count: payoutIds.length,
        });
      } catch (error) {
        logger.error('Error updating bulk payout status:', error);
        throw error;
      }
    };

    // RabbitMQ instance with fallback to direct database updates
    const rabbitMQ = {
      sendMessage: async (queueName, data) => {
        try {
          await publishBulkPayout(data);
          logger.info(`RabbitMQ message sent to ${queueName}:`, {
            totalUpdates: data.individualUpdates?.length || 0,
            queueName,
          });
          return;
        } catch (error) {
          logger.error(
            'RabbitMQ error, performing direct database update:',
            error.message,
          );

          // Fallback: directly update the database
          if (data.individualUpdates) {
            for (const update of data.individualUpdates) {
              try {
                // Create proper payload structure for updatePayoutDao
                const updatePayload = {
                  status: update.status,
                  config: update.config,
                  utr_id: update.utr_id,
                  approved_at: update.approved_at,
                  rejected_reason: update.rejected_reason,
                  rejected_at: update.rejected_at,
                  updated_at: new Date().toISOString(),
                };

                // Remove undefined fields to avoid database issues
                Object.keys(updatePayload).forEach((key) => {
                  if (updatePayload[key] === undefined) {
                    delete updatePayload[key];
                  }
                });

                await updatePayoutDao(
                  { id: update.payoutId }, // ids parameter
                  updatePayload, // payload parameter
                  conn,
                );

                logger.info(
                  `Direct database update completed for payout ID: ${update.payoutId}`,
                );
              } catch (updateError) {
                logger.error(
                  `Failed to update payout ID ${update.payoutId}:`,
                  updateError.message,
                );
              }
            }
            logger.info(
              'Direct database update completed for all bulk payout status updates',
            );
          }
        }
      },
    };

    // Call TataPay bulk payout function
    const result = await createTataPayBulkPayout(
      payoutEntries || payoutIds,
      company_id,
      payoutIds ? getPayoutData : null, // Pass getPayoutData function if using IDs
      updatePayoutStatusBulk,
      rabbitMQ,
    );

    logger.info('TataPay bulk payout service completed:', {
      company_id,
      user_id,
      totalRecords: result.data.totalRecords,
      successpayout: result.data.successpayout,
      skippayout: result.data.skippayout,
    });

    return result;
  } catch (error) {
    logger.error('error in _createTataPayBulkPayoutServiceInternal', error);
    throw error;
  }
};

const createTataPayBulkPayoutService = async ({
  payoutEntries,
  payoutIds,
  company_id,
  user_id,
}) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const result = await _createTataPayBulkPayoutServiceInternal(
      { payoutEntries, payoutIds, company_id, user_id },
      conn,
    );
    await commit(conn);
    committed = true;
    return result;
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn);
    }
    logger.error('TataPay bulk payout service error:', {
      error: error.message,
      company_id,
      user_id,
      payoutEntries: payoutEntries?.length || 0,
      payoutIds: payoutIds?.length || 0,
    });
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

/**
 * Create RupeeFlow bulk payout service
 * @param {Object} params - Service parameters
 * @param {Array} params.payoutEntries - Array of payout entry objects
 * @param {Array} params.payoutIds - Array of payout IDs to fetch
 * @param {string} params.company_id - Company ID
 * @param {string} params.user_id - User ID
 * @returns {Promise<Object>} - Service response
 */
const _createRupeeFlowBulkPayoutServiceInternal = async (
  { payoutEntries, payoutIds, company_id, user_id },
  conn,
) => {
  try {
    // Function to fetch payout data by IDs if needed
    const getPayoutData = async (ids, companyId) => {
      const payouts = await getPayoutsDao(
        {
          id: ids,
          company_id: companyId,
          status: [Status.INITIATED], // Only fetch processable payouts
        },
        companyId,
        null,
        null,
        'DESC',
        null,
        conn,
      );

      if (!payouts || payouts.length === 0) {
        throw new BadRequestError(
          'No valid payout records found for the provided IDs',
        );
      }

      return payouts;
    };

    // Function to update payout status in bulk
    const updatePayoutStatusBulk = async (payoutIds, payload) => {
      try {
        // Update payout records in database
        for (const payoutId of payoutIds) {
          await updatePayoutDao(
            { id: payoutId }, // ids parameter
            {
              // payload parameter
              ...payload,
              updated_at: new Date().toISOString(),
            },
            conn,
          );
        }

        logger.info('Bulk payout status updated successfully:', {
          payoutIds,
          count: payoutIds.length,
        });
      } catch (error) {
        logger.error('Error updating bulk payout status:', error);
        throw error;
      }
    };

    // RabbitMQ instance with fallback to direct database updates
    const rabbitMQ = {
      sendMessage: async (queueName, data) => {
        try {
          await publishBulkPayout(data);
          logger.info(`RabbitMQ message sent to ${queueName}:`, {
            totalUpdates: data.individualUpdates?.length || 0,
            queueName,
          });
          return;
        } catch (error) {
          logger.error(
            'RabbitMQ error, performing direct database update:',
            error.message,
          );

          // Fallback: directly update the database
          if (data.individualUpdates) {
            for (const update of data.individualUpdates) {
              try {
                // Create proper payload structure for updatePayoutDao
                const updatePayload = {
                  status: update.status,
                  config: update.config,
                  utr_id: update.utr_id,
                  approved_at: update.approved_at,
                  rejected_reason: update.rejected_reason,
                  rejected_at: update.rejected_at,
                  updated_at: new Date().toISOString(),
                };

                // Remove undefined fields to avoid database issues
                Object.keys(updatePayload).forEach((key) => {
                  if (updatePayload[key] === undefined) {
                    delete updatePayload[key];
                  }
                });

                await updatePayoutDao(
                  { id: update.payoutId }, // ids parameter
                  updatePayload, // payload parameter
                  conn,
                );

                logger.info(
                  `Direct database update completed for payout ID: ${update.payoutId}`,
                );
              } catch (updateError) {
                logger.error(
                  `Failed to update payout ID ${update.payoutId}:`,
                  updateError.message,
                );
              }
            }
            logger.info(
              'Direct database update completed for all bulk payout status updates',
            );
          }
        }
      },
    };

    // Call RupeeFlow bulk payout function
    const result = await createRupeeFlowBulkPayout(
      payoutEntries || payoutIds,
      company_id,
      payoutIds ? getPayoutData : null, // Pass getPayoutData function if using IDs
      updatePayoutStatusBulk,
      rabbitMQ,
    );

    logger.info('RupeeFlow bulk payout service completed:', {
      company_id,
      user_id,
      totalRecords: result.data.totalRecords,
      successpayout: result.data.successpayout,
      skippayout: result.data.skippayout,
    });

    return result;
  } catch (error) {
    logger.error('error in _createRupeeFlowBulkPayoutServiceInternal', error);
    throw error;
  }
};

const createRupeeFlowBulkPayoutService = async ({
  payoutEntries,
  payoutIds,
  company_id,
  user_id,
}) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const result = await _createRupeeFlowBulkPayoutServiceInternal(
      { payoutEntries, payoutIds, company_id, user_id },
      conn,
    );
    await commit(conn);
    committed = true;
    return result;
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn);
    }
    logger.error('TataPay bulk payout service error:', {
      error: error.message,
      company_id,
      user_id,
      payoutEntries: payoutEntries?.length || 0,
      payoutIds: payoutIds?.length || 0,
    });
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

export {
  createPayoutService,
  getPayoutsService,
  checkPayOutStatusService,
  getPayoutsBySearchService,
  updatePayoutService,
  updatePayoutWebhookService,
  markPayoutPendingForUtrSlipMismatchService,
  deletePayoutService,
  assignedPayoutService,
  createTataPayBulkPayoutService,
  createRupeeFlowBulkPayoutService,
  _updatePayoutServiceInternal,
};
