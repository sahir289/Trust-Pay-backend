import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { assignedBankToPayInUrl, checkPayInStatus, expirePayInUrl, generatePayInUrl, validatePayInUrl } from './payInController.js';

const router = express.Router();
router.get('/', tryCatchHandler(generatePayInUrl));
router.get('/validate-payIn-url/:payInId', tryCatchHandler(validatePayInUrl));
router.post("/assign-bank/:payInId", tryCatchHandler(assignedBankToPayInUrl));
router.get("/check-payin-status", tryCatchHandler(checkPayInStatus));
router.get("/expire-payIn-url/:payInId", tryCatchHandler(expirePayInUrl));
export default router;
