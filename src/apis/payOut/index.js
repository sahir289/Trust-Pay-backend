import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  createPayout,
  deletePayout,
  getPayouts,
  updatePayout,
  getPayoutsById,
  getPayoutsBySearch,
  checkPayOutStatus,
  assignedPayout,
  createTataPayBulkPayoutController,
} from './payOutController.js';
import { authorized, isAuthenticated } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';
import { payAssistTransactionStatusCallback } from '../../callBacksAndWebHook/callBacks/payAsistWebHook.js';
import { tataPayTransactionStatusCallback } from '../../callBacksAndWebHook/callBacks/tataPayWebHook.js';
import {
  getClickrrWalletBalance,
  initiateClickrrPayout,
} from '../../clickrr/clickrr.js';
// Import balance functions from separate files
import { getPayAssistWalletBalance } from '../../payassist/payassist.js';
import { getTataPayWalletBalance } from '../../tatapay/tatapay.js';
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Payout
 *   description: API endpoints for managing payout transactions and wallet operations
 */

/**
 * @swagger
 * /payout:
 *   get:
 *     summary: Retrieve all payouts
 *     description: Returns a list of all payouts.
 *     tags:
 *       - Payout
 *     responses:
 *       200:
 *         description: A list of payouts.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   status:
 *                     type: string
 *                     example: "active"
 *       401:
 *         description: Unauthorized access
 */
// router.get(
//   '/',
//   [isAuthenticated, authorized(AccessRoles.PAYOUT)],
//   tryCatchHandler(getPayouts),
// );

/**
 * @swagger
 * /payout:
 *   get:
 *     summary: Search payouts
 *     description: Retrieve payouts based on search criteria with pagination
 *     tags:
 *       - Payout
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for filtering payouts
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Payouts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(getPayoutsBySearch),
);

/**
 * @swagger
 * /payout/reports:
 *   get:
 *     summary: Get payout reports
 *     description: Retrieves comprehensive payout reports and analytics
 *     tags:
 *       - Payout
 *     security:
 *       - xAuthToken: []
 *     responses:
 *       200:
 *         description: Payout reports retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized access
 */
router.get(
  '/reports',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(getPayouts),
);
/**
 * @swagger
 * /payout/{id}:
 *   get:
 *     summary: Retrieve a specific payout by ID
 *     description: Retrieves the details of a specific payout by its ID.
 *     tags:
 *       - Payout
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the payout to retrieve.
 *     responses:
 *       200:
 *         description: Payout details retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       404:
 *         description: Payout not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized access
 */
router.get(
  '/:id',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(getPayoutsById),
);

/**
 * @swagger
 * /payout/create-payout:
 *   post:
 *     summary: Create a new payout
 *     description: Adds a new payout to the system (public endpoint)
 *     tags:
 *       - Payout
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               account_holder_name:
 *                 type: string
 *                 example: "John Doe"
 *               account_number:
 *                 type: string
 *                 example: "1234567890"
 *               ifsc_code:
 *                 type: string
 *                 example: "HDFC0001234"
 *               amount:
 *                 type: number
 *                 example: 1000
 *               purpose:
 *                 type: string
 *                 example: "Payment for services"
 *     responses:
 *       201:
 *         description: Payout created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid request data.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/create-payout',
  // [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(createPayout),
);

/**
 * @swagger
 * /payout/generate-payout:
 *   post:
 *     summary: Generate authenticated payout
 *     description: Creates a new payout with authentication and authorization
 *     tags:
 *       - Payout
 *     security:
 *       - xAuthToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               account_holder_name:
 *                 type: string
 *               account_number:
 *                 type: string
 *               ifsc_code:
 *                 type: string
 *               amount:
 *                 type: number
 *               purpose:
 *                 type: string
 *     responses:
 *       201:
 *         description: Payout generated successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized access
 */
router.post(
  '/generate-payout',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(createPayout),
);

/**
 * @swagger
 * /payout/check-payout-status:
 *   post:
 *     summary: Check Pay-Out Status
 *     description: Checks the status of a specific Pay-In URL.
 *     tags: [PayOut]
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
 *         description: Pay-Out status retrieved successfully.
 *       500:
 *         description: Internal server error
 */
router.post('/check-payout-status', tryCatchHandler(checkPayOutStatus));

/**
 * @swagger
 * /payout/update-payout/{id}:
 *   put:
 *     summary: Update payout details
 *     description: Updates an existing payout's details by its ID.
 *     tags:
 *       - Payout
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the payout to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated Payout"
 *               status:
 *                 type: string
 *                 example: "inactive"
 *     responses:
 *       200:
 *         description: Payout updated successfully.
 *       404:
 *         description: Payout not found.
 *       401:
 *         description: Unauthorized access
 */
router.put(
  '/update-payout/:id',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(updatePayout),
);
/**
 * @swagger
 * /payout/assign-vendor-payout/{id}:
 *   put:
 *     summary: Assign vendor to payout
 *     description: Assigns a specific vendor to handle the payout transaction
 *     tags:
 *       - Payout
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the payout to assign vendor to
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               vendor_id:
 *                 type: string
 *                 description: ID of the vendor to assign
 *               priority:
 *                 type: integer
 *                 description: Priority level for the assignment
 *     responses:
 *       200:
 *         description: Vendor assigned to payout successfully
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Payout not found
 */
router.put(
  '/assign-vendor-payout/:id',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(assignedPayout),
);

