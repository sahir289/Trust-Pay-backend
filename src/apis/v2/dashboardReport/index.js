import express from 'express';
import tryCatchHandler from '../../../utils/tryCatchHandler.js';
import gatherCompanyDataV2 from './dashboardReportV2Controller.js';

const router = express.Router();

router.get('/', tryCatchHandler(gatherCompanyDataV2));

export default router;
