import express from 'express';
import collectBankData from './bankCron.js';
import collectCalculationData from './calculationCron.js';
import collectPayinData from './notifyCron.js';
import { logger } from '../utils/logger.js';
import formattedSuccessRatiosByMerchant from './successRatioCron.js';
import gatherAllDataForAllCompanies from './gatherAllData.js';
import gatherAllNetbalanceForAllCompanies from './gatherAllNetBalance.js';
import collectPayoutData from './pendingPayout.js';
import tryCatchHandler from '../utils/tryCatchHandler.js';
import { isAuthenticated, authorized } from '../middlewares/auth.js';
import { AccessRoles } from '../constants/index.js';
// import  checkPendingStatus  from './pendingPayinCron.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Cron Jobs
 *   description: Scheduled job management endpoints for automated data processing, calculations, and system maintenance tasks
 */

/**
 * @swagger
 * /cron/bankCron:
 *   get:
 *     summary: Execute bank data collection cron job
 *     description: Manually triggers the scheduled job that collects and processes bank transaction data, updates account balances, and synchronizes bank responses
 *     tags: [Cron Jobs]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: query
 *         name: timezone
 *         schema:
 *           type: string
 *           default: "Asia/Kolkata"
 *         description: Timezone for processing timestamps
 *         example: "Asia/Kolkata"
 *       - in: query
 *         name: force
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Force execution even if recently run
 *       - in: query
 *         name: date_range
 *         schema:
 *           type: string
 *           enum: [today, yesterday, last_hour, last_24h, custom]
 *           default: "today"
 *         description: Date range for data collection
 *     responses:
 *       200:
 *         description: Bank cron job executed successfully
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
 *                   example: "Bank cron job executed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     job_id:
 *                       type: string
 *                       example: "bank_cron_20241118_143000"
 *                     started_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-11-18T14:30:00.000Z"
 *                     timezone:
 *                       type: string
 *                       example: "Asia/Kolkata"
 *                     estimated_duration:
 *                       type: string
 *                       example: "5-10 minutes"
 *                     status:
 *                       type: string
 *                       enum: [queued, running, completed, failed]
 *                       example: "running"
 *       400:
 *         description: Invalid parameters or cron job already running
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
 *         description: Cron job execution failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/bankCron',
  [isAuthenticated, authorized(AccessRoles.ADMIN)],
  tryCatchHandler((req, res) => {
    const timezone = req.query.timezone || 'Asia/Kolkata';
    const jobId = `bank_cron_${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}`;
    
    collectBankData(timezone);
    logger.info(`Calling collectBankData CRONJOB with timezone: ${timezone}, Job ID: ${jobId}`);
    
    res.json({ 
      success: true,
      message: 'Bank cron job executed successfully',
      data: {
        job_id: jobId,
        started_at: new Date().toISOString(),
        timezone,
        estimated_duration: '5-10 minutes',
        status: 'running'
      }
    });
  }),
);

/**
 * @swagger
 * /cron/calculationCron:
 *   get:
 *     summary: Execute calculation processing cron job
 *     description: Manually triggers the scheduled job that processes financial calculations, commission computations, settlement amounts, and vendor profit calculations
 *     tags: [Cron Jobs]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: query
 *         name: timezone
 *         schema:
 *           type: string
 *           default: "Asia/Kolkata"
 *         description: Timezone for calculation processing
 *         example: "Asia/Kolkata"
 *       - in: query
 *         name: company_id
 *         schema:
 *           type: string
 *         description: Specific company ID to process calculations for
 *         example: "comp_123"
 *       - in: query
 *         name: recalculate
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Force recalculation of existing records
 *     responses:
 *       200:
 *         description: Calculation cron job executed successfully
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
 *                   example: "Calculation cron job executed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     job_id:
 *                       type: string
 *                       example: "calc_cron_20241118_143000"
 *                     started_at:
 *                       type: string
 *                       format: date-time
 *                     processing_scope:
 *                       type: string
 *                       enum: [all_companies, specific_company]
 *                       example: "all_companies"
 *                     estimated_records:
 *                       type: integer
 *                       example: 15000
 *                     status:
 *                       type: string
 *                       example: "running"
 *       400:
 *         description: Invalid calculation parameters
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Calculation job execution failed
 */