/**
 * @swagger
 * /payout/delete-payout/{id}:
 *   delete:
 *     summary: Delete a payout
 *     description: Soft deletes a payout by changing its status to inactive.
 *     tags:
 *       - Payout
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the payout to delete.
 *     responses:
 *       200:
 *         description: Payout deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       404:
 *         description: Payout not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized access
 */
router.delete(
  '/delete-payout/:id',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(deletePayout),
);

/**
 * @swagger
 * /payout/payassist/wallets-balance:
 *   get:
 *     summary: Get PayAssist wallet balance
 *     description: Retrieves the current balance of PayAssist wallets
 *     tags:
 *       - Payout
 *     security:
 *       - xAuthToken: []
 *     responses:
 *       200:
 *         description: Wallet balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Service unavailable
 */
router.get(
  '/payassist/wallets-balance',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(getPayAssistWalletBalance),
);

/**
 * @swagger
 * /payout/tatapay/tatapay-balance:
 *   get:
 *     summary: Get TataPay wallet balance
 *     description: Retrieves the current balance of TataPay wallets
 *     tags:
 *       - Payout
 *     security:
 *       - xAuthToken: []
 *     responses:
 *       200:
 *         description: TataPay balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Service unavailable
 */
router.get(
  '/tatapay/tatapay-balance',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(getTataPayWalletBalance),
);

/**
 * @swagger
 * /payout/clickrr:
 *   post:
 *     summary: Initiate Clickrr payout
 *     description: Initiates a payout transaction through the Clickrr payment gateway
 *     tags:
 *       - Payout
 *     security:
 *       - xAuthToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               account_number:
 *                 type: string
 *                 description: Beneficiary account number
 *               ifsc_code:
 *                 type: string
 *                 description: Bank IFSC code
 *               amount:
 *                 type: number
 *                 description: Payout amount
 *               beneficiary_name:
 *                 type: string
 *                 description: Name of the beneficiary
 *     responses:
 *       200:
 *         description: Clickrr payout initiated successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized access
 */
router.post(
  '/clickrr',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(initiateClickrrPayout),
);

/**
 * @swagger
 * /payout/clickrr/wallet-balance:
 *   get:
 *     summary: Get Clickrr wallet balance
 *     description: Retrieves the current balance of Clickrr wallets
 *     tags:
 *       - Payout
 *     security:
 *       - xAuthToken: []
 *     responses:
 *       200:
 *         description: Clickrr wallet balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Service unavailable
 */
router.get(
  '/clickrr/wallet-balance',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(getClickrrWalletBalance),
);

/**
 * @swagger
 * /payout/payassist-callback:
 *   post:
 *     summary: PayAssist transaction callback
 *     description: Webhook endpoint for receiving PayAssist transaction status updates
 *     tags:
 *       - Payout
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               transaction_id:
 *                 type: string
 *               status:
 *                 type: string
 *               amount:
 *                 type: number
 *               reference_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Callback processed successfully
 *       400:
 *         description: Invalid callback data
 */
router.post(
  '/payassist-callback',
  tryCatchHandler(payAssistTransactionStatusCallback),
);

/**
 * @swagger
 * /payout/tatapay-callback:
 *   post:
 *     summary: TataPay transaction callback
 *     description: Webhook endpoint for receiving TataPay transaction status updates
 *     tags:
 *       - Payout
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               transaction_id:
 *                 type: string
 *               status:
 *                 type: string
 *               amount:
 *                 type: number
 *               reference_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Callback processed successfully
 *       400:
 *         description: Invalid callback data
 */
router.post(
  '/tatapay-callback',
  tryCatchHandler(tataPayTransactionStatusCallback),
);

/**
 * @swagger
 * /payout/tatapay/bulk-payout:
 *   post:
 *     summary: Create TataPay bulk payout
 *     description: Process multiple payouts through TataPay in a single request
 *     tags:
 *       - Payout
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               payoutEntries:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Unique payout ID
 *                     account_holder_name:
 *                       type: string
 *                       description: Beneficiary name
 *                     account_no:
 *                       type: string
 *                       description: Bank account number
 *                     ifsc_code:
 *                       type: string
 *                       description: IFSC code
 *                     bank_name:
 *                       type: string
 *                       description: Bank name
 *                     amount:
 *                       type: number
 *                       description: Payout amount
 *                     remark:
 *                       type: string
 *                       description: Payment remark
 *                 example:
 *                   - id: "payout_001"
 *                     account_holder_name: "John Doe"
 *                     account_no: "1234567890"
 *                     ifsc_code: "HDFC0001234"
 *                     bank_name: "HDFC Bank"
 *                     amount: 1000
 *                     remark: "Payment for services"
 *               payoutIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of payout IDs (alternative to payoutEntries)
 *                 example: ["payout_001", "payout_002"]
 *             oneOf:
 *               - required: [payoutEntries]
 *               - required: [payoutIds]
 *     responses:
 *       200:
 *         description: Bulk payout processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Bulk payout processed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalRecords:
 *                       type: number
 *                       example: 10
 *                     successpayout:
 *                       type: number
 *                       example: 8
 *                     skippayout:
 *                       type: number
 *                       example: 2
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           success:
 *                             type: boolean
 *                           message:
 *                             type: string
 *                           payoutId:
 *                             type: string
 *                           beneficiaryId:
 *                             type: string
 *                           balanceAfter:
 *                             type: number
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.post(
  '/tatapay/bulk-payout',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(createTataPayBulkPayoutController),
);

// router.post(
//   '/payouts',
//   [isAuthenticated, authorized(AccessRoles.PAYOUT)],
//   tryCatchHandler(createPayout),
// );

export default router;
