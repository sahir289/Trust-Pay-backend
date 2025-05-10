import { transactionWrapper } from '../../utils/db.js';
import { sendSuccess, sendNewSuccess } from '../../utils/responseHandlers.js';
import {
  createPayoutService,
  deletePayoutService,
  getPayoutsService,
  updatePayoutService,
  getPayoutsBySearchService,
  checkPayOutStatusService,
} from './payOutService.js';
import {
  PAYOUT_DETAILS_SCHEMA,
  UPDATE_DETAILS_SCHEMA,
  VALIDATE_CHECK_PAY_OUT_STATUS,
  VALIDATE_PAYOUT_BY_ID,
} from '../../schemas/payoutSchema.js';
import { ValidationError } from '../../utils/appErrors.js';
import { logger } from '../../utils/logger.js';
import { BadRequestError } from '../../utils/appErrors.js';

const createPayout = async (req, res) => {
  const joiValidation = PAYOUT_DETAILS_SCHEMA.validate(req.body);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const x_api_key = req.headers['x-api-key'];
  let payload = req.body;
  if (!payload.user_id && !payload.user) {
    throw new ValidationError('user_id is required');
  }
  payload.user = payload.user_id ? payload.user_id : payload.user;
  delete payload?.user_id;

  let result = {};
  if (req.user) {
    const { company_id, role, user_id } = req.user;
    payload.company_id = company_id;
    payload.created_by = user_id;
    payload.updated_by = user_id;
    payload.x_api_key = x_api_key;
    result = await transactionWrapper(createPayoutService)(
      req.headers,
      payload,
      role,
      res,
    );
  } else {
    payload.x_api_key = x_api_key;
    result = await transactionWrapper(createPayoutService)(
      req.headers,
      payload,
      null,
      res,
    );
  }
  // Log success message
  logger.log('Payout created successfully');

  const updateRes = {
    merchantOrderId: result.merchant_order_id,
    payoutId: result.id,
    amount: result.amount,
  };

  // Send a success response to the client
  return sendNewSuccess(res, updateRes, 'Payout created successfully', 201);
  //   return res.status(200).json({
  //     message: 'Payout created successfully',
  //     statusCode: 201,
  //     data: updateRes,
  //   });
  // };
}
const getPayoutsById = async (req, res) => {
  const joiValidation = VALIDATE_PAYOUT_BY_ID.validate(req.params);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const { id } = req.params;
  const { company_id, role } = req.user;
  const data = await getPayoutsService({ id, company_id }, role);
  logger.info('getting Payouts successfully');
  return sendSuccess(res, data, 'Payouts fetched successfully');
};

const getPayouts = async (req, res) => {
  const { company_id, role, user_id, designation } = req.user;
  const { page, limit } = req.query;
  delete req.query.limit;
  delete req.query.page;
  const data = await getPayoutsService(
    company_id,
    page,
    limit,
    req.query,
    role,
    user_id,
    designation,
  );
  return sendSuccess(res, data, 'Payouts fetched successfully');
};

const getPayoutsBySearch = async (req, res) => {
  const { company_id, role, user_id, designation } = req.user;
  const { search, page = 1, limit = 10 } = req.query;
  if (!search) {
    throw new BadRequestError('search is required');
  }
  const data = await getPayoutsBySearchService(
    {
      company_id,
      search,
      page,
      limit,
      ...req.query,
    },
    role,
    user_id,
    designation,
  );
  logger.log('get Payouts successfully');
  return sendSuccess(res, data, 'Payouts fetched successfully');
};

const updatePayout = async (req, res) => {
  const payload = req.body;
  const joiValidation = UPDATE_DETAILS_SCHEMA.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }

  const { id } = req.params;
  const { company_id, role, user_id } = req.user;
  payload.updated_by = user_id;
  const ids = { id, company_id };
  await transactionWrapper(updatePayoutService)(ids, payload, role);
  return sendSuccess(res, {}, 'Payout updated successfully');
};

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
  logger.log('Payout deleted successfully');

  // Send a success response to the client
  return sendSuccess(res, {}, 'Payout deleted successfully');
};

 const checkPayOutStatus = async (req, res) => {
  const joiValidation = VALIDATE_CHECK_PAY_OUT_STATUS.validate(req.body);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const api_key = req.headers['x-api-key'];
  const data = await checkPayOutStatusService(
    req.body.payoutId,
    req.body.merchantCode,
    req.body.merchantOrderId,
    api_key,
    res
  );
  // sendSuccess(res, data);
    return sendNewSuccess(res, data, 'PayOut status fetched successfully',200);
  // return res.status(200).json({
  //   message: 'PayOut status fetched successfully',
  //   statusCode: 200,
  //   data,
  // });
};

export {
  createPayout,
   getPayoutsBySearch,
  checkPayOutStatus,
  getPayouts,
  updatePayout,
  deletePayout,
  getPayoutsById,
};
