import express from 'express';
import gatherCompanyData from './dashboardReportController.js';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { setSuperAdminTenant, authorized } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';

const router = express.Router();

/**
 * @swagger
 * /dashboardReport:
 *   get:
 *     summary: Gather company dashboard data
 *     description: Triggers the dashboard data gathering and Telegram report for a company.
 *     tags:
 *       - Dashboard Report
 *     responses:
 *       200:
 *         description: Dashboard report sent successfully.
 */
router.get(
  '/', authorized(AccessRoles.ALL), setSuperAdminTenant, tryCatchHandler(gatherCompanyData)
);

export default router;
