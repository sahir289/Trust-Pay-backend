import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { isAuthenticated } from '../../middlewares/auth.js';
import {
  getClientsAccountReportController,
  getPayInReportController,
  getPayOutReportController,
} from './reportsController.js';

/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: API endpoints for generating comprehensive transaction and account reports
 */

const router = express.Router();

/**
 * @swagger
 * /reports/get-payouts-report:
 *   get:
 *     summary: Get payout transactions report
 *     description: Fetches comprehensive payout transaction reports with filtering and analytics
 *     tags: [Reports]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for report filtering
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for report filtering
 *       - in: query
 *         name: vendor_id
 *         schema:
 *           type: string
 *         description: Filter by specific vendor
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, failed]
 *         description: Filter by transaction status
 *     responses:
 *       200:
 *         description: Payout report generated successfully
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
  '/get-payouts-report',
  isAuthenticated,
  tryCatchHandler(getPayOutReportController),
);

/**
 * @swagger
 * /reports/get-payins-reports:
 *   get:
 *     summary: Get pay-in transactions report
 *     description: Fetches comprehensive pay-in transaction reports with analytics and filtering
 *     tags: [Reports]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for report filtering
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for report filtering
 *       - in: query
 *         name: merchant_id
 *         schema:
 *           type: string
 *         description: Filter by specific merchant
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, failed]
 *         description: Filter by transaction status
 *     responses:
 *       200:
 *         description: Pay-in report generated successfully
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
  '/get-payins-reports',
  isAuthenticated,
  tryCatchHandler(getPayInReportController),
);

/**
 * @swagger
 * /reports/get-accounts-reports:
 *   get:
 *     summary: Get client account reports
 *     description: Fetches comprehensive account reports for all clients with balance and transaction summaries
 *     tags: [Reports]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: query
 *         name: account_type
 *         schema:
 *           type: string
 *           enum: [merchant, vendor, admin]
 *         description: Filter by account type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, suspended]
 *         description: Filter by account status
 *       - in: query
 *         name: date_range
 *         schema:
 *           type: string
 *         description: Date range for account activity
 *     responses:
 *       200:
 *         description: Account reports generated successfully
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
  '/get-accounts-reports',
  isAuthenticated,
  tryCatchHandler(getClientsAccountReportController),
);

//handled same with above function

export default router;
