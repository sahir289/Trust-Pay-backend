import { getBankByIdDao } from '../apis/bankAccounts/bankaccountDao.js';
import { getCompanyByIDDao } from '../apis/company/companyDao.js';
import { getPayoutBankDetailsDao } from '../apis/payOut/payOutDao.js';
import { updatePayoutService } from '../apis/payOut/payOutService.js';
import { getVendorsDao } from '../apis/vendors/vendorDao.js';
import { Status } from '../constants.js';
import { BadRequestError, NotFoundError } from '../utils/appErrors.js';
import { apiRequest, retryAxiosRequest } from '../utils/axios.js';
import { logger } from '../utils/logger.js';

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

    // Cache API configuration to avoid repeated property access
    const apiConfig = {
      headers: {
        'x-api-key': company.config.TATA_PAY.walletsPayoutsApiKey,
      },
      baseUrl: company.config.TATA_PAY.walletsPayoutsUrl,
    };

    // Use Promise.all to send all payout requests in parallel for better performance
    const payOuts = await Promise.all(
      PayOuts.map(async (info) => {
        try {
          const apiPayload = {
            beneficiaryCode: info.user_bank_details.account_holder_name,
            beneficiaryName: info.user_bank_details.account_holder_name,
            beneficiaryAddress: '123 Main St, Anytown',
            beneficiaryaccountNumber: info.user_bank_details.account_no,
            ifsc: info.user_bank_details.ifsc_code,
            bankName: info.user_bank_details.bank_name,
            paymentMethod: mode,
            Amount: info.amount,
            remark: 'Payment for services rendered',
          };

          logger.info(`Processing payout for ID ${info.id}:`, apiPayload);

          const response = await retryAxiosRequest(
            async () => {
              return await apiRequest(
                'post',
                `${apiConfig.baseUrl}/Create_payout_app`,
                {
                  data: apiPayload,
                  headers: apiConfig.headers,
                  timeout: 30000, // 30 second timeout
                  maxRedirects: 5,
                  validateStatus: (status) => status < 500, // Resolve only if status < 500
                },
              );
            },
            3,
            1000,
          ); // 3 retries with 1s delay

          logger.info(`Payout response for ID ${info.id}:`, response.data);
          let apiResponse = null;

          let statusResponse = null;

          // Transaction Under Process - check status
          const queryParams = {
            searchKey: response.data.payoutId,
            page: 1,
            limit: 10,
          }; // Include transaction ID in payload

          statusResponse = await retryAxiosRequest(
            async () => {
              return apiRequest('get', `${apiConfig.baseUrl}/Search_payout`, {
                headers: apiConfig.headers,
                params: queryParams,
                timeout: 15000, // 15 second timeout for status check
                maxRedirects: 3,
                validateStatus: (status) => status < 500,
              });
            },
            2,
            500,
          ); // 2 retries with 500ms base delay for status checks
          logger.info(
            `TataPay payoutStatus response for apitxnid ${info.id}:`,
            statusResponse.data,
          );

          // Helper function to handle payout updates
          const handlePayoutUpdate = async (
            responseData,
            isApproved = false,
            isTransactionUnderProcess = false,
          ) => {
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
              },
            };

            if (responseData._id) {
              updatePayload.config.txnid = responseData._id;
            }

            if (isApproved) {
              Object.assign(updatePayload, {
                status: Status.APPROVED,
                utr_id: isTransactionUnderProcess
                  ? responseData._id
                  : responseData.Bank_Utr,
                approved_at: new Date().toISOString(),
              });
            } else if (!isApproved && isTransactionUnderProcess) {
              Object.assign(updatePayload, {
                status: Status.PENDING,
              });
            } else {
              updatePayload.config.rejected_reason =
                responseData.remark || 'Server Unreachable';
              updatePayload.rejected_at = new Date().toISOString();
            }

            apiResponse = await updatePayoutService(
              // conn,
              { id: info.id, company_id: payload.company_id },
              updatePayload,
            );
          };

          if (
            statusResponse.data.payouts[0].status === 'processing' ||
            statusResponse.data.payouts[0].status === Status.PENDING
          ) {
            await handlePayoutUpdate(
              statusResponse.data.payouts[0],
              false,
              true,
            );
          }

          // Return formatted response
          // const finalErrorCode =
          //   errorCode === 'TUP'
          //     ? statusResponse?.data?.ErrorCode || 'TUP'
          //     : errorCode;

          // return {
          //   id: info.id,
          //   status: finalErrorCode === '0' ? Status.APPROVED : Status.REJECTED,
          //   utr_id:
          //     finalErrorCode === '0'
          //       ? statusResponse?.data?.Response?.refno ||
          //         response.data.Response?.refno
          //       : null,
          //   rejected_reason:
          //     finalErrorCode !== '0'
          //       ? payAssistErrorCodeMap[finalErrorCode] || 'Server Unreachable'
          //       : null,
          // };
          return apiResponse;
        } catch (error) {
          logger.error(`Error processing payout ${info.id}:`, error);
          // Return error response for this specific payout instead of failing entire batch
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
    logger.error('Error in walletsPayoutsService:', error);
    throw error;
  }
};
