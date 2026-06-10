import Razorpay from 'razorpay';
import crypto from 'crypto';
import { logger } from '../../utils/logger.js';

export const razorpay = new Razorpay({
  key_id: process.env.RAZOR_PAY_ID,
  key_secret: process.env.RAZOR_PAY_SECRET,
});

// Webhook handler
export const handleRazorpayWebhook = async (req, res) => {
  try {
    const secret = process.env.RAZOR_PAY_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    const body = req.body;
    const eventBody = body.payload.payment ? body.payload.payment.entity : null;

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(eventBody.order_id + '|' + eventBody.id)
      .digest('hex');
    if (signature !== expectedSignature) {
      logger.error('Invalid Razorpay webhook signature');
      return res.status(400).json({ message: 'Invalid signature' });
    }

    // Process the webhook event
    const event = req.body.event;
    logger.info(`Razorpay webhook received: ${event}`);

    switch (event) {
      case 'payment.authorized':
        // Handle payment authorized event
        logger.info('Payment authorized:', req.body.payload.payment.entity);
        break;

      case 'payment.failed':
        // Handle payment failed event
        logger.info('Payment failed:', req.body.payload.payment.entity);
        break;

      case 'order.paid':
        // Handle order paid event
        logger.info('Order paid:', req.body.payload.order.entity);
        break;

      default:
        logger.warn(`Unhandled Razorpay event: ${event}`);
    }

    res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (error) {
    logger.error('Error handling Razorpay webhook:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


