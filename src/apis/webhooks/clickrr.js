// import { transactionWrapper } from '../../utils/db.js';
import { Method } from '../../constants/index.js';
import { NotFoundError } from '../../utils/appErrors.js';
import { logger } from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getCompanyIdByMerchantOrderIdDao } from '../payOut/payOutDao.js';
import { updatePayoutService } from '../payOut/payOutService.js';

export const clickrrWebhook = async (req, res) => {
  try {
    sendSuccess(res, {}, 'Webhook received successfully');
    const payload = req.body;

    const merchant_order_id = payload.referenceId;
    const companyDetails =
      await getCompanyIdByMerchantOrderIdDao(merchant_order_id);

    if (!companyDetails) {
      throw new NotFoundError(
        'Company ID not found for the given merchant_order_id',
      );
    }

    const ids = {
      id: companyDetails.id,
      company_id: companyDetails.company_id,
    };
    const newPayload = {
      txnStatus: payload.txnStatus,
      utr_id: payload.utr,
      config: {
        ...(payload.config || {}),
        method: Method.CLICKRR,
      },
    };

    logger.info(`Payout updated from Clickrr webhook for ID ${merchant_order_id}`, newPayload);
    const clickrrResponse = await updatePayoutService(ids, newPayload);
    logger.info('Payout processed:', clickrrResponse);
  } catch (error) {
    logger.error('Clickrr webhook error:', error);
  }
};
