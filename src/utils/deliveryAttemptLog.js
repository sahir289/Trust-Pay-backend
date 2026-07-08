import { executeQuery, buildInsertQuery } from './db.js';
import { logger } from './logger.js';

// Append-only audit trail of outbound delivery attempts. Default off so it adds
// zero DB load until explicitly enabled. Recording is best-effort and NEVER
// throws — it must not affect whether a delivery succeeds or is retried.
const DELIVERY_ATTEMPTS_LOG_ENABLED =
  String(process.env.DELIVERY_ATTEMPTS_LOG_ENABLED || '').toLowerCase() ===
  'true';

const MAX_ERROR_LENGTH = 1000;

export const DeliveryChannel = {
  MERCHANT_CALLBACK: 'merchant_callback',
  TELEGRAM_MESSAGE: 'telegram_message',
  TELEGRAM_OCR: 'telegram_ocr',
};

export const DeliveryOutcome = {
  SUCCESS: 'success',
  FAILURE: 'failure',
};

/**
 * Records a single delivery attempt into the DeliveryAttempt audit table.
 * Best-effort: gated behind DELIVERY_ATTEMPTS_LOG_ENABLED and fully swallows its
 * own errors so it can never break or delay the caller's delivery flow.
 */
export async function recordDeliveryAttempt({
  channel,
  reference = null,
  type = null,
  attempt = 0,
  outcome,
  statusCode = null,
  error = null,
  durationMs = null,
}) {
  if (!DELIVERY_ATTEMPTS_LOG_ENABLED) {
    return;
  }

  try {
    const [query, params] = buildInsertQuery('DeliveryAttempt', {
      channel,
      reference,
      type,
      attempt,
      outcome,
      status_code: statusCode,
      error: error ? String(error).slice(0, MAX_ERROR_LENGTH) : null,
      duration_ms: durationMs,
    });
    await executeQuery(query, params);
  } catch (err) {
    logger.error('[DeliveryAttempt] Failed to record attempt', {
      channel,
      outcome,
      error: err.message,
    });
  }
}
