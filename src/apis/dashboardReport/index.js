import express from 'express';
import gatherCompanyData from './dashboardReportController.js';
import tryCatchHandler from '../../utils/tryCatchHandler.js';

// import  checkPendingStatus  from './pendingPayinCron.js';
const router = express.Router();

/**
 * @swagger
 * /bankCron:
 *   get:
 *     summary: Triggers the bank cron job
 *     description: Executes the cron job that collects and processes bank data.
 *     tags:
 *       - Cron Jobs
 *     responses:
 *       200:
 *         description: Bcron job successfully executed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: " cron job executed successfully."
 */
router.get(
  '/', tryCatchHandler(gatherCompanyData)
);



export default router;
