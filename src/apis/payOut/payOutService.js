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
import { getPayInsDao } from '../payIn/payInDao.js';

const createPayoutService = async (conn, headers, payload, role) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.PAYOUT
        : role === Role.VENDOR
          ? vendorColumns.PAYOUT
          : columns.PAYOUT;
    const { code, amount, x_api_key } = payload;
    const details = await getMerchantsDao({ code });
    console.log(details);
    const { user_id, config } = details[0];
    const merchantAPIKey = config?.keys;
    const payoutAmount = Number(amount);
    const balanceRestriction = config.balanceRestriction;
    const merchant_order_id = payload.merchant_order_id ?? uuidv4();
    delete payload.code;
    payload.merchant_id = details[0].id;
    payload.merchant_order_id = merchant_order_id;

    if (!x_api_key || !merchantAPIKey) {
      throw new BadRequestError(400, 'Missing API key or Merchant Keys');
    }

    if (
      x_api_key !== merchantAPIKey?.private &&
      x_api_key !== merchantAPIKey?.public
    ) {
      throw new BadRequestError(403, 'Enter a valid API key');
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
        throw new DuplicateDataError('Merchant Order ID already exists');
      }
    }

    delete payload.x_api_key;
    const data = await createPayoutDao(conn, payload);
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

    if (!code) {
      throw new BadRequestError('Merchant does not exist');
    }

    console.log('Payout created successfully', 'info');
    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    console.log('Error while creating Payout', 'error', error);
    throw new InternalServerError(error);
  }
};

const getPayoutsService = async (company_id, page, limit, filters, role) => {
  let conn;
  try {
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

const updatePayoutService = async (conn, ids, payload, role) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.PAYOUT
        : role === Role.VENDOR
          ? vendorColumns.PAYOUT
          : columns.PAYOUT;

    if (payload.utr_id && !payload.status)
      Object.assign(payload, {
        status: Status.APPROVED,
        approved_at: new Date().toISOString(),
      });
    if (payload.rejected_reason)
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
    if (payload?.method === Method.EKO)
      await processEkoPayout(singleWithdrawData, payload);
    payload.config = {
      method: payload.method,
    };
    delete payload.method;
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

    const [merchantArr, vendorArr, userArr] = await Promise.all([
      getMerchantsDao({ id: data.merchant_id }, null, null, null, null),
      getVendorsDao({ user_id: bankData.user_id }, null, null, null, null),
      getUserByIdDao(conn, { id: bankData.user_id }),
    ]);

    const merchant = merchantArr[0];
    const vendor = vendorArr[0];
    const user = userArr[0];
    if (!merchant) {
      throw new NotFoundError('Merchant not found!');
    }

    if (!vendor) {
      throw new NotFoundError('Vendor not found!');
    }

    if (data.status === Status.APPROVED) {
      const netBalance = await updatePayoutCalculations(
        merchant.user_id,
        data.approved_at,
        Number(data.amount),
        Number(data.payout_merchant_commission),
        true,
        false,
        conn,
      );
      const netVendorBalance = await updatePayoutCalculations(
        vendor.user_id,
        data.approved_at,
        Number(data.amount),
        Number(data.payout_vendor_commission),
        false,
        false,
        conn,
      );
      await updateBankaccountDao(
        { id: bankData.id },
        {
          today_balance: Number(bankData.today_balance) - Number(data.amount),
          balance: Number(bankData.balance) - Number(data.amount),
        },
        conn,
      );

      const merchantCommission = calculateCommission(
        Number(data.amount),
        Number(data.payout_merchant_commission),
      );
      const vendorCommission = calculateCommission(
        Number(data.amount),
        Number(data.commission),
      );
      await updateMerchantDao(
        { id: merchant.id },
        { balance: netBalance },
        conn,
      );
      await updateVendorDao(
        { id: vendor.id },
        { balance: netVendorBalance },
        conn,
      );
      await updatePayoutDao(
        ids,
        { payout_merchant_commission: merchantCommission, payout_vendor_commission: vendorCommission },
        conn
      );
    } else if (data.status === Status.REJECTED) {
      const netBalance = await updatePayoutCalculations(
        merchant.user_id,
        data.rejected_at,
        Number(data.amount),
        Number(data.payout_merchant_commission),
        true,
        true,
        conn,
      );
      const netVendorBalance = await updatePayoutCalculations(
        vendor.user_id,
        data.rejected_at,
        Number(data.amount),
        Number(data.payout_vendor_commission),
        false,
        true,
        conn,
      );
      await updateBankaccountDao(
        { id: bankData.id },
        {
          today_balance: Number(bankData.today_balance) + Number(data.amount),
          balance: Number(bankData.balance) - Number(data.amount),
        },
        conn,
      );
      await updateMerchantDao(
        { id: merchant.id, company_id: merchant.company_id },
        { balance: netBalance },
        conn,
      );

      await updateVendorDao(
        { id: vendor.id },
        { balance: netVendorBalance },
        conn,
      );

      const merchantCommission = calculateCommission(
        Number(data.amount),
        Number(data.payout_merchant_commission),
      );
      const vendorCommission = calculateCommission(
        Number(data.amount),
        Number(data.payout_vendor_commission),
      );
      await updateMerchantDao(
        { id: merchant.id },
        { balance: netBalance, payout_commission: merchantCommission },
        conn,
      );
      await updateVendorDao(
        { id: vendor.id },
        { balance: netVendorBalance, payout_commission: vendorCommission },
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
    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    console.error('Error in getPayoutsService:', error);
    throw new InternalServerError(error);
  }
};

// Function to update calculations
const updatePayoutCalculations = async (
  userId,
  date,
  amount,
  commission,
  isMerchant,
  isReverse = false,
  conn,
) => {
  const currentCalculation = await getCalculationforCronDao(userId);
  const cal = currentCalculation[0];
  if (!cal) {
    throw Error('Calculation not found!');
  }

  const prefix = isReverse ? 'reverse_' : '';
  const updatedCalculation = {
    ...cal,
    [`total_${prefix}payout_count`]: cal[`total_${prefix}payout_count`] + 1,
    [`total_${prefix}payout_amount`]:
      cal[`total_${prefix}payout_amount`] + amount,
    [`total_${prefix}payout_commission`]:
      cal[`total_${prefix}payout_commission`] + commission,
  };

  const { currentBalance, netBalance } = calculateBalances(
    updatedCalculation,
    cal,
    isMerchant,
  );

  await updateCalculationDao(
    { id: cal.id },
    {
      [`total_${prefix}payout_count`]:
        updatedCalculation[`total_${prefix}payout_count`],
      [`total_${prefix}payout_amount`]:
        updatedCalculation[`total_${prefix}payout_amount`],
      [`total_${prefix}payout_commission`]:
        updatedCalculation[`total_${prefix}payout_commission`],
      current_balance: Number(currentBalance),
      net_balance: Number(netBalance),
    },
    conn,
  );

  return Number(netBalance);
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

  // may be in future this will need
  // console.log('Secret Key:', secretKey);
  // console.log('Secret Timestamp:', secretKeyTimestamp);

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

export {
  createPayoutService,
  getPayoutsService,
  updatePayoutService,
  deletePayoutService,
};
