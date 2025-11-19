import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { authorized, isAuthenticated } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';
import {
  assignedBankToPayInUrl,
  checkPayInStatus,
  disputeDuplicateTransaction,
  generatePayInUrl,
  // getPayins,
  payInIntentGenerateOrder,
  processPayIn,
  processPayInByImage,
  resetDeposit,
  telegramCheckUTR,
  telegramOCR,
  updateDepositStatus,
  updatePaymentNotificationStatus,
  validatePayInUrl,
  generateHashForPayIn,
  getPayinsBySearch,
  generateUpiUrl,
  updateUtrPayins,
  checkPendingPayinStatus,
  updatePayIn,
  processPayInIMGUTR,
  getPayinsSummary,
  processPayInH2H,
} from './payInController.js';
// import { payInUpdateCashfreeWebhook } from '../../webhooks/index.js';
import { multerUpload } from '../../utils/index.js';
import getUserLocationMiddleware from '../../middlewares/locationRestrict.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: PayIn
 *   description: API endpoints for managing pay-in transactions and payment processing
 */

// Public API's

/**
 * @swagger
 * /payin/generate-hash:
 *   get:
 *     summary: Generate hash for Pay-In
 *     description: Generates a secure hash for pay-in transaction authentication
 *     tags: [PayIn]
 *     security:
 *       - xAuthToken: []
 *     responses:
 *       200:
 *         description: Hash generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
router.get(
  '/generate-hash',
  isAuthenticated,
  tryCatchHandler(generateHashForPayIn),
);

/**
 * @swagger
 * /payin:
 *   get:
 *     summary: Generate Pay-In URL
 *     description: Generates a Pay-In URL for a payment process.
 *     tags: [PayIn]
 *     responses:
 *       200:
 *         description: Pay-In URL generated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Pay-In URL generated successfully"
 *                 data:
 *                   type: string
 *                   example: "https://payinurl.com"
 *       500:
 *         description: Internal server error
 */
router.get('/generate-payin', tryCatchHandler(generatePayInUrl));

/**
 * @swagger
 * /payin/validate-payIn-url/{merchantOrderId}:
 *   get:
 *     summary: Validate Pay-In URL
 *     description: Validates if the Pay-In URL is valid.
 *     tags: [PayIn]
 *     parameters:
 *       - in: path
 *         name: merchantOrderId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the Pay-In URL to validate.
 *     responses:
 *       200:
 *         description: Pay-In URL validated successfully.
 *       404:
 *         description: Pay-In URL not found
 */
router.get(
  '/validate-payIn-url/:merchantOrderId',
  getUserLocationMiddleware,
  tryCatchHandler(validatePayInUrl),
);

/**
 * @swagger
 * /payin/generate-upi-url:
 *   post:
 *     summary: Generate UPI app URL.
 *     description: Generate UPI app URL for user redirection.
 *     tags: [PayIn]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               userId:
 *                 type: string
 *               merchantCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Pay-In URL generated successfully.
 *       404:
 *         description: Pay-In URL not found.
 */
router.post('/generate-upi-url', tryCatchHandler(generateUpiUrl));

/**
 * @swagger
 * /payin/assign-bank/{merchantOrderId}:
 *   post:
 *     summary: Assign bank to Pay-In URL
 *     description: Assigns a bank to a specific Pay-In URL.
 *     tags: [PayIn]
 *     parameters:
 *       - in: path
 *         name: merchantOrderId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the Pay-In URL.
 *     responses:
 *       200:
 *         description: Bank assigned to Pay-In URL successfully.
 *       404:
 *         description: Pay-In URL not found
 */
router.post(
  '/assign-bank/:merchantOrderId',
  tryCatchHandler(assignedBankToPayInUrl),
);

/**
 * @swagger
 * /payin/check-payin-status:
 *   post:
 *     summary: Check Pay-In Status
 *     description: Checks the status of a specific Pay-In URL.
 *     tags: [PayIn]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               payInId:
 *                 type: string
 *                 example: "12345"
 *     responses:
 *       200:
 *         description: Pay-In status retrieved successfully.
 *       500:
 *         description: Internal server error
 */
router.post('/check-payin-status', tryCatchHandler(checkPayInStatus));

/**
 * @swagger
 * /payin/generate-intent-order/{payInId}:
 *   post:
 *     summary: Generate Pay-In Intent Order
 *     description: Generates a Pay-In intent order for the specified Pay-In URL.
 *     tags: [PayIn]
 *     parameters:
 *       - in: path
 *         name: payInId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the Pay-In URL to generate the intent for.
 *     responses:
 *       200:
 *         description: Pay-In intent order generated successfully.
 *       404:
 *         description: Pay-In URL not found
 */
