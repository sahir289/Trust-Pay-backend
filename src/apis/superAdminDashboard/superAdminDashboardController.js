import {
  getSuperAdminOverviewService,
  getTransactionRevenueSummaryService,
} from './superAdminDashboardService.js';
import { sendError, sendSuccess } from '../../utils/responseHandlers.js';
import { SUPER_ADMIN_DASHBOARD_SCHEMA } from '../../schemas/superAdminDashboardSchema.js';

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
