// PayInFintech payout webhook / callback handler
import { getBankByIdDao } from '../../apis/bankAccounts/bankaccountDao.js';
import { getPayoutByTxnId } from '../../apis/payOut/payOutDao.js';
import { Role, Status } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';
import { getCompanyByIDDao } from '../../apis/company/companyDao.js';
import { getVendorsDao } from '../../apis/vendors/vendorDao.js';
import { _updatePayoutServiceInternal } from '../../apis/payOut/payOutService.js';
import { getUserByCompanyCreatedAtDao } from '../../apis/users/userDao.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';

export const payInFintechTransactionStatusCallback = async (req, res) => {
  const payload = req.body;
  logger.info('PayInFintech: received callback payload', payload);

  const orderId = payload?.orderId || payload?.OrderId || payload?.order_id;
  const statusCode = Number(payload?.Status_code ?? payload?.status_code ?? payload?.statusCode ?? payload?.status ?? payload?.code);

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

    // Idempotency guard – skip terminal statuses
    if (![Status.INITIATED, Status.PENDING].includes(singleWithdrawData.status)) {
      logger.info('PayInFintech: payout already processed', {
        payoutId: singleWithdrawData.id,
        status: singleWithdrawData.status,
      });
      await rollback(conn);
      return res.status(200).send('Payout already processed');
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
      config: {
        method: 'PAYINFINTECH',
        description: 'Payout processing via PayInFintech',
        orderId,
      },
    };

    const adminUser = await getUserByCompanyCreatedAtDao(
      singleWithdrawData.company_id,
      Role.ADMIN,
    );
    if (adminUser) updatePayload.updated_by = adminUser.id;

    // Map numeric status code → internal status
    if (statusCode === 106) {
      // APPROVED
      Object.assign(updatePayload, {
        status: Status.APPROVED,
        utr_id: payload?.utr || payload?.utrId || '',
        approved_at: new Date().toISOString(),
      });
    } else if ([107, 108, 109].includes(statusCode)) {
      // PENDING
      updatePayload.status = Status.PENDING;
    } else if ([110, 111].includes(statusCode)) {
      // REJECTED
      updatePayload.status = Status.REJECTED;
      updatePayload.config.rejected_reason =
        payload?.message || 'Transaction rejected by PayInFintech';
      updatePayload.rejected_at = new Date().toISOString();
    } else {
      // Unknown – treat as PENDING to avoid accidental REJECTED
      logger.warn('PayInFintech: unknown status code in callback', {
        statusCode,
        orderId,
      });
      updatePayload.status = Status.PENDING;
    }

    logger.info('PayInFintech: final update payload', updatePayload);

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
