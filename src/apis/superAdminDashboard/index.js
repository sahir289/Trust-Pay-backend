import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  getSuperAdminOverview,
  getTransactionRevenueSummary,
  getPayinVolumeMonthlySummary,
  getPayinVolumeDailyGraph,
  getTopBanks,
} from './superAdminDashboardController.js';
import { isAuthenticated, authorized, setSuperAdminTenant } from '../../middlewares/auth.js';
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
  [isAuthenticated, authorized(AccessRoles.SUPER_ADMIN), setSuperAdminTenant],
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
  [isAuthenticated, authorized(AccessRoles.SUPER_ADMIN), setSuperAdminTenant],
  tryCatchHandler(getTransactionRevenueSummary),
);

/**
 * @swagger
 * /superAdminDashboard/payin-volume-monthly:
 *   get:
 *     summary: Payin Volume Monthly Summary
 *     description: Returns aggregated payin transaction volume (count & amount) for each of the last N months.
 *     tags:
 *       - Super Admin Dashboard
 *     parameters:
 *       - in: query
 *         name: months
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 24
 *           default: 6
 *         description: Number of months to include (default 6, max 24)
 *     responses:
 *       200:
 *         description: Monthly payin volume summary
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied — Super Admin only
 */
router.get(
  '/payin-volume-monthly',
  [isAuthenticated, authorized(AccessRoles.SUPER_ADMIN), setSuperAdminTenant],
  tryCatchHandler(getPayinVolumeMonthlySummary),
);

/**
 * @swagger
 * /superAdminDashboard/payin-volume-graph:
 *   get:
 *     summary: Payin Volume Daily Graph
 *     description: Returns daily payin transaction volume (count & amount) for a specific month.
 *     tags:
 *       - Super Admin Dashboard
 *     parameters:
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: string
 *           format: "YYYY-MM"
 *           example: "2026-09"
 *         description: Month to fetch data for (YYYY-MM format)
 *     responses:
 *       200:
 *         description: Daily payin volume graph data
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied — Super Admin only
 */
router.get(
  '/payin-volume-graph',
  [isAuthenticated, authorized(AccessRoles.SUPER_ADMIN), setSuperAdminTenant],
  tryCatchHandler(getPayinVolumeDailyGraph),
);

/**
 * @swagger
 * /superAdminDashboard/top-banks:
 *   get:
 *     summary: Top 5 Banks Summary
 *     description: Returns top banks ranked by transaction volume or count, showing basic bank info (bank_name, acc_holder_name) and transaction metrics (payin/payout counts and volume). Excludes balance and account numbers.
 *     tags:
 *       - Super Admin Dashboard
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-09-01"
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-09-17"
 *         description: End date (YYYY-MM-DD)
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 5
 *         description: Number of banks to return (default 5)
 *       - in: query
 *         name: sortBy
 *         required: false
 *         schema:
 *           type: string
 *           enum: [volume, count]
 *           default: volume
 *         description: Sort field (volume or count)
 *       - in: query
 *         name: sortOrder
 *         required: false
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Top banks summary data
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied — Super Admin only
 */
router.get(
  '/top-banks',
  [isAuthenticated, authorized(AccessRoles.SUPER_ADMIN), setSuperAdminTenant],
  tryCatchHandler(getTopBanks),
);

export default router;

