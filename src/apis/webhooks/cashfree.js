import { Cashfree, CFEnvironment } from 'cashfree-pg';
import config from '../../config/config.js';
import { logger } from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { processPayInService } from '../payIn/payInService.js';
import { publishBankResponse } from '../../rabbitmq/producer.js';
import { getPayInIntentDao } from '../payIn/payInDao.js';

const env =
  config.env === 'production'
    ? CFEnvironment.PRODUCTION
    : CFEnvironment.SANDBOX;
const clientId =
  config.env === 'production'
    ? config.cashfree.clientIdProd
    : config.cashfree.clientIdTest;
const clientSecret =
  config.env === 'production'
    ? config.cashfree.clientSecretProd
    : config.cashfree.clientSecretTest;

const cashfree = new Cashfree(env, clientId, clientSecret);

export const cashfreeWebHook = async (req, res) => {
  try {
    sendSuccess(res, 200, 'Webhook received successfully');
    const rawBody = req.rawBody;
    const eventData = req.body;

    const {
      'x-webhook-signature': signature,
      'x-webhook-timestamp': timestamp,
    } = req.headers;

    try {
      cashfree.PGVerifyWebhookSignature(signature, rawBody, timestamp);

      logger.info('Webhook verified', eventData?.data?.payment);
    } catch (err) {
      logger.error('Verification failed:', err.message);
    }
    if (eventData?.data?.payment?.payment_status !== 'SUCCESS') {
      logger.error('Payment is either Failed or User Aborted');
    }
    const payload = {
      merchantOrderId: eventData?.data?.order?.order_id,
      userSubmittedUtr: eventData?.data?.payment?.bank_reference,
      amount: eventData?.data?.order?.order_amount,
    };
    const payIn = await getPayInIntentDao(eventData?.data?.order?.order_id);

    const bankResponsePayload = `${eventData?.data?.order?.order_amount} nil ${eventData?.data?.payment?.bank_reference} ${payIn.bank_acc_id}`;

    await processPayInService(payload);

    if (eventData?.data?.payment?.payment_status === 'SUCCESS') {
      const bankResponseObject = {
        payload: bankResponsePayload,
        x_auth_token: payIn.company_id,
        role: 'BOT',
        name: 'CASHFREE',
      };
      await publishBankResponse(bankResponseObject);
    }
  } catch (error) {
    logger.error('Cashfree webhook error:', error.message || error);
  }
};
