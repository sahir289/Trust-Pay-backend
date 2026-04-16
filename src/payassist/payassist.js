import axios from 'axios';
import { logger } from '../utils/logger.js';
import { sendSuccess } from '../utils/responseHandlers.js';
import { getCompanyByIDDao } from '../apis/company/companyDao.js';
import { payAssistErrorCodeMap, Status } from '../constants/index.js';
import { BadRequestError } from '../utils/appErrors.js';

const isPayAssistDuplicateRetryResponse = (response = {}) =>
  response?.ErrorCode === '11' ||
  /same transaction not allowed in 5 minutes/i.test(
    response?.ErrorMessage || '',
  );

/**
 * Initiate a single PayAssist payout request (simplified like Clickrr)
 * @param {object} payload - Contains amount, user_bank_details, merchant_order_id, etc.
 * @param {string} company_id - Company ID
 * @returns {Promise<object>} - API response
 */
export const initiatePayAssistPayout = async (payload, company_id) => {
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
    const payAssistWalletBalance = await getPayAssistWalletBalance({
      company_id,
    });
    if (payAssistWalletBalance.data.wallet_balance < newPayload.amount) {
      throw new BadRequestError('Insufficient PayAssist wallet balance');
    }
    if (newPayload.amount <= 100) {
      throw new BadRequestError('Payout amount must be greater than 100');
    }

    const [company] = await getCompanyByIDDao({ id: company_id });

    const apiConfig = {
      headers: {
        APIAGENT: company.config.PAY_ASSIST.walletsPayoutsAgent,
        APIKEY: company.config.PAY_ASSIST.walletsPayoutsApiKey,
      },
      baseUrl: company.config.PAY_ASSIST.walletsPayoutsUrl,
      agentCode: company.config.PAY_ASSIST.walletsPayoutsAgentCode,
    };

    newPayload.agent_id = apiConfig.agentCode;

    const response = await axios.post(`${apiConfig.baseUrl}/payout`, newPayload, {
      headers: apiConfig.headers,
    });

    logger.info('PayAssist payout initiated successfully:', {
      merchant_order_id: payload?.merchant_order_id,
      data: response.data,
    });

    return response.data;
  } catch (error) {
    logger.error(
      'PayAssist payout initiation failed:',
      error.response?.data || error.message || error,
    );
    throw error;
  }
};

/**
 * Get PayAssist wallet balance
 * @param {object} reqOrParams - Request object or parameters containing company_id
 * @param {object} res - Response object (optional, for Express routes)
 * @returns {Promise<object>} - Wallet balance data
 */
export const getPayAssistWalletBalance = async (reqOrParams, res) => {
  try {
    const isExpress = !!res; // if res exists then it's an API route
    const company_id = isExpress
      ? reqOrParams.user?.company_id
      : reqOrParams.company_id;

    const [company] = await getCompanyByIDDao({ id: company_id });

    const apiConfig = {
      headers: {
        APIAGENT: company.config.PAY_ASSIST.walletsPayoutsAgent,
        APIKEY: company.config.PAY_ASSIST.walletsPayoutsApiKey,
      },
      baseUrl: company.config.PAY_ASSIST.walletsPayoutsUrl,
      agentCode: company.config.PAY_ASSIST.walletsPayoutsAgentCode,
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

    logger.info('PayAssist wallet balance response:', response.data);

    const data = {
      walletBalance: response.data?.Response?.Balance || 0,
      agent_id: apiConfig.agentCode,
      status: response.data?.ErrorCode === '0' ? 'success' : 'failed',
    };

    const successMsg = 'PayAssist wallet balance fetched successfully';
    if (isExpress) {
      return sendSuccess(res, data, successMsg);
    } else {
      return { success: true, message: successMsg, data };
    }
  } catch (error) {
    logger.error(
      'Error fetching PayAssist wallet balance:',
      error.response?.data || error.message || error,
    );
    throw error;
  }
};

/**
 * Create PayAssist payout with status handling (simplified like Clickrr)
 * @param {object} payload - Payout payload
 * @param {object} ids - Contains id and company_id
 * @param {object} singleWithdrawData - Withdrawal data
 * @param {string} bankId - Bank ID
 * @returns {Promise<object>} - Updated payload with status
 */
export const createPayAssistPayout = async (
  payload,
  ids,
  singleWithdrawData,
  bankId,
) => {
  let checkPayAssist;
  try {
    // Ensure method exists
    if (!payload?.config?.method) {
      throw new Error('Payout method missing in payload');
    }

    if (payload.txnStatus) {
      checkPayAssist = {...payload};
      delete payload.txnStatus;
    } else {
      checkPayAssist = await initiatePayAssistPayout(
        singleWithdrawData,
        ids.company_id,
      );
    }

    if (isPayAssistDuplicateRetryResponse(checkPayAssist)) {
      logger.warn(
        'PayAssist duplicate transaction retry response received; skipping payout update',
        {
          merchant_order_id: singleWithdrawData?.merchant_order_id,
          data: checkPayAssist,
        },
      );
      return {
        ...payload,
        skipPayoutUpdate: true,
      };
    }

    payload.bank_acc_id = bankId;

    // Status handling based on PayAssist response
    const errorCode = checkPayAssist?.ErrorCode;
    payload.config.txnid = checkPayAssist?.Response?.txnid || '';
    if (!errorCode) {
      payload.status = Status.PENDING;
    } else if (errorCode === '0') {
      payload.status = Status.APPROVED;
      payload.utr_id =
        checkPayAssist?.Response?.refno || checkPayAssist?.Response?.utr || '';
      payload.approved_at = new Date().toISOString();
    } else if (errorCode === 'TUP') {
      payload.status = Status.PENDING;
    } else {
      payload.status = Status.REJECTED;
      payload.config.rejected_reason =
        checkPayAssist?.Response?.message ||
        payAssistErrorCodeMap[checkPayAssist?.Response?.statusCode] ||
        'Server Unreachable';
      payload.rejected_at = new Date().toISOString();
    }

    if (!payload.utr_id) {
      payload.utr_id = checkPayAssist?.Response?.utr || '';
    }

    logger.info('PayAssist payout processed successfully:', payload);
    return payload;
  } catch (error) {
    payload.status = Status.REJECTED;
    payload.bank_acc_id = bankId;
    payload.utr_id = checkPayAssist?.Response?.utr || '';
    payload.rejected_reason =
      error?.response?.data?.message || error.message || 'API call failed';
    payload.rejected_at = new Date().toISOString();

    logger.error('PayAssist payout error:', error.message);
    logger.warn('PayAssist payout error response', payload);
    return payload;
  }
};
