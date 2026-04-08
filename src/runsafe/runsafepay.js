import axios from 'axios';
import { getCompanyByIDDao } from '../apis/company/companyDao.js';
import { Status } from '../constants/index.js';
import { BadRequestError } from '../utils/appErrors.js';
import { logger } from '../utils/logger.js';
import { sendSuccess } from '../utils/responseHandlers.js';

/**
 * Get RupeeFlow API configuration
 * @param {object} company - Company object with RUPEE_FLOW config
 * @returns {object} - API configuration with headers and baseUrl
 */
const getRunsafePayApiConfig = (company) => {
  return {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': company.config.VERTEX_PAY.apiKey,
    },
    baseUrl: company.config.RUNSAFE_PAY.walletsPayoutsUrl,
  };
};

/**
 * Initiate VertexPay payout request
 * @param {object} payload - Single payload object
 * @param {string} company_id - Company ID
 * @param {string} uniqueId - Unique transaction ID
 * @returns {Promise<object>} - API response
 */
export const initiateRunsafePayPayout = async (
  payload,
  company_id,
) => {
  const newPayload = {
    amount: Number(payload.amount),
    name: payload?.user_bank_details?.account_holder_name || '',
    email: payload?.email || '',
    phone: payload?.phone || '',
    accountNumber: payload?.user_bank_details?.account_no,
    bankIfsc: payload?.user_bank_details?.ifsc_code,
    accountHolderName: payload?.user_bank_details?.account_holder_name || '',
    bankName: payload?.user_bank_details?.bank_name || '',
    upi: '',
    purpose: payload?.remarks || 'Payment for services rendered',
    merchantTransactionId: payload?.merchant_order_id,
  };

  logger.info('Initiating VertexPay payout with payload:', {
    company_id,
    merchant_order_id: payload?.merchant_order_id,
    merchantTransactionId: payload?.merchant_order_id,
  });

  try {
    const vertexPayWalletBalance = await getRunsafePayWalletBalance({
      company_id,
    });
    if (vertexPayWalletBalance.data.walletBalance < newPayload.amount) {
      throw new BadRequestError(`Insufficient VertexPay wallet balance. Required: ${newPayload.amount}, Available: ${vertexPayWalletBalance.data.walletBalance}`);
    }

    const [company] = await getCompanyByIDDao({ id: company_id });

    const apiConfig = getRunsafePayApiConfig(company);

    const response = await axios.post(
      `${apiConfig.baseUrl}/api/prod/payout`,
      newPayload,
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
 * Get VertexPay wallet balance
 * @param {object} reqOrParams - Request object or parameters containing company_id
 * @param {object} res - Response object (optional, for Express routes)
 * @returns {Promise<object>} - Wallet balance data
 */
export const getRunsafePayWalletBalance = async (reqOrParams, res) => {
  try {
    const isExpress = !!res; // if res exists then it's an API route
    const company_id = isExpress
      ? reqOrParams.user?.company_id
      : reqOrParams.company_id;

    const [company] = await getCompanyByIDDao({ id: company_id });

    const apiConfig = getRunsafePayApiConfig(company);

    const response = await axios.get(
      `${apiConfig.baseUrl}/api/prod/payout/balance`,
      {
        headers: apiConfig.headers,
      },
    );

    logger.info('runsafePay wallet balance response:', response.data);

    // Extract balance from response based on API structure
    const responseData = response.data;
    const data = {
      walletBalance: parseFloat(responseData?.payoutBalance || 0),
    };

    const successMsg = 'runsafePay wallet balance fetched successfully';
    if (isExpress) {
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
 * Create VertexPay payout with status handling (simplified like Clickrr)
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
  let checkVertexPay;
  try {
    // Ensure method exists
    if (!payload?.config?.method) {
      throw new Error('Payout method missing in payload');
    }

    if (payload.status) {
      checkVertexPay = { ...payload };
      delete payload.status;
    } else {
      checkVertexPay = await initiateRunsafePayPayout(
        singleWithdrawData,
        ids.company_id,
      );
    }

    payload.bank_acc_id = bankId;

    let statusCode;
    let payoutResp;

    if (checkVertexPay.status) {
      // Webhook format - status is already processed
      statusCode = checkVertexPay.status;
      payload.config.txnid = checkVertexPay.transactionId;

      logger.info('runsafePay webhook format processed:', {
        statusCode,
        txnid: checkVertexPay.transactionId,
      });
    } else {
      // API response format (new VertexPay)
      payoutResp = checkVertexPay?.data || checkVertexPay;
      statusCode = payoutResp?.status;
      payload.config.txnid = payoutResp?.transactionId;

      logger.info('runsafePay API response parsed:', {
        statusCode,
        message: payoutResp?.message,
      });
    }

    // Map status code to internal status
    if (statusCode === 2 || statusCode === 'success' || statusCode === 'SUCCESS' || statusCode === Status.APPROVED) {
      payload.status = Status.APPROVED;
      payload.utr_id = payload.utr_id || '';
      payload.approved_at = new Date().toISOString();
    } else if (statusCode === 0 || statusCode === 1 || statusCode === 'pending' || statusCode === 'PENDING' || statusCode === Status.PENDING) {
      payload.status = Status.PENDING;
    } else {
      payload.status = Status.REJECTED;
      payload.rejected_reason =
        (payoutResp?.message || checkVertexPay.rejected_reason || 'Transaction failed');
      payload.rejected_at = new Date().toISOString();
    }

    logger.info('runsafePay payout processed successfully:', payload);
    return payload;
  } catch (error) {
    payload.status = Status.REJECTED;
    payload.bank_acc_id = bankId;
    payload.utr_id = checkVertexPay?._id || '';
    payload.rejected_reason =
      error?.response?.data?.message || error.message || 'API call failed';
    payload.rejected_at = new Date().toISOString();

    logger.error('runsafePay payout error:', error.message);
    logger.warn('runsafePay payout error response', payload);
    return payload;
  }
};
