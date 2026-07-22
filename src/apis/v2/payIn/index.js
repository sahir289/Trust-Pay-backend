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
  generateH2HPayInV2,
  generatePayInV2,
} from './payInV2Controller.js';
import { checkh2hUserId } from '../../../middlewares/h2hUserBlock.js';
import { IPWhiteListChecker } from '../../../middlewares/whitelistChecker.js';

const router = express.Router();

router.use(dbConnScope);

router.use(merchantApiRateLimiter);

router.post(
  '/check-payin-status',
  checkAuthCode,
  IPWhiteListChecker,
  verifyRequestSignature({ required: true }),
  tryCatchHandler(checkPayInStatusV2),
);

router.post(
  '/create-payin',
  checkAuthCode,
  IPWhiteListChecker,
  verifyRequestSignature({ required: true }),
  idempotency({ deriveKey: (req) => req.body?.merchant_order_id }),
  tryCatchHandler(generatePayInV2),
);

router.post(
  '/create',
  checkAuthCode,
  IPWhiteListChecker,
  checkh2hUserId,
  verifyRequestSignature({ required: true }),
  idempotency({ deriveKey: (req) => req.body?.merchant_order_id }),
  tryCatchHandler(generateH2HPayInV2),
);

router.post(
  '/process-payin/:merchantOrderId',
  checkAuthCode,
  IPWhiteListChecker,
  verifyRequestSignature({ required: true }),
  idempotency({
    required: true,
    deriveKey: (req) => req.params?.merchantOrderId,
  }),
  tryCatchHandler((req, res) => processPayInH2H(req, adaptResponseToV2(res))),
);

export default router;
