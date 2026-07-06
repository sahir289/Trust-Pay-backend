import {
  getPayInReportService,
  getPayOutReportService,
  getClientsAccountReportService,
} from '../../reports/reportsService.js';
import { sendSuccess } from '../../../utils/responseHandlers.js';
import {
  normalizeQueryForCache,
  readJsonCache,
  shouldServeCachedResponse,
  writeJsonCache,
} from '../../../utils/controllerCache.js';
import { generateCacheKey } from '../../../utils/redishashkey.js';
import config from '../../../config/config.js';

const { controllerCacheTtls } = config;


export const getPayInReportV2 = async (req, res) => {
  const { company_id, role } = req.user || {};
  const criteria = normalizeQueryForCache(req.query);
  const cacheKey = `reports:read:${company_id}:payin:${generateCacheKey(
    { company_id, role, criteria },
    'reports-payin',
  )}`;

  const cached = await readJsonCache(cacheKey, 'PayIn report cache');
  if (shouldServeCachedResponse(cached, req.query)) {
    return sendSuccess(res, cached, 'Got Pay-In report');
  }

  const result = await getPayInReportService(req);
  await writeJsonCache(cacheKey, result, controllerCacheTtls.reports.payin);
  return sendSuccess(res, result, 'Got Pay-In report');
};

export const getPayOutReportV2 = async (req, res) => {
  const { company_id, role } = req.user || {};
  const criteria = normalizeQueryForCache(req.query);
  const cacheKey = `reports:read:${company_id}:payout:${generateCacheKey(
    { company_id, role, criteria },
    'reports-payout',
  )}`;

  const cached = await readJsonCache(cacheKey, 'PayOut report cache');
  if (shouldServeCachedResponse(cached, req.query)) {
    return sendSuccess(res, cached, 'Got Pay-Out report');
  }

  const result = await getPayOutReportService(req);
  await writeJsonCache(cacheKey, result, controllerCacheTtls.reports.payout);
  return sendSuccess(res, result, 'Got Pay-Out report');
};

export const getClientsAccountReportV2 = async (req, res) => {
  const { company_id, role } = req.user || {};

  const criteria = normalizeQueryForCache(req.body || {});
  const cacheKey = `reports:read:${company_id}:accounts:${generateCacheKey(
    { company_id, role, criteria },
    'reports-accounts',
  )}`;

  const cached = await readJsonCache(cacheKey, 'Accounts report cache');
  if (shouldServeCachedResponse(cached, criteria)) {
    return sendSuccess(res, cached, 'Reports fetched successfully');
  }

  const result = await getClientsAccountReportService(req);
  await writeJsonCache(cacheKey, result, controllerCacheTtls.reports.accounts);
  return sendSuccess(res, result, 'Reports fetched successfully');
};

