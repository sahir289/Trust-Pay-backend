import express from "express";
import tryCatchHandler from "../../utils/tryCatchHandler.js";
import { getMerchantReportService, getPayInReportService, getPayOutReportService, getVendorReportService } from "./reportsService.js";
import { isAuthenticated } from '../../middlewares/auth.js';

/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: API endpoints related to payout and vendor reports
 */

const router = express.Router();

/**
 * @swagger
 * /reports/get-all-payouts:
 *   get:
 *     summary: Get all payout transactions
 *     description: Fetches all payout data from the system.
 *     tags: [Reports]
 *     responses:
 *       200:
 *         description: List of all payouts.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 123
 *                   vendorCode:
 *                     type: string
 *                     example: "ABC123"
 *                   amount:
 *                     type: number
 *                     example: 5000.50
 *       500:
 *         description: Server error
 */
router.post('/get-all-payouts', isAuthenticated, tryCatchHandler(getPayOutReportService));
router.post('/get-all-payins',isAuthenticated, tryCatchHandler(getPayInReportService));
router.get('/get-all-merchants',isAuthenticated, tryCatchHandler(getMerchantReportService));
router.get('/get-all-vendors',isAuthenticated, tryCatchHandler(getVendorReportService));

/**
 * @swagger
 * /reports/weekly-vendor-report:
 *   get:
 *     summary: Get weekly vendor report
 *     description: Retrieves a weekly summary of vendor account reports.
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: vendorCode
 *         schema:
 *           type: string
 *         required: true
 *         description: Vendor code to filter reports
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         required: false
 *         description: Start date (optional)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         required: false
 *         description: End date (optional)
 *     responses:
 *       200:
 *         description: Weekly vendor report data.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   vendorCode:
 *                     type: string
 *                     example: "ABC123"
 *                   totalPayout:
 *                     type: number
 *                     example: 10000.00
 *                   totalPayin:
 *                     type: number
 *                     example: 15000.00
 *       400:
 *         description: Invalid request parameters
 *       500:
 *         description: Server error
 */

export default router;
