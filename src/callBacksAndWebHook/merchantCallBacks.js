import axios from 'axios';
import { logger } from '../utils/logger.js';
import { BadRequestError } from '../utils/appErrors.js';

// ============================================
// UNIFIED MERCHANT CALLBACK HANDLER
// ============================================

/**
 * Send callback notification to merchant
 * @param {string} type - Callback type ('payin' or 'payout')
 * @param {string|Object} urlOrMerchant - Merchant URL or merchant object with config
 * @param {Object} data - Data to send in callback
 * @returns {Promise<Object>} Callback response
 */
export const sendMerchantCallback = async (type, urlOrMerchant, data) => {
  // Extract URL from merchant object or use directly
  const url = typeof urlOrMerchant === 'object' 
    ? urlOrMerchant.config?.urls?.[`${type}_notify`] 
    : urlOrMerchant;
  
  if (type === 'payin') {
    return merchantPayinCallback(url, data);
  }
  return merchantPayoutCallback(url, data);
};

const sendMerchantNotification = async (url, data, type) => {
  try {
    if (!url) {
      logger.error(`No URL provided for ${type} Notification`);
      throw new BadRequestError('Notify Url not found!');
    }
    logger.info(`Sending ${type} Notification to Merchant`, {
      notify_url: url,
      notify_data: data,
    });
    const response = await axios.post(url, data,{timeout: 5000});
    logger.info(`${type} Notification Sent Successfully`, {
      //send dat in logs
      status: response?.status,
      url: url,
      data: data,
    });
    return response.data;
  } catch (error) {
    const errorMessage = error?.message || 'Unknown error';
    const statusCode = error?.response?.status || 'N/A';
    const responseData = error?.response?.data || {};

    logger.error(`Error Notifying Merchant at ${type} URL: ${errorMessage}`, {
      status: statusCode,
      response: responseData,
      url: url,
      data: data,
    });
    return {
      message: `Error Notifying Merchant at ${type} URL: ${error.message}`,
    };
  }
};

export const merchantPayinCallback = async (url, data) =>
  sendMerchantNotification(url, data, 'Payin');
export const merchantPayoutCallback = async (url, data) =>
  sendMerchantNotification(url, data, 'Payout');
