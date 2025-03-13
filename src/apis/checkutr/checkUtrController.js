import { BadRequestError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createCheckUtrService, deleteCheckUtrService, getCheckUtrService, updateCheckUtrService } from './checkUtrServices.js';
import { getPayinDetailsByMerchantOrderId } from '../payIn/payInDao.js';


const getCheckUtr = async (req, res) => {
    const { company_id } = req.user;
    const data = await getCheckUtrService({company_id, ...req.query});
    return sendSuccess(res, data, 'get CheckUtr successfully');
};

const createCheckUtr = async (req, res) => {
  const payload = req.body;
  const payinData = await getPayinDetailsByMerchantOrderId(payload.merchant_order_id);
  payload.payin_id = payinData[0].payin_id;
  const { company_id,user_id } = req.user;
  payload.company_id = company_id;
  payload.created_by = user_id;
  payload.updated_by = user_id;
  delete payload.merchant_order_id;
    if (!payload) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
     await createCheckUtrService(payload);
    console.log('Check Utr successfully');
    return sendSuccess(res, {}, 'Check Utr successfully');
};

const updateCheckUtr = async (req, res) => {
    const payload = req.body;
    const { id } = req.params;
    await updateCheckUtrService(id, payload);
    return sendSuccess(res,{}, 'Update CheckUtr successfully');
};

const deleteCheckUtr = async (req, res) => {
    const { id } = req.params;
    if (!id) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
     await deleteCheckUtrService(id);
    console.log('getUsers successfully');
    return sendSuccess(res,{}, 'Delete CheckUtr successfully');
};

export { getCheckUtr, createCheckUtr, updateCheckUtr, deleteCheckUtr };
