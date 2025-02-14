import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { isAuthenticated } from '../../middlewares/auth.js';
import { assignedBankToPayInUrl, checkPayInStatus, generatePayInUrl, payInIntentGenerateOrder, resetDeposit, updateDepositStatus, updatePaymentNotificationStatus, validatePayInUrl } from './payInController.js';
const router = express.Router();

// Public API's
router.get('/', tryCatchHandler(generatePayInUrl));
router.get('/validate-payIn-url/:payInId', tryCatchHandler(validatePayInUrl));
router.post("/assign-bank/:payInId", tryCatchHandler(assignedBankToPayInUrl));
router.post("/check-payin-status", tryCatchHandler(checkPayInStatus));
router.post("/generate-intent-order/:payInId", tryCatchHandler(payInIntentGenerateOrder));

// Authenticated API's
router.use(isAuthenticated)
router.post("/update-payment-notified-status/:payInId", tryCatchHandler(updatePaymentNotificationStatus));
router.put("/update-deposit-status/:id", tryCatchHandler(updateDepositStatus));
router.post("/reset-payment/", tryCatchHandler(resetDeposit));
// router.get("/expire-payIn-url/:payInId", tryCatchHandler(expirePayInUrl));

export default router;
