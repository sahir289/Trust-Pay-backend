import crypto from 'crypto';
import axios from 'axios';
import { logger } from '../utils/logger.js';
import config from '../config/config.js';

/**
 * Generate SHA512 hash for a given provider
 * @param {Object} body - The transaction details (amount, order_id, etc.)
 * @param {Object} providerConfig - The provider config containing salt and collectionId.
 */
export const generateHash = (body, providerConfig, tickMerchant) => {
  const { salt, collectionId, tickSalt, tickCollectionId } = providerConfig;
  const { amount, order_id } = body;
  const usedSalt = tickMerchant ? tickSalt : salt;
  const usedCollectionId = tickMerchant ? tickCollectionId : collectionId;
  const stringToHash = `${usedCollectionId}|${amount}|${order_id}|${usedSalt}`;
  return crypto.createHash('sha512').update(stringToHash).digest('hex');
};
/**
 * Create a payment transaction for a given provider.
 * @param {string} providerKey - Key from config (e.g. "zentechind" or "nmplPay")
 * @param {Object} deposit - Deposit object containing whole payin details
 * @param {number|string} amount - Transaction amount
 */

export const createPaymentTransaction = async (
  providerKey,
  deposit,
  amount,
) => {
  try {
    const providerConfig = config[providerKey];
    if (!providerConfig) {
      throw new Error(`Invalid provider: ${providerKey}`);
    }
    let body;
    let tickMerchant = false;

    if ([providerConfig?.nmplPaySpecialMerchant, providerConfig?.nmplPaySpecialMerchant2].includes(deposit?.merchant_code)) {
      tickMerchant = true;
      body = {
        collection_id: providerConfig.tickCollectionId,
        order_id: deposit.merchant_order_id,
        amount,
        user_id: deposit.user,
      };
    } else {
      body = {
        collection_id: providerConfig.collectionId,
        order_id: deposit.merchant_order_id,
        amount,
        user_id: deposit.user,
      };
    }

    const hash = generateHash(body, providerConfig, tickMerchant);
    const requestBody = { ...body, hash };

    const response = await axios.post(providerConfig.url, requestBody, {
      headers: { 'Content-Type': 'application/json' },
    });

    logger.info(`${providerKey} transaction created:`, {
      body,
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
