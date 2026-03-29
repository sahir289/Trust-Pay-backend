// Import required functions and classes
import { getBankByIdDao } from '../../apis/bankAccounts/bankaccountDao.js';
import { getPayoutsDao } from '../../apis/payOut/payOutDao.js';
import { payAssistErrorCodeMap, Role, Status } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';
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
export const silkPayTransactionStatusCallback = async (req, res) => {
  const payload = req.body;
  const apitxnid = payload?.mOrderId;
  let conn;
  logger.info('Received SILKPAY callback payload:', payload);
  try {
    if (!apitxnid || apitxnid === '') {
      return res.status(404).send('Payment not found');
    }
    conn = await getConnection();
    await beginTransaction(conn);
    const [singleWithdrawData] = await getPayoutsDao({ merchant_order_id: apitxnid });
    if (!singleWithdrawData) {
      return res.status(404).send('Payment not found');
    }

    if (
      ![Status.INITIATED, Status.PENDING].includes(singleWithdrawData.status)
    ) {
      logger.info('Payout already processed', {
        payoutId: singleWithdrawData.id,
        status: singleWithdrawData.status,
      });
      return res.status(200).send('Payout already processed');
    }
    logger.info('Fetched payout data for OrderID:', apitxnid);

    const [company] = await getCompanyByIDDao({
      id: singleWithdrawData.company_id,
    });
    logger.info('Fetched company data for company_id:', singleWithdrawData.company_id);
    const handlePayoutUpdate = async (
      responseData,
      isApproved = false,
      isTransactionUnderProcess = false,
    ) => {
      const bankId = company.config.SILKPAY.defaultBankId;
      const [bankVendor] = await getBankByIdDao({ id: bankId });
      const [vendor] = await getVendorsDao({
        user_id: bankVendor.user_id,
      });
      const updatePayload = {
        bank_acc_id: bankId,
        vendor_id: vendor.id,
        config: {
          method: 'SILKPAY',
          description: 'Payout processing via SILKPAY',
        },
      };
      const adminUser = await getUserByCompanyCreatedAtDao(
        singleWithdrawData.company_id,
        Role.ADMIN,
      );
      if (adminUser) updatePayload.updated_by = adminUser.id;
      logger.info('Preparing to update payout with payload:', updatePayload);
      if (isApproved) {
        Object.assign(updatePayload, {
          status: Status.APPROVED,
          utr_id: isTransactionUnderProcess
            ? null
            : responseData.utr,
          approved_at: new Date().toISOString(),
        });
      } else if (!isApproved && isTransactionUnderProcess) {
        Object.assign(updatePayload, {
          status: Status.PENDING,
        });
      } else {
        logger.info('Payout rejected with response data:', responseData);
        updatePayload.config.rejected_reason =
          responseData.Response.message ||
          payAssistErrorCodeMap[responseData.Response.statusCode] ||
          'Server Unreachable';
        updatePayload.rejected_at = new Date().toISOString();
      }
      logger.info('Final update payload for payout:', updatePayload);
      // const data = await _updatePayoutServiceInternal(ids, payload, role, conn);
      await updatePayoutService(
        conn, 
        {
          id: singleWithdrawData.id,
          company_id: singleWithdrawData.company_id,
        },
        updatePayload
      );
    };

      if (payload?.status === 2 || payload?.status === '2' ) {
        await handlePayoutUpdate(payload, true);
      } else if (payload?.status === 1 || payload?.status === '1') {
        await handlePayoutUpdate(payload, false, true);
      } else if (payload?.status === 3 || payload?.status === "3") {
        await handlePayoutUpdate(payload, false);
      } else {
        return res.status(400).send(payload.ErrorMessage);
      }

    // Log the updated payout status
    logger.info('Payout Updated by PayAssist callback', {
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
