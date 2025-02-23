import express from "express";
import tryCatchHandler from "../../utils/tryCatchHandler.js";
import { getMerchantReportService, getPayInReportService, getPayOutReportService, getVendorReportService } from "./reportsService.js";
import { authorized, isAuthenticated } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';

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
router.post('/get-all-payouts', [isAuthenticated, authorized(AccessRoles.REPORT)], tryCatchHandler(getPayOutReportService));

/**
 * @swagger
 * /reports/get-all-payins:
 *   get:
 *     summary: Get all pay-in transactions
 *     description: Fetches all pay-in data from the system.
 *     tags: [Reports]
 *     responses:
 *       200:
 *         description: List of all pay-ins.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 456
 *                   amount:
 *                     type: number
 *                     example: 1000.00
 *       500:
 *         description: Server error
 */
router.post('/get-all-payins',[isAuthenticated, authorized(AccessRoles.REPORT)], tryCatchHandler(getPayInReportService));

/**
 * @swagger
 * /reports/get-all-merchants:
 *   get:
 *     summary: Get all merchants
 *     description: Fetches a list of all merchants.
 *     tags: [Reports]
 *     responses:
 *       200:
 *         description: List of all merchants.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 789
 *                   name:
 *                     type: string
 *                     example: "Merchant A"
 *       500:
 *         description: Server error
 */
router.get('/get-all-merchants',[isAuthenticated, authorized(AccessRoles.REPORT)], tryCatchHandler(getMerchantReportService));

/**
 * @swagger
 * /reports/get-all-vendors:
 *   get:
 *     summary: Get all vendors
 *     description: Fetches a list of all vendors.
 *     tags: [Reports]
 *     responses:
 *       200:
 *         description: List of all vendors.
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
 *                     example: "VEND001"
 *       500:
 *         description: Server error
 */
router.get('/get-all-vendors',[isAuthenticated, authorized(AccessRoles.REPORT)], tryCatchHandler(getVendorReportService));

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
 *         description: Vendor code to filter reports.
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         required: false
 *         description: Start date (optional).
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         required: false
 *         description: End date (optional).
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
 *         description: Invalid request parameters.
 *       500:
 *         description: Server error.
 */
router.get('/weekly-vendor-report', [isAuthenticated, authorized(AccessRoles.REPORT)], tryCatchHandler(getVendorReportService));

export default router;
