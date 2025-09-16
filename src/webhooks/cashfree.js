import crypto from 'crypto';
import config from '../config/config.js';
import { logger } from '../utils/logger.js';
import { sendSuccess } from '../utils/responseHandlers.js';
import { AuthenticationError } from '../utils/appErrors.js';

const clientSecret =
  config.env === 'production'
    ? config.cashfree.clientSecretProd
    : config.cashfree.clientSecretTest;

export const cashfreeWebHook = async (req, res, next) => {
  try {
    const signature = req.headers['x-webhook-signature'];
    const rawBody = req.body.toString('utf-8');
    const WEBHOOK_SECRET = clientSecret;

    const computedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(rawBody)
      .digest('base64');

    if (signature === computedSignature) {
      logger.log('Webhook verified:', req.body);
      return sendSuccess(res, 200, 'Webhook received successfully');
    } else {
      throw new AuthenticationError('Invalid webhook signature');
    }
  } catch (error) {
    logger.error('Cashfree webhook error:', error);
    return next(error);
  }
};
