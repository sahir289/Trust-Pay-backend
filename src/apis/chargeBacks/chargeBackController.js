import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  createChargeBackService,
  getChargeBacksService,
  updateChargeBackService,
  deleteChargeBackService,
} from './chargeBackService.js';
import {
  VALIDATE_CHARGEBACK_BY_ID,
  VALIDATE_CHARGEBACK_SCHEMA,
  VALIDATE_DELETE_CHARGEBACK,
  VALIDATE_UPDATE_CHARGEBACK_SCHEMA,
} from '../../schemas/chargeBackSchema.js';
import { ValidationError } from '../../utils/appErrors.js';
import { getPayinDetailsByMerchantOrderId } from '../payIn/payInDao.js';
import { NotFoundError } from '../../utils/appErrors.js';
import { getChargeBackDao } from './chargeBackDao.js';
const createChargeBack = async (req, res) => {
  let payload = req.body;
  delete payload.date;
  const { error } = VALIDATE_CHARGEBACK_SCHEMA.validate(req.body);
  if (error) {
    throw new ValidationError(error);
  }
  const PayinDetails = await getPayinDetailsByMerchantOrderId(
        payload.merchant_order_id,
      );
 
     if (PayinDetails.length == 0) {
        throw new NotFoundError('Invalid Order_Id');
      }
      const isAlreadyExit = await getChargeBackDao({
        payin_id: PayinDetails[0].payin_id,
      });
      if (isAlreadyExit.length > 0) {
        throw new NotFoundError('ChargeBack already exist');
      }
const { company_id, role, user_id } = req.user;
  // Call the service to create the ChargeBack
const result = await createChargeBackService(payload,PayinDetails, role,company_id,user_id);
console.log('ChargeBack created successfully', 'info', result);
return sendSuccess(res, {}, 'ChargeBack created successfully');
};

const getChargeBacksById = async (req, res) => {
  const { error } = VALIDATE_CHARGEBACK_BY_ID.validate(req.params);
  if (error) {
    throw new ValidationError(error);
  }
  const { id } = req.params;
  const { company_id, role } = req.user;
  const result = await getChargeBacksService(
    { id: id, company_id: company_id },
    role,
  );

  console.log('ChargeBack created successfully', 'info', result);
  return sendSuccess(res, result, 'ChargeBack created successfully');
};

const getChargeBacks = async (req, res) => {
  const { company_id, role } = req.user;
  const {page, limit} = req.query;
  // const search = req.query.search;
  // Fetch vendors data from the service
  const data = await getChargeBacksService(
    {
      company_id: company_id,
      // TODO: search
    },
    role,page,limit,
  );
  // Log success message
  // Send success response
  return sendSuccess(res, data, 'ChargeBacks fetched successfully');
};

const updateChargeBack = async (req, res) => {
  const { error: paramsError } = VALIDATE_DELETE_CHARGEBACK.validate(
    req.params,
  );
  if (paramsError) {
    throw new ValidationError(paramsError);
  }
  // Validate body (fields for update)
  const { error: bodyError } = VALIDATE_UPDATE_CHARGEBACK_SCHEMA.validate(
    req.body,
  );
  if (bodyError) {
    throw new ValidationError(bodyError);
  }
  const payload = req.body;
  const { id } = req.params;
  const { company_id, role, user_id } = req.user;
  // Call the service to update the ChargeBack
  payload.updated_by = user_id;
  const result = await updateChargeBackService(
    { id, company_id },
    payload,
    role,
  );
  // Log success message
  console.log('ChargeBack updated successfully', result);
  // Send a success response to the client
  return sendSuccess(res, {}, 'ChargeBack updated successfully');
};

const deleteChargeBack = async (req, res) => {
  const { error } = VALIDATE_DELETE_CHARGEBACK.validate(req.params);
  if (error) {
    throw new ValidationError(error);
  }
  const { id } = req.params; // Assuming the ChargeBack ID is passed as a parameter
  const { company_id, role, user_id } = req.user;
  // Call the service to delete the ChargeBack
  const result = await deleteChargeBackService(
    { id, company_id },
    { updated_by: user_id, is_obsolete: true },
    role,
  );
  // Log success message
  console.log('ChargeBack deleted successfully', result);
  // Send a success response to the client
  return sendSuccess(res, {}, 'ChargeBack deleted successfully');
};

export {
  createChargeBack,
  getChargeBacksById,
  getChargeBacks,
  updateChargeBack,
  deleteChargeBack,
};
