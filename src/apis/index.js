import express from 'express';
import ping from './ping/index.js';
import auth from './auth/index.js';
import users from './users/index.js';
import merchants from './merchants/index.js';
import vendors from './vendors/index.js';
import chargeBacks from './chargeBacks/index.js';
import roles from './roles/index.js';
import calculation from './calculation/index.js';
import payIn from './payIn/index.js';
import designation from './designation/index.js';
import bankaccount from './bankAccounts/index.js';
import bankResponse from './bankResponse/index.js';
import company from './company/index.js';
import settlement from './settlement/index.js';
import userHierarchy from './userHierarchy/index.js';
import payOut from './payOut/index.js';
import complaints from './complaints/index.js';
import reports from './reports/index.js';
import cron from '../cron/index.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpecs, swaggerUIOptions } from '../../swaggerConfig.js';
import resetHistory from './resetHistory/index.js';
import checkUtr from './checkutr/index.js';
import common from './common/index.js';
import beneficiaryAccounts from './beneficiaryAccounts/index.js';
import consumeBankResponseRouter from './consume-bank-response.js';
import dashboardReport from './dashboardReport/index.js';
import webhooks from './webhooks/index.js';
import cashfreeWebhook from './cashfreeWebhook/index.js';
import { getVersion } from '../../version.js';
import { isAuthenticated } from '../middlewares/auth.js';
// import notifications from './notifications/index.js';

const parentRouter = express.Router();
const router = express.Router();
const privateRouter = express.Router();

parentRouter.use('/v1', router);

// Apply authentication middleware to all private routes
privateRouter.use(isAuthenticated);

// ==========================
// PUBLIC ROUTES (No authentication required)
// ==========================

// Health check and system status (always public)
router.use('/ping', ping);

// Authentication endpoints (public by nature)
router.use('/auth', auth);

// API documentation (public for development)
router.use('/api-docs', swaggerUi.serve);
router.get('/api-docs', swaggerUi.setup(swaggerSpecs, swaggerUIOptions));

// Version endpoint (public for monitoring)
router.get('/version', getVersion);

// Webhook endpoints (public for external services)
router.use('/webhook', webhooks);
router.use('/cashfreeWebhook', cashfreeWebhook);

// ==========================
// PRIVATE ROUTES (Authentication required)
// ==========================

// User Management & Administration
router.use('/users', privateRouter, users);
router.use('/roles', privateRouter, roles);
router.use('/designation', privateRouter, designation);
router.use('/company', privateRouter, company);
router.use('/userHierarchy', privateRouter, userHierarchy);

// Financial Operations
router.use('/payIn', privateRouter, payIn);
router.use('/payOut', privateRouter, payOut);
router.use('/calculation', privateRouter, calculation);
router.use('/settlement', privateRouter, settlement);

// Merchant & Vendor Management
router.use('/merchants', privateRouter, merchants);
router.use('/vendors', privateRouter, vendors);

// Banking & Financial Data
router.use('/bankDetails', privateRouter, bankaccount);
router.use('/bankResponse', privateRouter, bankResponse);
router.use('/beneficiaryAccounts', privateRouter, beneficiaryAccounts);

// Transaction Management
router.use('/chargeBacks', privateRouter, chargeBacks);
router.use('/resetHistory', privateRouter, resetHistory);
router.use('/checkUtr', privateRouter, checkUtr);

// Reporting & Analytics
router.use('/reports', privateRouter, reports);
router.use('/dashboardReport', privateRouter, dashboardReport);
router.use('/common', privateRouter, common);

// Support & Operations
router.use('/complaints', privateRouter, complaints);

// System Administration (High Security)
router.use('/cron', privateRouter, cron);
router.use('/consume-bank-response', privateRouter, consumeBankResponseRouter);

// Commented out routes (enable when needed)
// router.use('/notifications', privateRouter, notifications);

export default parentRouter;
