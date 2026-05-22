import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { checkApiWallet } from '../../middlewares/checkApiKey.js';
import { getWalletBalanceController } from './walletBalanceController.js';

const router = express.Router();

// GET /v1/wallet_balance?code=MERCHANT_CODE
router.get(
  '/',
  checkApiWallet,
  tryCatchHandler(getWalletBalanceController),
);


export default router;

