import {
  getSuperAdminOverviewService,
  getTransactionRevenueSummaryService,
  getPayinVolumeMonthlySummaryService,
  getPayinVolumeDailyGraphService,
  getTopBanksService,
} from './superAdminDashboardService.js';
import { sendError, sendSuccess } from '../../utils/responseHandlers.js';
import {
  SUPER_ADMIN_DASHBOARD_SCHEMA,
  SUPER_ADMIN_TOP_BANKS_SCHEMA,
} from '../../schemas/superAdminDashboardSchema.js';
import Joi from 'joi';

/**
 * GET /superAdminDashboard/overview
 * Returns platform-wide entity counts for the super admin dashboard.
 */
export const getSuperAdminOverview = async (req, res) => {
  const company_id = req.user?.company_id;
  if(!company_id) {
    return sendError(res, 400, 'Company ID is required');
  }
  const result = await getSuperAdminOverviewService({ company_id });
  return sendSuccess(res, result, 'Super admin overview fetched successfully');
};

/**
 * GET /superAdminDashboard/transaction-revenue-summary
 * Returns transaction volumes, commissions, success/failed rates, and status breakdown.
 * Query params: startDate, endDate (required)
 */
export const getTransactionRevenueSummary = async (req, res) => {
  const { error, value } = SUPER_ADMIN_DASHBOARD_SCHEMA.validate(req.query, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const message = error.details.map((d) => d.message).join('; ');
    return sendError(res, 400, message);
  }

  const company_id = req.user?.company_id;
    if(!company_id) {
    return sendError(res, 400, 'Company ID is required');
  }
  const result = await getTransactionRevenueSummaryService({ ...value, company_id });
  return sendSuccess(res, result, 'Transaction & revenue summary fetched successfully');
};

/**
 * GET /superAdminDashboard/payin-volume-monthly
 * Returns monthly payin transaction volume summary for the last N months.
 * Query params: months (optional, default 6)
 */
export const getPayinVolumeMonthlySummary = async (req, res) => {
  const schema = Joi.object({
    months: Joi.number().integer().min(1).max(24).default(6),
  });

  const { error, value } = schema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const message = error.details.map((d) => d.message).join('; ');
    return sendError(res, 400, message);
  }

  const company_id = req.user?.company_id;
  if (!company_id) {
    return sendError(res, 400, 'Company ID is required');
  }

  const result = await getPayinVolumeMonthlySummaryService({ ...value, company_id });
  return sendSuccess(res, result, 'Payin volume monthly summary fetched successfully');
};

/**
 * GET /superAdminDashboard/payin-volume-graph
 * Returns daily payin transaction volume for a specific month.
 * Query params: month (required, YYYY-MM format)
 */
export const getPayinVolumeDailyGraph = async (req, res) => {
  const schema = Joi.object({
    month: Joi.string()
      .pattern(/^\d{4}-\d{2}$/)
      .required()
      .messages({
        'string.pattern.base': 'month must be in YYYY-MM format',
        'any.required': 'month is required',
      }),
  });

  const { error, value } = schema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const message = error.details.map((d) => d.message).join('; ');
    return sendError(res, 400, message);
  }

  const company_id = req.user?.company_id;
  if (!company_id) {
    return sendError(res, 400, 'Company ID is required');
  }

  const result = await getPayinVolumeDailyGraphService({ ...value, company_id });
  return sendSuccess(res, result, 'Payin volume daily graph fetched successfully');
};

/**
 * GET /superAdminDashboard/top-banks
 * Returns top banks list ranked by volume or count with payin and payout transaction metrics.
 * Query params: startDate, endDate, limit, sortBy, sortOrder
 */
export const getTopBanks = async (req, res) => {
  const { error, value } = SUPER_ADMIN_TOP_BANKS_SCHEMA.validate(req.query, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const message = error.details.map((d) => d.message).join('; ');
    return sendError(res, 400, message);
  }

  const company_id = req.user?.company_id;
  if (!company_id) {
    return sendError(res, 400, 'Company ID is required');
  }

  const result = await getTopBanksService({ ...value, company_id });
  return sendSuccess(res, result, 'Top banks fetched successfully');
};

