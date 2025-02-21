import { BadRequestError } from '../../utils/appErrors.js';
import { transactionWrapper } from '../../utils/db.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getDesignationService, createDesignationService, updateDesignationService, deleteDesignationService } from './designationServices.js';
import { sendError } from '../../utils/responseHandlers.js';
const getDesignation = async (req, res) => {
  try {
    const {company_id} = req.user;
    let payload = req.query.search || {};  
    payload.company_id=company_id;
    const data = await getDesignationService(payload);
    console.log('get Designations  successfully');
    return sendSuccess(res, data, 'get  Designations successfully');
  } catch (error) {
    console.error('error getting while getting designations', error);
  }
};
const getDesignationById = async (req, res) => {
  try {
    const { id } = req.params;
    const {company_id} = req.user;
    const data = await getDesignationService({id:id,company_id:company_id});
    console.log('get Designation  successfully');
    return sendSuccess(res, data, 'get  Designation successfully');
  } catch (error) {
    console.error('error getting while getting designation', error);
  }
};

const createDesignation = async (req, res) => {
  try {
    let payload = req.body;
      if (!payload) {
        console.error('payload is required');
        return sendError(res, 'payload is required', 'Validation Error');
      }
      const {company_id} = req.user;
      payload.company_id=company_id;
    const data = await transactionWrapper(createDesignationService)(payload);
    console.log('get Designations successfully');
    return sendSuccess(res, data, 'get Designations successfully');
  } catch (error) {
    console.error('error getting while creating designations', error);
  }
};

const updateDesignation = async (req, res) => {
  try {
    let { body, params } = req;
    const {company_id} = req.user;
    const data = await updateDesignationService(params.id,company_id, body);
    return sendSuccess(res, data, 'get Designations successfully');
  } catch (error) {
    console.error('error getting while updating designations', error);
  }
};

const deleteDesignation = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    const data = await deleteDesignationService(id);
    console.log('get Designations successfully');
    return sendSuccess(res, data, 'get Designations successfully');
  } catch (error) {
    console.error('error getting while deleting Designation', error);
  }
};

export { getDesignationById,getDesignation, createDesignation, updateDesignation, deleteDesignation };
