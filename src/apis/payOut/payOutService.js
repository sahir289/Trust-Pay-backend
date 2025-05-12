/* eslint-disable no-unused-vars */
import { v4 as uuidv4 } from 'uuid';
import {
  BadRequestError,
  DuplicateDataError,
  InternalServerError,
  NotFoundError,
} from '../../utils/appErrors.js';
import { Buffer } from 'buffer';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
import {
  createPayoutDao,
  deletePayoutDao,
  getPayoutsDao,
  getPayoutsBySearchDao,
  updatePayoutDao,
} from './payOutDao.js';
import {
  getMerchantsDao,
  updateMerchantDao,
} from '../merchants/merchantDao.js';
import { getVendorsDao, updateVendorDao } from '../vendors/vendorDao.js';
import {
  getCalculationDao,
  getCalculationforCronDao,
  updateCalculationDao,
} from '../calculation/calculationDao.js';
import {
  updateBankaccountDao,
  getBankaccountDao,
} from '../bankAccounts/bankaccountDao.js';
import config from '../../config/config.js';
import { merchantPayoutCallback } from '../../callBacksAndWebHook/merchantCallBacks.js';
import { getUserByIdDao } from '../users/userDao.js';
import { Status, Method } from '../../constants/index.js';
import { calculateBalances, calculateCommission } from '../../helpers/index.js';
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
const createPayoutService = async (conn, headers, payload, role, res) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.PAYOUT
        : role === Role.VENDOR
          ? vendorColumns.PAYOUT
          : columns.PAYOUT;
    const { code, amount, x_api_key, returnUrl, callbackUrl } = payload;
    const details = await getMerchantsDao({ code });

    if (!details[0] || details[0].length === 0) {
      // throw new BadRequestError('Merchant does not exist');
      return res.status(400).json({
        error: {
          status: 404,
          message: 'Please enter valid code',
          additionalInfo: {},
          level: 'info',
          timestamp: new Date().toISOString(),
        },
      });
    }
    const { config, user_id } = details[0];
    const merchantAPIKey = config?.keys;
    const payoutAmount = Number(amount);
    const balanceRestriction = config.balanceRestriction;
    const merchant_order_id = payload.merchant_order_id ?? uuidv4();
    delete payload.code;
    payload.merchant_id = details[0].id;
    payload.merchant_order_id = merchant_order_id;
    payload.config = JSON.stringify({
      urls: {
        return: returnUrl || details[0].config?.urls?.return || '',
        notify: callbackUrl || details[0].config?.urls?.payin_notify || '',
      },
    });
    payload.company_id = payload.company_id
      ? payload.company_id
      : details[0].company_id;
    payload.created_by = payload.created_by ? payload.created_by : user_id;
    payload.updated_by = payload.updated_by ? payload.updated_by : user_id;
    const isOrderIdExist = await getPayoutsDao(
      { merchant_order_id: merchant_order_id },
      payload.company_id,
    );
   
    if (isOrderIdExist.length > 0) {
      // throw new BadRequestError('Merchant Order ID already exists');
      return res.status(400).json({
        error: {
          status: 400,
          message: 'Merchant Order ID already exists',
          additionalInfo: {},
          level: 'info',
          timestamp: new Date().toISOString(),
        },
      });
    }

    if (!x_api_key || !merchantAPIKey) {
      // throw new BadRequestError('Missing API key or Merchant Keys');
      return res.status(400).json({
        error: {
          status: 404,
          message: 'Enter valid Api key',
          additionalInfo: {},
          level: 'info',
          timestamp: new Date().toISOString(),
        },
      });
    }

    if (
      x_api_key !== merchantAPIKey?.private &&
      x_api_key !== merchantAPIKey?.public
    ) {
      // throw new BadRequestError('Enter a valid API key');
      return res.status(400).json({
        error: {
          status: 404,
          message: 'Enter valid Api key',
          additionalInfo: {},
          level: 'info',
          timestamp: new Date().toISOString(),
        },
      });
    }
    if (amount < details[0].min_payout || amount > details[0].max_payout) {
      // throw new BadRequestError(
      //   `Amount should be between ${details[0].min_payout} and ${details[0].max_payout}`,
      // );
      return res.status(400).json({
        error: {
          status: 400,
          message: `Amount should be between ${details[0].min_payout} and ${details[0].max_payout}`,
          additionalInfo: {},
          level: 'info',
          timestamp: new Date().toISOString(),
        },
      });
    }

    if (payload.merchant_order_id) {
      const data = await getPayoutsDao(
        { merchant_order_id: merchant_order_id },
        payload.company_id,
        null,
        null,
        role,
        conn,
      );
      if (data.length > 0) {
        // throw new DuplicateDataError('Merchant Order ID already exists');
        return res.status(400).json({
          error: {
            status: 400,
            message: 'Merchant Order ID already exists',
            additionalInfo: {},
            level: 'info',
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    delete payload.x_api_key;
    const data = await createPayoutDao(conn, payload);
    if (balanceRestriction) {
      const { totalNetBalance } = await getCalculationDao({ user_id });
      if (totalNetBalance < payoutAmount) {
        // throw new BadRequestError('Insufficient Balance to create Payout');
        return res.status(400).json({
          error: {
            status: 400,
            message: 'Insufficient Balance to create Payout',
            additionalInfo: {},
            level: 'info',
            timestamp: new Date().toISOString(),
          },
        });
      }
      const ekoBalanceEnquiry = await ekoWalletBalanceEnquiryInternally();
      if (Number(ekoBalanceEnquiry.data.balance) < payoutAmount) {
        // throw new BadRequestError('Insufficient Balance in Wallet');
        return res.status(400).json({
          error: {
            status: 400,
            message: 'Insufficient Balance in Wallet',
            additionalInfo: {},
            level: 'info',
            timestamp: new Date().toISOString(),
          },
        });
      }
    }
    if (!code) {
      // throw new BadRequestError('Merchant does not exist');
      return res.status(400).json({
        error: {
          status: 404,
          message: 'Merchant does not exist',
          additionalInfo: {},
          level: 'info',
          timestamp: new Date().toISOString(),
        },
      });
    }

    logger.info('Payout created successfully');
    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    logger.error(error)
    if (error instanceof BadRequestError) {
      throw error;
    }
    throw new InternalServerError(error);
  }
};

const getPayoutsService = async (
  company_id,
  page,
  limit,
  filters,
  role,
  user_id,
  designation,
) => {
  let conn;
  try {
    const fetchMerchantIds = async (user_ids) => {
      const merchants = await getMerchantsDao({ user_id: user_ids });
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
    } else if (role === Role.VENDOR) {
      if (designation === Role.VENDOR) {
        filters.vendor_id = await fetchVendorIds([user_id]);
      } else if (designation === Role.VENDOR_OPERATIONS) {
        const userHierarchys = await getUserHierarchysDao({ user_id });
        const parentID = userHierarchys?.[0]?.config?.parent;
        if (parentID) {
          filters.vendor_id = await fetchVendorIds([parentID]);
        }
      }
    }

    conn = await getConnection();
    await beginTransaction(conn);
    const data = await getPayoutsDao(
      filters,
      company_id,
      page,
      limit,
      role,
      conn,
    );
    await commit(conn);
    return { totalCount: data[0]?.total, payout: data };
  } catch (error) {
    console.error('Error in getPayoutsService:', error);
    throw new InternalServerError(error);
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
) => {
  try {
    const fetchMerchantIds = async (user_ids) => {
      const merchants = await getMerchantsDao({ user_id: user_ids });
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
    } else if (role === Role.VENDOR) {
      if (designation === Role.VENDOR) {
        filters.vendor_id = await fetchVendorIds([user_id]);
      } else if (designation === Role.VENDOR_OPERATIONS) {
        const userHierarchys = await getUserHierarchysDao({ user_id });
        const parentID = userHierarchys?.[0]?.config?.parent;
        if (parentID) {
          filters.vendor_id = await fetchVendorIds([parentID]);
        }
      }
    }

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

    // const filterColumns =
    // role === Role.MERCHANT
    // ? merchantColumns.SETTLEMENT
    // : role === Role.VENDOR
    // ? vendorColumns.SETTLEMENT
    // : columns.SETTLEMENT;
    // TODO: add designation constants

    const data = await getPayoutsBySearchDao(
      filters,
      searchTerms,
      limitNum,
      offset,
      role,
      // filterColumns,
    );

    return data;
  } catch (error) {
    console.error('Error while fetching Payout by search', error);
    throw new InternalServerError(error.message);
  }
};

const updatePayoutService = async (conn, ids, payload, role) => {
  try {
    // const filterColumns =
    //   role === Role.MERCHANT
    //     ? merchantColumns.PAYOUT
    //     : role === Role.VENDOR
    //       ? vendorColumns.PAYOUT
    //       : columns.PAYOUT;

    if (payload?.utr_id && !payload.status)
      Object.assign(payload, {
        status: Status.APPROVED,
        approved_at: new Date().toISOString(),
      });
    if (payload?.config?.rejected_reason)
      Object.assign(payload, {
        status: Status.REJECTED,
        rejected_at: new Date().toISOString(),
      });
    if (payload.status === Status.INITIATED)
      Object.assign(payload, { utr_id: '', rejected_reason: '' });

    const singleWithdrawData = await getPayoutsDao(
      ids,
      null,
      null,
      null,
      null,
      conn,
    );
    if (payload?.config?.method === Method.EKO)
      await processEkoPayout(singleWithdrawData, payload);
    const data = await updatePayoutDao(ids, payload, conn);
    if (!data.approved_at) return;
    const bankDataArr = await getBankaccountDao(
      { id: data.bank_acc_id },
      null,
      null,
      role,
    );
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

    const [merchantArr, vendorArr, userArr] = await Promise.all([
      getMerchantsDao({ id: data.merchant_id }),
      getVendorsDao({ user_id: bankData.user_id }),
    ]);
    const merchant = merchantArr[0];
    const vendor = vendorArr[0];
    if (!merchant) {
      throw new NotFoundError('Merchant not found!');
    }

    if (!vendor) {
      throw new NotFoundError('Vendor not found!');
    }

    // Calculate merchant commission based on percentage
    // const merchantCommissionPercent =
    //   Number(data.payout_merchant_commission) || 0;
    // const merchantCommissionAmount =
    //   (Number(data.amount) * merchantCommissionPercent) / 100;

    // // Calculate vendor commission based on percentage
    // const vendorCommissionPercent = Number(vendor.payout_commission) || 0;
    // const vendorCommissionAmount =
    //   (Number(data.amount) * vendorCommissionPercent) / 100;
    const merchantCommission = calculateCommission(
      data.amount,
      merchant.payout_commission,
    );
    const vendorCommission = calculateCommission(
      data.amount,
      vendor.payout_commission,
    );
    if (data.status === Status.APPROVED) {
      await updateCalculationTable(
        merchant.user_id,
        {
          payoutCommission: merchantCommission,
          amount: data.amount,
        },
        true,
        conn,
      );
      await updateCalculationTable(
        vendor.user_id,
        {
          payoutCommission: vendorCommission,
          amount: data.amount,
        },
        true,
        conn,
      );
      // const netBalance = await updatePayoutCalculations(
      //   merchant.user_id,
      //   data.approved_at,
      //   Number(data.amount),
      //   merchantCommissionAmount,
      //   true,
      //   false,
      //   conn,
      // );
      // const netVendorBalance = await updatePayoutCalculations(
      //   vendor.user_id,
      //   data.approved_at,
      //   Number(data.amount),
      //   vendorCommissionAmount,
      //   false,
      //   false,
      //   conn,
      // );

      await updateBankaccountDao(
        { id: bankData.id },
        {
          today_balance: Number(bankData.today_balance) - Number(data.amount),
          balance: Number(bankData.balance) - Number(data.amount),
        },
        conn,
      );
      // got DB Error when balance is NAN
      const merchantBalance = Number(merchant.balance) - Number(data.amount);
      if (isNaN(merchantBalance)) {
        throw new BadRequestError('Invalid merchant balance');
      } else {
        await updateMerchantDao(
          { id: merchant.id },
          { balance: merchantBalance },
          conn,
        );
      }
      // got DB Error when balance is NAN
      const vendorBalance = Number(vendor.balance) - Number(data.amount);
      if (isNaN(vendorBalance)) {
        throw new BadRequestError('Invalid vendor balance');
      } else {
        await updateVendorDao(
          { id: vendor.id },
          { balance: vendorBalance },
          conn,
        );
      }
      await updatePayoutDao(
        ids,
        {
          payout_merchant_commission: merchantCommission,
          payout_vendor_commission: vendorCommission,
        },
        conn,
      );
    } else if (data.status === Status.REJECTED && data.approved_at !== null) {
      await updateCalculationTable(
        merchant.user_id,
        {
          payoutCommission: merchantCommission,
          amount: data.amount,
        },
        false,
        conn,
      );
      await updateCalculationTable(
        vendor.user_id,
        {
          payoutCommission: vendorCommission,
          amount: data.amount,
        },
        false,
        conn,
      );
      const merchantBalance = Number(merchant.balance + data.amount);
      if (isNaN(merchantBalance)) {
        throw new BadRequestError('Invalid merchant balance');
      } else {
        const log = await updateMerchantDao(
          { id: merchant.id, company_id: merchant.company_id },
          { balance: merchantBalance },
          conn,
        );
      }
      const vendorBalance = Number(vendor.balance + data.amount);
      if (isNaN(vendorBalance)) {
        throw new BadRequestError('Invalid vendor balance');
      } else {
        const merchan = await updateVendorDao(
          { id: vendor.id },
          { balance: vendorBalance },
          conn,
        );
      }

      const vend = await updateBankaccountDao(
        { id: bankData.id },
        {
          today_balance: Number(bankData.today_balance + data.amount),
          balance: Number(bankData.balance + data.amount),
        },
        conn,
      );
    }
    await merchantPayoutCallback(data.config?.urls?.payout_notify, {
      code: data.code,
      merchantOrderId: data.merchant_order_id,
      payoutId: data.id,
      amount: data.amount,
      status: data.status,
      utr_id: data.utr_id || '',
    });
    // const finalResult = filterResponse(data, filterColumns);
    return data;
  } catch (error) {
    console.error('Error in getPayoutsService:', error);
    throw new InternalServerError(error);
  }
};

// Function to update calculations
// const updatePayoutCalculations = async (
//   userId,
//   date,
//   amount,
//   commission,
//   isMerchant,
//   isReverse = false,
//   conn,
// ) => {
//   const currentCalculation = await getCalculationforCronDao(userId);
//   const cal = currentCalculation[0];
//   if (!cal) {
//     throw Error('Calculation not found!');
//   }
//   const prefix = isReverse ? 'reverse_' : '';
// const signedCommission = Math.abs(commission);

// // Calculate updated commission total based on reverse flag
// const updatedCommissionTotal = isReverse
//   ? cal[`total_${prefix}payout_commission`] - signedCommission
//   : cal[`total_${prefix}payout_commission`] + signedCommission;

//   const updatedCalculation = {
//     ...cal,
//     [`total_${prefix}payout_count`]: cal[`total_${prefix}payout_count`] + 1,
//     [`total_${prefix}payout_amount`]:
//       cal[`total_${prefix}payout_amount`] + amount,
//     [`total_${prefix}payout_commission`]: updatedCommissionTotal,
//   };

//   const { currentBalance, netBalance } = calculateBalances(
//     updatedCalculation,
//     cal,
//     isMerchant,
//     isReverse,
//     amount,
//   );

//   await updateCalculationDao(
//     { id: cal.id },
//     {
//       [`total_${prefix}payout_count`]:
//         updatedCalculation[`total_${prefix}payout_count`],
//       [`total_${prefix}payout_amount`]:
//         updatedCalculation[`total_${prefix}payout_amount`],
//       [`total_${prefix}payout_commission`]:
//         updatedCalculation[`total_${prefix}payout_commission`],
//       current_balance: Number(currentBalance),
//       net_balance: Number(netBalance),
//     },
//     conn,
//   );

//   return Number(netBalance);
// };

///for update payout calculation of payout
const updateCalculationTable = async (user_id, data, isApproved, conn) => {
  if (isNaN(data.amount - data.payoutCommission)) {
    throw new BadRequestError('Invalid amount or commission');
  }
  if (user_id) {
    const calculationData = await getCalculationforCronDao(user_id);
    if (!calculationData[0]) {
      throw new NotFoundError('Calculation not found!');
    }
    const calculationId = calculationData[0].id;
    if (
      typeof data.amount === 'undefined' ||
      typeof data.payoutCommission === 'undefined'
    ) {
      console.error('Missing required properties in data');
      return;
    }
    const totalAmountData = Number(data.amount - data.payoutCommission);
    let payload;
    if (isApproved) {
      payload = {
        total_payout_count: 1,
        total_payout_amount: data.amount,
        total_payout_commission: data.payoutCommission,
        current_balance: totalAmountData,
        net_balance: totalAmountData,
      };
    } else {
      payload = {
        total_reverse_payout_count: 1,
        total_reverse_payout_amount: data.amount,
        total_reverse_payout_commission: -data.payoutCommission,
        current_balance: -totalAmountData,
        net_balance: -totalAmountData,
      };
    }

    const TotalAmount = await updateCalculationBalanceDao(
      { id: calculationId },
      payload,
      conn,
    );
  }
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
      console.info(`Payment initiated: ${ekoResponse?.message}`);
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
      console.error(`Payment rejected by eko due to ${ekoResponse?.message}`);
    }
  } catch (error) {
    console.error('Error processing Eko method:', error);
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
      console.error(err);
      parsedData = responseText;
    }

    return parsedData;
  } catch (error) {
    console.error(error);
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
      console.error(err);
      parsedData = responseText;
    }
    return parsedData;
  } catch (error) {
    console.error(error);
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
      console.error(err);
      parsedData = responseText;
    }
    return parsedData;
  } catch (error) {
    console.error(error);
  }
};

