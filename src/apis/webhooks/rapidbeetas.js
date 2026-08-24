import { logger } from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createBankResponseWebHookService } from '../bankResponse/bankResponseServices.js';
import { getPayInIntentDao } from '../payIn/payInDao.js';
import { processPayInWebHookService } from '../payIn/payInService.js';
import { getBankResponseByUTR } from '../bankResponse/bankResponseDao.js';
import { Status } from '../../constants/index.js';
import { acquireLock, releaseLock } from '../../utils/distributedLock.js';
import { beginTransaction, commit, getConnection, rollback } from '../../utils/db.js';
import { getCompanyByIDDao } from '../company/companyDao.js';
import { verifyRapidBeetasCallback } from '../../rapidbeetas/rapidbeetas.js';

export const rapidBeetasWebhook = async (req, res) => {
  sendSuccess(res, 200, 'Internal Webhook received successfully');

  let utr = null;
  let conn = null;
  try {

    const responseData = req.body?.data ?? req.body;
    if (!responseData) {
      logger.error('Missing data object in internal webhook body');
      return;
    }

    const statusFromGateway = responseData?.status;
    const merchantOrderId = responseData?.merchantOrderId;
    utr = responseData?.utrId?.trim() || responseData?.utr_id?.trim();

    if (!merchantOrderId) {
      logger.error('merchantOrderId is missing in internal webhook payload');
      return;
    }

    const payIn = await getPayInIntentDao(merchantOrderId);
    if (!payIn) {
      logger.error(`PayIn not found for merchantOrderId: ${merchantOrderId}`);
      return;
    }

    const [company] = await getCompanyByIDDao({ id: payIn.company_id });
    if (!company) {
      logger.error(`Company not found for payIn company_id: ${payIn.company_id}`);
      return;
    }

    let payInConfig = payIn?.config;
    if (typeof payInConfig === 'string') {
      try {
        payInConfig = JSON.parse(payInConfig);
      } catch {
        payInConfig = {};
      }
    }

    const signatureCheck = verifyRapidBeetasCallback({
      companyConfig: company.config,
      headers: req.headers,
      rawBody: req.rawBody,
      parsedBody: req.body,
      methodHint: payInConfig?.method,
    });

    if (!signatureCheck.valid) {
      logger.error('internal callback signature validation failed', {
        merchantOrderId,
        reason: signatureCheck.message,
      });
      return;
    }

    if (statusFromGateway !== 'SUCCESS') {
      logger.info(
        `Skipping internal webhook processing. Status is ${statusFromGateway} for merchantOrderId ${merchantOrderId}`,
      );
      return;
    }

    if (!utr) {
      logger.error(`UTR missing for successful transaction. merchantOrderId: ${merchantOrderId}`);
      return;
    }

    const lockAcquired = await acquireLock(utr, 'rapidBeetas');
    if (!lockAcquired) {
      logger.warn(
        `Duplicate concurrent internal webhook skipped for UTR: ${utr} and merchantOrderId: ${merchantOrderId}`,
      );
      return;
    }

    conn = await getConnection();
    await beginTransaction(conn);

    const payload = {
      merchantOrderId,
      userSubmittedUtr: utr,
      amount: Number(responseData?.amount || responseData?.reqAmount || responseData?.req_amount),
      status: statusFromGateway,
    };

    if (payIn.status === Status.SUCCESS) {
      logger.warn(
        `PayIn already marked as SUCCESS for merchantOrderId ${merchantOrderId} - skipping processing`,
      );
      await rollback(conn);
      return;
    }

    const utrAlreadyExist = await getBankResponseByUTR(payload.userSubmittedUtr);
    if (utrAlreadyExist) {
      logger.warn(`Duplicate UTR received in internal webhook: ${payload.userSubmittedUtr}`);
      await rollback(conn);
      return;
    }

    const bankResponsePayload = `${payload.amount} nil ${payload.userSubmittedUtr} ${payIn.bank_acc_id}`;
    await createBankResponseWebHookService(
      bankResponsePayload,
      payIn.company_id,
      'BOT',
      'WEBHOOK',
      conn,
    );

    const payinProcessed = await processPayInWebHookService(payload, '', conn);
    await commit(conn);

    logger.info('internal payin processed successfully', {
      merchantOrderId,
      providerKey: signatureCheck.providerKey,
      result: payinProcessed,
    });
  } catch (error) {
    if (conn) {
      await rollback(conn);
    }
    logger.error('[internal] Webhook processing error', {
      message: error.message,
      stack: error.stack,
      utr,
    });
  } finally {
    if (conn) {
      await conn.release();
    }
    if (utr) {
      await releaseLock(utr, 'rapidBeetas');
    }
  }
};
