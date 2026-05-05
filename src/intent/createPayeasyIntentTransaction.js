import axios from 'axios';
import { logger } from '../utils/logger.js';
import config from '../config/config.js';

/**
 * Create a payment transaction for a given provider.
 * @param {string} providerKey - Key from config (e.g. "zentechind" or "nmplPay")
 * @param {Object} deposit - Deposit object containing whole payin details
 * @param {number|string} amount - Transaction amount
 */

export const createPayeasyTransaction = async (
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
      clientId: providerConfig.payeasyClientId,
      phone: deposit.customer_phone || '',
      amount: parseFloat(deposit.amount || amount),
      orderId: deposit.merchant_order_id,
      redirectUrl: deposit?.config?.urls?.return || '',
      initiated: 'api',
    };

    if (!body.clientId || !body.orderId || !body.amount) {
      throw new Error('Invalid transaction data');
    }

    const response = await axios.post(`${providerConfig.url}account/create-payment-link`, body, {
      headers: { 
        'Content-Type': 'application/json',
      },
    });

    logger.info(`${providerKey} transaction created:`, {
      requestBody: body,
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
