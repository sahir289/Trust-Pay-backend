import { InternalServerError, BadRequestError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  createResetHistoryService,
  getResetHistoryBySearchService,
  deleteResetHistoryService,
  getResetHistoryService,
  updateResetHistoryService,
} from './resetServices.js';
const getResetHistory = async (req, res) => {
  try {
    const { company_id } = req.user;
    const {page, limit} = req.query;
    const data = await getResetHistoryService(company_id,  page,limit,);
    return sendSuccess(res, data, 'reset history successfully');
  } catch (error) {
    console.error('error getting while fetching reports', error);
  }
};
const getResetHistoryBySearch = async (req, res) => {
  const { company_id, role } = req.user;
  const { search, page = 1, limit = 10 } = req.query;
  console.log(search, 'searchhh');
  if (!search) {
    throw new BadRequestError('search is required');
  }
  const data = await getResetHistoryBySearchService(
    {
      company_id,
      search,
      page,
      limit,
      ...req.query,
    },
    role,
  );
  console.log('get reset history successfully');
  return sendSuccess(res, data, 'History fetched successfully');
};
const createResetHistory = async (req, res) => {
  try {
    const payload = req.body;
    const {user_id , company_id}= req.user;
    payload.created_by = user_id;
    payload.company_id = company_id;

    if (!payload) {
      console.error('payload is required');
      throw new InternalServerError('payload is required');
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
      throw new InternalServerError('payload is required');
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
  getResetHistoryBySearch,
  deleteResetHistory,
};
