/* eslint-disable no-unused-vars */
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
  getPayoutByMerchantOrderIdDao,
  getPayoutByUtrIdDao,
  getPayoutByIdDao,
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
  updateBankaccountDao,
  getBankByIdDao,
} from '../bankAccounts/bankaccountDao.js';
import config from '../../config/config.js';
import { merchantPayoutCallback } from '../../callBacksAndWebHook/merchantCallBacks.js';
import { Status, Method, tableName } from '../../constants/index.js';
import { calculateCommission } from '../../helpers/index.js';
import {
  columns,
  merchantColumns,
  Role,
  vendorColumns,
} from '../../constants/index.js';
import { filterResponse } from '../../helpers/index.js';
import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
import { updateCalculationBalanceDao } from '../calculation/calculationDao.js';
import { logger } from '../../utils/logger.js';
// Import RabbitMQ for bulk status updates
// import { updatePayout } from '../../utils/sockets.js';
import { newTableEntry } from '../../utils/sockets.js';
import { checkLockEdit } from '../../utils/advisoryLock.js';
import { stringifyJSON } from '../../utils/index.js';
// import { notifyAdminsAndUsers } from '../../utils/notifyUsers.js';
import { getCompanyByIDDao } from '../company/companyDao.js';
import { trackVendorsNetBalance } from '../../utils/trackVendorsNetBalance.js';
import {
  createClickrrPayout,
  getClickrrWalletBalance,
} from '../../clickrr/clickrr.js';
import { createPayAssistPayout } from '../../payassist/payassist.js';
import { createTataPayPayout } from '../../tatapay/tatapay.js';
import { createRupeeFlowPayout } from '../../rupeeflow/rupeeflow.js';
import { createBSSPayout } from '../../bss/bss.js';
import { createSilkPayPayout } from '../../silkpay/silkpay.js';
import { createBSS02Payout } from '../../bss/bss02.js';
// import { notifyNewCalculationTableEntry } from '../../utils/sockets.js';

// Helper function to check if vendor is sub-vendor and get parent info
// const getSubVendorParentInfo = async (vendor) => {
//   try {
//     logger.info(
//       `Checking sub-vendor status for vendor: userId=${vendor.user_id}, designation=${vendor.designation}, designation_name=${vendor.designation_name}, config=${JSON.stringify(vendor.config)}`,
//     );

//     // Check if vendor designation is SUB_VENDOR (handle both designation and designation_name properties)
//     const vendorDesignation = vendor.designation || vendor.designation_name;
//     if (vendorDesignation !== Role.SUB_VENDOR) {
//       logger.info(
//         `Vendor is not SUB_VENDOR, designation: ${vendorDesignation}`,
//       );
//       return null;
//     }

//     // Check is_owned config
//     const isOwned = vendor.config?.is_owned;
//     if (isOwned === true || isOwned === 'true') {
//       logger.info(
//         `Vendor is owned (is_owned=${isOwned}), skipping parent calculation`,
//       );
//       return null;
//     }

//     logger.info(
//       `Sub-vendor detected with is_owned=${isOwned}, fetching user hierarchy`,
//     );

//     // Get user hierarchy to find parent
//     const userHierarchys = await getUserHierarchysDao({
//       user_id: vendor.user_id,
//     });

//     logger.info(`User hierarchy result: ${JSON.stringify(userHierarchys)}`);

//     const userHierarchy = userHierarchys?.[0];
//     const parentId = userHierarchy?.config?.parent;

//     if (!parentId) {
//       logger.warn(`Sub-vendor ${vendor.user_id} has no parent in hierarchy`);
//       return null;
//     }

//     logger.info(`Found parent ID: ${parentId}, fetching parent vendor details`);

//     // Get parent vendor details
//     const parentVendors = await getVendorsDao({ user_id: parentId });
//     if (!parentVendors || !parentVendors[0]) {
//       logger.warn(`Parent vendor not found for user_id: ${parentId}`);
//       return null;
//     }

