import express from 'express';
import tryCatchHandler from '../../../utils/tryCatchHandler.js';
import dbConnScope from '../../../middlewares/dbConnScope.js';
import { checkMerchantApiKeyV2 } from '../../../middlewares/checkApiKey.js';
import { verifyRequestSignature } from '../../../middlewares/requestSignature.js';
import { idempotency } from '../../../middlewares/idempotency.js';
import { adaptResponseToV2 } from '../../../utils/v2ResponseAdapter.js';
import { processPayInH2H } from '../../payIn/payInController.js';
import {
  checkPayInStatusV2,
  generatePayInV2,
} from './payInV2Controller.js';

const router = express.Router();

// Mirror the v1 payIn router's per-request DB connection-scope tracking.
router.use(dbConnScope);

// v2 twin of POST /v1/payIn/check-payin-status. Read-only; identical service
// logic, standardized v2 response envelope.
router.post('/check-payin-status', tryCatchHandler(checkPayInStatusV2));

// v2 twin of GET /v1/payIn/generate-payin. Mutating merchant endpoint (creates a
// payIn) — full Phase-2 guard chain:
//   1. checkMerchantApiKeyV2     -> fail-closed API key + IP allowlist, attaches
//                                   req.merchant (exposes the per-merchant secret)
//   2. verifyRequestSignature()  -> HMAC request signature (default OFF)
//   3. idempotency()             -> response-replay protection (default OFF); the
//                                   key is honored if supplied but not mandated,
//                                   since merchant_order_id already de-dupes the
//                                   create at the service layer.
// With both feature flags off (default) this behaves like the v1 generate-payin
// but returns the standardized v2 envelope, reusing the same service.
router.get(
  '/generate-payin',
  checkMerchantApiKeyV2,
  verifyRequestSignature(),
  idempotency(),
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
//   2. verifyRequestSignature()  -> HMAC request signature (default OFF)
//   3. idempotency({required})   -> no double-processing on retry (default OFF)
// With both feature flags off (default) the request still authenticates via the
// merchant API key and returns the standardized v2 envelope.
router.post(
  '/process-payin/:merchantOrderId',
  checkMerchantApiKeyV2,
  verifyRequestSignature(),
  idempotency({ required: true }),
  tryCatchHandler((req, res) => processPayInH2H(req, adaptResponseToV2(res))),
);

export default router;
