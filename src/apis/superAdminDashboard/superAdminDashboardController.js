import {
  getSuperAdminOverviewService,
  getTransactionRevenueSummaryService,
} from './superAdminDashboardService.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { SUPER_ADMIN_DASHBOARD_SCHEMA } from '../../schemas/superAdminDashboardSchema.js';

/**
 * GET /superAdminDashboard/overview
 * Returns platform-wide entity counts for the super admin dashboard.
 */
export const getSuperAdminOverview = async (req, res) => {
  const result = await getSuperAdminOverviewService();
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
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message,
      data: null,
    });
  }

  const result = await getTransactionRevenueSummaryService(value);
  return sendSuccess(res, result, 'Transaction & revenue summary fetched successfully');
};
