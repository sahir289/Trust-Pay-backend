import { NotFoundError } from '../../utils/appErrors.js';
import { getMerchantsBalance } from '../merchants/merchantDao.js';
import { getLatestNetBalanceByMerchantUserIdDao } from './walletBalanceDao.js';

export const getWalletBalanceService = async ({ code, xApiKey }) => {
    try {
  // Merchant auth -> fetch merchant/user_id
  const merchant = await getMerchantsBalance(code, xApiKey);

  if (!merchant) {
    throw new NotFoundError('Invalid merchant code or API key');
  }

  const netBalance = await getLatestNetBalanceByMerchantUserIdDao(
    merchant.user_id,
  );

  if (netBalance === null || netBalance === undefined) {
    return { balance: 0 };
  }
  return { balance: netBalance };
}catch (error) {
    console.error('Error in getWalletBalanceService:', error);
    throw error;
  }
}
;