//     logger.info(`Parent vendor found: ${JSON.stringify(parentVendors[0])}`);

//     return {
//       parentVendor: parentVendors[0],
//       parentUserId: parentId,
//     };
//   } catch (error) {
//     logger.error('Error in getSubVendorParentInfo:', error);
//     return null;
//   }
// };

// Helper function to calculate commission for parent vendor
// const updateParentVendorCalculation = async (
//   parentUserId,
//   amount,
//   vendorCommissionRate,
//   isApproved,
//   conn,
// ) => {
//   try {
//     logger.info(
//       `updateParentVendorCalculation called with: parentUserId=${parentUserId}, amount=${amount}, rate=${vendorCommissionRate}, isApproved=${isApproved}`,
//     );

//     const parentCommission = calculateCommission(amount, vendorCommissionRate);

//     logger.info(`Calculated parent commission: ${parentCommission}`);

//     await updateCalculationTable(
//       parentUserId,
//       {
//         payoutCommission: parentCommission,
//         amount: 0, // Parent vendor amount is always 0, only commission is tracked
//       },
//       isApproved,
//       conn,
//     );

//     logger.info(
//       `Parent vendor calculation table updated successfully for userId: ${parentUserId}`,
//     );

//     return parentCommission;
//   } catch (error) {
//     logger.error('Error in updateParentVendorCalculation:', error);
//     throw error;
//   }
// };

