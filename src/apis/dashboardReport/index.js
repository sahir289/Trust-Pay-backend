import express from 'express';
import gatherCompanyData from './dashboardReportController.js';
import tryCatchHandler from '../../utils/tryCatchHandler.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Dashboard Reports
 *   description: API endpoints for generating dashboard analytics and comprehensive business reports
 */

/**
 * @swagger
 * /dashboardReport:
 *   get:
 *     summary: Generate comprehensive dashboard report
 *     description: Retrieves comprehensive business analytics and metrics for dashboard display including transaction summaries, user statistics, and financial data
 *     tags:
 *       - Dashboard Reports
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: query
 *         name: date_range
 *         schema:
 *           type: string
 *           enum: [today, yesterday, last_7_days, last_30_days, last_90_days, custom]
 *         description: Predefined date range for the report
 *         example: "last_30_days"
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Custom start date (required if date_range is 'custom')
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Custom end date (required if date_range is 'custom')
 *       - in: query
 *         name: company_id
 *         schema:
 *           type: string
 *         description: Filter data by specific company/organization
 *       - in: query
 *         name: merchant_id
 *         schema:
 *           type: string
 *         description: Filter data by specific merchant
 *       - in: query
 *         name: include_metrics
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [transactions, revenue, users, settlements, chargebacks, success_rates]
 *         description: Specific metrics to include in the report
 *       - in: query
 *         name: granularity
 *         schema:
 *           type: string
 *           enum: [hourly, daily, weekly, monthly]
 *           default: daily
 *         description: Time granularity for trend data
 *     responses:
 *       200:
 *         description: Dashboard report generated successfully
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
 *                   example: "Dashboard report generated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total_transactions:
 *                           type: integer
 *                         total_revenue:
 *                           type: number
 *                         active_users:
 *                           type: integer
 *                         success_rate:
 *                           type: number
 *                     trends:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date
 *                           value:
 *                             type: number
 *                     comparisons:
 *                       type: object
 *                       description: Period-over-period comparisons
 *                     alerts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                           message:
 *                             type: string
 *                           severity:
 *                             type: string
 *       400:
 *         description: Invalid request parameters
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
  '/', 
  tryCatchHandler(gatherCompanyData)
);



export default router;
