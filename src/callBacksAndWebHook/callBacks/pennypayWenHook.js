import { getBankByIdDao } from '../../apis/bankAccounts/bankaccountDao.js';
import { getPayoutsDao } from '../../apis/payOut/payOutDao.js';
import { Role, Status } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';
import { getCompanyByIDDao } from '../../apis/company/companyDao.js';
import { getVendorsDao } from '../../apis/vendors/vendorDao.js';
import { updatePayoutService } from '../../apis/payOut/payOutService.js';
import { getUserByCompanyCreatedAtDao } from '../../apis/users/userDao.js';
import { sendSuccess } from '../../utils/responseHandlers.js';

export const pennypaySuccessCallback = async (req, res) => {
  sendSuccess(res, {}, 'Webhook received successfully');
  const payload = req.body;
  const merchantOrderId = payload?.merchantOrderId;
  const pennyPayStatus = payload?.status;
  logger.info('Webhook received pennypay payload ', payload);

  try {
    if (!merchantOrderId) {
      logger.error('Merchant Order ID missing in webhook payload');
      return;
    }
    const [singleWithdrawData] = await getPayoutsDao({ merchant_order_id: merchantOrderId });
    if (!singleWithdrawData) {
      logger.error(`Payment not found for merchantOrderId: ${merchantOrderId}`);
      return;
    }
if (
  singleWithdrawData.status === Status.REJECTED || 
  singleWithdrawData.status === Status.REVERSED
) {
  logger.info('Payout already in final terminal state (REJECTED/REVERSED)', {
    payoutId: singleWithdrawData?.id,
    status: singleWithdrawData?.status,
  });
  return;
}

if (singleWithdrawData.status === Status.APPROVED && pennyPayStatus !== 'REVERSED') {
  logger.info('Payout already APPROVED. Ignoring non-REVERSED callback.', {
    payoutId: singleWithdrawData?.id,
    incomingStatus: pennyPayStatus,
  });
  return;
}

    const [company] = await getCompanyByIDDao({
      id: singleWithdrawData.company_id,
    });

    const bankId = company.config.PENNY_PAY?.defaultBankId || company.config.PAY_DUM?.defaultBankId;
    const [bankVendor] = await getBankByIdDao({ id: bankId });
    const [vendor] = await getVendorsDao({
      user_id: bankVendor.user_id,
    });

    const updatePayload = {
      bank_acc_id: bankId,
      vendor_id: vendor.id,
      config: {
        method: 'PennyPay',
        description: 'Payout processing via PennyPay',
        payoutId: payload?.payoutId // PennyPay ki unique ID save karne ke liye
      },
    };

    const adminUser = await getUserByCompanyCreatedAtDao(
      singleWithdrawData.company_id,
      Role.ADMIN,
    );
    if (adminUser) updatePayload.updated_by = adminUser.id;

    if (pennyPayStatus === 'APPROVED') {
      Object.assign(updatePayload, {
        status: Status.APPROVED,
        utr_id: payload?.utr_id,
        approved_at: new Date().toISOString(),
      });
    } 
    else if (pennyPayStatus === 'REJECTED') {
      Object.assign(updatePayload, {
        status: Status.REJECTED,
        rejected_at: new Date().toISOString(),
      });
      updatePayload.config.rejected_reason = payload?.message || 'Transaction Rejected by Bank';
    } 
    else if (pennyPayStatus === 'REVERSED') {
      Object.assign(updatePayload, {
        status: Status.REVERSED,
        utr_id: payload?.utr_id,
        rejected_at: new Date().toISOString(),
      });
    } 
    else {
      Object.assign(updatePayload, {
        status: Status.PENDING,
      });
    }
    await updatePayoutService(
      {
        id: singleWithdrawData.id,
        company_id: singleWithdrawData.company_id,
      },
      updatePayload,
    );
    logger.info('Payout Updated by PennyPay callback', {
      payoutId: singleWithdrawData.id,
      newStatus: updatePayload.status,
    });

  } catch (err) {
    logger.error('Getting error while updating PennyPay payout', err);
  }
};