import axios from 'axios';
import { logger } from '../utils/logger.js';
import { sendSuccess } from '../utils/responseHandlers.js';
import { getCompanyByIDDao } from '../apis/company/companyDao.js';
import { payAssistErrorCodeMap, Status } from '../constants/index.js';
import { BadRequestError } from '../utils/appErrors.js';

/**
 * Initiate a single PayDum payout request (simplified like Clickrr)
 * @param {object} payload - Contains amount, user_bank_details, merchant_order_id, etc.
 * @param {string} company_id - Company ID
 * @returns {Promise<object>} - API response
 */
export const initiatePayDumPayout = async (payload, company_id) => {
  const newPayload = {
    agent_id: '', // Will be set from company config
    mode: payload.mode || 'IMPS',
    name: payload?.user_bank_details?.account_holder_name,
    account: payload?.user_bank_details?.account_no,
    bank: payload?.user_bank_details?.bank_name,
    ifsc: payload?.user_bank_details?.ifsc_code,
    mobile: '7428730894',
    amount: Number(payload.amount),
    latitude: '19.0760',
    longitude: '72.8527',
    apitxnid: payload?.merchant_order_id,
  };

  try {
    const payDumWalletBalance = await getPayDumWalletBalance({
      company_id,
    });
    if (payDumWalletBalance.data.wallet_balance < newPayload.amount) {
      throw new BadRequestError('Insufficient PayDum wallet balance');
    }
    if (newPayload.amount <= 100) {
      throw new BadRequestError('Payout amount must be greater than 100');
    }

    const [company] = await getCompanyByIDDao({ id: company_id });

    const apiConfig = {
      headers: {
        APIAGENT: company.config.PAY_DUM.walletsPayoutsAgent,
        APIKEY: company.config.PAY_DUM.walletsPayoutsApiKey,
      },
      baseUrl: company.config.PAY_DUM.walletsPayoutsUrl,
      agentCode: company.config.PAY_DUM.walletsPayoutsAgentCode,
    };

    newPayload.agent_id = apiConfig.agentCode;

    const response = await axios.post(`${apiConfig.baseUrl}/payout`, newPayload, {
      headers: apiConfig.headers,
    });

    logger.info('PayDum payout initiated successfully:', {
      merchant_order_id: payload?.merchant_order_id,
      data: response.data,
    });

    return response.data;
  } catch (error) {
    logger.error(
      'PayDum payout initiation failed:',
      error.response?.data || error.message || error,
    );
    throw error;
  }
};

/**
 * Get PayDum wallet balance
 * @param {object} reqOrParams - Request object or parameters containing company_id
 * @param {object} res - Response object (optional, for Express routes)
 * @returns {Promise<object>} - Wallet balance data
 */
export const getPayDumWalletBalance = async (reqOrParams, res) => {
  try {
    const isExpress = !!res; // if res exists then it's an API route
    const company_id = isExpress
      ? reqOrParams.user?.company_id
      : reqOrParams.company_id;

    const [company] = await getCompanyByIDDao({ id: company_id });

    const apiConfig = {
      headers: {
        APIAGENT: company.config.PAY_DUM.walletsPayoutsAgent,
        APIKEY: company.config.PAY_DUM.walletsPayoutsApiKey,
      },
      baseUrl: company.config.PAY_DUM.walletsPayoutsUrl,
      agentCode: company.config.PAY_DUM.walletsPayoutsAgentCode,
    };

    const balancePayload = {
      agent_id: apiConfig.agentCode,
    };

    const response = await axios.post(
      `${apiConfig.baseUrl}/checkbalance`,
      balancePayload,
      {
        headers: apiConfig.headers,
      },
    );

    logger.info('PayDum wallet balance response:', response.data);

    const data = {
      walletBalance: response.data?.Response?.Balance || 0,
      agent_id: apiConfig.agentCode,
      status: response.data?.ErrorCode === '0' ? 'success' : 'failed',
    };

    const successMsg = 'PayDum wallet balance fetched successfully';
    if (isExpress) {
      return sendSuccess(res, data, successMsg);
    } else {
      return { success: true, message: successMsg, data };
    }
  } catch (error) {
    logger.error(
      'Error fetching PayDum wallet balance:',
      error.response?.data || error.message || error,
    );
    throw error;
  }
};

/**
 * Create PayDum payout with status handling (simplified like Clickrr)
 * @param {object} payload - Payout payload
 * @param {object} ids - Contains id and company_id
 * @param {object} singleWithdrawData - Withdrawal data
 * @param {string} bankId - Bank ID
 * @returns {Promise<object>} - Updated payload with status
 */
export const createPayDumPayout = async (
  payload,
  ids,
  singleWithdrawData,
  bankId,
) => {
  let checkPayDum;
  try {
    // Ensure method exists
    if (!payload?.config?.method) {
      throw new Error('Payout method missing in payload');
    }

    if (payload.txnStatus) {
      checkPayDum = {...payload};
      delete payload.txnStatus;
    } else {
      checkPayDum = await initiatePayDumPayout(
        singleWithdrawData,
        ids.company_id,
      );
    }

    payload.bank_acc_id = bankId;

    // Status handling based on PayDum response
    const errorCode = checkPayDum?.ErrorCode;
    payload.config.txnid = checkPayDum?.Response?.txnid || '';
    if (!errorCode) {
      payload.status = Status.PENDING;
    } else if (errorCode === '0') {
      payload.status = Status.APPROVED;
      payload.utr_id =
        checkPayDum?.Response?.refno || checkPayDum?.Response?.utr || '';
      payload.approved_at = new Date().toISOString();
    } else if (errorCode === 'TUP') {
      payload.status = Status.PENDING;
    } else {
      payload.status = Status.REJECTED;
      payload.config.rejected_reason =
        checkPayDum?.Response?.message ||
        payAssistErrorCodeMap[checkPayDum?.Response?.statusCode] ||
        'Server Unreachable';
      payload.rejected_at = new Date().toISOString();
    }

    if (!payload.utr_id) {
      payload.utr_id = checkPayDum?.Response?.utr || '';
    }

    logger.info('PayDum payout processed successfully:', payload);
    return payload;
  } catch (error) {
    payload.status = Status.REJECTED;
    payload.bank_acc_id = bankId;
    payload.utr_id = checkPayDum?.Response?.utr || '';
    payload.rejected_reason =
      error?.response?.data?.message || error.message || 'API call failed';
    payload.rejected_at = new Date().toISOString();

    logger.error('PayDum payout error:', error.message);
    logger.warn('PayDum payout error response', payload);
    return payload;
  }
};
