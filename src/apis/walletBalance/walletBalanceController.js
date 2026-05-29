import { sendNewSuccess } from '../../utils/responseHandlers.js';
import { getWalletBalanceService } from './walletBalanceService.js';
import { BadRequestError } from '../../utils/appErrors.js';

export const getWalletBalanceController = async (req, res) => {
  const xApiKey = req.headers['x-api-key'];
  const  code  = req.headers['code'];
  if (!code) throw new BadRequestError('code is required');
    if (!xApiKey) throw new BadRequestError('x-api-key is required');

  const data = await getWalletBalanceService({ code, xApiKey });

  return sendNewSuccess(res, data, 'Wallet balance fetched successfully');
};

