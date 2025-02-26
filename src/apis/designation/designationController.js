import { CREATE_DESIGNATION_SCHEMA, UPDATE_DESIGNATION_SCHEMA, VALIDATE_DESIGNATION_BY_ID } from '../../schemas/designationSchema.js';
import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
import { transactionWrapper } from '../../utils/db.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getDesignationService, createDesignationService, updateDesignationService, deleteDesignationService } from './designationServices.js';
const getDesignation = async (req, res) => {
  try {
    // const search = req.query.search;
    const { company_id, role_id } = req.user
    let user = {company_id, role_id };
    const data = await getDesignationService(user);
    console.log('get Designations  successfully');
    return sendSuccess(res, data, 'get  Designations successfully');
  } catch (error) {
    console.error('error getting while getting designations', error);
  }
};
const getDesignationById = async (req, res) => {
  try {
    const joiValidation = VALIDATE_DESIGNATION_BY_ID.validate(req.params);
    if (joiValidation.error) {
      throw new ValidationError(joiValidation.error);
    }
    const { id } = req.params;
    const { company_id, role_id } = req.user;
    const data = await getDesignationService({ id, company_id, role_id });
    console.log('get Designation  successfully');
    return sendSuccess(res, data, 'get  Designation successfully');
  } catch (error) {
    console.error('error getting while getting designation', error);
  }
};

const createDesignation = async (req, res) => {
  try {
    const joiValidation = CREATE_DESIGNATION_SCHEMA.validate(req.body);
    if (joiValidation.error) {
      throw new ValidationError(joiValidation.error);
    }
    let payload = req.body;
    const { company_id, role_id } = req.user;
    payload.company_id = company_id;
    payload.role_id = role_id
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
    const Validation = UPDATE_DESIGNATION_SCHEMA.validate(payload);
    if (Validation.error) {
      throw new ValidationError(Validation.error);
    }
    const { id } = req.params;
    const { company_id, role_id } = req.user;
    const data = await updateDesignationService(id, company_id, role_id, payload);
    return sendSuccess(res, data, 'update Designations successfully');
  } catch (error) {
    console.error('error getting while updating designations', error);
  }
};

const deleteDesignation = async (req, res) => {
  try {
    const joiValidation = VALIDATE_DESIGNATION_BY_ID.validate(req.params);
    if (joiValidation.error) {
      throw new ValidationError(joiValidation.error);
    }
    const { id } = req.params;
    const { company_id, role_id } = req.user;
    if (!id) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    const data = await deleteDesignationService(id, company_id, role_id);
    console.log('delete Designations successfully');
    return sendSuccess(res, data, 'delete Designations successfully');
  } catch (error) {
    console.error('error getting while deleting Designation', error);
  }
};

export { getDesignationById, getDesignation, createDesignation, updateDesignation, deleteDesignation };
