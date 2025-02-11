import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { assignedBankToPayInUrl, checkPayInStatus, generatePayInUrl, payInIntentGenerateOrder, validatePayInUrl } from './payInController.js';

const router = express.Router();
router.get('/', tryCatchHandler(generatePayInUrl));
router.get('/validate-payIn-url/:payInId', tryCatchHandler(validatePayInUrl));
router.post("/assign-bank/:payInId", tryCatchHandler(assignedBankToPayInUrl));
// Public API Used by Merchants
router.post("/check-payin-status", tryCatchHandler(checkPayInStatus));
// router.get("/expire-payIn-url/:payInId", tryCatchHandler(expirePayInUrl));
router.post("/generate-intent-order/:payInId", tryCatchHandler(payInIntentGenerateOrder));

export default router;
