// import { transactionWrapper } from '../../utils/db.js';
import { beginTransaction, getConnection, rollback } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { updatePayoutService } from '../payOut/payOutService.js';

export const clickrrWebhook = async (req, res) => {
  let conn;
  try {
    sendSuccess(res, {}, 'Webhook received successfully');
    conn = await getConnection();
    await beginTransaction(conn);
    const payload = req.body;
    logger.info('Clickrr webhook payload:', payload);

    const ids = { id: payload?.merchant_order_id };
    logger.info('Payout updated from Clickrr webhook:', clickrrResponse);
    const clickrrResponse = await updatePayoutService(conn, ids, 'payload', '');
    logger.info('Payout processed:', clickrrResponse);
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
