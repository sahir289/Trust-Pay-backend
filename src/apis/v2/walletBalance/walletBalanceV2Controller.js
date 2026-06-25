import { sendV2Success } from '../../../utils/responseHandlers.js';
import { getWalletBalanceService } from '../../walletBalance/walletBalanceService.js';
import { BadRequestError } from '../../../utils/appErrors.js';

/**
 * GET /v2/wallet_balance — v2 twin of the v1 wallet-balance endpoint.
 *
 * Reuses the exact same `getWalletBalanceService` as v1; only the response
 * envelope differs (sendV2Success). Thrown errors (BadRequestError here,
 * NotFoundError from the service) are converted to the v2 envelope by the
 * v2ErrorHandler mounted on the v2 router.
 *
 * NOTE: the `checkApiWallet` auth middleware (reused from v1) still emits the
 * v1 error shape on auth failure — normalizing that is a Phase-2 follow-up.
 */
export const getWalletBalanceV2 = async (req, res) => {
  const xApiKey = req.headers['x-api-key'];
  const code = req.headers['code'];
  if (!code) throw new BadRequestError('code is required');
  if (!xApiKey) throw new BadRequestError('x-api-key is required');

  const data = await getWalletBalanceService({ code, xApiKey });
  return sendV2Success(res, data, 'Wallet balance fetched successfully');
};
