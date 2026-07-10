import { BadRequestError, NotFoundError } from "../../../utils/appErrors.js";
import logger from "../../../utils/logger.js";
import { getMerchantsByAuthCodeDao, getMerchantsDao } from "../../merchants/merchantDao.js";
import { getPayoutsDao } from "../../payOut/payOutDao.js";
import { getLatestNetBalanceByMerchantUserIdDao } from "../../walletBalance/walletBalanceDao.js";

// Public API Used by Merchants
export const checkPayOutStatusV2Service = async (
  merchantCode,
  merchantOrderId,
) => {
  try {
    const merchantArr = await getMerchantsDao(
      { code: merchantCode },
      null,
      null,
      null,
      null,
      null,
      null,
    );
    const merchant = merchantArr[0];
    if (!merchant) {
      throw new BadRequestError('Merchant does not exist');
    }

    const payOut = await getPayoutsDao(
      {
        merchant_order_id: merchantOrderId,
      },
      null,
      null,
      null,
      null,
      null,
      null,
    );
    if (payOut.length == 0) {
      throw new NotFoundError('Payout not found');
    }

    //check is payout detials belongs to that merchant or not
    if (!(payOut[0].merchant_id === merchant.id)) {
      throw new NotFoundError(
        'merchant_order_id does not belong to the specified merchant',
      );
    }
    return {
      status: payOut[0].status,
      merchantOrderId: payOut[0].merchant_order_id,
      amount: payOut[0].amount,
      payoutId: payOut[0].id,
      utr_id: payOut[0].utr_id ? payOut[0].utr_id : ' ',
    };
  } catch (error) {
    logger.error('Error check payout status:', error);
    throw error;
  }
};

export const getWalletBalanceService = async (code) => {
  try {
    // Merchant auth -> fetch merchant/user_id
    const merchant = await getMerchantsByAuthCodeDao(code);

    if (!merchant) {
      throw new NotFoundError('Invalid merchant code or API key');
    }

    const netBalance = await getLatestNetBalanceByMerchantUserIdDao(
      merchant.user_id,
    );

    if (netBalance === null || netBalance === undefined) {
      return { balance: 0 };
    }
    return { balance: netBalance };
  } catch (error) {
    console.error('Error in getWalletBalanceService:', error);
    throw error;
  }
};