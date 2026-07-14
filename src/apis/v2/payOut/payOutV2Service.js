import { getClickrrWalletBalance } from "../../../clickrr/clickrr.js";
import { Role, tableName } from "../../../constants/index.js";
import { getPayAssistWalletBalance } from "../../../payassist/payassist.js";
import { getRunsafePayWalletBalance } from "../../../runsafe/runsafepay.js";
import { BadRequestError, CustomError, NotFoundError } from "../../../utils/appErrors.js";
import { beginTransaction, commit, getConnection, rollback } from "../../../utils/db.js";
import { stringifyJSON } from "../../../utils/index.js";
import logger from "../../../utils/logger.js";
import { emitTableEntryAsync } from "../../../utils/socket/sessionUtils.js";
import { getCalculationDao } from "../../calculation/calculationDao.js";
import { getMerchantsByAuthCodeDao, getMerchantsByCodeDao, getMerchantsDao } from "../../merchants/merchantDao.js";
import { createPayoutDao, getPayoutsDao } from "../../payOut/payOutDao.js";
import { _updatePayoutServiceInternal, ekoWalletBalanceEnquiryInternally } from "../../payOut/payOutService.js";
import { getLatestNetBalanceByMerchantUserIdDao } from "../../walletBalance/walletBalanceDao.js";
import { v4 as uuidv4 } from 'uuid';

// Public API Used by Merchants
export const checkPayOutStatusV2Service = async (
  merchantCode,
  merchantOrderId,
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
      throw new BadRequestError('Merchant does not exist');
    }

    const payOut = await getPayoutsDao(
      {
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
      throw new NotFoundError('Payout not found');
    }

    //check is payout detials belongs to that merchant or not
    if (!(payOut[0].merchant_id === merchant.id)) {
      throw new NotFoundError(
        'merchant_order_id does not belong to the specified merchant',
      );
    }
    return {
      status: payOut[0].status,
      merchantOrderId: payOut[0].merchant_order_id,
      amount: payOut[0].amount,
      payoutId: payOut[0].id,
      utrId: payOut[0].utr_id ? payOut[0].utr_id : ' ',
    };
  } catch (error) {
    logger.error('Error check payout status:', error);
    throw error;
  }
};

export const getWalletBalanceService = async (code) => {
  try {
    // Merchant auth -> fetch merchant/user_id
    const merchant = await getMerchantsByAuthCodeDao(code);

    if (!merchant) {
      throw new NotFoundError('Invalid merchant code');
    }

    const netBalance = await getLatestNetBalanceByMerchantUserIdDao(
      merchant.user_id,
    );

    if (netBalance === null || netBalance === undefined) {
      return { balance: 0 };
    }
    return { balance: netBalance };
  } catch (error) {
    console.error('Error in getWalletBalanceService:', error);
    throw error;
  }
};

export const createPayoutV2Service = async (headers, payload, role, fromUI) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const data = await _createPayoutServiceV2Internal(
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


const _createPayoutServiceV2Internal = async (
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
      throw new CustomError(461, 'Merchant balance is less than payout amount');
      
    }

    const { config, user_id } = details[0];
    // const merchantAPIKey = config?.keys;
    const payoutAmount = Number(amount);
    const balanceRestriction = config.balanceRestriction;
    const merchant_order_id = payload.merchantOrderId ?? uuidv4();
    delete payload._merchantData;
    delete payload.code;
    payload.merchant_id = details[0].id;
    payload.merchant_order_id = merchant_order_id;
    payload.acc_no = payload.accountNumber
    payload.acc_holder_name = payload.accountHolderName
    payload.ifsc_code = payload.ifscCode
    payload.bank_name = payload.bankName  

    delete payload.accountNumber
    delete payload.accountHolderName
    delete payload.ifscCode
    delete payload.bankName
    delete payload.merchantOrderId
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

       throw new CustomError(461, `Amount should be between ${details[0].min_payout} and ${details[0].max_payout}`);
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
        throw new CustomError(461, 'Insufficient Balance to create Payout');
      }
      const ekoBalanceEnquiry = await ekoWalletBalanceEnquiryInternally();
      if (Number(ekoBalanceEnquiry.data.balance) < payoutAmount) {
        throw new CustomError(461, 'Insufficient Balance in Wallet');
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

