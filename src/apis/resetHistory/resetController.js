import { BadRequestError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createResetHistoryService, deleteResetHistoryService, getResetHistoryService, updateResetHistoryService } from './resetServices.js';

const getResetHistory = async (req, res) => {
  try {
    const { company_id } = req.user;
    const data = await getResetHistoryService(company_id);
    return sendSuccess(res, data, 'reset history successfully');
  } catch (error) {
    console.error('error getting while fetching reports', error);
  }
};
const createResetHistory = async (req, res) => {
  try {
    const payload = req.body;
    const {user_id , company_id}= req.user;
    payload.created_by = user_id;
    payload.company_id = company_id;

    if (!payload) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    const data = await createResetHistoryService(payload);
    console.log('reset history successfully');
    return sendSuccess(res, data, 'reset history successfully');
  } catch (error) {
    console.error('error getting while fetching reports', error);
  }
};

const updateResetHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const {company_id} = req.user;
    const data = await updateResetHistoryService(id, company_id);
    return sendSuccess(res, data, 'reset history successfully');
  } catch (error) {
    console.error('error getting while fetching reports', error);
  }
};

const deleteResetHistory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    const data = await deleteResetHistoryService(id);
    console.log('reset history successfully');
    return sendSuccess(res, data, 'reset history successfully');
  } catch (error) {
    console.error('error getting while fetching reports', error);
  }
};


export {
  getResetHistory,
  createResetHistory,
  updateResetHistory,
  deleteResetHistory,
};
