import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  createComplaints,
  deleteComplaints,
  getComplaints,
  getComplaintsById,
  updateComplaints,
} from './complaintsController.js';
import { authorized, isAuthenticated } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Complaints
 *   description: API endpoints for managing customer complaints and support tickets
 */

/**
 * @swagger
 * /complaints:
 *   get:
 *     summary: Get all complaints
 *     description: Retrieves all customer complaints with filtering and pagination options
 *     tags: [Complaints]
 *     security:
 *       - xAuthToken: []
 *     parameters:
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
 *           enum: [open, in_progress, resolved, closed]
 *         description: Filter by complaint status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         description: Filter by complaint priority
 *       - in: query
 *         name: complaint_type
 *         schema:
 *           type: string
 *         description: Filter by complaint category
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *         description: Filter by specific user
 *     responses:
 *       200:
 *         description: Complaints retrieved successfully
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
  [isAuthenticated, authorized(AccessRoles.COMPLAINTS)],
  tryCatchHandler(getComplaints),
);

/**
 * @swagger
 * /complaints/{id}:
 *   get:
 *     summary: Get complaint by ID
 *     description: Retrieves detailed information about a specific customer complaint
 *     tags: [Complaints]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the complaint to retrieve
 *     responses:
 *       200:
 *         description: Complaint details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Complaint not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:id',
  [isAuthenticated, authorized(AccessRoles.COMPLAINTS)],
  tryCatchHandler(getComplaintsById),
);

/**
 * @swagger
 * /complaints/create-complaint:
 *   post:
 *     summary: Create a new complaint
 *     description: Submits a new customer complaint to the system
 *     tags: [Complaints]
 *     security:
 *       - xAuthToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - complaint_type
 *               - description
 *               - priority
 *             properties:
 *               complaint_type:
 *                 type: string
 *                 enum: [technical_issue, payment_issue, account_issue, service_issue, billing_issue, security_concern, feature_request, other]
 *                 description: Category of the complaint
 *                 example: "payment_issue"
 *               title:
 *                 type: string
 *                 description: Brief title of the complaint
 *                 example: "Payment not processed"
 *               description:
 *                 type: string
 *                 description: Detailed description of the issue
 *                 example: "Payment was deducted from account but transaction shows as failed"
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 description: Priority level of the complaint
 *                 example: "high"
 *               affected_transaction_id:
 *                 type: string
 *                 description: ID of transaction related to the complaint (if applicable)
 *               contact_preference:
 *                 type: string
 *                 enum: [email, phone, sms, in_app]
 *                 description: Preferred method of contact for resolution
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: URLs or IDs of attached files or screenshots
 *     responses:
 *       201:
 *         description: Complaint created successfully
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
  '/create-complaint',
  [isAuthenticated, authorized(AccessRoles.COMPLAINTS)],
  tryCatchHandler(createComplaints),
);

/**
 * @swagger
 * /complaints/update-complaint/{id}:
 *   put:
 *     summary: Update complaint details
 *     description: Updates an existing complaint with new information, status changes, or resolution notes
 *     tags: [Complaints]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the complaint to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [open, in_progress, resolved, closed, escalated]
 *                 description: Updated complaint status
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 description: Updated priority level
 *               resolution_notes:
 *                 type: string
 *                 description: Notes about the resolution or current progress
 *               assigned_to:
 *                 type: string
 *                 description: ID of support agent assigned to the complaint
 *               estimated_resolution_date:
 *                 type: string
 *                 format: date
 *                 description: Estimated date for resolution
 *               internal_notes:
 *                 type: string
 *                 description: Internal notes for staff (not visible to customer)
 *               customer_satisfaction:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Customer satisfaction rating (1-5)
 *     responses:
 *       200:
 *         description: Complaint updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Complaint not found
 *       500:
 *         description: Internal server error
 */
router.put(
  '/update-complaint/:id',
  [isAuthenticated, authorized(AccessRoles.COMPLAINTS)],
  tryCatchHandler(updateComplaints),
);

/**
 * @swagger
 * /complaints/delete-complaint/{id}:
 *   delete:
 *     summary: Delete complaint
 *     description: Soft deletes a complaint record (marks as deleted while preserving audit trail)
 *     tags: [Complaints]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the complaint to delete
 *     responses:
 *       200:
 *         description: Complaint deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Complaint not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/delete-complaint/:id',
  [isAuthenticated, authorized(AccessRoles.COMPLAINTS)],
  tryCatchHandler(deleteComplaints),
);

export default router;
