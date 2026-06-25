import crypto from 'node:crypto';
import { executeQuery } from '../utils/db.js';
import { sendV2Error } from '../utils/responseHandlers.js';
import { logger } from '../utils/logger.js';
import { V2_ERROR_CODES } from '../constants/index.js';

// ---------------------------------------------------------------------------
// Idempotency middleware (default OFF)
// ---------------------------------------------------------------------------
// Lets merchant-facing MUTATING endpoints (payIn create / payOut create) be
// safely retried without double-charging / double-paying.
//
// Flow (only when IDEMPOTENCY_ENABLED='true' AND the caller sends an
// `Idempotency-Key` header):
//   1. Atomically claim (merchant_scope, idempotency_key) via a single
//      INSERT ... ON CONFLICT ... RETURNING *, (xmax = 0) AS inserted. This is
//      race-free and always hits the writer (primary), so concurrent retries
//      cannot both win the claim.
//   2. If WE claimed it (freshly inserted) -> let the request run and cache the
//      response on finish (2xx -> store & mark completed; non-2xx -> release the
//      claim so the operation can be retried).
//   3. If the row already existed:
//        - different request_hash -> 422 (key reused with a different payload)
//        - completed             -> replay the cached response (no re-execution)
//        - in_progress           -> 409 (a concurrent request still running)
//
// Safety: when the flag is off the middleware is a true no-op. If the
// idempotency store itself errors, we FAIL OPEN (log + proceed) so a degraded
// idempotency layer can never block live payments.
// ---------------------------------------------------------------------------

const TABLE = 'IdempotencyKey';
const HEADER = 'idempotency-key';

const isEnabled = () => process.env.IDEMPOTENCY_ENABLED === 'true';

// Deterministic stringify (sorted object keys, recursive) so that two logically
// equal payloads always produce the same hash regardless of key order.
const stableStringify = (value) => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value ?? null);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
};

const computeRequestHash = (method, path, payload) => {
  const canonical = `${String(method).toUpperCase()} ${path} ${stableStringify(
    payload ?? {},
  )}`;
  return crypto.createHash('sha256').update(canonical).digest('hex');
};

// The identity an idempotency key is scoped to. Prefer the authenticated
// merchant (set by the API-key middleware); fall back to the request-supplied
// code so keys still never collide across merchants.
const resolveMerchantScope = (req) =>
  String(
    req.merchant?.code ??
      req.merchant?.merchant_code ??
      req.merchant?.id ??
      req.body?.code ??
      req.query?.code ??
      req.headers?.code ??
      'anonymous',
  );

// Single atomic claim. `inserted` is true only when this call created the row.
const claimIdempotencyKey = ({ key, merchantScope, method, path, requestHash }) => {
  const query = `
    INSERT INTO "${TABLE}"
      ("idempotency_key", "merchant_scope", "method", "path", "request_hash", "status")
    VALUES ($1, $2, $3, $4, $5, 'in_progress')
    ON CONFLICT ("merchant_scope", "idempotency_key")
    DO UPDATE SET "idempotency_key" = "${TABLE}"."idempotency_key"
    RETURNING *, (xmax = 0) AS inserted
  `;
  return executeQuery(query, [key, merchantScope, method, path, requestHash]);
};

// 2xx -> cache the response & mark completed. Non-2xx -> release the claim so
// the caller may retry the operation. Never throws (fire-and-forget on finish).
const persistIdempotentResult = async (id, statusCode, body) => {
  if (statusCode >= 200 && statusCode < 300) {
    const query = `
      UPDATE "${TABLE}"
      SET "status" = 'completed',
          "response_status" = $2,
          "response_body" = $3,
          "completed_at" = now()
      WHERE "id" = $1
    `;
    await executeQuery(query, [id, statusCode, body ?? null]);
    return;
  }
  await executeQuery(`DELETE FROM "${TABLE}" WHERE "id" = $1`, [id]);
};

// Capture the JSON response body (our v2 endpoints always respond via res.json)
// and persist the idempotency outcome once the response has fully flushed.
const attachResponsePersistence = (res, id) => {
  let capturedBody;
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    capturedBody = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    persistIdempotentResult(id, res.statusCode, capturedBody).catch((error) =>
      logger.error('[idempotency] failed to persist result', error),
    );
  });
};

/**
 * Build the idempotency middleware.
 *
 * @param {object} [options]
 * @param {boolean} [options.required=false] When true (and the feature flag is
 *   on) a missing `Idempotency-Key` header is rejected with 400 instead of
 *   passing through.
 */
const idempotency = (options = {}) => {
  const required = options.required === true;

  return async (req, res, next) => {
    if (!isEnabled()) {
      return next();
    }

    const key = req.headers[HEADER];
    if (!key) {
      if (required) {
        return sendV2Error(
          res,
          'Idempotency-Key header is required',
          400,
          V2_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
        );
      }
      return next();
    }

    const merchantScope = resolveMerchantScope(req);
    const path = `${req.baseUrl || ''}${req.path || ''}`;
    const payload = (req.method === 'GET' ? req.query : req.body) ?? {};
    const requestHash = computeRequestHash(req.method, path, payload);

    let claim;
    try {
      claim = await claimIdempotencyKey({
        key,
        merchantScope,
        method: req.method,
        path,
        requestHash,
      });
    } catch (error) {
      // Fail open: a degraded idempotency store must never block payments.
      logger.error('[idempotency] claim failed; proceeding without idempotency', error);
      return next();
    }

    const row = claim.rows[0];

    if (row.inserted) {
      attachResponsePersistence(res, row.id);
      return next();
    }

    if (row.request_hash !== requestHash) {
      return sendV2Error(
        res,
        'Idempotency-Key was reused with a different request payload',
        422,
        V2_ERROR_CODES.IDEMPOTENCY_KEY_REUSED,
      );
    }

    if (row.status === 'completed') {
      res.setHeader('Idempotent-Replayed', 'true');
      return res.status(row.response_status || 200).json(row.response_body ?? {});
    }

    // status === 'in_progress' — a concurrent request with the same key.
    return sendV2Error(
      res,
      'A request with this Idempotency-Key is already being processed',
      409,
      V2_ERROR_CODES.IDEMPOTENCY_IN_PROGRESS,
    );
  };
};

export {
  idempotency,
  stableStringify,
  computeRequestHash,
  resolveMerchantScope,
};
