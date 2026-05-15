import axios from 'axios';
import { getCompanyByIDDao } from '../apis/company/companyDao.js';
import { Status } from '../constants/index.js';
import { BadRequestError } from '../utils/appErrors.js';
import { logger } from '../utils/logger.js';
import { generateSign } from '../intent/createOnePayIntentTransaction.js';
import config from '../config/config.js';
import { sendSuccess } from '../utils/responseHandlers.js';
import { getISTDateString } from '../helpers/index.js';

/**
 * Get RupeeFlow API configuration
 * @param {object} company - Company object with RUPEE_FLOW config
 * @returns {object} - API configuration with headers and baseUrl
 */
const getRunsafePayApiConfig = () => {
  return {
    headers: {
      'Content-Type': 'application/json'
    },
  };
};

/**
 * Initiate Runsafe payout request
 * @param {object} payload - Single payload object
 * @param {string} company_id - Company ID
 * @param {string} uniqueId - Unique transaction ID
 * @returns {Promise<object>} - API response
 */
export const initiateRunsafePayPayout = async (
  payload,
  company_id,
) => {
  console.log('Initiating runsafe payout with payload:', payload)

  const providerConfig = config['runsafe'];
  const payoutNotifyUrl = providerConfig.payoutNotifyUrl;
  const newPayload = {
    mchId: 3558644692,
    txChannel: "TX_INDIA_001",
    appId: "BSahxNHf56acIa47Xo5KRWM8gbs=",
    timestamp: Date.now(),
    mchOrderNo: payload?.merchant_order_id,
    name: payload?.user_bank_details?.account_holder_name || '',
    phone: payload?.phone || '',
    email: payload?.email || '',
    bankCode: "BANK_IN",
    ifsc: payload?.user_bank_details?.ifsc_code,
    account: payload?.user_bank_details?.account_no,
    amount: Number(payload.amount),
    notifyUrl: payoutNotifyUrl,
  }
  const sign = generateSign(newPayload, providerConfig.privateKey);

  logger.info('Initiating runsafe payout with payload:', {
    company_id,
    merchant_order_id: payload?.merchant_order_id,
    merchantTransactionId: payload?.merchant_order_id,
  });

  try {
    const runsafePayWalletBalance = await getRunsafePayWalletBalance();
    if (runsafePayWalletBalance?.data?.balance < newPayload.amount) {
      throw new BadRequestError(`Insufficient runsafePay wallet balance. Required: ${newPayload.amount}, Available: ${runsafePayWalletBalance?.data?.balance}`);
    }

    const [company] = await getCompanyByIDDao({ id: company_id });

    const apiConfig = getRunsafePayApiConfig(company);

    const response = await axios.post(
      `${providerConfig.baseUrl}${providerConfig.initiatePayout}`,
      {...newPayload, sign},
      {
        headers: apiConfig.headers,
      },
    );

    logger.info('runsafePay payout initiated successfully:', {
      merchant_order_id: payload?.merchant_order_id,
      merchantTransactionId: payload?.merchant_order_id,
      data: response.data,
    });

    return response.data;
  } catch (error) {
    logger.error(
      'runsafePay payout initiation failed:',
      error.response?.data || error.message || error,
    );
    throw error;
  }
};

/**
 * Get runsafePay wallet balance
 * @param {object} reqOrParams - Request object or parameters containing company_id
 * @param {object} res - Response object (optional, for Express routes)
 * @returns {Promise<object>} - Wallet balance data
 */
