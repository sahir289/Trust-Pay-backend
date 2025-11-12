import axios from 'axios';
import { getCompanyByIDDao } from '../apis/company/companyDao.js';
import { Status } from '../constants/index.js';
import { BadRequestError } from '../utils/appErrors.js';
import { logger } from '../utils/logger.js';
import { sendSuccess } from '../utils/responseHandlers.js';

/**
 * Initiate a single TataPay payout request (simplified like Clickrr)
 * @param {object} payload - Contains amount, user_bank_details, merchant_order_id, etc.
 * @param {string} company_id - Company ID
 * @returns {Promise<object>} - API response
 */
export const initiateTataPayPayout = async (payload, company_id) => {
  const newPayload = {
    beneficiaryCode: payload?.user_bank_details?.account_holder_name,
    beneficiaryName: payload?.user_bank_details?.account_holder_name,
    beneficiaryAddress: '123 Main St, Anytown',
    beneficiaryaccountNumber: payload?.user_bank_details?.account_no,
    ifsc: payload?.user_bank_details?.ifsc_code,
    bankName: payload?.user_bank_details?.bank_name,
    paymentMethod: payload.mode || 'IMPS',
    Amount: Number(payload.amount),
    remark: 'Payment for services rendered',
  };

  try {
    const tataPayWalletBalance = await getTataPayWalletBalance({ company_id });
    if (tataPayWalletBalance.data.wallet_balance < newPayload.Amount) {
      throw new BadRequestError('Insufficient TataPay wallet balance');
    }

    const [company] = await getCompanyByIDDao({ id: company_id });

    const apiConfig = {
      headers: {
        'x-api-key': company.config.TATA_PAY.walletsPayoutsApiKey,
      },
      baseUrl: company.config.TATA_PAY.walletsPayoutsUrl,
    };

    const response = await axios.post(
      `${apiConfig.baseUrl}/Create_payout_app`,
      newPayload,
      {
        headers: apiConfig.headers,
      },
    );
    logger.info('TataPay payout initiated successfully:', {
      merchant_order_id: payload?.merchant_order_id,
      data: response.data,
    });

    return response.data;
  } catch (error) {
    logger.error(
      'TataPay payout initiation failed:',
      error.response?.data || error.message || error,
    );
    throw error;
  }
};

/**
 * Get TataPay wallet balance
 * @param {object} reqOrParams - Request object or parameters containing company_id
 * @param {object} res - Response object (optional, for Express routes)
 * @returns {Promise<object>} - Wallet balance data
 */
export const getTataPayWalletBalance = async (reqOrParams, res) => {
  try {
    const isExpress = !!res; // if res exists then it's an API route
    const company_id = isExpress
      ? reqOrParams.user?.company_id
      : reqOrParams.company_id;

    const [company] = await getCompanyByIDDao({ id: company_id });

    const apiConfig = {
      headers: {
        'x-api-key': company.config.TATA_PAY.walletsPayoutsApiKey,
      },
      baseUrl: company.config.TATA_PAY.walletsPayoutsUrl,
    };

    const response = await axios.get(`${apiConfig.baseUrl}/me`, {
      headers: apiConfig.headers,
    });

    logger.info('TataPay wallet balance response:', response.data);

    // Extract balance from response - adjust based on actual API response structure
    const data = {
      walletBalance:
        response.data?.balance ||
        response.data?.user?.credit ||
        response.data?.credit ||
        0,
      status: response.data?.status || 'active',
    };

    const successMsg = 'TataPay wallet balance fetched successfully';
    if (isExpress) {
      return sendSuccess(res, data, successMsg);
    } else {
      return { success: true, message: successMsg, data };
    }
  } catch (error) {
    logger.error(
      'Error fetching TataPay wallet balance:',
      error.response?.data || error.message || error,
    );
    throw error;
  }
};

/**
 * Create TataPay payout with status handling (simplified like Clickrr)
 * @param {object} payload - Payout payload
 * @param {object} ids - Contains id and company_id
 * @param {object} singleWithdrawData - Withdrawal data
 * @param {string} bankId - Bank ID
 * @returns {Promise<object>} - Updated payload with status
 */
export const createTataPayPayout = async (
  payload,
  ids,
  singleWithdrawData,
  bankId,
) => {
  let checkTataPay;
  try {
    // Ensure method exists
    if (!payload?.config?.method) {
      throw new Error('Payout method missing in payload');
    }

    if (payload.txnStatus) {
      delete payload.txnStatus;
      checkTataPay = payload;
    } else {
      checkTataPay = await initiateTataPayPayout(
        singleWithdrawData,
        ids.company_id,
      );
    }

    payload.bank_acc_id = bankId;

    // Status handling based on TataPay response
    const status = checkTataPay?.status || 'pending';
    payload.config.txnid = checkTataPay?.payoutId || '';
    if (status === 'completed' || status === 'success') {
      payload.status = Status.APPROVED;
      payload.utr_id = checkTataPay?.Bank_Utr || checkTataPay?._id || '';
      payload.approved_at = new Date().toISOString();
    } else if (status === 'processing' || status === 'pending') {
      payload.status = Status.PENDING;
    } else {
      payload.status = Status.REJECTED;
      payload.rejected_reason = checkTataPay?.remark || 'Transaction failed';
      payload.rejected_at = new Date().toISOString();
    }

    if (!payload.utr_id) {
      payload.utr_id = checkTataPay?._id || checkTataPay?.Bank_Utr || '';
    }

    logger.info('TataPay payout processed successfully:', payload);
    return payload;
  } catch (error) {
    payload.status = Status.REJECTED;
    payload.bank_acc_id = bankId;
    payload.utr_id = checkTataPay?._id || '';
    payload.rejected_reason =
      error?.response?.data?.message || error.message || 'API call failed';
    payload.rejected_at = new Date().toISOString();

    logger.error('TataPay payout error:', error.message);
    logger.warn('TataPay payout error response', payload);
    return payload;
  }
};
