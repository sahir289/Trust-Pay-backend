import dayjs from 'dayjs';
import { nanoid } from 'nanoid';
import { Cashfree } from 'cashfree-pg';
import { v4 as uuidv4 } from 'uuid';
import config from '../../config/config.js';
import { razorpay } from '../../webhooks/razorPay.js';
import { getPayoutsDao } from '../payOut/payOutDao.js';
import { BankTypes, Currency, Status, Type } from '../../constants/index.js';
import { calculateCommission, calculateDuration } from '../../helpers/index.js';
import {
  merchantPayinCallback,
  merchantPayoutCallback,
} from '../../callBacksAndWebHook/merchantCallBacks.js';
import {
  generatePayInUrlDao,
  updatePayInUrlDao,
  getPayInUrlDao,
  getPayInUrlsDao,
  getPayInsDao,
} from './payInDao.js';
import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from '../../utils/appErrors.js';
import {
  getBankaccountDao,
  getMerchantBankDao,
  updateBanktBalanceDao,
} from '../bankAccounts/bankaccountDao.js';
import {
  getBankResponseDao,
  updateBotResponseDao,
} from '../bankResponse/bankResponseDao.js';
import {
  getMerchantsDao,
  updateMerchantBalanceDao,
} from '../merchants/merchantDao.js';
import {
  getCalculationforCronDao,
  updateCalculationBalanceDao,
} from '../calculation/calculationDao.js';
import { getVendorsDao, updateVendorBalanceDao } from '../vendors/vendorDao.js';
import {
  getImageContentFromOCr,
  getTelegramFilePath,
  getTelegramImageBase64,
} from '../../helpers/index.js';
import {
  sendAlreadyConfirmedMessageTelegramBot,
  sendErrorMessageNoDepositFoundTelegramBot,
  sendErrorMessageNoMerchantOrderIdFoundTelegramBot,
  sendErrorMessageTelegram,
  sendErrorMessageUtrOrAmountNotFoundImgTelegramBot,
  sendMerchantOrderIDStatusDuplicateTelegramMessage,
  sendTelegramMessage,
} from '../../utils/sendTelegramMessages.js';

import { getConnection } from '../../utils/db.js';
import { createCheckUtrService } from '../checkutr/checkUtrServices.js';
import { createResetHistoryService } from '../resetHistory/resetServices.js';
import { updateBankaccountService } from '../bankAccounts/bankaccountServices.js';
import { expirePayInIfNeeded, stringifyJSON } from '../../utils/index.js';
import { createHash } from '../../utils/hashUtils.js';
Cashfree.XClientId = config.cashFreeClientId;
Cashfree.XClientSecret = config.XClientSecret;
Cashfree.XEnvironment = Cashfree.Environment.PRODUCTION;

export const generatePayInUrlByHashService = async (req) => {
  const { user_id, code, ot, key, amount } = req.query;

  if (!user_id || !code || !ot) {
    throw new BadRequestError('Missing required query parameters: user_id, code, or ot');
  }
  const x_api_key = req.headers['x-api-key'];
  const merchantArr = await getMerchantsDao({ code });
  const bankAssigned = await getMerchantBankDao({ config_merchants_contains: merchantArr[0].id });

  if (bankAssigned.length <= 0) {
    throw new InternalServerError('No Bank Assigned to Merchant')
}

  let query = `user_id=${user_id}&code=${code}&ot=${ot}&key=${key}`;
  if (amount) {
    query += `&amount=${amount}`;
  }

  // Create a deterministic hash
  const hash = createHash(`${code}:${x_api_key}`);

  // Encode the hash to make it URL-safe
  const encodedHash = encodeURIComponent(hash);

  const updateRes = {
    payInUrl: `${config.reactPaymentOrigin}/transaction/${encodedHash}?${query}`,
  };
  return updateRes;
}

export const generatePayInUrlService = async (payload, created_by) => {
  const {
    code,
    user_id,
    merchant_order_id: order_id,
    amount,
    returnUrl,
    callbackUrl,
    ot,
    api_key,
    x_api_key,
  } = payload;
  const merchant_order_id = order_id ? order_id : uuidv4();

  const merchantArr = await getMerchantsDao({ code });
  const banks = await getMerchantBankDao({ config_merchants_contains: merchantArr[0].id });

  if (banks.length < 1) {
    throw new NotFoundError('No Bank Assigned to Merchant')
  }
  const merchant = merchantArr[0];
  if (!merchant) {
    throw new NotFoundError('Merchant does not exist');
  }

  const bankAssigned = await getMerchantBankDao({ config_merchants_contains: merchant.id });

  if (bankAssigned.length < 0) {
    throw new InternalServerError('No Bank Assigned to Merchant')
  }

  const merchantAPIKey = merchant.config?.keys;

  if (
    api_key &&
    api_key != merchantAPIKey?.private &&
    api_key != merchantAPIKey?.public
  ) {
    throw new BadRequestError('Enter valid Api key');
  }

  if (
    !api_key &&
    x_api_key != merchantAPIKey?.private &&
    x_api_key != merchantAPIKey?.public
  ) {
    throw new BadRequestError('Enter valid Api key');
  }

  if (amount < merchant.min_payin || amount > merchant.max_payin) {
    throw new BadRequestError(
      `Amount must be between ${merchant.min_payin} and ${merchant.max_payin}`,
    );
  }

  const expirationDate =
    ot === 'y'
      ? dayjs().add(10, 'minutes').toISOString()
      : dayjs().add(30, 'days').toISOString();
  const data = {
    upi_short_code: nanoid(5), // code added by us
    amount: amount || 0, // as starting amount will be zero
    status: Status.INITIATED,
    currency: Currency.INR,
    merchant_order_id, // for time being we are using this
    user: user_id,
    merchant_id: merchant.id,
    expiration_date: expirationDate,
    company_id: merchant.company_id,
    config: JSON.stringify({
      urls: {
        return: returnUrl || merchant.config?.urls?.return || '',
        notify: callbackUrl || merchant.config?.urls?.payin_notify || '',
      },
    }),
    created_by,
  };

  const result = await generatePayInUrlDao(data);
  expirePayInIfNeeded(result.id);
  return result;
};