router.post(
  '/generate-intent-order/:merchantOrderId',
  tryCatchHandler(payInIntentGenerateOrder),
);

/**
 * @swagger
 * /payin/process/{merchantOrderId}:
 *   post:
 *     summary: Process a Pay-In
 *     description: Processes a Pay-In for the specified Pay-In URL.
 *     tags: [PayIn]
 *     parameters:
 *       - in: path
 *         name: merchantOrderId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the Pay-In URL to process.
 *     responses:
 *       200:
 *         description: Pay-In processed successfully.
 *       404:
 *         description: Pay-In URL not found
 */
router.post('/process/:merchantOrderId', tryCatchHandler(processPayIn));
router.post('/process-payin/:merchantOrderId', tryCatchHandler(processPayInH2H)); //h2h

/**
 * @swagger
 * /payin/process-by-image/{merchantOrderId}:
 *   post:
 *     summary: Process Pay-In by Image
 *     description: Processes a Pay-In using an image of the payment confirmation.
 *     tags: [PayIn]
 *     parameters:
 *       - in: path
 *         name: merchantOrderId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the Pay-In URL to process.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The payment confirmation image to upload.
 *     responses:
 *       200:
 *         description: Pay-In processed using the image successfully.
 *       404:
 *         description: Pay-In URL not found
 */
router.post(
  '/process-by-image/:merchantOrderId',
  multerUpload.single('file'),
  tryCatchHandler(processPayInByImage),
);

// Telegram API's

/**
 * @swagger
 * /payin/telegram-ocr:
 *   post:
 *     summary: Process OCR via Telegram
 *     description: Processes optical character recognition for payment documents via Telegram
 *     tags: [PayIn]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               image_data:
 *                 type: string
 *                 description: Base64 encoded image data
 *               document_type:
 *                 type: string
 *                 description: Type of document to process
 *     responses:
 *       200:
 *         description: OCR processing completed successfully
 *       400:
 *         description: Invalid image data or format
 *       500:
 *         description: Internal server error
 */
router.post('/telegram-ocr', tryCatchHandler(telegramOCR));

/**
 * @swagger
 * /payin/update-payment-cashfree-webhook:
 *   post:
 *     summary: Update Payment Cashfree Webhook
 *     description: Receives webhook data from Cashfree and updates the payment status.
 *     tags: [PayIn]
 *     responses:
 *       200:
 *         description: Payment status updated from Cashfree webhook successfully.
 */
// router.post(
//   '/update-payment-cashfree-webhook',
//   tryCatchHandler(payInUpdateCashfreeWebhook),
// );

// Authenticated API's
// router.use(isAuthenticated);
// router.use(authorized(AccessRoles.PAYIN));

/**
 * @swagger
 * /payin/telegram-check-utr:
 *   post:
 *     summary: Check UTR via Telegram
 *     description: Validates Unique Transaction Reference (UTR) numbers via Telegram integration
 *     tags: [PayIn]
 *     security:
 *       - xAuthToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               utr_number:
 *                 type: string
 *                 description: UTR number to validate
 *               transaction_amount:
 *                 type: number
 *                 description: Expected transaction amount
 *     responses:
 *       200:
 *         description: UTR validation completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid UTR format
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: UTR not found
 */
router.post(
  '/telegram-check-utr',
  isAuthenticated,
  authorized(AccessRoles.PAYIN),
  tryCatchHandler(telegramCheckUTR),
);

/**
 * @swagger
 * /payin/update-payment-notified-status/{payInId}:
 *   put:
 *     summary: Update Payment Notification Status
 *     description: Updates the payment notification status of a Pay-In.
 *     tags: [PayIn]
 *     parameters:
 *       - in: path
 *         name: payInId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the Pay-In URL to update.
 *     responses:
 *       200:
 *         description: Payment notification status updated successfully.
 */
router.put(
  '/update-payment-notified-status/:payInId',
  isAuthenticated,
  authorized(AccessRoles.PAYIN),
  tryCatchHandler(updatePaymentNotificationStatus),
);

/**
 * @swagger
 * /payin/update-deposit-status/{merchantId}:
 *   put:
 *     summary: Update Deposit Status
 *     description: Updates the deposit status for a specific merchant.
 *     tags: [PayIn]
 *     parameters:
 *       - in: path
 *         name: merchantId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the merchant whose deposit status is to be updated.
 *     responses:
 *       200:
 *         description: Deposit status updated successfully.
 *       404:
 *         description: Merchant not found
 */
