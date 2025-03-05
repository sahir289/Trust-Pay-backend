import { sendSuccess, sendError } from '../../utils/responseHandlers.js';
import {
  getCalculationService,
  createCalculationService,
  updateCalculationService,
  deleteCalculationService,
} from './calculationService.js';
import { transactionWrapper } from '../../utils/db.js';
import {
  VALIDATE_CALCULATION_BY_USER_ID,
  VALIDATE_CALCULATION_SCHEMA,
  VALIDATE_UPDATE_CALCULATION_STATUS,
  VALIDATE_DELETE_CALCULATION,
} from '../../schemas/calculationSchema.js';
import { ValidationError } from '../../utils/appErrors.js';
const getCalculationById = async (req, res) => {
  // Validate request parameters using Joi schema
  // const { role } = req.user;
  const { error } = VALIDATE_CALCULATION_BY_USER_ID.validate(req.params);
  if (error) {
    throw new ValidationError(error);
  }
  const { id } = req.params;
  const { company_id, role } = req.user;
  const data = await getCalculationService(
    {
      id,
      company_id,
    },
    role,
  );
  console.info('Get Calculation successfully', 'info');
  // Respond with the calculation data
  return sendSuccess(res, data, 'Get Calculation successfully');
};
const getCalculation = async (req, res) => {
  const { role } = req.user;
  // You can add additional validation here if needed, depending on the request
  const { company_id } = req.user;
  const data = await getCalculationService(
    {
      company_id,
      ...req.query,
    },
    role,
  );
  console.info('Get Calculations successfully', 'info');
  return sendSuccess(res, data, 'Get Calculations successfully');
};

const createCalculation = async (req, res) => {
  const { role } = req.user;
  const { error } = VALIDATE_CALCULATION_SCHEMA.validate(req.body);
  if (error) {
    throw new ValidationError(error);
  }
  let payload = req.body;
  const { company_id } = req.user;
  // Validate the request body using Joi schema
  payload.company_id = company_id;
  if (!payload) {
    console.error('payload is required');
    return sendError(res, 'payload is required', 'Validation Error');
  }
  await transactionWrapper(createCalculationService)(payload, role);
  console.info('Create Calculation successfully', 'info');
  return sendSuccess(res, {}, 'Create Calculation successfully');
};

const updateCalculation = async (req, res) => {
  const { role } = req.user;
  // Validate the request body and params using Joi schema
  const { error: bodyError } = VALIDATE_UPDATE_CALCULATION_STATUS.validate(
    req.body,
  );
  const { error: paramsError } = VALIDATE_CALCULATION_BY_USER_ID.validate(
    req.params,
  );
  if (bodyError || paramsError) {
    throw new ValidationError(bodyError || paramsError);
  }
  const payload = req.body;
  const { id } = req.params;
  const { company_id } = req.user;
  const ids = { company_id, id };
  // Assuming the Payout ID is passed as a parameter
  // Call the service to update the Payout
  await transactionWrapper(updateCalculationService)(ids, payload, role);
  console.info('Update Calculation successfully', 'info');
  return sendSuccess(res, {}, 'Update Calculation successfully');
};

// const result = await transactionWrapper(updatePayoutService)(id, payload);
const deleteCalculation = async (req, res) => {
  const { role } = req.user;
  // Validate the request params using Joi schema
  const { error } = VALIDATE_DELETE_CALCULATION.validate(req.params);
  if (error) {
    throw new ValidationError(error);
  }
  const { company_id } = req.user;
  const { id } = req.params;
  const ids = { id, company_id };
  await transactionWrapper(deleteCalculationService)(ids, role);
  console.info('Delete Calculation successfully', 'info');
  return sendSuccess(res, {}, 'Delete Calculation successfully');
};
export {
  getCalculationById,
  getCalculation,
  createCalculation,
  updateCalculation,
  deleteCalculation,
};
