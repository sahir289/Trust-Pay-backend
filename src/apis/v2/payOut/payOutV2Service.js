import logger from "../../../utils/logger.js";
import { getMerchantsDao } from "../../merchants/merchantDao.js";
import { getPayoutsDao } from "../../payOut/payOutDao.js";

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
      const data = {
        status: 400,
        message: 'Merchant does not exist',
      };
      return data;
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
      const data = {
        status: 404,
        message: 'Payout not found',
      };
      return data;
    }

    //check is payout detials belongs to that merchant or not
    if (!(payOut[0].merchant_id === merchant.id)) {
      const data = {
        status: 404,
        message:
          'merchant_order_id does not belong to the specified merchant',
      };
      return data;
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