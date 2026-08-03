import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  getCalculationService,
  createCalculationService,
  updateCalculationService,
  deleteCalculationService,
  calculateSuccessRatiosService,
  updateCalculationsService,
  CalculationUserService,
} from './calculationService.js';
import {
  VALIDATE_CALCULATION_SCHEMA,
  VALIDATE_UPDATE_CALCULATION_STATUS,
  VALIDATE_UPDATE_CALCULATIONS_SCHEMA,
  VALIDATE_UPDATE_USER_CALCULATION_SCHEMA,
} from '../../schemas/calculationSchema.js';
import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
import { logger } from '../../utils/logger.js';
import config from '../../config/config.js';
import { generateCacheKey } from '../../utils/redishashkey.js';
import {
  normalizeQueryForCache,
  readJsonCache,
  shouldServeCachedResponse,
  writeJsonCache,
  invalidateCompanyCacheByPrefix,
} from '../../utils/controllerCache.js';

const { controllerCacheTtls } = config;

const invalidateCalculationCache = async (companyId) =>
  invalidateCompanyCacheByPrefix(
    companyId,
    'calculation:read:',
    'Calculation cache',
  );

const getCalculationById = async (req, res) => {
  // Validate request parameters using Joi schema
  // const { role } = req.user;

  if (!req.params) {
    throw new BadRequestError('User_id Required');
  }
  const { user_id } = req.params;
  const { company_id, role } = req.user;
  const cacheKey = `calculation:read:${company_id}:by-user:${generateCacheKey(
    {
      company_id,
      user_id,
      role,
    },
    'calculation-by-id',
  )}`;

  const cached = await readJsonCache(cacheKey, 'Calculation by id cache');
  if (shouldServeCachedResponse(cached, req.query)) {
    return sendSuccess(res, cached, 'Get Calculation successfully');
  }

  const data = await getCalculationService(
    {
      user_id,
      company_id,
    },
    role,
  );
  await writeJsonCache(cacheKey, data, controllerCacheTtls.calculation.byId);
  // Respond with the calculation data
  return sendSuccess(res, data, 'Get Calculation successfully');
};

const getCalculation = async (req, res) => {
  // You can add additional validation here if needed, depending on the request
  const { company_id, user_id, designation, role } = req.user;
  const normalizedQuery = normalizeQueryForCache(req.body || req.query);
  const cacheKey = `calculation:read:${company_id}:list:${generateCacheKey(
    {
      company_id,
      user_id,
      designation,
      role,
      query: normalizedQuery,
    },
    'calculation-list',
  )}`;

  const cached = await readJsonCache(cacheKey, 'Calculation list cache');
  if (shouldServeCachedResponse(cached, req.body || req.query)) {
    return sendSuccess(res, cached, 'Get Calculations successfully');
  }

  const data = await getCalculationService(
    {
      company_id,
      user_id,
      designation,
      users: req.body.users,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
    },
    role,
  );

  await writeJsonCache(cacheKey, data, controllerCacheTtls.calculation.list);
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
    logger.error('payload is required');
    throw new BadRequestError('payload is required');
  }
  await createCalculationService(payload, role);
  await invalidateCalculationCache(company_id);
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
  await updateCalculationService(ids, payload, role);
  await invalidateCalculationCache(company_id);
  return sendSuccess(res, {}, 'Update Calculation successfully');
};

export const CalculationUserController = async (req, res) => {
  const payload = req.body;
  const { company_id } = req.user;
  const { user_id } = req.params

  const { error } = VALIDATE_UPDATE_USER_CALCULATION_SCHEMA.validate(req.body);
  if (error) {
    throw new ValidationError(error);
  }
  try {
    const result = await CalculationUserService(payload, user_id, company_id);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
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
  await deleteCalculationService(ids, role);
  await invalidateCalculationCache(company_id);
  return sendSuccess(res, {}, 'Delete Calculation successfully');
};

export const calculateSuccessRatios = async (req, res) => {
  try {
    const { date, user_ids } = req.body;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      throw new BadRequestError('user_ids array is required');
    }

    const data = await calculateSuccessRatiosService(date, user_ids);
    return sendSuccess(res, data, 'Success ratios fetched successfully');
  } catch (error) {
    logger.error('Error fetching success ratio data:', error);
    throw error;
  }
};

const updateCalculations = async (req, res) => {
  try {
    const { company_id } = req.user;

    // Validate request body
    const { error } = VALIDATE_UPDATE_CALCULATIONS_SCHEMA.validate(req.body);
    if (error) {
      throw new ValidationError(error);
    }

    const { date, user_id, startDate, endDate } = req.body;

    if (!user_id || typeof user_id !== 'string') {
      throw new BadRequestError('user_id string is required');
    }

    // If no specific date is provided, use current date
    const targetDate = date || new Date().toISOString().split('T')[0];

    logger.info(
      `Updating calculations for date: ${targetDate}, user_id: ${user_id}`,
    );

    const data = await updateCalculationsService(
      {
        date: targetDate,
        user_id,
        startDate,
        endDate,
        company_id,
      },
    );

    await invalidateCalculationCache(company_id);

    return sendSuccess(res, data, 'Calculations updated successfully');
  } catch (error) {
    logger.error('Error updating calculations:', error);
    throw error;
  }
};

export {
  getCalculationById,
  getCalculation,
  createCalculation,
  updateCalculation,
  updateCalculations,
  deleteCalculation,
};
