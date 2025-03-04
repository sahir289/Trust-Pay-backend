import {
  CREATE_DESIGNATION_SCHEMA,
  UPDATE_DESIGNATION_SCHEMA,
  VALIDATE_DESIGNATION_BY_ID,
} from '../../schemas/designationSchema.js';
import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
import { transactionWrapper } from '../../utils/db.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  getDesignationService,
  createDesignationService,
  updateDesignationService,
  deleteDesignationService,
} from './designationServices.js';
const getDesignation = async (req, res) => {
  const { company_id } = req.user;
  const data = await getDesignationService({ company_id, ...req.query });
  console.log('get Designations  successfully');
  return sendSuccess(res, data, 'get  Designations successfully');
};
const getDesignationById = async (req, res) => {
  const joiValidation = VALIDATE_DESIGNATION_BY_ID.validate(req.params);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const { id } = req.params;
  const { company_id } = req.user;
  const data = await getDesignationService({ id, company_id });
  console.log('get Designation  successfully');
  return sendSuccess(res, data, 'get  Designation successfully');
};

const createDesignation = async (req, res) => {
  const joiValidation = CREATE_DESIGNATION_SCHEMA.validate(req.body);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  let payload = req.body;
  const { company_id, user_id } = req.user;
  payload.company_id = company_id;
  payload.created_by = user_id;
  payload.updated_by = user_id;
  await transactionWrapper(createDesignationService)(payload);
  console.log('Create Designations successfully');
  return sendSuccess(res, {}, 'Create Designations successfully');
};

const updateDesignation = async (req, res) => {
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
  const { company_id, user_id } = req.user;
  payload.updated_by = user_id;
  await updateDesignationService({ id, company_id }, payload);
  return sendSuccess(res,{}, 'update Designations successfully');
};
const deleteDesignation = async (req, res) => {
  const joiValidation = VALIDATE_DESIGNATION_BY_ID.validate(req.params);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const { id } = req.params;
  const { company_id, user_id } = req.user;
  const updated_by = user_id;
  if (!id) {
    console.error('payload is required');
    throw new BadRequestError('payload is required');
  }
   await deleteDesignationService({ id, company_id }, updated_by);
  console.log('delete Designations successfully');
  return sendSuccess(res, {}, 'delete Designations successfully');
};

export {
  getDesignationById,
  getDesignation,
  createDesignation,
  updateDesignation,
  deleteDesignation,
};
