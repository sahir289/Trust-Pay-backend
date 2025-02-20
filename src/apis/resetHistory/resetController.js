import { BadRequestError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createResetHistoryService, deleteResetHistoryService, getResetHistoryService, updateResetHistoryService } from './ResetHistoryServices.js';



const getResetHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await getResetHistoryService(id);

    return sendSuccess(res, data, 'getUsers successfully');
  } catch (error) {
    console.error('error getting while logging in', error);
  }
};
const createResetHistory = async (req, res) => {
  try {
    const payload = req.body;
    if (!payload) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    const data = await createResetHistoryService(payload);
    console.log('getUsers successfully');
    return sendSuccess(res, data, 'getUsers successfully');
  } catch (error) {
    console.error('error getting while logging in', error);
  }
}

const updateResetHistory = async (req, res) => {
  try {
    const payload = req.body;
    const { id } = req.params;
    const data = await updateResetHistoryService(id, payload);
    return sendSuccess(res, data, 'getUsers successfully');
  } catch (error) {
    console.error('error getting while logging in', error);
  }
}


const deleteResetHistory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    const data = await deleteResetHistoryService(id);
    console.log('getUsers successfully');
    return sendSuccess(res, data, 'getUsers successfully');
  } catch (error) {
    console.error('error getting while logging in', error);
  }
}
export { getResetHistory, createResetHistory, updateResetHistory, deleteResetHistory };
