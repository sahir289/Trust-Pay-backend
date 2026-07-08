import { sendSuccess } from '../../../utils/responseHandlers.js';
import { getWalletBalanceService } from '../../walletBalance/walletBalanceService.js';
import { BadRequestError } from '../../../utils/appErrors.js';

export const getWalletBalanceV2 = async (req, res) => {
  const xApiKey = req.headers['x-api-key'];
  const code = req.headers['code'];
  if (!code) throw new BadRequestError('code is required');
  if (!xApiKey) throw new BadRequestError('x-api-key is required');

  const data = await getWalletBalanceService({ code, xApiKey });
  return sendSuccess(res, data, 'Wallet balance fetched successfully');
};
