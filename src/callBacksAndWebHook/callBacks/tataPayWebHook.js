// Import required functions and classes
import axios from 'axios';
import { getBankByIdDao } from '../../apis/bankAccounts/bankaccountDao.js';
import { getCompanyByIDDao } from '../../apis/company/companyDao.js';
import { getPayoutByTxnId } from '../../apis/payOut/payOutDao.js';
import { updatePayoutService } from '../../apis/payOut/payOutService.js';
import { getUserByCompanyCreatedAtDao } from '../../apis/users/userDao.js';
import { getVendorsDao } from '../../apis/vendors/vendorDao.js';
import { Role, Status } from '../../constants/index.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';

// Helper function for retry logic with exponential backoff
const retryAxiosRequest = async (
  requestFn,
  maxRetries = 3,
  baseDelay = 1000,
) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;

      // Don't retry on 4xx errors (client errors) - only retry on network/server errors
      if (
        error.response &&
        error.response.status >= 400 &&
        error.response.status < 500
      ) {
        throw error;
      }

      if (attempt === maxRetries) {
        break;
      }

      // Log retry attempt
      console.warn(
        `Request failed (attempt ${attempt}/${maxRetries}), retrying in ${baseDelay * Math.pow(2, attempt - 1)}ms:`,
        error.message,
      );

      // Exponential backoff: wait baseDelay * 2^(attempt-1) milliseconds
      await new Promise((resolve) =>
        setTimeout(resolve, baseDelay * Math.pow(2, attempt - 1)),
      );
    }
  }

  throw lastError;
};

// Define the optimized tataPayTransactionStatusCallback function
export const tataPayTransactionStatusCallback = async (req, res) => {
  const payload = req.body;
  const apitxnid = payload?.payout;
  let conn;

  try {
    if (!apitxnid || apitxnid === '') {
      return res.status(404).send('Payment not found');
    }
    conn = await getConnection();
    await beginTransaction(conn);
    
    // Use the DAO function to find the payout
    const singleWithdrawData = await getPayoutByTxnId(apitxnid);
    
    if (!singleWithdrawData) {
      return res.status(404).send('Payment not found');
    }

    const [company] = await getCompanyByIDDao({
      id: singleWithdrawData.company_id,
    });

    // Cache API configuration to avoid repeated property access
    const apiConfig = {
      headers: {
        'x-api-key': company.config.TATA_PAY.walletsPayoutsApiKey,
      },
      baseUrl: company.config.TATA_PAY.walletsPayoutsUrl,
    };

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
        bank_acc_id: bankId,
        vendor_id: vendor.id,
        config: {
          method: 'TataPay',
          description: 'Payout processing via TataPay',
        },
      };
      const adminUser = await getUserByCompanyCreatedAtDao(
        singleWithdrawData.company_id,
        Role.ADMIN,
      );
      if (adminUser) updatePayload.updated_by = adminUser.id;

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

      await updatePayoutService(
        conn,
        {
          id: singleWithdrawData.id,
          company_id: singleWithdrawData.company_id,
        },
        updatePayload,
      );
    };

    let statusResponse = null;
    // Transaction Under Process - check status
    const queryParams = {
      searchKey: apitxnid,
      page: 1,
      limit: 10,
    }; // Include transaction ID in payload
    statusResponse = await retryAxiosRequest(
      async () => {
        return await axios.get(`${apiConfig.baseUrl}/Search_payout`, {
          headers: apiConfig.headers,
          params: queryParams,
          timeout: 15000, // 15 second timeout for status check
          maxRedirects: 3,
          validateStatus: function (status) {
            return status < 500;
          },
        });
      },
      2,
      500,
    ); // 2 retries with 500ms base delay for status checks
    logger.info(
      `TataPay payoutStatus response for apitxnid ${singleWithdrawData.id}:`,
      statusResponse.data,
    );

    // Check if payouts array exists and has at least one element
    if (!statusResponse.data || !statusResponse.data.payouts || !Array.isArray(statusResponse.data.payouts) || statusResponse.data.payouts.length === 0) {
      logger.error('Invalid response from TataPay: payouts array is missing or empty', statusResponse.data);
      return res.status(400).send('Invalid response from payment provider');
    }

    const payoutData = statusResponse.data.payouts[0];
    
    if (
      payoutData.status === 'processing' ||
      payoutData.status === 'pending'
    ) {
      await handlePayoutUpdate(payoutData, false, true);
    } else if (payoutData.status === 'approved') {
      await handlePayoutUpdate(payoutData, true);
    } else if (payoutData.status === 'rejected') {
      await handlePayoutUpdate(payoutData, false);
    } else {
      return res.status(400).send(statusResponse.data.ErrorMessage || 'Unknown status from payment provider');
    }

    // Log the updated payout status
    logger.info('Payout Updated by TataPay callback', {
      status: singleWithdrawData.status,
    });

    await commit(conn);

    return res.status(200).send('Payout Updated Successfully');
  } catch (err) {
    await rollback(conn);
    // Log any errors while updating the payout
    logger.error('getting error while updating payout', err);
  } finally {
    if (conn) {
      logger.info('Releasing connection');
      conn.release(); // Always release connection
    }
  }
};
