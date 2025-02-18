import { BadRequestError } from '../../utils/appErrors.js';
import { transactionWrapper } from '../../utils/db.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getDesignationService, createDesignationService, updateDesignationService, deleteDesignationService } from './designationServices.js';

const getDesignation = async (req, res) => {
  try {
    const payload = req.query.search;
    const data = await getDesignationService(payload);
    console.log('get Designations  successfully');
    return sendSuccess(res, data, 'get  Designations successfully');
  } catch (error) {
    console.error('error getting while getting designations', error);
  }
};

const createDesignation = async (req, res) => {
  try {
    const payload = req.body;
    if (!payload) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    const data = await createDesignationService(payload);
    console.log('get Designations successfully');
    return sendSuccess(res, data, 'get Designations successfully');
  } catch (error) {
    console.error('error getting while creating designations', error);
  }
};

const updateDesignation = async (req, res) => {
  try {
    const payload = req.body;
    const { id } = req.params;
    const data = await updateDesignationService(id, payload);
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

export { getDesignation, createDesignation, updateDesignation, deleteDesignation };
