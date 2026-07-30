import crypto from 'node:crypto';
import { sendError } from '../utils/responseHandlers.js';
import { V2_ERROR_CODES } from '../constants/index.js';
import { generateSignature } from '../utils/signaturegenrate.js';
import config from '../config/config.js';

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
// CLOSED: anything that doesn't verify is rejected.
//
// Two enforcement modes:
//   - verifyRequestSignature({ required: true })  -> ALWAYS enforced. This is the
//       v2 merchant security baseline (create payIn/payOut, process-payin, wallet
//       balance, check-status). A missing/invalid signature is always rejected,
//       independent of the REQUEST_SIGNING_ENABLED flag.
//   - verifyRequestSignature()                    -> opt-in. Gated by the
//       REQUEST_SIGNING_ENABLED flag; a true no-op while the flag is off.
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
 * @param {boolean} [options.required] When true, the signature is ALWAYS enforced
 *   (independent of REQUEST_SIGNING_ENABLED) — the security baseline for the v2
 *   merchant endpoints. When false/omitted, enforcement is gated by the flag.
 * @param {number} [options.maxSkewMs] Override the replay window (ms).
 */
const verifyRequestSignature = (options = {}) => {
  const maxSkewMs = options.maxSkewMs || resolveMaxSkewMs();
  const required = options.required === true;

  return (req, res, next) => {
    // `required: true` endpoints enforce the signature unconditionally (the v2
    // merchant security baseline). Opt-in endpoints stay gated behind the
    // REQUEST_SIGNING_ENABLED flag and are a true no-op while it is off.
    if (!required && !isEnabled()) {
      return next();
    }

    const secret = req.merchant?.config?.keys?.private || req.vendor?.banks[0]?.secretKey || config?.paymentPage?.signingSecret;
    if (!secret) {
      // Either merchant-auth did not run or the merchant has no signing secret.
      return sendError(
        res,
        'Request signature is required but no signing secret is available',
        401,
        V2_ERROR_CODES.SIGNATURE_REQUIRED,
      );
    }

    const signature = req.headers['x-signature'];
    const timestamp = req.headers['x-timestamp'];
    if (!signature || !timestamp) {
      return sendError(
        res,
        'Missing x-signature or x-timestamp header',
        401,
        V2_ERROR_CODES.SIGNATURE_REQUIRED,
      );
    }

    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > maxSkewMs) {
      return sendError(
        res,
        'Request signature timestamp is invalid or expired',
        401,
        V2_ERROR_CODES.SIGNATURE_EXPIRED,
      );
    }

    const methodsWithBody = ['POST', 'PUT', 'PATCH'];

    const payload = methodsWithBody.includes(req.method)
      ? (req.rawBody || '')
      : '';

    const expected = generateSignature(secret, timestamp, payload);

    if (!safeEqualHex(expected, String(signature))) {
      return sendError(res, 'Invalid request signature', 401, V2_ERROR_CODES.INVALID_SIGNATURE);
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