// Helper function to check if vendor is sub-vendor and get parent info
const getSubVendorParentInfo = async (vendor) => {
  try {
    // logger.info(
    //   `Checking sub-vendor status for vendor: userId=${vendor.user_id}, designation=${vendor.designation}, designation_name=${vendor.designation_name}, config=${JSON.stringify(vendor.config)}`,
    // );

    // Check if vendor designation is SUB_VENDOR (handle both designation and designation_name properties)
    // const vendorDesignation = vendor?.designation_name;
    // if (vendorDesignation !== Role.SUB_VENDOR) {
    //   logger.info(
    //     `Vendor is not SUB_VENDOR, designation: ${vendorDesignation}`,
    //   );
    //   return null;
    // }

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
    const userHierarchys = await getUserHierarchysDao({
      user_id: vendor.user_id,
    });

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

const createPayoutService = async (
  conn,
  headers,
  payload,
  role,
  userIp,
  fromUI,
) => {
  try {
    // const filterColumns =
    //   role === Role.MERCHANT
    //     ? merchantColumns.PAYOUT
    //     : role === Role.VENDOR
    //       ? vendorColumns.PAYOUT
    //       : columns.PAYOUT;
    const { code, amount, x_api_key, returnUrl, notifyUrl } = payload;
    const details = await getMerchantsByCodeDao(code);

    if (!details[0] || details[0].length === 0) {
      const data = {
        status: 404,
        message: 'Merchant is inactive. Contact support for help!',
      };
      return data;
    }

    if (details[0]?.config?.whitelist_ips && role !== Role.ADMIN) {
      let whitelist = details[0].config.whitelist_ips;
      // Normalize whitelist to array of trimmed strings
      if (typeof whitelist === 'string') {
        whitelist = whitelist
          .split(',')
          .map((ip) => ip.trim())
          .filter(Boolean);
      } else if (Array.isArray(whitelist)) {
        whitelist = whitelist.map((ip) => String(ip).trim()).filter(Boolean);
      } else {
        whitelist = [];
      }
      // Check if userIp is in whitelist (if whitelist is not empty)
      if (
        whitelist.length &&
        !whitelist.includes(userIp) &&
        role !== Role.ADMIN
      ) {
        const data = {
          status: 400,
          message: 'IP not whitelisted',
        };
        return data;
      }
    }

    if (details[0]?.balance < 0 && !details[0]?.config?.allow_payout) {
      const data = {
        status: 400,
        message: 'Merchant balance is less than payout amount',
      };
      return data;
    }

    const { config, user_id } = details[0];
    const merchantAPIKey = config?.keys;
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
    payload.company_id = payload.company_id
      ? payload.company_id
      : details[0].company_id;
    payload.created_by = payload.created_by ? payload.created_by : user_id;
    payload.updated_by = payload.updated_by ? payload.updated_by : user_id;
    const isOrderIdExist = await getPayoutByMerchantOrderIdDao(
      merchant_order_id,
      payload.company_id,
    );

    if (isOrderIdExist) {
      const data = {
        status: 400,
        message: 'Merchant Order ID already exists',
      };
      return data;
    }

    if (!x_api_key || !merchantAPIKey) {
      const data = {
        status: 404,
        message: 'Enter valid Api key',
      };
      return data;
    }

    if (
      x_api_key !== merchantAPIKey?.private &&
      x_api_key !== merchantAPIKey?.public
    ) {
      const data = {
        status: 404,
        message: 'Enter valid Api key',
      };
      return data;
    }
    if (
      (amount < details[0].min_payout || amount > details[0].max_payout) &&
      role !== Role.ADMIN
    ) {
      const data = {
        status: 400,
        message: `Amount should be between ${details[0].min_payout} and ${details[0].max_payout}`,
      };
      return data;
    }

    // if (payload.merchant_order_id) {
    //   const data = await getPayoutsDao(
    //     { merchant_order_id: merchant_order_id },
    //     payload.company_id,
    //     null,
    //     null,
    //     'DESC',
    //     role,
    //     conn,
    //   );
    //   if (data.length > 0) {
    //     const data = {
    //       status: 400,
    //       message: 'Merchant Order ID already exists',
    //     };
    //     return data;
    //   }
    // }

    delete payload.x_api_key;
    let data = await createPayoutDao(conn, payload);

    if (balanceRestriction) {
      const { totalNetBalance } = await getCalculationDao({ user_id });

      if (totalNetBalance < payoutAmount) {
        const data = {
          status: 400,
          message: 'Insufficient Balance to create Payout',
        };
        return data;
      }
      const ekoBalanceEnquiry = await ekoWalletBalanceEnquiryInternally();
      if (Number(ekoBalanceEnquiry.data.balance) < payoutAmount) {
        const data = {
          status: 400,
          message: 'Insufficient Balance in Wallet',
        };
        return data;
      }
    }

    const {
      allow_clickrr,
      clickrr_auto_approval_limit,
      allow_tatapay,
      allow_payassist,
    } = details[0]?.config || {};

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
        updatedData = await updatePayoutService(conn, ids, updatedPayload);
        data = updatedData;
      }
    }

    if (!code) {
      const data = {
        status: 404,
        message: 'Merchant does not exist',
      };
      return data;
    }

    // const finalResult = filterResponse(data, filterColumns);
    await newTableEntry(tableName.PAYOUT);
    return data;
  } catch (error) {
    logger.error('Error in createPayoutService', error.message);
    throw error;
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
  let conn;
  try {
    const fetchMerchantIds = async (user_ids) => {
      const merchants = await getMerchantByUserIdDao(user_ids);
      return merchants.map((merchant) => merchant.id);
    };
    const fetchVendorIds = async (user_ids) => {
      const vendors = await getVendorsDao({ user_id: user_ids });
      return vendors.map((vendor) => vendor.id);
    };

    let merchant_user_id = role === Role.MERCHANT ? [user_id] : [];

    if (role === Role.MERCHANT) {
      const userHierarchys = await getUserHierarchysDao({ user_id });
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
          const parentHierarchys = await getUserHierarchysDao({
            user_id: parentID,
          });
          const parentHierarchy = parentHierarchys?.[0];
          const subMerchants =
            parentHierarchy?.config?.siblings?.sub_merchants ?? [];

          const userIdFilter = [...new Set([parentID, ...subMerchants])];
          filters.merchant_id = await fetchMerchantIds(userIdFilter);
        }
      }
    } else if (role === Role.VENDOR || role === Role.SUB_VENDOR) {
      if (designation === Role.VENDOR || designation === Role.VENDOR_ADMIN) {
        const userHierarchys = await getUserHierarchysDao({ user_id });
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
        const userHierarchys = await getUserHierarchysDao({ user_id });
        const userHierarchy = userHierarchys?.[0];
        const parentID = userHierarchy?.config?.parent;
        if (parentID) {
          const parentHierarchys = await getUserHierarchysDao({
            user_id: parentID,
          });
          const parentHierarchy = parentHierarchys?.[0];
          const subVendors =
            parentHierarchy?.config?.siblings?.sub_vendors ?? [];

          const userIdFilter = [...new Set([parentID, ...subVendors])];
          filters.vendor_id = await fetchVendorIds(userIdFilter);
        }
      }
    }

    conn = await getConnection('reader');
    await beginTransaction(conn);
    const data = await getAllPayoutsDao(
      filters,
      company_id,
      page,
      limit,
      sortOrder,
      role,
      conn,
    );
    await commit(conn);
    return { totalCount: data[0]?.total, payout: data };
  } catch (error) {
    logger.error('Error in getPayoutsService:', error);
    throw error;
  } finally {
    if (conn) {
      conn.release();
    }
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
      const userHierarchys = await getUserHierarchysDao({ user_id });
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
          const parentHierarchys = await getUserHierarchysDao({
            user_id: parentID,
          });
          const parentHierarchy = parentHierarchys?.[0];
          const subMerchants =
            parentHierarchy?.config?.siblings?.sub_merchants ?? [];

          const userIdFilter = [...new Set([parentID, ...subMerchants])];
          filters.merchant_id = await fetchMerchantIds(userIdFilter);
        }
      }
    } else if (role === Role.VENDOR) {
      if (designation === Role.VENDOR || designation === Role.VENDOR_ADMIN) {
        const userHierarchys = await getUserHierarchysDao({ user_id });
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
        const userHierarchys = await getUserHierarchysDao({ user_id });
        const userHierarchy = userHierarchys?.[0];
        const parentID = userHierarchy?.config?.parent;
        if (parentID) {
          const parentHierarchys = await getUserHierarchysDao({
            user_id: parentID,
          });
          const parentHierarchy = parentHierarchys?.[0];
          const subVendors =
            parentHierarchy?.config?.siblings?.sub_vendors ?? [];

          const userIdFilter = [...new Set([parentID, ...subVendors])];
          filters.vendor_id = await fetchVendorIds(userIdFilter);
        }
      }
    }
    if (filters.vendor_code) {
      const vendorDetails = await getVendorsDao({
        code: filters.vendor_code.trim(),
      });
      if (vendorDetails.length === 0) {
        return;
      }
      const parentHierarchys = await getUserHierarchysDao({
        user_id: vendorDetails[0].user_id,
      });
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
      // filterColumns,
    );

    return data;
  } catch (error) {
    logger.error('Error while fetching Payout by search', error);
    throw error;
  }
};

