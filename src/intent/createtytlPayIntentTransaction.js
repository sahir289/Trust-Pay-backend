import crypto from 'crypto';
import axios from 'axios';
import { logger } from '../utils/logger.js';
import config from '../config/config.js';

export const createtytlPaymentTransaction = async (
  providerKey,
  deposit,
  amount
) => {
  try {
    const providerConfig = config[providerKey];
    if (!providerConfig) {
      throw new Error(`Invalid provider: ${providerKey}`);
    }

    // Replace with your API Key and Secret
const apiKey = providerConfig.apiKey;
const apiSecret = providerConfig.secretKey;

// Request body
const requestBody = {
    isBuyTrade: 1,
    userDetails: {},
    merchantOrderId: deposit.merchant_order_id,
    callBackUrl: providerConfig.NotifyUrl,
    redirectUrl: deposit?.config?.urls?.return,
    isUTRNeeded: 1,
    currencySymbol: "INR",
    amount: deposit.amount || amount,
    isKYCNeeded: 0,
    userEmail: "test@test.com"
    // (required if isKYCNeeded is 0)
};

// Convert request body to JSON
const raw = JSON.stringify(requestBody);

// Function to create HMAC SHA-256 signature
const createSignature = (secret, data) => {
    return crypto.createHmac('sha256', secret)
                 .update(data)
                 .digest('hex');
};

// Generate signature
const signature = createSignature(apiSecret, raw);

// Define headers
const headers = {
    "Content-Type": "application/json",
    "X-TLP-APIKEY": apiKey,
    "X-TLP-SIGNATURE": signature
};

// Send the request
const response = await axios.post(`${providerConfig.payinUrl}`, raw, { headers })
    logger.info(`${providerKey} transaction created:`, {
      requestBody,
      response: response?.data,
    });

    return response.data.data;
  } catch (error) {
    logger.error(`Error creating ${providerKey} transaction:`, {
      error: error.response?.data || error.message || error,
    });
    throw error;
  }
};
