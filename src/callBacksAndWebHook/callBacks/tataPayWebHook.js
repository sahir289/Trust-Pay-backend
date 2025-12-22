// Import required functions and classes
// import axios from 'axios';
import { getBankByIdDao } from '../../apis/bankAccounts/bankaccountDao.js';
import { getCompanyByIDDao } from '../../apis/company/companyDao.js';
import { getPayoutByTxnId } from '../../apis/payOut/payOutDao.js';
import { updatePayoutService } from '../../apis/payOut/payOutService.js';
import { getUserByCompanyCreatedAtDao } from '../../apis/users/userDao.js';
import { getVendorsDao } from '../../apis/vendors/vendorDao.js';
import { Role, Status } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';

export const tataPayTransactionStatusCallback = async (req, res) => {
  sendSuccess(res, {}, 'Webhook received successfully');
  const payload = req.body;
  const apitxnid = payload?.payoutId;

  try {
    if (!apitxnid || apitxnid === '') {
      return res.status(404).send('Payment not found');
    }
    
    // Use the DAO function to find the payout
    const singleWithdrawData = await getPayoutByTxnId(apitxnid);
    
    if (!singleWithdrawData) {
      return res.status(404).send('Payment not found');
    }

    if (
      singleWithdrawData.status === Status.APPROVED ||
      singleWithdrawData.status === Status.REJECTED
    ) {
      logger.info('Payout already processed', {
        payoutId: singleWithdrawData.id,
        status: singleWithdrawData.status,
      });
      return
    }

    const [company] = await getCompanyByIDDao({
      id: singleWithdrawData.company_id,
    });

    // Cache API configuration to avoid repeated property access
    // const apiConfig = {
    //   headers: {
    //     'x-api-key': company.config.TATA_PAY.walletsPayoutsApiKey,
    //   },
    //   baseUrl: company.config.TATA_PAY.walletsPayoutsUrl,
    // };

    const handlePayoutUpdate = async (
      responseData,
      isApproved = false,
      isTransactionUnderProcess = false,
      isReversed = false,
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
            : responseData.utr,
          approved_at: new Date().toISOString(),
        });
      } else if (!isApproved && isTransactionUnderProcess) {
        Object.assign(updatePayload, {
          status: Status.PENDING,
        });
      } else if (isReversed) {
        Object.assign(updatePayload, {
          status: Status.REVERSED,
          rejected_at: new Date().toISOString(),
        });
      } else {
        updatePayload.config.rejected_reason =
          responseData.remark || 'Server Unreachable';
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

    // let statusResponse = null;
    // Transaction Under Process - check status
    // const queryParams = {
    //   searchKey: apitxnid,
    //   page: 1,
    //   limit: 10,
    // }; // Include transaction ID in payload
    // statusResponse = await retryAxiosRequest(
    //   async () => {
    //     return await axios.get(`${apiConfig.baseUrl}/Search_payout`, {
    //       headers: apiConfig.headers,
    //       params: queryParams,
    //       timeout: 15000, // 15 second timeout for status check
    //       maxRedirects: 3,
    //       validateStatus: function (status) {
    //         return status < 500;
    //       },
    //     });
    //   },
    //   2,
    //   500,
    // ); // 2 retries with 500ms base delay for status checks
    // logger.info(
    //   `TataPay payoutStatus response for apitxnid ${singleWithdrawData.id}:`,
    //   statusResponse.data,
    // );

    const payoutData = payload;
    
    if (
      payoutData.status === 'processing' ||
      payoutData.status === 'pending'
    ) {
      await handlePayoutUpdate(payoutData, false, true);
    } else if (payoutData.status === 'approved') {
      await handlePayoutUpdate(payoutData, true);
    } else if (payoutData.status === 'rejected') {
      if (singleWithdrawData.status === Status.APPROVED) {
        await handlePayoutUpdate(payoutData, false, false, true);
      }
      else {
        await handlePayoutUpdate(payoutData, false);
      }
    } else {
      return res.status(400).send(payload.ErrorMessage || 'Unknown status from payment provider');
    }

    // Log the updated payout status
    logger.info('Payout Updated by TataPay callback', {
      status: singleWithdrawData.status,
    });

    return res.status(200).send('Payout Updated Successfully');
  } catch (err) {
    // Log any errors while updating the payout
    logger.error('getting error while updating payout', err);
  }
};