export const getPayInUrlService = async (id, conn) => {
  const currentTime = Date.now();
  const payIn = await getPayInUrlDao({ merchant_order_id: id });

  if (!payIn) {
    throw new NotFoundError('Payment Url is incorrect');
  }

  if (payIn.is_url_expires) {
    throw new InternalServerError('Url is expired');
  }
  const config = payIn.config || {};
  if (
    currentTime > Number(payIn.expiration_date) &&
    payIn.status !== Status.INITIATED
  ) {
    // expire payIn
    //  const updatedpayin= 
    await updatePayInUrlDao(id, {
      is_url_expires: true,
      status: Status.DROPPED,
    }, conn);
    // Notifying merchant about expired URL
    merchantPayinCallback(config.urls?.payin_notify, {
      status: Status.DROPPED,
      merchantOrderId: payIn.merchant_order_id,
      payinId: payIn.id,
      amount: null,
      req_amount: payIn.amount,
      utr_id: payIn.utr,
    });
    throw new InternalServerError('PayIn Expired');
  }

  return payIn;
};

// TODO: delete this API
export const expirePayInUrlService = async (payInId) => {
  // const currentTime = Date.now();
  const payIn = await getPayInUrlDao({ id: payInId });
  if (!payIn) {
    throw new NotFoundError('PayIn not found!');
  }
  checkIsPayInExpired(payIn);
  const config = payIn.config || {};
  await updatePayInUrlDao(payInId, {
    is_url_expires: true,
    status: Status.DROPPED,
  });

  merchantPayinCallback(config.urls?.payin_notify, {
    status: Status.DROPPED,
    merchantOrderId: payIn.merchant_order_id,
    payinId: payIn.id,
    amount: null,
    req_amount: payIn.amount,
    utr_id: payIn.utr,
  });
};

export const assignedBankToPayInUrlService = async (
  merchantOrderId,
  amount,
  type,
) => {
  // Validate the PayIn URL
  const payIn = await getPayInUrlService(merchantOrderId);
  const payInConfig = payIn.config || {};
  checkIsPayInExpired(payIn);
  if (payIn.status !== Status.INITIATED) {
    throw new BadRequestError('PayIn has been confirmed already!');
  }
  const merchantArr = await getMerchantsDao({ id: payIn.merchant_id });
  const merchant = merchantArr[0] || {};

  if (!merchant) {
    // throw new NotFoundError('No merchant found');
    return { message: `No merchant found` }
  }
  const maxPayIn = Number(merchant.max_payin);
  const minPayIn = Number(merchant.min_payin);
  const amt = Number(amount);

  if (amt >= maxPayIn || amt <= minPayIn) {
    return { message: `Amount must be between ${minPayIn} and ${maxPayIn}` };
  }
  const banks = await getMerchantBankDao({ config_merchants_contains: merchant.id });

  const enabledBanks = banks.filter((bank) => {
    if (bank.is_enabled && (bank.bank_used_for !== 'PayIn' && bank.bank_used_for !== 'payIn')) {
      return false;
    }

    switch (type) {
      case BankTypes.UPI:
        return bank.is_qr;
      case BankTypes.PHONE_PE:
        return bank.config?.is_phone;
      case BankTypes.BANK_TRANSFER:
        return bank.is_bank;
      case BankTypes.INTENT:
        return bank.config?.allow_intent;
      default:
        return false;
    }
  });

  if (!enabledBanks.length) {
    await updatePayInUrlDao(payIn.id, {
      is_url_expires: true,
      status: Status.DROPPED,
    });
    merchantPayinCallback(payInConfig.urls?.payin_notify, {
      status: Status.DROPPED,
      merchantOrderId: payIn.merchant_order_id,
      payinId: payIn.id,
      req_amount: payIn.amount,
      utr_id: payIn.utr,
    });
    throw new NotFoundError(`No enabled bank found!`);
  }
  // Randomly assign one enabled bank account
  const selectedBankDetails =
    enabledBanks[Math.floor(Math.random() * enabledBanks.length)];
  const updatePayIn = await updatePayInUrlDao(payIn.id, {
    amount: parseFloat(amount),
    status: Status.ASSIGNED,
    bank_acc_id: selectedBankDetails.id,
    one_time_used: true,
  });
  // expirePayInIfNeeded(payIn);
  delete updatePayIn.is_obsolete;
  delete updatePayIn.company_id;
  delete selectedBankDetails.is_obsolete;
  delete updatePayIn.company_id;

  Object.assign(updatePayIn, {
    merchant_min_payin: merchant.min_payin,
    merchant_max_payin: merchant.max_payin,
    merchant_code: merchant.code,
    allow_merchant_intent: merchant.allow_intent,
    code: updatePayIn.upi_short_code,
    bank: selectedBankDetails,
  });

  const response = {
    code: updatePayIn.upi_short_code,
    bank: {
      nick_name: selectedBankDetails.nick_name,
      acc_holder_name: selectedBankDetails.acc_holder_name,
      acc_no: selectedBankDetails.acc_no,
      ifsc: selectedBankDetails.ifsc,
    }
  }

  return response;
};

