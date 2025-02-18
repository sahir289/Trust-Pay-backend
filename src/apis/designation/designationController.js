import { CREATE_DESIGNATION_SCHEMA, UPDATE_DESIGNATION_SCHEMA, VALIDATE_DESIGNATION_BY_ID } from '../../schemas/designationSchema.js';
import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getDesignationService, createDesignationService, updateDesignationService, deleteDesignationService } from './designationServices.js';

const getDesignation = async (req, res) => {
  try {
    const payload = req.query.search;
    
    const joiValidation = VALIDATE_DESIGNATION_BY_ID.validate(req.params);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }
    const data = await getDesignationService(payload);
    console.log('get Designations  successfully');
    return sendSuccess(res, data, 'get  Designations successfully');
  } catch (error) {
    console.error('error getting while getting designations', error);
  }
};
const getDesignationById = async (req, res) => {
  try {
    const {id}= req.params;
    const data = await getDesignationService({id:id});
    console.log('get Designation  successfully');
    return sendSuccess(res, data, 'get  Designation successfully');
  } catch (error) {
    console.error('error getting while getting designation', error);
  }
};

const createDesignation = async (req, res) => {
  try {
    const payload = req.body;
    const joiValidation = CREATE_DESIGNATION_SCHEMA.validate(req.body);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }
    if (!payload) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    const data = await transactionWrapper(createDesignationService)(payload);
    console.log('get Designations successfully');
    return sendSuccess(res, data, 'get Designations successfully');
  } catch (error) {
    console.error('error getting while creating designations', error);
  }
};

const updateDesignation = async (req, res) => {
  try {
    const payload = req.body;
    
    const joiValidation = VALIDATE_DESIGNATION_BY_ID.validate(req.params);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }
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

export { getDesignationById,getDesignation, createDesignation, updateDesignation, deleteDesignation };
