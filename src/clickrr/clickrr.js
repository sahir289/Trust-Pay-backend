import crypto from 'crypto';
import axios from 'axios';
import { logger } from '../utils/logger.js';
import config from '../config/config.js';
import { sendSuccess } from '../utils/responseHandlers.js';
import { getClickrrDetailsByCompanyIdDao } from '../apis/company/companyDao.js';
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

const baseUrl = config.clickrr.baseUrl;
const initiatePayoutUrl = config.clickrr.initiatePayout;
const walletBalanceUrl = config.clickrr.walletBalance;

export const initiateClickrrPayout = async (payload, company_id) => {
  const newPayload = {
    amount: Number(payload.amount),
    mobileNumber: 9898989898,
    senderName: 'Trust pay',
    accountNumber: payload?.user_bank_details?.account_no,
    beneficiaryName: payload?.user_bank_details?.account_holder_name,
    beneficiaryIfsc: payload?.user_bank_details?.ifsc_code,
    paymentPurpose: 'vendor payment',
    referenceId: payload?.merchant_order_id,
    paymentMode: 'IMPS',
    bankName: payload?.user_bank_details?.bank_name,
  };

  try {
    const clickrrWalletBalance = await getClickrrWalletBalance({ company_id });
    if (clickrrWalletBalance.data.wallet_balance < newPayload.amount) {
      throw new BadRequestError('Insufficient Clickrr wallet balance');
    }
    const clickrrDetails = await getClickrrDetailsByCompanyIdDao(company_id);

    const apiKey = clickrrDetails.api_key;
    const apiSecret = clickrrDetails.api_secret;
    const httpMethod = 'POST';
    const { signature, timestamp } = generateSignature(
      apiKey,
      apiSecret,
      httpMethod,
    );

    const headers = {
      Apikey: apiKey,
      Signature: signature,
      Timestamp: timestamp,
      'Content-Type': 'application/json',
    };

    const url = `${baseUrl}${initiatePayoutUrl}`;
    const response = await axios.post(url, newPayload, { headers });

    logger.log('Clickrr payout initiated successfully:', {
      merchant_order_id: payload?.merchant_order_id,
      data: response.data,
    });

    return response.data.data;
  } catch (error) {
    logger.error(
      'Payout initiation failed:',
      error.response?.data || error.message || error,
    );
    throw error;
  }
}

export async function getClickrrWalletBalance(reqOrParams, res) {
  try {
    const isExpress = !!res; // if res exists then it’s an API route
    const company_id = isExpress
      ? reqOrParams.user?.company_id
      : reqOrParams.company_id;

    // const { company_id } = req.user;
    const clickrrDetails = await getClickrrDetailsByCompanyIdDao(company_id);
    const apiKey = clickrrDetails.api_key;
    const apiSecret = clickrrDetails.api_secret;
    const httpMethod = 'GET';
    const { signature, timestamp } = generateSignature(
      apiKey,
      apiSecret,
      httpMethod,
    );

    const headers = {
      Apikey: apiKey,
      Signature: signature,
      Timestamp: timestamp,
      'Content-Type': 'application/json',
    };

    const url = `${baseUrl}${walletBalanceUrl}`;
    const response = await axios.get(url, { headers });

    const data = response.data.data;
    const successMsg = 'Clickrr wallet balance fetched successfully';
    if (isExpress) {
      return sendSuccess(res, data, successMsg);
    } else {
      return { success: true, message: successMsg, data };
    }
  } catch (error) {
    logger.error(
      'Error fetching Clickrr payout status:',
      error.response?.data || error.message || error,
    );
    throw error;
  }
}

export async function createClickrrPayout(
  payload,
  ids,
  singleWithdrawData,
  bankId,
) {
  let checkClickrr;
  try {
    // Ensure method exists
    if (!payload?.config?.method) {
      throw new Error('Payout method missing in payload');
    }

    if (payload.txnStatus) {
      checkClickrr = {...payload};
      delete payload.txnStatus;
    } else {
      checkClickrr = await initiateClickrrPayout(
        singleWithdrawData,
        ids.company_id,
      );
    }

    const status = checkClickrr.txnStatus;

    payload.bank_acc_id = bankId;

    // Unified status handler
    // switch (true) {
    //   case !status:
    //     payload.status = Status.PENDING;
    //     break;

    //   // regular expression (regex) test to check if the status string contains "success" (case-insensitive).
    //   case /success/i.test(status):
    //     payload.status = Status.APPROVED;
    //     payload.utr_id = transactionResult?.utr || '';
    //     payload.approved_at = new Date().toISOString();
    //     break;

    //   // /failed/ ---- means “look for the word failed” in a string.
    //   // The i after the slash means case-insensitive, so it matches: "Failed" "failed" "FAILED" "fAiLeD", etc.

    //   case /failed/i.test(status):
    //     payload.status = Status.REJECTED;
    //     payload.rejected_reason =
    //       transactionResult?.message || 'Transaction failed';
    //     payload.rejected_at = new Date().toISOString();
    //     break;
    //   default:
    //     payload.status = Status.PENDING;
    //     break;
    // }
    if (!status) {
      payload.status = Status.PENDING;
    } else if (status === 'Success' || status === 'success') {
      (payload.bank_acc_id = bankId), (payload.status = Status.APPROVED);
      payload.utr_id = checkClickrr?.utr_id || '';
      payload.approved_at = new Date().toISOString();
    } else if (status === 'Failed' || status === 'failed') {
      payload.status = Status.REJECTED;
      payload.rejected_reason = checkClickrr?.message || 'Transaction failed';
      payload.rejected_at = new Date().toISOString();
    } else {
      payload.status = Status.PENDING;
    }

    if (!payload.utr_id) {
      payload.utr_id = checkClickrr?.utr_id || '';
    }

    logger.info('Clickrr payout processed successfully:', payload);
    return payload;
  } catch (error) {
    payload.status = Status.REJECTED;
    payload.bank_acc_id = bankId;
    payload.utr_id = checkClickrr?.utr || '';
    payload.rejected_reason =
      error?.response?.data?.message || error.message || 'API call failed';
    payload.rejected_at = new Date().toISOString();

    logger.error('Clickrr payout error:', error.message);
    logger.warn('Clickrr payout error response', payload);
    return payload;
  }
}
