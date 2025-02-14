import axios from 'axios';

const sendMerchantNotification = async (url, data, type) => {
    try {
        if (!url) {
            console.error(`No URL provided for ${type} Notification`);
            throw new Error('Notify Url not found!');
        }
        console.info(`Sending ${type} Notification to Merchant`, { notify_url: url, notify_data: data });
        const response = await axios.post(url, data);
        console.info(`${type} Notification Sent Successfully`, {
            status: response.status,
            data: response.data,
        });
        return response.data;
    } catch (error) {
        console.error(`Error Notifying Merchant at ${type} URL:`, error.message);
        // throw new BadRequestError(`Failed to notify merchant about ${type}`);
        return {
            message: `Error Notifying Merchant at ${type} URL: ${error.message}`
        }
    }
};

export const merchantPayinCallback = async (url, data) => sendMerchantNotification(url, data, 'Payin');
export const merchantPayoutCallback = async (url, data) => sendMerchantNotification(url, data, 'Payout');
