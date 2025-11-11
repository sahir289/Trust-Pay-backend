import { getBankByIdDao } from '../apis/bankAccounts/bankaccountDao.js';
import { getCompanyByIDDao } from '../apis/company/companyDao.js';
import { getPayoutBankDetailsDao } from '../apis/payOut/payOutDao.js';
import { updatePayoutService } from '../apis/payOut/payOutService.js';
import { getVendorsDao } from '../apis/vendors/vendorDao.js';
import { Status } from '../constants/index.js';
import { BadRequestError, NotFoundError } from '../utils/appErrors.js';
import { apiRequest, retryAxiosRequest } from '../utils/axios.js';
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

    const response = await retryAxiosRequest(
      async () => {
        return await apiRequest(
          'post',
          `${apiConfig.baseUrl}/Create_payout_app`,
          {
            data: newPayload,
            headers: apiConfig.headers,
            timeout: 30000,
            maxRedirects: 5,
            validateStatus: (status) => status < 500,
          },
        );
      },
      3,
      1000,
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
 * Process multiple TataPay payout requests (for backward compatibility)
 * @param {object} payload - Contains mode, payOutids, company_id
 * @param {string} updatedBy - User ID who initiated the request
 * @returns {Promise<Array>} - Array of payout results
 */
export const tataPayPayoutsService = async (payload, updatedBy) => {
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

          const response = await initiateTataPayPayout(
            singlePayload,
            payload.company_id,
          );

          // Check status if needed
          let statusResponse = null;
          if (response.payoutId) {
            const queryParams = {
              searchKey: response.payoutId,
              page: 1,
              limit: 10,
            };

            const apiConfig = {
              headers: {
                'x-api-key': company.config.TATA_PAY.walletsPayoutsApiKey,
              },
              baseUrl: company.config.TATA_PAY.walletsPayoutsUrl,
            };

            statusResponse = await retryAxiosRequest(
              async () => {
                return apiRequest('get', `${apiConfig.baseUrl}/Search_payout`, {
                  headers: apiConfig.headers,
                  params: queryParams,
                  timeout: 15000,
                  maxRedirects: 3,
                  validateStatus: (status) => status < 500,
                });
              },
              2,
              500,
            );
          }

          // Handle response and update payout status
          const bankId = company.config.TATA_PAY.defaultBankId;
          const [bankVendor] = await getBankByIdDao({ id: bankId });
          const [vendor] = await getVendorsDao({
            user_id: bankVendor.user_id,
          });

          const updatePayload = {
            updated_by: updatedBy,
            bank_acc_id: bankId,
            vendor_id: vendor.id,
            config: {
              method: 'TataPay',
              txnid: response._id || response.payoutId,
            },
          };

          const status =
            statusResponse?.data?.payouts?.[0]?.status || 'pending';
          if (status === 'completed' || status === 'success') {
            Object.assign(updatePayload, {
              status: Status.APPROVED,
              utr_id: statusResponse.data.payouts[0].Bank_Utr || response._id,
              approved_at: new Date().toISOString(),
            });
          } else if (status === 'processing' || status === Status.PENDING) {
            Object.assign(updatePayload, {
              status: Status.PENDING,
            });
          } else {
            updatePayload.config.rejected_reason =
              statusResponse?.data?.payouts?.[0]?.remark ||
              'Transaction failed';
            updatePayload.rejected_at = new Date().toISOString();
          }

          const apiResponse = await updatePayoutService(
            { id: info.id, company_id: payload.company_id },
            updatePayload,
          );

          return apiResponse;
        } catch (error) {
          logger.error(`Error processing TataPay payout ${info.id}:`, error);
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
    logger.error('Error in TataPay payout service:', error);
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

    const response = await retryAxiosRequest(
      async () => {
        return await apiRequest('get', `${apiConfig.baseUrl}/me`, {
          headers: apiConfig.headers,
          timeout: 15000,
          maxRedirects: 3,
          validateStatus: (status) => status < 500,
        });
      },
      2,
      500,
    );

    logger.info('TataPay wallet balance response:', response.data);

    // Extract balance from response - adjust based on actual API response structure
    const data = {
      walletBalance: response.data?.balance || response.data?.user?.credit || response.data?.credit || 0,
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
