const { Cashfree } = require('cashfree-pg');
const { CFEnvironment } = require('cashfree-pg');
const { transactionWrapper } = require('../utils/db');
const { logger } = require('../utils/logger');
const { getPayInIntentDao } = require('../apis/payIn/payInDao');
const { sendSuccess } = require('../utils/responseHandlers');
const { processPayInService } = require('../apis/payIn/payInService');
const { createBankResponseService } = require('../apis/bankResponse/bankResponseServices');
const { cashfree: cashfreeConfig } = require('../config/config');

const cashfree = new Cashfree({
  env: CFEnvironment.SANDBOX,
  appId: cashfreeConfig.clientIdTest,
  secretKey: cashfreeConfig.clientSecretTest,
});

const cashfreeWebHook = async (req, res) => {
  const { rawBody, headers, body } = req;
  const signature = headers['x-webhook-signature'];
  const timestamp = headers['x-webhook-timestamp'];
  const { order, payment } = body.data;

  try {
    await cashfree.PGVerifyWebhookSignature(signature, rawBody, timestamp);
    
    const payIn = await getPayInIntentDao(order.order_id);
    if (!payIn) {
      logger.error('PayIn not found for order_id:', order.order_id);
      return sendSuccess(res, 200, 'Webhook received successfully', {});
    }

    if (payment.payment_status !== 'SUCCESS') {
      logger.error('Payment is either Failed or User Aborted:', payment.payment_status);
      return sendSuccess(res, 200, 'Webhook received successfully', {});
    }

    await createBankResponseService(
      `${order.order_amount} nil ${payment.bank_reference} ${payIn.bank_acc_id}`,
      payIn.company_id,
      'BOT',
      'CASHFREE'
    );

    await transactionWrapper(processPayInService)({
      merchantOrderId: order.order_id,
      userSubmittedUtr: payment.bank_reference,
      amount: order.order_amount,
    });

    return sendSuccess(res, 200, 'Webhook received successfully', {});
  } catch (err) {
    logger.error('Cashfree webhook error:', err.message);
    return sendSuccess(res, 200, 'Webhook received successfully', {});
  }
};

module.exports = {
  cashfree,
  cashfreeWebHook,
};