import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { getMerchantBankById } from './bankController.js';

const router = express.Router();
router.get('/', tryCatchHandler(getMerchantBankById));
export default router;
