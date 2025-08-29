
// Import required functions and classes
import { getBankByIdDao } from '../../apis/bankAccounts/bankaccountDao.js';
// import { getMerchantsDao } from '../../apis/merchants/merchantDao.js';
import { getPayoutsDao } from '../../apis/payOut/payOutDao.js';
// import { merchantPayoutCallback } from '../merchantCallBacks.js';
import { payAssistErrorCodeMap, Role, Status } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';
import axios from 'axios';
import { getCompanyByIDDao } from '../../apis/company/companyDao.js';
import { getVendorsDao } from '../../apis/vendors/vendorDao.js';
import { updatePayoutService } from '../../apis/payOut/payOutService.js';
import { getUserByCompanyCreatedAtDao } from '../../apis/users/userDao.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';

// Define the optimized payAssistTransactionStatusCallback function
export const payAssistTransactionStatusCallback = async (req, res) => {
  const payload = req.body;
  const apitxnid = payload?.Response?.apitxnid;
  let conn;

  try {
    if (!apitxnid || apitxnid === '') {
      return res.status(404).send('Payment not found');
    }
    conn = await getConnection();
    await beginTransaction(conn);
    const [singleWithdrawData] = await getPayoutsDao({ id: apitxnid });
    if (!singleWithdrawData) {
      return res.status(404).send('Payment not found');
    }

    const [company] = await getCompanyByIDDao({
      id: singleWithdrawData.company_id,
    });

    // Cache API configuration to avoid repeated property access
    const apiConfig = {
      headers: {
        APIAGENT: company.config.PAY_ASSIST.walletsPayoutsAgent,
        APIKEY: company.config.PAY_ASSIST.walletsPayoutsApiKey,
      },
      baseUrl: company.config.PAY_ASSIST.walletsPayoutsUrl,
      agentCode: company.config.PAY_ASSIST.walletsPayoutsAgentCode,
    };

    const handlePayoutUpdate = async (
      responseData,
      isApproved = false,
      isTransactionUnderProcess = false,
    ) => {
      const bankId = company.config.PAY_ASSIST.defaultBankId;
      const [bankVendor] = await getBankByIdDao({ id: bankId });
      const [vendor] = await getVendorsDao({
        user_id: bankVendor.user_id,
      });
      const updatePayload = {
        bank_acc_id: bankId,
        vendor_id: vendor.id,
        config: {
          method: 'PayAssist',
          description: 'Payout processing via PayAssist',
        },
      };
      const adminUser = await getUserByCompanyCreatedAtDao(
        singleWithdrawData.company_id,
        Role.ADMIN,
      );
      if (adminUser) updatePayload.updated_by = adminUser.id;

      if (responseData.Response?.txnid) {
        updatePayload.config.txnid = responseData.Response.txnid;
      }

      if (isApproved) {
        Object.assign(updatePayload, {
          status: Status.APPROVED,
          utr_id: isTransactionUnderProcess
            ? responseData.Response.txnid
            : responseData.Response.refno || responseData.Response?.utr,
          approved_at: new Date().toISOString(),
        });
      } else if (!isApproved && isTransactionUnderProcess) {
        Object.assign(updatePayload, {
          status: Status.PENDING,
        });
      } else {
        updatePayload.config.rejected_reason =
          payAssistErrorCodeMap[responseData.ErrorCode] || 'Server Unreachable';
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

    // Handle response based on ErrorCode
    const errorCode = payload.ErrorCode;
    let statusResponse = null;

    if (errorCode) {
      // Transaction Under Process - check status
      statusResponse = await axios.post(
        `${apiConfig.baseUrl}/payoutStatus`,
        { apitxnid: singleWithdrawData.id }, // Include transaction ID in payload
        { headers: apiConfig.headers },
      );

      if (statusResponse.data.ErrorCode === '0') {
        if (
          statusResponse.data.Response.message ===
            'Reason-Transaction Failed' ||
          statusResponse.data.Response.message === 'Transaction Failed - '
        ) {
          statusResponse.data.ErrorCode = '14';
          await handlePayoutUpdate(statusResponse.data, false);
        } else {
          await handlePayoutUpdate(statusResponse.data, true);
        }
      } else if (statusResponse.data.ErrorCode === 'TUP') {
        await handlePayoutUpdate(statusResponse.data, false, true);
      } else if (statusResponse.data.ErrorCode !== 'TUP' && statusResponse.data.ErrorCode !== '4') {
        await handlePayoutUpdate(statusResponse.data, false);
      } else {
        return res.status(400).send(statusResponse.data.ErrorMessage);
      }
    }

    // const [merchant] = await getMerchantsDao({id: singleWithdrawData.merchant_id});

    // Log the updated payout status
    logger.info('Payout Updated by PayAssist callback', {
      status: singleWithdrawData.status,
    });

    // Log the merchant payout URL
    // const merchantPayoutUrl = merchant.config.urls.payout_notify;

    // TODO: Implement the notification to the merchant's payout URL
    // if (merchantPayoutUrl !== null) {
    //   await merchantPayoutCallback(merchantPayoutUrl, {
    //     code: merchant.code,
    //     merchantOrderId: singleWithdrawData.merchant_order_id,
    //     payoutId: singleWithdrawData.id,
    //     amount: singleWithdrawData.amount,
    //     status: payload.status,
    //     utr_id: payload.utr ? payload.utr : '',
    //   });
    // }

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
