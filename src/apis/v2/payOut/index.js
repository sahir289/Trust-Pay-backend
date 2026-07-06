import express from 'express';
import tryCatchHandler from '../../../utils/tryCatchHandler.js';
import { verifyRequestSignature } from '../../../middlewares/requestSignature.js';
import { merchantApiRateLimiter } from '../../../middlewares/rateLimiter.js';
import { checkPayOutV2Status, createPayoutV2, getWalletBalanceV2 } from './payOutV2Controller.js';
import { checkAuthCode } from '../../../middlewares/checkAuthCode.js';

const router = express.Router();

router.use(merchantApiRateLimiter);

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

   router.get(
    '/walletBalance',
    checkAuthCode,
    verifyRequestSignature({ required: true }),
    tryCatchHandler(getWalletBalanceV2),
  );

export default router;
