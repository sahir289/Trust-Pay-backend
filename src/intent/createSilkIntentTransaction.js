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

export const createSilkPaymentTransaction = async (
  providerKey,
  deposit,
  amount
) => {
  try {
    const providerConfig = config[providerKey];
    if (!providerConfig) {
      throw new Error(`Invalid provider: ${providerKey}`);
    }

    const body = {
      mId: providerConfig.silkPayMerchant,
      mOrderId: deposit.merchant_order_id,
      amount: deposit.amount || amount,
      timestamp: Date.now(),
      notifyUrl: providerConfig.silkPayCallbackUrl,
      returnUrl: deposit?.config?.urls?.return || '',
    };

    if ( !body.mId || !body.mOrderId || !body.amount || !body.timestamp) {
      throw new Error('Invalid transaction data');
    }

    const sign = generateSign({ ...body, secret: providerConfig.secret });
    const requestBody = { ...body, sign };

    const response = await axios.post(`${providerConfig.url}transaction/payin/v2`, requestBody, {
      headers: { 
              'Content-Type': 'application/json',
            },
    });

    logger.info(`${providerKey} transaction created:`, {
      requestBody,
      response: response.data,
    });

    return response.data.data;
  } catch (error) {
    logger.error(`Error creating ${providerKey} transaction:`, {
      error: error.response?.data || error.message || error,
    });
    throw error;
  }
};
