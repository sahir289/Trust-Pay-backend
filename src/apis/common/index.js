import express from 'express';
import { getTotalCount } from './commonController.js';
import { isAuthenticated, authorized } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Common
 *   description: Common utility API endpoints for system statistics and cross-module operations
 */

/**
 * @swagger
 * /common/count/{tableName}:
 *   get:
 *     summary: Get record count for module
 *     description: Returns the total count of records for a specified module or table, with optional role-based filtering
 *     tags:
 *       - Common
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: tableName
 *         required: true
 *         schema:
 *           type: string
 *           enum: [users, merchants, vendors, transactions, payins, payouts, settlements, complaints, chargebacks]
 *         description: Name of the module/table to get count for
 *         example: "users"
 *       - in: query
 *         name: role
 *         required: false
 *         schema:
 *           type: string
 *           enum: [admin, merchant, vendor, user]
 *         description: Filter count by user role (optional)
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [active, inactive, pending, blocked]
 *         description: Filter count by record status (optional)
 *       - in: query
 *         name: date_from
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering records (optional)
 *       - in: query
 *         name: date_to
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering records (optional)
 *     responses:
 *       200:
 *         description: Record count retrieved successfully
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
 *                   example: "Count retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *                       example: 1250
 *                     table_name:
 *                       type: string
 *                       example: "users"
 *                     filters_applied:
 *                       type: object
 *                       description: Summary of filters that were applied
 *       400:
 *         description: Invalid table name or parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
  '/count/:tableName',
  [isAuthenticated, authorized(AccessRoles.ALL)],
  getTotalCount,
);

export default router;
