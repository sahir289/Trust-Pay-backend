import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';

import { isAuthenticated, authorized } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';
import {
  createResetHistory,
  deleteResetHistory,
  // getResetHistory,
  updateResetHistory,
  getResetHistoryBySearch,
} from './resetController.js';
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Reset History
 *   description: API endpoints for managing system reset history and data recovery operations
 */

/**
 * @swagger
 * /resetHistory:
 *   get:
 *     summary: Search reset history records
 *     description: Retrieves reset history records based on search criteria with pagination
 *     tags:
 *       - Reset History
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for filtering records
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
 *         description: Reset history records retrieved successfully
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
  [isAuthenticated, authorized(AccessRoles.RESET_DATA_HISTORY)],
  tryCatchHandler(getResetHistoryBySearch),
);
/**
 * @swagger
 * /resetHistory/create-reset-history:
 *   post:
 *     summary: Create a new reset history record
 *     description: Creates a new reset history record for tracking system reset operations
 *     tags:
 *       - Reset History
 *     security:
 *       - xAuthToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - operation_type
 *               - description
 *             properties:
 *               operation_type:
 *                 type: string
 *                 enum: [data_reset, system_reset, partial_reset, full_reset]
 *                 description: Type of reset operation
 *                 example: "data_reset"
 *               description:
 *                 type: string
 *                 description: Detailed description of the reset operation
 *                 example: "Reset user transaction data for maintenance"
 *               affected_module:
 *                 type: string
 *                 description: Module or system component affected by the reset
 *                 example: "user_transactions"
 *               reason:
 *                 type: string
 *                 description: Reason for performing the reset
 *                 example: "Data corruption detected"
 *     responses:
 *       201:
 *         description: Reset history record created successfully
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
  '/create-reset-history',
  [isAuthenticated, authorized(AccessRoles.RESET_DATA_HISTORY)],
  tryCatchHandler(createResetHistory),
);

/**
 * @swagger
 * /resetHistory/update-reset-history/{id}:
 *   post:
 *     summary: Update reset history record
 *     description: Updates an existing reset history record with new information
 *     tags:
 *       - Reset History
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the reset history record to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               operation_type:
 *                 type: string
 *                 enum: [data_reset, system_reset, partial_reset, full_reset]
 *                 description: Updated operation type
 *               description:
 *                 type: string
 *                 description: Updated description
 *               status:
 *                 type: string
 *                 enum: [pending, in_progress, completed, failed]
 *                 description: Current status of the reset operation
 *               completion_notes:
 *                 type: string
 *                 description: Notes about the completion or failure
 *     responses:
 *       200:
 *         description: Reset history record updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Reset history record not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/update-reset-history/:id',
  [isAuthenticated, authorized(AccessRoles.RESET_DATA_HISTORY)],
  tryCatchHandler(updateResetHistory),
);

/**
 * @swagger
 * /resetHistory/delete-reset-history/{id}:
 *   delete:
 *     summary: Delete reset history record
 *     description: Deletes a reset history record by ID (soft delete to maintain audit trail)
 *     tags:
 *       - Reset History
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the reset history record to delete
 *     responses:
 *       200:
 *         description: Reset history record deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Reset history record not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/delete-reset-history/:id',
  [isAuthenticated, authorized(AccessRoles.RESET_DATA_HISTORY)],
  tryCatchHandler(deleteResetHistory),
);

export default router;
