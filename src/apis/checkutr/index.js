import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  createCheckUtr,
  deleteCheckUtr,
  // getCheckUtr,
  getCheckUtrBySearch,
  updateCheckUtr,
} from './checkUtrController.js';
import { isAuthenticated, authorized } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Check UTR
 *   description: API endpoints for managing and validating Unique Transaction Reference (UTR) numbers
 */

/**
 * @swagger
 * /checkutr:
 *   get:
 *     summary: Search UTR records
 *     description: Retrieves UTR validation records based on search criteria with pagination
 *     tags:
 *       - Check UTR
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for filtering UTR records
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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, verified, failed, invalid]
 *         description: Filter by UTR validation status
 *       - in: query
 *         name: utr_number
 *         schema:
 *           type: string
 *         description: Specific UTR number to search for
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering
 *     responses:
 *       200:
 *         description: UTR records retrieved successfully
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
 *       500:
 *         description: Internal server error
 */
router.get(
  '/',
  [isAuthenticated, authorized(AccessRoles.CHECK_UTR_HISTORY)],
  tryCatchHandler(getCheckUtrBySearch),
);

/**
 * @swagger
 * /checkutr/create:
 *   post:
 *     summary: Create UTR validation record
 *     description: Creates a new UTR validation record for tracking and verifying transaction references
 *     tags:
 *       - Check UTR
 *     security:
 *       - xAuthToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - utr_number
 *               - transaction_amount
 *               - bank_name
 *             properties:
 *               utr_number:
 *                 type: string
 *                 description: Unique Transaction Reference number
 *                 example: "UTR123456789012"
 *               transaction_amount:
 *                 type: number
 *                 description: Transaction amount associated with the UTR
 *                 example: 1500.50
 *               bank_name:
 *                 type: string
 *                 description: Name of the bank that issued the UTR
 *                 example: "HDFC Bank"
 *               transaction_date:
 *                 type: string
 *                 format: date
 *                 description: Date of the transaction
 *               sender_account:
 *                 type: string
 *                 description: Sender's account number
 *               receiver_account:
 *                 type: string
 *                 description: Receiver's account number
 *               transaction_type:
 *                 type: string
 *                 enum: [NEFT, RTGS, IMPS, UPI]
 *                 description: Type of transaction
 *               remarks:
 *                 type: string
 *                 description: Additional remarks or notes
 *     responses:
 *       201:
 *         description: UTR validation record created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid UTR format or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.post(
  '/create',
  [isAuthenticated, authorized(AccessRoles.CHECK_UTR_HISTORY)],
  tryCatchHandler(createCheckUtr),
);

/**
 * @swagger
 * /checkutr/update-utr/{id}:
 *   put:
 *     summary: Update UTR validation record
 *     description: Updates an existing UTR validation record with new information or status
 *     tags:
 *       - Check UTR
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the UTR record to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               validation_status:
 *                 type: string
 *                 enum: [pending, verified, failed, invalid, disputed]
 *                 description: Updated validation status
 *               verification_notes:
 *                 type: string
 *                 description: Notes about the verification process
 *               verified_amount:
 *                 type: number
 *                 description: Verified transaction amount
 *               verification_date:
 *                 type: string
 *                 format: date-time
 *                 description: Date and time of verification
 *               verified_by:
 *                 type: string
 *                 description: ID of the user who verified the UTR
 *               discrepancy_reason:
 *                 type: string
 *                 description: Reason for any discrepancy found
 *     responses:
 *       200:
 *         description: UTR record updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: UTR record not found
 *       500:
 *         description: Internal server error
 */
router.put(
  '/update-utr/:id',
  [isAuthenticated, authorized(AccessRoles.CHECK_UTR_HISTORY)],
  tryCatchHandler(updateCheckUtr),
);

/**
 * @swagger
 * /checkutr/delete-utr/{id}:
 *   delete:
 *     summary: Delete UTR validation record
 *     description: Soft deletes a UTR validation record (marks as deleted while preserving audit trail)
 *     tags:
 *       - Check UTR
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the UTR record to delete
 *     responses:
 *       200:
 *         description: UTR record deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: UTR record not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/delete-CheckUtr/:id',
  [isAuthenticated, authorized(AccessRoles.CHECK_UTR_HISTORY)],
  tryCatchHandler(deleteCheckUtr),
);

export default router;
