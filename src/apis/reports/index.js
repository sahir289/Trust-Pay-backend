import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  getMerchantReportService,
  getPayInReportService,
  getPayOutReportService,
  getVendorReportService,
} from './reportsService.js';
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
router.get(
  '/get-payouts-report',
  isAuthenticated,
  tryCatchHandler(getPayOutReportService),
);

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
router.get(
  '/get-payins-reports',
  isAuthenticated,
  tryCatchHandler(getPayInReportService),
);

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
router.get(
  '/get-merchants-reports',
  isAuthenticated,
  tryCatchHandler(getMerchantReportService),
);

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
router.get(
  '/get-vendors-reports',
  isAuthenticated,
  tryCatchHandler(getVendorReportService),
);

export default router;
