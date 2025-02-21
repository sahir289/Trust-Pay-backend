import { sendSuccess } from '../../utils/responseHandlers.js';
import { getPayinsDao } from '../payIn/payInDao.js';
import { getBankResponseDao, updateBotResponseDao } from './bankResponseDao.js';

import { getBankResponseService,
  createBankResponseService,
  getBankMessageServices,updateBotResponseDao} from './bankResponseServices.js';


const getBankResponse = async (req, res) => {
    try {
      const payload = req.query ; 
      const data = await getBankResponseService(payload);
      return sendSuccess(res, data, 'get bankResponse successfully');
    } catch (error) {
      console.error(res, error, 'error getting while getting bankResponse');
    }
  };

const createBankResponse = async (req, res) => {
    try {
      const payload = req.body?.body;      
      console.log(payload, "banksucess1")
      if (!payload) {
        console.error('payload is required');
      }
      const data = await createBankResponseService(payload);
      console.log( data, "bankresp121")
      return sendSuccess(res, data, 'Create BankResponse successfully');
    } catch (error) {
      console.error( error,'error getting while creating BankResponse');                                  
    }
  };

  
  const getBankMessage = async (req, res) => {
    try {
      const { bank_id, startDate, endDate } = req.query;
      const data = await getBankMessageServices(bank_id, startDate, endDate);
        return sendSuccess(res, data, 'Update BankResponse successfully');
    } catch (error) {
      console.error(res, error,'error getting while updating BankResponse');                                  
    }
}


const resetBankResponse = async (req, res) => {
    try {
      const { id } = req.body;
      const botRes = await getBankResponseDao({id: id});
      let getallPayinDataByUtr
      getallPayinDataByUtr = await getPayinsDao({user_submitted_utr : botRes.utr});
      const hasSuccess = getallPayinDataByUtr?.some((item) => item.status === 'SUCCESS');

      if (!hasSuccess) {
        const data = {
          is_used: false,
        }
        await updateBotResponseDao(id, data);


        const isEqualUTR = getallPayinDataByUtr?.some((item) => item.utr === botRes.utr);
        if (isEqualUTR) {
          const updatePayinID = getallPayinDataByUtr?.filter((item) => item.utr === botRes.utr && item.status !== 'FAILED');
          const updatePayinData = {
            status: "ASSIGNED",
            utr: null,
          }

          // await updatePayinsByIdDao(updatePayinID[0]?.id, updatePayinData)
        }


        return sendSuccess(
          res,
         
          "Bot response Reset successful"
        );

        //  const data = await resetBankResponseService(params.id, userData);
        // return sendSuccess(res, data, 'Delete BankResponse successfully');
      }
      else {
        const successPayinDataID = getallPayinDataByUtr?.filter((item) => item.status === 'SUCCESS');
        return sendSuccess(res, `UTR of this entry is already used with ${successPayinDataID[0]?.merchant_order_id} Merchant Order ID, No Changes Applied`);
      }
    } catch (error) {
      console.error(res, error,'error getting while updating BankResponse');                                  
    }
  };

export  {getBankResponse , 
  createBankResponse, 
  getBankMessage, resetBankResponse}
 