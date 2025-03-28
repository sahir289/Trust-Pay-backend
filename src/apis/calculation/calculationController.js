import { sendSuccess, sendError } from '../../utils/responseHandlers.js';
import {
  getCalculationService,
  createCalculationService,
  updateCalculationService,
  deleteCalculationService,
} from './calculationService.js';
import { transactionWrapper } from '../../utils/db.js';
import {
  VALIDATE_CALCULATION_SCHEMA,
  VALIDATE_UPDATE_CALCULATION_STATUS,
  
} from '../../schemas/calculationSchema.js';
import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
const getCalculationById = async (req, res) => {
  // Validate request parameters using Joi schema
  // const { role } = req.user;
  
  if (!req.params) {
    throw new BadRequestError("User_id Required");
  }
  const { user_id } = req.params;
  const { company_id, role } = req.user;
  const data = await getCalculationService(
    {
      user_id,
      company_id,
    },
    role,
  );
  console.info('Get Calculation successfully', 'info');
  // Respond with the calculation data
  return sendSuccess(res, data, 'Get Calculation successfully');
};
const getCalculation = async (req, res) => {

  // You can add additional validation here if needed, depending on the request
  const { company_id, user_id, designation, role } = req.user;
  const data = await getCalculationService(
    {
      company_id,
      user_id,
      designation,
      users: req.query.users,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
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
  if (!req.params) {
    throw new BadRequestError('id Required');
  }
  if (bodyError) {
    throw new ValidationError(bodyError);
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
 if (!req.params) {
   throw new BadRequestError('id Required');
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
