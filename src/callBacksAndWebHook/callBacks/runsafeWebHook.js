// Import required functions and classes
import { getBankByIdDao } from '../../apis/bankAccounts/bankaccountDao.js';
import { getPayoutByTxnId } from '../../apis/payOut/payOutDao.js';
import { Role, Status } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';
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

// Define the optimized runsafePayTransactionStatusCallback function
export const runsafeTransactionStatusCallback = async (req, res) => {
  const payload = req.body;
  console.log('Received runsafe callback payload:', payload);
  const apitxnid = payload?.platOrderNo;
  let conn;
  let committed = false;
  logger.info('Received runsafe callback payload:', payload);
  try {
    if (!apitxnid || apitxnid === '') {
      return res.status(404).send('Payment not found');
    }
    conn = await getConnection();
    await beginTransaction(conn);
    const singleWithdrawData = await getPayoutByTxnId(apitxnid);
    if (!singleWithdrawData) {
      await rollback(conn);
      return res.status(404).send('Payment not found');
    }

    if (
      ![Status.INITIATED, Status.PENDING].includes(singleWithdrawData.status)
    ) {
      logger.info('Payout already processed', {
        payoutId: singleWithdrawData.id,
        status: singleWithdrawData.status,
      });
      await rollback(conn);
      return res.status(200).send('Payout already processed');
    }

    logger.info('Fetched payout data for OrderID:', apitxnid);

    const [company] = await getCompanyByIDDao({
      id: singleWithdrawData.company_id,
    });
    logger.info(
      'Fetched company data for company_id:',
      singleWithdrawData.company_id,
    );

    // Prepare update payload based on callback response
    const bankId = company.config.runsafe.defaultBankId;
    const [bankVendor] = await getBankByIdDao({ id: bankId });
    const [vendor] = await getVendorsDao({ user_id: bankVendor.user_id });
    const updatePayload = {
      bank_acc_id: bankId,
      vendor_id: vendor.id,
      platOrderNo: payload?.platOrderNo,
      config: {
        method: 'runsafe',
        description: 'Payout processing via runsafe',
      },
    };
    const adminUser = await getUserByCompanyCreatedAtDao(
      singleWithdrawData.company_id,
      Role.ADMIN,
    );
    if (adminUser) updatePayload.updated_by = adminUser.id;

    // Status mapping: 'success' => APPROVED, 'failed' => REJECTED, else PENDING
    const statusStr = (payload.orderStatus || '').toString().toLowerCase();
    if (statusStr === 'success' || statusStr === 'SUCCESS') {
      Object.assign(updatePayload, {
        orderStatus: Status.APPROVED,
        utr_id: payload.utr || '',
        approved_at: new Date().toISOString(),
      });
    } else if (statusStr === 'failed' || statusStr === 'FAILED') {
      updatePayload.status = Status.REJECTED;
      updatePayload.config.rejected_reason =
        payload.description || 'Transaction failed';
      updatePayload.rejected_at = new Date().toISOString();
    } else {
      updatePayload.status = Status.PENDING;
    }

    logger.info('Final update payload for payout:', updatePayload);
    await _updatePayoutServiceInternal(
      {
        id: singleWithdrawData.id,
        company_id: singleWithdrawData.company_id,
      },
      updatePayload,
      null,
      conn,
    );

    logger.info('Payout Updated by runsafe callback', {
      status: updatePayload.orderStatus,
    });

    await commit(conn);
    committed = true;
    return res.status(200).send('Payout Updated Successfully');
  } catch (err) {
    console.log(err);
    if (conn && !committed) await rollback(conn);
    logger.error('getting error while updating payout', err);
  } finally {
    if (conn) {
      logger.info('Releasing connection');
      conn.release();
    }
  }
};
