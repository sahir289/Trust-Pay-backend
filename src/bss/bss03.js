import crypto from 'crypto';
import axios from 'axios';
import { logger } from '../utils/logger.js';
import config from '../config/config.js';
import { sendSuccess } from '../utils/responseHandlers.js';
import { getBSS03DetailsByCompanyIdDao } from '../apis/company/companyDao.js';
import { Status } from '../constants/index.js';
import { BadRequestError } from '../utils/appErrors.js';

/**
 * Generate an HMAC-SHA256 signature for API authentication.
 * @param {string} apiKey - API key.
 * @param {string} apiSecret - API secret.
 * @param {string} method - HTTP method (e.g., 'POST', 'GET').
 * @param {number} [timestamp=Math.floor(Date.now() / 1000)] - Optional custom timestamp.
 * @returns {{ signature: string, timestamp: number }}
 */

export function generateSignature(
  apiKey,
  apiSecret,
  method,
  timestamp = Math.floor(Date.now() / 1000),
) {
  const stringToSign = `${timestamp}|${method}|${apiKey}`;
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(stringToSign)
    .digest('hex');

  return { signature, timestamp };
}

/**
 * Initiate a payout request to Clickrr API.
 * @param {object} payload - Payout request data.
 * @param {string} apiKey - API key.
 * @param {string} apiSecret - API secret.
 * @returns {Promise<object>} - API response.
 */

const baseUrl = config.bss03.baseUrl;
const initiatePayoutUrl = config.bss03.initiatePayout;
const walletBalanceUrl = config.bss03.walletBalance;

export const initiateBSS03Payout = async (payload, company_id) => {
  logger.info('Initiating BSS03 payout with payload:', payload);
  try {
    const bss03WalletBalance = await getBSS03WalletBalance({ company_id });
    logger.info('Sufficient BSS03 wallet balance:', bss03WalletBalance.data);
    if (bss03WalletBalance?.data?.Balance < Number(payload.amount)) {
      throw new BadRequestError('Insufficient BSS wallet balance');
    }
    const bss03Details = await getBSS03DetailsByCompanyIdDao(company_id);
    logger.info('BSS03 details fetched for company_id:', bss03Details);

    const apiKey = bss03Details.api_key;
    const apiSecret = bss03Details.api_secret;

    const newPayload ={
      APIID: apiKey,
      Token: apiSecret,
      MethodName: "payout",
      Amount: Number(payload.amount),
      Accountno: payload?.user_bank_details?.account_no,
      Mobile: 9898989898,
      IFSC: payload?.user_bank_details?.ifsc_code,
      Name: payload?.user_bank_details?.account_holder_name,
      BankName: payload?.user_bank_details?.bank_name,
      Mode: "IMPS",
      OrderID: payload?.merchant_order_id,
      IP: "::1",
      Latitude: 26.78,
      Longitude: 26.78
  }
    logger.info('BSS03 payout request payload:', newPayload);

    const url = `${baseUrl}${initiatePayoutUrl}`;
    logger.info('BSS03 payout request URL:', url);
    const response = await axios.post(url, newPayload);
    logger.log(response, "bss03 payout response");
    logger.log('BSS03 payout initiated successfully:', {
      merchant_order_id: payload?.merchant_order_id,
      data: response.data,
    });

    return response.data.data;
  } catch (error) {
    logger.error(
      'BSS03 payout initiation failed:',
      error.response?.data || error.message || error,
    );
    throw error;
  }
}


export async function getBSS03WalletBalance(reqOrParams, res) {
  try {
    const isExpress = !!res; // if res exists then it’s an API route
    const company_id = isExpress
      ? reqOrParams.user?.company_id
      : reqOrParams.company_id;

    const bssDetails = await getBSS03DetailsByCompanyIdDao(company_id);
    const apiKey = bssDetails.api_key;
    const apiSecret = bssDetails.api_secret;
    const MethodName = 'balance';

    const url = `${baseUrl}${walletBalanceUrl}`;
    const response = await axios.post(url, { APIID: apiKey, Token: apiSecret, MethodName: MethodName });
    if (response.data.code === "ERR") {
      logger.error('Error fetching BSS03 wallet balance:', response.data.mess);
      // throw new BadRequestError(response.data.mess);
    }
    logger.log('BSS03 wallet balance response:', response.data);
    const data = response?.data?.data;
    const successMsg = 'BSS03 wallet balance fetched successfully';
    logger.log(successMsg, data);
    if (isExpress) {
      return sendSuccess(res, data, successMsg);
    } else {
      return { success: true, message: successMsg, data };
    }
  } catch (error) {
    logger.error(
      'Error fetching BSS03 payout status:',
      error.response?.data || error.message || error,
    );
    throw error;
  }
}

export async function createBSS03Payout(
  payload,
  ids,
  singleWithdrawData,
  bankId,
) {
  let checkBSS;
  try {
    // Ensure method exists
    if (!payload?.config?.method) {
      throw new Error('Payout method missing in payload');
    }
    logger.info('Creating BSS03 payout with payload:', payload);
    if (payload.status) {
      checkBSS = {...payload};
      delete payload.status;
    } else {
      checkBSS = await initiateBSS03Payout(
        singleWithdrawData,
        ids.company_id,
      );
    }

    const status = checkBSS?.Status || checkBSS?.status;

    payload.bank_acc_id = bankId;

    if (status === 'Pending' || status === 'pending' || status === 'PENDING') {
      payload.status = Status.PENDING;
    } else if (status === 'Success' || status === 'success' || status === Status.SUCCESS || status === Status.APPROVED) {
      (payload.bank_acc_id = bankId), (payload.status = Status.APPROVED);
      payload.utr_id = checkBSS?.utr_id || '';
      payload.approved_at = new Date().toISOString();
    } else if (status === 'Failed' || status === 'failed' || status === Status.FAILED) {
      payload.status = Status.REJECTED;
      payload.rejected_reason = checkBSS?.Message || 'Transaction failed';
      payload.rejected_at = new Date().toISOString();
    } else {
      payload.status = Status.PENDING;
    }

    if (!payload.utr_id) {
      payload.utr_id = checkBSS?.utr || '';
    }

    logger.info('BSS03 payout processed successfully:', payload);
    return payload;
  } catch (error) {
    payload.status = Status.REJECTED;
    payload.bank_acc_id = bankId;
    payload.utr_id = checkBSS?.utr || '';
    payload.rejected_reason =
      error?.response?.data?.message || error.message || 'API call failed';
    payload.rejected_at = new Date().toISOString();

    logger.error('BSS03 payout error:', error.message);
    return payload;
  }
}
