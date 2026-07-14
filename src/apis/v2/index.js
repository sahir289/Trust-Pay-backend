import express from 'express';
// import { auditLogMiddleware } from '../../middlewares/auditLog.js';
import { globalRateLimitMiddleware } from '../../middlewares/rateLimiter.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getVersionString } from '../../../version.js';
import v2ErrorHandler from '../../middlewares/v2ErrorHandler.js';
import payInV2 from './payIn/index.js';
import reportsV2 from './reports/index.js';
import dashboardReportV2 from './dashboardReport/index.js';
import authV2 from './auth/index.js';
import payOutV2 from './payOut/index.js';
import BankResponseV2 from './bankResponse/index.js';

const v2Router = express.Router();

// v2Router.use(auditLogMiddleware);
v2Router.use(globalRateLimitMiddleware);

v2Router.get('/version', (req, res) =>
  sendSuccess(res, { version: getVersionString(), apiVersion: 'v2' }, 'OK'),
);
v2Router.get('/health', (req, res) =>
  sendSuccess(
    res,
    { status: 'ok', uptimeSeconds: Math.round(process.uptime()) },
    'OK',
  ),
);

v2Router.use('/payIn', payInV2);
v2Router.use('/bankResponse', BankResponseV2);
v2Router.use('/reports', reportsV2);
v2Router.use('/dashboardReport', dashboardReportV2);
v2Router.use('/auth', authV2);
v2Router.use('/payOut', payOutV2);
v2Router.use(v2ErrorHandler);

export default v2Router;
