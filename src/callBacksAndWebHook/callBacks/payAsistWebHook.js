// Import required functions and classes
import { getBankByIdDao } from '../../apis/bankAccounts/bankaccountDao.js';
// import { getMerchantsDao } from '../../apis/merchants/merchantDao.js';
import { getPayoutsDao } from '../../apis/payOut/payOutDao.js';
// import { merchantPayoutCallback } from '../merchantCallBacks.js';
import { payAssistErrorCodeMap, Role, Status } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';
// import axios from 'axios';
import { getCompanyByIDDao } from '../../apis/company/companyDao.js';
import { getVendorsDao } from '../../apis/vendors/vendorDao.js';
import { updatePayoutService } from '../../apis/payOut/payOutService.js';
import { getUserByCompanyCreatedAtDao } from '../../apis/users/userDao.js';
import { sendSuccess } from '../../utils/responseHandlers.js';

// Define the optimized payAssistTransactionStatusCallback function
export const payAssistTransactionStatusCallback = async (req, res) => {
  sendSuccess(res, {}, 'Payassist Webhook received successfully');
  const payload = req.body;
  const apitxnid = payload?.Response?.apitxnid;

  try {
    if (!apitxnid || apitxnid === '') {
      logger.warn('PayAssist webhook missing apitxnid', {
        merchant_order_id: apitxnid || null,
        payload,
      });
      return;
    }

    const [singleWithdrawData] = await getPayoutsDao({ merchant_order_id: apitxnid });
    if (!singleWithdrawData) {
      logger.warn('PayAssist webhook payout not found', {
        merchant_order_id: apitxnid,
      });
      return;
    }

    if (
      ![Status.INITIATED, Status.PENDING].includes(singleWithdrawData.status)
    ) {
      logger.info('Payout already processed', {
        merchant_order_id: apitxnid,
        payoutId: singleWithdrawData.id,
        status: singleWithdrawData.status,
      });
      return;
    }

    const [company] = await getCompanyByIDDao({
      id: singleWithdrawData.company_id,
    });

    // Cache API configuration to avoid repeated property access
    // const apiConfig = {
    //   headers: {
    //     APIAGENT: company.config.PAY_ASSIST.walletsPayoutsAgent,
    //     APIKEY: company.config.PAY_ASSIST.walletsPayoutsApiKey,
    //   },
    //   baseUrl: company.config.PAY_ASSIST.walletsPayoutsUrl,
    //   agentCode: company.config.PAY_ASSIST.walletsPayoutsAgentCode,
    // };

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
          responseData.Response.message ||
          payAssistErrorCodeMap[responseData.Response.statusCode] ||
          'Server Unreachable';
        updatePayload.rejected_at = new Date().toISOString();
      }

      await updatePayoutService(
        {
          id: singleWithdrawData.id,
          company_id: singleWithdrawData.company_id,
        },
        updatePayload,
      );
    };

    // Handle response based on ErrorCode
    let errorCode = payload.ErrorCode;
    let statuscode = payload?.Response?.statuscode
    // let statusResponse = null;

    if (errorCode) {
      if (errorCode === '0' && statuscode === 'TXN') {
        await handlePayoutUpdate(payload, true);
      } else if (errorCode === '0' && statuscode === 'TUP') {
        await handlePayoutUpdate(payload, false, true);
      } else if (errorCode === '1' && statuscode === 'TXF') {
        await handlePayoutUpdate(payload, false);
      } else {
          logger.error('PayAssist payout callback error', {
            merchant_order_id: apitxnid,
            errorMessage: payload.ErrorMessage,
            response: payload?.Response,
          });
        return;
      }
    }

    // Log the updated payout status
    logger.info('Payout Updated by PayAssist callback', {
      merchant_order_id: apitxnid,
      payoutId: singleWithdrawData.id,
      status: singleWithdrawData.status,
    });
    return;
  } catch (err) {
    // Log any errors while updating the payout
    logger.error('getting error while updating payout', {
      merchant_order_id: apitxnid,
      error: err?.message || err,
    });
  }
};
