import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { assignedBankToPayInUrl, checkPayInStatus, generatePayInUrl, payInIntentGenerateOrder, resetDeposit, updateDepositStatus, updatePaymentNotificationStatus, validatePayInUrl } from './payInController.js';
import { payInUpdateCashfreeWebhook } from '../../webhooks/index.js';
const router = express.Router();

router.get('/', tryCatchHandler(generatePayInUrl));
router.get('/validate-payIn-url/:payInId', tryCatchHandler(validatePayInUrl));
router.post("/assign-bank/:payInId", tryCatchHandler(assignedBankToPayInUrl));
// Public API Used by Merchants
router.post("/check-payin-status", tryCatchHandler(checkPayInStatus));
router.post("/generate-intent-order/:payInId", tryCatchHandler(payInIntentGenerateOrder));
router.post("/update-payment-notified-status/:payInId", tryCatchHandler(updatePaymentNotificationStatus));
router.put("/update-deposit-status/:id", tryCatchHandler(updateDepositStatus));
router.post("/update-payment-cashfree-webhook", tryCatchHandler(payInUpdateCashfreeWebhook));
router.post("/reset-payment/", tryCatchHandler(resetDeposit));
// router.get("/expire-payIn-url/:payInId", tryCatchHandler(expirePayInUrl));

export default router;
