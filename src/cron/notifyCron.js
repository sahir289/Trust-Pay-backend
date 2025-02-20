import cron from 'node-cron';
import moment from 'moment-timezone';
import { getPayinsDao, updatePayInUrlDao } from '../apis/payIn/payInDao.js';
import axios from 'axios';

cron.schedule('*/10 * * * * *', () => {
  collectPayinData('Asia/Kolkata');
});

const collectPayinData = async (timezone = 'Asia/Kolkata') => {
  const currentTime = moment().tz(timezone, true);
  try {
    const startTime = currentTime.clone().subtract(10, 'minutes').toDate();
    const payins = await getPayinsDao({
      status: 'DROPPED',
      is_notified: 'false',
      updated_at: startTime,
    });
    if (!(payins.length > 0)) {
     return
    }
    await processPayinNotifications(payins);
  } catch (error) {
    console.error('Error while collecting payin data:', error?.message);
  }
};

async function processPayinNotifications(payins) {
  for (const payin of payins) {
    const notificationData = {
      status: 'DROPPED',
      merchantOrderId: payin.merchant_order_id || null,
      payinId: payin.id || null,
      amount: null,
      requestedAmount: payin.amount || null,
      utrId: payin.user_submitted_utr || null,
    };
    try {
      console.info('Simulating notification to merchant', {
        notify_url: payin.config.notify_url,
        notify_data: notificationData,
      });
      if (payin.config.notify_url) {
        const notifyMerchant = await axios.post(
          payin.config.notify_url,
          notificationData,
        );
        console.info('Notification sent successfully', {
          status: notifyMerchant.status,
          data: notifyMerchant.data,
        });
        await updatePayInUrlDao(payin.id, { is_notified: 'true' });
      } else {
        console.warn('Notify URL is missing for payin', { payinId: payin.id });
      }
    } catch (error) {
      console.error('Error simulating notification:', {
        error: error.message,
        payinId: payin.id,
        notify_url: payin.config.notify_url,
      });
    }
  }
}

export default collectPayinData;
