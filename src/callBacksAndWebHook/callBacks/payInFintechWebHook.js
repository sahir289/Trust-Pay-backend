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

  // Handle both lowercase 'orderid' and camelCase 'orderId'
  const orderId = payload?.orderid || payload?.orderId || payload?.OrderId || payload?.order_id;
  
  // Handle both string status ('success', 'failed', 'pending') and numeric status codes
  const statusString = (payload?.status || '').toString().toLowerCase();
  const statusCode = Number(payload?.Status_code ?? payload?.status_code ?? payload?.statusCode ?? payload?.code);

  let conn;
  let committed = false;

  try {
    if (!orderId) {
      return res.status(400).send('Missing orderId in callback payload');
    }

    conn = await getConnection();
    await beginTransaction(conn);

    // Look up payout by the txnid (our OrderId)
    const singleWithdrawData = await getPayoutByTxnId(orderId, conn);
    if (!singleWithdrawData) {
      await rollback(conn);
      logger.warn('PayInFintech: callback – payout not found', { orderId });
      return res.status(404).send('Payment not found');
    }

    const existingPayout = singleWithdrawData;
    // Idempotency guard
    if (existingPayout.status === Status.APPROVED || existingPayout.status === Status.REJECTED) {
      logger.info('PayInFintech: duplicate callback received, skipping', {
        orderId,
        currentStatus: existingPayout.status,
      });
      await rollback(conn);
      return res.status(200).json({ message: 'Already processed' });
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
        ...singleWithdrawData.config, // Preserve existing config
        description: 'Payout processing via PayInFintech',
        orderId,
        _isCallbackUpdate: true, // Flag to prevent triggering payout creation
      },
    };

    // Map status - handle both string status and numeric codes
    // String status: 'success', 'failed', 'pending'
    // Numeric codes: 106 = success, 107-109 = pending, 110-111 = failed
    if (statusString === 'success' || statusCode === 106) {
      // APPROVED
      Object.assign(updatePayload, {
        status: Status.APPROVED,
        utr_id: payload?.utr || 
          payload?.utrNumber || 
          payload?.UTR || 
          payload?.rrn || 
          payload?.data?.utr ||
          payload?.data?.utrNumber || '',
        approved_at: new Date().toISOString(),
      });
    } else if (statusString === 'pending' || [107, 108, 109].includes(statusCode)) {
      // PENDING
      updatePayload.status = Status.PENDING;
    } else if (statusString === 'failed' || statusString === 'failure' || [110, 111].includes(statusCode)) {
      // REJECTED
      const rejectionReason = payload?.message ||
        payload?.remark ||
        payload?.data?.message ||
        payload?.data?.remark ||
        'Transaction rejected by PayInFintech';

      updatePayload.status = Status.REJECTED;
      updatePayload.config.rejected_reason = rejectionReason;
      updatePayload.rejected_at = new Date().toISOString();

      logger.info('PayInFintech: rejection reason stored', { orderId, rejectionReason });
    } else {
      // Unknown status – treat as REJECTED with raw message as reason
      const rejectionReason = payload?.message ||
        payload?.remark ||
        payload?.data?.message ||
        payload?.data?.remark ||
        'Transaction rejected by PayInFintech';

      logger.warn('PayInFintech: unknown status in callback, treating as REJECTED', {
        statusString,
        statusCode,
        orderId,
      });

      updatePayload.status = Status.REJECTED;
      updatePayload.config.rejected_reason = rejectionReason;
      updatePayload.rejected_at = new Date().toISOString();

      logger.info('PayInFintech: rejection reason stored', { orderId, rejectionReason });
    }

    logger.info('PayInFintech: final update payload', updatePayload);

    // Merge config properly to preserve existing fields
    updatePayload.config = {
      ...singleWithdrawData.config,
      ...updatePayload.config,
    };

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
    return res.status(200).send('Payout Updated Successfully');
  } catch (err) {
    if (conn && !committed) await rollback(conn);
    logger.error('PayInFintech: error while updating payout in callback', err);
    return res.status(500).send('Internal server error');
  } finally {
    if (conn) {
      logger.info('PayInFintech: releasing DB connection');
      conn.release();
    }
  }
};
