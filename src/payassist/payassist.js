import axios from 'axios';
import { logger } from '../utils/logger.js';
import { sendSuccess } from '../utils/responseHandlers.js';
import { getCompanyByIDDao } from '../apis/company/companyDao.js';
import { getPayoutBankDetailsDao } from '../apis/payOut/payOutDao.js';
import { updatePayoutService } from '../apis/payOut/payOutService.js';
import { getBankByIdDao } from '../apis/bankAccounts/bankaccountDao.js';
import { getVendorsDao } from '../apis/vendors/vendorDao.js';
import { Status } from '../constants/index.js';
import { BadRequestError, NotFoundError } from '../utils/appErrors.js';
import { retryAxiosRequest } from '../utils/axios.js';

/**
 * PayAssist error code mapping for better error messages
 */
const payAssistErrorCodeMap = {
  0: 'Success',
  1: 'Transaction Failed',
  2: 'Insufficient Balance',
  3: 'Invalid Account Details',
  TUP: 'Transaction Under Process',
  default: 'Server Unreachable',
};

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

    const response = await retryAxiosRequest(
      async () => {
        return await axios.post(`${apiConfig.baseUrl}/payout`, newPayload, {
          headers: apiConfig.headers,
          timeout: 30000,
          maxRedirects: 5,
          validateStatus: (status) => status < 500,
        });
      },
      3,
      1000,
    );

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
 * Process multiple PayAssist payout requests (for backward compatibility)
 * @param {object} payload - Contains mode, payOutids, company_id
 * @param {string} updatedBy - User ID who initiated the request
 * @returns {Promise<Array>} - Array of payout results
 */
export const processPayAssistPayouts = async (conn, payload, updatedBy) => {
  try {
    const { mode, payOutids } = payload;

    if (!mode) {
      throw new BadRequestError('TransactionType is required');
    }

    const PayOuts = await getPayoutBankDetailsDao(
      { payOutids: payOutids },
      payload.company_id,
    );

    if (!PayOuts[0]) {
      throw new NotFoundError('Payout not found');
    }

    const [company] = await getCompanyByIDDao({
      id: payload.company_id,
    });

    // Process each payout using the simplified function
    const payOuts = await Promise.all(
      PayOuts.map(async (info) => {
        try {
          const singlePayload = {
            amount: info.amount,
            mode: mode,
            user_bank_details: info.user_bank_details,
            merchant_order_id: info.id,
          };

          const response = await initiatePayAssistPayout(
            singlePayload,
            payload.company_id,
          );

          // Handle response and update payout status
          const bankId = company.config.PAY_ASSIST.defaultBankId;
          const [bankVendor] = await getBankByIdDao({ id: bankId });
          const [vendor] = await getVendorsDao({
            user_id: bankVendor.user_id,
          });

          const updatePayload = {
            updated_by: updatedBy,
            bank_acc_id: bankId,
            vendor_id: vendor.id,
            config: {
              method: 'PayAssist',
              txnid: response.txnid || null,
            },
          };

          const errorCode = response?.ErrorCode;
          if (errorCode === '0') {
            Object.assign(updatePayload, {
              status: Status.APPROVED,
              utr_id: response.Response?.refno || response.Response?.utr,
              approved_at: new Date().toISOString(),
            });
          } else if (errorCode === 'TUP') {
            Object.assign(updatePayload, {
              status: Status.PENDING,
            });
          } else {
            updatePayload.config.rejected_reason =
              payAssistErrorCodeMap[errorCode] || 'Server Unreachable';
            updatePayload.rejected_at = new Date().toISOString();
          }

          const apiResponse = await updatePayoutService(
            conn,
            { id: info.id, company_id: payload.company_id },
            updatePayload,
          );

          return apiResponse;
        } catch (error) {
          logger.error(`Error processing PayAssist payout ${info.id}:`, error);
          return {
            id: info.id,
            status: Status.REJECTED,
            utr_id: null,
            rejected_reason: 'API Request Failed',
          };
        }
      }),
    );

    return payOuts;
  } catch (error) {
    logger.error('Error in PayAssist payout service:', error);
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

    const response = await retryAxiosRequest(
      async () => {
        return await axios.post(
          `${apiConfig.baseUrl}/checkbalance`,
          balancePayload,
          {
            headers: apiConfig.headers,
            timeout: 15000,
            maxRedirects: 3,
            validateStatus: (status) => status < 500,
          },
        );
      },
      2,
      500,
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
      delete payload.txnStatus;
      checkPayAssist = payload;
    } else {
      checkPayAssist = await initiatePayAssistPayout(
        singleWithdrawData,
        ids.company_id,
      );
    }

    payload.bank_acc_id = bankId;

    // Status handling based on PayAssist response
    const errorCode = checkPayAssist?.ErrorCode;
    if (errorCode === '0') {
      payload.status = Status.APPROVED;
      payload.utr_id =
        checkPayAssist?.Response?.refno || checkPayAssist?.Response?.utr || '';
      payload.approved_at = new Date().toISOString();
    } else if (errorCode === 'TUP') {
      payload.status = Status.PENDING;
    } else {
      payload.status = Status.REJECTED;
      payload.rejected_reason =
        payAssistErrorCodeMap[errorCode] || 'Transaction failed';
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