const updatePayoutService = async (conn, ids, payload, role) => {

  try {
    if (
      !payload?.config?.method === Method.CLICKRR &&
      !payload?.config?.method === Method.PAYASSIST &&
      !payload?.config?.method === Method.TATAPAY && 
      !payload?.config?.method === Method.RUPEEFLOW &&
      !payload?.config?.method === Method.BSS &&
      !payload?.config?.method === Method.SILKPAY
    )
      await checkLockEdit(conn, ids.id);

    // Early validation for UTR uniqueness
    if (payload?.utr_id) {
      const payoutDetails = await getPayoutByUtrIdDao(
        payload.utr_id,
        ids.company_id,
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
    if (payload?.config?.rejected_reason) {
      Object.assign(payload, {
        status: Status.REJECTED,
        rejected_at: new Date().toISOString(),
      });
    }
    if (payload.status === Status.INITIATED) {
      Object.assign(payload, { utr_id: '', rejected_reason: '' });
    }

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

    // Status validation logic - consolidated
    if (payload.status && singleWithdrawData.status !== payload.status) {
      const currentStatus = singleWithdrawData.status;
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

      if (currentStatus === newStatus) {
        throw new BadRequestError(
          'Payout status cannot be updated to the same value',
        );
      }
    }

    // Fetch related data in parallel
    const bankID = payload.bank_acc_id || singleWithdrawData.bank_acc_id;
    let [merchantArr, bankDataArr] = await Promise.all([
      getMerchantByIdDao(singleWithdrawData.merchant_id, ids.company_id),
      bankID ? getBankByIdDao({ id: bankID }) : Promise.resolve([]),
    ]);

    const merchant = merchantArr[0];
    if (!merchant) {
      throw new NotFoundError('Merchant not found!');
    }

    if (payload?.config?.method === Method.EKO) {
      await processEkoPayout(singleWithdrawData, payload);
    } else if (payload?.config?.method === Method.CLICKRR) {
      const method = payload.config.method;

      const [company] = await getCompanyByIDDao({ id: ids.company_id });
      if (!company) throw new NotFoundError('Company not found');

      const bankId = company.config.CLICKRR.defaultBankId;
      if (!bankId)
        throw new NotFoundError(`Default bank ID not found for ${method}`);

      bankDataArr = await getBankByIdDao({ id: bankId });

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
    }
    else if (payload?.config?.method === Method.SILKPAY) {
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
    }
    else if (payload?.config?.method === Method.BSS02) {
      const method = payload.config.method;
      logger.info(`Processing BSS02 payout for method: ${method}`);
      const [company] = await getCompanyByIDDao({ id: ids.company_id }, conn);
      if (!company) throw new NotFoundError('Company not found');

      const bankId = company.config.BSS02.defaultBankId;
      if (!bankId)
        throw new NotFoundError(`Default bank ID not found for ${method}`);

      bankDataArr = await getBankByIdDao({ id: bankId });

      if (!bankDataArr[0])
        throw new NotFoundError(`Bank not found for ${method} payout`);

      // const clientIp = getClientIp(req);
      logger.info(`Creating BSS02 payout with bankId: ${bankId}`);
      const updatedPayload = await createBSS02Payout(
        payload,
        ids,
        singleWithdrawData,
        bankId,
      );
      payload = updatedPayload;
    }
     else if (payload?.config?.method === Method.PAYASSIST) {
      const method = payload.config.method;

      const [company] = await getCompanyByIDDao({ id: ids.company_id });
      if (!company) throw new NotFoundError('Company not found');

      const bankId = company.config.PAY_ASSIST.defaultBankId;
      if (!bankId)
        throw new NotFoundError(`Default bank ID not found for ${method}`);

      bankDataArr = await getBankByIdDao({ id: bankId });

      if (!bankDataArr[0])
        throw new NotFoundError(`Bank not found for ${method} payout`);

      const updatedPayload = await createPayAssistPayout(
        payload,
        ids,
        singleWithdrawData,
        bankId,
      );
      payload = updatedPayload;
    } else if (payload?.config?.method === Method.TATAPAY) {
      const method = payload.config.method;

      const [company] = await getCompanyByIDDao({ id: ids.company_id });
      if (!company) throw new NotFoundError('Company not found');

      const bankId = company.config.TATA_PAY.defaultBankId;
      if (!bankId)
        throw new NotFoundError(`Default bank ID not found for ${method}`);

      bankDataArr = await getBankByIdDao({ id: bankId });

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
      const method = payload.config.method;

      const [company] = await getCompanyByIDDao({ id: ids.company_id });
      if (!company) throw new NotFoundError('Company not found');

      const bankId = company.config.RUPEE_FLOW.defaultBankId;
      if (!bankId)
        throw new NotFoundError(`Default bank ID not found for ${method}`);

      bankDataArr = await getBankByIdDao({ id: bankId });

      if (!bankDataArr[0])
        throw new NotFoundError(`Bank not found for ${method} payout`);

      const updatedPayload = await createRupeeFlowPayout(
        payload,
        ids,
        singleWithdrawData,
        bankId,
      );
      payload = updatedPayload;
    }

    const data = await updatePayoutDao(ids, payload, conn);

    await newTableEntry(tableName.PAYOUT);
    if (data.status == Status.INITIATED) {
      return data;
    }
    // Early return for simple updates
    const checkPayload = {
      utr_id: payload.utr_id,
      updated_by: payload.updated_by,
    };
    if (stringifyJSON(payload) === stringifyJSON(checkPayload)) {
      return data;
    }

    const notifyUrl = data.config?.urls?.notify || merchant?.payout_notify;

    // Early return if not approved
    if (!data.approved_at && data.status !== Status.PENDING) {
      merchantPayoutCallback(notifyUrl, {
        code: merchant.code,
        merchantOrderId: data.merchant_order_id,
        payoutId: data.id,
        amount: data.amount,
        status: data.status,
        utr_id: data.utr_id || '',
      });
      return data;
    }

    const bankData = bankDataArr[0];
    if (!bankData) {
      throw new NotFoundError('Bank not found!');
    }
    if (bankData.is_obsolete) {
      throw new BadRequestError('Bank account is obsolete');
    }
    if (bankData.is_blocked) {
      throw new BadRequestError('Bank account is blocked');
    }

    const vendorArr = await getVendorByIdDao(bankData.user_id, ids.company_id);
    const vendor = vendorArr[0];
    if (!vendor) {
      throw new NotFoundError('Vendor not found!');
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

    const payoutExists = await getPayoutByIdDao(ids.id, ids.company_id);
    if (
      payoutExists &&
      payoutExists?.status === data?.status &&
      (payoutExists.status === Status.APPROVED ||
        payoutExists.status === Status.REJECTED) &&
      !data.utr_id && // No new UTR being added
      !data.config && // No config updates
      !data.bank_acc_id // No bank account updates
    ) {
      throw new BadRequestError(`Payout is already ${payoutExists.status}`);
    }

    // Handle sub-vendor and parent commission logic
    // let totalVendorCommission = vendorCommission;
    // let brokerageCommission = 0;
    // let parentCommission = 0;
    // let payoutConfig = {};
    let subVendorParentInfo = null;
    if (vendor?.designation_name === Role.SUB_VENDOR) {
      subVendorParentInfo = await getSubVendorParentInfo(vendor);
    }

    // logger.info(
    //   `Sub-vendor detection result: ${subVendorParentInfo ? 'Found parent info' : 'No parent info'}`,
    // );
    // if (subVendorParentInfo) {
    // logger.info(
    //   `Parent vendor details: userId=${subVendorParentInfo.parentUserId}, commission_rate=${subVendorParentInfo.parentVendor.payout_commission}`,
    // );
    // Calculate parent commission for payout
    // parentCommission = calculateCommission(
    //   data.amount,
    //   Number(subVendorParentInfo.parentVendor.payout_commission),
    // );
    // totalVendorCommission = vendorCommission + parentCommission;
    // brokerageCommission = parentCommission;

    // Preserve existing config and only update commission keys
    // payoutConfig = {
    //   ...(payoutExists?.config || {}), // Preserve existing config
    //   actual_vendor_commission: vendorCommission,
    //   brokerage_commission: brokerageCommission,
    // };

    // logger.info(
    //   `Payout sub-vendor commission calculated: sub=${vendorCommission}, parent=${parentCommission}, total=${totalVendorCommission}`,
    // );
    // }
    // else {
    //   logger.info(
    //     `No sub-vendor detected, vendor designation: ${vendor.designation || vendor.designation_name}, is_owned: ${vendor.config?.is_owned}`,
    //   );
    //   // Preserve existing config and only update commission keys
    //   payoutConfig = {
    //     ...(payoutExists?.config || {}), // Preserve existing config
    //     actual_vendor_commission: vendorCommission,
    //   };
    // }

    // Handle status-specific updates
    if (data.status === Status.APPROVED) {
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
        updateBankaccountDao(
          { id: bankData.id },
          {
            payin_count: Number(bankData.payin_count) + 1,
            today_balance: Number(bankData.today_balance) - Number(data.amount),
            balance: Number(bankData.balance) - Number(data.amount),
            is_enabled:
              bankData?.config?.max_limit <
              Math.abs(bankData.today_balance) + data.amount
                ? false
                : true,
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
    } else if (data.status === Status.REVERSED && data.approved_at !== null) {
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
        updateBankaccountDao(
          { id: bankData.id },
          {
            today_balance: Number(bankData.today_balance + data.amount),
            balance: Number(bankData.balance + data.amount),
            is_enabled:
              bankData?.config?.max_limit <
              Math.abs(bankData.today_balance) + data.amount
                ? false
                : true,
          },
          conn,
        ),
      ]);
    }

    if (data.status !== Status.PENDING) {
      // This is async function but it's just the callback sending function there fore we are not using await
      merchantPayoutCallback(notifyUrl, {
        code: merchant.code,
        merchantOrderId: data.merchant_order_id,
        payoutId: data.id,
        amount: data.amount,
        status: data.status,
        utr_id: data.utr_id || '',
      });
    }

    return data;
  } catch (error) {
    logger.error('Error in updatePayoutService:', error.message);
    throw error;
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

  const calculationData = await getCalculationforCronDao(user_id);
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

  await trackVendorsNetBalance(calculationData[0].user_id, conn, response);
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

const activateEkoService = async (req, res) => {
  const key = config?.ekoAccessKey;
  const encodedKey = Buffer.from(key).toString('base64');

  const secretKeyTimestamp = Date.now();
  const secretKey = crypto
    .createHmac('sha256', encodedKey)
    .update(secretKeyTimestamp.toString())
    .digest('base64');

  const encodedParams = new URLSearchParams();
  encodedParams.set('service_code', config?.ekoServiceCode);
  encodedParams.set('user_code', config?.ekoUserCode);
  encodedParams.set('initiator_id', config?.ekoInitiatorId);

  const url = config?.ekoPaymentsActivateUrl;
  const options = {
    method: 'PUT',
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

const ekoPayoutStatus = async (id, res) => {
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

const assignedPayoutService = async (
  conn,
  id,
  payload,
  updated_by,
  company_id,
) => {
  try {
    const data = await assignedPayoutDao(
      payload,
      id,
      updated_by,
      company_id,
      conn,
    );
    await newTableEntry(tableName.PAYOUT);
    return data;
  } catch (error) {
    logger.error('Error while vendor assigning to Payout', error);
    throw error;
  }
};

const deletePayoutService = async (id, updated_by, role) => {
  let conn;
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.PAYOUT
        : role === Role.VENDOR || role === Role.SUB_VENDOR
          ? vendorColumns.PAYOUT
          : columns.PAYOUT;
    conn = await getConnection();
    await beginTransaction(conn); // Start a transaction
    const payload = { is_obsolete: true };
    payload.updated_by = updated_by;
    const data = await deletePayoutDao(id, payload); // Adjust DAO call for delete
    await commit(conn); // Commit the transaction
    const finalResult = await filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn); // Rollback the transaction in case of error
      } catch (rollbackError) {
        logger.error(
          'Error during transaction rollback',
          'error',
          rollbackError,
        );
      }
    }
    logger.error('Error while deleting Payout', 'error', error);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.release(); // Release the connection back to the pool
      } catch (releaseError) {
        logger.error(
          'Error while releasing the connection',
          'error',
          releaseError,
        );
      }
    }
  }
};

const ekoWalletBalanceEnquiryInternally = async () => {
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
    const merchantArr = await getMerchantsDao({ code: merchantCode });
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

    const payOut = await getPayoutsDao({
      id: payOutId,
      merchant_order_id: merchantOrderId,
    });
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

export {
  createPayoutService,
  getPayoutsService,
  checkPayOutStatusService,
  getPayoutsBySearchService,
  updatePayoutService,
  deletePayoutService,
  assignedPayoutService,
};