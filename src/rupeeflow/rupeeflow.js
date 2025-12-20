import axios from 'axios';
import { getCompanyByIDDao } from '../apis/company/companyDao.js';
import { Method, Status } from '../constants/index.js';
import { BadRequestError } from '../utils/appErrors.js';
import { logger } from '../utils/logger.js';
import { sendSuccess } from '../utils/responseHandlers.js';
import { customAlphabet } from 'nanoid';
import { getPayoutByTxnId } from '../apis/payOut/payOutDao.js';

// Create alphanumeric-only nanoid
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 20);

/**
 * Get RupeeFlow API configuration
 * @param {object} company - Company object with RUPEE_FLOW config
 * @returns {object} - API configuration with headers and baseUrl
 */
const getRupeeFlowApiConfig = (company) => {
  const clientId = company.config.RUPEE_FLOW.clientId;
  const clientSecret = company.config.RUPEE_FLOW.clientSecret;
  const authString = `${clientId}:${clientSecret}`;
  const encodedAuth = Buffer.from(authString).toString('base64');
  
  return {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${encodedAuth}`,
    },
    baseUrl: company.config.RUPEE_FLOW.walletsPayoutsUrl,
  };
};

/**
 * Initiate a single RupeeFlow payout request (simplified like Clickrr)
 * @param {object} payload - Contains amount, user_bank_details, merchant_order_id, etc.
 * @param {string} company_id - Company ID
 * @returns {Promise<object>} - API response
 */
export const initiateRupeeFlowPayout = async (payload, company_id, uniqueId) => {
  const newPayload = {
    data: [
      {
        amount: Number(payload.amount),
        purpose: 'Payment for services rendered',
        beneficiaryName: payload?.user_bank_details?.account_holder_name,
        bankName: payload?.user_bank_details?.bank_name,
        accountNumber: payload?.user_bank_details?.account_no,
        ifscCode: payload?.user_bank_details?.ifsc_code,
        remarks: payload?.remarks || 'Payment for services rendered',
        transferMode: payload.mode || 'IMPS',
        beneficiaryMobile: '9457863670',
        payoutId: uniqueId,
      },
    ],
  };

  logger.info('Initiating RupeeFlow payout with payload:', {
    company_id,
    merchant_order_id: payload?.merchant_order_id,
    data: newPayload,
  });

  try {
    const rupeeFlowWalletBalance = await getRupeeFlowWalletBalance({ company_id });
    if (rupeeFlowWalletBalance.data.walletBalance < newPayload.data[0].amount) {
      throw new BadRequestError('Insufficient RupeeFlow wallet balance');
    }

    const [company] = await getCompanyByIDDao({ id: company_id });

    const apiConfig = getRupeeFlowApiConfig(company);

    const response = await axios.post(
      `${apiConfig.baseUrl}/api/v1/payments/v2/payout/create`,
      newPayload,
      {
        headers: apiConfig.headers,
      },
    );

    logger.info('RupeeFlow payout initiated successfully:', {
      merchant_order_id: payload?.merchant_order_id,
      data: response.data,
    });

    return response.data;
  } catch (error) {
    logger.error(
      'RupeeFlow payout initiation failed:',
      error.response?.data || error.message || error,
    );
    throw error;
  }
};

/**
 * Get RupeeFlow wallet balance
 * @param {object} reqOrParams - Request object or parameters containing company_id
 * @param {object} res - Response object (optional, for Express routes)
 * @returns {Promise<object>} - Wallet balance data
 */
export const getRupeeFlowWalletBalance = async (reqOrParams, res) => {
  try {
    const isExpress = !!res; // if res exists then it's an API route
    const company_id = isExpress
      ? reqOrParams.user?.company_id
      : reqOrParams.company_id;

    const [company] = await getCompanyByIDDao({ id: company_id });

    const apiConfig = getRupeeFlowApiConfig(company);

    const response = await axios.get(
      `${apiConfig.baseUrl}/api/v1/payments/payout/wallet`,
      {
        headers: apiConfig.headers,
      },
    );

    logger.info('RupeeFlow wallet balance response:', response.data);

    // Extract balance from response based on API structure
    const responseData = response.data?.data || response.data;
    const data = {
      walletBalance: parseFloat(responseData?.availablePayoutBalance || 0),
      walletId: responseData?.id || '',
      user: responseData?.user || {},
    };

    const successMsg = 'RupeeFlow wallet balance fetched successfully';
    if (isExpress) {
      return sendSuccess(res, data, successMsg);
    } else {
      return { success: true, message: successMsg, data };
    }
  } catch (error) {
    logger.error(
      'Error fetching RupeeFlow wallet balance:',
      error.response?.data || error.message || error,
    );
    throw error;
  }
};

/**
 * Create RupeeFlow payout with status handling (simplified like Clickrr)
 * @param {object} payload - Payout payload
 * @param {object} ids - Contains id and company_id
 * @param {object} singleWithdrawData - Withdrawal data
 * @param {string} bankId - Bank ID
 * @returns {Promise<object>} - Updated payload with status
 */
export const createRupeeFlowPayout = async (
  payload,
  ids,
  singleWithdrawData,
  bankId,
) => {
  let checkRupeeFlow;
  try {
    // Ensure method exists
    if (!payload?.config?.method) {
      throw new Error('Payout method missing in payload');
    }

    // Generate unique ID with TXN prefix and timestamp (e.g., TXN3728662222)
    const timestamp = Date.now().toString();
    let uniqueId = `TXN${timestamp}${nanoid(2)}`;
    const existingPayout = await getPayoutByTxnId(uniqueId);
    
    // If a payout with this txnid already exists, generate a new one
    if (existingPayout) {
      uniqueId = `TXN${Date.now().toString()}${nanoid(2)}`;
      logger.info('Generated duplicate uniqueId, regenerated new one:', {
        oldId: existingPayout.config?.txnid,
        newId: uniqueId,
      });
    }

    if (payload.txnStatus) {
      checkRupeeFlow = { ...payload };
      delete payload.txnStatus;
    } else {
      checkRupeeFlow = await initiateRupeeFlowPayout(
        singleWithdrawData,
        ids.company_id,
        uniqueId,
      );
    }

    payload.bank_acc_id = bankId;

    // Handle two different response formats:
    // 1. API response: { data: { data: { batchId, payoutOrders: [...] } } }
    // 2. Webhook format: { txnStatus, utr_id, config: { orderId, txnRefId, txnid } }
    
    let status;
    let orderId;
    let batchId;
    
    if (checkRupeeFlow.txnStatus) {
      // Webhook format - status is already processed
      status = checkRupeeFlow.txnStatus.toUpperCase();
      orderId = checkRupeeFlow.config?.orderId || checkRupeeFlow.utr_id;
      payload.config.txnid = checkRupeeFlow.config?.txnid || uniqueId;
      payload.config.orderId = checkRupeeFlow.config?.orderId;
      payload.config.txnRefId = checkRupeeFlow.config?.txnRefId;
      
      logger.info('RupeeFlow webhook format processed:', {
        status,
        orderId,
        txnid: payload.config.txnid,
      });
    } else {
      // API response format
      const apiResponse = checkRupeeFlow?.data?.data || checkRupeeFlow?.data || checkRupeeFlow;
      const payoutOrder = apiResponse?.payoutOrders?.[0];
      status = payoutOrder?.status?.toUpperCase() || 'PENDING';
      orderId = payoutOrder?.orderId;
      batchId = apiResponse?.batchId;
      
      payload.config.txnid = uniqueId;
      payload.config.orderId = orderId;
      payload.config.batchId = batchId;
      
      logger.info('RupeeFlow API response parsed:', {
        orderId,
        status,
        batchId,
        message: apiResponse?.message,
      });
    }

    // Apply status to payload
    if (status === 'COMPLETED' || status === 'SUCCESS') {
      payload.status = Status.APPROVED;
      payload.utr_id = payload.utr_id || '';
      payload.approved_at = new Date().toISOString();
    } else if (status === 'PROCESSING' || status === 'PENDING') {
      payload.status = Status.PENDING;
    } else {
      payload.status = Status.REJECTED;
      payload.rejected_reason = checkRupeeFlow.rejected_reason || 'Transaction failed';
      payload.rejected_at = new Date().toISOString();
    }

    // if (!payload.utr_id && checkRupeeFlow.txnStatus) {
    //   payload.utr_id = orderId || '';
    // }

    logger.info('RupeeFlow payout processed successfully:', payload);
    return payload;
  } catch (error) {
    payload.status = Status.REJECTED;
    payload.bank_acc_id = bankId;
    payload.utr_id = checkRupeeFlow?._id || '';
    payload.rejected_reason =
      error?.response?.data?.message || error.message || 'API call failed';
    payload.rejected_at = new Date().toISOString();

    logger.error('RupeeFlow payout error:', error.message);
    logger.warn('RupeeFlow payout error response', payload);
    return payload;
  }
};

/**
 * Create RupeeFlow bulk payout from entries/IDs
 * @param {Array} payoutEntries - Array of payout entries or IDs
 * @param {string} company_id - Company ID
 * @param {function} getPayoutData - Function to get payout data if IDs are provided
 * @param {function} updatePayoutStatus - Function to update payout status in bulk
 * @param {object} rabbitMQ - RabbitMQ instance for bulk updates
 * @returns {Promise<object>} - API response
 */
export const createRupeeFlowBulkPayout = async (
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

    if (!company?.config?.RUPEE_FLOW) {
      throw new BadRequestError('RupeeFlow configuration not found for company');
    }

    // Validate bank configuration
    const defaultBankId = company.config.RUPEE_FLOW.defaultBankId;
    if (!defaultBankId || defaultBankId.trim() === '') {
      throw new BadRequestError(
        'RupeeFlow default bank ID not configured for company',
      );
    }

    logger.info('Using RupeeFlow bank configuration:', {
      company_id,
      defaultBankId,
      hasRupeeFlowConfig: !!company.config.RUPEE_FLOW,
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
        // Create RupeeFlow format for each entry (matching validation rules)
        const rupeeFlowFormat = {
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
          !rupeeFlowFormat.beneficiaryaccountNumber ||
          !rupeeFlowFormat.ifsc ||
          !rupeeFlowFormat.Amount
        ) {
          logger.warn('Skipping invalid entry:', entry);
          invalidEntries.push(entry);
          continue;
        }

        bulkPayoutData.push(rupeeFlowFormat);
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
    logger.info('RupeeFlow bulk payout data prepared:', {
      company_id,
      totalRecords: bulkPayoutData.length,
      sampleEntry: bulkPayoutData[0], // Log first entry for structure verification
    });

    // Prepare API config for JSON request
    const apiConfig = {
      headers: {
        'x-api-key': company.config.RUPEE_FLOW.walletsPayoutsApiKey,
        'Content-Type': 'application/json',
      },
      baseUrl: company.config.RUPEE_FLOW.walletsBulkPayoutsUrl,
    };

    logger.info('RupeeFlow API config:', {
      url: apiConfig.baseUrl,
      hasApiKey: !!apiConfig.headers['x-api-key'],
      dataSize: JSON.stringify(bulkPayoutData).length,
    });

    // Send JSON data directly to RupeeFlow API
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
      logger.error('RupeeFlow API returned error status:', {
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
          `RupeeFlow API validation error: ${errorMessage}`,
        );
      }

      throw new Error(
        `RupeeFlow API error: ${response.status} - ${response.statusText}`,
      );
    }

    logger.info('RupeeFlow bulk payout JSON sent successfully:', {
      company_id,
      totalRecords: bulkPayoutData.length,
      response: response.data,
    });

    // Handle response and update status in bulk using RabbitMQ
    if (response.data && updatePayoutStatus && rabbitMQ) {
      // Process RupeeFlow bulk response format
      const bulkResponse = response.data;
      const successfulPayouts = [];
      const failedPayouts = [];

      // Process each result in the response
      if (bulkResponse.results && Array.isArray(bulkResponse.results)) {
        logger.info(
          `Processing ${bulkResponse.results.length} RupeeFlow bulk response results`,
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
            method: Method.RUPEEFLOW,
          },
          // Map individual transaction data
          individualUpdates: successfulPayouts.map((payout) => ({
            payoutId: payout.payoutId,
            bank_acc_id: defaultBankId,
            config: {
              method: Method.RUPEEFLOW,
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
            'bulk_payout_status_update',
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
            method: Method.RUPEEFLOW,
          },
          // Map individual transaction data
          individualUpdates: failedPayouts.map((payout) => ({
            payoutId: payout.payoutId,
            status: Status.REJECTED,
            bank_acc_id: defaultBankId,
            rejected_reason: payout.rejected_reason,
            rejected_at: new Date().toISOString(),
            config: {
              method: Method.RUPEEFLOW,
              txnid: null, // No transaction ID for failed payouts
            },
          })),
        };

        try {
          // Send to RabbitMQ for async processing (if worker exists)
          await rabbitMQ.sendMessage(
            'bulk_payout_status_update',
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
        // Include RupeeFlow response statistics
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
    logger.error('RupeeFlow bulk payout upload failed:', {
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

    // Handle RupeeFlow specific error responses
    if (error.response?.status === 400) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        (typeof error.response?.data === 'string'
          ? error.response.data
          : 'Invalid request format or missing required fields');

      logger.error('RupeeFlow 400 error details:', {
        responseData: error.response.data,
        requestDataSample: error.config?.data
          ? JSON.parse(error.config.data)?.[0]
          : null, // Log sample of sent data
        totalRecords: error.config?.data
          ? JSON.parse(error.config.data)?.length
          : 0,
      });

      throw new BadRequestError(`RupeeFlow validation error: ${errorMessage}`);
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
      throw new BadRequestError(`RupeeFlow server error: ${errorMessage}`);
    }

    throw error;
  }
};
