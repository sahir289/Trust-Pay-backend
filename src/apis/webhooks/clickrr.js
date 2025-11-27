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