const deletePayoutService = async (id, updated_by, role) => {
  let conn;
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.PAYOUT
        : role === Role.VENDOR
          ? vendorColumns.PAYOUT
          : columns.PAYOUT;
    conn = await getConnection();
    await beginTransaction(conn); // Start a transaction
    const payload = { is_obsolete: true };
    payload.updated_by = updated_by;
    const data = await deletePayoutDao(id, payload); // Adjust DAO call for delete
    await commit(conn); // Commit the transaction
    console.log('Payout deleted successfully', 'info');
    const finalResult = await filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn); // Rollback the transaction in case of error
      } catch (rollbackError) {
        console.log(
          'Error during transaction rollback',
          'error',
          rollbackError,
        );
      }
    }
    console.log('Error while deleting Payout', 'error', error);
    throw new InternalServerError(error);
  } finally {
    if (conn) {
      try {
        conn.release(); // Release the connection back to the pool
      } catch (releaseError) {
        console.log(
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
      console.error(err);
      parsedData = responseText;
    }
    return parsedData;
  } catch (error) {
    console.error(error);
  }
};

// Public API Used by Merchants
const checkPayOutStatusService = async (
  payOutId,
  merchantCode,
  merchantOrderId,
  api_key,
  res,
) => {
  const merchantArr = await getMerchantsDao({ code: merchantCode });
  const merchant = merchantArr[0];
  if (!merchant) {
    // throw new NotFoundError('Merchant does not exist');
    return res.status(400).json({
      error: {
        status: 400,
        message: 'Merchant Order ID already exists',
        additionalInfo: {},
        level: 'info',
        timestamp: new Date().toISOString(),
      },
    });
  }

  const merchantConfig = merchant.config || {};

  if (
    api_key != merchantConfig.keys?.private &&
    api_key != merchantConfig.keys?.public
  ) {
    // throw new BadRequestError(403, 'Enter a valid API key');
    return res.status(400).json({
      error: {
        status: 404,
        message: 'Enter valid Api key',
        additionalInfo: {},
        level: 'info',
        timestamp: new Date().toISOString(),
      },
    });
  }

  const payOut = await getPayoutsDao({
    id: payOutId,
    merchant_order_id: merchantOrderId,
  });

  if (!payOut) {
    // throw new NotFoundError('payOut not found');
    return res.status(400).json({
      error: {
        status: 404,
        message: 'Payout not found',
        additionalInfo: {},
        level: 'info',
        timestamp: new Date().toISOString(),
      },
    });
  }

  //check is payout detials belongs to that merchant or not
  if (!(payOut[0].merchant_id === merchant.id)) {
    // throw new BadRequestError(
    //   '`merchant_order_id and payOut ID do not belong to the specified merchant`',
    // );
    return res.status(400).json({
      error: {
        status: 404,
        message:
          'merchant_order_id and payIn ID do not belong to the specified merchant',
        additionalInfo: {},
        level: 'info',
        timestamp: new Date().toISOString(),
      },
    });
  }
  return {
    status: payOut[0].status,
    merchantOrderId: payOut[0].merchant_order_id,
    amount: payOut[0].amount,
    payoutId: payOut[0].id,
    utr_id: payOut[0].utr_id ? payOut[0].utr_id : " ",
  };
};

export {
  createPayoutService,
  getPayoutsService,
  checkPayOutStatusService,
  getPayoutsBySearchService,
  updatePayoutService,
  deletePayoutService,
};
