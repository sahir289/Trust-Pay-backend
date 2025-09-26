import express from 'express';
// import cashfreeWebHook from './cashfree/index.js';
// import zenTechIndWebhook from './zenTechInd/index.js';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { cashfreeWebHook } from './cashfree.js';
import { zenTechIndWebhook } from './zenTechInd.js';

const router = express.Router();

router.post('/cashfree', tryCatchHandler(cashfreeWebHook));
router.post('/zenTechInd', tryCatchHandler(zenTechIndWebhook));

export default router;