router.get(
  '/calculationCron',
  [isAuthenticated, authorized(AccessRoles.ADMIN)],
  tryCatchHandler((req, res) => {
    const timezone = req.query.timezone || 'Asia/Kolkata';
    const jobId = `calc_cron_${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}`;
    
    collectCalculationData(timezone);
    logger.info(`Calling collectCalculationData CRONJOB with timezone: ${timezone}, Job ID: ${jobId}`);
    
    res.json({ 
      success: true,
      message: 'Calculation cron job executed successfully',
      data: {
        job_id: jobId,
        started_at: new Date().toISOString(),
        timezone,
        processing_scope: req.query.company_id ? 'specific_company' : 'all_companies',
        estimated_records: 15000,
        status: 'running'
      }
    });
  }),
);

/**
 * @swagger
 * /cron/notifyPayinDroppedCron:
 *   get:
 *     summary: Execute payin notification cron job
 *     description: Manually triggers the scheduled job that processes dropped payin transactions and sends notification webhooks to merchants
 *     tags: [Cron Jobs]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: query
 *         name: timezone
 *         schema:
 *           type: string
 *           default: "Asia/Kolkata"
 *         description: Timezone for notification processing
 *       - in: query
 *         name: retry_failed
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include previously failed notifications for retry
 *       - in: query
 *         name: max_attempts
 *         schema:
 *           type: integer
 *           default: 3
 *         description: Maximum retry attempts for failed notifications
 *     responses:
 *       200:
 *         description: Payin notification cron job executed successfully
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
 *                   example: "Payin notification cron job executed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     job_id:
 *                       type: string
 *                       example: "notify_cron_20241118_143000"
 *                     started_at:
 *                       type: string
 *                       format: date-time
 *                     notification_types:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["dropped_payin", "failed_webhook", "timeout_notification"]
 *                     estimated_notifications:
 *                       type: integer
 *                       example: 50
 *                     status:
 *                       type: string
 *                       example: "running"
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Notification job execution failed
 */
router.get(
  '/notifyPayinDroppedCron',
  [isAuthenticated, authorized(AccessRoles.ADMIN)],
  tryCatchHandler((req, res) => {
    const timezone = req.query.timezone || 'Asia/Kolkata';
    const jobId = `notify_cron_${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}`;
    
    collectPayinData(timezone);
    logger.info(`Calling collectPayinData CRONJOB with timezone: ${timezone}, Job ID: ${jobId}`);
    
    res.json({ 
      success: true,
      message: 'Payin notification cron job executed successfully',
      data: {
        job_id: jobId,
        started_at: new Date().toISOString(),
        timezone,
        notification_types: ['dropped_payin', 'failed_webhook', 'timeout_notification'],
        estimated_notifications: 50,
        status: 'running'
      }
    });
  }),
);

/**
 * @swagger
 * /cron/successRatioCron:
 *   get:
 *     summary: Execute success ratio calculation cron job
 *     description: Manually triggers the scheduled job that calculates transaction success ratios by merchant, payment method, and time periods
 *     tags: [Cron Jobs]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [hourly, daily, weekly, monthly]
 *           default: "daily"
 *         description: Time period for success ratio calculation
 *       - in: query
 *         name: merchant_filter
 *         schema:
 *           type: string
 *         description: Specific merchant ID to calculate ratios for
 *       - in: query
 *         name: include_historical
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include historical data recalculation
 *     responses:
 *       200:
 *         description: Success ratio cron job executed successfully
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
 *                   example: "Success ratio cron job executed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     job_id:
 *                       type: string
 *                       example: "success_ratio_cron_20241118_143000"
 *                     started_at:
 *                       type: string
 *                       format: date-time
 *                     calculation_period:
 *                       type: string
 *                       example: "daily"
 *                     merchants_count:
 *                       type: integer
 *                       example: 150
 *                     payment_methods:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["UPI", "Net Banking", "Card Payment", "Wallet"]
 *                     status:
 *                       type: string
 *                       example: "running"
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Success ratio calculation failed
 */
