import axios from 'axios';
import Logger from '../utils/logger.js';
// import { BadRequestError } from '../utils/appErrors.js'; // Adjust the import path as needed

const logger = new Logger();

const sendMerchantNotification = async (url, data, type) => {
    try {
        if (!url) {
            logger.error(`No URL provided for ${type} Notification`);
            return;
        }
        logger.info(`Sending ${type} Notification to Merchant`, { notify_url: url, notify_data: data });
        const response = await axios.post(url, data);
        logger.info(`${type} Notification Sent Successfully`, {
            status: response.status,
            data: response.data,
        });
    } catch (error) {
        logger.error(`Error Notifying Merchant at ${type} URL:`, error.message);
        // throw new BadRequestError(`Failed to notify merchant about ${type}`);
    }
};

export const merchantPayinCallback = async (url, data) => sendMerchantNotification(url, data, 'Payin');
export const merchantPayoutCallback = async (url, data) => sendMerchantNotification(url, data, 'Payout');
