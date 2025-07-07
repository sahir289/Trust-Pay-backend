import { updatePayInUrlDao, getPayInUrlsDao } from '../apis/payIn/payInDao.js';
import { newTableEntry } from '../utils/sockets.js';
import { tableName, Status } from '../constants/index.js';
import { merchantPayinCallback } from '../callBacksAndWebHook/merchantCallBacks.js';
import { NotFoundError } from './appErrors.js';
import { logger } from './logger.js';

async function processPayInRestricted(id, restrictionReason) {
  try {
    const payInUrl = await getPayInUrlsDao({ merchant_order_id: id });
    if (!payInUrl || !payInUrl[0]) {
      throw new NotFoundError(
        'No pay-in URL found for the given merchant order ID',
      );
    }
    const payin = payInUrl[0];
    const config = {
      ...payin.config,
      isRestricted: true,
      restrictionReason,
    };
    const data = {
      status: Status.FAILED,
      config,
      is_url_expires: true,
      is_notified: true,
    };
    const notificationData = {
      status: Status.FAILED,
      merchantOrderId: payin?.merchant_order_id || null,
      payinId: payin?.id || null,
      amount: null,
      requestedAmount: payin?.amount || null,
      req_amount: payin?.amount || null,
      utrId: payin?.user_submitted_utr || null,
    };
    await updatePayInUrlDao(payin.id, data);
    if (payin?.config?.urls?.notify) {
      // This is async function but it's just the callback sending function there fore we are not using await
      merchantPayinCallback(payin.config.urls.notify, notificationData);
    }
    await newTableEntry(tableName.PAYIN);
    return payin.config.urls.return;
  } catch (error) {
    logger.error('Error processing pay-in URL:', error);
    return error.message;
  }
}

export { processPayInRestricted };