// Public API Used by Merchants
export const checkPayInStatusService = async (
  payInId,
  merchantCode,
  merchantOrderId,
  api_key,
) => {
  const merchantArr = await getMerchantsDao({ code: merchantCode });
  const merchant = merchantArr[0];
  if (!merchant) {
    throw new NotFoundError('Merchant does not exist');
  }

  const merchantConfig = merchant.config || {};
  const payIn = await getPayInUrlDao({
    id: payInId,
    merchant_order_id: merchantOrderId,
  });
  if (!payIn) {
    throw new NotFoundError('payIn not found');
  }

  if (api_key != merchantConfig.keys?.private) {
    throw new BadRequestError('Invalid PayIn!');
  }

  return {
    status: payIn.status,
    merchantOrderId: payIn.merchant_order_id,
    amount: payIn.amount,
    payinId: payIn.id,
  };
};

export const payInIntentGenerateOrderService = async (
  payInId,
  amount,
  isRazorpay,
) => {
  // validating if it exist
  const payIn = await getPayInUrlService(payInId);
  checkIsPayInExpired(payIn);
  if (isRazorpay) {
    const orderRes = await razorpay.orders.create({
      amount: amount * 100,
      currency: Currency.INR,
      receipt: payInId,
    });

    return {
      ...orderRes,
    };
  }

  const requestBody = {
    order_amount: amount,
    order_currency: Currency.INR,
    customer_details: {
      customer_id: 'node_sdk_test',
      customer_email: 'example@gmail.com',
      customer_phone: '9999999999',
    },
    order_meta: {
      return_url:
        'https://test.cashfree.com/pgappsdemos/return.php?order_id={order_id}',
      paymentMethod: 'upi',
    },
  };

  const cashFreeResponse = await Cashfree.PGCreateOrder(
    payInId,
    requestBody,
  ).catch((err) => {
    const data = err?.response?.data || {};
    console.error(data);
    throw new Error('Error while creating CashFree Order');
  });

  return {
    payment_amount: amount,
    cashFreeResponse,
    payInId,
  };
};

export const updatePaymentNotificationStatusService = async (
  payInId,
  type,
  company_id,
) => {
  if (!Object.values(Type).includes(type)) {
    throw new Error('Invalid notification type.');
  }

  if (type === Type.PAYIN) {
    const payIn = await updatePayInUrlDao(payInId, { is_notified: true });
    if (!payIn) {
      throw new Error('Payin data not found.');
    }

    const bankResponse = await getBankResponseDao({
      id: payIn.bank_response_id,
      company_id,
    });

    return await merchantPayinCallback(payIn.config?.urls?.payin_notify, {
      status: payIn.status,
      merchantOrderId: payIn.merchant_order_id,
      payinId: payIn.id,
      req_amount: payIn.amount,
      amount: bankResponse?.amount || null,
      utr_id: payIn.utr || '',
    });
  }

  if (type === Type.PAYOUT) {
    // find on the basis of payoutId
    const payouts = await getPayoutsDao({ id: payInId, company_id });
    const payout = payouts[0];
    if (!payout) {
      throw new NotFoundError('Payout data not found.');
    }

    const merchants = await getMerchantsDao({
      id: payout.merchant_id,
      company_id,
    });
    const merchant = merchants[0];
    if (!merchant || !merchant.config?.urls?.payout_notify) {
      throw new NotFoundError('Merchant or payout notify URL not found.');
    }

    return await merchantPayoutCallback(merchant.config.urls.payout_notify, {
      code: merchant.code,
      merchantOrderId: payout.merchant_order_id,
      payoutId: payout.id,
      amount: payout.amount,
      status: payout.status,
      utr_id: payout.utr_id || '',
    });
  }

  return {};
};

