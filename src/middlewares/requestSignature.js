import crypto from 'node:crypto';
import { sendV2Error } from '../utils/responseHandlers.js';
import { V2_ERROR_CODES } from '../constants/index.js';

// ---------------------------------------------------------------------------
// Request-signature verification middleware (default OFF)
// ---------------------------------------------------------------------------
// Verifies an HMAC-SHA256 signature on inbound merchant-facing requests so a
// tampered or replayed request is rejected before it reaches a controller.
//
// The signature is computed by the merchant over a canonical string using their
// per-merchant secret (`merchant.config.keys.private`). This middleware MUST run
// AFTER a merchant-auth middleware that attaches `req.merchant`.
//
// Canonical string (what the merchant signs):
//   `${timestamp}.${METHOD}.${pathname}.${sha256hex(payload)}`
//     - timestamp : epoch milliseconds, also sent as the `x-timestamp` header
//     - METHOD    : upper-cased HTTP method
//     - pathname  : request path WITHOUT the query string (exactly as requested)
//     - payload   : the raw query string for GET, else the raw request body bytes
//
// Headers:
//   x-signature : lowercase hex HMAC-SHA256 of the canonical string
//   x-timestamp : epoch milliseconds (used for the replay window)
//
// Unlike the idempotency layer (which fails OPEN because it depends on a DB),
// signature verification is pure CPU with no external dependency, so it FAILS
// CLOSED: when the flag is on, anything that doesn't verify is rejected.
// When the flag is off the middleware is a true no-op.
// ---------------------------------------------------------------------------

const DEFAULT_MAX_SKEW_MS = 5 * 60 * 1000; // 5 minutes

const isEnabled = () => process.env.REQUEST_SIGNING_ENABLED === 'true';

const resolveMaxSkewMs = () => {
  const raw = Number(process.env.REQUEST_SIGNING_MAX_SKEW_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_SKEW_MS;
};

const sha256Hex = (input) =>
  crypto.createHash('sha256').update(input ?? '', 'utf8').digest('hex');

// The canonical string the merchant signs. Exported for SDK parity / tests.
const buildSignaturePayload = ({ method, pathname, payload, timestamp }) =>
  `${timestamp}.${String(method).toUpperCase()}.${pathname}.${sha256Hex(payload)}`;

const computeSignature = (secret, canonical) =>
  crypto.createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');

// Constant-time hex compare (guards against timing side-channels and length).
const safeEqualHex = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

/**
 * Build the request-signature verification middleware.
 *
 * @param {object} [options]
 * @param {number} [options.maxSkewMs] Override the replay window (ms).
 */
const verifyRequestSignature = (options = {}) => {
  const maxSkewMs = options.maxSkewMs || resolveMaxSkewMs();

  return (req, res, next) => {
    if (!isEnabled()) {
      return next();
    }

    const secret = req.merchant?.config?.keys?.private;
    if (!secret) {
      // Either merchant-auth did not run or the merchant has no signing secret.
      return sendV2Error(
        res,
        'Request signature is required but no signing secret is available',
        401,
        V2_ERROR_CODES.SIGNATURE_REQUIRED,
      );
    }

    const signature = req.headers['x-signature'];
    const timestamp = req.headers['x-timestamp'];
    if (!signature || !timestamp) {
      return sendV2Error(
        res,
        'Missing x-signature or x-timestamp header',
        401,
        V2_ERROR_CODES.SIGNATURE_REQUIRED,
      );
    }

    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > maxSkewMs) {
      return sendV2Error(
        res,
        'Request signature timestamp is invalid or expired',
        401,
        V2_ERROR_CODES.SIGNATURE_EXPIRED,
      );
    }

    const [pathname, rawQuery = ''] = String(req.originalUrl || '').split('?');
    const payload = req.method === 'GET' ? rawQuery : req.rawBody || '';
    const canonical = buildSignaturePayload({
      method: req.method,
      pathname,
      payload,
      timestamp,
    });
    const expected = computeSignature(secret, canonical);

    if (!safeEqualHex(expected, String(signature))) {
      return sendV2Error(res, 'Invalid request signature', 401, V2_ERROR_CODES.INVALID_SIGNATURE);
    }

    return next();
  };
};

export {
  verifyRequestSignature,
  buildSignaturePayload,
  computeSignature,
  safeEqualHex,
  sha256Hex,
};
