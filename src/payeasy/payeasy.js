import axios from 'axios';
import crypto from 'crypto';
import { getCompanyByIDDao } from '../apis/company/companyDao.js';
import { Status } from '../constants/index.js';
import { BadRequestError } from '../utils/appErrors.js';
import { logger } from '../utils/logger.js';
import { sendSuccess } from '../utils/responseHandlers.js';

/**
 * Encrypt data using AES-256-CBC
 * @param {string} encryptionKey - Hex encoded encryption key
 * @param {object} data - Data to encrypt
 * @returns {object} - Object with iv and encryptedData
 */
const encryptData = (encryptionKey, data) => {
  const iv = crypto.randomBytes(16);
  const keyBuffer = Buffer.from(encryptionKey, 'hex');
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted,
  };
};

/**
 * Get PayEasy API configuration
 * @param {object} company - Company object with PAY_EASY config
 * @returns {object} - API configuration with headers, baseUrl, encryptionKey, and clientId
 */
const getPayEasyApiConfig = (company) => {
  return {
    headers: {
      'Content-Type': 'application/json',
    },
    // Headers with API key for balance endpoint
    balanceHeaders: {
      'Content-Type': 'application/json',
      'x-api-key': company.config.PAY_EASY.apiKey,
    },
    baseUrl: company.config.PAY_EASY.walletsPayoutsUrl,
    encryptionKey: company.config.PAY_EASY.walletsPayoutsApiKey, // apiKey is used as encryption key
    clientId: company.config.PAY_EASY.walletsPayoutsClientId,
  };
};

/**
 * Initiate PayEasy payout request
 * @param {object} payload - Single payload object
 * @param {string} company_id - Company ID
 * @param {string} uniqueId - Unique transaction ID
 * @returns {Promise<object>} - API response
 */
export const initiatePayEasyPayout = async (
  payload,
  company_id,
) => {
  try {
    const payEasyWalletBalance = await getPayEasyWalletBalance({
      company_id,
    });
    if (payEasyWalletBalance.data.walletBalance < Number(payload.amount)) {
      throw new BadRequestError(`Insufficient PayEasy wallet balance. Required: ${payload.amount}, Available: ${payEasyWalletBalance.data.walletBalance}`);
    }

    const [company] = await getCompanyByIDDao({ id: company_id });
    const apiConfig = getPayEasyApiConfig(company);

    // Prepare data for encryption
    const dataToEncrypt = {
      clientId: apiConfig.clientId,
      phone: payload?.phone || '',
      amount: Number(payload.amount),
      orderId: payload?.merchant_order_id,
      initiated: 'api',
      recipientName: payload?.user_bank_details?.account_holder_name || '',
      ifscCode: payload?.user_bank_details?.ifsc_code,
      accountNumber: payload?.user_bank_details?.account_no,
    };

    logger.info('Initiating PayEasy payout with payload:', {
      company_id,
      merchant_order_id: payload?.merchant_order_id,
      clientId: apiConfig.clientId,
    });

    // Encrypt the data
    const encryptedPayload = encryptData(apiConfig.encryptionKey, dataToEncrypt);

    const response = await axios.post(
      `${apiConfig.baseUrl}/account/create-payment-link-payout/${apiConfig.clientId}`,
      encryptedPayload,
      {
        headers: apiConfig.headers,
      },
    );

    logger.info('PayEasy payout initiated successfully:', {
      merchant_order_id: payload?.merchant_order_id,
      clientId: apiConfig.clientId,
      data: response.data,
    });

    return response.data;
  } catch (error) {
    logger.error(
      'PayEasy payout initiation failed:',
      error.response?.data || error.message || error,
    );
    throw error;
  }
};

/**
 * Get PayEasy wallet balance
 * @param {object} reqOrParams - Request object or parameters containing company_id
 * @param {object} res - Response object (optional, for Express routes)
 * @returns {Promise<object>} - Wallet balance data
 */
export const getPayEasyWalletBalance = async (reqOrParams, res) => {
  try {
    const isExpress = !!res; // if res exists then it's an API route
    const company_id = isExpress
      ? reqOrParams.user?.company_id
      : reqOrParams.company_id;

    const [company] = await getCompanyByIDDao({ id: company_id });

    const apiConfig = getPayEasyApiConfig(company);

    const response = await axios.get(
      `${apiConfig.baseUrl}/api/prod/payout/balance`,
      {
        headers: apiConfig.balanceHeaders,
      },
    );

    logger.info('PayEasy wallet balance response:', response.data);

    // Extract balance from response based on API structure
    const responseData = response.data;
    const data = {
      walletBalance: parseFloat(responseData?.payoutBalance || 0),
    };

    const successMsg = 'PayEasy wallet balance fetched successfully';
    if (isExpress) {
      return sendSuccess(res, data, successMsg);
    } else {
      return { success: true, message: successMsg, data };
    }
  } catch (error) {
    logger.error(
      'Error fetching PayEasy wallet balance:',
      error.response?.data || error.message || error,
    );
    throw error;
  }
};