export const updateDepositStatusService = async (
  conn,
  merchantOrderId,
  nick_name,
  company_id,
  updated_by,
) => {
  const payInData = await getPayInUrlDao({
    merchant_order_id: merchantOrderId,
    company_id,
  });
  if (!payInData) {
    throw new NotFoundError('PayIn data not found');
  }
  const merchants = await getMerchantsDao({
    id: payInData.merchant_id,
    company_id,
  });

  // need to check pay in is for merchant or vendor
  const merchant = merchants[0];

  if (!merchant) {
    throw new NotFoundError('No merchant found against payIn');
  }

  if (payInData.status !== Status.BANK_MISMATCH) {
    throw new BadRequestError('Status is not BANK_MISMATCH, no update applied');
  }

  //call the Bank Res API
  const bankResponse = await getBankResponseDao({
    id: payInData.bank_response_id,
    company_id,
  });
  if (!bankResponse) {
    throw new NotFoundError('No bank response found!');
  }
  const duration = calculateDuration(payInData.created_at);

  const banks = await getBankaccountDao({ nick_name, company_id });
  const bank = banks[0];

  if (!bank) {
    throw new NotFoundError('Bank not found!');
  }

  const vendors = await getVendorsDao({
    user_id: bank.user_id,
    company_id,
  });
  const vendor = vendors[0];
  //calculate the payin commission
  const payinCommission = calculateCommission(
    bankResponse.amount,
    merchant.payin_commission,
  );
  const vendorPayinCommission = calculateCommission(
    bankResponse.amount,
    vendor.payin_commission,
  );

  let successData = [];
  if (bankResponse.is_used) {
    successData = await getOtherSuccessPayIns(bankResponse);
  }

  const updatePayInData = {
    status:
      bank.nick_name != nick_name
        ? Status.BANK_MISMATCH
        : successData.length
          ? Status.DUPLICATE
          : parseFloat(bankResponse.amount) !== parseFloat(payInData.amount)
            ? Status.DISPUTE
            : Status.SUCCESS,
    bank_acc_id: bank.id,
    duration: duration,
    updated_by,
  };

  if (updatePayInData.status === Status.SUCCESS) {
    updatePayInData.payin_merchant_commission = payinCommission;
    updatePayInData.payin_vendor_commission = vendorPayinCommission;
    updatePayInData.bank_acc_id = bankResponse.bank_id;
    // update merchant caclulation table
    await updateCalculationTable(
      merchant.user_id,
      {
        amount: payInData.amount,
        payinCommission: payinCommission
      },
      conn,
    );

    // update vendor caclulation table
    await updateCalculationTable(
      bank.user_id,
      {
        amount: payInData.amount,
        payinCommission: vendorPayinCommission
      },
      conn,
    );

    // update merchant balance
    await updateMerchantBalanceDao(
      { id: merchant.id },
      payInData.amount,
      updated_by,
      conn,
    );

    // update vendor balance
    await updateVendorBalanceDao(
      { user_id: bank.user_id },
      payInData.amount,
      updated_by,
      conn,
    );
  }

  const updatePayInRes = await updatePayInUrlDao(
    payInData.id,
    updatePayInData,
    conn,
  );

  await updateBotResponseDao({ id: bank.id }, { is_used: true }, conn);

  // update bank balance and today balance
  const bankBalance =
    updatePayInData.status === Status.DISPUTE
      ? bankResponse.amount
      : payInData.amount;
  await updateBanktBalanceDao({ id: bank.id }, bankBalance, updated_by, conn);
  await updateBankaccountService(conn, { id: bank.id, company_id: payInData.company_id }, {});

  merchantPayinCallback(updatePayInRes.config?.urls?.payin_notify, {
    status: updatePayInRes.status,
    merchantOrderId: updatePayInRes.merchant_order_id,
    payinId: updatePayInRes.id,
    req_amount: payInData.amount,
    amount: bankResponse.amount,
    utr_id: updatePayInRes.user_submitted_utr || '',
  });

  return;
};

export const resetDepositService = async (
  conn,
  merchant_order_id,
  company_id,
  updated_by,
) => {
  const payIn = await getPayInUrlDao({ merchant_order_id: merchant_order_id, company_id: company_id });
  if (!payIn) {
    throw new NotFoundError('PayIn not found');
  }
  createResetHistoryService({
    payin_id: payIn.id,
    pre_status: payIn.status,
    created_by: updated_by,
    updated_by,
    company_id,
  });

  const nonResettableStatuses = new Set([
    Status.SUCCESS,
    Status.FAILED,
    Status.ASSIGNED,
    Status.DROPPED,
    Status.INITIATED,
  ]);

  if (nonResettableStatuses.has(payIn.status)) {
    return { error: `The Order Id: ${payIn.merchant_order_id} with Status: ${payIn.status} cannot be reset!` };
  }

  const condition = {
    company_id,
  };
  if (payIn.bank_response_id) {
    condition.id = payIn.bank_response_id;
  } else {
    condition.utr = payIn.user_submitted_utr;
  }
  const bankResponse = await getBankResponseDao(condition);

  const updatePayInData = {
    status: calculateStatus(payIn.created_at),
    payin_merchant_commission: null,
    user_submitted_utr: null,
    duration: null,
    updated_by,
  };

  if (bankResponse && bankResponse.is_used) {
    // check if any entry exists
    const payInSuccess = await getOtherSuccessPayIns(bankResponse);
    if (!payInSuccess.length) {
      await updateBotResponseDao(
        { id: bankResponse.id },
        { is_used: false },
        conn,
      );
    }
  }

  // update bank balance
  const banks = await getBankaccountDao({ id: payIn.bank_acc_id });
  const bank = banks[0];

  if (bank && payIn.status !== Status.PENDING && bankResponse) {
    await updateBanktBalanceDao(
      { id: bank.id },
      bankResponse.amount,
      updated_by,
      conn,
    );
    await updateBankaccountService(conn, { id: bank.id, company_id: payIn.company_id }, {});
  }
  return await updatePayInUrlDao(payIn.id, updatePayInData, conn);
};

