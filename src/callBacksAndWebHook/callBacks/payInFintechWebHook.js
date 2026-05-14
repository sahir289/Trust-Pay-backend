import { getBankByIdDao } from '../../apis/bankAccounts/bankaccountDao.js';
import { getPayoutByOrderId } from '../../apis/payOut/payOutDao.js';
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

  const merchantOrderId = payload?.orderid || payload?.orderId;
  const statusString = (payload?.status || '').toString().toLowerCase();

  // Acknowledge immediately — prevents PayInFintech timeout
  res.status(200).send('Webhook received successfully');

  // All logs use merchant_order_id as the primary trace key for AWS CloudWatch
  const logCtx = { merchant_order_id: merchantOrderId };

  logger.info('PayInFintech: callback received', { ...logCtx, status: statusString, payload });

  if (!merchantOrderId) {
    logger.error('PayInFintech: missing merchant_order_id in callback payload', { payload });
    return;
  }

  let conn;
  let committed = false;

  try {
    conn = await getConnection();
    await beginTransaction(conn);

    // Lock the row immediately to prevent duplicate processing from concurrent callbacks
    const lockQuery = `
      SELECT id, status FROM public."Payout"
      WHERE merchant_order_id = $1 AND is_obsolete = false
      LIMIT 1
      FOR UPDATE
    `;
    const lockResult = await conn.query(lockQuery, [merchantOrderId]);
    const lockedRow = lockResult.rows[0];

    if (!lockedRow) {
      await rollback(conn);
      logger.warn('PayInFintech: payout not found', logCtx);
      return;
    }

    // Idempotency — skip if already in terminal state
    if (lockedRow.status === Status.APPROVED || lockedRow.status === Status.REJECTED) {
      await rollback(conn);
      logger.info('PayInFintech: duplicate callback skipped', {
        ...logCtx,
        current_status: lockedRow.status,
      });
      return;
    }

    // Fetch full payout record now that we hold the lock
    const singleWithdrawData = await getPayoutByOrderId(merchantOrderId, conn);

    const [company] = await getCompanyByIDDao({ id: singleWithdrawData.company_id }, conn);
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

    if (statusString === 'success') {
      const utrValue = (payload?.utr || '').trim();
      Object.assign(updatePayload, {
        status: Status.APPROVED,
        approved_at: new Date().toISOString(),
        ...(utrValue && { utr_id: utrValue }),
      });
      logger.info('PayInFintech: marking APPROVED', { ...logCtx, utr: utrValue });

    } else if (statusString === 'faild') {
      const rejectionReason = payload?.message || payload?.remark || 'Transaction failed (PayInFintech)';
      Object.assign(updatePayload, {
        status: Status.REJECTED,
        rejected_at: new Date().toISOString(),
      });
      updatePayload.config.rejected_reason = rejectionReason;
      logger.info('PayInFintech: marking REJECTED', { ...logCtx, reason: rejectionReason });

    } else {
      updatePayload.status = Status.PENDING;
      logger.warn('PayInFintech: unknown status, treating as PENDING', { ...logCtx, statusString });
    }

    // Merge config to preserve existing fields
    updatePayload.config = {
      ...singleWithdrawData.config,
      ...updatePayload.config,
    };

    await _updatePayoutServiceInternal(
      { id: singleWithdrawData.id, company_id: singleWithdrawData.company_id },
      updatePayload,
      null,
      conn,
    );

    await commit(conn);
    committed = true;
    logger.info('PayInFintech: callback processed successfully', {
      ...logCtx,
      payout_id: singleWithdrawData.id,
      final_status: updatePayload.status,
    });

  } catch (err) {
    if (conn && !committed) await rollback(conn);
    logger.error('PayInFintech: error processing callback', { ...logCtx, error: err.message });
  } finally {
    if (conn) conn.release();
  }
};
