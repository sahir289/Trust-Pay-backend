import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { generatePayInUrl } from './payInController.js';

const router = express.Router();
router.get('/', tryCatchHandler(generatePayInUrl));
export default router;
