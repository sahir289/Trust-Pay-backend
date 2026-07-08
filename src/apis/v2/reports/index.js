import express from 'express';
import tryCatchHandler from '../../../utils/tryCatchHandler.js';
import { isAuthenticated } from '../../../middlewares/auth.js';
import {
  getPayInReportV2,
  getPayOutReportV2,
  getClientsAccountReportV2,
} from './reportsV2Controller.js';

const router = express.Router();

router.get(
  '/get-payouts-report',
  isAuthenticated,
  tryCatchHandler(getPayOutReportV2),
);
router.get(
  '/get-payins-reports',
  isAuthenticated,
  tryCatchHandler(getPayInReportV2),
);
router.get(
  '/get-accounts-reports',
  isAuthenticated,
  tryCatchHandler(getClientsAccountReportV2),
);

export default router;
