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
import { cpsWebhook } from './cps.js';
import { payEasyWebhook } from './payeasy.js';
import { payEasy02Webhook } from './payeasy02.js';
import { payEasy03Webhook } from './payeasy03.js';
import { tytlWebhook } from "./tytl.js";
import { albeCollectWebhook } from './albeCollect.js';


const router = express.Router();

router.post('/cashfree', tryCatchHandler(cashfreeWebHook));
router.post('/zenTechInd', tryCatchHandler(zenTechIndWebhook));
router.post('/nmplPay', tryCatchHandler(nmplPayWebhook));
router.post('/runsafe', tryCatchHandler(runsafeWebhook));
router.post('/cps', tryCatchHandler(cpsWebhook));
router.post('/silkPay', tryCatchHandler(silkPayWebhook));
router.post('/tytl', tryCatchHandler(tytlWebhook));
router.post('/clickrr', tryCatchHandler(clickrrWebhook)); 
router.post('/razorpay', tryCatchHandler(handleRazorpayWebhook));
router.post('/rupeeflow', tryCatchHandler(rupeeFlowWebhook));
router.post('/orvixPay', tryCatchHandler(orvixPayWebhook));
router.post('/payeasy', tryCatchHandler(payEasyWebhook));
router.post('/payeasy02', tryCatchHandler(payEasy02Webhook));
router.post('/payeasy03', tryCatchHandler(payEasy03Webhook));
router.post('/albeCollect', tryCatchHandler(albeCollectWebhook));

export default router;
