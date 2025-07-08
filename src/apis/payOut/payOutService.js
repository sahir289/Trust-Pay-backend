/* eslint-disable no-unused-vars */
import { v4 as uuidv4 } from 'uuid';
import {
  BadRequestError,
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
  assignedPayoutDao,
  createPayoutDao,
  deletePayoutDao,
  getPayoutsDao,
  getPayoutsBySearchDao,
  updatePayoutDao,
  getAllPayoutsDao,
} from './payOutDao.js';
import {
  getMerchantsDao,
  getMerchantByUserIdDao,
} from '../merchants/merchantDao.js';
import { getVendorsDao } from '../vendors/vendorDao.js';
import {
  getCalculationDao,
  getCalculationforCronDao,
} from '../calculation/calculationDao.js';
import {
  updateBankaccountDao,
  // getBankaccountDao,
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
// import { updatePayout } from '../../utils/sockets.js';
import { newTableEntry } from '../../utils/sockets.js';
import { checkLockEdit } from '../../utils/advisoryLock.js';
import { stringifyJSON } from '../../utils/index.js';
// import { notifyAdminsAndUsers } from '../../utils/notifyUsers.js';
// import { notifyNewCalculationTableEntry } from '../../utils/sockets.js';
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
    const details = await getMerchantsDao({ code });

    if (!details[0] || details[0].length === 0) {
      const data = {
        status: 404,
        message: 'Please enter valid code',
      }
      return data;
    }

    if (!fromUI && details[0]?.config?.whitelist_ips) {
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
      if (whitelist.length && !whitelist.includes(userIp)) {
        const data = {
          status: 400,
          message: 'IP not whitelisted',
        }
        return data;
      }
    }

    if (details[0]?.balance < 0 && !details[0]?.config?.allow_payout) {
      const data = {
        status: 400,
        message: 'Merchant balance is less than payout amount',
      }
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
    const isOrderIdExist = await getPayoutsDao(
      { merchant_order_id: merchant_order_id },
      payload.company_id,
    );

    if (isOrderIdExist.length > 0) {
      const data = {
        status: 400,
        message: 'Merchant Order ID already exists',
      }
      return data;
    }

    if (!x_api_key || !merchantAPIKey) {
      const data = {
        status: 404,
        message: 'Enter valid Api key',
      }
      return data;
    }

    if (
      x_api_key !== merchantAPIKey?.private &&
      x_api_key !== merchantAPIKey?.public
    ) {
      const data = {
        status: 404,
        message: 'Enter valid Api key',
      }
      return data;
    }
    if (amount < details[0].min_payout || amount > details[0].max_payout) {
      const data = {
        status: 400,
        message: `Amount should be between ${details[0].min_payout} and ${details[0].max_payout}`,
      }
      return data;
    }

    if (payload.merchant_order_id) {
      const data = await getPayoutsDao(
        { merchant_order_id: merchant_order_id },
        payload.company_id,
        null,
        null,
        'DESC',
        role,
        conn,
      );
      if (data.length > 0) {
        const data = {
          status: 400,
          message: 'Merchant Order ID already exists',
        }
        return data;
      }
    }

    delete payload.x_api_key;
    const data = await createPayoutDao(conn, payload);
    if (balanceRestriction) {
      const { totalNetBalance } = await getCalculationDao({ user_id });
      if (totalNetBalance < payoutAmount) {
        const data = {
          status: 400,
          message: 'Insufficient Balance to create Payout',
        }
        return data;
      }
      const ekoBalanceEnquiry = await ekoWalletBalanceEnquiryInternally();
      if (Number(ekoBalanceEnquiry.data.balance) < payoutAmount) {
        const data = {
          status: 400,
          message: 'Insufficient Balance in Wallet',
        }
        return data;
      }
    }
    if (!code) {
      const data = {
        status: 404,
        message: 'Merchant does not exist',
      }
      return data;
    }

    // const finalResult = filterResponse(data, filterColumns);
    await newTableEntry(tableName.PAYOUT);
    return data;
  } catch (error) {
    logger.error(error);
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
) => {
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
    logger.error('Error while fetching Payout by search', error);
    throw new InternalServerError(error.message);
  }
};

