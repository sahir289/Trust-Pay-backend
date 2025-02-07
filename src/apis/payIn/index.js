import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { generatePayInUrl, validatePayInUrl } from './payInController.js';

const router = express.Router();
router.get('/', tryCatchHandler(generatePayInUrl));
router.get('/validate-payIn-url/:payInId', tryCatchHandler(validatePayInUrl));
export default router;
