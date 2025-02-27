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
    const {role} = req.user;
    const {company_id} = req.user;
    payload.company_id = company_id;
    const data = await getBankResponseService(payload, role);
    return sendSuccess(res, data, 'get bankResponse successfully');
  } catch (error) {
    console.error(res, error, 'error getting while getting bankResponse');
  }
};

const createBankResponse = async (req, res) => {
  try {
    const {role} = req.user;
    const payload = req.body?.body;
    const { company_id, user_id } = req.user;
    payload.created_by = user_id
    if (!payload) {
      console.error('payload is required');
    }
    const { error } = CREATE_BANK_RESPONSE_SCHEMA.validate(req.body);
    if (error) {
      throw new ValidationError(error);
    }
    // const data = 
    await createBankResponseService(payload, company_id, role);
    return sendSuccess(res, 'Create BankResponse successfully');
  } catch (error) {
    console.error(error, 'error getting while creating BankResponse');
  }
};


const getBankMessage = async (req, res) => {
  try {
    const { company_id } = req.user;
    const { role } = req.user;
    const { bank_id, startDate, endDate } = req.query;
    const data = await getBankMessageServices(bank_id, startDate, endDate, company_id, role);
    return sendSuccess(res, data, 'Get BankResponse successfully');
  } catch (error) {
    console.error(res, error, 'error getting while updating BankResponse');
  }
}


const resetBankResponse = async (req, res) => {
  try {
    const { company_id, user_id } = req.user;
    const { id } = req.body;
    const botRes = await getBankResponseDao({ id: id , company_id:company_id });
    let getallPayinDataByUtr
    getallPayinDataByUtr = await getPayInUrlsDao({ user_submitted_utr: botRes.utr });

    const hasSuccess = getallPayinDataByUtr?.some((item) => item.status === 'SUCCESS');

    if (!hasSuccess) {
      const data = {
        is_used: false,
        updated_by: user_id
      }
      await updateBotResponseDao(id, data);


      const isEqualUTR = getallPayinDataByUtr?.some((item) => item.user_submitted_utr === botRes.utr);
      if (isEqualUTR) {
        const updatePayinID = getallPayinDataByUtr?.filter((item) => item.user_submitted_utr === botRes.utr && item.status !== 'FAILED');
        const updatePayinData = {
          status: "ASSIGNED",
          user_submitted_utr: null,
          updated_by: user_id
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
