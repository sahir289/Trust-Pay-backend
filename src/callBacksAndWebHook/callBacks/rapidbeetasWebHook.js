import { getPayoutsDao } from '../../apis/payOut/payOutDao.js';
import { Role, Status, Method } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';
import { updatePayoutWebhookService } from '../../apis/payOut/payOutService.js';
import { getUserByCompanyCreatedAtDao } from '../../apis/users/userDao.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { beginTransaction, commit, getConnection, rollback } from '../../utils/db.js';
import { getCompanyByIDDao } from '../../apis/company/companyDao.js';
import { verifyRapidBeetasCallback } from '../../rapidbeetas/rapidbeetas.js';

export const rapidBeetasPayoutCallback = async (req, res) => {
  sendSuccess(res, 200, 'Internal Webhook received successfully');

  const payload = req.body?.data ?? req.body;
  const merchantOrderId = payload?.merchantOrderId;
  const providerStatus = payload?.status;

  let conn;
  let committed = false;

  try {
    if (!merchantOrderId) {
      logger.error('merchantOrderId missing in internal payout callback payload');
      return;
    }

    const [singleWithdrawData] = await getPayoutsDao({ merchant_order_id: merchantOrderId });
    if (!singleWithdrawData) {
      logger.error(`Payout not found for merchantOrderId: ${merchantOrderId}`);
      return;
    }

    let payoutConfig = singleWithdrawData?.config ?? singleWithdrawData?.payout_details;
    if (typeof payoutConfig === 'string') {
      try {
        payoutConfig = JSON.parse(payoutConfig);
      } catch  {
        payoutConfig = {};
      }
    }

    if (
      payoutConfig?.method !== Method.RAPIDPAY &&
      payoutConfig?.method !== Method.BEETAS
    ) {
      logger.warn('internal callback received for non-internal payout', {
        merchantOrderId,
        method: payoutConfig?.method,
      });
      return;
    }

    const [company] = await getCompanyByIDDao({ id: singleWithdrawData.company_id });
    if (!company) {
      logger.error(`Company not found for payout callback merchantOrderId: ${merchantOrderId}`);
      return;
    }

    const providerConfigKey =
      payoutConfig?.method === Method.RAPIDPAY ? 'RAPID_PAY' : 'BEETAS';
    const providerSigningSecret =
      company?.config?.[providerConfigKey]?.privateKey || null;
    const signatureCheck = verifyRapidBeetasCallback({
      companyConfig: company.config,
      headers: req.headers,
      rawBody: req.rawBody,
      parsedBody: req.body,
      methodHint: payoutConfig?.method,
      signingSecret: providerSigningSecret,
    });

    if (!signatureCheck.valid) {
      logger.error('internal payout callback signature validation failed', {
        merchantOrderId,
        reason: signatureCheck.message,
      });
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

    if (singleWithdrawData.status === Status.APPROVED && providerStatus !== 'REVERSED') {
      logger.info('Payout already APPROVED. Ignoring non-REVERSED callback.', {
        payoutId: singleWithdrawData?.id,
        incomingStatus: providerStatus,
      });
      return;
    }

    const updatePayload = {};
    const adminUser = await getUserByCompanyCreatedAtDao(
      singleWithdrawData.company_id,
      Role.ADMIN,
    );
    if (adminUser) {
      updatePayload.updated_by = adminUser.id;
    }

    if (providerStatus === 'APPROVED') {
      Object.assign(updatePayload, {
        status: Status.APPROVED,
        utr_id: payload?.utrId || payload?.utr_id,
        approved_at: new Date().toISOString(),
      });
    } else if (providerStatus === 'REJECTED') {
      Object.assign(updatePayload, {
        status: Status.REJECTED,
        rejected_at: new Date().toISOString(),
        config: {
          ...(payoutConfig || {}),
          rejected_reason: 'Transaction Rejected by Provider',
        },
      });
    } else if (providerStatus === 'REVERSED') {
      Object.assign(updatePayload, {
        status: Status.REVERSED,
        utr_id: payload?.utrId || payload?.utr_id,
        rejected_at: new Date().toISOString(),
      });
    } else {
      logger.warn('Unknown internal status received', {
        status: providerStatus,
        merchantOrderId,
      });
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

    logger.info('Payout updated by internal callback', {
      payoutId: singleWithdrawData.id,
      newStatus: updatePayload.status,
    });
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn);
    }
    logger.error('Error while updating internal payout callback', {
      message: error.message,
      stack: error.stack,
    });
  } finally {
    if (conn) {
      conn.release();
    }
  }
};
