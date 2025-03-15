import { BadRequestError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createCheckUtrService, deleteCheckUtrService, getCheckUtrService, updateCheckUtrService } from './checkUtrServices.js';
import { getPayinDetailsByMerchantOrderId } from '../payIn/payInDao.js';


const getCheckUtr = async (req, res) => {
  try {
    const { company_id } = req.user;
    const {page, limit} = req.query;
    const data = await getCheckUtrService({company_id, ...req.query},page,limit,);
    return sendSuccess(res, data, 'getUsers successfully');
  } catch (error) {
    console.error('error getting while check utr', error);
  }
};

const createCheckUtr = async (req, res) => {
  const payload = req.body;
  const payinData =await getPayinDetailsByMerchantOrderId(payload.merchant_order_id);
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
    const data = await createCheckUtrService(payload);
    console.log('get successfully');
    return sendSuccess(res, data, 'getUsers successfully');
};

const updateCheckUtr = async (req, res) => {
  try {
    const payload = req.body;
    const { id } = req.params;
    const data = await updateCheckUtrService(id, payload);
    return sendSuccess(res, data, 'getUsers successfully');
  } catch (error) {
    console.error('error getting while check utr', error);
  }
};

const deleteCheckUtr = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    const data = await deleteCheckUtrService(id);
    console.log('getUsers successfully');
    return sendSuccess(res, data, 'getUsers successfully');
  } catch (error) {
    console.error('error getting while check utr', error);
  }
};

export { getCheckUtr, createCheckUtr, updateCheckUtr, deleteCheckUtr };