const calculateStatus = (createdAt) => {
  const TEN_MINUTES_IN_MS = 10 * 60 * 1000;
  const currentTime = new Date();
  const createdTime = new Date(createdAt);
  const timeDifference = currentTime - createdTime;

  return timeDifference > TEN_MINUTES_IN_MS ? Status.DROPPED : Status.ASSIGNED;
};

export const getPayinsService = async (company_id, page, limit, filters, role) => {
  let conn;
  try {
    conn = await getConnection();
    return await getPayInsDao(filters, company_id, page, limit, role);
  } catch (error) {
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

export const processPayInService = async (conn, payload, updated_by) => {
  const { userSubmittedUtr, merchantOrderId, amount } = payload;
  // validate payIn
  // throw error if not exist or expires
  const payIn = await getPayInUrlService(merchantOrderId, conn);
  const banks = await getBankaccountDao({ id: payIn.bank_acc_id, company_id: payIn.company_id });
  const bank = banks[0];

  if (!bank) {
    throw new NotFoundError('Bank not found!');
  }

  const duration = calculateDuration(payIn.created_at);
  const otherPayIns = await getPayInUrlsDao({
    user_submitted_utr: userSubmittedUtr,
  });
  const updatePayInData = {
    amount,
    user_submitted_utr: userSubmittedUtr,
    is_url_expires: true,
    one_time_used: true,
    duration,
    user_submitted_image: null,
    is_notified: true,
    updated_by: updated_by || '',
  };
  let bankResponse = {};
  if (payIn.bank_response_id) {
    bankResponse =
      (await getBankResponseDao({ id: payIn.bank_response_id })) || {};
  }
  const result = {
    status: payIn.status,
    merchantOrderId: payIn.merchant_order_id,
    payinId: payIn.id,
    amount: bankResponse.amount,
    req_amount: payIn.amount,
    utr_id: payIn.user_submitted_utr,
  };

  if (
    [
      Status.SUCCESS,
      Status.DUPLICATE,
      Status.DISPUTE,
      Status.BANK_MISMATCH,
    ].includes(payIn.status)
  ) {
    if (payIn.status === Status.DUPLICATE) {
      result.utr_id = bankResponse.utr || payIn.user_submitted_utr;
    }
    merchantPayinCallback(payIn.config?.urls?.payin_notify, result);
    return result;
  }

  if (otherPayIns.length || bankResponse.is_used) {
    updatePayInData.status = Status.DUPLICATE;
    result.status = Status.DUPLICATE;
    await updatePayInUrlDao(payIn.id, updatePayInData, conn);
    merchantPayinCallback(payIn.config?.urls?.payin_notify, result);
    return {
      ...result,
      message: 'Duplicate entry found!',
    };
  }

  if (!bankResponse || Object.keys(bankResponse).length === 0) {
    bankResponse = (await getBankResponseDao({ utr: userSubmittedUtr })) || {};
  }


  if (bankResponse.id) {
    await updateBotResponseDao(
      bankResponse.id,
      { is_used: true },
      conn,
    );
  }

  if (bankResponse.bank_id && bankResponse.bank_id !== payIn.bank_acc_id) {
    updatePayInData.status = Status.BANK_MISMATCH;
    updatePayInData.bank_response_id = bankResponse.id;
    updatePayInData.approved_at = new Date().toISOString();
    result.status = Status.BANK_MISMATCH;
    await updatePayInUrlDao(payIn.id, updatePayInData, conn);
    merchantPayinCallback(payIn.config?.urls?.payin_notify, result);
    return {
      ...result,
      message: 'Bank Mismatched',
    };
  }

  if (bankResponse.id) {
    updatePayInData.status =
      parseFloat(amount) === parseFloat(bankResponse.amount)
        ? Status.SUCCESS
        : Status.DISPUTE;
    updatePayInData.bank_response_id = bankResponse.id;
    updatePayInData.approved_at = new Date().toISOString();
    result.amount = bankResponse.amount;
  } else {
    updatePayInData.status = Status.PENDING;
  }

  result.status = updatePayInData.status;

  if (updatePayInData.status === Status.SUCCESS) {
    // update merchant balance
    await updateMerchantBalanceDao(
      { id: payIn.merchant_id },
      bankResponse.amount,
      updated_by,
      conn,
    );
    // update vendor balance
    await updateVendorBalanceDao(
      { user_id: bank.user_id },
      bankResponse.amount,
      updated_by,
      conn,
    );

    const commissions = await calculateCommissions(payIn.merchant_id, bank.user_id, bankResponse.amount);
    const merchantCommission = commissions.payin_merchant_commission;
    const vendorCommission = commissions.payin_vendor_commission;
    updatePayInData.payin_merchant_commission = merchantCommission;
    updatePayInData.payin_vendor_commission = vendorCommission;
    const merchant = await getMerchantsDao({ id: payIn.merchant_id });
    await updateCalculationTable(merchant.user_id, {
      merchantCommission,
      amount: bankResponse.amount,
    });
    await updateCalculationTable(
      bankResponse.user_id,
      {
        payinCommission: vendorCommission,
        amount: bankResponse.amount,
      },
      conn,
    );
  }

  // if (updatePayInData.status === Status.DISPUTE) {
  // update bank balance
  updated_by = updated_by ? updated_by : bank.updated_by,
    await updateBanktBalanceDao(
      { id: bank.id },
      payIn.amount,
      updated_by,
      conn,
    );
  await updateBankaccountService(conn, { id: bank.id, company_id: payIn.company_id }, {});
  // }

  await updatePayInUrlDao(payIn.id, updatePayInData, conn);
  merchantPayinCallback(payIn.config?.urls?.payin_notify, result);
  return result;
};

const calculateCommissions = async (merchantId, vendorId, amount) => {
  const merchant = await getMerchantsDao({ id: merchantId });
  const vendor = await getVendorsDao({ user_id: vendorId });

  return {
    payin_merchant_commission: calculateCommission(amount, merchant[0]?.payin_commission),
    payin_vendor_commission: calculateCommission(amount, vendor[0]?.payin_commission)
  };
};

export const telegramResponseService = async (conn, message) => {
  const { photo } = message;
  const TELEGRAM_BOT_TOKEN = config.telegramOcrBotToken;

  if (!photo) {
    console.error('No Telegram Message Photo found!', message);
    return;
  }

  const lastPhoto = Array.isArray(photo) ? photo.pop() : photo;
  const filePath = await getTelegramFilePath(lastPhoto?.file_id);
  const image = await getTelegramImageBase64(filePath);
  const content = await getImageContentFromOCr(image);
  sendTelegramMessage(
    message.chat?.id,
    content,
    TELEGRAM_BOT_TOKEN,
    message.message_id,
  );
  if (!content || !content.utr || !content.amount) {
    sendErrorMessageUtrOrAmountNotFoundImgTelegramBot(
      message.chat?.id,
      TELEGRAM_BOT_TOKEN,
      message.message_id,
    );
    return;
  }

  if (!message.caption) {
    sendErrorMessageNoMerchantOrderIdFoundTelegramBot(
      message.chat?.id,
      TELEGRAM_BOT_TOKEN,
      message.message_id,
    );
    return;
  }

  const payIn = await getPayInUrlDao({ merchant_order_id: message.caption });
  const bankResponse = await getBankResponseDao({ utr: content.utr });
  const otheBankResponsePayIns = await getPayInUrlsDao({
    bank_response_id: payIn.bank_response_id,
  });
  const otherUtrPayIns = await getPayInUrlsDao({
    user_submitted_utr: content.utr,
  });

  if (!payIn) {
    sendErrorMessageTelegram(
      message.chat?.id,
      message.caption,
      TELEGRAM_BOT_TOKEN,
      message.message_id,
    );
    return;
  }

  if (!bankResponse) {
    sendErrorMessageNoDepositFoundTelegramBot(
      message.chat?.id,
      content.utr,
      TELEGRAM_BOT_TOKEN,
      message.message_id,
    );
    return;
  }

  if (
    payIn.is_notified &&
    [Status.SUCCESS, Status.BANK_MISMATCH, Status.DISPUTE].includes(
      payIn.status,
    )
  ) {
    sendAlreadyConfirmedMessageTelegramBot(
      message.chat.id,
      content.utr,
      TELEGRAM_BOT_TOKEN,
      message.message_id,
      otherUtrPayIns,
      payIn,
    );
    return;
  }

  if (payIn.status === Status.DISPUTE) {
    sendMerchantOrderIDStatusDuplicateTelegramMessage(
      message.chat.id,
      payIn,
      content.utr,
      TELEGRAM_BOT_TOKEN,
      message.message_id,
      otherUtrPayIns,
    );
    return;
  }

  const duplicateEntry =
    otheBankResponsePayIns.length > 1 ? otheBankResponsePayIns : otherUtrPayIns;
  if (bankResponse.is_used || duplicateEntry.length) {
    sendAlreadyConfirmedMessageTelegramBot(
      message.chat.id,
      content.utr,
      TELEGRAM_BOT_TOKEN,
      message.message_id,
      otherUtrPayIns,
      payIn,
    );
    return;
  }

  await processPayInService(conn, {
    amount: content.amount,
    payIn: payIn.id,
    userSubmittedUtr: content.utr,
  });
};

export const processPayInByImageService = async (conn, payload) => {
  const { base64Image, merchantOrderId } = payload;
  const content = await getImageContentFromOCr(base64Image);
  if (!content) {
    const payInData = await getPayInUrlService(merchantOrderId);
    const payIn = await updatePayInUrlDao(payInData.id, {
      status: Status.IMG_PENDING,
      amount: payload.amount,
      is_url_expires: true,
      one_time_used: true,
      user_submitted_image: payload.fileKey,
    });

    return {
      status: 'Not Found',
      amount: payload.amount,
      merchant_order_id: merchantOrderId,
      return_url: payIn.config?.urls?.return,
    };
  }

  return await processPayInService(conn, {
    ...payload,
    userSubmittedUtr: content.utr,
  });
};

export const disputeDuplicateTransactionService = async (
  conn,
  payload,
  company_id,
  updated_by,
) => {
  const { payInId, merchantOrderId, confirmed, amount } = payload;
  const payIn = await getPayInUrlDao({ id: payInId, company_id });

  if (!payIn) {
    throw new BadRequestError('Invalid PayIn');
  }

  let makeItSuccess = true,
    bankId = payIn.bank_acc_id,
    updateBalance = true,
    isMismatch = false;

  if (payIn.status !== Status.DISPUTE) {
    throw new BadRequestError('PayIn Status is not DISPUTE');
  }

  if (!payIn.bank_response_id) {
    throw new NotFoundError('Bank Response not found!');
  }

  const bankResponse = await getBankResponseDao({
    id: payIn.bank_response_id,
    company_id,
  });
  const merchants = await getMerchantsDao({
    id: payIn.merchant_id,
    company_id,
  });
  const merchant = merchants[0];
  const banks = await getBankaccountDao({ id: bankId, company_id });
  const bank = banks[0];

  if (!bank) {
    throw new NotFoundError('Bank not found!');
  }

  const vendors = await getVendorsDao({
    user_id: bank.user_id,
    company_id,
  });
  const vendor = vendors[0];

  if (!merchant) {
    throw new NotFoundError('Merchant Not Found!');
  }

  const toAmount = confirmed || amount;
  const payinCommission = calculateCommission(
    toAmount,
    merchant.payin_commission,
  );
  const vendorPayinCommission = calculateCommission(
    toAmount,
    vendor.payin_commission,
  );
  const duration = calculateDuration(payIn.created_at);

  if (merchantOrderId) {
    var payInData = await getPayInUrlDao({
      merchant_order_id: merchantOrderId,
    });
    if (!payInData) {
      throw new NotFoundError('PayIn not found against merchant order id');
    }

    if (
      ![
        Status.DUPLICATE,
        Status.PENDING,
        Status.ASSIGNED,
        Status.DISPUTE,
      ].includes(payIn.status)
    ) {
      throw new BadRequestError(
        'PayIn Status is not DUPLICATE, PENDING, ASSIGNED against merchant order id',
      );
    }

    if (payIn.merchant_id != payInData.merchant_id) {
      throw BadRequestError('Merchant Mismatched');
    }

    if (payIn.user_submitted_utr != bankResponse.utr) {
      throw BadRequestError(
        `UTR ${payIn.user_submitted_utr} MisMatches with ${bankResponse.utr} User Submitted UTR `,
      );
    }

    if (merchantOrderId !== payIn.merchant_order_id) {
      makeItSuccess = false;
    }
  }

  if (!makeItSuccess) {
    const newStatus =
      payInData.bank_acc_id != payIn.bank_acc_id
        ? Status.BANK_MISMATCH
        : parseFloat(payInData.amount) != parseFloat(toAmount)
          ? Status.DISPUTE
          : Status.SUCCESS;
    // make new pay in success
    await updatePayInUrlDao(payInData.id, {
      is_url_expires: true,
      one_time_used: true,
      is_notified: true,
      duration,
      status: newStatus,
      updated_by,
    });

    if ([Status.BANK_MISMATCH, Status.SUCCESS].includes(newStatus)) {
      bankId = payInData.bank_acc_id;
      isMismatch = true;
    } else {
      updateBalance = false;
    }

    merchantPayinCallback(payIn.config?.urls?.payin_notify, {
      status: newStatus,
      merchantOrderId: merchantOrderId,
      payinId: payInData.id,
      amount: toAmount,
      req_amount: payInData.amount,
      utr_id: bankResponse.utr,
    });
  }

  const updatePayload = {
    is_url_expires: true,
    one_time_used: true,
    is_notified: true,
    duration,
    updated_by,
  };

  if (makeItSuccess) {
    updatePayload.status = Status.SUCCESS;
    updatePayload.amount = toAmount;
    updatePayload.payin_merchant_commission = payinCommission;
    updatePayload.payin_vendor_commission = vendorPayinCommission;
  } else {
    updatePayload.status = Status.FAILED;
  }

  await updatePayInUrlDao(payIn.id, updatePayload);
  await updateVendorBalanceDao(
    { user_id: bankResponse.user_id },
    toAmount,
    updated_by,
    conn,
  );
  merchantPayinCallback(payIn.config?.urls?.payin_notify, {
    status: updatePayload.status,
    merchantOrderId: payIn.merchant_order_id,
    payinId: payIn.id,
    amount: toAmount,
    req_amount: payIn.amount,
    utr_id: bankResponse.utr,
  });

  if (updateBalance && !isMismatch) {
    await updateMerchantBalanceDao(
      { id: payIn.merchant_id },
      toAmount,
      updated_by,
      conn,
    );
    await updateCalculationTable(merchant.user_id, {
      payinCommission,
      amount: toAmount,
    });
  }

  if (updateBalance) {
    await updateBanktBalanceDao({ id: bankId }, toAmount, updated_by, conn);
    await updateBankaccountService(conn, { id: bank.id, company_id: payIn.company_id }, {});
    await updateCalculationTable(
      bankResponse.user_id,
      {
        payinCommission: vendorPayinCommission,
        amount: toAmount,
      },
      conn,
    );
  }

  // const entryType = oldPayInData.status === 'DUPLICATE' ? 'Duplicate Entry' : 'Dispute Entry';
  // await sendTelegramDisputeMessage(
  //     config?.telegramDuplicateDisputeChatId,
  //     oldPayInData,
  //     duplicateDisputeTransactionRes,
  //     config?.telegramBotToken,
  //     entryType,
  //   );
};

export const telegramCheckUTRService = async (
  conn,
  utr,
  merchant_order_id,
  company_id,
  updated_by,
) => {
  //already sucess bank_mismatch with merchant order id //
  //pending - without/with checkutr - utr //
  //utr doesnt match //
  //dropped- url expire - dropped - amount/bank //

  const bankResponse = await getBankResponseDao({ utr });
  let otherBankResponse = {};
  const payIn = await getPayInUrlDao({ merchant_order_id });

  if (!bankResponse) {
    return { error: `${utr} UTR Does Not match with ${payIn.merchant_order_id} Merchant Order ID` }
  }
  if (!payIn) {
    // throw new NotFoundError('Merchant Order ID not found in Payin');
    return { error: `Merchant Order ID not found in Payin` }

  }
  await createCheckUtrService({
    payin_id: payIn.id,
    utr,
    company_id: company_id,
    created_by: updated_by,
    updated_by,
  });

  if (payIn.status === "DROPPED") {
    await updatePayInUrlDao({ merchant_order_id: merchant_order_id }, { user_submitted_utr: bankResponse.utr })
    return { message: `${utr} paired with ${merchant_order_id}` }
  }

  if (payIn.bank_response_id) {
    otherBankResponse =
      (await getBankResponseDao({ id: payIn.bank_response_id })) || {};
  }

  // check old code flow
  if (payIn.status === Status.SUCCESS) {
    return {
      message: `PayIn is already confirmed with ${payIn.user_submitted_utr || otherBankResponse.utr || ''}`,
    };
  }

  const isAlreadyExit = await getPayInUrlDao({
    bank_response_id: bankResponse.id,
  });

  if (isAlreadyExit) {
    return {
      message: `Utr: ${utr} is ${isAlreadyExit.status} with ${isAlreadyExit.merchant_order_id}`,
    };
  }

  if (![Status.PENDING, Status.ASSIGNED, Status.DROPPED].includes(payIn.status)) {
    return {
      status: payIn.status,
      message: `PayIn is in ${payIn.status} with ${payIn.user_submitted_utr || otherBankResponse.utr || ''}`,
    };
  }
  updatePayInUrlDao({ id: payIn.id }, { is_url_expires: false }, conn)

  return await processPayInService(
    conn,
    {
      userSubmittedUtr: utr,
      // merchantOrderId: payIn.id,
      merchantOrderId: merchant_order_id,
      amount: payIn.amount,
    },
    updated_by,
  );
};

export const getPayinsServiceById = async (id) => {
  return await getPayInUrlDao({ id });
};

export const verifyPayinsService = async (merchantOrderId, user_location) => {
  const payIn = await getPayInUrlService(merchantOrderId);

  if (!payIn) {
    throw new BadRequestError('Invalid merchant order id');
  }

  if (payIn.one_time_used === true) {
    throw new BadRequestError('This payin url is already used');
  }

  const updatedConfig = stringifyJSON({
    ...payIn.config,
    user: user_location,
  });
  const merchant = await getMerchantsDao({ id: payIn.merchant_id });
  await updatePayInUrlDao(payIn.id, { config: updatedConfig, one_time_used: true });
  const result = {
    code: payIn.upi_short_code,
    return_url: config.return_url,
    notify_url: config.notify_url,
    expiryTime: payIn.expiration_date,
    amount: payIn.amount,
    one_time_used: payIn.one_time_used,
    status: payIn.status,
    min_amount: merchant[0].min_payin,
    max_amount: merchant[0].max_payin,
  };
  return result;
};

const checkIsPayInExpired = (payIn) => {
  if (Number(payIn.expiration_date) < Date.now() || payIn.is_url_expires) {
    // throw new BadRequestError('PayIn has been expired already!');
    return { message: `PayIn has been expired already!` }
  }

  return false;
};

const updateCalculationTable = async (user_id, data, conn) => {
  if (user_id) {
    const calculation = await getCalculationforCronDao(user_id);
    if (!calculation[0]) {
      throw new NotFoundError('Calculation not found!');
    }
    const calculationId = calculation[0].id;
    await updateCalculationBalanceDao(
      { id: calculationId },
      {
        total_payin_count: 1,
        total_payin_amount: data.amount,
        total_payin_commission: data.payinCommission,
        current_balance: data.amount,
        net_balance: data.amount,
      },
      conn,
    );
  }
};

const getOtherSuccessPayIns = async (bankResponse, includeSuccess = true) => {
  const extraCondition = {};
  if (includeSuccess) {
    extraCondition.status = Status.SUCCESS;
  }
  let successData = await getPayInUrlsDao({
    bank_response_id: bankResponse.id,
    ...extraCondition,
  });
  if (!successData.length) {
    successData = await getPayInUrlsDao({
      user_submitted_utr: bankResponse.utr,
      ...extraCondition,
    });
  }

  return successData;
};
