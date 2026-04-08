import axios from 'axios';
import { getCompanyByIDDao } from '../apis/company/companyDao.js';
import { Method, Status } from '../constants/index.js';
import { BadRequestError } from '../utils/appErrors.js';
import { logger } from '../utils/logger.js';
import { sendSuccess } from '../utils/responseHandlers.js';
import { customAlphabet } from 'nanoid';
import { getPayoutByTxnId } from '../apis/payOut/payOutDao.js';

// Create alphanumeric-only nanoid
const nanoid = customAlphabet(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  20,
);

/**
 * Generate a unique transaction ID with TXN prefix
 * Checks for existing payouts and regenerates if duplicate found
 * @returns {Promise<string>} - Unique transaction ID (e.g., TXN3728662222AB)
 */
export const generateUniqueTxnId = async () => {
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

  return uniqueId;
};

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
 * Initiate RupeeFlow payout request - supports both single and bulk payloads
 * @param {object|Array} payload - Single payload object or array of payloads for bulk
 * @param {string} company_id - Company ID
 * @param {string|Array} uniqueId - Single uniqueId or array of uniqueIds for bulk
 * @returns {Promise<object>} - API response
 */
export const initiateRupeeFlowPayout = async (
  payload,
  company_id,
  uniqueId,
) => {
  // Handle both single and bulk payloads
  const isBulk = Array.isArray(payload);
  const payloads = isBulk ? payload : [payload];
  const uniqueIds = isBulk ? uniqueId : [uniqueId];

  const newPayload = {
    data: payloads.map((p, index) => ({
      amount: Number(p.amount),
      purpose: 'Payment for services rendered',
      beneficiaryName: p?.user_bank_details?.account_holder_name,
      bankName: p?.user_bank_details?.bank_name,
      accountNumber: p?.user_bank_details?.account_no,
      ifscCode: p?.user_bank_details?.ifsc_code,
      remarks: p?.remarks || 'Payment for services rendered',
      transferMode: p.mode || 'IMPS',
      beneficiaryMobile: '9457863670',
      payoutId: uniqueIds[index],
    })),
  };

  logger.info('Initiating RupeeFlow payout with payload:', {
    company_id,
    isBulk,
    totalEntries: newPayload.data.length,
    merchant_order_id: isBulk ? undefined : payload?.merchant_order_id,
  });

  try {
    // Calculate total amount for wallet balance check
    const totalAmount = newPayload.data.reduce((sum, item) => sum + item.amount, 0);
    
    const rupeeFlowWalletBalance = await getRupeeFlowWalletBalance({
      company_id,
    });
    if (rupeeFlowWalletBalance.data.walletBalance < totalAmount) {
      throw new BadRequestError(`Insufficient RupeeFlow wallet balance. Required: ${totalAmount}, Available: ${rupeeFlowWalletBalance.data.walletBalance}`);
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
      isBulk,
      totalEntries: newPayload.data.length,
      merchant_order_id: isBulk ? undefined : payload?.merchant_order_id,
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
  let uniqueId
  try {
    // Ensure method exists
    if (!payload?.config?.method) {
      throw new Error('Payout method missing in payload');
    }

    if (payload.txnStatus) {
      checkRupeeFlow = { ...payload };
      delete payload.txnStatus;
    } else {
      // Generate unique transaction ID
      uniqueId = await generateUniqueTxnId();
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
      const apiResponse =
        checkRupeeFlow?.data?.data || checkRupeeFlow?.data || checkRupeeFlow;
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
      payload.rejected_reason =
        checkRupeeFlow.rejected_reason || 'Transaction failed';
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
 * Create RupeeFlow bulk payout from entries/IDs using initiateRupeeFlowPayout
 * @param {Array} payoutEntries - Array of payout entries or IDs
 * @param {string} company_id - Company ID
 * @param {function} getPayoutData - Function to get payout data if IDs are provided
 * @param {function} updatePayoutStatus - Function to update payout status in bulk
 * @param {object} rabbitMQ - RabbitMQ instance for async status updates
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
      throw new BadRequestError(
        'RupeeFlow configuration not found for company',
      );
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

    const invalidEntries = [];
    const validEntries = [];
    const uniqueIds = [];
    const entryIdToUniqueIdMap = new Map();

    // Validate and prepare entries
    for (const entry of payoutData) {
      // Validate required fields
      if (
        !entry.user_bank_details?.account_no ||
        !entry.user_bank_details?.ifsc_code ||
        !entry.amount
      ) {
        logger.warn('Skipping invalid entry:', entry);
        invalidEntries.push(entry);
        continue;
      }

      // Generate unique transaction ID for each entry
      const uniqueId = await generateUniqueTxnId();
      entryIdToUniqueIdMap.set(uniqueId, entry.id);
      uniqueIds.push(uniqueId);
      validEntries.push(entry);
    }

    if (validEntries.length === 0) {
      throw new BadRequestError('No valid payout records found to process');
    }

    // Use initiateRupeeFlowPayout with bulk payload
    const response = await initiateRupeeFlowPayout(validEntries, company_id, uniqueIds);

    // Parse response and categorize results
    const successfulPayouts = [];
    const failedPayouts = [];
    const apiResponse = response?.data?.data || response?.data || response;
    const payoutOrders = apiResponse?.payoutOrders || [];

    // Process each payout order from response
    for (const payoutOrder of payoutOrders) {
      const uniqueId = payoutOrder?.payoutId;
      const entryId = entryIdToUniqueIdMap.get(uniqueId);
      const status = payoutOrder?.status?.toUpperCase() || 'PENDING';
      const orderId = payoutOrder?.orderId;
      const batchId = apiResponse?.batchId;

      if (!entryId) {
        logger.warn('Could not map payout order to entry:', { uniqueId, payoutOrder });
        continue;
      }

      if (status === 'COMPLETED' || status === 'SUCCESS') {
        successfulPayouts.push({
          payoutId: entryId,
          txnid: uniqueId,
          orderId,
          batchId,
          status: Status.APPROVED,
        });
      } else if (status === 'PROCESSING' || status === 'PENDING') {
        successfulPayouts.push({
          payoutId: entryId,
          txnid: uniqueId,
          orderId,
          batchId,
          status: Status.PENDING,
        });
      } else {
        failedPayouts.push({
          payoutId: entryId,
          rejected_reason: payoutOrder?.message || 'Transaction failed',
        });
      }

      logger.info('RupeeFlow payout processed in bulk:', {
        payoutId: entryId,
        uniqueId,
        status,
        orderId,
      });
    }

    // Update successful payouts
    if (successfulPayouts.length > 0) {
      const successBulkUpdateData = {
        payoutIds: successfulPayouts.map((p) => p.payoutId),
        status: Status.PENDING,
        bank_acc_id: defaultBankId,
        config: { method: Method.RUPEEFLOW },
        individualUpdates: successfulPayouts.map((payout) => ({
          payoutId: payout.payoutId,
          bank_acc_id: defaultBankId,
          config: {
            method: Method.RUPEEFLOW,
            txnid: payout.txnid,
            orderId: payout.orderId,
            batchId: payout.batchId,
          },
          status: payout.status,
          ...(payout.status === Status.APPROVED && { approved_at: new Date().toISOString() }),
          updated_at: new Date().toISOString(),
        })),
      };

      // Try RabbitMQ first, fallback to direct update
      if (rabbitMQ) {
        try {
          await rabbitMQ.sendMessage('bulk_payout_queue', successBulkUpdateData);
          
          logger.info('Successful payouts sent to RabbitMQ:', successfulPayouts.length);
        } catch (mqError) {
          logger.error('Failed to send to RabbitMQ, falling back to direct update:', mqError.message);
          if (updatePayoutStatus) {
            for (const update of successBulkUpdateData.individualUpdates) {
              await updatePayoutStatus([update.payoutId], {
                status: update.status,
                bank_acc_id: update.bank_acc_id,
                config: update.config,
                ...(update.approved_at && { approved_at: update.approved_at }),
                updated_at: update.updated_at,
              });
            }
          }
        }
      } else if (updatePayoutStatus) {
        for (const update of successBulkUpdateData.individualUpdates) {
          await updatePayoutStatus([update.payoutId], {
            status: update.status,
            bank_acc_id: update.bank_acc_id,
            config: update.config,
            ...(update.approved_at && { approved_at: update.approved_at }),
            updated_at: update.updated_at,
          });
        }
        logger.info('Successful payouts updated in database:', successfulPayouts.length);
      }
    }

    // Update failed payouts
    if (failedPayouts.length > 0) {
      const failedBulkUpdateData = {
        payoutIds: failedPayouts.map((p) => p.payoutId),
        status: Status.REJECTED,
        bank_acc_id: defaultBankId,
        config: { method: Method.RUPEEFLOW },
        individualUpdates: failedPayouts.map((payout) => ({
          payoutId: payout.payoutId,
          status: Status.REJECTED,
          bank_acc_id: defaultBankId,
          config: { method: Method.RUPEEFLOW },
          rejected_reason: payout.rejected_reason,
          rejected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })),
      };

      // Try RabbitMQ first, fallback to direct update
      if (rabbitMQ) {
        try {
          await rabbitMQ.sendMessage('bulk_payout_queue', failedBulkUpdateData);
          logger.info('Failed payouts sent to RabbitMQ:', failedPayouts.length);
        } catch (mqError) {
          logger.error('Failed to send to RabbitMQ, falling back to direct update:', mqError.message);
          if (updatePayoutStatus) {
            for (const update of failedBulkUpdateData.individualUpdates) {
              await updatePayoutStatus([update.payoutId], {
                status: update.status,
                bank_acc_id: update.bank_acc_id,
                config: update.config,
                rejected_reason: update.rejected_reason,
                rejected_at: update.rejected_at,
                updated_at: update.updated_at,
              });
            }
          }
        }
      } else if (updatePayoutStatus) {
        for (const update of failedBulkUpdateData.individualUpdates) {
          await updatePayoutStatus([update.payoutId], {
            status: update.status,
            bank_acc_id: update.bank_acc_id,
            config: update.config,
            rejected_reason: update.rejected_reason,
            rejected_at: update.rejected_at,
            updated_at: update.updated_at,
          });
        }
        logger.info('Failed payouts updated in database:', failedPayouts.length);
      }
    }

    return {
      success: true,
      message: 'Bulk payout processed successfully',
      data: {
        totalRecords: payoutData.length,
        validRecords: successfulPayouts.length + failedPayouts.length,
        invalidRecords: invalidEntries.length,
        successpayout: successfulPayouts.length,
        failedpayout: failedPayouts.length,
        status: 'processed',
        processedIds: validEntries.map(e => e.id),
        invalidEntries,
        successfulPayouts,
        failedPayouts,
      },
    };
  } catch (error) {
    logger.error('RupeeFlow bulk payout failed:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw error;
  }
};
