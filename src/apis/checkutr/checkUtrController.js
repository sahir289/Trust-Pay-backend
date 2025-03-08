import { BadRequestError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createCheckUtrService, deleteCheckUtrService, getCheckUtrService, updateCheckUtrService } from './checkUtrServices.js';


const getCheckUtr = async (req, res) => {
  try {
    const { company_id } = req.user;
    const data = await getCheckUtrService({company_id, ...req.query});
    return sendSuccess(res, data, 'getUsers successfully');
  } catch (error) {
    console.error('error getting while check utr', error);
  }
};
const createCheckUtr = async (req, res) => {
  try {
    const payload = req.body;
    if (!payload) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    const data = await createCheckUtrService(payload);
    console.log('getUsers successfully');
    return sendSuccess(res, data, 'getUsers successfully');
  } catch (error) {
    console.error('error getting while check utr', error);
  }
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
