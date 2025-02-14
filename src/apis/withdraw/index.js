import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { getWithdrawById } from './withDrawController.js';

const router = express.Router();
router.get('/get-withdraw/:payInId', tryCatchHandler(getWithdrawById));

export default router;
