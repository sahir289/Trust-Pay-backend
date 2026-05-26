import axios from "axios";
import {sendNewSuccess} from "../utils/responseHandlers.js";
import { logger } from "../utils/logger.js";
import config  from "../config/config.js";
import { BadRequestError } from "../utils/appErrors.js";
import { getCompanyByIDDao } from "../apis/company/companyDao.js";
export const getWalletBalance = async (req, res) => {
  try {
    const company_id = req.user?.company_id;
    const [company] = await getCompanyByIDDao({ id: company_id });
    if(!company) {
        throw new BadRequestError('Company not found for the user');
      }
    const {key} = req.query;
    let secretKey, code;
    if (key === 'pennyPay'){
      secretKey = company?.config?.PENNY_PAY?.secretKey;
      code = company?.config?.PENNY_PAY?.code;
      if (!secretKey || !code) {
        throw new BadRequestError('PennyPay configuration is missing for the company');
      }
    }
    else {
      secretKey = company?.config?.TRUST_PAY?.secretKey;
      code = company?.config?.TRUST_PAY?.code;
      if (!secretKey || !code) {
        throw new BadRequestError('TrustPay configuration is missing for the company');
      }
    }
    const providerConfig = config[key];
    if (!providerConfig) throw new Error(`Configuration for key ${key} not found`);
    const url = providerConfig.walletBalanceUrl;
    if (!url) throw new Error(`WALLET_BALANCE_URL is missing for key ${key} in .env`);
    const response = await axios.get(
      url,
      {
        headers: {
          "x-api-key": secretKey,
          code: code,
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
export const createPennyPayPayout = async (result ,payload ,vendor_id ,bankId, key ,xApiKey, code) => {
  try {
    const providerConfig = config[key];
    const url = providerConfig.payoutUrl;
    if (!url) throw new BadRequestError('PENNY_PAY_PAYOUT_URL is missing in .env');
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
    result.vendor_id = vendor_id;
    return result;
  } catch (error) {
    logger.error(
      'PennyPay payout error:',
      error?.response?.data || error?.message || error,
    );
    throw error;
  }
};

