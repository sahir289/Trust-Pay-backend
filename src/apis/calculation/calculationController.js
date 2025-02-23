import { sendSuccess, sendError } from '../../utils/responseHandlers.js';
import {getCalculationService,createCalculationService,updateCalculationService,deleteCalculationService} from './calculationService.js';
import { transactionWrapper } from '../../utils/db.js';
import {VALIDATE_CALCULATION_BY_USER_ID,VALIDATE_CALCULATION_SCHEMA,VALIDATE_UPDATE_CALCULATION_STATUS,VALIDATE_DELETE_CALCULATION} from '../../schemas/calculationSchema.js';
import { ValidationError } from '../../utils/appErrors.js';

const getCalculationById = async (req, res) => {
  try {
    // Validate request parameters using Joi schema
    const { error } = VALIDATE_CALCULATION_BY_USER_ID.validate(req.params);
    if (error) {
      throw new ValidationError(error);
    }
    const { id } = req.params;
    const { user_id, role_id, company_id } = req.user;
    const ids = { user_id, role_id, company_id,id}
    // Fetch the calculation data by 'id'
    const payload=null;
    const data = await getCalculationService({
    ids,payload
    });
    console.info('Get Calculation successfully', 'info');
    // Respond with the calculation data
    return sendSuccess(res, data, 'Get Calculation successfully');
  } catch (error) {
    console.error('Error while getting Calculation', 'error', error);
    return sendError(res, 'Error occurred while fetching the calculation');
  }
};

const getCalculation = async (req, res) => {
  try {
    // You can add additional validation here if needed, depending on the request
    const { company_id, user_id, role_id } = req.user;
    const search = req.query.search;
    let payload = {
      company_id,
      user_id,
      role_id,
    };
    const data = await getCalculationService(search, payload);
    console.info('Get Calculations successfully', 'info');
    return sendSuccess(res, data, 'Get Calculations successfully');
  } catch (error) {
    console.error('Error getting calculations', 'error', error);
    return sendError(res, 'Error occurred while fetching calculations');
  }
};

const createCalculation = async (req, res) => {
  try {
    let payload = req.body;
    console.log(req.user);
    const { company_id, user_id, role_id } = req.user;
    payload.company_id = company_id;
    payload.user_id = user_id;
    payload.role_id = role_id;
    console.log(payload, 'jkdfhfk payloead fron payload');
    // Validate the request body using Joi schema
    const { error } = VALIDATE_CALCULATION_SCHEMA.validate(payload);
    if (error) {
      throw new ValidationError(error);
    }
    if (!payload) {
      console.error('payload is required');
      return sendError(res, 'payload is required', 'Validation Error');
    }
    const data = await createCalculationService(payload);
    console.info('Create Calculation successfully', 'info');
    return sendSuccess(res, data, 'Create Calculation successfully');
  } catch (error) {
    console.error('Error creating calculation', 'error', error);
    return sendError(res, 'Error occurred while creating calculation');
  }
};

const updateCalculation = async (req, res) => {
  try {
    // Validate the request body and params using Joi schema
    const { error: bodyError } = VALIDATE_UPDATE_CALCULATION_STATUS.validate(
      req.body,
    );
    const { error: paramsError } = VALIDATE_CALCULATION_BY_USER_ID.validate(
      req.params,
    );
    if (bodyError || paramsError) {
      return sendError(
        res,
        `Validation error: ${bodyError ? bodyError.details[0].message : paramsError.details[0].message}`,
      );
    }
    const payload = req.body;
    const { id } = req.params;
    const { user_id, role_id, company_id } = req.user;
    const ids = {user_id,role_id,company_id,id}
    // Assuming the Payout ID is passed as a parameter
    // Call the service to update the Payout
    const data = await transactionWrapper(updateCalculationService)(ids,payload);
    console.info('Update Calculation successfully', 'info');
    return sendSuccess(res, data, 'Update Calculation successfully');
  } catch (error) {
    console.error('Error updating calculation', 'error', error);
    return sendError(res, 'Error occurred while updating calculation');
  }
};

// const result = await transactionWrapper(updatePayoutService)(id, payload);
const deleteCalculation = async (req, res) => {
  try {
    // Validate the request params using Joi schema
    const { error } = VALIDATE_DELETE_CALCULATION.validate(req.params);
    if (error) {
      throw new ValidationError(error);
    }
    const { user_id, role_id, company_id } = req.user;
    const params = req.params;
    const data = await transactionWrapper(deleteCalculationService)(
      params.id,
      user_id,
      role_id,
      company_id,
    );
    console.info('Delete Calculation successfully', 'info');
    return sendSuccess(res, data, 'Delete Calculation successfully');
  } catch (error) {
    console.error('Error deleting calculation', 'error', error);
    return sendError(res, 'Error occurred while deleting calculation');
  }
};

export {getCalculationById,getCalculation,createCalculation,updateCalculation,deleteCalculation};
