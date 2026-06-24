import { getPayoutsDao } from '../../apis/payOut/payOutDao.js';
import { Role, Status } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';
import { updatePayoutWebhookService } from '../../apis/payOut/payOutService.js';
import { getUserByCompanyCreatedAtDao } from '../../apis/users/userDao.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
export const pennypaySuccessCallback = async (req, res) => {
  sendSuccess(res, {}, 'Webhook received successfully');
  const payload = req.body;
  let conn;
  let committed = false;
  const merchantOrderId = payload?.merchantOrderId;
  const pennyPayStatus = payload?.status;
  logger.info('Webhook received  payload ', payload);

  try {
    if (!merchantOrderId) {
      logger.error('Merchant Order ID missing in webhook payload');
      return;
    }
    const [singleWithdrawData] = await getPayoutsDao({ merchant_order_id: merchantOrderId });
    if (!singleWithdrawData) {
      logger.error(`Payment not found for merchantOrderId: ${merchantOrderId}`);
      return;
    }
if (
  singleWithdrawData.status === Status.REJECTED || 
  singleWithdrawData.status === Status.REVERSED
) {
  logger.info('Payout already in final terminal state (REJECTED/REVERSED)', {
    payoutId: singleWithdrawData?.id,
    status: singleWithdrawData?.status,
  });
  return;
}

if (singleWithdrawData.status === Status.APPROVED && pennyPayStatus !== 'REVERSED') {
  logger.info('Payout already APPROVED. Ignoring non-REVERSED callback.', {
    payoutId: singleWithdrawData?.id,
    incomingStatus: pennyPayStatus,
  });
  return;
}



    const updatePayload = { };

    const adminUser = await getUserByCompanyCreatedAtDao(
      singleWithdrawData.company_id,
      Role.ADMIN,
    );
    if (adminUser) updatePayload.updated_by = adminUser.id;

    if (pennyPayStatus === 'APPROVED') {
      Object.assign(updatePayload, {
        status: Status.APPROVED,
        utr_id: payload?.utr_id,
        approved_at: new Date().toISOString(),
      });
    } 
    else if (pennyPayStatus === 'REJECTED') {
      Object.assign(updatePayload, {
        status: Status.REJECTED,
        rejected_at: new Date().toISOString(),
        config: {...singleWithdrawData.config,
         rejected_reason:'Transaction Rejected by Provider'
        }
      });
    } 
    else if (pennyPayStatus === 'REVERSED') {
      Object.assign(updatePayload, {
        status: Status.REVERSED,
        utr_id: payload?.utr_id,
        rejected_at: new Date().toISOString(),
      });
    } 
    else {
       logger.warn(`Unknown FreeChips status received: ${payload.status}`, { merchantOrderId: payload.merchantOrderId });
      return;
    }
    conn = await getConnection();
    await beginTransaction(conn);
    await updatePayoutWebhookService(
      {
        id: singleWithdrawData.id,
        company_id: singleWithdrawData.company_id,
      },
      updatePayload,
      conn,
    );
    await commit(conn);
    committed = true;
    logger.info('Payout Updated by PennyPay callback', {
      payoutId: singleWithdrawData.id,
      newStatus: updatePayload.status,
    });

  } catch (err) {
    if (conn && !committed) await rollback(conn);
    logger.error('getting error while updating tp/pp payout', err);
  } finally {
    if (conn) {
      logger.info('Releasing connection');
      conn.release();
    }
  }
};