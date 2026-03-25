import axios from 'axios';
import { getCompanyByIDDao } from '../apis/company/companyDao.js';
import { Method, Status } from '../constants/index.js';
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
      checkTataPay = { ...payload };
      delete payload.txnStatus;
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

/**
 * Create TataPay bulk payout from entries/IDs
 * @param {Array} payoutEntries - Array of payout entries or IDs
 * @param {string} company_id - Company ID
 * @param {function} getPayoutData - Function to get payout data if IDs are provided
 * @param {function} updatePayoutStatus - Function to update payout status in bulk
 * @param {object} rabbitMQ - RabbitMQ instance for bulk updates
 * @returns {Promise<object>} - API response
 */
export const createTataPayBulkPayout = async (
  payoutEntries,
  company_id,
  getPayoutData = null,
  updatePayoutStatus = null,
  rabbitMQ = null,
) => {
  try {
    if (!payoutEntries || payoutEntries.length === 0) {
      throw new BadRequestError('No payout entries provided');
    }

    const [company] = await getCompanyByIDDao({ id: company_id });

    if (!company?.config?.TATA_PAY) {
      throw new BadRequestError('TataPay configuration not found for company');
    }

    // Validate bank configuration
    const defaultBankId = company.config.TATA_PAY.defaultBankId;
    if (!defaultBankId || defaultBankId.trim() === '') {
      throw new BadRequestError(
        'TataPay default bank ID not configured for company',
      );
    }

    logger.info('Using TataPay bank configuration:', {
      company_id,
      defaultBankId,
      hasTataPayConfig: !!company.config.TATA_PAY,
    });

    // Get payout data - either from entries directly or fetch by IDs
    let payoutData = payoutEntries;

    if (getPayoutData && typeof payoutEntries[0] === 'string') {
      // If entries are IDs, fetch the actual data
      logger.info('Fetching payout data for IDs:', payoutEntries);
      payoutData = await getPayoutData(payoutEntries, company_id);
    }

    if (!payoutData || payoutData.length === 0) {
      throw new BadRequestError('No valid payout data found');
    }

    // Convert data to TataPay format
    const bulkPayoutData = [];
    const payoutIds = [];
    const invalidEntries = [];

    for (const entry of payoutData) {
      try {
        // Create TataPay format for each entry (matching validation rules)
        const tataPayFormat = {
          id: entry.id, // Unique ID for each payout row
          beneficiaryCode: entry.user_bank_details.account_holder_name,
          beneficiaryName: entry.user_bank_details.account_holder_name,
          beneficiaryAddress: '123 Main St, Anytown',
          beneficiaryaccountNumber: entry.user_bank_details.account_no,
          ifsc: entry.user_bank_details.ifsc_code,
          bankName: entry.user_bank_details.bank_name,
          paymentMethod: 'IMPS',
          Amount: Number(entry.amount),
          remark: 'Payment for services rendered',
        };

        // Validate required fields
        if (
          !tataPayFormat.beneficiaryaccountNumber ||
          !tataPayFormat.ifsc ||
          !tataPayFormat.Amount
        ) {
          logger.warn('Skipping invalid entry:', entry);
          invalidEntries.push(entry);
          continue;
        }

        bulkPayoutData.push(tataPayFormat);
        payoutIds.push(entry.id);
      } catch (entryError) {
        logger.error('Error processing entry:', entryError.message, entry);
        invalidEntries.push(entry);
        continue;
      }
    }

    if (bulkPayoutData.length === 0) {
      throw new BadRequestError('No valid payout records found to process');
    }

    // Log the prepared data for debugging
    logger.info('TataPay bulk payout data prepared:', {
      company_id,
      totalRecords: bulkPayoutData.length,
      sampleEntry: bulkPayoutData[0], // Log first entry for structure verification
    });

    // Prepare API config for JSON request
    const apiConfig = {
      headers: {
        'x-api-key': company.config.TATA_PAY.walletsPayoutsApiKey,
        'Content-Type': 'application/json',
      },
      baseUrl: company.config.TATA_PAY.walletsBulkPayoutsUrl,
    };

    logger.info('TataPay API config:', {
      url: apiConfig.baseUrl,
      hasApiKey: !!apiConfig.headers['x-api-key'],
      dataSize: JSON.stringify(bulkPayoutData).length,
    });

    // Send JSON data directly to TataPay API
    const response = await axios.post(
      `${apiConfig.baseUrl}`,
      bulkPayoutData, // Send JSON array directly
      {
        headers: apiConfig.headers,
        timeout: 30000, // 30 second timeout
        validateStatus: function (status) {
          return status < 500; // Don't throw for 4xx errors, we'll handle them
        },
      },
    );

    // Check if the response was successful
    if (response.status !== 200 && response.status !== 201) {
      logger.error('TataPay API returned error status:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        headers: response.headers,
      });

      // Handle specific error cases
      if (response.status === 400) {
        const errorMessage =
          response.data?.message ||
          response.data?.error ||
          (typeof response.data === 'string'
            ? response.data
            : 'Invalid request data');
        throw new BadRequestError(
          `TataPay API validation error: ${errorMessage}`,
        );
      }

      throw new Error(
        `TataPay API error: ${response.status} - ${response.statusText}`,
      );
    }

    logger.info('TataPay bulk payout JSON sent successfully:', {
      company_id,
      totalRecords: bulkPayoutData.length,
      response: response.data,
    });

    // Handle response and update status in bulk using RabbitMQ
    if (response.data && updatePayoutStatus && rabbitMQ) {
      // Process TataPay bulk response format
      const bulkResponse = response.data;
      const successfulPayouts = [];
      const failedPayouts = [];

      // Process each result in the response
      if (bulkResponse.results && Array.isArray(bulkResponse.results)) {
        logger.info(
          `Processing ${bulkResponse.results.length} TataPay bulk response results`,
        );

        bulkResponse.results.forEach((result, index) => {
          // Map based on the id field in the response to our payout entry id
          const matchedEntry = bulkPayoutData.find(
            (entry) => entry.id === result.id,
          );

          if (!matchedEntry) {
            logger.warn(
              `No matching payout entry found for response id: ${result.id} at index ${index}`,
              {
                result,
                availableIds: bulkPayoutData.map((e) => e.id).slice(0, 5),
              },
            );
            return;
          }

          const payoutId = matchedEntry.id;
          logger.info(
            `Mapped response result.id ${result.id} to payout entry.id ${payoutId}`,
          );

          if (result.success) {
            successfulPayouts.push({
              payoutId: payoutId,
              txnid: result.payoutId,
              beneficiaryId: result.beneficiaryId,
              balanceAfter: result.balanceAfter,
              message: result.message,
              originalEntryId: result.id, // Keep track of original mapping
            });
          } else {
            failedPayouts.push({
              payoutId: payoutId,
              rejected_reason: result.message || 'Transaction failed',
              failedRow: result.row,
              originalEntryId: result.id, // Keep track of original mapping
            });
          }
        });
      }

      // Prepare bulk update data for successful payouts
      if (successfulPayouts.length > 0) {
        const successBulkUpdateData = {
          payoutIds: successfulPayouts.map((p) => p.payoutId),
          status: Status.PENDING, // Initially pending, callback will update to final status
          bank_acc_id: defaultBankId,
          config: {
            method: Method.TATAPAY,
          },
          // Map individual transaction data
          individualUpdates: successfulPayouts.map((payout) => ({
            payoutId: payout.payoutId,
            bank_acc_id: defaultBankId,
            config: {
              method: Method.TATAPAY,
              txnid: payout.txnid,
            },
            utr_id: payout.txnid, // Use txnid as UTR ID
            status: Status.PENDING,
            approved_at: new Date().toISOString(),
          })),
        };

        try {
          // Send to RabbitMQ for async processing (if worker exists)
          await rabbitMQ.sendMessage(
            'bulk_payout_queue',
            successBulkUpdateData,
          );
          logger.info(
            'Successful payouts sent to RabbitMQ:',
            successBulkUpdateData,
          );

          // Also immediately update database as there's no active consumer
          if (updatePayoutStatus) {
            // Update each payout individually to ensure proper field mapping
            for (const update of successBulkUpdateData.individualUpdates) {
              await updatePayoutStatus([update.payoutId], {
                status: update.status,
                bank_acc_id: update.bank_acc_id,
                config: update.config,
                approved_at: update.approved_at,
                updated_at: new Date().toISOString(),
              });
            }
            logger.info('Successful payouts updated directly in database');
          }
        } catch (mqError) {
          logger.error(
            'Failed to send successful updates to RabbitMQ:',
            mqError.message,
          );
          // Fallback to direct database update
          if (updatePayoutStatus) {
            // Update each payout individually to ensure proper field mapping
            for (const update of successBulkUpdateData.individualUpdates) {
              await updatePayoutStatus([update.payoutId], {
                status: update.status,
                bank_acc_id: update.bank_acc_id,
                config: update.config,
                approved_at: update.approved_at,
                updated_at: new Date().toISOString(),
              });
            }
          }
        }
      }

      // Prepare bulk update data for failed payouts
      if (failedPayouts.length > 0) {
        const failedBulkUpdateData = {
          payoutIds: failedPayouts.map((p) => p.payoutId),
          status: Status.REJECTED,
          bank_acc_id: defaultBankId,
          config: {
            method: Method.TATAPAY,
          },
          // Map individual transaction data
          individualUpdates: failedPayouts.map((payout) => ({
            payoutId: payout.payoutId,
            status: Status.REJECTED,
            bank_acc_id: defaultBankId,
            rejected_reason: payout.rejected_reason,
            rejected_at: new Date().toISOString(),
            config: {
              method: Method.TATAPAY,
              txnid: null, // No transaction ID for failed payouts
            },
          })),
        };

        try {
          // Send to RabbitMQ for async processing (if worker exists)
          await rabbitMQ.sendMessage(
            'bulk_payout_queue',
            failedBulkUpdateData,
          );
          logger.info('Failed payouts sent to RabbitMQ:', failedBulkUpdateData);

          // Also immediately update database as there's no active consumer
          if (updatePayoutStatus) {
            // Update each payout individually to ensure proper field mapping
            for (const update of failedBulkUpdateData.individualUpdates) {
              await updatePayoutStatus([update.payoutId], {
                status: update.status,
                config: update.config,
                bank_acc_id: update.bank_acc_id,
                rejected_reason: update.rejected_reason,
                rejected_at: update.rejected_at,
                updated_at: new Date().toISOString(),
              });
            }
            logger.info('Failed payouts updated directly in database');
          }
        } catch (mqError) {
          logger.error(
            'Failed to send failed updates to RabbitMQ:',
            mqError.message,
          );
          // Fallback to direct database update
          if (updatePayoutStatus) {
            // Update each payout individually to ensure proper field mapping
            for (const update of failedBulkUpdateData.individualUpdates) {
              await updatePayoutStatus([update.payoutId], {
                status: update.status,
                config: update.config,
                bank_acc_id: update.bank_acc_id,
                rejected_reason: update.rejected_reason,
                rejected_at: update.rejected_at,
                updated_at: new Date().toISOString(),
              });
            }
          }
        }
      }
    }

    return {
      success: true,
      message: 'Bulk payout processed successfully',
      data: {
        uploadId: response.data?.uploadId || response.data?.id,
        totalRecords: bulkPayoutData.length,
        validRecords: bulkPayoutData.length,
        invalidRecords: invalidEntries.length,
        // Include TataPay response statistics
        totalpayout: response.data?.totalpayout || bulkPayoutData.length,
        successpayout: response.data?.successpayout || 0,
        skippayout: response.data?.skippayout || 0,
        status: 'processed',
        processedIds: payoutIds,
        invalidEntries: invalidEntries,
        results: response.data?.results || [],
        ...response.data,
      },
    };
  } catch (error) {
    // Enhanced error logging for debugging
    logger.error('TataPay bulk payout upload failed:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      headers: error.response?.headers,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers,
        dataSize: error.config?.data
          ? JSON.stringify(error.config.data).length
          : 0,
      },
    });

    // Handle TataPay specific error responses
    if (error.response?.status === 400) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        (typeof error.response?.data === 'string'
          ? error.response.data
          : 'Invalid request format or missing required fields');

      logger.error('TataPay 400 error details:', {
        responseData: error.response.data,
        requestDataSample: error.config?.data
          ? JSON.parse(error.config.data)?.[0]
          : null, // Log sample of sent data
        totalRecords: error.config?.data
          ? JSON.parse(error.config.data)?.length
          : 0,
      });

      throw new BadRequestError(`TataPay validation error: ${errorMessage}`);
    }

    if (error.response?.status === 401) {
      throw new BadRequestError('Invalid API key or authentication failed');
    }

    if (error.response?.status === 413) {
      throw new BadRequestError('File size too large');
    }

    if (error.response?.status === 500) {
      const errorMessage =
        error.response?.data?.error ||
        (typeof error.response?.data === 'string'
          ? error.response.data
          : 'Server error occurred');
      throw new BadRequestError(`TataPay server error: ${errorMessage}`);
    }

    throw error;
  }
};
