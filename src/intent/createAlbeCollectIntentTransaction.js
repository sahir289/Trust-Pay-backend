import crypto from 'crypto';
import axios from 'axios';
import { logger } from '../utils/logger.js';
import config from '../config/config.js';

/**
 * Generate hash for AlbeCollect
 * @param {string} mid - Merchant ID
 * @param {Object} parameters - Request fields (hash key excluded)
 * @param {string} hashingMethod - Hash algorithm (default: sha512)
 * @param {string} secretKey - Merchant Secret Key
 * @returns {string|null}
 */
export function generateAlbeCollectHash(mid, parameters, hashingMethod = 'sha512', secretKey) {
  let hashData = mid;
  for (const key in parameters) {
    if (key !== 'hash') {
      hashData += '|' + parameters[key];
    }
  }
  hashData += '|' + secretKey;
  if (hashData.length > 0) {
    return crypto.createHash(hashingMethod).update(hashData).digest('hex').toLowerCase();
  }
  return null;
}

/**
 * Create a payment transaction via AlbeCollect
 * @param {string} providerKey - Key from config (e.g. "albeCollect")
 * @param {Object} deposit - Deposit object containing whole payin details
 * @param {number|string} amount - Transaction amount
 */
export const createAlbeCollectTransaction = async (providerKey, deposit, amount) => {
  try {
    const providerConfig = config[providerKey];
    if (!providerConfig) {
      throw new Error(`Invalid provider: ${providerKey}`);
    } 
    const { mid, secretKey, url } = providerConfig;
    const formattedAmount = parseFloat(deposit.amount || amount).toFixed(2);

    const requestBody = {
      name: deposit.user || 'Customer',
      mobileNumber: deposit.customer_phone || 1234567897,
      email: deposit.customer_email || 'pay@getMaxListeners.com',
      amount: formattedAmount,
      remarks: 'Payin',
    };

    const hash = generateAlbeCollectHash(
      mid,
      requestBody,
      'sha512',
      secretKey,
    );

    requestBody.hash = hash;

    const response = await axios.post(url, requestBody, {
      headers: {
        merchantID: mid,
        secretkey: secretKey,
        'Content-Type': 'application/json',
      },
    });

    logger.info(`${providerKey} transaction  :`, {
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
