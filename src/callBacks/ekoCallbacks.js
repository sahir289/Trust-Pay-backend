/* eslint-disable no-unused-vars */
// Import required functions and classes
import {
    getBankaccountDao,
    updateBankaccountByIdDao,
} from '../apis/bankAccounts/bankaccountDao';
import { getMerchantsDao } from '../apis/merchants/merchantDao';
import { getPayoutsDao, updatePayoutDao } from '../apis/payOut/payOutDao';
import { NotFoundError } from '../utils/appErrors';
import Logger from '../utils/logger';
import { merchantPayoutCallback } from './merchantCallBacks';

// Initialize logger
const logger = new Logger();

// Define the optimized ekoTransactionStatusCallback function
export const ekoTransactionStatusCallback = async (req, res) => {
    const payload = req.body;
    const tid = payload.tid;

    try {
        const singleWithdrawData = await getPayoutsDao(tid);
        if (!singleWithdrawData) {
            return NotFoundError('Payment not found');
        }

        // Prepare the updated data object
        const updatedData = {
            status:
                payload.txstatus_desc.toUpperCase() === 'SUCCESS'
                    ? payload.txstatus_desc.toUpperCase()
                    : 'REJECTED',
            amount: Number(payload.amount),
            utr_id: payload.tid ? String(payload.tid) : '',
            approved_at:
                payload.txstatus_desc.toUpperCase() === 'SUCCESS'
                    ? payload.timestamp
                    : null,
            rejected_at:
                payload.txstatus_desc.toUpperCase() !== 'SUCCESS'
                    ? payload.timestamp
                    : null,
        };

        const merchant = await getMerchantsDao(singleWithdrawData.merchant_id);
        const data = await updatePayoutDao(singleWithdrawData.id, updatedData);

        // Log the updated payout status
        logger.info('Payout Updated by Eko callback', {
            status: data.status,
        });

        // Update the bank account if 'from_bank' is present in the payload
        if (payload.from_bank) {
            const bankAccountRes = await getBankaccountDao(data.from_bank);
            await updateBankaccountByIdDao(
                bankAccountRes.id,
                parseFloat(data.amount),
                payload.status
            );
        }

        // Log the merchant payout URL
        const merchantPayoutUrl = merchant.payout_notify_url;
        console.log(merchantPayoutUrl);

        // TODO: Implement the notification to the merchant's payout URL
        if (merchantPayoutUrl !== null) {
            let merchantPayoutData = {
              code: merchant.code,
              merchantOrderId: singleWithdrawData.merchant_order_id,
              payoutId: singleWithdrawData.id,
              amount: singleWithdrawData.amount,
              status: payload.status,
              utr_id: payload.utr ? payload.utr : "",
            }
            await merchantPayoutCallback(merchantPayoutUrl, merchantPayoutData);
        }

        return data;
    } catch (err) {
        // Log any errors while updating the payout
        logger.error('getting error while updating payout', err);
    }
};