import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { isAuthenticated } from '../../middlewares/auth.js';
import { assignedBankToPayInUrl, checkPayInStatus, generatePayInUrl,getPayins, payInIntentGenerateOrder, processPayIn, processPayInByImage, resetDeposit, telegramOCR, updateDepositStatus, updatePaymentNotificationStatus, validatePayInUrl } from './payInController.js';
import { payInUpdateCashfreeWebhook } from '../../webhooks/index.js';
import { multerUpload } from '../../utils/index.js';
const router = express.Router();

// Public API's
router.get('/', tryCatchHandler(generatePayInUrl));
router.get('/validate-payIn-url/:payInId', tryCatchHandler(validatePayInUrl));
router.post("/assign-bank/:payInId", tryCatchHandler(assignedBankToPayInUrl));
router.post("/check-payin-status", tryCatchHandler(checkPayInStatus));
router.post("/generate-intent-order/:payInId", tryCatchHandler(payInIntentGenerateOrder));
router.post("/process/:payInId", tryCatchHandler(processPayIn));
router.post("/process-by-image/:payInId", multerUpload.single("file"), tryCatchHandler(processPayInByImage));

// Telegram API's
router.post('/telegram-ocr', tryCatchHandler(telegramOCR))

// Authenticated API's
router.use(isAuthenticated)
router.post("/update-payment-notified-status/:payInId", tryCatchHandler(updatePaymentNotificationStatus));
router.put("/update-deposit-status/:merchantId", tryCatchHandler(updateDepositStatus));
router.post("/update-payment-cashfree-webhook", tryCatchHandler(payInUpdateCashfreeWebhook));
router.post("/reset-payment", tryCatchHandler(resetDeposit));
router.post("/dispute-duplicate/:payInId", tryCatchHandler(resetDeposit));
// router.get("/expire-payIn-url/:payInId", tryCatchHandler(expirePayInUrl));
router.get('/payin-data',  tryCatchHandler(getPayins));
export default router;
