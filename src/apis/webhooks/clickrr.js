// import { transactionWrapper } from '../../utils/db.js';
import { Method } from '../../constants/index.js';
import { NotFoundError } from '../../utils/appErrors.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getCompanyIdByMerchantOrderIdDao } from '../payOut/payOutDao.js';
import { updatePayoutService } from '../payOut/payOutService.js';

export const clickrrWebhook = async (req, res) => {
  let conn;
  try {
    sendSuccess(res, {}, 'Webhook received successfully');
    conn = await getConnection();
    await beginTransaction(conn);
    const payload = req.body;
    logger.info('Received Clickrr webhook payload:', payload);

    const merchant_order_id = payload.referenceId;
    logger.info(
      'Processing Clickrr webhook for merchant_order_id:',
      merchant_order_id,
    );
    const companyDetails =
      await getCompanyIdByMerchantOrderIdDao(merchant_order_id);
    logger.info('Fetched company details for Clickrr webhook:', companyDetails);

    if (!companyDetails) {
      logger.error(
        'Company ID not found for merchant_order_id:',
        merchant_order_id,
      );
      throw new NotFoundError(
        'Company ID not found for the given merchant_order_id',
      );
    }

    const ids = {
      id: companyDetails.id,
      company_id: companyDetails.company_id,
    };
    logger.info('Updating payout for Clickrr webhook with IDs:', ids);
    const newPayload = {
      txnStatus: payload.txnStatus,
      utr_id: payload.utr,
      config: {
        ...(payload.config || {}),
        method: Method.CLICKRR,
      },
    };
    logger.info('Prepared new payload for Clickrr webhook:', newPayload);

    logger.info('Payout updated from Clickrr webhook:', payload);
    const clickrrResponse = await updatePayoutService(conn, ids, newPayload);
    logger.info('Payout processed:', clickrrResponse);
    await commit(conn);
  } catch (error) {
    logger.error('Clickrr webhook error:', error);
    // may be we don't need to add rollback here as transactionWrapper will handle it
    if (conn) {
      try {
        await rollback(conn);
        logger.error('Transaction rolled back due to error:', error);
      } catch (rollbackError) {
        logger.error('Rollback failed:', rollbackError);
      }
    }
  } finally {
    if (conn) {
      logger.info('Releasing connection');
      conn.release();
    }
  }
};
