import crypto from 'crypto';
import axios from 'axios';
import { logger } from '../utils/logger.js';
import config from '../config/config.js';
import { sendSuccess } from '../utils/responseHandlers.js';

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
const apiKey = config.clickrr.apiKey;
const apiSecret = config.clickrr.apiSecret;

export async function initiateClickrrPayout(payload) {
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
    return response.data.data;
  } catch (error) {
    logger.error(
      'Payout initiation failed:',
      error.response?.data || error.message || error,
    );
    throw error;
  }
}

export async function getClickrrWalletBalance(req, res) {
  try {
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
    return sendSuccess(
      res,
      response.data.data,
      'clickrr wallet balance fetched successfully',
    );
  } catch (error) {
    logger.error(
      'Error fetching Clickrr payout status:',
      error.response?.data || error.message || error,
    );
    throw error;
  }
}
