import express from 'express';
import tryCatchHandler from '../../../utils/tryCatchHandler.js';
import gatherCompanyDataV2 from './dashboardReportV2Controller.js';

const router = express.Router();

// v2 twin of GET /v1/dashboardReport. Same service, standardized v2 envelope.
router.get('/', tryCatchHandler(gatherCompanyDataV2));

export default router;