/**
 * Create PayEasy payout with status handling (simplified like Clickrr)
 * @param {object} payload - Payout payload
 * @param {object} ids - Contains id and company_id
 * @param {object} singleWithdrawData - Withdrawal data
 * @param {string} bankId - Bank ID
 * @returns {Promise<object>} - Updated payload with status
 */
export const createPayEasyPayout = async (
  payload,
  ids,
  singleWithdrawData,
  bankId,
) => {
  let checkPayEasy;
  try {
    // Ensure method exists
    if (!payload?.config?.method) {
      throw new Error('Payout method missing in payload');
    }

    if (payload.status) {
      checkPayEasy = { ...payload };
      delete payload.status;
    } else {
      checkPayEasy = await initiatePayEasyPayout(
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

    if (checkPayEasy.status) {
      // Webhook format - status is already processed
      statusCode = checkPayEasy.status;
      payload.config.txnid = checkPayEasy.transactionId;

      logger.info('PayEasy webhook format processed:', {
        statusCode,
        txnid: checkPayEasy.transactionId,
      });
    } else {
      // API response format (new PayEasy)
      payoutResp = checkPayEasy?.data || checkPayEasy;
      statusCode = payoutResp?.status;
      payload.config.txnid = payoutResp?.transactionId;

      logger.info('PayEasy API response parsed:', {
        statusCode,
        message: payoutResp?.message,
      });
    }

    // Map status code to internal status
    if (statusCode === 'success' || statusCode === 'SUCCESS' || statusCode === Status.APPROVED) {
      payload.status = Status.APPROVED;
      payload.utr_id = payload.utr_id || '';
      payload.approved_at = new Date().toISOString();
    } else if (statusCode === 'pending' || statusCode === 'PENDING' || statusCode === Status.PENDING) {
      payload.status = Status.PENDING;
    } else if (statusCode === 'refunded' || statusCode === Status.REVERSED) {
      payload.status = Status.REVERSED;
    } else {
      payload.status = Status.REJECTED;
      payload.rejected_reason =
        (payoutResp?.message || checkPayEasy.rejected_reason || 'Transaction failed');
      payload.rejected_at = new Date().toISOString();
    }

    logger.info('PayEasy payout processed successfully:', payload);
    return payload;
  } catch (error) {
    payload.status = Status.REJECTED;
    payload.bank_acc_id = bankId;
    payload.utr_id = checkPayEasy?._id || '';
    payload.rejected_reason =
      error?.response?.data?.message || error.message || 'API call failed';
    payload.rejected_at = new Date().toISOString();

    logger.error('PayEasy payout error:', error.message);
    logger.warn('PayEasy payout error response', payload);
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

//     if (!company?.config?.PAY_EASY) {
//       throw new BadRequestError(
//         'PayEasy configuration not found for company',
//       );
//     }

//     // Validate bank configuration
//     const defaultBankId = company.config.PAY_EASY.defaultBankId;
//     if (!defaultBankId || defaultBankId.trim() === '') {
//       throw new BadRequestError(
//         'PayEasy default bank ID not configured for company',
//       );
//     }

//     logger.info('Using PayEasy bank configuration:', {
//       company_id,
//       defaultBankId,
//       hasPayEasyConfig: !!company.config.PAY_EASY,
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

//       const uniqueId = generateUniqueId(); // Assuming you have a function to generate unique IDs
//       entryIdToUniqueIdMap.set(uniqueId, entry.id);
//       uniqueIds.push(uniqueId);
//       validEntries.push(entry);
//     }

//     if (validEntries.length === 0) {
//       throw new BadRequestError('No valid payout records found to process');
//     }

//     // Process each entry individually via initiatePayEasyPayout
//     const successfulPayouts = [];
//     const failedPayouts = [];

//     for (let i = 0; i < validEntries.length; i++) {
//       const entry = validEntries[i];
//       const txnId = uniqueIds[i];
//       const entryId = entryIdToUniqueIdMap.get(txnId);

//       try {
//         const response = await initiatePayEasyPayout(entry, company_id, txnId);
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

//         logger.info('PayEasy payout processed in bulk:', {
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
//         logger.error('PayEasy bulk entry failed:', {
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
//         config: { method: Method.PAY_EASY },
//         individualUpdates: successfulPayouts.map((payout) => ({
//           payoutId: payout.payoutId,
//           bank_acc_id: defaultBankId,
//           config: {
//             method: Method.PAY_EASY,
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
//         config: { method: Method.PAY_EASY },
//         individualUpdates: failedPayouts.map((payout) => ({
//           payoutId: payout.payoutId,
//           status: Status.REJECTED,
//           bank_acc_id: defaultBankId,
//           config: { method: Method.PAY_EASY },
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
//     logger.error('PayEasy bulk payout failed:', {
//       message: error.message,
//       status: error.response?.status,
//       data: error.response?.data,
//     });
//     throw error;
//   }
// };
