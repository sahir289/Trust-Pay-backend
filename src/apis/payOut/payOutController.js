import { transactionWrapper } from '../../utils/db.js';
import { sendError, sendSuccess } from '../../utils/responseHandlers.js';
import {
  createPayoutService,
  deletePayoutService,
  getPayoutsService,
  updatePayoutService,
} from './payOutService.js';
import {
  PAYOUT_DETAILS_SCHEMA,
  UPDATE_DETAILS_SCHEMA,
  VALIDATE_PAYOUT_BY_ID,
} from '../../schemas/payoutSchema.js';
import { ValidationError } from '../../utils/appErrors.js';

const createPayout = async (req, res) => {
    const joiValidation = PAYOUT_DETAILS_SCHEMA.validate(req.body);
    if (joiValidation.error) {
      throw new ValidationError(joiValidation.error);
    }
    let payload = req.body;
    const { company_id, role, user_id } = req.user;
    payload.company_id = company_id;
    payload.created_by = user_id;
    payload.updated_by = user_id;
    // Call the service to create the Payout
    await transactionWrapper(createPayoutService)(req.headers, payload, role);
    // Log success message
    console.log('Payout created successfully');
    // Send a success response to the client
    return sendSuccess(res,{} ,'Payout created successfully');
  }

const getPayoutsById = async (req, res) => {
    const joiValidation = VALIDATE_PAYOUT_BY_ID.validate(req.params);
    if (joiValidation.error) {
      throw new ValidationError(joiValidation.error);
    }
    const { id } = req.params;
    const { company_id, role } = req.user;
    // Fetch vendors data from the service
    const data = await getPayoutsService({ id, company_id }, role);
    // Log success message
    console.log('getPayouts successfully', data);
    // Send success response
    return sendSuccess(res, data, 'Payouts fetched successfully');
  } 

const getPayouts = async (req, res) => {
    const payload = {
      page: parseInt(req.query.page, 10) || 1, // Default to page 1 if not provided
      limit: parseInt(req.query.limit) || null,
    };
    const { company_id } = req.user;
    payload.company_id = company_id;
    const data = await getPayoutsService(payload);
    console.log('getPayins successfully', data);
    return sendSuccess(res, data, 'Payouts fetched successfully');
  } 

const updatePayout = async (req, res) => {
    const payload = req.body;
    const joiValidation = UPDATE_DETAILS_SCHEMA.validate(payload);
    if (joiValidation.error) {
      throw new ValidationError(joiValidation.error);
    }
    const Validation = VALIDATE_PAYOUT_BY_ID.validate(req.params);
    if (Validation.error) {
      throw new ValidationError(Validation.error);
    }
    const { id } = req.params;
    const { company_id, role, user_id } = req.user;
    payload.updated_by = user_id;
    const ids = { id, company_id };
    await transactionWrapper(updatePayoutService)(ids, payload, role);
    console.log('Payout updated successfully');
    return sendSuccess(res,{} , 'Payout updated successfully');
  } 

const deletePayout = async (req, res) => {
    const joiValidation = VALIDATE_PAYOUT_BY_ID.validate(req.params);
    if (joiValidation.error) {
      throw new ValidationError(joiValidation.error);
    }
    const { id } = req.params; // Assuming the Payout ID is passed as a parameter
    const { company_id, user_id, role } = req.user;
    const updated_by = user_id;
    const ids = { id, company_id };
    // Call the service to delete the Payout
    await deletePayoutService(ids, updated_by, role);
    // Log success message
    console.log('Payout deleted successfully');

    // Send a success response to the client
    return sendSuccess(res,{}, 'Payout deleted successfully');
  } 

export { createPayout, getPayouts, updatePayout, deletePayout, getPayoutsById };
