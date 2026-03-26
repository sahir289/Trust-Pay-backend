import { logger } from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createBankResponseWebHookService } from '../bankResponse/bankResponseServices.js';
import { getPayInIntentDao } from '../payIn/payInDao.js';
import { processPayInWebHookService } from '../payIn/payInService.js';
import { generateHash } from '../../intent/createIntentTransaction.js';
import { getBankResponseByUTR } from '../bankResponse/bankResponseDao.js';

const processingSet = new Set();

export const runsafeWebhook = async (req, res) => {
  try {
    sendSuccess(res, 200, 'Webhook received successfully');
    const body = req.body?.transaction;
    const merchantOrderId = body?.order_id
    const utr = body?.utr;
    if (processingSet.has(utr)) {
      logger.warn(`Duplicate concurrent webhook skipped for ${utr} and merchantOrderId ${merchantOrderId}`);
      return;
    }

    processingSet.add(utr);

    const hash = generateHash(body, 'onePay');
    if (hash !== body.hash) {
      logger.error('Invalid hash in onePay webhook');
      // return;
    }

    const payload = {
      mchId: 399204155797661,
      txChannel: "TX_INDIA_001",
      appId: "DFN19SJXfxFCexeLIi",
      timestamp: 16624500121,
      mchOrderNo: "order_1672451031",
      bankCode: "UPI",
      amount: 5000,
      name: "Timothy Gonzalez",
      phone: "18688984423",
      email: "w.gssdyohqr@chvro.cy",
      productInfo: "xxx-Rechange",
      notifyUrl: "http://wxyiwtonif.sj/vpuu",
      returnUrl:"https://www.baidu.com/",
      sign: "xxxxxxxx"
  }

    // const payloadd = {
    //   merchantOrderId: body?.order_id,
    //   userSubmittedUtr: body?.utr,
    //   amount: Number(body?.amount),
    //   status: body?.status,
    // };
    const payIn = await getPayInIntentDao(body?.order_id);

    const bankResponsePayload = `${body?.amount} nil ${payload.userSubmittedUtr} ${payIn.bank_acc_id}`;

    const utrAlreadyExist = await getBankResponseByUTR(
      payload.userSubmittedUtr,
    );

    if (utrAlreadyExist) {
      logger.warn(
        'Duplicate UTR received in onePay webhook:',
        payload.userSubmittedUtr,
      );
      return;
    }

    if (body?.status === 'success') {
      const bankResponse = await createBankResponseWebHookService(
        bankResponsePayload,
        payIn.company_id,
        'BOT',
        'onePay',
      );
      logger.info('Bank response created:', bankResponse);
    }
    logger.info('Calling processPayInWebHookService for payload', payload);
    const payin = await processPayInWebHookService(
      payload,
      '',
    );

    logger.info('PayIn processed:', payin);
  } catch (error) {
    logger.error('OnePay webhook error:', error);
  } finally {
    processingSet.delete(req.body?.transaction?.utr);
  }
};
