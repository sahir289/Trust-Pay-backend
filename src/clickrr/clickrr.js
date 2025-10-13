import crypto from 'crypto';
import axios from 'axios';
import { logger } from '../utils/logger.js';
import config from '../config/config.js';
// import { sendSuccess } from '../utils/responseHandlers.js';

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

export async function initiateClickrrPayout(payload) {
  console.log(payload, 'payload');
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

  const baseUrl = config.clickrr.baseUrl;
  const initiatePayout = config.clickrr.initiatePayout;
  const apiKey = config.clickrr.apiKey;
  const apiSecret = config.clickrr.apiSecret;
  try {
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

    const url = `${baseUrl}${initiatePayout}`;
    const response = await axios.post(url, newPayload, { headers });
    console.log(response.data, 'response.data');
    // return sendSuccess(res, response.data, 'Payout initiated successfully');
    return response.data.data;
  } catch (error) {
    logger.error(
      'Payout initiation failed:',
      error.response?.data || error.message,
    );
    throw error;
  }
}
