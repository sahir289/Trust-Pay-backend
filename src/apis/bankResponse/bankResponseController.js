import { CREATE_BANK_RESPONSE_SCHEMA } from '../../schemas/bankResponseSchema.js';
import { ValidationError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getPayInUrlsDao, updatePayInUrlDao } from '../payIn/payInDao.js';
import { getBankResponseDao, updateBotResponseDao } from './bankResponseDao.js';

import {
  getBankResponseService,
  createBankResponseService,
  getBankMessageServices
} from './bankResponseServices.js';


const getBankResponse = async (req, res) => {
  try {
    const payload = req.query;
    const data = await getBankResponseService(payload);
    return sendSuccess(res, data, 'get bankResponse successfully');
  } catch (error) {
    console.error(res, error, 'error getting while getting bankResponse');
  }
};

const createBankResponse = async (req, res) => {
  try {

    const payload = req.body?.body;
    if (!payload) {
      console.error('payload is required');
    }
    const { error } = CREATE_BANK_RESPONSE_SCHEMA.validate(req.body);
    if (error) {
      throw new ValidationError(error);
    }
    const data = await createBankResponseService(payload);
    return sendSuccess(res, data, 'Create BankResponse successfully');
  } catch (error) {
    console.error(error, 'error getting while creating BankResponse');
  }
};


const getBankMessage = async (req, res) => {
  try {
    const { bank_id, startDate, endDate } = req.query;
    const data = await getBankMessageServices(bank_id, startDate, endDate);
    return sendSuccess(res, data, 'Update BankResponse successfully');
  } catch (error) {
    console.error(res, error, 'error getting while updating BankResponse');
  }
}


const resetBankResponse = async (req, res) => {
  try {
    const { id } = req.body;
    const botRes = await getBankResponseDao({ id: id });
    let getallPayinDataByUtr
    getallPayinDataByUtr = await getPayInUrlsDao({ user_submitted_utr: botRes.utr });

    const hasSuccess = getallPayinDataByUtr?.some((item) => item.status === 'SUCCESS');

    if (!hasSuccess) {
      const data = {
        is_used: false,
      }
      await updateBotResponseDao(id, data);


      const isEqualUTR = getallPayinDataByUtr?.some((item) => item.user_submitted_utr === botRes.utr);
      if (isEqualUTR) {
        const updatePayinID = getallPayinDataByUtr?.filter((item) => item.user_submitted_utr === botRes.utr && item.status !== 'FAILED');
        const updatePayinData = {
          status: "ASSIGNED",
          user_submitted_utr: null,
        }
        await updatePayInUrlDao(updatePayinID[0]?.id, updatePayinData)
      }
      return sendSuccess(
        res,
        "Bot response Reset successful"
      );
    }
    else {
      const successPayinDataID = getallPayinDataByUtr?.filter((item) => item.status === 'SUCCESS');
      return sendSuccess(res, `UTR of this entry is already used with ${successPayinDataID[0]?.merchant_order_id} Merchant Order ID, No Changes Applied`);
    }
  } catch (error) {
    console.error(res, error, 'error getting while updating BankResponse');
  }
};

export {
  getBankResponse,
  createBankResponse,
  getBankMessage, resetBankResponse
}
