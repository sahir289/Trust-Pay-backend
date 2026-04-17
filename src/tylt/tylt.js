import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';

const TYLT_BASE_URL = 'https://api.tylt.money';
const TYLT_API_KEY = process.env.TYLT_API_KEY;
const TYLT_API_SECRET = process.env.TYLT_API_SECRET;

/**
 * Generate HMAC-SHA256 signature on a raw JSON string using the Tylt API secret.
 * @param {string} rawBody - The raw JSON-stringified request body.
 * @returns {string} Hex-encoded HMAC-SHA256 signature.
 */
const generateTyltSignature = (rawBody) => {
  return crypto
    .createHmac('sha256', TYLT_API_SECRET)
    .update(rawBody)
    .digest('hex');
};

/**
 * Create a Tylt P2P PayIn instance.
 * @param {object} params
 * @param {string} params.orderId        - Merchant order ID (our merchantOrderId)
 * @param {number} params.amount         - INR amount
 * @param {string} params.email          - Customer email
 * @param {string} params.redirectUrl    - Return URL after payment
 * @param {string} params.userId         - Customer user ID
 * @returns {Promise<{ paymentUrl: string, instanceId: string }>}
 */
export const createTyltPayIn = async ({
  orderId,
  amount,
  email,
  redirectUrl,
}) => {
  try {
    const requestBody = {
      isBuyTrade: 1,
      userDetails: {},
      merchantOrderId: orderId,
      callBackUrl: process.env.TYLT_CALLBACK_URL,
      redirectUrl: redirectUrl,
      isUTRNeeded: 1,
      currencySymbol: 'USDT',
      amount: String(amount),
      isKYCNeeded: 1,
      ...(email && { userEmail: email }),
    };

    const rawBody = JSON.stringify(requestBody);
    const signature = generateTyltSignature(rawBody);

    logger.info(`[Tylt] Creating instance for orderId: ${orderId}`, {
      amount: requestBody.amount,
      hasEmail: !!email,
    });

    const response = await axios.post(
      `${TYLT_BASE_URL}/p2pRampsMerchant/createInstance`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-TLP-APIKEY': TYLT_API_KEY,
          'X-TLP-SIGNATURE': signature,
        },
        timeout: 15000,
      },
    );

    const { instanceId, url } = response.data.data;

    if (!instanceId || !url) {
      logger.error('Tylt createInstance missing instanceId or url', {
        instanceId,
        url,
      });
      throw new Error('Tylt createInstance returned incomplete response');
    }

    return {
      instanceId,
      paymentUrl: url,
    };
  } catch (error) {
    logger.error(
      'Tylt createInstance error:',
      error.response?.data || error.message,
    );
    throw error;
  }
};

/**
 * Check payment status for a Tylt instance/merchant order ID.
 * Typically used as a manual fallback or in a cron job for stuck pending cases.
 * @param {string} orderId - Merchant order ID
 * @returns {Promise<object>} Status data from Tylt
 */
export const checkTyltPaymentStatus = async (orderId) => {
  try {
    const signature = generateTyltSignature(JSON.stringify({ merchantOrderId: orderId }));

    const response = await axios.get(
      `${TYLT_BASE_URL}/p2pRampsMerchant/getInstanceDetails?merchantOrderId=${orderId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-TLP-APIKEY': TYLT_API_KEY,
          'X-TLP-SIGNATURE': signature,
        },
        timeout: 10000,
      },
    );

    return response.data?.data?.transaction || response.data?.transaction;
  } catch (error) {
    logger.error(
      `Tylt checkStatus error for orderId ${orderId}:`,
      error.response?.data || error.message,
    );
    throw error;
  }
};