export const getRunsafePayWalletBalance = async (req, res) => {
  try {
    console.log('Fetching runsafePay wallet balance', req);
    const body = {
      mchId: 3558644692,
      timestamp: Date.now()
    }
    const providerConfig = config['runsafe'];
    // const [company] = await getCompanyByIDDao({ id: company_id });
    const sign = generateSign(body , providerConfig.privateKey);    
    const response = await axios.post(
      `https://api-in.transafe.co/cashout/balance`,{...body, sign: sign},
    );

    logger.info('runsafePay wallet balance response:', response.data);

    // Extract balance from response based on API structure
    const data = response.data.data;

    const successMsg = 'runsafePay wallet balance fetched successfully';
    if (res) {
      return sendSuccess(res, data, successMsg);
    } else {
      return { success: true, message: successMsg, data };
    }
  } catch (error) {
    logger.error(
      'Error fetching runsafePay wallet balance:',
      error.response?.data || error.message || error,
    );
    throw error;
  }
};

/**
 * Create runsafePay payout with status handling (simplified like Clickrr)
 * @param {object} payload - Payout payload
 * @param {object} ids - Contains id and company_id
 * @param {object} singleWithdrawData - Withdrawal data
 * @param {string} bankId - Bank ID
 * @returns {Promise<object>} - Updated payload with status
 */
export const createRunsafePayPayout = async (
  payload,
  ids,
  singleWithdrawData,
  bankId,
) => {
  let checkRunsafePay;
  try {
    // Ensure method exists
    if (!payload?.config?.method) {
      throw new Error('Payout method missing in payload');
    }

    if (payload.status) {
      checkRunsafePay = { data:payload };
      delete payload.status;
    } else {
      checkRunsafePay = await initiateRunsafePayPayout(
        singleWithdrawData,
        ids.company_id,
      );
    }

    payload.bank_acc_id = bankId;

    let statusCode;
    let payoutResp;
    if (checkRunsafePay?.data?.orderStatus) {
      // Webhook format - status is already processed
      statusCode = checkRunsafePay?.data?.orderStatus;
      if(checkRunsafePay?.data?.platOrderNo){   
        payload.config.txnid = checkRunsafePay?.data?.platOrderNo;
      }

      logger.info('runsafePay webhook format processed:', {
        statusCode,
        txnid: checkRunsafePay.data.platOrderNo,
      });
    } else {
      // API response format (new RunsafePay response structure)
      payoutResp = checkRunsafePay?.data || checkRunsafePay;
      statusCode = checkRunsafePay?.data?.orderStatus || '';
      payload.config.txnid = checkRunsafePay?.data?.platOrderNo || '';

      logger.info('runsafePay API response parsed:', {
        statusCode,
        message: payoutResp?.message,
      });
    }

    // Map status code to internal status
    if (statusCode === 200 || statusCode === 'success' || statusCode === 'SUCCESS' || statusCode === Status.APPROVED) {
      payload.status = Status.APPROVED;
      payload.utr_id = payload.utr_id || '';
      payload.approved_at = new Date().toISOString();
    } else if (statusCode === 'FAILED' || statusCode === 'REJECTED' || statusCode === Status.REJECTED) {
      payload.status = Status.REJECTED;
      payload.utr_id = payload.utr_id || '';
      payload.config.rejected_reason =
      payload.description || 'Transaction failed';
      payload.rejected_at = new Date().toISOString();
    } else if (statusCode === 'REVERSED' || statusCode === Status.REVERSED) {
      payload.status = Status.REVERSED;
      payload.config.reversed_at = getISTDateString()
    }
    else {
      payload.status = Status.PENDING;
    }
    if (payload?.platOrderNo) {
      delete payload.platOrderNo;
    }
    if(payload?.orderStatus) {
      delete payload.orderStatus;
    }
    logger.info('runsafePay payout processed successfully:', payload);
    return payload;
  } catch (error) {
    payload.status = Status.PENDING;
    payload.bank_acc_id = bankId;
    payload.utr_id = checkRunsafePay?._id || '';
    payload.rejected_reason =
      error?.response?.data?.message || error.message || 'API call failed';
    payload.rejected_at = new Date().toISOString();

    logger.error('runsafePay payout error:', error.message);
    logger.warn('runsafePay payout error response', payload);
    return payload;
  }
};
