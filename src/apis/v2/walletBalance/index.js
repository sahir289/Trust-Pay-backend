import express from 'express';
import tryCatchHandler from '../../../utils/tryCatchHandler.js';
import { checkMerchantApiKeyV2 } from '../../../middlewares/checkApiKey.js';
import { verifyRequestSignature } from '../../../middlewares/requestSignature.js';
import { merchantApiRateLimiter } from '../../../middlewares/rateLimiter.js';
import { getWalletBalanceV2 } from './walletBalanceV2Controller.js';

const router = express.Router();

router.use(merchantApiRateLimiter);

router.get(
  '/',
  checkMerchantApiKeyV2,
  verifyRequestSignature({ required: true }),
  tryCatchHandler(getWalletBalanceV2),
);

export default router;