router.put(
  '/update-deposit-status/:merchantOrderId',
  isAuthenticated,
  authorized(AccessRoles.PAYIN),
  tryCatchHandler(updateDepositStatus),
);

/**
 * @swagger
 * /payin/reset-payment:
 *   post:
 *     summary: Reset Payment Status
 *     description: Resets the payment status for a specific Pay-In URL.
 *     tags: [PayIn]
 *     responses:
 *       200:
 *         description: Payment status reset successfully.
 *       404:
 *         description: Pay-In URL not found
 */
router.post(
  '/reset-payment',
  isAuthenticated,
  authorized(AccessRoles.PAYIN),
  tryCatchHandler(resetDeposit),
);

/**
 * @swagger
 * /payin/dispute-duplicate/{payInId}:
 *   put:
 *     summary: Dispute Duplicate Payment
 *     description: Disputes a duplicate payment for a specific Pay-In URL.
 *     tags: [PayIn]
 *     parameters:
 *       - in: path
 *         name: payInId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the Pay-In URL to dispute.
 *     responses:
 *       200:
 *         description: Duplicate payment disputed successfully.
 */
router.put(
  '/dispute-duplicate/:payInId',
  isAuthenticated,
  authorized(AccessRoles.PAYIN),
  tryCatchHandler(disputeDuplicateTransaction),
);

/**
 * @swagger
 * /payin/processIMGUTR/{merchantOrderId}:
 *   post:
 *     summary: Process payment using image UTR
 *     description: Processes payment by analyzing UTR from uploaded image
 *     tags: [PayIn]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: merchantOrderId
 *         required: true
 *         schema:
 *           type: string
 *         description: Merchant order ID for the transaction
 *     responses:
 *       200:
 *         description: Image UTR processed successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Order not found
 */
router.post(
  '/processIMGUTR/:merchantOrderId',
  isAuthenticated,
  authorized(AccessRoles.PAYIN),
  tryCatchHandler(processPayInIMGUTR),
);

/**
 * @swagger
 * /payin/updateFailedPayinUtr/{id}:
 *   put:
 *     summary: Update failed pay-in UTR
 *     description: Updates UTR for failed pay-in transactions
 *     tags: [PayIn]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Pay-in transaction ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               utr_number:
 *                 type: string
 *                 description: Correct UTR number
 *     responses:
 *       200:
 *         description: UTR updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Transaction not found
 */
router.put(
  '/updateFailedPayinUtr/:id',
  isAuthenticated,
  authorized(AccessRoles.PAYIN),
  tryCatchHandler(updateUtrPayins),
);

/**
 * @swagger
 * /payin/checkPendingPayinStatus:
 *   get:
 *     summary: Check pending pay-in status
 *     description: Retrieves status of all pending pay-in transactions
 *     tags: [PayIn]
 *     security:
 *       - xAuthToken: []
 *     responses:
 *       200:
 *         description: Pending pay-in statuses retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/checkPendingPayinStatus',
  isAuthenticated,
  authorized(AccessRoles.PAYIN),
  tryCatchHandler(checkPendingPayinStatus),
);

/**
 * @swagger
 * /payin:
 *   get:
 *     summary: Search pay-ins
 *     description: Retrieves pay-in transactions based on search criteria
 *     tags: [PayIn]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Pay-ins retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  isAuthenticated,
  authorized(AccessRoles.PAYIN),
  tryCatchHandler(getPayinsBySearch),
);

/**
 * @swagger
 * /payin/getPayinSummary:
 *   get:
 *     summary: Get pay-in summary
 *     description: Retrieves summary statistics for pay-in transactions
 *     tags: [PayIn]
 *     security:
 *       - xAuthToken: []
 *     responses:
 *       200:
 *         description: Pay-in summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/getPayinSummary',
  isAuthenticated,
  authorized(AccessRoles.PAYIN),
  tryCatchHandler(getPayinsSummary),
);

/**
 * @swagger
 * /payin/updatePayin/{merchant_order_id}:
 *   put:
 *     summary: Update pay-in transaction
 *     description: Updates an existing pay-in transaction
 *     tags: [PayIn]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: merchant_order_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Merchant order ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 description: Updated transaction status
 *               amount:
 *                 type: number
 *                 description: Updated amount
 *     responses:
 *       200:
 *         description: Pay-in updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Transaction not found
 */
router.put(
  '/updatePayin/:merchant_order_id',
  isAuthenticated,
  authorized(AccessRoles.PAYIN),
  tryCatchHandler(updatePayIn),
);

export default router;
