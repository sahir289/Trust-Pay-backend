import {
  getPayInReportService,
  getPayOutReportService,
  getClientsAccountReportService,
} from '../../reports/reportsService.js';
import { sendV2Success } from '../../../utils/responseHandlers.js';

/**
 * v2 twins of the v1 reports endpoints. Each reuses the exact same service as
 * v1 (services read directly from `req`); only the response envelope differs
 * (sendV2Success). Thrown errors are converted by the v2ErrorHandler. The
 * `isAuthenticated` middleware (reused from v1) already forwards auth errors via
 * next(), so those are returned as v2 envelopes too.
 */
export const getPayInReportV2 = async (req, res) => {
  const result = await getPayInReportService(req);
  return sendV2Success(res, result, 'Got Pay-In report');
};

export const getPayOutReportV2 = async (req, res) => {
  const result = await getPayOutReportService(req);
  return sendV2Success(res, result, 'Got Pay-Out report');
};

export const getClientsAccountReportV2 = async (req, res) => {
  const result = await getClientsAccountReportService(req);
  return sendV2Success(res, result, 'Reports fetched successfully');
};