const updatePayoutService = async (conn, ids, payload, role) => {
  try {
    await checkLockEdit(conn, ids.id);
    if (payload?.utr_id) {
      const payoutDetails = await getPayoutsDao(
        { utr_id: payload.utr_id },
        ids.company_id,
      );
      if (payoutDetails.length > 0) {
        throw new BadRequestError('UTR already exists');
      }
    }
    if (payload?.utr_id && !payload.status && payload?.bank_acc_id)
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

    // Fetch payout and merchant in parallel for performance
    const [singleWithdrawDataArr] = await Promise.all([
      getPayoutsDao(ids, null, null, null, 'DESC', null, conn),
    ]);
    const singleWithdrawData = singleWithdrawDataArr[0];
    if (!singleWithdrawData) {
      throw new NotFoundError('Payout not found!');
    }
    const merchantArr = await getMerchantsDao({
      id: singleWithdrawData.merchant_id,
    });
    const merchant = merchantArr[0];
    if (!merchant) {
      throw new NotFoundError('Merchant not found!');
    }

    if (payload?.config?.method === Method.EKO)
      await processEkoPayout(singleWithdrawData, payload);
    if (payload.status) {
      const payout = await getPayoutsDao({ id: ids.id }, ids.company_id);
      if (
        payout[0].status === Status.REJECTED &&
        payload.status === Status.APPROVED
      ) {
        throw new BadRequestError(
          'Cannot change payout status from rejected to approved',
        );
      }
      if (
        payout[0].status === Status.APPROVED &&
        payload.status === Status.REJECTED
      ) {
        throw new BadRequestError(
          'Cannot change payout status from approved to rejected',
        );
      }
      if (payload.status === payout[0].status) {
        throw new BadRequestError(
          'Payout status cannot be updated to the same value',
        );
      }
    }
    const data = await updatePayoutDao(ids, payload, conn);
    let checkPayload = {
      utr_id: payload.utr_id,
      updated_by: payload.updated_by,
    };
    if (stringifyJSON(payload) === stringifyJSON(checkPayload)) {
      return data;
    }
    if (!data.approved_at) return data;

    // Fetch bank data first, then get vendor using bankData.user_id
    const bankDataArr = await getBankByIdDao({ id: data.bank_acc_id });
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
    const vendorArr = await getVendorsDao({ user_id: bankData.user_id });
    const vendor = vendorArr[0];
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
    if (data.status === Status.APPROVED) {
      await Promise.all([
        updateCalculationTable(
          merchant.user_id,
          {
            payoutCommission: merchantCommission,
            amount: data.amount,
          },
          true,
          conn,
        ),
        updateCalculationTable(
          vendor.user_id,
          {
            payoutCommission: vendorCommission,
            amount: data.amount,
          },
          true,
          conn,
        ),
        updateBankaccountDao(
          { id: bankData.id },
          {
            payin_count: Number(bankData.payin_count) + 1,
            today_balance: Number(bankData.today_balance) - Number(data.amount),
            balance: Number(bankData.balance) - Number(data.amount),
          },
          conn,
        ),
        updatePayoutDao(
          ids,
          {
            payout_merchant_commission: merchantCommission,
            payout_vendor_commission: vendorCommission,
            vendor_id: vendor.id,
          },
          conn,
        ),
      ]);
    } else if (data.status === Status.REVERSED && data.approved_at !== null) {
      await Promise.all([
        updateCalculationTable(
          merchant.user_id,
          {
            payoutCommission: merchantCommission,
            amount: data.amount,
          },
          false,
          conn,
        ),
        updateCalculationTable(
          vendor.user_id,
          {
            payoutCommission: vendorCommission,
            amount: data.amount,
          },
          false,
          conn,
        ),
        updateBankaccountDao(
          { id: bankData.id },
          {
            today_balance: Number(bankData.today_balance + data.amount),
            balance: Number(bankData.balance + data.amount),
          },
          conn,
        ),
      ]);
    }
    await newTableEntry(tableName.PAYOUT);
    // This is async function but it's just the callback sending function there fore we are not using await
    merchantPayoutCallback(data.config?.urls?.notify, {
      code: data.code,
      merchantOrderId: data.merchant_order_id,
      payoutId: data.id,
      amount: data.amount,
      status: data.status,
      utr_id: data.utr_id || '',
    });
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: ids.company_id,
    //   message: `PayOut with merchant order id: ${data.merchant_order_id} has been ${data.status}.`,
    //   payloadUserId: merchant.user_id,
    //   actorUserId: vendor.user_id,
    //   category: 'Transaction',
    //   subCategory: 'PayOut',
    // });
    return data;
  } catch (error) {
    logger.error('Error in updatePayoutService:', error);
    throw new InternalServerError(error.message);
  }
};

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
      logger.error('Missing required properties in data');
      return;
    }
    const totalAmountData = Number(data.amount + data.payoutCommission);
    let payload;
    if (isApproved) {
      payload = {
        total_payout_count: 1,
        total_payout_amount: data.amount,
        total_payout_commission: data.payoutCommission,
        current_balance: -totalAmountData,
        net_balance: -totalAmountData,
      };
    } else {
      payload = {
        total_reverse_payout_count: 1,
        total_reverse_payout_amount: data.amount,
        total_reverse_payout_commission: -data.payoutCommission,
        current_balance: totalAmountData,
        net_balance: totalAmountData,
      };
    }

    const response = await updateCalculationBalanceDao(
      { id: calculationId },
      payload,
      conn,
    );
    return response;
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
  company_id
) => {
  try {
    const data = await assignedPayoutDao(payload, id, updated_by,company_id, conn);
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
        : role === Role.VENDOR
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
    logger.error(error);
  }
};

// Public API Used by Merchants
const checkPayOutStatusService = async (
  payOutId,
  merchantCode,
  merchantOrderId,
  api_key,
) => {
  try{
  const merchantArr = await getMerchantsDao({ code: merchantCode });
  const merchant = merchantArr[0];
  if (!merchant) {
    const data = {
      status: 400,
      message: 'Merchant Order ID already exists',
    }
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
    }
    return data;
    
  }

  const payOut = await getPayoutsDao({
    id: payOutId,
    merchant_order_id: merchantOrderId,
  });

  if (!payOut) {
    const data = {
      status: 404,
      message: 'Payout not found',
    }
    return data;
  }

  //check is payout detials belongs to that merchant or not
  if (!(payOut[0].merchant_id === merchant.id)) {
    const data = {
      status: 404,
      message: 'merchant_order_id and payIn ID do not belong to the specified merchant',
    }
    return data;
  }
  return {
    status: payOut[0].status,
    merchantOrderId: payOut[0].merchant_order_id,
    amount: payOut[0].amount,
    payoutId: payOut[0].id,
    utr_id: payOut[0].utr_id ? payOut[0].utr_id : ' ',
  };
}catch(error){
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
