import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  createChargeBack,
  deleteChargeBack,
  getChargeBacks,
  updateChargeBack,
  getChargeBacksById,
  getChargeBacksBySearch,
  blockChargebackUser,
} from './chargeBackController.js';
import { authorized, isAuthenticated } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: ChargeBacks
 *   description: API endpoints for managing dispute chargebacks and transaction reversals
 */

/**
 * @swagger
 * /chargeBacks:
 *   get:
 *     summary: Search chargebacks
 *     description: Retrieves chargebacks based on search criteria with filtering and pagination
 *     tags: [ChargeBacks]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for filtering chargebacks
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
 *           enum: [pending, approved, rejected, processing]
 *         description: Filter by chargeback status
 *       - in: query
 *         name: reason_code
 *         schema:
 *           type: string
 *         description: Filter by chargeback reason code
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
 *         description: Chargebacks retrieved successfully
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
  [isAuthenticated, authorized(AccessRoles.CHARGE_BACK.GET)],
  tryCatchHandler(getChargeBacksBySearch),
);

/**
 * @swagger
 * /chargeBacks/reports:
 *   get:
 *     summary: Get chargeback reports
 *     description: Retrieves comprehensive chargeback analytics and reports
 *     tags: [ChargeBacks]
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
 *         description: Chargeback reports retrieved successfully
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
  '/reports',
  [isAuthenticated, authorized(AccessRoles.CHARGE_BACK.GET)],
  tryCatchHandler(getChargeBacks),
);
/**
 * @swagger
 * /chargeBacks/{id}:
 *   get:
 *     summary: Get chargeback by ID
 *     description: Retrieves detailed information about a specific chargeback case
 *     tags: [ChargeBacks]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the chargeback to retrieve
 *     responses:
 *       200:
 *         description: Chargeback details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Chargeback not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:id',
  [isAuthenticated, authorized(AccessRoles.CHARGE_BACK.GET)],
  tryCatchHandler(getChargeBacksById),
);

/**
 * @swagger
 * /chargeBacks/create-chargeback:
 *   post:
 *     summary: Create a new chargeback
 *     description: Initiates a new chargeback case for a disputed transaction
 *     tags: [ChargeBacks]
 *     security:
 *       - xAuthToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transaction_id
 *               - chargeback_amount
 *               - reason_code
 *               - description
 *             properties:
 *               transaction_id:
 *                 type: string
 *                 description: ID of the original transaction being disputed
 *                 example: "txn_123456789"
 *               chargeback_amount:
 *                 type: number
 *                 description: Amount being charged back
 *                 example: 100.50
 *               reason_code:
 *                 type: string
 *                 enum: [fraud, authorization, processing_error, consumer_dispute]
 *                 description: Standardized chargeback reason code
 *                 example: "fraud"
 *               description:
 *                 type: string
 *                 description: Detailed description of the chargeback reason
 *                 example: "Customer claims unauthorized transaction"
 *               evidence_documents:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: URLs or IDs of supporting evidence documents
 *               customer_id:
 *                 type: string
 *                 description: ID of the customer filing the chargeback
 *               merchant_id:
 *                 type: string
 *                 description: ID of the merchant being charged back
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 default: medium
 *                 description: Priority level for processing
 *     responses:
 *       201:
 *         description: Chargeback created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid request data or validation error
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
  '/create-chargeback',
  [isAuthenticated, authorized(AccessRoles.CHARGE_BACK.CREATE_DELETE)],
  tryCatchHandler(createChargeBack),
);

/**
 * @swagger
 * /chargeBacks/update-chargeback/{id}:
 *   put:
 *     summary: Update a chargeback
 *     description: Updates an existing chargeback in the system.
 *     tags: [ChargeBacks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the chargeback to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 description: The updated amount for the chargeback.
 *                 example: 150.00
 *               reason:
 *                 type: string
 *                 description: The updated reason for the chargeback.
 *                 example: "unauthorized transaction"
 *     responses:
 *       200:
 *         description: ChargeBack updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "ChargeBack updated successfully"
 *       400:
 *         description: Bad request (validation error).
 *       404:
 *         description: ChargeBack not found.
 *       500:
 *         description: Internal server error.
 */
/**
 * @swagger
 * /chargeBacks/update-chargeback/{id}:
 *   put:
 *     summary: Update chargeback details
 *     description: Updates an existing chargeback case with new information or status changes
 *     tags: [ChargeBacks]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the chargeback to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, under_review, approved, rejected, resolved]
 *                 description: Updated chargeback status
 *               chargeback_amount:
 *                 type: number
 *                 description: Updated chargeback amount
 *               resolution_notes:
 *                 type: string
 *                 description: Notes about the resolution or status change
 *               evidence_documents:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Additional evidence documents
 *               assigned_to:
 *                 type: string
 *                 description: ID of staff member assigned to handle the case
 *     responses:
 *       200:
 *         description: Chargeback updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Chargeback not found
 *       500:
 *         description: Internal server error
 */
router.put(
  '/update-chargeback/:id',
  [isAuthenticated, authorized(AccessRoles.CHARGE_BACK.UPDATE_READ)],
  tryCatchHandler(updateChargeBack),
);

/**
 * @swagger
 * /chargeBacks/blockuser-chargeback/{id}:
 *   put:
 *     summary: Block user related to chargeback
 *     description: Blocks a user account associated with a chargeback case to prevent further fraudulent activity
 *     tags: [ChargeBacks]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the chargeback case
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               block_reason:
 *                 type: string
 *                 description: Reason for blocking the user
 *                 example: "Multiple fraudulent chargeback claims"
 *               block_duration:
 *                 type: string
 *                 enum: [temporary, permanent]
 *                 description: Duration of the block
 *               unblock_date:
 *                 type: string
 *                 format: date
 *                 description: Date when temporary block should be lifted
 *     responses:
 *       200:
 *         description: User blocked successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Chargeback or user not found
 *       500:
 *         description: Internal server error
 */
router.put(
  '/blockuser-chargeback/:id',
  [isAuthenticated, authorized(AccessRoles.CHARGE_BACK.UPDATE_READ)],
  tryCatchHandler(blockChargebackUser),
);

/**
 * @swagger
 * /chargeBacks/delete-chargeback/{id}:
 *   delete:
 *     summary: Delete chargeback
 *     description: Soft deletes a chargeback case (marks as deleted while preserving audit trail)
 *     tags: [ChargeBacks]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the chargeback to delete
 *     responses:
 *       200:
 *         description: Chargeback deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Chargeback not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/delete-chargeback/:id',
  [isAuthenticated, authorized(AccessRoles.CHARGE_BACK.UPDATE_READ)],
  tryCatchHandler(deleteChargeBack),
);

export default router;
