const { razorpay: rzConfig } = require('../config/config');
const { logger } = require('../utils/logger');
const { env } = require('../config/config');

const razorpay = env === 'test' ? {
  webhooks: {
    verifySignature: () => true,
  },
  orders: {
    create: async () => ({ id: 'test_order_id', receipt: 'test_receipt' }),
  },
} : require('razorpay')({
  key_id: rzConfig.clientIdTest,
  key_secret: rzConfig.clientSecretTest,
});

const razorPayWebHook = async (req) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const order = req.body.order;
    const payment = req.body.payment;

    // Verify webhook signature
    const isValidSignature = razorpay.webhooks.verifySignature(
      JSON.stringify(req.body),
      signature,
      rzConfig.webhookSecret
    );

    if (!isValidSignature) {
      logger.error('Invalid RazorPay webhook signature');
      return { status: 200, message: 'Webhook received' };
    }

    // Process the webhook data
    if (payment.status === 'captured') {
      // Handle successful payment
      logger.info('RazorPay payment captured:', {
        orderId: order.id,
        paymentId: payment.id,
        amount: payment.amount,
      });
    }

    return { status: 200, message: 'Webhook processed successfully' };
  } catch (err) {
    logger.error('Error processing RazorPay webhook:', err);
    return { status: 200, message: 'Webhook received' };
  }
};

module.exports = {
  razorpay,
  razorPayWebHook,
};