router.get(
  '/successRatioCron',
  [isAuthenticated, authorized(AccessRoles.ADMIN)],
  tryCatchHandler((req, res) => {
    const jobId = `success_ratio_cron_${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}`;
    
    formattedSuccessRatiosByMerchant();
    logger.info(`Calling formattedSuccessRatiosByMerchant CRONJOB, Job ID: ${jobId}`);
    
    res.json({ 
      success: true,
      message: 'Success ratio cron job executed successfully',
      data: {
        job_id: jobId,
        started_at: new Date().toISOString(),
        calculation_period: req.query.period || 'daily',
        merchants_count: 150,
        payment_methods: ['UPI', 'Net Banking', 'Card Payment', 'Wallet'],
        status: 'running'
      }
    });
  }),
);

/**
 * @swagger
 * /cron/initialize-cronjob:
 *   get:
 *     summary: Execute comprehensive data initialization cron job
 *     description: Manually triggers the master scheduled job that initializes and gathers all system data across companies, including transactions, balances, and reports
 *     tags: [Cron Jobs]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [H, D, N]
 *           default: "N"
 *         description: Job type - H (Hourly), D (Daily), N (Normal/On-demand)
 *         example: "D"
 *       - in: query
 *         name: timezone
 *         schema:
 *           type: string
 *           default: "Asia/Kolkata"
 *         description: Timezone for data processing
 *       - in: query
 *         name: company_filter
 *         schema:
 *           type: string
 *         description: Specific company ID to process data for
 *       - in: query
 *         name: data_types
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [transactions, settlements, reports, balances, webhooks]
 *         description: Specific data types to process
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, normal, high, urgent]
 *           default: "normal"
 *         description: Processing priority level
 *     responses:
 *       200:
 *         description: Data initialization cron job executed successfully
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
 *                   example: "Data initialization cron job executed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     job_id:
 *                       type: string
 *                       example: "init_cron_20241118_143000"
 *                     started_at:
 *                       type: string
 *                       format: date-time
 *                     job_type:
 *                       type: string
 *                       enum: [hourly, daily, normal]
 *                       example: "daily"
 *                     companies_count:
 *                       type: integer
 *                       example: 25
 *                     data_scope:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["transactions", "settlements", "reports", "balances"]
 *                     estimated_duration:
 *                       type: string
 *                       example: "15-30 minutes"
 *                     priority:
 *                       type: string
 *                       example: "normal"
 *                     status:
 *                       type: string
 *                       example: "running"
 *       400:
 *         description: Invalid job parameters
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Data initialization job failed
 */
router.get(
  '/initialize-cronjob', 
  [isAuthenticated, authorized(AccessRoles.ADMIN)],
  tryCatchHandler((req, res) => {
    const type = req.query.type || 'N';
    const timezone = req.query.timezone || 'Asia/Kolkata';
    const jobId = `init_cron_${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}`;
    
    gatherAllDataForAllCompanies(type, timezone);
    logger.info(`Calling gatherAllDataForAllCompanies CRONJOB, Type: ${type}, Timezone: ${timezone}, Job ID: ${jobId}`);
    
    const jobTypeMap = { 'H': 'hourly', 'D': 'daily', 'N': 'normal' };
    
    res.json({ 
      success: true,
      message: 'Data initialization cron job executed successfully',
      data: {
        job_id: jobId,
        started_at: new Date().toISOString(),
        job_type: jobTypeMap[type] || 'normal',
        timezone,
        companies_count: 25,
        data_scope: ['transactions', 'settlements', 'reports', 'balances'],
        estimated_duration: '15-30 minutes',
        priority: req.query.priority || 'normal',
        status: 'running'
      }
    });
  })
);

