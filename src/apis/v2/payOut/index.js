import express from 'express';
import tryCatchHandler from '../../../utils/tryCatchHandler.js';
import { checkMerchantApiKeyV2 } from '../../../middlewares/checkApiKey.js';
import { verifyRequestSignature } from '../../../middlewares/requestSignature.js';
import { idempotency } from '../../../middlewares/idempotency.js';
import { createPayoutV2 } from './payOutV2Controller.js';

const router = express.Router();

// Mutating merchant endpoint — full Phase-2 guard chain:
//   1. checkMerchantApiKeyV2     -> fail-closed API key + IP allowlist, attaches
//                                   req.merchant (exposes the per-merchant secret)
//   2. verifyRequestSignature({required:true}) -> HMAC request signature is
//                                   MANDATORY (fail-closed, Razorpay-style); a
//                                   missing/invalid signature is always rejected.
//   3. idempotency({required})   -> replay protection / no double payout (default OFF)
// The signature requirement is always on; idempotency activates with its flag.
router.post(
  '/create-payout',
  checkMerchantApiKeyV2,
  verifyRequestSignature({ required: true }),
  idempotency({ required: true }),
  tryCatchHandler(createPayoutV2),
);

export default router;
