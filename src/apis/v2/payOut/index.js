import express from 'express';
import tryCatchHandler from '../../../utils/tryCatchHandler.js';
import { verifyRequestSignature } from '../../../middlewares/requestSignature.js';
import { checkPayOutV2Status, createPayoutV2 } from './payOutV2Controller.js';
import { checkAuthCode } from '../../../middlewares/checkAuthCode.js';

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
  checkAuthCode,
  verifyRequestSignature({ required: true }),
  tryCatchHandler(createPayoutV2),
);

router.post('/check-payout-status',
  checkAuthCode,
  verifyRequestSignature({ required: true }),
   tryCatchHandler(checkPayOutV2Status));

export default router;
