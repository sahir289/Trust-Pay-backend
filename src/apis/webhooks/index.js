import express from 'express';
// import cashfreeWebHook from './cashfree/index.js';
// import zenTechIndWebhook from './zenTechInd/index.js';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { cashfreeWebHook } from './cashfree.js';
import { zenTechIndWebhook } from './zenTechInd.js';
import { clickrrWebhook } from './clickrr.js';
import { nmplPayWebhook } from './nmplPay.js';
import { silkPayWebhook } from './silkPay.js';
import { handleRazorpayWebhook } from './razorPay.js';    
import { rupeeFlowWebhook } from './rupeeflow.js';
import { orvixPayWebhook } from './orvixPay.js';
import { runsafeWebhook } from './runsafe.js';
import { payEasyWebhook } from './payeasy.js';


const router = express.Router();

router.post('/cashfree', tryCatchHandler(cashfreeWebHook));
router.post('/zenTechInd', tryCatchHandler(zenTechIndWebhook));
router.post('/nmplPay', tryCatchHandler(nmplPayWebhook));
router.post('/runsafe', tryCatchHandler(runsafeWebhook));
router.post('/silkPay', tryCatchHandler(silkPayWebhook));
router.post('/clickrr', tryCatchHandler(clickrrWebhook)); 
router.post('/razorpay', tryCatchHandler(handleRazorpayWebhook));
router.post('/rupeeflow', tryCatchHandler(rupeeFlowWebhook));
router.post('/orvixPay', tryCatchHandler(orvixPayWebhook));
router.post('/payeasy', tryCatchHandler(payEasyWebhook));

export default router;
