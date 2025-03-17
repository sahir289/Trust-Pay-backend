import { InternalServerError } from '../../utils/appErrors.js';
import { getBankResponseDao, updateBotResponseDao } from '../bankResponse/bankResponseDao.js';
import { getPayInUrlDao, getPayInUrlsDao, updatePayInUrlDao } from '../payIn/payInDao.js';
import {
  createResetHistoryDao,
  deleteResetHistoryDao,
  getResetHistoryDao,
} from './resetDao.js';

const getResetHistoryService = async (id, page, limit) => {
  try {
    const pageNumber = parseInt(page, 10) || 1;
      const pageSize = parseInt(limit, 10) || 10;
    const result = await getResetHistoryDao({company_id: id} , pageNumber, pageSize);
    return result;
  } catch (error) {
    console.error('error getting while reset history', error);
    throw new InternalServerError('Error getting while reset history');
  }
};
const createResetHistoryService = async (payload) => {
  try {
    const result = await createResetHistoryDao(payload);
    return result;
  } catch (error) {
    console.error('error getting while reset history', error);
    throw new InternalServerError('Error getting while reset history');
  }
};


const updateResetHistoryService = async (id, company_id) => {
  try {
    const payInData = await getPayInUrlDao({merchant_order_id : id})
    // await sendResetEntryTelegramMessage(
    //   config?.telegramEntryResetChatId,
    //   payInData,
    //   config?.telegramBotToken,
    // );
    if (payInData?.status !== "SUCCESS" && payInData?.status !== "FAILED") {
      const utr =  payInData.user_submitted_utr
      const botRes = await getBankResponseDao({utr : utr})
      
      let getallPayinDataByUtr
      getallPayinDataByUtr = await getPayInUrlsDao({user_submitted_utr : utr})
      
      if (getallPayinDataByUtr){
        const hasSuccess = getallPayinDataByUtr.some((item) => item.status === 'SUCCESS');
        if (!hasSuccess && botRes?.id) {
          await updateBotResponseDao({id:botRes?.id}, {is_used: false});
        }
      }
    // const result = 
    await updatePayInUrlDao({id: payInData?.id, company_id:company_id}, {
      status: "ASSIGNED",
      confirmed: null,
      payin_merchant_commission: null,
      payin_vendor_commission: null,
      user_submitted_utr: null,
      duration: null,
    });
    return ("Transaction Reset Successfully");}
    else {
    return ("Transaction status is SUCCESS or FAILED, no update applied");
    }
  } catch (error) {
    console.error('error getting while reset history', error);
    throw new InternalServerError('Error getting while reset history');
  }
};
const deleteResetHistoryService = async (id) => {
  try {
    const result = await deleteResetHistoryDao(id, { is_obsolete: true });
    return result;
  } catch (error) {
    console.error('error getting while reset history', error);
    throw new InternalServerError('Error getting while reset history');
  }
};

export {
  getResetHistoryService,
  createResetHistoryService,
  updateResetHistoryService,
  deleteResetHistoryService,
};
