import crypto from 'crypto';
import axios from 'axios';
import { logger } from '../utils/logger.js';
import config from '../config/config.js';
import { sendSuccess } from '../utils/responseHandlers.js';
import { getSilkPayDetailsByCompanyIdDao } from '../apis/company/companyDao.js';
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

const baseUrl = config.silkPay.url;
const initiatePayoutUrl = config.silkPay.initiatePayout;
const walletBalanceUrl = config.silkPay.walletBalance;

export const initiateSilkPayPayout = async (payload, company_id) => {
  logger.info('Initiating SilkPay payout with payload:', {
    merchant_order_id: payload?.merchant_order_id,
    amount: payload?.amount,
  });
  try {
    const silkPayWalletBalance = await getSilkPayWalletBalance({ company_id });
    logger.info('Sufficient SilkPay wallet balance:', silkPayWalletBalance?.data);
    if (silkPayWalletBalance?.data?.totalAmount < Number(payload.amount)) {
      throw new BadRequestError('Insufficient SilkPay wallet balance');
    }
    logger.info('Sufficient SilkPay wallet balance:', silkPayWalletBalance?.data?.totalAmount);
    const silkPayDetails = await getSilkPayDetailsByCompanyIdDao(company_id);
    logger.info('SilkPay details fetched for company_id:', silkPayDetails);

    const mId = silkPayDetails.mid;
    const apiSecret = silkPayDetails.api_secret;
    const callbackurl = config.silkPay.silkPayPayoutCallbackUrl;

    function generateSign({ mId, mOrderId, amount, timestamp, secret }) {
      const raw = `${mId}${mOrderId}${amount}${timestamp}${secret}`;
      return crypto.createHash("md5").update(raw).digest("hex");
    }
    const generatepayload = {
      mId: mId,
      mOrderId: payload?.merchant_order_id,
      amount: payload?.amount,
      timestamp: Date.now(),
      secret: apiSecret
    }
        const sign = generateSign(generatepayload);

    const newPayload = {
      amount: Number(payload.amount),
      mId: mId,
      mOrderId: payload?.merchant_order_id,
      timestamp: Date.now(),
      notifyUrl: callbackurl,
      upi: "",
      bankNo: payload?.user_bank_details?.account_no,
      ifsc: payload?.user_bank_details?.ifsc_code,
      name: payload?.user_bank_details?.account_holder_name,
      sign: sign
    }

    logger.info('SilkPay payout request payload:', newPayload);

    const url = `${baseUrl}${initiatePayoutUrl}`;
    logger.info('SilkPay payout request URL:', url);
    const response = await axios.post(url, newPayload);
    
    // FIX: Only log essential response data, NOT the entire response object
    logger.info('SilkPay payout response:', {
      status: response.status,
      statusText: response.statusText,
      data: response.data,
    });
    
    logger.info('SilkPay payout initiated successfully:', {
      merchant_order_id: payload?.merchant_order_id,
      responseData: response.data,
    });

    return response.data.data;
  } catch (error) {
    // FIX: Only log essential error data
    logger.error('Payout initiation failed:', {
      message: error.message,
      status: error.response?.status,
      responseData: error.response?.data,
    });
    throw error;
  }
}


export async function getSilkPayWalletBalance(reqOrParams, res) {
  try {
    const isExpress = !!res; // if res exists then it’s an API route
    const company_id = isExpress
      ? reqOrParams.user?.company_id
      : reqOrParams.company_id;

    const silkPayDetails = await getSilkPayDetailsByCompanyIdDao(company_id);
    const mId = silkPayDetails.mid;
    const secret = silkPayDetails.api_secret;
    const timestamp = Date.now();

    const url = `${baseUrl}${walletBalanceUrl}`;
    function generateSign({ mId, timestamp, secret }) {
      const raw = `${mId}${timestamp}${secret}`;
      return crypto.createHash("md5").update(raw).digest("hex");
    }
        const sign = generateSign({ mId: mId, timestamp: timestamp, secret: secret });
        const requestBody = { mId: mId, timestamp: timestamp, sign };
    const response = await axios.post(url, requestBody);
    
    // FIX: Only log essential response data
    logger.info('SilkPay wallet balance response:', {
      status: response.status,
      data: response.data,
    });
    
    if (response.data.message !== "success") {
      logger.error('Error fetching SilkPay wallet balance:', response.data.message);
      // throw new BadRequestError(response.data.mess);
    }
    logger.log('SilkPay wallet balance response:', response.data);
    const data = response?.data?.data;
    const successMsg = ' wallet balance fetched successfully';
    if (isExpress) {
      return sendSuccess(res, data, successMsg);
    } else {
      return { success: true, message: successMsg, data };
    }
  } catch (error) {
    // FIX: Only log essential error data
    logger.error('Error fetching SilkPay wallet balance:', {
      message: error.message,
      status: error.response?.status,
      responseData: error.response?.data,
    });
    throw error;
  }
}

export async function createSilkPayPayout(
  payload,
  ids,
  singleWithdrawData,
  bankId,
) {
  let checkSilkPay;
  try {
    // Ensure method exists
    if (!payload?.config?.method) {
      throw new Error('Payout method missing in payload');
    }
    logger.info('Creating SilkPay payout with payload:', payload);
    if (payload.status) {
      checkSilkPay = {...payload};
      delete payload.status;
    } else {
      checkSilkPay = await initiateSilkPayPayout(
        singleWithdrawData,
        ids.company_id,
      );
    }

    const status = checkSilkPay?.Status || checkSilkPay?.status;

    payload.bank_acc_id = bankId;

    if (status === 'Pending' || status === 'pending' || status === Status.PENDING) {
      payload.status = Status.PENDING;
    } else if (status === 'Success' || status === 'success' || status === Status.SUCCESS || status === Status.APPROVED) {
      (payload.bank_acc_id = bankId), (payload.status = Status.APPROVED);
      payload.utr_id = checkSilkPay?.utr_id || '';
      payload.approved_at = new Date().toISOString();
    } else if (status === 'reversed' || status === Status.REVERSED) {
      payload.status = Status.REVERSED;
      payload.rejected_at = new Date().toISOString();
    } else if (status === 'Failed' || status === 'failed' || status === Status.FAILED) {
      payload.status = Status.REJECTED;
      payload.rejected_reason = checkSilkPay?.Message || 'Transaction failed';
      payload.rejected_at = new Date().toISOString();
    } else {
      payload.status = Status.PENDING;
    }

    if (!payload.utr_id) {
      payload.utr_id = checkSilkPay?.utr || '';
    }

    logger.info('SilkPay payout processed successfully:', payload);
    return payload;
  } catch (error) {
    payload.status = Status.REJECTED;
    payload.bank_acc_id = bankId;
    payload.utr_id = checkSilkPay?.utr || '';
    payload.rejected_reason =
      error?.response?.data?.message || error.message || 'API call failed';
    payload.rejected_at = new Date().toISOString();

    logger.error('SilkPay payout error:', error.message);

    logger.warn('SilkPay payout error response', payload);
    return payload;
  }
}
