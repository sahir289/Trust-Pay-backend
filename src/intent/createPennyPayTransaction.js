import axios from 'axios';
import { logger } from '../utils/logger.js';
import config from '../config/config.js';

export const createPennyPayTransaction = async (providerKey, deposit, amount) => {
  try {
    const providerConfig = config[providerKey];
    if (!providerConfig) throw new Error(`Invalid provider: ${providerKey}`);
    const baseUrl = providerConfig.payinUrl;
    const secretKey = providerConfig.secretKey;
    if (!baseUrl) throw new Error(`Missing PennyPay payin url in config for ${providerKey}`);
    if (!secretKey) throw new Error(`Missing PennyPay secretKey in config for ${providerKey}`);
    const formattedAmount = parseFloat(deposit.amount ?? amount).toFixed(2);
    const code =  providerConfig.code;
    const user_id = deposit.user; 
    const ot = deposit.ot || 'y';
    const merchant_order_id = deposit.merchant_order_id;
    const returnUrl = deposit.config?.urls?.return;
    const notifyUrl = deposit.config?.urls?.notify;
    if (!code || !ot || !user_id || !merchant_order_id) {
      throw new Error('Missing required PennyPay params: code, ot, user_id, or merchant_order_id');
    }
    const queryParams = new URLSearchParams({
      code,
      ot,
      amount: formattedAmount,
      user_id,
      merchant_order_id
    });
    if (notifyUrl) queryParams.append('notifyUrl', notifyUrl);
    if (returnUrl) queryParams.append('returnUrl', returnUrl);
    const endpoint = `${baseUrl}?${queryParams.toString()}`;
    const response = await axios.get(endpoint, {
      headers: {
        'x-api-key': secretKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
    const payInUrl = response?.data?.data?.payInUrl;
    if (!payInUrl) {
      throw new Error(`Failed to retrieve payInUrl from provider response`);
    }
    logger.info(`${providerKey} payin created successfully`, {
      depositId: deposit.id,
      endpoint,
      response: response?.data,
    });
    return {
      url: payInUrl
    };
  } catch (error) {
    logger.error(`Error creating ${providerKey} transaction:`, {
      depositId: deposit?.id,
      error: error.response?.data || error.message || error,
    });
    throw error;
  }
};