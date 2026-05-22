import axios from "axios";
import {sendNewSuccess} from "../utils/responseHandlers.js";
import { logger } from "../utils/logger.js";
import config  from "../config/config.js";
export const getWalletBalance = async (req, res) => {
  try {
    const response = await axios.get(
      process.env.WALLET_BALANCE_URL,
      {
        headers: {
          "x-api-key": process.env.X_API_KEY,
          code: process.env.CODE,
        },
      }
    );
   const data = response.data.data; 
   const successMsg = response.data.message || "Wallet balance fetched successfully";
    return sendNewSuccess(res, data, successMsg);
  } catch (error) {
    logger.error(
      "Wallet Balance Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};
export const createPennyPayPayout = async (result ,payload ,bankId, key) => {
  try {
    const providerConfig = config[key];
console.log('Provider Config:', providerConfig);
    const url = providerConfig.payoutUrl;
    if (!url) throw new Error('PENNY_PAY_PAYOUT_URL is missing in .env');
    const xApiKey = providerConfig.secretKey;
    const code = providerConfig.code;
    if (!code) throw new Error('CODE is missing in .env');
    if (!xApiKey) throw new Error('X_API_KEY is missing in .env');
    const requestBody =  {
    user: payload?.user,
    merchant_order_id: payload?.merchant_order_id,
    code: code,
    amount: payload?.amount,
    acc_no: payload?.user_bank_details?.account_no,
    acc_holder_name: payload?.user_bank_details?.account_holder_name,
    ifsc_code: payload?.user_bank_details?.ifsc_code,
    bank_name: payload?.user_bank_details?.bank_name,
  };
  const response = await axios.post(url, requestBody, {
      headers: {
        'x-api-key': xApiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000
    });
    logger.info('PennyPay payout initiated successfully:', {
      merchant_order_id: payload?.merchant_order_id,
      merchantTransactionId: payload?.merchant_order_id,
      data: response.data,
    });
    result.status = 'PENDING';
    result.bank_acc_id = bankId;
    return result;
  } catch (error) {
    logger.error(
      'PennyPay payout error:',
      error?.response?.data || error?.message || error,
    );
    throw error;
  }
};

