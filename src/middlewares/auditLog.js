import { logger } from '../utils/logger.js';

/**
 * Structured audit logging middleware.
 *
 * Emits one structured `[AUDIT]` event per request *after* the response has
 * been sent, capturing who did what, against which resource, and the outcome.
 * It is intentionally side-effect free on the request path (it only attaches a
 * `finish` listener) so it cannot add latency or break a request.
 *
 * Designed to be mounted on the `/v2` router first (progressive rollout); it
 * can later be promoted to a global middleware once log volume/storage is
 * sized for the full request surface.
 *
 * Actor identity is read from the request objects populated by the existing
 * auth middlewares:
 *   - `req.user`     (JWT payload: user_id, user_name, role, company_id, ...)
 *   - `req.merchant` (merchant record resolved from x-api-key)
 *
 * Request/response bodies are deliberately NOT logged here to avoid leaking
 * credentials, OTPs, card/bank data, or large payloads. Only route params
 * (typically resource ids) are captured for non-GET requests, and never for
 * sensitive auth paths.
 */

// Path fragments whose route params must never be captured.
const SENSITIVE_PATH_HINTS = [
  '/auth',
  '/2fa',
  '/password',
  '/login',
  '/otp',
  '/reset',
];

const isSensitivePath = (path) => {
  const lower = String(path || '').toLowerCase();
  return SENSITIVE_PATH_HINTS.some((hint) => lower.includes(hint));
};

const extractActor = (req) => ({
  userId: req.user?.user_id || null,
  userName: req.user?.user_name || null,
  role: req.user?.role || null,
  companyId: req.user?.company_id || null,
  sessionId: req.user?.session_id || req.sessionId || null,
  merchantCode: req.merchant?.code || req.merchant?.id || null,
});

const auditLogMiddleware = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    try {
      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const path = req.originalUrl || req.url;
      const statusCode = res.statusCode;

      const auditEvent = {
        type: 'audit',
        apiVersion: 'v2',
        requestId: req.identifier || null,
        method: req.method,
        path,
        statusCode,
        outcome: statusCode < 400 ? 'success' : 'failure',
        durationMs: Math.round(durationMs * 100) / 100,
        ip:
          req.headers['x-forwarded-for'] ||
          req.ip ||
          req.connection?.remoteAddress ||
          null,
        userAgent: req.headers['user-agent'] || null,
        actor: extractActor(req),
        timestamp: new Date().toISOString(),
      };

      // Route params (resource ids) only for non-GET, non-sensitive routes.
      if (
        req.method !== 'GET' &&
        !isSensitivePath(path) &&
        req.params &&
        Object.keys(req.params).length > 0
      ) {
        auditEvent.params = req.params;
      }

      logger.info('[AUDIT]', auditEvent);
    } catch (error) {
      // Audit logging must never break the response cycle.
      logger.error('Audit log middleware failed', error);
    }
  });

  next();
};

export { auditLogMiddleware };
