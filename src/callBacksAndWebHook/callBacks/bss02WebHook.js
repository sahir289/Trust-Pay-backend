// Import required functions and classes
import { getBankByIdDao } from '../../apis/bankAccounts/bankaccountDao.js';
// import { getMerchantsDao } from '../../apis/merchants/merchantDao.js';
import { getPayoutsDao } from '../../apis/payOut/payOutDao.js';
// import { merchantPayoutCallback } from '../merchantCallBacks.js';
import { Role, Status } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';
// import axios from 'axios';
import { getCompanyByIDDao } from '../../apis/company/companyDao.js';
import { getVendorsDao } from '../../apis/vendors/vendorDao.js';
import { _updatePayoutServiceInternal } from '../../apis/payOut/payOutService.js';
import { getUserByCompanyCreatedAtDao } from '../../apis/users/userDao.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';

// Define the optimized payAssistTransactionStatusCallback function
export const bss02TransactionStatusCallback = async (req, res) => {
  const payload = req.body;
  const apitxnid = payload?.CallBack?.OrderID;
  let conn;
  let committed = false;
  logger.info('Received BSS1013 callback payload:', payload);
  try {
    if (!apitxnid || apitxnid === '') {
      return res.status(404).send('Payment not found');
    }

    conn = await getConnection();
    await beginTransaction(conn);
    const [singleWithdrawData] = await getPayoutsDao(
      { merchant_order_id: apitxnid },
      null,
      null,
      null,
      null,
      null,
      conn,
    );
    if (!singleWithdrawData) {
      await rollback(conn);
      return res.status(404).send('Payment not found');
    }

    if (
      ![Status.INITIATED, Status.PENDING, Status.APPROVED].includes(singleWithdrawData.status) &&
      singleWithdrawData.utr_id !== payload.CallBack.RRN
    ) {
      logger.info('Payout already processed', {
        payoutId: singleWithdrawData.id,
        status: singleWithdrawData.status,
      });
      await rollback(conn);
      return res.status(200).send('Payout already processed');
    }
    logger.info('Fetched payout data for OrderID:', apitxnid);

    const [company] = await getCompanyByIDDao(
      {
        id: singleWithdrawData.company_id,
      },
      conn,
    );
    logger.info(
      'Fetched company data for company_id:',
      singleWithdrawData.company_id,
    );
    const handlePayoutUpdate = async (
      responseData,
      isApproved = false,
      isTransactionUnderProcess = false,
      isReversed = false,
      conn,
    ) => {
      const bankId = company.config.BSS02.defaultBankId;
      const [bankVendor] = await getBankByIdDao({ id: bankId }, conn);
      const [vendor] = await getVendorsDao(
        {
          user_id: bankVendor.user_id,
        },
        null,
        null,
        null,
        null,
        null,
        null,
        conn,
      );
      const updatePayload = {
        bank_acc_id: bankId,
        vendor_id: vendor.id,
        config: {
          method: 'BSS1013',
          description: 'Payout processing via BSS1013',
        },
      };
      const adminUser = await getUserByCompanyCreatedAtDao(
        singleWithdrawData.company_id,
        Role.ADMIN,
        conn,
      );
      if (adminUser) updatePayload.updated_by = adminUser.id;
      logger.info('Preparing to update payout with payload:', updatePayload);
      if (isApproved) {
        Object.assign(updatePayload, {
          status: Status.APPROVED,
          utr_id: isTransactionUnderProcess ? null : responseData.CallBack.RRN,
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
        logger.info('Payout rejected with response data:', responseData);
        updatePayload.config.rejected_reason =
          responseData.CallBack.Message || 'Server Unreachable';
        updatePayload.rejected_at = new Date().toISOString();
      }
      logger.info('Final update payload for payout:', updatePayload);
      // const data = await _updatePayoutServiceInternal(ids, payload, role, conn);
      await _updatePayoutServiceInternal(
        {
          id: singleWithdrawData.id,
          company_id: singleWithdrawData.company_id,
        },
        updatePayload,
        null,
        conn,
      );
    };

    if (
      payload?.CallBack?.Status === Status.SUCCESS ||
      payload?.CallBack?.Status === 'Success'
    ) {
      await handlePayoutUpdate(payload, true, false, conn);
    } else if (
      payload?.CallBack?.Status === 'Pending' ||
      payload?.CallBack?.Status === Status.PENDING
    ) {
      await handlePayoutUpdate(payload, false, true, conn);
    } else if (
      payload?.CallBack?.Status === 'Failed' ||
      payload?.CallBack?.Status === Status.FAILED
    ) {
      if (singleWithdrawData.status === Status.APPROVED) {
        await handlePayoutUpdate(payload, false, false, true, conn);
      } else {
        await handlePayoutUpdate(payload, false, false, false, conn);
      }
    } else {
      await rollback(conn);
      return res.status(400).send(payload.ErrorMessage);
    }

    // Log the updated payout status
    logger.info('Payout Updated by PayAssist callback', {
      status: singleWithdrawData.status,
    });

    await commit(conn);
    committed = true;

    return res.status(200).send('Payout Updated Successfully');
  } catch (err) {
    if (conn && !committed) await rollback(conn);
    // Log any errors while updating the payout
    logger.error('getting error while updating payout', err);
  } finally {
    if (conn) {
      logger.info('Releasing connection');
      conn.release(); // Always release connection
    }
  }
};
