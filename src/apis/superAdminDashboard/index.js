import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  getSuperAdminOverview,
  getTransactionRevenueSummary,
} from './superAdminDashboardController.js';
import { isAuthenticated, authorized } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';

const router = express.Router();

/**
 * @swagger
 * /superAdminDashboard/overview:
 *   get:
 *     summary: Super Admin Dashboard Overview
 *     description: Returns platform-wide entity counts including total companies, merchants, vendors, users, and bank accounts.
 *     tags:
 *       - Super Admin Dashboard
 *     responses:
 *       200:
 *         description: Platform overview data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied — Super Admin only
 */
router.get(
  '/overview',
  [isAuthenticated, authorized(AccessRoles.SUPER_ADMIN)],
  tryCatchHandler(getSuperAdminOverview),
);

/**
 * @swagger
 * /superAdminDashboard/transaction-revenue-summary:
 *   get:
 *     summary: Transaction & Revenue Summary
 *     description: Returns aggregated transaction volumes, commissions, success/failed/dropped rates, and status breakdown for a date range.
 *     tags:
 *       - Super Admin Dashboard
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-09-01"
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-09-10"
 *         description: End date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Transaction & revenue summary data
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied — Super Admin only
 */
router.get(
  '/transaction-revenue-summary',
  [isAuthenticated, authorized(AccessRoles.SUPER_ADMIN)],
  tryCatchHandler(getTransactionRevenueSummary),
);

export default router;
