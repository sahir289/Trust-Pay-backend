import express from 'express';
import { auditLogMiddleware } from '../../middlewares/auditLog.js';
import { globalRateLimitMiddleware } from '../../middlewares/rateLimiter.js';
import { sendV2Success } from '../../utils/responseHandlers.js';
import { getVersionString } from '../../../version.js';
import v2ErrorHandler from '../../middlewares/v2ErrorHandler.js';
import payInV2 from './payIn/index.js';
import walletBalanceV2 from './walletBalance/index.js';
import reportsV2 from './reports/index.js';
import dashboardReportV2 from './dashboardReport/index.js';
import authV2 from './auth/index.js';
import payOutV2 from './payOut/index.js';
import BankResponseV2 from './bankResponse/index.js';

/**
 * API v2 router.
 *
 * Mounted at `/v2` alongside the existing `/v1` router, which is left fully
 * untouched for backward compatibility. v2 is the foundation for the
 * progressive migration:
 *   - every v2 endpoint emits a structured audit event (auditLogMiddleware)
 *   - every v2 endpoint shares the global rate limiter
 *   - every v2 endpoint returns the standardized v2 envelope (sendV2Success /
 *     sendV2Error from utils/responseHandlers.js)
 *
 * Controllers are migrated into v2 incrementally. As each module is hardened
 * (standardized responses, idempotency, signatures), mount it below.
 */
const v2Router = express.Router();

// Audit every v2 request (records actor, action, resource, outcome, latency).
v2Router.use(auditLogMiddleware);

// Share the same global rate limiter used by v1.
v2Router.use(globalRateLimitMiddleware);

// Liveness + version, exposed through the standardized v2 envelope so clients
// can validate the v2 contract shape.
v2Router.get('/version', (req, res) =>
  sendV2Success(res, { version: getVersionString(), apiVersion: 'v2' }, 'OK'),
);

v2Router.get('/health', (req, res) =>
  sendV2Success(
    res,
    { status: 'ok', uptimeSeconds: Math.round(process.uptime()) },
    'OK',
  ),
);

// --------------------------------------------------------------------------
// Progressive migration mount points — add v2 controllers here as they are
// hardened. Example:
//   import payInV2 from './payIn/index.js';
//   v2Router.use('/payIn', payInV2);
// --------------------------------------------------------------------------

// payIn — Phase 1 (standardized v2 envelope). First migrated route:
//   POST /v2/payIn/check-payin-status (read-only status check).
v2Router.use('/payIn', payInV2);
v2Router.use('/bankResponse', BankResponseV2);

// Read-only route groups migrated to the v2 envelope (Phase 1).
v2Router.use('/walletBalance', walletBalanceV2);
v2Router.use('/reports', reportsV2);
v2Router.use('/dashboardReport', dashboardReportV2);

// auth — reuses the v1 auth controllers verbatim (same cookies / brute-force /
// 2FA orchestration); only the success envelope is adapted to v2.
v2Router.use('/auth', authV2);

// payOut — first MUTATING merchant twin (Phase 2). Guarded by
// checkMerchantApiKeyV2 -> verifyRequestSignature() -> idempotency({required}).
// Reuses the v1 createPayoutService; the signature/idempotency protections are
// default-OFF and activate only when their feature flags are enabled.
v2Router.use('/payOut', payOutV2);

// v2 error handler — MUST be last so it catches errors from every v2 route and
// returns the standardized v2 error envelope (instead of the v1 global handler).
v2Router.use(v2ErrorHandler);

export default v2Router;
