import express from 'express';
import tryCatchHandler from '../../../utils/tryCatchHandler.js';
import { checkApiWallet } from '../../../middlewares/checkApiKey.js';
import { getWalletBalanceV2 } from './walletBalanceV2Controller.js';

const router = express.Router();

// v2 twin of GET /v1/walletBalance. Read-only; same service + auth middleware,
// standardized v2 response envelope.
router.get('/', checkApiWallet, tryCatchHandler(getWalletBalanceV2));

export default router;
