import crypto from 'node:crypto';
import config from '../config/config.js';
import { logger } from '../utils/logger.js';
import { sendError } from '../utils/responseHandlers.js';
import { V2_ERROR_CODES } from '../constants/index.js';

// ---------------------------------------------------------------------------
// Edge guard — proves a request actually transited the trusted edge (nginx).
// ---------------------------------------------------------------------------
// IP whitelisting answers "which client is allowed"; it does NOT prove the
// request reached us THROUGH nginx. nginx injects a secret header that clients
// cannot supply (nginx overwrites any client-sent copy). Any request missing or
// carrying a wrong secret did not come through the edge (e.g. a local script or
// a neighbour hitting the app port directly) and is rejected.
//
// The check is a single in-memory constant-time compare per request (zero I/O),
// so it is safe at 10k+ rps.
//
// Modes (config.edgeGuard.mode):
//   off      -> disabled, passthrough (default in non-production)
//   monitor  -> log violations but DO NOT block (default in production; lets an
//               operator confirm nginx is injecting the header before enforcing)
//   enforce  -> reject violations with 403
//
// Enable enforcement only after: (1) EDGE_AUTH_SECRET is set on both nginx and
// the app, and (2) monitor logs show zero false positives.

const secretBuffer = Buffer.from(config.edgeGuard?.secret || '', 'utf8');
const headerName = config.edgeGuard?.headerName || 'x-edge-auth';
const exemptPaths = config.edgeGuard?.exemptPaths || [];

const isExempt = (reqPath) =>
  exemptPaths.some(
    (prefix) => reqPath === prefix || reqPath.startsWith(`${prefix}/`),
  );

// Constant-time comparison that never short-circuits on length. timingSafeEqual
// throws on unequal-length buffers, so compare a fixed-length HMAC of each side.
const secretMatches = (provided) => {
  if (secretBuffer.length === 0) return false;
  const key = secretBuffer;
  const a = crypto.createHmac('sha256', key).update(secretBuffer).digest();
  const b = crypto
    .createHmac('sha256', key)
    .update(Buffer.from(provided || '', 'utf8'))
    .digest();
  return crypto.timingSafeEqual(a, b);
};

const edgeGuard = (req, res, next) => {
  const mode = config.edgeGuard?.mode || 'off';
  if (mode === 'off') return next();

  if (isExempt(req.path)) return next();

  // Misconfiguration safety: if no secret is configured we cannot verify
  // anything. Fail OPEN (never block prod on a missing env) but warn loudly.
  if (secretBuffer.length === 0) {
    logger.warn('edgeGuard enabled but EDGE_AUTH_SECRET is not set; passing through', {
      mode,
    });
    return next();
  }

  const provided = req.headers[headerName];
  if (secretMatches(provided)) return next();

  const context = {
    reason: provided ? 'edge_token_mismatch' : 'edge_token_missing',
    mode,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    requestId: req.identifier || null,
  };

  if (mode === 'enforce') {
    logger.error('edgeGuard blocked non-edge request', context);
    return sendError(res, 'Forbidden', 403, V2_ERROR_CODES.FORBIDDEN);
  }

  // monitor mode: record but allow, so operators can validate before enforcing.
  logger.warn('edgeGuard would block non-edge request (monitor mode)', context);
  return next();
};

export { edgeGuard };
