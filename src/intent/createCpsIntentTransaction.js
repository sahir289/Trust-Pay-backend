import crypto from 'crypto';
import axios from 'axios';
import { logger } from '../utils/logger.js';
import config from '../config/config.js';

/**
 * Generate SHA512 hash for a given provider
 * @param {Object} body - The transaction details (amount, order_id, etc.)
 * @param {Object} providerConfig - The provider config containing salt and collectionId.
 */
export function generateSign({ mId, mOrderId, amount, timestamp, secret }) {
  const raw = `${mId}${mOrderId}${amount}${timestamp}${secret}`;
  return crypto.createHash("md5").update(raw).digest("hex");
}
/**
 * Create a payment transaction for a given provider.
 * @param {string} providerKey - Key from config (e.g. "zentechind" or "nmplPay")
 * @param {Object} deposit - Deposit object containing whole payin details
 * @param {number|string} amount - Transaction amount
 */

export const createCpsPaymentTransaction = async (
  providerKey,
  deposit,
  amount
) => {
  console.log(deposit, "ssssssd=====");
  try {
    const providerConfig = config[providerKey];
    if (!providerConfig) {
      throw new Error(`Invalid provider: ${providerKey}`);
    }

    const body = {
      customerName: "Ajay Singh",
      customerMobile: "9876543210",
      customerEmail: "ajaysingh1898@gmail.com",
      amount: deposit.amount || amount,
      registrationID: "CPS-0004"
    };

    if ( !body.amount || !body.registrationID) {
      throw new Error('Invalid transaction data');
    }

    const sign = generateSign({ ...body });
    const requestBody = { ...body, sign };

    const response = await axios.post(`${providerConfig.url}`, requestBody, {
      headers: { 
              'Content-Type': 'application/json',
            },
    });
    console.log(response.data, "responseeeee");
    logger.info(`${providerKey} transaction created:`, {
      requestBody,
      response: response.data,
    });

    return response.data;
  } catch (error) {
    logger.error(`Error creating ${providerKey} transaction:`, {
      error: error.response?.data || error.message || error,
    });
    throw error;
  }
};
