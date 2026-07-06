import express from 'express';
import tryCatchHandler from '../../../utils/tryCatchHandler.js';
import { checkMerchantApiKeyV2 } from '../../../middlewares/checkApiKey.js';
import { verifyRequestSignature } from '../../../middlewares/requestSignature.js';
import { getWalletBalanceV2 } from './walletBalanceV2Controller.js';

const router = express.Router();

// v2 twin of GET /v1/walletBalance. Read-only, but still a merchant-facing
// endpoint, so it is fail-closed: merchant auth (checkMerchantApiKeyV2 ->
// attaches req.merchant via the `code` + `x-api-key` headers) and a MANDATORY
// HMAC request signature, exactly like the mutating merchant twins. Same
// underlying getWalletBalanceService, standardized v2 response envelope.
router.get(
  '/',
  checkMerchantApiKeyV2,
  verifyRequestSignature({ required: true }),
  tryCatchHandler(getWalletBalanceV2),
);

export default router;
