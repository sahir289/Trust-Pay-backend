import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { authorized, isAuthenticated } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';
import {
  createSettlementController,
  deleteSettlementController,
  getSettlementController,
  getSettlementControllerById,
  updateSettlementController,
  getSettlementsBySearch,
} from './settlementController.js';
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Settlements
 *   description: API endpoints for managing financial settlements and transaction reconciliation
 */

/**
 * @swagger
 * /settlement:
 *   get:
 *     summary: Search settlements
 *     description: Retrieves settlements based on search criteria with pagination and filtering
 *     tags: [Settlements]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for filtering settlements
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
 *           enum: [pending, processing, completed, failed]
 *         description: Filter by settlement status
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
 *         description: Settlements retrieved successfully
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
  [isAuthenticated, authorized(AccessRoles.SETTLEMENT)],
  tryCatchHandler(getSettlementsBySearch),
);

/**
 * @swagger
 * /settlement/settlementReports:
 *   get:
 *     summary: Get settlement reports
 *     description: Retrieves comprehensive settlement reports and analytics
 *     tags: [Settlements]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: query
 *         name: report_type
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, yearly]
 *         description: Type of report to generate
 *       - in: query
 *         name: merchant_id
 *         schema:
 *           type: string
 *         description: Filter by specific merchant
 *     responses:
 *       200:
 *         description: Settlement reports retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.get(
  '/settlementReports',
  [isAuthenticated, authorized(AccessRoles.SETTLEMENT)],
  tryCatchHandler(getSettlementController),
);

/**
 * @swagger
 * /settlement/{id}:
 *   get:
 *     summary: Get settlement by ID
 *     description: Retrieves detailed information about a specific settlement
 *     tags: [Settlements]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the settlement to retrieve
 *     responses:
 *       200:
 *         description: Settlement details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Settlement not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:id',
  [isAuthenticated, authorized(AccessRoles.SETTLEMENT)],
  tryCatchHandler(getSettlementControllerById),
);
/**
 * @swagger
 * /settlement/create-settlement:
 *   post:
 *     summary: Create a new settlement
 *     description: Initiates a new settlement transaction for processing payments
 *     tags: [Settlements]
 *     security:
 *       - xAuthToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - merchant_id
 *               - settlement_amount
 *               - settlement_type
 *             properties:
 *               merchant_id:
 *                 type: string
 *                 description: ID of the merchant for settlement
 *                 example: "merchant_123"
 *               settlement_amount:
 *                 type: number
 *                 description: Amount to be settled
 *                 example: 5000.50
 *               settlement_type:
 *                 type: string
 *                 enum: [instant, scheduled, bulk]
 *                 description: Type of settlement
 *                 example: "scheduled"
 *               settlement_date:
 *                 type: string
 *                 format: date
 *                 description: Date for settlement processing
 *               bank_details:
 *                 type: object
 *                 properties:
 *                   account_number:
 *                     type: string
 *                   ifsc_code:
 *                     type: string
 *                   bank_name:
 *                     type: string
 *               notes:
 *                 type: string
 *                 description: Additional notes for the settlement
 *     responses:
 *       201:
 *         description: Settlement created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid request data
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
  '/create-settlement',
  [isAuthenticated, authorized(AccessRoles.SETTLEMENT)],
  tryCatchHandler(createSettlementController),
);

/**
 * @swagger
 * /settlement/update-settlement/{id}:
 *   put:
 *     summary: Update settlement details
 *     description: Updates an existing settlement record with new information
 *     tags: [Settlements]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the settlement to update
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               settlement_amount:
 *                 type: number
 *                 description: Updated settlement amount
 *               settlement_status:
 *                 type: string
 *                 enum: [pending, processing, completed, failed, cancelled]
 *                 description: Updated settlement status
 *               settlement_date:
 *                 type: string
 *                 format: date
 *                 description: Updated settlement date
 *               bank_details:
 *                 type: object
 *                 properties:
 *                   account_number:
 *                     type: string
 *                   ifsc_code:
 *                     type: string
 *                   bank_name:
 *                     type: string
 *               notes:
 *                 type: string
 *                 description: Updated notes
 *               failure_reason:
 *                 type: string
 *                 description: Reason for failure (if applicable)
 *     responses:
 *       200:
 *         description: Settlement updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Settlement not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
router.put(
  '/update-settlement/:id',
  [isAuthenticated, authorized(AccessRoles.SETTLEMENT)],
  tryCatchHandler(updateSettlementController),
);

/**
 * @swagger
 * /settlement/delete-settlement/{id}:
 *   delete:
 *     summary: Delete settlement
 *     description: Soft deletes a settlement record (marks as deleted while preserving audit trail)
 *     tags: [Settlements]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the settlement to delete
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Settlement deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Settlement not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/delete-settlement/:id',
  [isAuthenticated, authorized(AccessRoles.SETTLEMENT)],
  tryCatchHandler(deleteSettlementController),
);

export default router;
