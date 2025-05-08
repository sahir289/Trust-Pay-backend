import axios from 'axios';
import { logger } from '../utils/logger.js';

const sendMerchantNotification = (url, data, type) => {
  if (!url) {
    logger.error(`No URL provided for ${type} Notification`);
    return Promise.reject(new Error('Notify URL not found!'));
  }

  console.log(data);
  logger.info(`Sending ${type} Notification to Merchant`, {
    notify_url: url,
    notify_data: data,
  });

  return axios
    .post(url, data)
    .then((response) => {
      if (response && response.status === 200) {
        logger.info(`${type} Notification Sent Successfully`, {
          status: response.status,
          data: data,
        });
        return response.data;
      } else {
        logger.error(`${type} Notification received invalid response`, {
          response: response,
        });
        throw new Error('Invalid response from server');
      }
    })
    .catch((error) => {
      logger.error(`Error Notifying Merchant at ${type} URL`, {
        message: error.message,
        stack: error.stack,
        response: error.response ? error.response.data : 'No response',
      });
      return {
        message: `Error Notifying Merchant at ${type} URL: ${error.message}`,
      };
    });
};

export const merchantPayinCallback = (url, data) =>
  sendMerchantNotification(url, data, 'Payin');
export const merchantPayoutCallback = (url, data) =>
  sendMerchantNotification(url, data, 'Payout');
