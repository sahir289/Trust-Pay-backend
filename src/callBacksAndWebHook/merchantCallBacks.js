import axios from 'axios';
import { logger } from '../utils/logger.js';

const sendMerchantNotification = async (url, data, type) => {
  try {
    if (!url) {
      logger.error(`No URL provided for ${type} Notification`);
      throw new Error('Notify Url not found!');
    }
    logger.info(`Sending ${type} Notification to Merchant`, {
      notify_url: url,
      notify_data: data,
    });
    const response = await axios.post(url, data).then((res) => {
      logger.info(`${type} Notification Sent Successfully`, {
        status: res.status,
        data: res.data,
      });
    });
    return response.data;
  } catch (error) {
    logger.error(`Error Notifying Merchant at ${type} URL:`, error.message);
    // throw new BadRequestError(Failed to notify merchant about ${type});
    return {
      message: `Error Notifying Merchant at ${type} URL: ${error.message}`,
    };
  }
};

export const merchantPayinCallback = async (url, data) =>
  sendMerchantNotification(url, data, 'Payin');
export const merchantPayoutCallback = async (url, data) =>
  sendMerchantNotification(url, data, 'Payout');
