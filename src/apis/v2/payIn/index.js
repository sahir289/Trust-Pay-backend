import express from 'express';
import tryCatchHandler from '../../../utils/tryCatchHandler.js';
import dbConnScope from '../../../middlewares/dbConnScope.js';
import { checkAuthCode } from '../../../middlewares/checkAuthCode.js';
import { verifyRequestSignature } from '../../../middlewares/requestSignature.js';
import { idempotency } from '../../../middlewares/idempotency.js';
import { merchantApiRateLimiter } from '../../../middlewares/rateLimiter.js';
import { adaptResponseToV2 } from '../../../utils/v2ResponseAdapter.js';
import { processPayInH2H } from '../../payIn/payInController.js';
import {
  checkPayInStatusV2,
  generatePayInV2,
} from './payInV2Controller.js';

const router = express.Router();

// Mirror the v1 payIn router's per-request DB connection-scope tracking.
router.use(dbConnScope);

// Per-merchant rate limiting (in addition to the global limiter mounted on the
// v2 router). Buckets by merchant identity so one merchant cannot exhaust the
// payIn capacity for the others.
router.use(merchantApiRateLimiter);

// v2 twin of POST /v1/payIn/check-payin-status. Read-only status check, but it
// is still a merchant-facing endpoint, so the v2 twin is fail-closed: it
// requires merchant auth (checkMerchantApiKeyV2 -> attaches req.merchant) and a
// valid HMAC request signature, exactly like the mutating twins. Identical
// service logic, standardized v2 response envelope.
router.post(
  '/check-payin-status',
  checkAuthCode,
  verifyRequestSignature({ required: true }),
  tryCatchHandler(checkPayInStatusV2),
);

// v2 twin of GET /v1/payIn/generate-payin. Mutating merchant endpoint (creates a
// payIn) — full Phase-2 guard chain:
//   1. checkMerchantApiKeyV2     -> fail-closed API key + IP allowlist, attaches
//                                   req.merchant (exposes the per-merchant secret)
//   2. verifyRequestSignature({required:true}) -> HMAC request signature is
//                                   MANDATORY (fail-closed, Razorpay-style).
//   3. idempotency()             -> response-replay protection (default OFF); the
//                                   key is GENERATED SERVER-SIDE from the request's
//                                   merchant_order_id (never read from a header),
//                                   so a retry of the same order replays the
//                                   original response. When no merchant_order_id is
//                                   supplied the request is genuinely unique and
//                                   idempotency is skipped. Activates with its flag.
// The signature requirement is always on; idempotency activates with its flag.
router.post(
  '/generate-payin',
  checkAuthCode,
  verifyRequestSignature({ required: true }),
  idempotency({ deriveKey: (req) => req.body?.merchant_order_id }),
  tryCatchHandler(generatePayInV2),
);

// v2 twin of POST /v1/payIn/process-payin/:merchantOrderId (host-to-host UTR
// submission). The v1 controller (processPayInH2H) only validates, publishes to
// the payIn-process queue, and responds 202 via sendSuccess (no sendError), so
// it is reused VERBATIM through adaptResponseToV2 — no business-logic copy.
//
// Hardening vs v1: the v1 route is UNAUTHENTICATED. Because this endpoint queues
// real payment processing, the v2 twin requires the full guard chain:
//   1. checkMerchantApiKeyV2     -> fail-closed API key + IP allowlist, attaches
//                                   req.merchant (server-to-server auth for h2h)
//   2. verifyRequestSignature({required:true}) -> HMAC request signature is
//                                   MANDATORY (fail-closed, Razorpay-style).
//   3. idempotency({required})   -> no double-processing on retry (default OFF);
//                                   the key is GENERATED SERVER-SIDE from the
//                                   :merchantOrderId path param (never read from a
//                                   header).
// The signature requirement is always on; idempotency activates with its flag.
router.post(
  '/process-payin/:merchantOrderId',
  checkAuthCode,
  verifyRequestSignature({ required: true }),
  idempotency({
    required: true,
    deriveKey: (req) => req.params?.merchantOrderId,
  }),
  tryCatchHandler((req, res) => processPayInH2H(req, adaptResponseToV2(res))),
);

export default router;
