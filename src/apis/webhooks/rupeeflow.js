// import { transactionWrapper } from '../../utils/db.js';
import { Method, Status } from '../../constants/index.js';
import { NotFoundError } from '../../utils/appErrors.js';
import { logger } from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getPayoutByTxnId } from '../payOut/payOutDao.js';
import { updatePayoutService } from '../payOut/payOutService.js';

export const rupeeFlowWebhook = async (req, res) => {
  try {
    sendSuccess(res, {}, 'Webhook received successfully');
    const payload = req.body;

    logger.info('RupeeFlow webhook received:', payload);

    // payoutId is our generated uniqueId stored in config.txnid
    const payoutId = payload.payoutId;
    const payoutDetails = await getPayoutByTxnId(payoutId);

    if (!payoutDetails) {
      throw new NotFoundError(
        `Payout not found for payoutId: ${payoutId}`,
      );
    }

    const ids = {
      id: payoutDetails.id,
      company_id: payoutDetails.company_id,
    };

    // Map RupeeFlow status to internal status
    // RupeeFlow: SUCCESS, PENDING, FAILED
    // Internal: SUCCESS, PENDING, REJECTED
    const rupeeFlowStatus = payload.status?.toUpperCase();
    let status = rupeeFlowStatus;
    
    if (rupeeFlowStatus === 'FAILED' || rupeeFlowStatus === '400' || rupeeFlowStatus === 400) {
      status = Status.REJECTED;
    }

    const newPayload = {
      txnStatus: status, // SUCCESS, PENDING, REJECTED
      utr_id: payload.utr !== 'NA' ? payload.utr : '',
      config: {
        method: Method.RUPEEFLOW,
        orderId: payload.orderId,
        txnRefId: payload.txnRefId,
        txnid: payoutId, // Keep our original uniqueId
      },
    };

    logger.info(`Payout updated from RupeeFlow webhook for payoutId ${payoutId}`, {
      rupeeFlowStatus,
      mappedStatus: status,
      utr: newPayload.utr_id,
      orderId: payload.orderId,
    });
    
    const rupeeFlowResponse = await updatePayoutService(ids, newPayload);
    logger.info('Payout processed:', rupeeFlowResponse);
  } catch (error) {
    logger.error('RupeeFlow webhook error:', error);
  }
};