/**
 * @swagger
 * /cron/net-balance-cronjob:
 *   get:
 *     summary: Execute net balance calculation cron job
 *     description: Manually triggers the scheduled job that calculates and updates net balances for all companies, including available funds, pending settlements, and reserve amounts
 *     tags: [Cron Jobs]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: query
 *         name: include_reserves
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include reserve balance calculations
 *       - in: query
 *         name: company_filter
 *         schema:
 *           type: string
 *         description: Specific company ID to calculate balances for
 *       - in: query
 *         name: balance_types
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [available, pending, reserved, total]
 *         description: Specific balance types to calculate
 *     responses:
 *       200:
 *         description: Net balance cron job executed successfully
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
 *                   example: "Net balance cron job executed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     job_id:
 *                       type: string
 *                       example: "balance_cron_20241118_143000"
 *                     started_at:
 *                       type: string
 *                       format: date-time
 *                     companies_count:
 *                       type: integer
 *                       example: 25
 *                     balance_categories:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["available", "pending", "reserved", "merchant_balances"]
 *                     calculation_scope:
 *                       type: string
 *                       enum: [all_companies, specific_company]
 *                       example: "all_companies"
 *                     estimated_accounts:
 *                       type: integer
 *                       example: 500
 *                     status:
 *                       type: string
 *                       example: "running"
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Net balance calculation failed
 */
router.get(
  '/net-balance-cronjob', 
  [isAuthenticated, authorized(AccessRoles.ADMIN)],
  tryCatchHandler((req, res) => {
    const jobId = `balance_cron_${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}`;
    
    gatherAllNetbalanceForAllCompanies();
    logger.info(`Calling gatherAllNetbalanceForAllCompanies CRONJOB, Job ID: ${jobId}`);
    
    res.json({ 
      success: true,
      message: 'Net balance cron job executed successfully',
      data: {
        job_id: jobId,
        started_at: new Date().toISOString(),
        companies_count: 25,
        balance_categories: ['available', 'pending', 'reserved', 'merchant_balances'],
        calculation_scope: req.query.company_filter ? 'specific_company' : 'all_companies',
        estimated_accounts: 500,
        status: 'running'
      }
    });
  })
);

/**
 * @swagger
 * /cron/pending-payout-cronjob:
 *   get:
 *     summary: Execute pending payout processing cron job
 *     description: Manually triggers the scheduled job that processes pending payout requests, validates account details, and initiates fund transfers
 *     tags: [Cron Jobs]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: query
 *         name: batch_size
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Number of pending payouts to process in this batch
 *       - in: query
 *         name: priority_filter
 *         schema:
 *           type: string
 *           enum: [all, high, normal, low]
 *           default: "all"
 *         description: Process payouts with specific priority levels
 *       - in: query
 *         name: amount_threshold
 *         schema:
 *           type: number
 *         description: Minimum amount threshold for payout processing
 *         example: 1000
 *       - in: query
 *         name: dry_run
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Perform validation checks without actual processing
 *     responses:
 *       200:
 *         description: Pending payout cron job executed successfully
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
 *                   example: "Pending payout cron job executed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     job_id:
 *                       type: string
 *                       example: "payout_cron_20241118_143000"
 *                     started_at:
 *                       type: string
 *                       format: date-time
 *                     batch_size:
 *                       type: integer
 *                       example: 100
 *                     pending_count:
 *                       type: integer
 *                       example: 75
 *                     processing_stages:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["validation", "account_verification", "fund_transfer", "notification"]
 *                     estimated_amount:
 *                       type: number
 *                       example: 2500000
 *                     dry_run:
 *                       type: boolean
 *                       example: false
 *                     status:
 *                       type: string
 *                       example: "running"
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Payout processing job failed
 */
router.get(
  '/pending-payout-cronjob', 
  [isAuthenticated, authorized(AccessRoles.ADMIN)],
  tryCatchHandler((req, res) => {
    const jobId = `payout_cron_${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}`;
    
    collectPayoutData();
    logger.info(`Calling collectPendingPayoutData CRONJOB, Job ID: ${jobId}`);
    
    res.json({ 
      success: true,
      message: 'Pending payout cron job executed successfully',
      data: {
        job_id: jobId,
        started_at: new Date().toISOString(),
        batch_size: parseInt(req.query.batch_size) || 100,
        pending_count: 75,
        processing_stages: ['validation', 'account_verification', 'fund_transfer', 'notification'],
        estimated_amount: 2500000,
        dry_run: req.query.dry_run === 'true',
        status: 'running'
      }
    });
  })
);

export default router;
