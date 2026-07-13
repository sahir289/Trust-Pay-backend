import express from 'express';
import tryCatchHandler from '../../../utils/tryCatchHandler.js';
import dbConnScope from '../../../middlewares/dbConnScope.js';
import { checkAuthVendorCode } from '../../../middlewares/checkAuthVendorCode.js';
import { verifyRequestSignature } from '../../../middlewares/requestSignature.js';
import { rateLimitMiddlewareBot } from '../../../middlewares/rateLimiter.js';
import { createBankBotV2Response, createBankBotV2ResponseBulk } from './bankRespopnseV2Controller.js';

const router = express.Router();

router.use(dbConnScope);

router.post('/create-bot-message',
  rateLimitMiddlewareBot,
  checkAuthVendorCode,
  verifyRequestSignature({ required: true }),
  tryCatchHandler(
    createBankBotV2Response
));

router.post('/create-bot-message-bulk',
  checkAuthVendorCode,
  verifyRequestSignature({ required: true }),
  tryCatchHandler(createBankBotV2ResponseBulk));

export default router;
