import { transactionWrapper } from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { sendSuccess } from "../../utils/responseHandlers.js";
import { createBankResponseService } from "../bankResponse/bankResponseServices.js";
import { getPayInIntentDao } from "../payIn/payInDao.js";
import { processPayInService } from "../payIn/payInService.js";
// import { generateHash } from "../../zentechind/zentechInd.js";

export const zenTechIndWebhook = async (req, res) => {
  try {
    sendSuccess(res, 200, 'Webhook received successfully');
    const body = req.body?.transaction;
    // const hash = generateHash(body);
    // if (hash !== body.hash) {
    //   logger.error('Invalid hash in ZenTechInd webhook');
    //   return;
    // }

    const payload = {
      merchantOrderId: body?.order_id,
      userSubmittedUtr: body?.utr,
      amount: Number(body?.amount),
    };
    const payIn = await getPayInIntentDao(body?.order_id);

    const bankResponsePayload = `${body?.amount} nil ${body?.utr} ${payIn.bank_acc_id}`;

    if (body?.status === 'success') {
      await createBankResponseService(
        bankResponsePayload,
        payIn.company_id,
        'BOT',
        'zenTechInd',
      );
    }
    await transactionWrapper(processPayInService)(payload);

  } catch (error) {
    logger.error('zenTechInd webhook error:', error || error);
  }
};
