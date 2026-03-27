import { logger } from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createBankResponseWebHookService } from '../bankResponse/bankResponseServices.js';
import { getPayInIntentDao } from '../payIn/payInDao.js';
import { processPayInWebHookService } from '../payIn/payInService.js';
import { generateHash } from '../../intent/createIntentTransaction.js';
import { getBankResponseByUTR } from '../bankResponse/bankResponseDao.js';
import { beginTransaction, getConnection } from '../../utils/db.js';

const processingSet = new Set();

export const runsafeWebhook = async (req, res) => {
  try {
    sendSuccess(res, 200, 'runsafe webhook received successfully');
    const body = req.body;
    const merchantOrderId = body?.mchOrderNo
    const utr = body?.utr;
    if (processingSet.has(utr)) {
      logger.warn(`Duplicate concurrent webhook skipped for ${utr} and merchantOrderId ${merchantOrderId}`);
      return;
    }

    processingSet.add(utr);

    const hash = generateHash(body, 'runsafe');
    if (hash !== body.hash) {
      logger.error('Invalid hash in runsafe webhook');
      // return;
    }

    const payload = {
      merchantOrderId: body?.mchOrderNo,
      userSubmittedUtr: body?.utr || body?.mchOrderNo,
      amount: Number(body?.amount),
      status: body?.orderStatus,
    };
    const payIn = await getPayInIntentDao(body?.mchOrderNo);

    const bankResponsePayload = `${body?.amount} nil ${payload.userSubmittedUtr} ${payIn.bank_acc_id}`;

    const utrAlreadyExist = await getBankResponseByUTR(
      payload.userSubmittedUtr,
    );

    if (utrAlreadyExist) {
      logger.warn(
        'Duplicate UTR received in runsafe webhook:',
        payload.userSubmittedUtr,
      );
      return;
    }

    let conn = await getConnection();
    await beginTransaction(conn);

    if (body?.orderStatus === 'SUCCESS') {
      const bankResponse = await createBankResponseWebHookService(
        bankResponsePayload,
        payIn.company_id,
        'BOT',
        'runsafe',
        conn,
      );
      logger.info('Bank response created:', bankResponse);
    }
    logger.info('Calling processPayInWebHookService for payload', payload);
    const payin = await processPayInWebHookService(
      payload,
      '',
      conn,
    );

    logger.info('PayIn processed:', payin);
  } catch (error) {
    logger.error('runsafe webhook error:', error);
  } finally {
    processingSet.delete(req.body?.transaction?.utr);
  }
};
