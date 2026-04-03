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
const getVertexPayApiConfig = (company) => {
  return {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': company.config.VERTEX_PAY.apiKey,
    },
    baseUrl: company.config.VERTEX_PAY.walletsPayoutsUrl,
  };
};

/**
 * Initiate VertexPay payout request
 * @param {object} payload - Single payload object
 * @param {string} company_id - Company ID
 * @param {string} uniqueId - Unique transaction ID
 * @returns {Promise<object>} - API response
 */
export const initiateVertexPayPayout = async (
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
    const vertexPayWalletBalance = await getVertexPayWalletBalance({
      company_id,
    });
    if (vertexPayWalletBalance.data.walletBalance < newPayload.amount) {
      throw new BadRequestError(`Insufficient VertexPay wallet balance. Required: ${newPayload.amount}, Available: ${vertexPayWalletBalance.data.walletBalance}`);
    }

    const [company] = await getCompanyByIDDao({ id: company_id });

    const apiConfig = getVertexPayApiConfig(company);

    const response = await axios.post(
      `${apiConfig.baseUrl}/api/prod/payout`,
      newPayload,
      {
        headers: apiConfig.headers,
      },
    );

    logger.info('VertexPay payout initiated successfully:', {
      merchant_order_id: payload?.merchant_order_id,
      merchantTransactionId: payload?.merchant_order_id,
      data: response.data,
    });

    return response.data;
  } catch (error) {
    logger.error(
      'VertexPay payout initiation failed:',
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
export const getVertexPayWalletBalance = async (reqOrParams, res) => {
  try {
    const isExpress = !!res; // if res exists then it's an API route
    const company_id = isExpress
      ? reqOrParams.user?.company_id
      : reqOrParams.company_id;

    const [company] = await getCompanyByIDDao({ id: company_id });

    const apiConfig = getVertexPayApiConfig(company);

    const response = await axios.get(
      `${apiConfig.baseUrl}/api/prod/payout/balance`,
      {
        headers: apiConfig.headers,
      },
    );

    logger.info('VertexPay wallet balance response:', response.data);

    // Extract balance from response based on API structure
    const responseData = response.data;
    const data = {
      walletBalance: parseFloat(responseData?.payoutBalance || 0),
    };

    const successMsg = 'VertexPay wallet balance fetched successfully';
    if (isExpress) {
      return sendSuccess(res, data, successMsg);
    } else {
      return { success: true, message: successMsg, data };
    }
  } catch (error) {
    logger.error(
      'Error fetching VertexPay wallet balance:',
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
export const createVertexPayPayout = async (
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
      checkVertexPay = await initiateVertexPayPayout(
        singleWithdrawData,
        ids.company_id,
      );
    }

    payload.bank_acc_id = bankId;

    // Handle two different response formats:
    // 1. API response: { data: { data: { batchId, payoutOrders: [...] } } }
    // 2. Webhook format: { status, utr_id, config: { orderId, txnRefId, txnid } }


    let statusCode;
    let payoutResp;

    if (checkVertexPay.status) {
      // Webhook format - status is already processed
      statusCode = checkVertexPay.status;
      payload.config.txnid = checkVertexPay.transactionId;

      logger.info('VertexPay webhook format processed:', {
        statusCode,
        txnid: checkVertexPay.transactionId,
      });
    } else {
      // API response format (new VertexPay)
      payoutResp = checkVertexPay?.data || checkVertexPay;
      statusCode = payoutResp?.status;
      payload.config.txnid = payoutResp?.transactionId;

      logger.info('VertexPay API response parsed:', {
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

    logger.info('VertexPay payout processed successfully:', payload);
    return payload;
  } catch (error) {
    payload.status = Status.REJECTED;
    payload.bank_acc_id = bankId;
    payload.utr_id = checkVertexPay?._id || '';
    payload.rejected_reason =
      error?.response?.data?.message || error.message || 'API call failed';
    payload.rejected_at = new Date().toISOString();

    logger.error('VertexPay payout error:', error.message);
    logger.warn('VertexPay payout error response', payload);
    return payload;
  }
};

/**
 * Create VertexPay bulk payout from entries/IDs using initiateVertexPayPayout
 * @param {Array} payoutEntries - Array of payout entries or IDs
 * @param {string} company_id - Company ID
 * @param {function} getPayoutData - Function to get payout data if IDs are provided
 * @param {function} updatePayoutStatus - Function to update payout status in bulk
 * @param {object} rabbitMQ - RabbitMQ instance for async status updates
 * @returns {Promise<object>} - API response
 */
// export const createVertexPayBulkPayout = async (
//   payoutEntries,
//   company_id,
//   getPayoutData = null,
//   updatePayoutStatus = null,
//   rabbitMQ = null,
// ) => {
//   try {
//     if (!payoutEntries || payoutEntries.length === 0) {
//       throw new BadRequestError('No payout entries provided');
//     }

//     const [company] = await getCompanyByIDDao({ id: company_id });

//     if (!company?.config?.VERTEXPAY) {
//       throw new BadRequestError(
//         'VertexPay configuration not found for company',
//       );
//     }

//     // Validate bank configuration
//     const defaultBankId = company.config.VERTEXPAY.defaultBankId;
//     if (!defaultBankId || defaultBankId.trim() === '') {
//       throw new BadRequestError(
//         'VertexPay default bank ID not configured for company',
//       );
//     }

//     logger.info('Using VertexPay bank configuration:', {
//       company_id,
//       defaultBankId,
//       hasVertexPayConfig: !!company.config.VERTEXPAY,
//     });

//     // Get payout data - either from entries directly or fetch by IDs
//     let payoutData = payoutEntries;

//     if (getPayoutData && typeof payoutEntries[0] === 'string') {
//       // If entries are IDs, fetch the actual data
//       logger.info('Fetching payout data for IDs:', payoutEntries);
//       payoutData = await getPayoutData(payoutEntries, company_id);
//     }

//     if (!payoutData || payoutData.length === 0) {
//       throw new BadRequestError('No valid payout data found');
//     }

//     const invalidEntries = [];
//     const validEntries = [];
//     const uniqueIds = [];
//     const entryIdToUniqueIdMap = new Map();

//     // Validate and prepare entries
//     for (const entry of payoutData) {
//       // Validate required fields
//       if (
//         !entry.user_bank_details?.account_no ||
//         !entry.user_bank_details?.ifsc_code ||
//         !entry.amount
//       ) {
//         logger.warn('Skipping invalid entry:', entry);
//         invalidEntries.push(entry);
//         continue;
//       }

//       entryIdToUniqueIdMap.set(uniqueId, entry.id);
//       uniqueIds.push(uniqueId);
//       validEntries.push(entry);
//     }

//     if (validEntries.length === 0) {
//       throw new BadRequestError('No valid payout records found to process');
//     }

//     // Process each entry individually via initiateVertexPayPayout
//     const successfulPayouts = [];
//     const failedPayouts = [];

//     for (let i = 0; i < validEntries.length; i++) {
//       const entry = validEntries[i];
//       const txnId = uniqueIds[i];
//       const entryId = entryIdToUniqueIdMap.get(txnId);

//       try {
//         const response = await initiateVertexPayPayout(entry, company_id, txnId);
//         const apiResponse = response?.data || response;
//         const statusCode = apiResponse?.status;
//         const orderId = apiResponse?.merchantTransactionId || txnId;

//         if (statusCode === 2) {
//           successfulPayouts.push({
//             payoutId: entryId,
//             txnid: txnId,
//             orderId,
//             status: Status.APPROVED,
//           });
//         } else if (statusCode === 0 || statusCode === 1) {
//           successfulPayouts.push({
//             payoutId: entryId,
//             txnid: txnId,
//             orderId,
//             status: Status.PENDING,
//           });
//         } else {
//           failedPayouts.push({
//             payoutId: entryId,
//             rejected_reason: apiResponse?.message || 'Transaction failed',
//           });
//         }

//         logger.info('VertexPay payout processed in bulk:', {
//           payoutId: entryId,
//           txnId,
//           statusCode,
//           orderId,
//         });
//       } catch (entryError) {
//         failedPayouts.push({
//           payoutId: entryId,
//           rejected_reason: entryError?.response?.data?.message || entryError.message || 'API call failed',
//         });
//         logger.error('VertexPay bulk entry failed:', {
//           payoutId: entryId,
//           txnId,
//           error: entryError.message,
//         });
//       }
//     }

//     // Update successful payouts
//     if (successfulPayouts.length > 0) {
//       const successBulkUpdateData = {
//         payoutIds: successfulPayouts.map((p) => p.payoutId),
//         status: Status.PENDING,
//         bank_acc_id: defaultBankId,
//         config: { method: Method.VERTEXPAY },
//         individualUpdates: successfulPayouts.map((payout) => ({
//           payoutId: payout.payoutId,
//           bank_acc_id: defaultBankId,
//           config: {
//             method: Method.VERTEXPAY,
//             txnid: payout.txnid,
//             orderId: payout.orderId,
//           },
//           status: payout.status,
//           ...(payout.status === Status.APPROVED && { approved_at: new Date().toISOString() }),
//           updated_at: new Date().toISOString(),
//         })),
//       };

//       // Try RabbitMQ first, fallback to direct update
//       if (rabbitMQ) {
//         try {
//           await rabbitMQ.sendMessage('bulk_payout_queue', successBulkUpdateData);
          
//           logger.info('Successful payouts sent to RabbitMQ:', successfulPayouts.length);
//         } catch (mqError) {
//           logger.error('Failed to send to RabbitMQ, falling back to direct update:', mqError.message);
//           if (updatePayoutStatus) {
//             for (const update of successBulkUpdateData.individualUpdates) {
//               await updatePayoutStatus([update.payoutId], {
//                 status: update.status,
//                 bank_acc_id: update.bank_acc_id,
//                 config: update.config,
//                 ...(update.approved_at && { approved_at: update.approved_at }),
//                 updated_at: update.updated_at,
//               });
//             }
//           }
//         }
//       } else if (updatePayoutStatus) {
//         for (const update of successBulkUpdateData.individualUpdates) {
//           await updatePayoutStatus([update.payoutId], {
//             status: update.status,
//             bank_acc_id: update.bank_acc_id,
//             config: update.config,
//             ...(update.approved_at && { approved_at: update.approved_at }),
//             updated_at: update.updated_at,
//           });
//         }
//         logger.info('Successful payouts updated in database:', successfulPayouts.length);
//       }
//     }

//     // Update failed payouts
//     if (failedPayouts.length > 0) {
//       const failedBulkUpdateData = {
//         payoutIds: failedPayouts.map((p) => p.payoutId),
//         status: Status.REJECTED,
//         bank_acc_id: defaultBankId,
//         config: { method: Method.VERTEXPAY },
//         individualUpdates: failedPayouts.map((payout) => ({
//           payoutId: payout.payoutId,
//           status: Status.REJECTED,
//           bank_acc_id: defaultBankId,
//           config: { method: Method.VERTEXPAY },
//           rejected_reason: payout.rejected_reason,
//           rejected_at: new Date().toISOString(),
//           updated_at: new Date().toISOString(),
//         })),
//       };

//       // Try RabbitMQ first, fallback to direct update
//       if (rabbitMQ) {
//         try {
//           await rabbitMQ.sendMessage('bulk_payout_queue', failedBulkUpdateData);
//           logger.info('Failed payouts sent to RabbitMQ:', failedPayouts.length);
//         } catch (mqError) {
//           logger.error('Failed to send to RabbitMQ, falling back to direct update:', mqError.message);
//           if (updatePayoutStatus) {
//             for (const update of failedBulkUpdateData.individualUpdates) {
//               await updatePayoutStatus([update.payoutId], {
//                 status: update.status,
//                 bank_acc_id: update.bank_acc_id,
//                 config: update.config,
//                 rejected_reason: update.rejected_reason,
//                 rejected_at: update.rejected_at,
//                 updated_at: update.updated_at,
//               });
//             }
//           }
//         }
//       } else if (updatePayoutStatus) {
//         for (const update of failedBulkUpdateData.individualUpdates) {
//           await updatePayoutStatus([update.payoutId], {
//             status: update.status,
//             bank_acc_id: update.bank_acc_id,
//             config: update.config,
//             rejected_reason: update.rejected_reason,
//             rejected_at: update.rejected_at,
//             updated_at: update.updated_at,
//           });
//         }
//         logger.info('Failed payouts updated in database:', failedPayouts.length);
//       }
//     }

//     return {
//       success: true,
//       message: 'Bulk payout processed successfully',
//       data: {
//         totalRecords: payoutData.length,
//         validRecords: successfulPayouts.length + failedPayouts.length,
//         invalidRecords: invalidEntries.length,
//         successpayout: successfulPayouts.length,
//         failedpayout: failedPayouts.length,
//         status: 'processed',
//         processedIds: validEntries.map(e => e.id),
//         invalidEntries,
//         successfulPayouts,
//         failedPayouts,
//       },
//     };
//   } catch (error) {
//     logger.error('VertexPay bulk payout failed:', {
//       message: error.message,
//       status: error.response?.status,
//       data: error.response?.data,
//     });
//     throw error;
//   }
// };
