// PayInFintech payout webhook / callback handler
import { getBankByIdDao } from '../../apis/bankAccounts/bankaccountDao.js';
import { getPayoutByTxnId } from '../../apis/payOut/payOutDao.js';
import { Status } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';
import { getCompanyByIDDao } from '../../apis/company/companyDao.js';
import { getVendorsDao } from '../../apis/vendors/vendorDao.js';
import { _updatePayoutServiceInternal } from '../../apis/payOut/payOutService.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';

export const payInFintechTransactionStatusCallback = async (req, res) => {
  const payload = req.body;
  logger.info('PayInFintech: full callback payload', payload);

  // Handle both lowercase 'orderid' and camelCase 'orderId' (defensively support both)
  const orderId = payload?.orderid || payload?.orderId;
  
  // Extract status string - handle the typo "faild" from PayInFintech API
  const statusString = (payload?.status || '').toString().toLowerCase();

  //The webhook callback was not returning a response immediately to PayInFintech. Instead, it was processing the entire transaction (database updates, balance deductions, merchant callbacks) BEFORE sending a response. This caused PayInFintech to timeout waiting for acknowledgment, marking the webhook as failed and leaving payouts stuck in PENDING status.
  
  // CRITICAL: Send immediate 200 response to PayInFintech to acknowledge receipt
  // This prevents them from timing out while we process the webhook
  res.status(200).send('Webhook received successfully');

  let conn;
  let committed = false;

  try {
    if (!orderId) {
      logger.error('PayInFintech: Missing orderId in callback payload', payload);
      return;
    }

    conn = await getConnection();
    await beginTransaction(conn);

    // Look up payout by the txnid (our OrderId)
    const singleWithdrawData = await getPayoutByTxnId(orderId, conn);
    if (!singleWithdrawData) {
      await rollback(conn);
      logger.warn('PayInFintech: callback – payout not found', { orderId });
      return;
    }

    const existingPayout = singleWithdrawData;
    // Idempotency guard - if already APPROVED or REJECTED, skip reprocessing
    if (existingPayout.status === Status.APPROVED || existingPayout.status === Status.REJECTED) {
      logger.info('PayInFintech: duplicate callback received, skipping', {
        orderId,
        currentStatus: existingPayout.status,
      });
      await rollback(conn);
      return;
    }

    const [company] = await getCompanyByIDDao(
      { id: singleWithdrawData.company_id },
      conn,
    );

    const bankId = company?.config?.PAYINFINTECH?.defaultBankId;
    const [bankVendor] = await getBankByIdDao({ id: bankId });
    const [vendor] = await getVendorsDao({ user_id: bankVendor?.user_id });

    const updatePayload = {
      bank_acc_id: bankId,
      vendor_id: vendor?.id,
      updated_by: 'trust-pay',
      config: {
        method: 'PAYINFINTECH',
        description: 'Payout processing via PayInFintech',
      },
    };

    // Map status based on exact callback payloads received:
    // - "success" → APPROVED
    // - "faild" (typo in their API) → REJECTED
    // - Any other value → PENDING
    if (statusString === 'success') {
      // APPROVED - extract UTR only if non-empty
      const utrValue = payload?.utr || '';
      
      Object.assign(updatePayload, {
        status: Status.APPROVED,
        approved_at: new Date().toISOString(),
      });

      // Only set utr_id if utr is a non-empty string
      if (utrValue && utrValue.trim() !== '') {
        updatePayload.utr_id = utrValue;
      }

      logger.info('PayInFintech: marking as APPROVED', { orderId, utr: utrValue });
    } else if (statusString === 'faild') {
      // REJECTED - handle the typo "faild" (not "failed")
      const rejectionReason = payload?.message ||
        payload?.remark ||
        'Transaction failed (PayInFintech)';

      updatePayload.status = Status.REJECTED;
      updatePayload.config.rejected_reason = rejectionReason;
      updatePayload.rejected_at = new Date().toISOString();

      logger.info('PayInFintech: marking as REJECTED (faild status)', { orderId, rejectionReason });
    } else {
      // Unknown status – treat as PENDING
      logger.warn('PayInFintech: unknown status in callback, treating as PENDING', {
        statusString,
        orderId,
      });

      updatePayload.status = Status.PENDING;
    }

    logger.info('PayInFintech: final update payload', updatePayload);

    // Merge config properly to preserve existing fields
    updatePayload.config = {
      ...singleWithdrawData.config,
      ...updatePayload.config,
    };

    // Update payout - this will trigger all side effects (balance deduction, merchant callback, socket emit) on APPROVED
    await _updatePayoutServiceInternal(
      {
        id: singleWithdrawData.id,
        company_id: singleWithdrawData.company_id,
      },
      updatePayload,
      null,
      conn,
    );

    logger.info('PayInFintech: payout updated by callback', {
      payoutId: singleWithdrawData.id,
      status: updatePayload.status,
    });

    await commit(conn);
    committed = true;
    logger.info('PayInFintech: payout update committed successfully', {
      payoutId: singleWithdrawData.id,
      orderId,
      status: updatePayload.status,
    });
  } catch (err) {
    if (conn && !committed) await rollback(conn);
    logger.error('PayInFintech: error while updating payout in callback', err);
  } finally {
    if (conn) {
      logger.info('PayInFintech: releasing DB connection');
      conn.release();
    }
  }
};
