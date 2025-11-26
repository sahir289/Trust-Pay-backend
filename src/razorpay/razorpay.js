import { Currency } from '../constants/index.js';
import { logger } from '../utils/logger.js';
import { BadRequestError } from '../utils/appErrors.js';
import { razorpay } from '../apis/webhooks/razorPay.js';
import crypto from "crypto";



export const createRazorPayOrder = async (deposit, amount) => {
  try {
    const options = {
      amount: amount || deposit?.amount, // convert to paise
      currency: Currency.INR,
      receipt: "receipt_" + Date.now(),
    };

    const order = await razorpay.orders.create(options);
    return order;
  } catch (error) {
    logger.error(
      'Cashfree order creation error:',
      error.response?.data || error.message,
    );
  }

};

export const verifyRazorPaySignature = async (orderId, paymentId, signature) => {
  if (!orderId || !paymentId || !signature) {
    throw new BadRequestError('Missing required parameters for verification');
  }
  const generatedSignature = crypto
    .createHmac('sha256', process.env.RAZOR_PAY_SECRET)
    .update(orderId + '|' + paymentId)
    .digest('hex');
  
  return generatedSignature === signature;

};

