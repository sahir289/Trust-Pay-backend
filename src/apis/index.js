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
// Cron import removed - crons run in dedicated cron-worker.js process
import cron from '../cron/index.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpecs } from '../../swaggerConfig.js';
import resetHistory from './resetHistory/index.js';
import checkUtr from './checkutr/index.js';
import common from './common/index.js';
import beneficiaryAccounts from './beneficiaryAccounts/index.js';
import dashboardReport from './dashboardReport/index.js';
import webhooks from './webhooks/index.js';
import twoFactor from './twoFactor/index.js';
import settings from './settings/index.js';
import walletBalance from './walletBalance/index.js';
import { getVersion } from '../../version.js';
import { globalRateLimitMiddleware } from '../middlewares/rateLimiter.js';
import v2Router from './v2/index.js';
// import notifications from './notifications/index.js';

const parentRouter = express.Router();
const router = express.Router();
parentRouter.use('/v1', router);
// v2 API surface — additive and backward-compatible. /v1 above is unchanged.
parentRouter.use('/v2', v2Router);

// Apply authorization middleware for specific routes
router.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));
router.get('/version', async (req, res) => {
	await getVersion(req, res);
});
router.use(globalRateLimitMiddleware);
router.use('/payIn', payIn);
router.use('/users', users);
router.use('/merchants', merchants);
router.use('/vendors', vendors);
router.use('/chargeBacks', chargeBacks);
router.use('/roles', roles);
router.use('/calculation', calculation);
router.use('/designation', designation);
router.use('/bankDetails', bankaccount);
router.use('/bankResponse', bankResponse);
router.use('/company', company);
router.use('/settlement', settlement);
router.use('/userHierarchy', userHierarchy);
router.use('/payOut', payOut);
router.use('/reports', reports);
router.use('/checkUtr', checkUtr);
router.use('/resetHistory', resetHistory);
router.use('/beneficiaryAccounts', beneficiaryAccounts);
// Public routes (no authorization required)
router.use('/ping', ping);
router.use('/auth', auth);
router.use('/complaints', complaints);
// Cron route removed - crons run in dedicated cron-worker.js process
router.use('/cron', cron);
router.use('/common', common);
router.use('/dashboardReport', dashboardReport);
router.use('/webhook', webhooks);
router.use('/walletBalance', walletBalance);
router.use('/2fa', twoFactor);
router.use('/system-settings', settings);

// router.use('/notifications', notifications);

export default parentRouter;
