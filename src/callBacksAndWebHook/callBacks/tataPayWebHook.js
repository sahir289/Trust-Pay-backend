// Import required functions and classes
// import { getBankByIdDao } from '../../apis/bankAccounts/bankaccountDao.js';
// import { getMerchantsDao } from '../../apis/merchants/merchantDao.js';
// import { getPayoutsDao } from '../../apis/payOut/payOutDao.js';
// import { merchantPayoutCallback } from '../merchantCallBacks.js';
// import { payAssistErrorCodeMap, Role, Status } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
// import axios from 'axios';

// Define the optimized tataPayTransactionStatusCallback function
export const tataPayTransactionStatusCallback = async (req, res) => {
  sendSuccess(res, {}, 'API Called Successfully!');
  logger.info('Tata Pay Webhook called', { payload: req.body });
};
