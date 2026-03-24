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
import { getRupeeFlowWalletBalance, initiateRupeeFlowPayout } from '../../rupeeflow/rupeeflow.js';
import { getBSSWalletBalance } from '../../bss/bss.js';
import { getBSS02WalletBalance } from '../../bss/bss02.js';
import { bssTransactionStatusCallback } from '../../callBacksAndWebHook/callBacks/bssWebHook.js';
import { silkPayTransactionStatusCallback } from '../../callBacksAndWebHook/callBacks/silkpayWebHook.js';
import { getSilkPayWalletBalance } from '../../silkpay/silkpay.js';
import { bss02TransactionStatusCallback } from '../../callBacksAndWebHook/callBacks/bss02WebHook.js';
import { getPayDumWalletBalance } from '../../paydum/paydum.js';
import { payDumTransactionStatusCallback } from '../../callBacksAndWebHook/callBacks/payDumWebHook.js';
const router = express.Router();

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
 * /payout/{id}:
 *   get:
 *     summary: Retrieve a specific payout by ID
 *     description: Retrieves the details of a specific payout by its ID.
 *     tags:
 *       - Payout
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
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 status:
 *                   type: string
 *       404:
 *         description: Payout not found.
 *       401:
 *         description: Unauthorized access
 */
router.get(
  '/',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(getPayoutsBySearch),
);
router.get(
  '/reports',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(getPayouts),
);
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
 *     description: Adds a new payout to the system.
 *     tags:
 *       - Payout
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Payout A"
 *               status:
 *                 type: string
 *                 example: "active"
 *     responses:
 *       201:
 *         description: Payout created successfully.
 *       400:
 *         description: Invalid request data.
 *       401:
 *         description: Unauthorized access
 */
router.post(
  '/create-payout',
  // [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(createPayout),
);

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
 *       404:
 *         description: Payout not found.
 *       401:
 *         description: Unauthorized access
 */
router.delete(
  '/delete-payout/:id',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(deletePayout),
);

router.get(
  '/payassist/wallets-balance',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(getPayAssistWalletBalance),
);

router.get(
  '/paydum/paydum-balance',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(getPayDumWalletBalance),
);

router.get(
  '/tatapay/tatapay-balance',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(getTataPayWalletBalance),
);
router.get(
  '/bss/bss-balance',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(getBSSWalletBalance),
);
router.get(
  '/silkpay/silkpay-balance',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(getSilkPayWalletBalance),
);

router.post(
  '/silkpay-callback',
  tryCatchHandler(silkPayTransactionStatusCallback),
);
router.get(
  '/bss02/bss02-balance',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(getBSS02WalletBalance),
);

router.post(
  '/clickrr',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(initiateClickrrPayout),
);

router.get(
  '/clickrr/wallet-balance',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(getClickrrWalletBalance),
);

router.post(
  '/bss-callback',
  tryCatchHandler(bssTransactionStatusCallback),
);

router.post(
  '/bss02-callback',
  tryCatchHandler(bss02TransactionStatusCallback),
);

router.post(
  '/payassist-callback',
  tryCatchHandler(payAssistTransactionStatusCallback),
);

router.post(
  '/paydum-callback',
  tryCatchHandler(payDumTransactionStatusCallback),
);

router.post(
  '/tatapay-callback',
  tryCatchHandler(tataPayTransactionStatusCallback),
);

router.post(
  '/rupeeflow',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(initiateRupeeFlowPayout),
);

router.get(
  '/rupeeflow/wallet-balance',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(getRupeeFlowWalletBalance),
);

// router.post(
//   '/payouts',
//   [isAuthenticated, authorized(AccessRoles.PAYOUT)],
//   tryCatchHandler(createPayout),
// );

export default router;
