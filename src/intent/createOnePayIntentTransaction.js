import crypto from 'crypto';
import axios from 'axios';
import { logger } from '../utils/logger.js';
import config from '../config/config.js';

/**
 * Generate SHA512 hash for a given provider
 * @param {Object} body - The transaction details (amount, order_id, etc.)
 * @param {Object} providerConfig - The provider config containing salt and collectionId.
 */
// export function generateSign({ mId, mOrderId, amount, timestamp, secret }) {
//   const raw = `${mId}${mOrderId}${amount}${timestamp}${secret}`;
//   return crypto.createHash("md5").update(raw).digest("hex");
// }

function getSignString(params) {
  // Clone object (avoid mutation)
  const newParams = { ...params };

  // Remove 'sign'
  delete newParams.sign;

  // Sort keys
  const sortedKeys = Object.keys(newParams).sort();

  const array = [];

  for (const  key of sortedKeys) {
      const value = newParams[key];

      // PHP empty() equivalent check
      if (
          value !== undefined &&
          value !== null &&
          value !== "" &&
          value !== 0 &&
          value !== "0"
      ) {
          array.push(`${key}=${value}`);
      }
  }

  return array.join("&");
}

export function generateSign(params, privateKey, algorithm = "RSA-SHA256") {
    // Step 1: create sign string (you need same logic as PHP getSignString)
    const signString = getSignString(params);

    // Step 2: format private key
    const formattedKey = `${privateKey}`;

    // Step 3: create signer
    const signer = crypto.createSign(algorithm);

    signer.update(signString);
    signer.end();

    // Step 4: generate signature (base64)
    const signature = signer.sign(formattedKey, "base64");

    return signature;
}
/**
 * Create a payment transaction for a given provider.
 * @param {string} providerKey - Key from config (e.g. "zentechind" or "nmplPay")
 * @param {Object} deposit - Deposit object containing whole payin details
 * @param {number|string} amount - Transaction amount
 */

export const createOnePayPaymentTransaction = async (
  providerKey,
  deposit,
  amount
) => {
  try {
    const providerConfig = config[providerKey];
    if (!providerConfig) {
      throw new Error(`Invalid provider: ${providerKey}`);
    }

    // const body = {
    //   mId: providerConfig.silkPayMerchant,
    //   mOrderId: deposit.merchant_order_id,
    //   amount: deposit.amount || amount,
    //   timestamp: Date.now(),
    //   notifyUrl: providerConfig.silkPayCallbackUrl,
    //   returnUrl: deposit?.config?.urls?.return || '',
    // };
    const body = {
      mchId: 3558644692,
      txChannel: "TX_INDIA_001",
      appId: "BSahxNHf56acIa47Xo5KRWM8gbs=",
      timestamp: Date.now(),
      mchOrderNo: deposit.merchant_order_id,
      bankCode: "UPI",
      amount: deposit.amount || amount,
      name: "Timothy Gonzalez",
      phone: "18688984423",
      email: "w.gssdyohqr@chvro.cy",
      productInfo: "xxx-Rechange",
      notifyUrl: providerConfig.NotifyUrl,
      returnUrl: deposit?.config?.urls?.return,
  } ;

    if ( !body.mchId || !body.mchOrderNo || !body.amount || !body.timestamp) {
      throw new Error('Invalid transaction data');
    }

    const sign = generateSign(body , providerConfig.privateKey);
    console.log("Generated sign:", sign);
    const requestBody = { ...body, sign };

    const response = await axios.post(`${providerConfig.url}`, requestBody, {
      headers: { 
              'Content-Type': 'application/json',
              'lang': 'en',
            },
    });

    logger.info(`${providerKey} transaction created:`, {
      requestBody,
      response: response.data,
    });

    return response.data.data;
  } catch (error) {
    logger.error(`Error creating ${providerKey} transaction:`, {
      error: error.response?.data || error.message || error,
    });
    throw error;
  }
};
