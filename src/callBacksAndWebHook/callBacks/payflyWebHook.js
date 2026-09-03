import crypto from 'crypto';
import { getPayoutsDao } from '../../apis/payOut/payOutDao.js';
import { _updatePayoutServiceInternal } from '../../apis/payOut/payOutService.js';
import { getUserByCompanyCreatedAtDao } from '../../apis/users/userDao.js';
import { getCompanyByIDDao } from '../../apis/company/companyDao.js';
import { Role, Status } from '../../constants/index.js';
import { getConnection, beginTransaction, commit, rollback } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createPayflyHash } from '../../payfly/payfly.js';

const isValidWebhookHash = (payload, receivedHash, payoutSecret) => {
  if (!receivedHash || !payoutSecret) {
    return false;
  }

  const expectedHash = createPayflyHash(payload, payoutSecret);
  logger.info('Payfly webhook hash comparison', {
    payload: JSON.stringify(payload),
    receivedHash: String(receivedHash).trim(),
    generatedHash: expectedHash,
  });
  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  const receivedBuffer = Buffer.from(String(receivedHash).trim(), 'hex');
  return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(
    expectedBuffer,
    receivedBuffer,
  );
};

export const payflyTransactionStatusCallback = async (req, res) => {
  sendSuccess(res, {}, 'Payfly webhook received successfully');

  const payload = req.body || {};
  const receivedHash = req.headers.hash;
  const transactionId = String(payload.merchant_txnid || '').trim();
  const providerStatus = String(payload.txn_status || '').toUpperCase();
  if (!transactionId) {
    logger.warn('Payfly webhook missing merchant_txnid');
    return;
  }
  if (!['SUCCESS', 'FAILED'].includes(providerStatus)) {
    logger.warn('Ignoring unsupported Payfly webhook status', {
      transactionId,
      providerStatus,
    });
    return;
  }

  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const [payout] = await getPayoutsDao(
      { txnid: transactionId },
      null,
      null,
      null,
      null,
      null,
      conn,
    );
    if (!payout) {
      await rollback(conn);
      logger.warn('Payfly webhook payout not found', { transactionId });
      return;
    }
    const [company] = await getCompanyByIDDao(
      { id: payout.company_id },
      conn,
    );
    const payoutSecret = company?.config?.PAYFLY?.payoutSecret;
    if (!isValidWebhookHash(payload, receivedHash, payoutSecret)) {
      await rollback(conn);
      logger.warn('Rejected Payfly webhook with an invalid hash', {
        transactionId,
        merchantOrderId: payout.merchant_order_id || null,
      });
      return;
    }
    if ([Status.APPROVED, Status.REJECTED, Status.REVERSED].includes(payout.status)) {
      await rollback(conn);
      return;
    }
    const updatePayload = {config: { ...payout.config, provider_status: providerStatus }};
    
    const adminUser = await getUserByCompanyCreatedAtDao(
      payout.company_id,
      Role.ADMIN,
      conn,
    );
    if (adminUser) updatePayload.updated_by = adminUser.id;

    if (providerStatus === 'SUCCESS') {
      Object.assign(updatePayload, {
        status: Status.APPROVED,
        utr_id: payload.bank_refno || null,
        approved_at: new Date().toISOString(),
      });
    } else if (providerStatus === 'FAILED') {
      Object.assign(updatePayload, {
        status: Status.REJECTED,
        rejected_at: new Date().toISOString(),
        config: {
          ...updatePayload.config,
          rejected_reason: payload.message || 'Transaction failed by Payfly',
        },
      });
    }

    await _updatePayoutServiceInternal(
      { id: payout.id, company_id: payout.company_id },
      updatePayload,
      null,
      conn,
    );
    await commit(conn);
    committed = true;
  } catch (error) {
    if (conn && !committed) await rollback(conn);
    logger.error('Error processing Payfly webhook:', error);
  } finally {
    if (conn) conn.release();
  }
};